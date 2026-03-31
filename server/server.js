require('dotenv').config();
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
});
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// ------------------------------------------------------------------
// PII ENCRYPTION ENGINE (Zero-Leak Strategy)
// ------------------------------------------------------------------
const DATABASE_SECRET = process.env.DATABASE_SECRET || 'nexora_private_protocol_internal_encryption_key_31';
const algorithm = 'aes-256-cbc';
const key = crypto.createHash('sha256').update(DATABASE_SECRET).digest();

function encryptField(text) {
    if (!text || text === 'Not Set' || text.startsWith('e:')) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `e:${iv.toString('hex')}:${encrypted}`;
}

function decryptField(encryptedText) {
    if (!encryptedText || !encryptedText.startsWith('e:')) return encryptedText;
    try {
        const parts = encryptedText.split(':');
        const iv = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return encryptedText; // Fallback to raw if decryption fails
    }
}

function hashPhone(phone) {
    if (!phone || phone === 'Not Set') return null;
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 5) return null;
    return crypto.createHash('sha256').update(normalized + DATABASE_SECRET).digest('hex');
}

const app = express();
const server = http.createServer(app);

app.get('/', (req, res) => {
    res.json({ 
        status: "operational", 
        platform: "Nexora Core",
        version: "1.3.1-ANTI",
        security: "Zero-Knowledge Active"
    });
});

// ------------------------------------------------------------------
// DATABASE INITIALIZATION (SQLite + PostgreSQL Support)
// ------------------------------------------------------------------
let db;
let dbType = 'sqlite'; // 'sqlite' or 'postgres'
let pgPool;

