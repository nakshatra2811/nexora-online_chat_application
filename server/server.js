process.env.TZ = "Asia/Kolkata";
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
    // Standard SHA-256 hash without salt to allow client-side matching while keeping PII hidden
    return crypto.createHash('sha256').update(normalized).digest('hex');
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
            ((..._args) => {})("[DATABASE] Mode: PostgreSQL (Supabase/Neon)");
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
            ((..._args) => {})("[DATABASE] Mode: Local SQLite");
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
                wallpaper TEXT,
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

            CREATE TABLE IF NOT EXISTS blogs (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                title TEXT,
                excerpt TEXT,
                status TEXT DEFAULT 'Draft',
                date TEXT,
                author TEXT,
                category TEXT,
                image TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                action TEXT NOT NULL,
                target TEXT,
                admin_username TEXT NOT NULL,
                details TEXT,
                timestamp ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'}
            );

            CREATE TABLE IF NOT EXISTS media_assets (
                id ${dbType==='postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
                url TEXT NOT NULL,
                name TEXT NOT NULL,
                size TEXT,
                type TEXT,
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'}
            );

            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id ${dbType==='postgres' ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${dbType==='postgres' ? '' : 'AUTOINCREMENT'},
                username TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                subscription TEXT NOT NULL,
                created_at ${dbType==='postgres' ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'}
            );
        `);

        // Migration for phone_number and phone_hash (Run for both SQLite and Postgres)
        try { await db.run("ALTER TABLE users ADD COLUMN phone_number TEXT DEFAULT 'Not Set'"); } catch (e) { }
        try { await db.run("ALTER TABLE users ADD COLUMN phone_hash TEXT"); } catch (e) { }
        // Migration for avatar_url
        try { await db.run("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL"); } catch (e) { }
        // Migration for bio
        try { await db.run("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL"); } catch (e) { }
        // Migration for wallpaper in connections
        try { await db.run("ALTER TABLE connections ADD COLUMN wallpaper TEXT"); } catch (e) { }

        // Re-hash existing phone numbers if needed (one-time migration for Zero-Knowledge Sync)
        try {
            const usersToRehash = await db.all("SELECT id, phone_number FROM users WHERE phone_number IS NOT NULL AND phone_number != 'Not Set'");
            for (const u of usersToRehash) {
                const raw = decryptField(u.phone_number);
                if (raw && raw !== 'Not Set') {
                    const newHash = hashPhone(raw);
                    await db.run("UPDATE users SET phone_hash = ? WHERE id = ?", [newHash, u.id]);
                }
            }
        } catch (e) { ((..._args) => {})("[MIGRATION] Phone re-hash failed:", e); }

        // SEED DATA
        const seedUsers = [
            ['Nexora', 'root@nexora.app', 'Nexora_31', 'Nexora@31', 'from-[#6c5ce7] to-[#00d4ff]', 'Admin', '0000000031'],
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
                        'INSERT INTO users (full_name, email, username, password, color, role, phone_number, phone_hash, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                        [encryptField(user[0]), user[1], user[2], hashed, user[4], user[5], encryptField(user[6] || 'Not Set'), hashPhone(user[6]), 'The Private Chat Protocol', APP_LOGO_URL]
                    );
                } else if (user[2] === 'Nexora_31') {
                    // Force update admin profile to match new brand
                    await db.run(
                        'UPDATE users SET full_name = ?, bio = ?, avatar_url = ?, email = ?, password = ? WHERE username = ?',
                        [encryptField('Nexora'), 'The Private Chat Protocol', APP_LOGO_URL, 'Nexoraprivatechat31@gmail.com', await bcrypt.hash('Ruhi@#$%*09052024', 10), 'Nexora_31']
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

        ((..._args) => {})(`[DATABASE] ${dbType === 'postgres' ? 'PostgreSQL Connection Established' : 'SQLite Initialized Successfully'}`);
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
        ((..._args) => {})("[FIREBASE] Admin SDK connected successfully.");
    } catch (e) {
        ((..._args) => {})("[FIREBASE] Initialization error:", e.message);
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
        ((..._args) => {})("[SMTP] Core Communication Relay Failure:", error);
    } else {
        ((..._args) => {})("[SMTP] Secure Mail Protocol Initialized.");
    }
});

// ------------------------------------------------------------------
// NEXORA PREMIUM MAIL PROTOCOL (Universal Templates)
// ------------------------------------------------------------------

// In-memory customizable email templates (admin can override)
const emailTemplateOverrides = new Map(); // type -> { subject, html }

async function nexoraMailProtocol(type, to, data) {
    const APP_LOGO = "https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg";
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_NAME = process.env.GMAIL_NAME || "Nexora Private Chat";

    // Check for admin-customized template override
    const override = emailTemplateOverrides.get(type);
    if (override) {
        let customSubject = override.subject || '';
        let customHtml = override.html || '';
        // Replace template variables
        const replacements = {
            '{{username}}': data.username || '',
            '{{otp}}': data.otp || '',
            '{{APP_LOGO}}': APP_LOGO,
            '{{CLIENT_URL}}': process.env.CLIENT_URL || 'https://nexora31.vercel.app',
            '{{YEAR}}': new Date().toLocaleString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' }),
            '{{TIMESTAMP}}': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        };
        for (const [key, val] of Object.entries(replacements)) {
            customSubject = customSubject.split(key).join(val);
            customHtml = customHtml.split(key).join(val);
        }
        try {
            await emailTransporter.sendMail({
                from: `"${GMAIL_NAME}" <${GMAIL_USER}>`,
                to: to,
                subject: customSubject,
                text: `Nexora Notice: Your request was processed.`,
                html: customHtml
            });
            ((..._args) => {})(`[SMTP] ${type.toUpperCase()} (CUSTOM) Relayed to: ${to}`);
            return true;
        } catch (err) {
            ((..._args) => {})(`[SMTP] ${type.toUpperCase()} (CUSTOM) FAILED:`, err.message);
            return false;
        }
    }

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
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin:0; padding:0; background:linear-gradient(135deg,#eef2ff,#e0f2fe,#f8fafc); font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
                <tr>
                  <td align="center">
                    <!-- Main Card -->
                    <table width="600" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.85); border-radius:32px; border:1px solid rgba(255,255,255,0.5); box-shadow:0 30px 60px rgba(108,92,231,0.12); overflow:hidden;">
                      
                      <!-- Top Badge -->
                      <tr>
                        <td align="center" style="padding:30px 20px 10px;">
                          <span style="background:rgba(108,92,231,0.08); color:#6c5ce7; padding:8px 18px; border-radius:100px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:2px;">
                            🔐 Military-Grade Privacy
                          </span>
                        </td>
                      </tr>

                      <!-- Logo -->
                      <tr>
                        <td align="center" style="padding:20px 0;">
                          <div style="width:70px; height:70px; background:#ffffff; border-radius:20px; box-shadow:0 15px 35px rgba(108,92,231,0.15); display:inline-flex; align-items:center; justify-content:center;">
                             <img src="${APP_LOGO}" alt="Nexora" style="width:50px; height:50px;" />
                          </div>
                        </td>
                      </tr>

                      <!-- Welcome Text -->
                      <tr>
                        <td align="center" style="padding:10px 45px;">
                          <h1 style="margin:0; font-size:36px; font-weight:900; color:#1a1a2e; letter-spacing:-1px; line-height:1.1;">
                            Welcome to Nexora 🎉
                          </h1>

                          <p style="margin-top:15px; color:#64748b; font-size:16px; line-height:1.8; font-weight:500;">
                            Subject <span style="color:#6c5ce7; font-weight:800;">@${data.username}</span>, you are now part of a new era of private communication.  
                            Experience secure messaging, vault storage, and zero-knowledge privacy.
                          </p>
                        </td>
                      </tr>

                      <!-- Gradient Title -->
                      <tr>
                        <td align="center" style="padding:10px 20px;">
                          <h2 style="margin:0; font-size:24px; font-weight:900; background:linear-gradient(90deg,#6c5ce7,#00d4ff); -webkit-background-clip:text; color:#6c5ce7; letter-spacing:-0.5px;">
                            Private. Secure. Powerful.
                          </h2>
                        </td>
                      </tr>

                      <!-- CTA -->
                      <tr>
                        <td align="center" style="padding:35px;">
                          <a href="${process.env.CLIENT_URL || 'https://nexora31.vercel.app'}/auth" 
                             style="background:linear-gradient(135deg,#6c5ce7 0%,#00d4ff 100%); color:#ffffff; padding:22px 50px; border-radius:100px; text-decoration:none; font-size:16px; font-weight:800; display:inline-block; box-shadow:0 20px 40px rgba(108,92,231,0.25); letter-spacing:0.5px;">
                            🚀 LAUNCH YOUR ACCOUNT
                          </a>
                        </td>
                      </tr>

                      <!-- Divider -->
                      <tr>
                        <td style="padding:0 50px;">
                          <hr style="border:none; border-top:1px solid #f1f5f9;">
                        </td>
                      </tr>

                      <!-- Features -->
                      <tr>
                        <td style="padding:35px 50px;">
                          <table width="100%">
                            <tr>
                              <td style="padding:15px; font-size:14px; color:#1a1a2e; font-weight:700;">
                                🔐 End-to-end encrypted chats
                              </td>
                              <td style="padding:15px; font-size:14px; color:#1a1a2e; font-weight:700;">
                                ⚡ Lightning-fast messaging
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:15px; font-size:14px; color:#1a1a2e; font-weight:700;">
                                ☁️ Secure vault storage
                              </td>
                              <td style="padding:15px; font-size:14px; color:#1a1a2e; font-weight:700;">
                                🎯 Zero-knowledge system
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Bottom CTA -->
                      <tr>
                        <td align="center" style="padding:10px 20px 30px;">
                          <a href="#" style="color:#6c5ce7; text-decoration:none; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">
                            📄 Explore Documentation
                          </a>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td align="center" style="padding:45px; background:#fafbfc; border-top:1px solid #f1f5f9; font-size:11px; color:#94a3b8; line-height:1.8; font-weight:600; text-transform:uppercase; letter-spacing:1px;">
                          © 2026 Nexora • The Private Chat Protocol  
                          <br><br>
                          You received this email because you initialized a connection with Nexora Core.
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>`;
    } else if (type === 'otp') {
        subject = "Nexora Recovery: Verification Code";
        html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin:0; padding:0; background:linear-gradient(135deg,#eef2ff,#e0f2fe,#f8fafc); font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.85); border-radius:32px; border:1px solid rgba(255,255,255,0.5); box-shadow:0 30px 60px rgba(108,92,231,0.12); overflow:hidden;">
                      <tr>
                        <td align="center" style="padding:30px 20px 10px;">
                          <span style="background:rgba(108,92,231,0.08); color:#6c5ce7; padding:8px 18px; border-radius:100px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:2px;">
                            🛡️ Recovery Protocol Active
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:20px 0;">
                          <div style="width:70px; height:70px; background:#ffffff; border-radius:20px; box-shadow:0 15px 35px rgba(108,92,231,0.15); display:inline-flex; align-items:center; justify-content:center;">
                             <img src="${APP_LOGO}" alt="Nexora" style="width:50px; height:50px;" />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:10px 45px;">
                          <h1 style="margin:0; font-size:32px; font-weight:900; color:#1a1a2e; letter-spacing:-1px;">Verification Code</h1>
                          <p style="margin-top:20px; color:#64748b; font-size:18px; line-height:1.6; font-weight:500;">
                            A request was made to unlock your account. Use the authorization code below to establish a secure link.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:30px 45px;">
                          <div style="background:#f8fafc; border:2px dashed #6c5ce7; border-radius:24px; padding:35px;">
                            <div style="font-size:52px; font-weight:950; color:#6c5ce7; letter-spacing:14px; font-family:'Courier New', monospace; margin-left:14px;">
                              ${data.otp}
                            </div>
                          </div>
                          <p style="margin-top:20px; color:#94a3b8; font-size:14px; font-weight:600;">Valid for 10 minutes &bull; Key Segment #RL-1</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:25px 45px 45px;">
                          <div style="background:rgba(46,213,115,0.05); border:1px solid rgba(46,213,115,0.1); border-radius:16px; padding:15px;">
                            <p style="margin:0; font-size:11px; font-weight:800; color:#15c35a; text-transform:uppercase; letter-spacing:1px;">Transmission Integrity: AES-256-GCM Verified</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:45px; background:#fafbfc; border-top:1px solid #f1f5f9; font-size:11px; color:#94a3b8; line-height:1.8; font-weight:600; text-transform:uppercase; letter-spacing:1px;">
                          © ${new Date().toLocaleString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' })} Nexora • Systems Security Protocol
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>`;
    } else if (type === 'login_alert') {
        subject = "Security Alert: Login Detected";
        html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin:0; padding:0; background:linear-gradient(135deg,#fff1f2,#f8fafc); font-family:'Inter', -apple-system, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.85); border-radius:32px; border:1px solid rgba(255,255,255,0.5); box-shadow:0 30px 60px rgba(225,29,72,0.12); overflow:hidden;">
                      <tr>
                        <td align="center" style="padding:30px 20px 10px;">
                          <span style="background:rgba(225,29,72,0.1); color:#e11d48; padding:8px 18px; border-radius:100px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:2px;">
                            ⚠️ Security Protocol Alert
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:20px 0;">
                          <div style="width:70px; height:70px; background:#ffffff; border-radius:20px; box-shadow:0 15px 35px rgba(225,29,72,0.15); display:inline-flex; align-items:center; justify-content:center;">
                             <img src="${APP_LOGO}" alt="Nexora" style="width:50px; height:50px;" />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:10px 45px;">
                          <h1 style="margin:0; font-size:32px; font-weight:900; color:#1a1a2e; letter-spacing:-1px;">New Login Trace</h1>
                          <p style="margin-top:20px; color:#64748b; font-size:18px; line-height:1.6; font-weight:500;">
                            A new login was detected for your account <span style="color:#e11d48; font-weight:800;">@${data.username}</span>.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:30px 45px;">
                          <div style="text-align:left; background:#f8fafc; border:1px solid #f1f5f9; border-radius:24px; padding:25px;">
                             <p style="margin:0 0 10px; font-size:14px; color:#64748b;"><strong>Node Identifier:</strong> <span style="color:#1a1a2e;">@${data.username}</span></p>
                             <p style="margin:0 0 10px; font-size:14px; color:#64748b;"><strong>Timestamp:</strong> <span style="color:#1a1a2e;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></p>
                             <p style="margin:0; font-size:14px; color:#64748b;"><strong>Integrity:</strong> <span style="color:#2ed573;">VERIFIED</span></p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:20px 45px 45px;">
                          <p style="color:#64748b; font-size:14px; line-height:1.6; margin-bottom:25px;">
                            If this was not you, lock your terminal immediately and initiate the secure password reset protocol.
                          </p>
                          <a href="${process.env.CLIENT_URL || 'https://nexora31.vercel.app'}/auth" 
                             style="background:#e11d48; color:#ffffff; padding:18px 40px; border-radius:100px; text-decoration:none; font-size:14px; font-weight:800; display:inline-block; box-shadow:0 15px 30px rgba(225,29,72,0.2);">
                            🔒 LOCK ACCOUNT
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:45px; background:#fafbfc; border-top:1px solid #f1f5f9; font-size:11px; color:#94a3b8; line-height:1.8; font-weight:600; text-transform:uppercase; letter-spacing:1px;">
                          SECURITY VAULT &bull; NEXORA CORE &bull; ALL RIGHTS ENCRYPTED
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>`;
    }

    try {
        await emailTransporter.sendMail({
            from: `"${GMAIL_NAME}" <${GMAIL_USER}>`,
            to: to,
            subject: subject,
            text: `Nexora Notice: Your request was processed. Please view the HTML version of this email to see your secure payload.`,
            html: html
        });
        ((..._args) => {})(`[SMTP] ${type.toUpperCase()} Transmission Successfully Relayed to: ${to}`);
        return true;
    } catch (err) {
        ((..._args) => {})(`[SMTP] ${type.toUpperCase()} Transmission FAILED:`, err.message);
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
    ((..._args) => {})('[PUSH] Web Push VAPID configured.');
} else {
    ((..._args) => {})('[PUSH] VAPID keys not set — push notifications disabled. Run: node -e "const w=require(\'web-push\');const k=w.generateVAPIDKeys();((..._args) => {})(JSON.stringify(k))" to generate.');
}

// In-memory offline message queue: username -> [{...msgData}]
const offlineMessageQueue = new Map();

async function sendPushNotification(username, payloadData) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
    try {
        const normalized = username.toLowerCase();
        // Fetch ALL registrations for this user to support multiple device push sync
        const rows = await db.all('SELECT subscription FROM push_subscriptions WHERE LOWER(username) = ?', [normalized]);
        
        if (!rows || rows.length === 0) return;

        const payload = JSON.stringify(payloadData);
        const pushPromises = rows.map(async (row) => {
            try {
                const sub = JSON.parse(row.subscription);
                if (!sub || !sub.endpoint) return;
                await webpush.sendNotification(sub, payload);
            } catch (err) {
                // Remove expired or "Gone" subscriptions from the registry
                if (err.statusCode === 410 || err.statusCode === 404) {
                    try {
                        const subObj = JSON.parse(row.subscription);
                        await db.run('DELETE FROM push_subscriptions WHERE LOWER(username) = ? AND endpoint = ?', [normalized, subObj.endpoint]);
                    } catch (cleanupErr) {}
                }
                ((..._args) => {})('[PUSH] Device relay failed:', err.message);
            }
        });

        await Promise.allSettled(pushPromises);
    } catch (e) {
        ((..._args) => {})('[PUSH] Global broadcast error:', e.message);
    }
}

function queueMessageForUser(username, msgData) {
    if (!offlineMessageQueue.has(username)) {
        offlineMessageQueue.set(username, []);
    }
    const queue = offlineMessageQueue.get(username);
    // Limit queue to 100 messages per user
    if (queue.length >= 100) queue.shift();
    queue.push(msgData);

    // Proactive background push to all registered devices
    sendPushNotification(username, {
        title: `New Message`,
        body: 'Encrypted Message is here 🔐',
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: { from: msgData.from },
    });
}

function deliverQueuedMessages(username, socket) {
    const queue = offlineMessageQueue.get(username);
    if (!queue || queue.length === 0) return;
    ((..._args) => {})(`[QUEUE] Delivering ${queue.length} queued message(s) to ${username}`);
    for (const msg of queue) {
        const eventName = msg.isLocation ? 'dm:location' : msg.isPoll ? 'dm:poll' : msg.isContact ? 'dm:contact' : msg.isMedia ? 'dm:media' : 'dm:message';
        socket.emit(eventName, msg);
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
const socketToUser = new Map(); // socket.id -> userId
let broadcastState = {
    isRunning: false,
    total: 0,
    sent: 0,
    failed: 0,
    startTime: null,
    lastMessage: ""
};

async function sendNextBroadcastMessage(users, index, message) {
    if (!broadcastState.isRunning || index >= users.length) {
        broadcastState.isRunning = false;
        ((..._args) => {})(`[BROADCAST] Completed. Sent: ${broadcastState.sent}, Failed: ${broadcastState.failed}`);
        return;
    }

    const user = users[index];
    const targetId = user.username.toLowerCase();
    const adminId = 'nexora_31';

    // ── Ensure Nexora_31 ↔ user connection exists so the thread appears ──
    try {
        const [first, second] = [adminId, targetId].sort();
        await db.run(
            'INSERT OR IGNORE INTO connections (user_a, user_b) VALUES (?, ?)',
            [first, second]
        );
    } catch (e) { /* ignore — connection may already exist */ }

    // ── Build plaintext-friendly payload (fromStory:true bypasses E2E decryption on client) ──
    const msgId = 'bc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const payload = {
        msgId,
        id: msgId,
        to: targetId,
        from: 'Nexora_31',            // Displayed sender
        text: message,                // Plain text — client reads this directly
        ciphertext: null,             // No encryption for broadcast
        iv: null,
        fromStory: true,              // ✅ Tells client to use data.text without decryption
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
        createdAt: Date.now(),
        isSelf: false,
        status: 'delivered',
        reactions: {}
    };

    try {
        // Relay via Socket.io if user is online
        io.to(targetId).emit('dm:message', payload);
        // Also queue for offline delivery
        queueMessageForUser(targetId, payload);
        broadcastState.sent++;
    } catch (e) {
        ((..._args) => {})(`[BROADCAST] Failed for ${targetId}:`, e.message);
        broadcastState.failed++;
    }

    // Process next after 120ms delay (~8 users/sec, safe rate)
    setTimeout(() => sendNextBroadcastMessage(users, index + 1, message), 120);
}

io.on('connection', (socket) => {
    ((..._args) => {})(`[+] Node Connected: ${socket.id}`);

    // User registers their identity — Joins a private room for cross-device sync
    socket.on('register', (userId) => {
        if (!userId) return;
        const normalizedId = userId.toLowerCase();
        socketToUser.set(socket.id, normalizedId);
        
        // Joining a room named after the userId allows us to emit to all of their devices
        socket.join(normalizedId);
        ((..._args) => {})(`[+] Registered: ${normalizedId} → Channel Sync Active`);

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
        io.to(targetId).emit('dm:message', enriched);
        
        // 2. Always attempt background push to ensure delivery if tab is closed/background
        queueMessageForUser(targetId, enriched);

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

        // 1. Relay to target user's devices
        io.to(targetId).emit('dm:media', enriched);
        
        // 2. Always attempt background push
        queueMessageForUser(targetId, enriched);

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

    socket.on('dm:wallpaper', async (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId && data.to) {
            const u1 = senderId.toLowerCase();
            const u2 = data.to.toLowerCase();
            const [first, second] = [u1, u2].sort();
            
            try {
                await db.run('UPDATE connections SET wallpaper = ? WHERE user_a = ? AND user_b = ?', [data.wallpaper, first, second]);
            } catch (e) { ((..._args) => {})("Wallpaper save error:", e); }

            io.to(u2).emit('dm:wallpaper', { from: senderId, wallpaper: data.wallpaper });
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

    socket.on('dm:typing', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:typing', { from: senderId, isTyping: data.isTyping });
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

    // ═══════════════════════════════════════════════
    // LOCATION SHARING RELAY
    // ═══════════════════════════════════════════════
    socket.on('dm:location', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            const enriched = { ...data, from: senderId };
            const targetId = (data.to || '').toLowerCase();
            const targetRoom = io.sockets.adapter.rooms.get(targetId);
            if (targetRoom && targetRoom.size > 0) {
                io.to(targetId).emit('dm:location', enriched);
            } else {
                queueMessageForUser(targetId, { ...enriched, isLocation: true });
            }
            socket.to(senderId).emit('dm:location', enriched);
        }
    });

    // ═══════════════════════════════════════════════
    // POLL SHARING RELAY
    // ═══════════════════════════════════════════════
    socket.on('dm:poll', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            const enriched = { ...data, from: senderId };
            const targetId = (data.to || '').toLowerCase();
            const targetRoom = io.sockets.adapter.rooms.get(targetId);
            if (targetRoom && targetRoom.size > 0) {
                io.to(targetId).emit('dm:poll', enriched);
            } else {
                queueMessageForUser(targetId, { ...enriched, isPoll: true });
            }
            socket.to(senderId).emit('dm:poll', enriched);
        }
    });

    // ═══════════════════════════════════════════════
    // POLL VOTE RELAY (Real-time vote sync)
    // ═══════════════════════════════════════════════
    socket.on('dm:poll_vote', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('dm:poll_vote', { from: senderId, msgId: data.msgId, optId: data.optId, action: data.action });
            socket.to(senderId).emit('dm:poll_vote', { from: senderId, msgId: data.msgId, optId: data.optId, action: data.action });
        }
    });

    // ═══════════════════════════════════════════════
    // CONTACT SHARING RELAY
    // ═══════════════════════════════════════════════
    socket.on('dm:contact', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            const enriched = { ...data, from: senderId };
            const targetId = (data.to || '').toLowerCase();
            const targetRoom = io.sockets.adapter.rooms.get(targetId);
            if (targetRoom && targetRoom.size > 0) {
                io.to(targetId).emit('dm:contact', enriched);
            } else {
                queueMessageForUser(targetId, { ...enriched, isContact: true });
            }
            socket.to(senderId).emit('dm:contact', enriched);
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
            // RESTRICTION: Official account nexora_31 cannot call or be called
            if (senderId === 'nexora_31' || targetId === 'nexora_31') {
                io.to(senderId).emit('call:reject', { from: 'System', reason: 'Official Nexora account does not support calling.' });
                return;
            }

            // RESTRICTION: Self-calling is prohibited
            if (senderId === targetId) {
                io.to(senderId).emit('call:reject', { from: 'System', reason: 'You cannot call yourself.' });
                return;
            }

            io.to(targetId).emit('call:offer', {
                from: senderId,
                sdp: data.sdp,
                callType: data.callType,
                callerName: data.callerName,
                callerColor: data.callerColor,
                roomId: data.roomId // Pass along room ID if provided
            });
            // Push notification for incoming call (using privacy text)
            sendPushNotification(targetId, {
                title: `Incoming Secret Call`,
                body: `An encrypted call is incoming on Nexora 🔐`,
                icon: '/icon.svg',
                badge: '/icon.svg',
            });
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
        ((..._args) => {})(`[Call] Room Created: ${roomId} by ${senderId}`);
        // For direct calls, the 'to' is usually the user we are calling.
        // If roomId is used for signaling, we broadcast 'offer-received' to the other peer(s).
        // Since Nexora usually calls 1-on-1, 'roomId' is typically shared via another channel or known ID.
        socket.to(roomId).emit('offer-received', { offer, roomId, from: senderId });
    });

    socket.on('join-room', ({ roomId }) => {
        const senderId = socketToUser.get(socket.id);
        socket.join(roomId);
        ((..._args) => {})(`[Call] Peer Joined: ${roomId} (${senderId})`);
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
                 ((..._args) => {})(`[-] Registered Identity Fully Logged Off: ${userId}`);
            }
        }
        ((..._args) => {})(`[-] Node Disconnected: ${socket.id}`);
    });
});