(async () => {
    try {
        const databaseUrl = process.env.DATABASE_URL;

        if (databaseUrl) {
            console.log("[DATABASE] Mode: PostgreSQL (Supabase/Neon)");
            dbType = 'postgres';
            
            // Clean database URL to avoid SSL alias warnings
            const cleanUrl = databaseUrl.split('?')[0];

            pgPool = new Pool({
                connectionString: cleanUrl,
                ssl: { rejectUnauthorized: false }
            });
            
            // Mock sqlite methods for pg
            db = {
                exec: async (sql) => {
                    const pgSql = sql
                        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
                        .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
                        .replace(/DATETIME/gi, 'TIMESTAMP')
                        .replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT FALSE')
                        .replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT TRUE');
                    return pgPool.query(pgSql);
                },
                get: async (sql, params = []) => {
                    let pgSql = sql.replace(/\?/g, (_, i, s) => {
                        let count = (s.slice(0, i).match(/\?/g) || []).length + 1;
                        return '$' + count;
                    }).replace(/datetime\('now',\s*'-(\d+)\s+day'\)/gi, "NOW() - INTERVAL '$1 day'")
                      .replace(/datetime\('now'\)/gi, "NOW()");

                    // Handle INSERT OR IGNORE and REPLACE (basic regex)
                    pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO').replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO');
                    const res = await pgPool.query(pgSql, params);
                    return res.rows[0];
                },
                all: async (sql, params = []) => {
                    let pgSql = sql.replace(/\?/g, (_, i, s) => {
                        let count = (s.slice(0, i).match(/\?/g) || []).length + 1;
                        return '$' + count;
                    }).replace(/datetime\('now',\s*'-(\d+)\s+day'\)/gi, "NOW() - INTERVAL '$1 day'")
                      .replace(/datetime\('now'\)/gi, "NOW()");

                    const res = await pgPool.query(pgSql, params);
                    return res.rows;
                },
                run: async (sql, params = []) => {
                    let pgSql = sql.replace(/\?/g, (_, i, s) => {
                        let count = (s.slice(0, i).match(/\?/g) || []).length + 1;
                        return '$' + count;
                    }).replace(/datetime\('now',\s*'-(\d+)\s+day'\)/gi, "NOW() - INTERVAL '$1 day'")
                      .replace(/datetime\('now'\)/gi, "NOW()");
                    
                    if (pgSql.toLowerCase().includes('insert or ignore')) {
                        pgSql = pgSql.replace(/insert or ignore into/gi, 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
                    } else if (pgSql.toLowerCase().includes('insert or replace')) {
                        // Very basic replace handling
                        pgSql = pgSql.replace(/insert or replace into/gi, 'INSERT INTO') + ' ON CONFLICT (id) DO UPDATE SET id=EXCLUDED.id'; 
                    } else if (pgSql.toLowerCase().includes('insert into story_views')) {
                         pgSql = pgSql + ' ON CONFLICT (story_id, viewer_username) DO NOTHING';
                    } else if (pgSql.toLowerCase().includes('insert into story_likes')) {
                         pgSql = pgSql + ' ON CONFLICT (story_id, liker_username) DO NOTHING';
                    } else if (pgSql.toLowerCase().includes('insert into connections')) {
                         pgSql = pgSql + ' ON CONFLICT (user_a, user_b) DO NOTHING';
                    } else if (pgSql.toLowerCase().includes('insert into connection_requests')) {
                         // Fallback for pending requests if they conflict
                         pgSql = pgSql + ' ON CONFLICT DO NOTHING';
                    } else if (pgSql.toLowerCase().includes('insert into users')) {
                         pgSql = pgSql + ' ON CONFLICT DO NOTHING';
                    }

                    const res = await pgPool.query(pgSql, params);
                    return { lastID: res.oid, changes: res.rowCount };
                }
            };
        } else {
            console.log("[DATABASE] Mode: Local SQLite");
            dbType = 'sqlite';
            const dbPath = process.env.DATABASE_PATH || './database.sqlite';
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
            
            db = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });
        }

        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'Standard',
                status TEXT DEFAULT 'Active',
                color TEXT NOT NULL,
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
                phone_number TEXT DEFAULT 'Not Set',
                phone_hash TEXT
            );

            CREATE TABLE IF NOT EXISTS connection_requests (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                from_username TEXT NOT NULL,
                to_username TEXT NOT NULL,
                from_name TEXT NOT NULL,
                from_color TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'}
            );

            CREATE TABLE IF NOT EXISTS connections (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                user_a TEXT NOT NULL,
                user_b TEXT NOT NULL,
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
                UNIQUE(user_a, user_b)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                owner_username TEXT NOT NULL,
                from_username TEXT NOT NULL,
                type TEXT NOT NULL,
                message TEXT NOT NULL,
                is_read ${dbType==='postgres' ? 'BOOLEAN DEFAULT FALSE' : 'BOOLEAN DEFAULT 0'},
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'}
            );

            CREATE TABLE IF NOT EXISTS stories (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                username TEXT NOT NULL,
                media_url TEXT NOT NULL,
                media_type TEXT DEFAULT 'image',
                caption TEXT,
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'}
            );

            CREATE TABLE IF NOT EXISTS story_views (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                story_id INTEGER NOT NULL,
                viewer_username TEXT NOT NULL,
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
                UNIQUE(story_id, viewer_username)
            );

            CREATE TABLE IF NOT EXISTS story_likes (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                story_id INTEGER NOT NULL,
                liker_username TEXT NOT NULL,
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
                UNIQUE(story_id, liker_username)
            );
        `);

        // Migration for phone_number and phone_hash (Run for both SQLite and Postgres)
        try { await db.run("ALTER TABLE users ADD COLUMN phone_number TEXT DEFAULT 'Not Set'"); } catch (e) { }
        try { await db.run("ALTER TABLE users ADD COLUMN phone_hash TEXT"); } catch (e) { }
        // Migration for avatar_url
        try { await db.run("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL"); } catch (e) { }

        // SEED DATA
        const seedUsers = [
            ['Nexora Root', 'root@nexora.app', 'Nexora_31', 'Nexora@31', 'from-[#6c5ce7] to-[#00d4ff]', 'Admin', '0000000031'],
            ['Aarav Shah', 'aarav@nexora.app', 'aarav_vibe', 'Nexora@31', 'from-amber-500 to-orange-600', 'Standard', '9876543210'],
            ['Isha Sharma', 'isha@nexora.app', 'isha_creative', 'Nexora@31', 'from-rose-500 to-pink-600', 'Standard', '9876543211'],
            ['Rohan Mehta', 'rohan@nexora.app', 'rohan_nex', 'Nexora@31', 'from-emerald-500 to-teal-600', 'Standard', '9876543212'],
            ['Zoya Khan', 'zoya@nexora.app', 'zoya_style', 'Nexora@31', 'from-fuchsia-500 to-purple-600', 'Standard', '9876543213'],
            ['Kabir Das', 'kabir@nexora.app', 'kabir_code', 'Nexora@31', 'from-blue-500 to-indigo-600', 'Standard', '9876543214'],
            ['Myra Goel', 'myra@nexora.app', 'myra_art', 'Nexora@31', 'from-sky-400 to-blue-500', 'Standard', '9876543215'],
            ['Dev Patel', 'dev@nexora.app', 'dev_protocol', 'Nexora@31', 'from-violet-500 to-purple-800', 'Standard', '9876543216']
        ];
        for (const user of seedUsers) {
            try {
                const checkSql = dbType === 'postgres' ? 'SELECT id FROM users WHERE username = $1' : 'SELECT id FROM users WHERE username = ?';
                const existing = await db.get(checkSql, [user[2]]);
                if (!existing) {
                    const saltRounds = 10;
                    const hashed = await bcrypt.hash(user[3], saltRounds);
                    await db.run(
                        'INSERT INTO users (full_name, email, username, password, color, role, phone_number, phone_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                        [encryptField(user[0]), user[1], user[2], hashed, user[4], user[5], encryptField(user[6] || 'Not Set'), hashPhone(user[6])]
                    );
                }
            } catch (err) { }
        }

        // SEED CONNECTIONS for Nexora_31
        const connectionsToSeed = [
            ['nexora_31', 'aarav_vibe'],
            ['nexora_31', 'isha_creative'],
            ['nexora_31', 'rohan_nex'],
            ['nexora_31', 'zoya_style'],
            ['nexora_31', 'kabir_code']
        ];
        for (const [u1, u2] of connectionsToSeed) {
            const [first, second] = [u1.toLowerCase(), u2.toLowerCase()].sort();
            try {
                await db.run('INSERT INTO connections (user_a, user_b) VALUES (?, ?)', [first, second]);
            } catch (e) { /* already exists */ }
        }

        console.log(`[DATABASE] ${dbType === 'postgres' ? 'PostgreSQL Connection Established' : 'SQLite Initialized Successfully'}`);
    } catch (e) {
    }
})();

// ------------------------------------------------------------------
// SECURITY HARDENING (Phase 5)
// ------------------------------------------------------------------
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "wss:", "ws:", "https:"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

// CORS — allow Vercel domain + localhost
const ALLOWED_ORIGINS = [
    'https://nexora31.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            // Still allow for now — Render previews / custom domains
            callback(null, true);
        }
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Multer for encrypted file uploads (stored in memory, never on disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ------------------------------------------------------------------
// CONFIGURATIONS (Supabase + Gmail SMTP + Cloudinary)
// ------------------------------------------------------------------
// Initialize Firebase Admin (Optional based on your setup style)
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle newlines in private key
                privateKey: process.env.FIREBASE_PRIVATE_KEY
                    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').trim()
                    : undefined,
            })
        });
        console.log("[FIREBASE] Admin SDK connected successfully.");
    } catch (e) {
        console.error("[FIREBASE] Initialization error:", e.message);
    }
}

const emailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

emailTransporter.verify((error, success) => {
    if (error) {
        console.error("[SMTP] Core Communication Relay Failure:", error);
    } else {
        console.log("[SMTP] Secure Mail Protocol Initialized.");
    }
});

// ------------------------------------------------------------------
// NEXORA PREMIUM MAIL PROTOCOL (Universal Templates)
// ------------------------------------------------------------------
async function nexoraMailProtocol(type, to, data) {
    const APP_LOGO = "https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg";
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_NAME = process.env.GMAIL_NAME || "Nexora Private Chat";

    let subject = "";
    let html = "";

    const sharedStyles = `
        <style>
            body { font-family: 'Inter', -apple-system, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 40px; overflow: hidden; box-shadow: 0 40px 100px rgba(108,92,231,0.06); border: 1px solid #eef2f7; }
            .header { background: linear-gradient(135deg, #6c5ce7 0%, #00d4ff 100%); padding: 60px 40px; text-align: center; }
            .logo-box { width: 90px; height: 90px; background: #fff; border-radius: 24px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
            .content { padding: 50px 45px; text-align: center; }
            .title { font-size: 32px; font-weight: 900; color: #1a1a2e; margin-bottom: 15px; letter-spacing: -1.5px; line-height: 1.1; }
            .text { color: #64748b; font-size: 16px; line-height: 1.8; margin-bottom: 40px; }
            .otp-box { background: #f8fafc; border: 2px dashed #6c5ce7; border-radius: 20px; padding: 25px; margin: 30px 0; }
            .otp-code { font-size: 42px; font-weight: 950; color: #6c5ce7; letter-spacing: 12px; margin-left: 12px; font-family: 'Courier New', monospace; }
            .button { background: linear-gradient(135deg, #6c5ce7 0%, #00d4ff 100%); color: #ffffff !important; padding: 20px 45px; border-radius: 100px; text-decoration: none; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 20px 40px rgba(108,92,231,0.3); }
            .footer { background: #fafbfc; padding: 45px; text-align: center; border-top: 1px solid #f1f5f9; }
            .footer-text { font-size: 11px; color: #94a3b8; line-height: 1.8; margin: 0; }
            .highlight { color: #6c5ce7; font-weight: 800; }
        </style>
    `;

    if (type === 'welcome') {
        subject = "Welcome to Nexora: Protocol Established";
        html = `
            <!DOCTYPE html><html><head>${sharedStyles}</head>
            <body><div class="container">
                <div class="header">
                    <div class="logo-box"><img src="${APP_LOGO}" style="width: 70px; height: 70px;" /></div>
                    <div style="color: #fff; font-weight: 900; letter-spacing: 2px; font-size: 11px; text-transform: uppercase;">Identity Verified</div>
                </div>
                <div class="content">
                    <h1 class="title">Welcome to the Void.</h1>
                    <p class="text">Subject <span class="highlight">@${data.username}</span>, your identity has been successfully registered on the Nexora private chat network. Your link is now secured with end-to-end P2P encryption.</p>
                    <a href="${process.env.CLIENT_URL || 'https://nexora31.vercel.app'}/auth" class="button">ESTABLISH SECURE LINK</a>
                </div>
                <div class="footer"><p class="footer-text">&copy; ${new Date().getFullYear()} NEXORA GLOBAL &bull; SECURITY PROTOCOL ACTIVE</p></div>
            </div></body></html>`;
    } else if (type === 'otp') {
        subject = "Nexora Recovery: Verification Code";
        html = `
            <!DOCTYPE html><html><head>${sharedStyles}</head>
            <body><div class="container">
                <div class="header">
                    <div class="logo-box"><img src="${APP_LOGO}" style="width: 70px; height: 70px;" /></div>
                    <div style="color: #fff; font-weight: 900; letter-spacing: 2px; font-size: 11px; text-transform: uppercase;">Recovery Channel Open</div>
                </div>
                <div class="content">
                    <h1 class="title">Secure Access Code</h1>
                    <p class="text">A request for password recovery has been initiated. Use the authorization code below to verify your identity.</p>
                    <div class="otp-box"><div class="otp-code">${data.otp}</div></div>
                    <p class="text" style="font-size: 12px; margin: 0;">This code will expire in 10 minutes. If you did not request this, secure your account immediately.</p>
                </div>
                <div class="footer"><p class="footer-text">Transmission Integrity: AES-256-GCM &bull; IP: Filtered</p></div>
            </div></body></html>`;
    } else if (type === 'login_alert') {
        subject = "Security Alert: Login Detected";
        html = `
            <!DOCTYPE html><html><head>${sharedStyles}</head>
            <body><div class="container">
                <div class="header" style="background: linear-gradient(135deg, #ff006e 0%, #6c5ce7 100%);">
                    <div class="logo-box"><img src="${APP_LOGO}" style="width: 70px; height: 70px;" /></div>
                    <div style="color: #fff; font-weight: 900; letter-spacing: 2px; font-size: 11px; text-transform: uppercase;">Security Protocol Triggered</div>
                </div>
                <div class="content">
                    <h1 class="title">New Login Trace</h1>
                    <p class="text">A new login was detected for <span class="highlight">@${data.username}</span>. If this was you, ignore this transmission. If not, LOCK YOUR TERMINAL IMMEDIATELY.</p>
                    <div style="text-align: left; background: #f8fafc; padding: 25px; border-radius: 20px; border: 1px solid #f1f5f9;">
                        <p class="footer-text" style="color: #1a1a2e; font-size: 13px;"><strong>Node Identifier:</strong> ${data.username}</p>
                        <p class="footer-text" style="color: #1a1a2e; font-size: 13px;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                <div class="footer"><p class="footer-text">Security Vault &copy; NEXORA CORE &bull; ALL RIGHTS ENCRYPTED</p></div>
            </div></body></html>`;
    }

    try {
        await emailTransporter.sendMail({
            from: `"${GMAIL_NAME}" <${GMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html
        });
        console.log(`[SMTP] ${type.toUpperCase()} Transmission Successfully Relayed to: ${to}`);
        return true;
    } catch (err) {
        console.error(`[SMTP] ${type.toUpperCase()} Transmission FAILED:`, err.message);
        return false;
    }
}

// Cloudinary Config (encrypted media storage)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

const APP_LOGO_URL = "https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg";

// ------------------------------------------------------------------
// WEB PUSH VAPID SETUP
// ------------------------------------------------------------------
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        `mailto:${process.env.GMAIL_USER || 'nexora@nexora.app'}`,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
    console.log('[PUSH] Web Push VAPID configured.');
} else {
    console.warn('[PUSH] VAPID keys not set — push notifications disabled. Run: node -e "const w=require(\'web-push\');const k=w.generateVAPIDKeys();console.log(JSON.stringify(k))" to generate.');
}

// In-memory push subscription store (username -> subscription)
const pushSubscriptions = new Map(); // username -> PushSubscription

// In-memory offline message queue: username -> [{...msgData}]
const offlineMessageQueue = new Map();

function queueMessageForUser(username, msgData) {
    if (!offlineMessageQueue.has(username)) {
        offlineMessageQueue.set(username, []);
    }
    const queue = offlineMessageQueue.get(username);
    // Limit queue to 100 messages per user
    if (queue.length >= 100) queue.shift();
    queue.push(msgData);

    // Send Web Push notification if user has a subscription
    const sub = pushSubscriptions.get(username);
    if (sub && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const payload = JSON.stringify({
            title: `New message from ${msgData.from || 'Someone'}`,
            body: '🔒 Encrypted message received',
            icon: '/icon.svg',
            badge: '/icon.svg',
            data: { from: msgData.from },
        });
        webpush.sendNotification(sub, payload).catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription expired — remove it
                pushSubscriptions.delete(username);
            }
            console.warn('[PUSH] Notification failed:', err.message);
        });
    }
}

function deliverQueuedMessages(username, socket) {
    const queue = offlineMessageQueue.get(username);
    if (!queue || queue.length === 0) return;
    console.log(`[QUEUE] Delivering ${queue.length} queued message(s) to ${username}`);
    for (const msg of queue) {
        socket.emit(msg.isMedia ? 'dm:media' : 'dm:message', msg);
    }
    offlineMessageQueue.delete(username);
}

// ------------------------------------------------------------------
// SOCKET.IO REAL-TIME ENGINE + WEBRTC SIGNALING
// ------------------------------------------------------------------
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"],
        credentials: true,
    }
});

// Track connected users for call routing and device sync
const socketToUser = new Map(); // socketId -> userId

io.on('connection', (socket) => {
    console.log(`[+] Node Connected: ${socket.id}`);

    // User registers their identity — Joins a private room for cross-device sync
    socket.on('register', (userId) => {
        if (!userId) return;
        const normalizedId = userId.toLowerCase();
        socketToUser.set(socket.id, normalizedId);
        
        // Joining a room named after the userId allows us to emit to all of their devices
        socket.join(normalizedId);
        console.log(`[+] Registered: ${normalizedId} → Channel Sync Active`);

        // 1. Broadcast online status to others
        socket.broadcast.emit('user_status', { userId: normalizedId, status: 'online' });

        // 3. Deliver any queued offline messages
        deliverQueuedMessages(normalizedId, socket);
    });

    // Join an encrypted room tunnel
    socket.on('join_tunnel', (vaultId) => {
        socket.join(vaultId);
    });

    // ═══════════════════════════════════════════════
    // DIRECT MESSAGE RELAY (per-user routing)
    // Server relays encrypted payload directly to target — ZERO KNOWLEDGE
    // ═══════════════════════════════════════════════
    socket.on('dm:message', (data) => {
        // data: { to, from, ciphertext, iv, msgId, timestamp, replyTo? }
        const targetId = (data.to || '').toLowerCase();
        const senderId = socketToUser.get(socket.id);
        const enriched = { ...data, from: senderId || data.from };

        // 1. Relay to target user's devices
        const targetRoom = io.sockets.adapter.rooms.get(targetId);
        if (targetRoom && targetRoom.size > 0) {
            io.to(targetId).emit('dm:message', enriched);
        } else {
            // Offline: queue for delivery when any of their devices reconnect
            queueMessageForUser(targetId, enriched);
        }

        // 2. Sync to sender's OTHER devices
        if (senderId) {
            socket.to(senderId).emit('dm:message', enriched);
        }
    });

    // Media message relay (attachment)
    socket.on('dm:media', (data) => {
        const targetId = (data.to || '').toLowerCase();
        const senderId = socketToUser.get(socket.id);
        const enriched = { ...data, from: senderId || data.from, isMedia: true };

        const targetRoom = io.sockets.adapter.rooms.get(targetId);
        if (targetRoom && targetRoom.size > 0) {
            io.to(targetId).emit('dm:media', enriched);
        } else {
            queueMessageForUser(targetId, enriched);
        }

        // Sync to sender's OTHER devices
        if (senderId) {
            socket.to(senderId).emit('dm:media', enriched);
        }
    });

    // ═══════════════════════════════════════════════
    // TYPING INDICATOR (per-conversation)
    // ═══════════════════════════════════════════════
    socket.on('dm:typing', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:typing', { from: senderId, isTyping: data.isTyping });
        }
    });

    // ═══════════════════════════════════════════════
    // MESSAGE DELETION RELAY (Sync across all devices)
    // ═══════════════════════════════════════════════
    socket.on('dm:delete', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            // Tell the receiver
            io.to(data.to?.toLowerCase()).emit('dm:delete', { from: senderId, msgId: data.msgId });
            // Tell sender's other devices
            socket.to(senderId).emit('dm:delete', { from: senderId, msgId: data.msgId });
        }
    });

    socket.on('dm:wallpaper', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:wallpaper', { from: senderId, wallpaper: data.wallpaper });
            socket.to(senderId).emit('dm:wallpaper', { from: senderId, wallpaper: data.wallpaper });
        }
    });

    socket.on('dm:seen', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:seen', { from: senderId, msgId: data.msgId });
        }
    });

    socket.on('dm:disappear_setting', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:disappear_setting', { from: senderId, timer: data.timer });
            socket.to(senderId).emit('dm:disappear_setting', { from: senderId, timer: data.timer });
        }
    });

    socket.on('dm:clear_chat', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:clear_chat', { from: senderId });
            socket.to(senderId).emit('dm:clear_chat', { from: senderId });
        }
    });

    socket.on('dm:reaction', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:reaction', { from: senderId, msgId: data.msgId, emoji: data.emoji });
            socket.to(senderId).emit('dm:reaction', { from: senderId, msgId: data.msgId, emoji: data.emoji });
        }
    });

    // Relay E2E Encrypted Payload (legacy shared tunnel — kept for backward compat)
    socket.on('transmit_encrypted_payload', (data) => {
        socket.to(data.tunnelId).emit('receive_encrypted_payload', data);
    });

    // ═══════════════════════════════════════════════
    // ECDH PUBLIC KEY EXCHANGE (Phase 3)
    // Server relays public keys — never stores or inspects them
    // ═══════════════════════════════════════════════
    socket.on('key:exchange', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('key:exchange', {
                from: senderId,
                publicKey: data.publicKey,
            });
        }
    });

    // ═══════════════════════════════════════════════
    // WEBRTC SIGNALING (Phase 2)
    // Server ONLY relays — never inspects SDP or ICE data
    // ═══════════════════════════════════════════════

    socket.on('call:offer', (data) => {
        const senderId = socketToUser.get(socket.id);
        const targetId = data.to?.toLowerCase();
        if (senderId) {
            io.to(targetId).emit('call:offer', {
                from: senderId,
                sdp: data.sdp,
                callType: data.callType,
                callerName: data.callerName,
                callerColor: data.callerColor,
                roomId: data.roomId // Pass along room ID if provided
            });
            // Push notification for incoming call
            const sub = pushSubscriptions.get(targetId);
            if (sub && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
                webpush.sendNotification(sub, JSON.stringify({
                    title: `Incoming ${data.callType} call`,
                    body: `${data.callerName || senderId} is calling you on Nexora`,
                    icon: '/icon.svg',
                    badge: '/icon.svg',
                })).catch(() => {});
            }
        }
    });

    socket.on('call:answer', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('call:answer', { from: senderId, sdp: data.sdp });
        }
    });

    socket.on('call:ice-candidate', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            // Target can be a userId or a roomId
            io.to(data.to?.toLowerCase()).emit('call:ice-candidate', { from: senderId, candidate: data.candidate });
        }
    });

    // ── NEW ROOM-BASED CALL SIGNALING (CallManager Support) ──
    socket.on('create-room', ({ roomId, offer }) => {
        const senderId = socketToUser.get(socket.id);
        socket.join(roomId);
        console.log(`[Call] Room Created: ${roomId} by ${senderId}`);
        // For direct calls, the 'to' is usually the user we are calling.
        // If roomId is used for signaling, we broadcast 'offer-received' to the other peer(s).
        // Since Nexora usually calls 1-on-1, 'roomId' is typically shared via another channel or known ID.
        socket.to(roomId).emit('offer-received', { offer, roomId, from: senderId });
    });

    socket.on('join-room', ({ roomId }) => {
        const senderId = socketToUser.get(socket.id);
        socket.join(roomId);
        console.log(`[Call] Peer Joined: ${roomId} (${senderId})`);
    });

    socket.on('send-answer', ({ roomId, answer }) => {
        const senderId = socketToUser.get(socket.id);
        socket.to(roomId).emit('answer-received', { answer, from: senderId });
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        socket.to(roomId).emit('ice-candidate', { candidate });
    });

    socket.on('end-call', ({ roomId }) => {
        io.to(roomId).emit('call-ended');
        // Clean up: make all sockets in room leave
        const clients = io.sockets.adapter.rooms.get(roomId);
        if (clients) {
            for (const socketId of clients) {
                const s = io.sockets.sockets.get(socketId);
                if (s) s.leave(roomId);
            }
        }
    });

    socket.on('call:state-update', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId && data.to) {
            io.to(data.to.toLowerCase()).emit('call:state-update', { 
                from: senderId, 
                state: data.state 
            });
        }
    });

    socket.on('call:hangup', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('call:hangup', { from: senderId });
            socket.to(senderId).emit('call:hangup', { from: senderId });
        }
    });

    socket.on('call:reject', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('call:reject', { from: senderId });
            socket.to(senderId).emit('call:reject', { from: senderId });
        }
    });

    socket.on('screenshot_taken', (data) => {
        socket.to(data.tunnelId).emit('notify_screenshot', { user: socket.id });
    });

    // ═══════════════════════════════════════════════
    // VIEW-ONCE ACKNOWLEDGEMENT (both sides sync)
    // ═══════════════════════════════════════════════
    socket.on('dm:view_once_ack', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:view_once_ack', { from: senderId, msgId: data.msgId });
            socket.to(senderId).emit('dm:view_once_ack', { from: senderId, msgId: data.msgId });
        }
    });



    socket.on('disconnect', () => {
        const userId = socketToUser.get(socket.id);
        if (userId) {
            socketToUser.delete(socket.id);
            
            // Check if this was the last device for this user
            const userRoom = io.sockets.adapter.rooms.get(userId);
            if (!userRoom || userRoom.size === 0) {
                 io.emit('user_status', { userId, status: 'offline' });
                 console.log(`[-] Registered Identity Fully Logged Off: ${userId}`);
            }
        }
        console.log(`[-] Node Disconnected: ${socket.id}`);
    });
});