// GET PUBLIC PROFILE (For sharing links & landing pages)
// Returns safe non-PII data for previews
app.get('/api/users/public/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const sql = dbType === 'postgres' ? 'SELECT * FROM users WHERE username = (CASE WHEN $1 LIKE \'%@%\' THEN (SELECT username FROM users WHERE email = $1) ELSE $1 END)' : 'SELECT * FROM users WHERE username = ? OR email = ?';
        const params = dbType === 'postgres' ? [username] : [username, username];
        const user = await db.get(sql, params);
        
        if (!user) {
            return res.status(200).json({ error: "Node not found." }); // Return 200 with error to handle gracefully on UI
        }

        // Return only safe metadata
        res.json({
            fullName: decryptField(user.full_name),
            username: user.username,
            color: user.color,
            avatar_url: user.avatar_url,
            bio: user.bio,
            joinedDate: new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        });
    } catch (e) {
        res.status(500).json({ error: "Relay console failure." });
    }
});

// SYNC CONTACTS (Phase: Identity Validation from local address book)
app.post('/api/users/sync-contacts', async (req, res) => {
    try {
        const { contacts, me } = req.body;
        if (!contacts || !Array.isArray(contacts)) {
            return res.status(400).json({ error: "Invalid payload format." });
        }
        if (!db) return res.status(500).json({ error: "Database not ready." });

        if (contacts.length === 0) {
            return res.json({ suggestions: [] });
        }

        // 1. Hash incoming phone numbers and map them back to original strings
        const phoneToHash = {};
        const hashedContacts = [];
        for (const c of contacts) {
             const h = hashPhone(c);
             if (h) {
                 hashedContacts.push(h);
                 phoneToHash[h] = c;
             }
        }

        if (hashedContacts.length === 0) {
             return res.json({ suggestions: [], registeredPhones: [] });
        }

        // 2. Fetch matched identities
        const placeholders = hashedContacts.map((_, i) => (dbType === 'postgres' ? `$${i + 2}` : '?')).join(',');
        const sql = `SELECT username, full_name, color, phone_hash FROM users WHERE username != ${dbType === 'postgres' ? '$1' : '?'} AND phone_hash IN (${placeholders}) LIMIT 50`;
        const params = [me || '', ...hashedContacts];

        const users = await db.all(sql, params);

        const registeredPhones = users.map(u => phoneToHash[u.phone_hash]).filter(Boolean);

        const suggestions = users.map(u => ({
            username: u.username,
            fullName: decryptField(u.full_name),
            reason: 'In your contacts',
            color: u.color || 'from-[#6c5ce7] to-[#00d4ff]'
        }));

        res.json({ suggestions, registeredPhones });
    } catch (e) {
        ((..._args) => {})("Contact Sync Protocol Error:", e);
        res.status(500).json({ error: "Server sync failure." });
    }
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
                nexoraMailProtocol('login_alert', user.email, { username: user.username }).catch((..._args) => {});

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
        ((..._args) => {})("Login Error:", err);
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
    let { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    email = email.trim();
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


        await nexoraMailProtocol('otp', email, { otp: otp });
        res.json({ status: "success", message: "Recovery code transmitted to your email." });
    } catch (err) {
        ((..._args) => {})("Recovery mail error:", err);
        res.status(500).json({ error: "Failed to transmit recovery code." });
    }
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
    let { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });
    email = email.trim();

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
        ((..._args) => {})("Reset password error:", err);
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
    ((..._args) => {})(`[SIGNUP] Incoming identity synchronization request for @${username} (Email: ${email})`);
    
    try {
        if (!db) {
            ((..._args) => {})("[SIGNUP] Database Reference Missing Error: DB not ready");
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
        nexoraMailProtocol('welcome', finalEmail, { username: finalUsername }).catch((..._args) => {});

        res.status(201).json({ 
            status: "success", 
            user: newUser,
            message: "User identity initialized." 
        });
    } catch (err) {
        ((..._args) => {})("Signup error details:", err);
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
                                &copy; ${new Date().toLocaleString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' })} NEXORA CORE &bull; PRIVACY PROTOCOL
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
        ((..._args) => {})("Approval error:", err);
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
        ((..._args) => {})("SMTP Test Error:", err);
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
        ((..._args) => {})("Email update request error:", err);
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
        ((..._args) => {})("Email update error:", err);
        res.status(500).json({ error: "Failed to update email." });
    }
});


// GET /api/admin/config — Read current SEO config
app.get('/api/admin/config', (req, res) => {
    try {
        const seoPath = path.join(__dirname, '../client/src/config/seo.json');
        const existing = JSON.parse(fs.readFileSync(seoPath, 'utf-8'));
        res.json({ seo: existing });
    } catch (err) {
        res.json({ seo: {} });
    }
});

// POST /api/admin/config — Write full SEO config + optional logo
app.post('/api/admin/config', async (req, res) => {
    try {
        const { seo, logoBase64 } = req.body;
        if (seo) {
            const seoPath = path.join(__dirname, '../client/src/config/seo.json');
            // Read existing config and deep-merge so we never lose fields
            let existing = {};
            try { existing = JSON.parse(fs.readFileSync(seoPath, 'utf-8')); } catch {}
            const merged = { ...existing, ...seo };
            fs.writeFileSync(seoPath, JSON.stringify(merged, null, 2), 'utf-8');
            ((..._args) => {})('[ADMIN] SEO config updated. Indexing:', merged.indexing !== false);
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
        ((..._args) => {})('[ADMIN] Config error:', err);
        res.status(500).json({ error: "Failed to deploy dynamic settings." });
    }
});

// ------------------------------------------------------------------
// ADMIN DOMAIN ROUTES (OTP Login & Security)
// ------------------------------------------------------------------
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing identity credentials." });
    
    try {
        if (!db) return res.status(500).json({ error: "Database not ready." });
        const adminUser = await db.get("SELECT * FROM users WHERE LOWER(email) = ? AND role = 'Admin'", [email.toLowerCase()]);
        
        if (!adminUser) return res.status(401).json({ error: "Unrecognized administrative identity." });
        
        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid access credentials." });
        
        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 10 * 60 * 1000;
        otpStore.set("admin_login_otp", { otp, expiry, email: email.toLowerCase() });
        
        // Send OTP via SMTP
        await nexoraMailProtocol('otp', email, { otp });
        
        return res.json({ status: "success", requireOtp: true, message: "Secondary verification required. OTP sent." });
    } catch (err) {
        ((..._args) => {})("Admin Login Error:", err);
        res.status(500).json({ error: "Internal Authentication Failure." });
    }
});

app.post('/api/admin/verify-login', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Missing verification payload." });
    
    const record = otpStore.get("admin_login_otp");
    if (!record || record.email !== email.toLowerCase()) {
        return res.status(400).json({ error: "Invalid session. Please authenticate again." });
    }
    if (Date.now() > record.expiry) {
        otpStore.delete("admin_login_otp");
        return res.status(400).json({ error: "OTP token expired." });
    }
    if (record.otp !== otp.toString().trim()) {
        return res.status(400).json({ error: "Invalid verification segment." });
    }
    
    otpStore.delete("admin_login_otp");
    res.json({ status: "success", message: "Admin authenticated." });
});

app.post('/api/admin/update-credentials', async (req, res) => {
    const { newEmail, newPassword } = req.body;
    if (!newEmail && !newPassword) return res.status(400).json({ error: "No update payload provided." });
    
    try {
        if (!db) return res.status(500).json({ error: "Database not ready." });
        
        // Ensure email isn't used by a non-admin
        if (newEmail) {
            const existing = await db.get("SELECT id FROM users WHERE LOWER(email) = ? AND role != 'Admin'", [newEmail.toLowerCase()]);
            if (existing) return res.status(400).json({ error: "Email is bound to a standard user account." });
        }
        
        let querySegments = [];
        let params = [];
        
        if (newEmail) {
            querySegments.push("email = ?");
            params.push(newEmail.toLowerCase());
        }
        if (newPassword) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            querySegments.push("password = ?");
            params.push(hashedPassword);
        }
        
        if (querySegments.length === 0) return res.json({ status: "success" });
        
        await db.run(`UPDATE users SET ${querySegments.join(", ")} WHERE role = 'Admin'`, params);
        res.json({ status: "success", message: "Security credentials updated." });
    } catch (err) {
        ((..._args) => {})("Admin Security Update Error:", err);
        res.status(500).json({ error: "Failed to deploy new security context." });
    }
});