// ------------------------------------------------------------------
// AUTHENTICATION FLOWS (Normal vs Special Atithi)
// ------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (!db) return res.status(500).json({ error: "Database not ready" });
        const identifier = username.toLowerCase().trim();
        // Search by username or email (raw comparison for index)
        const user = await db.get('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [identifier, identifier]);

        if (user) {
            const isMatch = await bcrypt.compare(password, user.password).catch(() => password === user.password);

            if (isMatch) {
                // Send Login Alert (Non-blocking)
                nexoraMailProtocol('login_alert', user.email, { username: user.username }).catch(() => {});

                return res.json({ 
                    status: "success", 
                    role: user.role, 
                    fullName: decryptField(user.full_name), 
                    email: user.email, 
                    username: user.username, 
                    phoneNumber: decryptField(user.phone_number), 
                    color: user.color, 
                    message: "Identity recognized. Protocol access granted." 
                });
            }
        }
        res.status(401).json({ status: "error", message: "Authentication failed. Invalid identity." });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// NEW: Account Recovery Endpoint (Phase 6)
app.get('/api/auth/check-username', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username required" });
    try {
        if (!db) return res.status(500).json({ error: "Database not ready" });
        const user = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [username.trim(), username.trim()]);
        res.json({ available: !user });
    } catch (err) {
        res.status(500).json({ error: "Server error during check" });
    }
});