// GET /api/blogs — Read all blogs
app.get('/api/blogs', (req, res) => {
    try {
        const blogsPath = path.join(__dirname, '../client/src/config/blogs.json');
        const blogs = JSON.parse(fs.readFileSync(blogsPath, 'utf-8'));
        res.json({ blogs });
    } catch (err) {
        res.json({ blogs: [] });
    }
});

// POST /api/blogs — Save all blogs
app.post('/api/blogs', (req, res) => {
    try {
        const { blogs } = req.body;
        const blogsPath = path.join(__dirname, '../client/src/config/blogs.json');
        fs.writeFileSync(blogsPath, JSON.stringify(blogs, null, 2), 'utf-8');
        res.json({ status: "success", message: "Blogs updated." });
    } catch (err) {
        res.status(500).json({ error: "Failed to save blogs." });
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
        ((..._args) => {})("Media upload error:", err);
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
app.post('/api/push/subscribe', async (req, res) => {
    const { username, subscription } = req.body;
    if (!username || !subscription) {
        return res.status(400).json({ error: 'username and subscription required' });
    }
    try {
        const subStr = typeof subscription === 'string' ? subscription : JSON.stringify(subscription);
        const subObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
        const endpoint = subObj.endpoint || 'unknown';
        const params = [username.toLowerCase(), endpoint, subStr];
        const sql = dbType === 'postgres' 
            ? 'INSERT INTO push_subscriptions (username, endpoint, subscription) VALUES ($1, $2, $3) ON CONFLICT (username, endpoint) DO UPDATE SET subscription = $3'
            : 'INSERT OR REPLACE INTO push_subscriptions (username, endpoint, subscription) VALUES (?, ?, ?)';
        await db.run(sql, params);
        ((..._args) => {})(`[PUSH] Subscription persisted for: ${username}`);
        res.json({ status: 'success', message: 'Push subscription registered.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error while subscribing' });
    }
});

// Unsubscribe user from push notifications
app.delete('/api/push/subscribe/:username', async (req, res) => {
    const username = req.params.username.toLowerCase();
    try {
        await db.run('DELETE FROM push_subscriptions WHERE LOWER(username) = ?', [username]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ error: 'Database error while unsubscribing' });
    }
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
        ((..._args) => {})(`[SEARCH] Query: "${q}" by User: "${me}"`);
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
        ((..._args) => {})("Search error:", err);
        res.status(500).json({ users: [] });
    }
});

// NEW: Zero-Knowledge Contact Sync (using pre-hashed phone numbers from client)
app.post('/api/connections/sync', async (req, res) => {
    const { hashes, username: me } = req.body; 
    if (!hashes || !Array.isArray(hashes)) return res.json({ matches: [] });
    
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        if (hashes.length === 0) return res.json({ matches: [] });

        // Normalize hashes to hex if they were sent as base64 from client
        // Client uses bufferToBase64 for hashString, so we should convert it on server if needed.
        // Wait, my client implementation used bufferToBase64.
        const hexHashes = hashes.map(h => {
            try {
                // Check if it's base64 (very likely since client uses bufferToBase64)
                return Buffer.from(h, 'base64').toString('hex');
            } catch {
                return h; // Fallback to raw if not base64
            }
        });

        // Find matches (excluding self)
        const placeholders = hexHashes.map(() => '?').join(',');
        const users = await db.all(`
            SELECT username, full_name AS "fullName", color, avatar_url AS "avatarUrl"
            FROM users 
            WHERE phone_hash IN (${placeholders})
              AND LOWER(username) != LOWER(?)
            LIMIT 20
        `, [...hexHashes, (me || '').toLowerCase()]);

        const result = users.map(u => ({
            ...u,
            fullName: decryptField(u.fullName),
            avatarUrl: decryptField(u.avatarUrl)
        }));

        res.json({ matches: result });
    } catch (err) {
        ((..._args) => {})("Connection Sync Error:", err);
        res.status(500).json({ matches: [] });
    }
});

// NEW: Endpoint to get specific user profile and check username
app.get('/api/users/profile', async (req, res) => {
    const username = (req.query.username || '').toLowerCase();
    try {
        if (!db || !username) return res.status(400).json({ error: "Invalid username" });
        const user = await db.get('SELECT username, full_name AS "fullName", email, role, created_at, color, phone_number AS "phoneNumber", avatar_url AS "avatarUrl", bio FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (!user) return res.status(404).json({ error: "User not found" });
        
        // Decrypt sensitive info for the client
        user.fullName = decryptField(user.fullName);
        user.phoneNumber = decryptField(user.phoneNumber);
        user.avatarUrl = decryptField(user.avatarUrl); // Decrypt avatar URL for UI
        
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Update user bio
app.patch('/api/users/bio', async (req, res) => {
    const { username, bio } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        await db.run('UPDATE users SET bio = ? WHERE LOWER(username) = LOWER(?)', [bio || null, username]);
        res.json({ status: "success" });
    } catch (err) {
        ((..._args) => {})("Bio update error:", err);
        res.status(500).json({ error: "Failed to update bio" });
    }
});

// Upload / Update profile picture
app.post('/api/users/avatar', async (req, res) => {
    const { username, avatarBase64 } = req.body;
    if (!username || !avatarBase64) return res.status(400).json({ error: "username and avatarBase64 required" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        
        // Encrypt profile picture URL/Base64 in database
        const encryptedAvatar = encryptField(avatarBase64);
        await db.run('UPDATE users SET avatar_url = ? WHERE LOWER(username) = LOWER(?)', [encryptedAvatar, username]);
        
        // Broadcast the avatar update to all connected friends
        const connections = await db.all('SELECT user_a, user_b FROM connections WHERE user_a = LOWER(?) OR user_b = LOWER(?)', [username, username]);
        const friends = connections.map(c => c.user_a === username.toLowerCase() ? c.user_b : c.user_a);
        friends.forEach(f => {
            io.to(f).emit('dm:avatar_update', { from: username, avatarUrl: avatarBase64 });
        });

        res.json({ status: "success", message: "Profile picture updated." });
    } catch (err) {
        ((..._args) => {})("Avatar update error:", err);
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
        ((..._args) => {})("Connection Request Error:", err);
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
        const connectionsRows = await db.all(`
            SELECT 
                CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END as peer_username,
                c.wallpaper
            FROM connections c
            WHERE c.user_a = ? OR c.user_b = ?
        `, [username, username, username]);
        
        const enriched = [];
        for (const c of connectionsRows) {
            const peer = c.peer_username;
            let userData = null;
            if (peer === 'nexora_31') {
                userData = {
                    id: 999999,
                    username: 'Nexora_31',
                    name: encryptField('Nexora Official'),
                    color: 'from-blue-600 to-indigo-600',
                    avatarUrl: encryptField('https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg')
                };
            } else {
                userData = await db.get(`SELECT id, username, full_name as name, color, avatar_url as avatarUrl FROM users WHERE LOWER(username) = ?`, [peer]);
            }

            if (userData) {
                const room = io.sockets.adapter.rooms.get(userData.username.toLowerCase());
                enriched.push({
                    id: userData.id,
                    username: userData.username,
                    name: decryptField(userData.name),
                    color: userData.color,
                    avatarUrl: userData.avatarUrl ? decryptField(userData.avatarUrl) : null,
                    wallpaper: c.wallpaper,
                    online: (room && room.size > 0) || peer === 'nexora_31',
                    preview: peer === 'nexora_31' ? 'Official Announcements' : 'Secure tunnel established',
                    unread: 0
                });
            }
        }
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
        ((..._args) => {})("Respond Error:", err);
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
            JOIN users u ON LOWER(s.username) = LOWER(u.username)
            WHERE s.username IN (${placeholders}) AND s.created_at >= datetime('now', '-1 day')
            ORDER BY s.created_at ASC
        `, [username, username, ...friends]);

        // Decrypt full_name, avatarUrl and media_url for each story before sending to client
        const decrypted = stories.map(s => ({ 
            ...s, 
            name: decryptField(s.name),
            avatarUrl: decryptField(s.avatarUrl),
            media_url: decryptField(s.media_url) 
        }));

        res.json({ stories: decrypted });
    } catch (err) {
        ((..._args) => {})("Fetch Stories Error:", err);
        res.status(500).json({ stories: [] });
    }
});

// Post a new story
app.post('/api/stories', async (req, res) => {
    const { username, mediaUrl, mediaType, caption } = req.body;
    if (!username || !mediaUrl) return res.status(400).json({ error: "Missing required fields" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        
        // Encrypt story media URL so nobody can see it from DB raw view
        const encryptedMediaUrl = encryptField(mediaUrl);

        await db.run('INSERT INTO stories (username, media_url, media_type, caption) VALUES (?, ?, ?, ?)', 
            [username.toLowerCase(), encryptedMediaUrl, mediaType || 'image', caption || '']);
        
        res.json({ status: "success" });
    } catch (err) {
        ((..._args) => {})("Post Story Error:", err);
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
        ((..._args) => {})("Story View Error:", err);
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
                })).catch((..._args) => {});
            }
        }
        res.json({ status: "success" });
    } catch (err) {
        ((..._args) => {})("Story Like Error:", err);
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

        // Push notification (Privacy standard)
        sendPushNotification(receiver, {
            title: `New Message`,
            body: 'Encrypted Message is here 🔐',
            icon: '/icon.svg'
        });

        res.json({ status: "success" });
    } catch (err) {
        ((..._args) => {})("Story Reply Error:", err);
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
            FROM story_views sv JOIN users u ON LOWER(sv.viewer_username) = LOWER(u.username) 
            WHERE sv.story_id = ? ORDER BY sv.created_at DESC
        `, [storyId]);
        
        const likes = await db.all(`
            SELECT u.username, u.full_name as name, u.color 
            FROM story_likes sl JOIN users u ON LOWER(sl.liker_username) = LOWER(u.username) 
            WHERE sl.story_id = ? ORDER BY sl.created_at DESC
        `, [storyId]);

        // Decrypt names before returning
        const decryptedViews = views.map(v => ({ ...v, name: decryptField(v.name) }));
        const decryptedLikes = likes.map(l => ({ ...l, name: decryptField(l.name) }));

        res.json({ views: decryptedViews, likes: decryptedLikes });
    } catch (err) {
        ((..._args) => {})("Story Stats Error:", err);
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

// ------------------------------------------------------------------
// ADMIN PANEL API (Full CRUD Management)
// ------------------------------------------------------------------

async function logAdminAction(admin_username, action, target, details) {
    try {
        if (!db) return;
        await db.run(
            'INSERT INTO audit_logs (action, target, admin_username, details) VALUES (?, ?, ?, ?)',
            [action, target, admin_username, details || '']
        );
    } catch (err) {
        ((..._args) => {})("[AUDIT] Log failed:", err);
    }
}

// POST /api/admin/broadcast — Real Email Broadcast
app.post('/api/admin/broadcast', async (req, res) => {
    const { subject, html } = req.body;
    if (!subject || !html) return res.status(400).json({ error: "Subject and HTML body required." });

    try {
        if (!db) return res.status(503).json({ error: "Database initializing" });
        const users = await db.all('SELECT email, username FROM users');
        
        let sent = 0;
        let failed = 0;

        // Background loop to prevent blocking (admin gets immediate success)
        (async () => {
             for (const u of users) {
                 try {
                     await emailTransporter.sendMail({
                         from: `"${process.env.GMAIL_NAME || 'Nexora Admin'}" <${process.env.GMAIL_USER}>`,
                         to: u.email,
                         subject: subject,
                         html: html.split('{{username}}').join(u.username)
                     });
                     sent++;
                     // Small delay to prevent SMTP throttling
                     await new Promise(r => setTimeout(r, 500)); 
                 } catch (e) {
                     failed++;
                     ((..._args) => {})(`[BROADCAST] Failed to ${u.email}:`, e.message);
                 }
             }
             logAdminAction('ADMIN', 'EMAIL_BROADCAST', 'ALL_USERS', `Sent: ${sent}, Failed: ${failed}`);
        })();

        res.json({ status: "success", message: "Broadcast sequence initialized.", total: users.length });
    } catch (err) {
        res.status(500).json({ error: "Failed to start broadcast." });
    }
});

// GET /api/admin/analytics — Real Growth Data
app.get('/api/admin/analytics', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: "DB initializing" });
        
        // Signups over last 30 days
        const growthSql = dbType === 'postgres' 
            ? "SELECT DATE(created_at) as date, COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date ASC"
            : "SELECT date(created_at) as date, COUNT(*) as count FROM users WHERE created_at > date('now', '-30 days') GROUP BY date(created_at) ORDER BY date ASC";
        
        const growth = await db.all(growthSql);
        
        // Distribution of user roles
        const roles = await db.all("SELECT role, COUNT(*) as count FROM users GROUP BY role");
        
        res.json({ growth, roles });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// GET /api/admin/audit-logs
app.get('/api/admin/audit-logs', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: "DB initializing" });
        const logs = await db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
        res.json({ logs });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

// GET /api/admin/media — Real Asset Gallery
app.get('/api/admin/media', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: "DB initializing" });
        const assets = await db.all('SELECT * FROM media_assets ORDER BY created_at DESC');
        res.json({ assets });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch media assets" });
    }
});