let currentAnnouncement = "Nexora Protocol: All links established. Deeply encrypted.";

app.get('/api/admin/announcement', (req, res) => {
    res.json({ announcement: currentAnnouncement });
});

app.post('/api/admin/announcement', (req, res) => {
    const { announcement } = req.body;
    if (announcement !== undefined) {
        currentAnnouncement = announcement;
        res.json({ status: "success", announcement: currentAnnouncement });
    } else {
        res.status(400).json({ error: "No announcement provided." });
    }
});

// OTP Store: email -> { otp, expiry, verified }
const otpStore = new Map();

app.post('/api/auth/recovery', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    try {
        if (!db) return res.status(500).json({ error: "Database not ready" });
        // Only send to registered emails
        const user = await db.get('SELECT email FROM users WHERE LOWER(email) = LOWER(?)', [email]);
        if (!user) {
            // Return success anyway to prevent email enumeration
            return res.json({ status: "success", message: "If this email is registered, a code has been sent." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store OTP
        otpStore.set(email.toLowerCase(), { otp, expiry, verified: false });

        const recoveryHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
                    .wrapper { padding: 60px 20px; }
                    .container { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 48px; overflow: hidden; box-shadow: 0 40px 100px rgba(108,92,231,0.06); border: 1px solid #eef2f7; text-align: center; }
                    .content { padding: 60px 45px; }
                    .header-logo { width: 90px; height: 90px; object-fit: contain; margin-bottom: 35px; border-radius: 24px; }
                    .protocol-badge { display: inline-block; background: rgba(108,92,231,0.06); color: #6c5ce7; padding: 10px 20px; border-radius: 100px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px; }
                    .recover-title { font-size: 28px; font-weight: 900; color: #1a1a2e; margin: 0 0 15px 0; letter-spacing: -1px; }
                    .recover-desc { font-size: 15px; color: #64748b; line-height: 1.8; margin-bottom: 40px; }
                    
                    .otp-vault { background: #f8fafc; border: 1px dashed #6c5ce7; border-radius: 32px; padding: 45px; margin-bottom: 35px; position: relative; }
                    .otp-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; display: block; }
                    .otp-code { font-size: 48px; font-weight: 900; letter-spacing: 14px; color: #6c5ce7; margin: 0; }
                    .otp-expiry { font-size: 13px; color: #94a3b8; margin-top: 25px; font-weight: 600; }
                    
                    .security-infobox { background: rgba(46,213,115,0.05); border: 1px solid rgba(46,213,115,0.1); border-radius: 20px; padding: 20px; margin-top: 35px; }
                    .security-text { font-size: 11px; font-weight: 800; color: #15c35a; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
                    
                    .footer { background: #fafbfc; padding: 45px; border-top: 1px solid #f1f5f9; }
                    .privacy-note { font-size: 11px; color: #94a3b8; line-height: 1.8; margin-bottom: 25px; text-align: left; }
                    .copyright { font-size: 10px; color: #cbd5e1; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="container">
                        <div class="content">
                            <img src="${APP_LOGO_URL}" alt="Nexora" class="header-logo" />
                            <div class="protocol-badge">Security Link Verification</div>
                            <h2 class="recover-title">Verify Your Identity</h2>
                            <p class="recover-desc">A request was made to unlock the recovery vault for your Nexora account. Use the encrypted authorization code below to establish a secure link.</p>
                            
                            <div class="otp-vault">
                                <span class="otp-label">Encryption Key Segment</span>
                                <div class="otp-code">${otp}</div>
                                <p class="otp-expiry">Universal expiry in 10 minutes.</p>
                            </div>

                            <div class="security-infobox">
                                <p class="security-text">Transmission Integrity Verified - AES-256-GCM</p>
                            </div>
                        </div>

                        <div class="footer">
                            <div class="privacy-note">
                                This is an automated security transmission from Nexora Core. All recovery protocols are strictly zero-knowledge. If you did not initiate this request, your account remains secure and no further action is required.
                            </div>
                            <div class="copyright">
                                &copy; ${new Date().getFullYear()} NEXORA SYSTEMS &bull; PRIVACY PROTOCOL
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
        await nexoraMailProtocol('otp', email, { otp: code });
        res.json({ status: "success", message: "Recovery code transmitted to your email." });
    } catch (err) {
        console.error("Recovery mail error:", err);
        res.status(500).json({ error: "Failed to transmit recovery code." });
    }
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

    const record = otpStore.get(email.toLowerCase());
    if (!record) {
        return res.status(400).json({ error: "No OTP found for this email. Please request a new code." });
    }
    if (Date.now() > record.expiry) {
        otpStore.delete(email.toLowerCase());
        return res.status(400).json({ error: "OTP expired. Please request a new code." });
    }
    if (record.otp !== otp.toString().trim()) {
        return res.status(400).json({ error: "Incorrect verification code. Please try again." });
    }

    // Mark as verified so reset can proceed
    otpStore.set(email.toLowerCase(), { ...record, verified: true });
    res.json({ status: "verified" });
});

// Reset Password (after OTP verified)
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ error: "Email and new password required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    const record = otpStore.get(email.toLowerCase());
    if (!record || !record.verified) {
        return res.status(403).json({ error: "OTP not verified. Please complete verification first." });
    }
    try {
        if (!db) return res.status(500).json({ error: "Database not ready" });
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await db.run('UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)', [hashedPassword, email]);
        otpStore.delete(email.toLowerCase()); // Clear OTP after use
        res.json({ status: "success", message: "Password reset successfully. Your identity is now secured." });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ error: "Failed to reset password." });
    }
});

// Helper to get random color
const COLORS = [
    'from-purple-500 to-indigo-500',
    'from-cyan-500 to-blue-500',
    'from-green-400 to-teal-500',
    'from-pink-500 to-rose-500',
    'from-orange-400 to-red-500',
    'from-yellow-400 to-orange-400',
    'from-violet-500 to-purple-600',
    'from-emerald-400 to-cyan-500',
];

app.post('/api/auth/signup', async (req, res) => {
    const { username, email, fullName, password, isAuthorized, phoneNumber } = req.body;
    console.log(`[SIGNUP] Incoming identity synchronization request for @${username} (Email: ${email})`);
    
    try {
        if (!db) {
            console.error("[SIGNUP] Database Reference Missing Error: DB not ready");
            return res.status(500).json({ status: "error", error: "Database not ready" });
        }

        const finalEmail = email.toLowerCase().trim();
        const finalUsername = username.trim();

        // 1. Check if username or email exists
        const existing = await db.get('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [finalUsername.toLowerCase(), finalEmail]);
        
        if (existing) {
            // If account exists, auto-login IF password matches
            const isMatch = await bcrypt.compare(password, existing.password).catch(() => password === existing.password);
            
            if (isMatch) {
                return res.json({ 
                    status: "success",
                    user: {
                        username: existing.username,
                        email: existing.email,
                        fullName: decryptField(existing.full_name),
                        role: existing.role,
                        color: existing.color,
                        phoneNumber: decryptField(existing.phone_number)
                    },
                    message: "Identity recognized. Automatic login authorized."
                });
            } else {
                return res.status(400).json({ status: "error", error: "Username or Email already registered. Please log in instead." });
            }
        }

        // 2. Hash Password and Insert into database
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const COLORS = ['#6c5ce7', '#a29bfe', '#00cec9', '#fab1a0', '#ff7675', '#fd79a8', '#fdcb6e'];
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const role = isAuthorized ? 'PendingAuthorized' : 'Standard';
        
        await db.run(
            'INSERT INTO users (full_name, email, username, password, role, color, phone_number, phone_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [encryptField(fullName), finalEmail, finalUsername, hashedPassword, role, color, encryptField(phoneNumber || 'Not Set'), hashPhone(phoneNumber)]
        );

        const newUser = {
            username: finalUsername,
            email: finalEmail,
            fullName: fullName,
            role: role,
            color: color,
            phoneNumber: phoneNumber || 'Not Set'
        };

        // Attempt to send welcome email to ALL new users (Non-blocking)
        nexoraMailProtocol('welcome', finalEmail, { username: finalUsername }).catch(() => {});

        res.status(201).json({ 
            status: "success", 
            user: newUser,
            message: "User identity initialized." 
        });
    } catch (err) {
        console.error("Signup error details:", err);
        res.status(500).json({ status: "error", error: "Server Error: Failed to process signup." });
    }
});

app.post('/api/admin/approve', async (req, res) => {
    const { username, email, customSubject, customHtml } = req.body;
    try {
        const welcomeHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
                    .wrapper { padding: 60px 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 48px; overflow: hidden; box-shadow: 0 40px 100px rgba(108,92,231,0.06); border: 1px solid #eef2f7; }
                    .content { padding: 60px 50px; text-align: center; }
                    .header-logo { width: 100px; height: 100px; object-fit: contain; margin-bottom: 40px; border-radius: 28px; }
                    .protocol-title { font-size: 11px; font-weight: 900; color: #6c5ce7; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 20px; display: block; }
                    .welcome-header { font-size: 34px; font-weight: 900; color: #1a1a2e; margin: 0 0 20px 0; letter-spacing: -1.5px; line-height: 1.1; }
                    .welcome-sub { font-size: 16px; color: #64748b; line-height: 1.8; margin-bottom: 45px; max-width: 480px; margin-left: auto; margin-right: auto; }
                    
                    .feature-grid { background: #f8fafc; border-radius: 32px; padding: 40px; margin-bottom: 45px; text-align: left; border: 1px solid #f1f5f9; }
                    .feature-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 25px; display: block; }
                    .feature-row { display: table; width: 100%; margin-bottom: 15px; }
                    .feature-bullet { display: table-cell; width: 24px; color: #6c5ce7; font-weight: 900; font-size: 18px; line-height: 1; vertical-align: middle; }
                    .feature-text { display: table-cell; font-size: 14px; color: #334155; font-weight: 700; vertical-align: middle; }
                    
                    .action-btn { display: inline-block; background: linear-gradient(135deg, #6c5ce7 0%, #00d4ff 100%); color: #ffffff !important; padding: 22px 55px; border-radius: 100px; text-decoration: none !important; font-weight: 800; font-size: 16px; box-shadow: 0 25px 50px rgba(108,92,231,0.25); letter-spacing: 0.5px; transition: all 0.3s ease; }
                    
                    .footer { background: #fafbfc; padding: 50px; border-top: 1px solid #f1f5f9; }
                    .footer-brand { font-size: 14px; font-weight: 900; color: #1a1a2e; margin-bottom: 15px; display: block; }
                    .privacy-policy { text-align: left; background: #ffffff; border: 1px solid #eef2f7; border-radius: 20px; padding: 25px; margin-bottom: 30px; }
                    .privacy-text { font-size: 11px; color: #94a3b8; line-height: 1.8; margin: 0; font-weight: 500; }
                    .privacy-link { color: #6c5ce7; text-decoration: none; font-weight: 700; }
                    .copyright { font-size: 10px; color: #cbd5e1; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="container">
                        <div class="content">
                            <img src="${APP_LOGO_URL}" alt="Nexora" class="header-logo" />
                            <span class="protocol-title">Authorization Verified</span>
                            <h1 class="welcome-header">Protocol Access Granted.</h1>
                            <p class="welcome-sub">Welcome back to the unified hub. Your administrative clearance has been verified for <strong>${username}</strong>. You may now establish a secure connection.</p>
                            
                            <div class="feature-grid">
                                <span class="feature-label">Credentials Initialized</span>
                                <div class="feature-row">
                                    <div class="feature-bullet">L</div>
                                    <div class="feature-text">Identity Verification Success</div>
                                </div>
                                <div class="feature-row">
                                    <div class="feature-bullet">L</div>
                                    <div class="feature-text">Encryption Keys Synchronized</div>
                                </div>
                                <div class="feature-row">
                                    <div class="feature-bullet">L</div>
                                    <div class="feature-text">Secure Tunnel Handshake Ready</div>
                                </div>
                            </div>
     
                            <a href="${process.env.CLIENT_URL || 'https://nexora31.vercel.app'}/auth" class="action-btn">START SURFING</a>
                        </div>

                        <div class="footer">
                            <span class="footer-brand">Nexora Systems</span>
                            <div class="privacy-policy">
                                <p class="privacy-text">
                                    <strong>IDENTITY VERIFIED:</strong> This is a secure transmission from Nexora Core. All sessions are protected by industry-leading end-to-end encryption. Our zero-knowledge policy ensures that your private data remains your own.
                                    <br><br>
                                    Reference ID: SEC-ACL-${Math.random().toString(36).substring(7).toUpperCase()}
                                </p>
                            </div>
                            <div class="copyright">
                                &copy; ${new Date().getFullYear()} NEXORA CORE &bull; PRIVACY PROTOCOL
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"${process.env.GMAIL_NAME || 'Nexora Private Chat'}" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: customSubject || 'Nexora Access Granted: Welcome to the Void',
            html: customHtml || welcomeHtml
        };
        await emailTransporter.sendMail(mailOptions);
        res.json({ status: "success", message: "User approved and welcome protocol deployed." });
    } catch (err) {
        console.error("Approval error:", err);
        res.status(500).json({ error: "Failed to process approval." });
    }
});

// NEW: SMTP Test Endpoint
app.post('/api/admin/test-mail', async (req, res) => {
    try {
        const testHtml = `
            <div style="font-family: 'Inter', -apple-system, sans-serif; padding: 50px; background: #ffffff; border: 1px solid #eef2f7; border-radius: 32px; max-width: 550px; margin: auto; text-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.05);">
                <img src="${APP_LOGO_URL}" alt="Nexora Logo" style="width: 90px; height: 90px; object-fit: contain; margin-bottom: 30px; border-radius: 24px; box-shadow: 0 20px 40px rgba(108,92,231,0.2);" />
                <div style="color: #6c5ce7; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 25px;">NEXORA CORE</div>
                <h2 style="color: #2ed573; margin-bottom: 12px; font-size: 20px;">SMTP Protocol Operational</h2>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6;">This is a test transmission confirming your Nexora communication relay is fully functional.</p>
                <div style="border-top: 1px solid #f1f5f9; margin-top: 30px; padding-top: 20px; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">
                    Relay Node Active: ${process.env.GMAIL_USER}
                </div>
            </div>
        `;
        const mailOptions = {
            from: `"${process.env.GMAIL_NAME}" <${process.env.GMAIL_USER}>`,
            to: process.env.GMAIL_USER, // Send to self as test
            subject: 'Nexora Core: SMTP Protocol Test',
            html: testHtml
        };
        await emailTransporter.sendMail(mailOptions);
        res.json({ status: "success", message: "Test protocol transmitted successfully." });
    } catch (err) {
        console.error("SMTP Test Error:", err);
        res.status(500).json({ error: "SMTP Protocol Failure. Check node console for logs." });
    }
});

// ------------------------------------------------------------------
// PROFILE EMAIL UPDATE ROUTES
// ------------------------------------------------------------------

// Request Email Change
app.post('/api/profile/request-email-change', async (req, res) => {
    const { username, newEmail } = req.body;
    if (!username || !newEmail) return res.status(400).json({ error: "Username and new email required." });

    try {
        if (!db) return res.status(500).json({ error: "Database not ready." });
        
        // Check if new email is already taken
        const existing = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', [newEmail.toLowerCase()]);
        if (existing) return res.status(400).json({ error: "This email is already linked to another account." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 10 * 60 * 1000;
        
        // Use a specialized context key so password reset and email change don't clash,
        // or just use newEmail as the key and store the context.
        otpStore.set(newEmail.toLowerCase() + "_change", { otp, expiry, verified: false, username });

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
                    .wrapper { padding: 60px 20px; }
                    .container { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 48px; overflow: hidden; box-shadow: 0 40px 100px rgba(108,92,231,0.06); border: 1px solid #eef2f7; text-align: center; }
                    .content { padding: 60px 45px; }
                    .header-logo { width: 90px; height: 90px; object-fit: contain; margin-bottom: 35px; border-radius: 24px; }
                    .protocol-badge { display: inline-block; background: rgba(108,92,231,0.06); color: #6c5ce7; padding: 10px 20px; border-radius: 100px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px; }
                    .recover-title { font-size: 28px; font-weight: 900; color: #1a1a2e; margin: 0 0 15px 0; letter-spacing: -1px; }
                    .recover-desc { font-size: 15px; color: #64748b; line-height: 1.8; margin-bottom: 40px; }
                    
                    .otp-vault { background: #f8fafc; border: 1px dashed #6c5ce7; border-radius: 32px; padding: 45px; margin-bottom: 35px; position: relative; }
                    .otp-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; display: block; }
                    .otp-code { font-size: 48px; font-weight: 900; letter-spacing: 14px; color: #6c5ce7; margin: 0; }
                    .otp-expiry { font-size: 13px; color: #94a3b8; margin-top: 25px; font-weight: 600; }
                    
                    .footer { background: #fafbfc; padding: 45px; border-top: 1px solid #f1f5f9; }
                    .privacy-note { font-size: 11px; color: #94a3b8; line-height: 1.8; margin-bottom: 25px; text-align: left; }
                    .copyright { font-size: 10px; color: #cbd5e1; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="container">
                        <div class="content">
                            <img src="${APP_LOGO_URL}" alt="Nexora" class="header-logo" />
                            <div class="protocol-badge">Email Synchronization</div>
                            <h2 class="recover-title">Verify New Identity</h2>
                            <p class="recover-desc">A request was made to link this email address to your Nexora profile. Use the verification segment below to finalize the synchronization.</p>
                            
                            <div class="otp-vault">
                                <span class="otp-label">Verification Segment</span>
                                <div class="otp-code">${otp}</div>
                                <p class="otp-expiry">Segment expires in 10 minutes.</p>
                            </div>
                        </div>

                        <div class="footer">
                            <div class="privacy-note">
                                This is an automated identity verification transmission from Nexora Core. All identity updates are strictly synchronized across your encrypted device graph.
                            </div>
                            <div class="copyright">
                                &copy; ${new Date().getFullYear()} NEXORA SYSTEMS &bull; PRIVACY PROTOCOL
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
        const mailOptions = {
            from: `"${process.env.GMAIL_NAME || 'Nexora Core'}" <${process.env.GMAIL_USER}>`,
            to: newEmail,
            subject: 'Nexora: Verify Email Update',
            html: html
        };
        await emailTransporter.sendMail(mailOptions);
        res.json({ status: "success", message: "OTP sent to new email." });
    } catch (err) {
        console.error("Email update request error:", err);
        res.status(500).json({ error: "Failed to send OTP." });
    }
});

// Verify Email Change
app.post('/api/profile/verify-email-change', async (req, res) => {
    const { username, newEmail, otp } = req.body;
    if (!username || !newEmail || !otp) return res.status(400).json({ error: "Missing required fields." });

    const key = newEmail.toLowerCase() + "_change";
    const record = otpStore.get(key);
    
    if (!record || record.username !== username) {
        return res.status(400).json({ error: "Invalid request. Please request a new OTP." });
    }
    if (Date.now() > record.expiry) {
        otpStore.delete(key);
        return res.status(400).json({ error: "OTP expired." });
    }
    if (record.otp !== otp.toString().trim()) {
        return res.status(400).json({ error: "Incorrect OTP." });
    }

    try {
        if (!db) return res.status(500).json({ error: "Database not ready." });
        await db.run('UPDATE users SET email = ? WHERE username = ?', [newEmail.toLowerCase(), username]);
        otpStore.delete(key);
        res.json({ status: "success", message: "Email updated successfully. Identity graph resynced." });
    } catch (err) {
        console.error("Email update error:", err);
        res.status(500).json({ error: "Failed to update email." });
    }
});


// ------------------------------------------------------------------
// DYNAMIC CMS CONFIGURATION (SEO & Brand)
// ------------------------------------------------------------------

app.post('/api/admin/config', async (req, res) => {
    try {
        const { seo, logoBase64 } = req.body;
        if (seo) {
            const seoPath = path.join(__dirname, '../client/src/config/seo.json');
            fs.writeFileSync(seoPath, JSON.stringify(seo, null, 2), 'utf-8');
        }
        if (logoBase64) {
            const b64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(b64Data, 'base64');
            const pubPath = path.join(__dirname, '../client/public/logo.svg');
            const iconPath = path.join(__dirname, '../client/src/app/icon.svg');
            fs.writeFileSync(pubPath, buffer);
            fs.writeFileSync(iconPath, buffer);
        }
        res.json({ status: "success", message: "Configuration protocols deployed." });
    } catch (err) {
        res.status(500).json({ error: "Failed to deploy dynamic settings." });
    }
});

// ------------------------------------------------------------------
// ENCRYPTED MEDIA UPLOAD (Phase 4)
// Server receives pre-encrypted blobs — CANNOT see content
// ------------------------------------------------------------------
app.post('/api/media/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file provided" });
        }

        // Check if Cloudinary is configured
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            // Fallback: return a data URL for development
            const base64 = req.file.buffer.toString('base64');
            return res.json({
                url: `data:application/octet-stream;base64,${base64}`,
                publicId: `local_${Date.now()}`,
                message: "Stored locally (Cloudinary not configured)"
            });
        }

        // Upload encrypted blob to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "raw", // raw binary, not image
                    folder: "nexora_encrypted",
                    public_id: `enc_${Date.now()}`,
                    type: "upload",
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            const readable = Readable.from(req.file.buffer);
            readable.pipe(uploadStream);
        });

        res.json({
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            message: "Encrypted media stored securely."
        });
    } catch (err) {
        console.error("Media upload error:", err);
        res.status(500).json({ error: "Failed to upload encrypted media." });
    }
});

// Delete media from Cloudinary
app.delete('/api/media/:publicId', async (req, res) => {
    try {
        const publicId = decodeURIComponent(req.params.publicId);
        await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
        res.json({ status: "success", message: "Media securely purged." });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete media." });
    }
});

// ------------------------------------------------------------------
// WEB PUSH SUBSCRIPTION ENDPOINTS
// ------------------------------------------------------------------

// Get VAPID public key for client to subscribe
app.get('/api/push/vapid-public-key', (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
        return res.status(503).json({ error: 'Push notifications not configured' });
    }
    res.json({ key: VAPID_PUBLIC_KEY });
});

// Subscribe user to push notifications
app.post('/api/push/subscribe', (req, res) => {
    const { username, subscription } = req.body;
    if (!username || !subscription) {
        return res.status(400).json({ error: 'username and subscription required' });
    }
    pushSubscriptions.set(username.toLowerCase(), subscription);
    console.log(`[PUSH] Subscription registered for: ${username}`);
    res.json({ status: 'success', message: 'Push subscription registered.' });
});

// Unsubscribe user from push notifications
app.delete('/api/push/subscribe/:username', (req, res) => {
    const username = req.params.username.toLowerCase();
    pushSubscriptions.delete(username);
    res.json({ status: 'success' });
});

// ------------------------------------------------------------------
// Register user on login/signup (Session Active Ping)
app.post('/api/users/register', (req, res) => {
    res.json({ status: 'success' });
});

// Global user search
app.get('/api/users/search', async (req, res) => {
    const q = (req.query.q || '').toLowerCase().trim();
    const me = (req.query.me || '').toLowerCase();

    if (!q || q.length < 2) return res.json({ users: [] });

    try {
        if (!db) return res.json({ users: [] });
        console.log(`[SEARCH] Query: "${q}" by User: "${me}"`);
        const users = await db.all(`
            SELECT username, full_name AS fullName, color, avatar_url AS avatarUrl
            FROM users 
            WHERE (LOWER(username) LIKE ? OR LOWER(full_name) LIKE ?) 
              AND LOWER(username) != LOWER(?)
            LIMIT 20
        `, [`%${q}%`, `%${q}%`, me]);

        const mappedUsers = users.map(u => ({ 
            ...u, 
            fullName: decryptField(u.fullName),
            online: true 
        }));
        res.json({ users: mappedUsers });
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ users: [] });
    }
});

// NEW: Contact Sync & Friend Suggestions
app.post('/api/users/sync-contacts', async (req, res) => {
    const { contacts, me } = req.body; // contacts: array of phone numbers
    if (!contacts || !Array.isArray(contacts)) return res.json({ suggestions: [] });
    
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        
        // 1. Hash incoming contact numbers for deterministic matching
        const contactHashes = contacts.map(p => hashPhone(p)).filter(h => h !== null);
        if (contactHashes.length === 0) return res.json({ suggestions: [] });

        // 2. Find matches (excluding self)
        const placeholders = contactHashes.map(() => '?').join(',');
        const users = await db.all(`
            SELECT username, full_name AS "fullName", color, avatar_url AS avatarUrl 
            FROM users 
            WHERE phone_hash IN (${placeholders})
              AND LOWER(username) != LOWER(?)
            LIMIT 15
        `, [...contactHashes, me || '']);

        const result = users.map(u => ({
            ...u,
            fullName: decryptField(u.fullName),
            reason: 'In your contacts'
        }));

        res.json({ suggestions: result });
    } catch (err) {
        console.error("Sync Error:", err);
        res.status(500).json({ suggestions: [] });
    }
});

// NEW: Endpoint to get specific user profile and check username
app.get('/api/users/profile', async (req, res) => {
    const username = (req.query.username || '').toLowerCase();
    try {
        if (!db || !username) return res.status(400).json({ error: "Invalid username" });
        const user = await db.get('SELECT username, full_name AS "fullName", email, role, created_at, color, phone_number AS "phoneNumber", avatar_url AS "avatarUrl" FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (!user) return res.status(404).json({ error: "User not found" });
        
        // Decrypt sensitive info for the client
        user.fullName = decryptField(user.fullName);
        user.phoneNumber = decryptField(user.phoneNumber);
        
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Upload / Update profile picture
app.post('/api/users/avatar', async (req, res) => {
    const { username, avatarBase64 } = req.body;
    if (!username || !avatarBase64) return res.status(400).json({ error: "username and avatarBase64 required" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        await db.run('UPDATE users SET avatar_url = ? WHERE LOWER(username) = LOWER(?)', [avatarBase64, username]);
        res.json({ status: "success", message: "Profile picture updated." });
    } catch (err) {
        console.error("Avatar update error:", err);
        res.status(500).json({ error: "Failed to update avatar." });
    }
});

// Search & Profile endpoints verified above. Konsolidate redundant check-username below.
// Consolidated into the early auth flow definition.

// Use database for connection requests stores
// Send a connection request
app.post('/api/connections/request', async (req, res) => {
    const { from, fromName, fromColor, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });

        // 1. Check if they are already connected
        const existingCon = await db.get(`
            SELECT id FROM connections 
            WHERE (LOWER(user_a) = LOWER(?) AND LOWER(user_b) = LOWER(?))
               OR (LOWER(user_a) = LOWER(?) AND LOWER(user_b) = LOWER(?))
        `, [from, to, to, from]);
        if (existingCon) return res.json({ status: 'already_connected' });

        // 2. Check if a request already exists IN EITHER DIRECTION
        const existingReqFromMe = await db.get('SELECT id FROM connection_requests WHERE LOWER(from_username) = LOWER(?) AND LOWER(to_username) = LOWER(?) AND status = \'pending\'', [from, to]);
        if (existingReqFromMe) return res.json({ status: 'already_sent' });

        const existingReqToMe = await db.get('SELECT id FROM connection_requests WHERE LOWER(from_username) = LOWER(?) AND LOWER(to_username) = LOWER(?) AND status = \'pending\'', [to, from]);

        if (existingReqToMe) {
            // BACK-ACTION: Cross-request exists, auto-accept it!
            await db.run('UPDATE connection_requests SET status = \'accepted\' WHERE id = ?', [existingReqToMe.id]);

            const [u1, u2] = [from.toLowerCase(), to.toLowerCase()].sort();
            try {
                await db.run('INSERT INTO connections (user_a, user_b) VALUES (?, ?)', [u1, u2]);
            } catch (err) { /* already exists */ }

            // Save notifications for both users
            await db.run(
                'INSERT INTO notifications (owner_username, from_username, type, message) VALUES (?, ?, ?, ?)',
                [to.toLowerCase(), from.toLowerCase(), 'request_accepted', `${fromName || from} accepted your follow request.`]
            );
            await db.run(
                'INSERT INTO notifications (owner_username, from_username, type, message) VALUES (?, ?, ?, ?)',
                [from.toLowerCase(), to.toLowerCase(), 'request_back_prompt', `${to} started following you back.`]
            );

            // Notify both via socket
            const senderId = from.toLowerCase();
            const receiverId = to.toLowerCase();

            // Notify Receiver (the person who was REQUESTED)
            io.to(receiverId).emit('connection_accepted', { by: senderId, byName: fromName || senderId });
            io.to(receiverId).emit('new_notification', { type: 'request_accepted', message: `${fromName || senderId} accepted your follow request.`, from_username: senderId });

            // Notify Sender (the person who REQUESTED BACK)
            io.to(senderId).emit('connection_accepted', { by: receiverId, byName: receiverId });
            io.to(senderId).emit('new_notification', { type: 'request_back_prompt', message: `${receiverId} started following you back.`, from_username: receiverId });

            return res.json({ status: 'accepted', message: 'Bidirectional request: Connected!' });
        }

        // 3. Insert into DB (Standard pending request)
        await db.run(
            'INSERT INTO connection_requests (from_username, to_username, from_name, from_color) VALUES (?, ?, ?, ?)',
            [from.toLowerCase(), to.toLowerCase(), fromName || from, fromColor || COLORS[0]]
        );

        // Notify via socket if target is online
        // Also we don't send avatar here, but it can be fetched by the client via profile if needed,
        // or we could look it up. For now, keep it simple.
        io.to(to.toLowerCase()).emit('connection_request', { from, fromName, fromColor });
        res.json({ status: 'sent' });
    } catch (err) {
        console.error("Connection Request Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get pending connection requests for a user
app.get('/api/connections/requests', async (req, res) => {
    const username = (req.query.username || '').toLowerCase();
    if (!username) return res.json({ requests: [] });
    try {
        if (!db) return res.json({ requests: [] });
        const reqs = await db.all(`
            SELECT cr.id, cr.from_username AS "from", cr.from_name AS "fromName", cr.from_color AS "fromColor", cr.created_at AS "time", u.avatar_url AS "avatarUrl"
            FROM connection_requests cr
            LEFT JOIN users u ON LOWER(u.username) = LOWER(cr.from_username)
            WHERE LOWER(cr.to_username) = LOWER(?) AND cr.status = 'pending'
        `, [username]);
        
        // Decrypt sender names if they were encrypted (older requests might be raw)
        const decryptedReqs = reqs.map(r => ({ ...r, fromName: decryptField(r.fromName) }));
        
        // Format time
        const formatted = decryptedReqs.map(r => ({
            ...r,
            time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        res.json({ requests: formatted });
    } catch (err) {
        res.status(500).json({ requests: [] });
    }
});

// Get established connections for a user
app.get('/api/connections', async (req, res) => {
    const username = (req.query.username || '').toLowerCase();
    if (!username) return res.json({ connections: [] });
    try {
        if (!db) return res.json({ connections: [] });
        const rows = await db.all(`
            SELECT u.id, u.username, u.full_name as name, u.color, u.avatar_url as avatarUrl
            FROM connections c
            JOIN users u ON
                (c.user_a = LOWER(u.username) AND c.user_b = ?) OR
                (c.user_b = LOWER(u.username) AND c.user_a = ?)
        `, [username, username]);
        // Attach real-time online status from the live room adapter
        const enriched = rows.map(r => {
            const room = io.sockets.adapter.rooms.get(r.username);
            return {
                ...r,
                name: decryptField(r.name),
                online: room && room.size > 0,
                preview: 'Secure tunnel established',
                unread: 0,
            };
        });
        res.json({ connections: enriched });
    } catch (err) {
        res.status(500).json({ connections: [] });
    }
});

// Get sent connection requests for a user (for notification panel)
app.get('/api/connections/sent', async (req, res) => {
    const username = (req.query.username || '').toLowerCase();
    if (!username) return res.json({ requests: [] });
    try {
        if (!db) return res.json({ requests: [] });
        const reqs = await db.all(
            'SELECT id, to_username AS "to", created_at AS time FROM connection_requests WHERE LOWER(from_username) = LOWER(?) AND status = \'pending\'',
            [username]
        );
        const formatted = reqs.map(r => ({
            ...r,
            toName: r.to,
            toColor: 'from-gray-400 to-gray-600',
            time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        res.json({ requests: formatted });
    } catch (err) {
        res.status(500).json({ requests: [] });
    }
});

// Accept or decline a request
app.post('/api/connections/respond', async (req, res) => {
    const { username, requestId, action } = req.body; // action: 'accept' | 'decline'
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });

        const req_ = await db.get('SELECT * FROM connection_requests WHERE id = ?', [requestId]);
        if (!req_) return res.status(404).json({ error: 'request not found' });

        if (action === 'accept') {
            await db.run('UPDATE connection_requests SET status = \'accepted\' WHERE id = ?', [requestId]);

            // Add to established connections if not already
            const u1 = req_.from_username.toLowerCase();
            const u2 = req_.to_username.toLowerCase();
            const [first, second] = [u1, u2].sort();

            try {
                await db.run('INSERT INTO connections (user_a, user_b) VALUES (?, ?)', [first, second]);
            } catch (err) { /* already connected */ }

            // Insert notification for Sender (User X)
            await db.run(
                'INSERT INTO notifications (owner_username, from_username, type, message) VALUES (?, ?, ?, ?)',
                [req_.from_username.toLowerCase(), username.toLowerCase(), 'request_accepted', `${username} accepted your follow request.`]
            );

            // Insert notification for Receiver (User Y)
            await db.run(
                'INSERT INTO notifications (owner_username, from_username, type, message) VALUES (?, ?, ?, ?)',
                [username.toLowerCase(), req_.from_username.toLowerCase(), 'request_back_prompt', `${req_.from_name} started following you.`]
            );

            // Notify the sender via socket
            const senderId = req_.from_username.toLowerCase();
            io.to(senderId).emit('connection_accepted', { by: username.toLowerCase(), byName: username });
            io.to(senderId).emit('new_notification', { type: 'request_accepted', message: `${username} accepted your follow request.`, from_username: username.toLowerCase() });

            // Notify the receiver via socket
            io.to(username.toLowerCase()).emit('new_notification', { type: 'request_back_prompt', message: `${req_.from_name} started following you.`, from_username: req_.from_username.toLowerCase() });
        } else {
            await db.run('UPDATE connection_requests SET status = \'declined\' WHERE id = ?', [requestId]);
        }

        res.json({ status: action === 'accept' ? 'accepted' : 'declined' });
    } catch (err) {
        console.error("Respond Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Notifications API
app.get('/api/notifications', async (req, res) => {
    const username = (req.query.username || '').toLowerCase();
    if (!username) return res.json({ notifications: [] });
    try {
        if (!db) return res.json({ notifications: [] });
        const notifs = await db.all('SELECT * FROM notifications WHERE LOWER(owner_username) = LOWER(?) ORDER BY created_at DESC LIMIT 50', [username]);
        // Format time and inject color info (optional joined info)
        for (let n of notifs) {
            n.time = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        res.json({ notifications: notifs });
    } catch (err) {
        res.status(500).json({ notifications: [] });
    }
});

app.post('/api/notifications/read', async (req, res) => {
    const { id } = req.body;
    try {
        if (!db) return res.status(500).json({ success: false });
        // Use standard TRUE for Postgres, 1 for SQLite handled by db.run helper
        const sql = dbType === 'postgres' ? 'UPDATE notifications SET is_read = TRUE WHERE id = ?' : 'UPDATE notifications SET is_read = 1 WHERE id = ?';
        await db.run(sql, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/notifications/clear', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username required" });
    try {
        if (!db) return res.status(500).json({ success: false });
        await db.run('DELETE FROM notifications WHERE LOWER(owner_username) = LOWER(?)', [username]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// ------------------------------------------------------------------
// STORIES API (Phase 6)
// ------------------------------------------------------------------

// Get stories from friends (those connected to the user)
app.get('/api/stories', async (req, res) => {
    const username = (req.query.username || '').toLowerCase();
    if (!username) return res.json({ stories: [] });
    try {
        if (!db) return res.status(500).json({ stories: [] });

        // Find all friends
        const connections = await db.all('SELECT user_a, user_b FROM connections WHERE user_a = ? OR user_b = ?', [username, username]);
        const friends = connections.map(c => c.user_a === username ? c.user_b : c.user_a);

        // Always include self in stories view
        friends.push(username);

        if (friends.length === 0) return res.json({ stories: [] });

        // Fetch stories from friends (last 24 hours)
        const placeholders = friends.map(() => '?').join(',');

        const stories = await db.all(`
            SELECT s.*, u.full_name as name, u.color, u.avatar_url as avatarUrl,
            (SELECT COUNT(*) FROM story_views WHERE story_id = s.id) as views_count,
            (SELECT EXISTS(SELECT 1 FROM story_views WHERE story_id = s.id AND viewer_username = ?)) as is_viewed,
            (SELECT COUNT(*) FROM story_likes WHERE story_id = s.id) as likes_count,
            (SELECT EXISTS(SELECT 1 FROM story_likes WHERE story_id = s.id AND liker_username = ?)) as is_liked
            FROM stories s
            JOIN users u ON s.username = LOWER(u.username)
            WHERE s.username IN (${placeholders}) AND s.created_at >= datetime('now', '-1 day')
            ORDER BY s.created_at DESC
        `, [username, username, ...friends]);

        // Decrypt full_name for each story before sending to client
        const decrypted = stories.map(s => ({ ...s, name: decryptField(s.name) }));

        res.json({ stories: decrypted });
    } catch (err) {
        console.error("Fetch Stories Error:", err);
        res.status(500).json({ stories: [] });
    }
});

// Post a new story
app.post('/api/stories', async (req, res) => {
    const { username, mediaUrl, mediaType, caption } = req.body;
    if (!username || !mediaUrl) return res.status(400).json({ error: "Missing required fields" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        await db.run('INSERT INTO stories (username, media_url, media_type, caption) VALUES (?, ?, ?, ?)', [username.toLowerCase(), mediaUrl, mediaType || 'image', caption || '']);
        res.json({ status: "success" });
    } catch (err) {
        console.error("Post Story Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Mark story as viewed
app.post('/api/stories/view', async (req, res) => {
    const { storyId, username } = req.body;
    if (!storyId || !username) return res.status(400).json({ error: "Missing required fields" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        if (dbType === 'postgres') {
            await db.run('INSERT INTO story_views (story_id, viewer_username) VALUES (?, ?) ON CONFLICT (story_id, viewer_username) DO NOTHING', [storyId, username.toLowerCase()]);
        } else {
            await db.run('INSERT OR IGNORE INTO story_views (story_id, viewer_username) VALUES (?, ?)', [storyId, username.toLowerCase()]);
        }
        res.json({ status: "success" });
    } catch (err) {
        console.error("Story View Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Like story
app.post('/api/stories/like', async (req, res) => {
    const { storyId, username } = req.body;
    if (!storyId || !username) return res.status(400).json({ error: "Missing required fields" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const sender = username.toLowerCase();
        const story = await db.get('SELECT * FROM stories WHERE id = ?', [storyId]);
        if (!story) return res.status(404).json({ error: "Story not found" });
        const receiver = story.username.toLowerCase();

        const exists = await db.get('SELECT 1 FROM story_likes WHERE story_id = ? AND liker_username = ?', [storyId, sender]);
        if (exists) {
            await db.run('DELETE FROM story_likes WHERE story_id = ? AND liker_username = ?', [storyId, sender]);
        } else {
            await db.run('INSERT INTO story_likes (story_id, liker_username) VALUES (?, ?)', [storyId, sender]);
            
            // IG LIKE FEATURE: Send heart to chat and notification
            const likePayload = {
                to: receiver,
                from: sender,
                text: `❤️ Liked your story`,
                msgId: `like_${Date.now()}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isSystem: false,
                fromStory: true
            };

            // Notify Receiver's room
            io.to(receiver).emit('new_notification', { type: 'story_like', message: `Liked your story.`, from_username: sender });
            io.to(receiver).emit('dm:message', likePayload);
            
            // Sync to Sender's other devices
            io.to(sender).emit('dm:message', { ...likePayload, text: `You liked ${receiver}'s story` });

            // Push Notification
            const sub = pushSubscriptions.get(receiver);
            if (sub && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
                webpush.sendNotification(sub, JSON.stringify({
                    title: `${username} liked your story`,
                    body: "❤️",
                    icon: '/icon.svg'
                })).catch(() => {});
            }
        }
        res.json({ status: "success" });
    } catch (err) {
        console.error("Story Like Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Reply to story (Sends a notification to the owner)
app.post('/api/stories/reply', async (req, res) => {
    const { storyId, username, targetUsername, message } = req.body;
    if (!storyId || !username || !targetUsername || !message) return res.status(400).json({ error: "Missing required fields" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        
        const sender = username.toLowerCase();
        const receiver = targetUsername.toLowerCase();

        // 1. Save as notification
        await db.run(
            'INSERT INTO notifications (owner_username, from_username, type, message) VALUES (?, ?, ?, ?)',
            [receiver, sender, 'story_reply', `Replied to your story: "${message}"`]
        );
        
        // 2. Determine if we should also send it as a socket DM message
        // Since Nexora is E2E, we emit a 'dm:message' but note it's from a story
        const storyRelayPayload = {
            to: receiver,
            from: sender,
            text: `💬 Replied to story: ${message}`,
            msgId: `reply_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: false,
            fromStory: true,
            ciphertext: null, // Mark as literal text for story replies
            iv: null
        };

        // 3. Notify via socket (Identity-based relay ensures all user devices receive)
        io.to(receiver).emit('new_notification', { type: 'story_reply', message: `Replied to your story: "${message}"`, from_username: sender });
        io.to(receiver).emit('dm:message', storyRelayPayload);
        
        // Also sync back to sender's other devices
        io.to(sender).emit('dm:message', storyRelayPayload);

        // Push notification
        const sub = pushSubscriptions.get(receiver);
        if (sub && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
            webpush.sendNotification(sub, JSON.stringify({
                title: `New story reply from ${username}`,
                body: message,
                icon: '/icon.svg'
            })).catch(() => {});
        }

        res.json({ status: "success" });
    } catch (err) {
        console.error("Story Reply Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Fetch detailed view and like stats (for story owner)
app.get('/api/stories/stats', async (req, res) => {
    const { storyId } = req.query;
    if (!storyId) return res.status(400).json({ error: "Missing storyId" });
    try {
        if (!db) return res.status(500).json({ views: [], likes: [] });
        
        const views = await db.all(`
            SELECT u.username, u.full_name as name, u.color 
            FROM story_views sv JOIN users u ON sv.viewer_username = LOWER(u.username) 
            WHERE sv.story_id = ? ORDER BY sv.created_at DESC
        `, [storyId]);
        
        const likes = await db.all(`
            SELECT u.username, u.full_name as name, u.color 
            FROM story_likes sl JOIN users u ON sl.liker_username = LOWER(u.username) 
            WHERE sl.story_id = ? ORDER BY sl.created_at DESC
        `, [storyId]);

        // Decrypt names before returning
        const decryptedViews = views.map(v => ({ ...v, name: decryptField(v.name) }));
        const decryptedLikes = likes.map(l => ({ ...l, name: decryptField(l.name) }));

        res.json({ views: decryptedViews, likes: decryptedLikes });
    } catch (err) {
        console.error("Story Stats Error:", err);
        res.status(500).json({ views: [], likes: [] });
    }
});

// Delete a story
app.delete('/api/stories/:id', async (req, res) => {
    const { id } = req.params;
    const { username } = req.query;
    if (!id || !username) return res.status(400).json({ error: "Missing ID or username" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const story = await db.get('SELECT username FROM stories WHERE id = ?', [id]);
        if (!story) return res.status(404).json({ error: "Story not found" });
        if (story.username !== username.toLowerCase()) return res.status(403).json({ error: "Unauthorized" });

        await db.run('DELETE FROM stories WHERE id = ?', [id]);
        await db.run('DELETE FROM story_views WHERE story_id = ?', [id]);
        await db.run('DELETE FROM story_likes WHERE story_id = ?', [id]);
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

Sentry.setupExpressErrorHandler(app);

// ------------------------------------------------------------------
// START SERVER
// ------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`[SERVER] Nexora Core operational on port ${PORT}`);
    console.log(`[SECURITY] Helmet active | HSTS enabled | Zero-knowledge relay mode`);
});