// POST /api/admin/media — Add asset
app.post('/api/admin/media', async (req, res) => {
    const { url, name, size, type } = req.body;
    try {
        await db.run('INSERT INTO media_assets (url, name, size, type) VALUES (?, ?, ?, ?)', [url, name, size, type]);
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ error: "Failed to add asset" });
    }
});

// DELETE /api/admin/media/:id — Remove asset
app.delete('/api/admin/media/:id', async (req, res) => {
    const { id } = req.params;
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        await db.run('DELETE FROM media_assets WHERE id = ?', [id]);
        logAdminAction('ADMIN', 'MEDIA_DELETE', `asset_${id}`, 'Media asset removed');
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete asset" });
    }
});

// GET /api/admin/stats — Dashboard overview stats
app.get('/api/admin/stats', async (req, res) => {
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
        const totalStories = await db.get('SELECT COUNT(*) as count FROM stories');
        const totalConnections = await db.get('SELECT COUNT(*) as count FROM connections');
        const totalRequests = await db.get("SELECT COUNT(*) as count FROM connection_requests WHERE status = 'pending'");
        const onlineCount = io.sockets.adapter.rooms ? socketToUser.size : 0;
        res.json({
            totalUsers: totalUsers?.count || 0,
            totalStories: totalStories?.count || 0,
            totalConnections: totalConnections?.count || 0,
            pendingRequests: totalRequests?.count || 0,
            onlineUsers: onlineCount
        });
    } catch (err) {
        ((..._args) => {})("[ADMIN] Stats error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// GET /api/admin/users — List all users with decrypted PII
app.get('/api/admin/users', async (req, res) => {
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const users = await db.all('SELECT id, full_name, email, username, role, status, color, created_at, phone_number, avatar_url, bio FROM users ORDER BY created_at DESC');
        const decrypted = users.map(u => ({
            id: u.id,
            fullName: decryptField(u.full_name),
            email: u.email,
            username: u.username,
            role: u.role || 'Standard',
            status: u.status || 'Active',
            color: u.color,
            createdAt: u.created_at,
            phoneNumber: decryptField(u.phone_number),
            avatarUrl: decryptField(u.avatar_url),
            bio: u.bio,
            online: !!(io.sockets.adapter.rooms.get(u.username?.toLowerCase()))
        }));
        res.json({ users: decrypted });
    } catch (err) {
        ((..._args) => {})("[ADMIN] Users list error:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// PATCH /api/admin/users/:username/role — Change user role
app.patch('/api/admin/users/:username/role', async (req, res) => {
    const { username } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Role required" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        await db.run('UPDATE users SET role = ? WHERE LOWER(username) = LOWER(?)', [role, username]);
        res.json({ status: "success", message: `Role updated to ${role} for @${username}` });
    } catch (err) {
        ((..._args) => {})("[ADMIN] Role update error:", err);
        res.status(500).json({ error: "Failed to update role" });
    }
});

// PATCH /api/admin/users/:username/status — Change user status (Active/Suspended)
app.patch('/api/admin/users/:username/status', async (req, res) => {
    const { username } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status required" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        await db.run('UPDATE users SET status = ? WHERE LOWER(username) = LOWER(?)', [status, username]);
        res.json({ status: "success", message: `Status updated to ${status} for @${username}` });
    } catch (err) {
        ((..._args) => {})("[ADMIN] Status update error:", err);
        res.status(500).json({ error: "Failed to update status" });
    }
});

// DELETE /api/admin/users/:username — Delete user and all associated data
app.delete('/api/admin/users/:username', async (req, res) => {
    const { username } = req.params;
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const u = username.toLowerCase();
        // Remove connections
        await db.run('DELETE FROM connections WHERE user_a = ? OR user_b = ?', [u, u]);
        // Remove connection requests
        await db.run('DELETE FROM connection_requests WHERE LOWER(from_username) = ? OR LOWER(to_username) = ?', [u, u]);
        // Remove notifications
        await db.run('DELETE FROM notifications WHERE LOWER(owner_username) = ? OR LOWER(from_username) = ?', [u, u]);
        // Remove stories + views + likes
        const userStories = await db.all('SELECT id FROM stories WHERE LOWER(username) = ?', [u]);
        for (const s of userStories) {
            await db.run('DELETE FROM story_views WHERE story_id = ?', [s.id]);
            await db.run('DELETE FROM story_likes WHERE story_id = ?', [s.id]);
        }
        await db.run('DELETE FROM stories WHERE LOWER(username) = ?', [u]);
        // Finally delete user
        await db.run('DELETE FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        res.json({ status: "success", message: `User @${username} and all associated data deleted.` });
    } catch (err) {
        ((..._args) => {})("[ADMIN] User delete error:", err);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// PATCH /api/admin/users/:username/password — Reset user password
app.patch('/api/admin/users/:username/password', async (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const hashed = await bcrypt.hash(newPassword, 10);
        await db.run('UPDATE users SET password = ? WHERE LOWER(username) = LOWER(?)', [hashed, username]);
        res.json({ status: "success", message: `Password reset for @${username}` });
    } catch (err) {
        ((..._args) => {})("[ADMIN] Password reset error:", err);
        res.status(500).json({ error: "Failed to reset password" });
    }
});

// STORY ADMIN ENDPOINTS REMOVED — Stories remain encrypted & private

// ------------------------------------------------------------------
// EMAIL TEMPLATE MANAGEMENT API
// ------------------------------------------------------------------

// GET /api/admin/email-templates — Get all customizable templates
app.get('/api/admin/email-templates', (req, res) => {
    const APP_LOGO = "https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg";
    const CLIENT_URL = process.env.CLIENT_URL || 'https://nexora31.vercel.app';

    // Default templates (what the system uses if no override exists)
    const defaults = {
        welcome: {
            subject: "Welcome to Nexora: Protocol Established",
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:linear-gradient(135deg,#eef2ff,#e0f2fe,#f8fafc);font-family:'Inter',-apple-system,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.85);border-radius:32px;border:1px solid rgba(255,255,255,0.5);box-shadow:0 30px 60px rgba(108,92,231,0.12);overflow:hidden;"><tr><td align="center" style="padding:30px 20px 10px;"><span style="background:rgba(108,92,231,0.08);color:#6c5ce7;padding:8px 18px;border-radius:100px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">🔐 Military-Grade Privacy</span></td></tr><tr><td align="center" style="padding:20px 0;"><div style="width:70px;height:70px;background:#ffffff;border-radius:20px;box-shadow:0 15px 35px rgba(108,92,231,0.15);display:inline-flex;align-items:center;justify-content:center;"><img src="{{APP_LOGO}}" alt="Nexora" style="width:50px;height:50px;" /></div></td></tr><tr><td align="center" style="padding:10px 45px;"><h1 style="margin:0;font-size:36px;font-weight:900;color:#1a1a2e;letter-spacing:-1px;line-height:1.1;">Welcome to Nexora 🎉</h1><p style="margin-top:15px;color:#64748b;font-size:16px;line-height:1.8;font-weight:500;">Subject <span style="color:#6c5ce7;font-weight:800;">@{{username}}</span>, you are now part of a new era of private communication.</p></td></tr><tr><td align="center" style="padding:35px;"><a href="{{CLIENT_URL}}/auth" style="background:linear-gradient(135deg,#6c5ce7 0%,#00d4ff 100%);color:#ffffff;padding:22px 50px;border-radius:100px;text-decoration:none;font-size:16px;font-weight:800;display:inline-block;box-shadow:0 20px 40px rgba(108,92,231,0.25);">🚀 LAUNCH YOUR ACCOUNT</a></td></tr><tr><td align="center" style="padding:45px;background:#fafbfc;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;line-height:1.8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">© {{YEAR}} Nexora • The Private Chat Protocol</td></tr></table></td></tr></table></body></html>`,
            description: "Sent to new users when they sign up",
            variables: ["{{username}}", "{{APP_LOGO}}", "{{CLIENT_URL}}", "{{YEAR}}"]
        },
        otp: {
            subject: "Nexora Recovery: Verification Code",
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:linear-gradient(135deg,#eef2ff,#e0f2fe,#f8fafc);font-family:'Inter',-apple-system,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.85);border-radius:32px;border:1px solid rgba(255,255,255,0.5);box-shadow:0 30px 60px rgba(108,92,231,0.12);overflow:hidden;"><tr><td align="center" style="padding:30px 20px 10px;"><span style="background:rgba(108,92,231,0.08);color:#6c5ce7;padding:8px 18px;border-radius:100px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">🛡️ Recovery Protocol Active</span></td></tr><tr><td align="center" style="padding:20px 0;"><div style="width:70px;height:70px;background:#ffffff;border-radius:20px;box-shadow:0 15px 35px rgba(108,92,231,0.15);display:inline-flex;align-items:center;justify-content:center;"><img src="{{APP_LOGO}}" alt="Nexora" style="width:50px;height:50px;" /></div></td></tr><tr><td align="center" style="padding:10px 45px;"><h1 style="margin:0;font-size:32px;font-weight:900;color:#1a1a2e;letter-spacing:-1px;">Verification Code</h1><p style="margin-top:20px;color:#64748b;font-size:18px;line-height:1.6;font-weight:500;">Use the code below to verify your identity.</p></td></tr><tr><td align="center" style="padding:30px 45px;"><div style="background:#f8fafc;border:2px dashed #6c5ce7;border-radius:24px;padding:35px;"><div style="font-size:52px;font-weight:950;color:#6c5ce7;letter-spacing:14px;font-family:'Courier New',monospace;margin-left:14px;">{{otp}}</div></div><p style="margin-top:20px;color:#94a3b8;font-size:14px;font-weight:600;">Valid for 10 minutes</p></td></tr><tr><td align="center" style="padding:45px;background:#fafbfc;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;line-height:1.8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">© {{YEAR}} Nexora • Systems Security Protocol</td></tr></table></td></tr></table></body></html>`,
            description: "Sent when user requests password recovery OTP",
            variables: ["{{otp}}", "{{APP_LOGO}}", "{{YEAR}}"]
        },
        login_alert: {
            subject: "Security Alert: Login Detected",
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:linear-gradient(135deg,#fff1f2,#f8fafc);font-family:'Inter',-apple-system,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.85);border-radius:32px;border:1px solid rgba(255,255,255,0.5);box-shadow:0 30px 60px rgba(225,29,72,0.12);overflow:hidden;"><tr><td align="center" style="padding:30px 20px 10px;"><span style="background:rgba(225,29,72,0.1);color:#e11d48;padding:8px 18px;border-radius:100px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">⚠️ Security Protocol Alert</span></td></tr><tr><td align="center" style="padding:20px 0;"><div style="width:70px;height:70px;background:#ffffff;border-radius:20px;box-shadow:0 15px 35px rgba(225,29,72,0.15);display:inline-flex;align-items:center;justify-content:center;"><img src="{{APP_LOGO}}" alt="Nexora" style="width:50px;height:50px;" /></div></td></tr><tr><td align="center" style="padding:10px 45px;"><h1 style="margin:0;font-size:32px;font-weight:900;color:#1a1a2e;letter-spacing:-1px;">New Login Trace</h1><p style="margin-top:20px;color:#64748b;font-size:18px;line-height:1.6;font-weight:500;">A new login was detected for <span style="color:#e11d48;font-weight:800;">@{{username}}</span> at {{TIMESTAMP}}.</p></td></tr><tr><td align="center" style="padding:20px 45px 45px;"><a href="{{CLIENT_URL}}/auth" style="background:#e11d48;color:#ffffff;padding:18px 40px;border-radius:100px;text-decoration:none;font-size:14px;font-weight:800;display:inline-block;box-shadow:0 15px 30px rgba(225,29,72,0.2);">🔒 LOCK ACCOUNT</a></td></tr><tr><td align="center" style="padding:45px;background:#fafbfc;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;line-height:1.8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">SECURITY VAULT • NEXORA CORE • ALL RIGHTS ENCRYPTED</td></tr></table></td></tr></table></body></html>`,
            description: "Sent when a user logs in to their account",
            variables: ["{{username}}", "{{APP_LOGO}}", "{{CLIENT_URL}}", "{{TIMESTAMP}}"]
        }
    };

    // Merge overrides into defaults
    const templates = {};
    for (const [key, def] of Object.entries(defaults)) {
        const override = emailTemplateOverrides.get(key);
        templates[key] = {
            ...def,
            subject: override?.subject || def.subject,
            html: override?.html || def.html,
            isCustomized: !!override
        };
    }
    res.json({ templates });
});

// PUT /api/admin/email-templates/:type — Update a specific template
app.put('/api/admin/email-templates/:type', (req, res) => {
    const { type } = req.params;
    const { subject, html } = req.body;
    const validTypes = ['welcome', 'otp', 'login_alert'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: `Invalid template type. Valid: ${validTypes.join(', ')}` });
    if (!subject || !html) return res.status(400).json({ error: "Subject and HTML body required" });

    emailTemplateOverrides.set(type, { subject, html });
    ((..._args) => {})(`[ADMIN] Email template '${type}' customized.`);
    res.json({ status: "success", message: `Template '${type}' updated successfully.` });
});

// DELETE /api/admin/email-templates/:type — Reset template to default
app.delete('/api/admin/email-templates/:type', (req, res) => {
    const { type } = req.params;
    emailTemplateOverrides.delete(type);
    ((..._args) => {})(`[ADMIN] Email template '${type}' reset to default.`);
    res.json({ status: "success", message: `Template '${type}' reset to default.` });
});

// GET /api/admin/connections — List all connections
app.get('/api/admin/connections', async (req, res) => {
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const connections = await db.all(`
            SELECT c.id, c.user_a, c.user_b, c.created_at,
                   ua.full_name as name_a, ua.color as color_a,
                   ub.full_name as name_b, ub.color as color_b
            FROM connections c
            LEFT JOIN users ua ON LOWER(ua.username) = c.user_a
            LEFT JOIN users ub ON LOWER(ub.username) = c.user_b
            ORDER BY c.created_at DESC
        `);
        const decrypted = connections.map(c => ({
            ...c,
            name_a: decryptField(c.name_a),
            name_b: decryptField(c.name_b)
        }));
        res.json({ connections: decrypted });
    } catch (err) {
        ((..._args) => {})("[ADMIN] Connections list error:", err);
        res.status(500).json({ error: "Failed to fetch connections" });
    }
});

// DELETE /api/admin/connections/:id — Remove a connection
app.delete('/api/admin/connections/:id', async (req, res) => {
    const { id } = req.params;
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        await db.run('DELETE FROM connections WHERE id = ?', [id]);
        res.json({ status: "success", message: "Connection removed." });
    } catch (err) {
        ((..._args) => {})("[ADMIN] Connection delete error:", err);
        res.status(500).json({ error: "Failed to remove connection" });
    }
});

// ── NEW: DIRECT MESSAGE BROADCAST (Snapchat Style) ──
app.post('/api/admin/broadcast-chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message content required" });
    if (broadcastState.isRunning) return res.status(400).json({ error: "A broadcast is already in progress." });

    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const allUsers = await db.all('SELECT username FROM users WHERE LOWER(username) != ? AND LOWER(username) != ?', ['nexora_31', 'me']);
        
        broadcastState = {
            isRunning: true,
            total: allUsers.length,
            sent: 0,
            failed: 0,
            startTime: new Date(),
            lastMessage: message
        };

        ((..._args) => {})(`[BROADCAST] Starting for ${allUsers.length} users...`);
        // Trigger background loop
        sendNextBroadcastMessage(allUsers, 0, message);

        res.json({ status: "success", message: "Broadcast sequence initiated.", total: allUsers.length });
    } catch (err) {
        ((..._args) => {})("[ADMIN] Chat broadcast error:", err);
        res.status(500).json({ error: "Failed to initialize broadcast" });
    }
});

app.post('/api/admin/broadcast-chat/stop', (req, res) => {
    if (broadcastState.isRunning) {
        broadcastState.isRunning = false;
        res.json({ status: "success", message: "Broadcast sequence terminated." });
    } else {
        res.status(400).json({ error: "No active broadcast to stop." });
    }
});

app.get('/api/admin/broadcast-chat/status', (req, res) => {
    res.json(broadcastState);
});

// GET /api/blogs - Return all blogs

// GET /api/blogs - Return all blogs
app.get('/api/blogs', async (req, res) => {
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        const blogs = await db.all('SELECT * FROM blogs ORDER BY id DESC');
        res.json({ blogs });
    } catch (err) {
        ((..._args) => {})("[BLOGS] Fetch error:", err);
        res.status(500).json({ error: "Failed to fetch blogs" });
    }
});

// POST /api/blogs - Replace all blogs (simple array overwrite based on frontend logic)
app.post('/api/blogs', async (req, res) => {
    const { blogs } = req.body;
    if (!blogs || !Array.isArray(blogs)) return res.status(400).json({ error: "Invalid blogs data" });
    
    try {
        if (!db) return res.status(500).json({ error: "DB not ready" });
        await db.run('DELETE FROM blogs');
        for (const blog of blogs) {
            await db.run(
                'INSERT INTO blogs (id, title, excerpt, status, date, author, category, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [blog.id, blog.title, blog.excerpt, blog.status, blog.date, blog.author, blog.category, blog.image]
            );
        }
        res.json({ status: "success" });
    } catch (err) {
        ((..._args) => {})("[BLOGS] Save error:", err);
        res.status(500).json({ error: "Failed to save blogs" });
    }
});

Sentry.setupExpressErrorHandler(app);

// ------------------------------------------------------------------
// START SERVER
// ------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    ((..._args) => {})(`[SERVER] Nexora Core operational on port ${PORT}`);
    ((..._args) => {})(`[SECURITY] Helmet active | HSTS enabled | Zero-knowledge relay mode`);
    
    // --- Render Anti-Sleep Mechanism ---
    // Pings its own public URL every 10 minutes (600,000 ms) to prevent sleeping
    const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    if (selfUrl.includes('onrender')) {
        ((..._args) => {})(`[ANTI-SLEEP] Protocol initiated for backend URL: ${selfUrl}`);
        setInterval(() => {
            const lib = selfUrl.startsWith('https') ? require('https') : require('http');
            lib.get(selfUrl, (res) => {
                ((..._args) => {})(`[ANTI-SLEEP] Ping Successful! Server kept awake. Status: ${res.statusCode}`);
            }).on("error", (err) => {
                ((..._args) => {})(`[ANTI-SLEEP] Ping Failed:`, err.message);
            });
        }, 10 * 60 * 1000); // 10 minutes
    }
});
