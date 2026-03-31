require('dotenv').config();
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
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);

// ------------------------------------------------------------------
// DATABASE INITIALIZATION
// ------------------------------------------------------------------
let db;
(async () => {
    try {
        db = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'Standard',
                status TEXT DEFAULT 'Active',
                color TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                phone_number TEXT DEFAULT 'Not Set'
            );

            CREATE TABLE IF NOT EXISTS connection_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_username TEXT NOT NULL,
                to_username TEXT NOT NULL,
                from_name TEXT NOT NULL,
                from_color TEXT NOT NULL,
                status TEXT DEFAULT 'pending', -- pending, accepted, declined
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_a TEXT NOT NULL,
                user_b TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_a, user_b)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_username TEXT NOT NULL,
                from_username TEXT NOT NULL,
                type TEXT NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS stories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                media_url TEXT NOT NULL,
                media_type TEXT DEFAULT 'image', -- image, video
                caption TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS story_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                story_id INTEGER NOT NULL,
                viewer_username TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(story_id, viewer_username)
            );

            CREATE TABLE IF NOT EXISTS story_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                story_id INTEGER NOT NULL,
                liker_username TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(story_id, liker_username)
            );
        `);
        // Ensure phone_number exists in case table was created before the schema update
        try { await db.exec('ALTER TABLE users ADD COLUMN phone_number TEXT DEFAULT "Not Set"'); } catch (e) { }

        // SEED DATA FOR TESTING (SEARCH SUGGESTIONS)
        const seedUsers = [
            ['Alice Network', 'alice@nexora.app', 'alice', 'password123', 'from-purple-500 to-indigo-500', 'Standard'],
            ['Bob Protocol', 'bob@nexora.app', 'bob', 'password123', 'from-cyan-500 to-blue-500', 'Standard'],
            ['Charlie Terminal', 'charlie@nexora.app', 'charlie', 'password123', 'from-green-400 to-teal-500', 'Standard'],
            ['Nexora Support', 'support@nexora.app', 'nexora', 'password123', 'from-pink-500 to-rose-500', 'Admin']
        ];
        for (const user of seedUsers) {
            try {
                await db.run('INSERT INTO users (full_name, email, username, password, color, role) VALUES (?, ?, ?, ?, ?, ?)', user);
            } catch (err) { /* already exists */ }
        }

        console.log("[DATABASE] SQLite initialized at ./database.sqlite");
    } catch (e) {
        console.error("[DATABASE] Init error:", e.message);
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

// Cloudinary Config (encrypted media storage)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

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
            io.to(data.to?.toLowerCase()).emit('call:ice-candidate', { from: senderId, candidate: data.candidate });
        }
    });

    socket.on('call:hangup', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('call:hangup', { from: senderId });
        }
    });

    socket.on('call:reject', (data) => {
        const senderId = socketToUser.get(socket.id);
        if (senderId) {
            io.to(data.to?.toLowerCase()).emit('call:reject', { from: senderId });
        }
    });

    socket.on('screenshot_taken', (data) => {
        socket.to(data.tunnelId).emit('notify_screenshot', { user: socket.id });
    });

    // ═══════════════════════════════════════════════
    // WALLPAPER SYNC (per-user relay)
    // ═══════════════════════════════════════════════
    socket.on('dm:wallpaper', (data) => {
        const targetSocketId = userSockets.get(data.to);
        const fromUserId = connectedUsers.get(socket.id);
        if (targetSocketId && fromUserId) {
            io.to(targetSocketId).emit('dm:wallpaper', { from: fromUserId, wallpaper: data.wallpaper });
        }
    });

    // ═══════════════════════════════════════════════
    // DISAPPEARING MESSAGE SETTING SYNC
    // ═══════════════════════════════════════════════
    socket.on('dm:disappear_setting', (data) => {
        const targetSocketId = userSockets.get(data.to);
        const fromUserId = connectedUsers.get(socket.id);
        if (targetSocketId && fromUserId) {
            io.to(targetSocketId).emit('dm:disappear_setting', { from: fromUserId, timer: data.timer });
        }
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
        const user = await db.get('SELECT * FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND password = ?', [identifier, identifier, password]);

        if (user) {
            return res.json({ status: "success", role: user.role, fullName: user.full_name, email: user.email, username: user.username, phoneNumber: user.phone_number, color: user.color, message: "Entered the Void." });
        } else if (username.startsWith("Authorized_Account_")) {
            return res.json({ status: "success", role: "AuthorizedAccount", message: "Entered the Void." });
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
        const user = await db.get('SELECT username FROM users WHERE username = ?', [username.toLowerCase().trim()]);
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
                <style>
                    body { font-family: 'Inter', sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
                    .container { max-width: 500px; margin: 50px auto; background: #ffffff; border-radius: 24px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; }
                    .logo { font-size: 24px; font-weight: 900; color: #6c5ce7; margin-bottom: 30px; }
                    .title { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
                    .desc { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 30px; }
                    .code-box { background: #f1f5f9; border-radius: 16px; padding: 24px; font-size: 32px; font-weight: 900; letter-spacing: 10px; color: #6c5ce7; border: 1px dashed #cbd5e1; }
                    .expire { font-size: 12px; color: #94a3b8; margin-top: 16px; }
                    .footer { font-size: 11px; color: #94a3b8; margin-top: 40px; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="container">
                    <img src="https://drive.google.com/uc?id=1cDmOorgwIHnDSPCq7cWODP4ZZMmBhXxn" alt="Nexora Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 24px; border-radius: 20px; box-shadow: 0 10px 20px rgba(108,92,231,0.2);" />
                    <h2 class="title" style="margin-top:0;">Verification Protocol</h2>
                    <p class="desc">A request was made to reset your Nexora password. Use the authorization code below to proceed.</p>
                    <div class="code-box">${otp}</div>
                    <p class="expire">This code expires in <strong>10 minutes</strong>.</p>
                    <p class="footer">
                        If you did not initiate this, please ignore this transmission.<br>
                        Never share this code with anyone.
                    </p>
                </div>
            </body>
            </html>
        `;
        const mailOptions = {
            from: `"${process.env.GMAIL_NAME || 'Nexora Private Chat'}" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Nexora Recovery: Identity Verification Code',
            html: recoveryHtml
        };
        await emailTransporter.sendMail(mailOptions);
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
        await db.run('UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)', [newPassword, email]);
        otpStore.delete(email.toLowerCase()); // Clear OTP after use
        res.json({ status: "success", message: "Password reset successfully." });
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
    try {
        if (!db) return res.status(500).json({ status: "error", error: "Database not ready" });

        // 1. Check if username exists
        const existing = await db.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
        if (existing) {
            return res.status(400).json({ status: "error", error: "Username not available" });
        }

        // 2. Insert into database
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const role = isAuthorized ? 'PendingAuthorized' : 'Standard';
        await db.run(
            'INSERT INTO users (full_name, email, username, password, role, color, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [fullName, email, username.toLowerCase(), password, role, color, phoneNumber || 'Not Set']
        );

        if (isAuthorized) {
            const adminHtml = `
                <div style="font-family: 'Inter', sans-serif; padding: 40px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; max-width: 500px; margin: auto; text-align: center;">
                    <img src="https://drive.google.com/uc?id=1cDmOorgwIHnDSPCq7cWODP4ZZMmBhXxn" alt="Nexora Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 24px; border-radius: 20px; box-shadow: 0 10px 20px rgba(108,92,231,0.2);" />
                    <div style="color: #6c5ce7; font-weight: 900; font-size: 20px; margin-bottom: 24px;">NEXORA ADMIN</div>
                    <h2 style="color: #1a1a2e; margin-bottom: 20px; font-size: 22px; font-weight: 800;">New Access Request</h2>
                    <div style="background: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #f1f5f9;">
                        <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;"><strong>Subject Identity:</strong> <span style="color: #1a1a2e;">${fullName}</span></p>
                        <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;"><strong>Network Identifier:</strong> <span style="color: #6c5ce7;">@${username}</span></p>
                        <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Email Archive:</strong> <span style="color: #1a1a2e;">${email}</span></p>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; line-height: 1.6;">
                        This identity requires manual clearance before protocol access is granted. Please review this request in the Secure Admin Console.
                    </p>
                </div>
            `;
            const mailOptions = {
                from: `"${process.env.GMAIL_NAME || 'Nexora Admin'}" <${process.env.GMAIL_USER}>`,
                to: process.env.GMAIL_USER,
                subject: 'New Authorized Account Request: ' + username,
                html: adminHtml
            };
            await emailTransporter.sendMail(mailOptions);

            // Send notification to the user themselves
            const userPendingHtml = `
                <div style="font-family: 'Inter', sans-serif; padding: 40px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; max-width: 500px; margin: auto; text-align: center;">
                    <img src="https://drive.google.com/uc?id=1cDmOorgwIHnDSPCq7cWODP4ZZMmBhXxn" alt="Nexora Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 24px; border-radius: 20px; box-shadow: 0 10px 20px rgba(108,92,231,0.2);" />
                    <div style="color: #6c5ce7; font-weight: 900; font-size: 20px; margin-bottom: 24px;">NEXORA</div>
                    <h2 style="color: #1a1a2e; margin-bottom: 20px; font-size: 22px; font-weight: 800;">Account Under Review</h2>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
                        Hello <strong>${fullName}</strong>,<br><br>
                        Your request to join the Nexora protocol has been successfully received. 
                        Your identity (<strong>@${username}</strong>) is currently undergoing the mandatory clearance process.
                    </p>
                    <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #f1f5f9; display: inline-block;">
                        <span style="color: #f59e0b; font-weight: 700; font-size: 14px;">STATUS: PENDING APPROVAL</span>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; line-height: 1.6;">
                        You will receive another transmission once your access is granted.
                    </p>
                </div>
            `;
            const userMailOptions = {
                from: `"${process.env.GMAIL_NAME || 'Nexora Core'}" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: 'Nexora Protocol: Account Under Review',
                html: userPendingHtml
            };
            await emailTransporter.sendMail(userMailOptions);

            return res.json({ status: "pending", message: "Request submitted. Awaiting Admin Approval." });
        }
        // NEW: WELCOME MAIL FOR STANDARD USERS
        const welcomeHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', -apple-system, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; }
                    .wrapper { padding: 40px 20px; text-align: center; }
                    .main { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 32px; padding: 50px 40px; box-shadow: 0 20px 40px rgba(108,92,231,0.06); border: 1px solid #eef2f7; }
                    .logo { font-size: 28px; font-weight: 900; letter-spacing: -1px; color: #6c5ce7; margin-bottom: 40px; }
                    .welcome-text { font-size: 24px; font-weight: 800; color: #1a1a2e; margin-bottom: 15px; }
                    .body-text { font-size: 15px; color: #64748b; line-height: 1.7; margin-bottom: 35px; }
                    .feature-box { background: #f8fafc; border-radius: 20px; padding: 25px; margin-bottom: 35px; text-align: left; border: 1px solid #f1f5f9; }
                    .feature-title { font-size: 13px; font-weight: 900; color: #6c5ce7; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; display: block; }
                    .feature-item { font-size: 14px; color: #475569; margin-bottom: 8px; display: flex; align-items: center; }
                    .btn { display: inline-block; background: linear-gradient(135deg, #6c5ce7, #00d4ff); color: #ffffff; padding: 16px 35px; border-radius: 18px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 10px 20px rgba(108,92,231,0.25); transition: transform 0.2s; }
                    .footer-note { font-size: 11px; color: #94a3b8; margin-top: 45px; border-top: 1px solid #f1f5f9; pt: 25px; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="main">
                        <img src="https://drive.google.com/uc?id=1cDmOorgwIHnDSPCq7cWODP4ZZMmBhXxn" alt="Nexora Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 24px; border-radius: 20px; box-shadow: 0 10px 20px rgba(108,92,231,0.2);" />
                        <h1 class="welcome-text" style="margin-top:0;">Connected to the Void</h1>
                        <p class="body-text">Welcome, <strong>${fullName}</strong>. Your identity <strong>@${username}</strong> has been successfully linked to the Nexora Private Chat protocol.</p>
                        
                        <div class="feature-box">
                            <span class="feature-title">Protocol Features Active</span>
                            <div class="feature-item">🔒 End-to-End P2P Encryption</div>
                            <div class="feature-item">⏳ Ephemeral Persistence Logs</div>
                            <div class="feature-item">📞 Secure Voice/Video Tunnels</div>
                        </div>

                        <a href="https://nexora.app" class="btn">Enter Protocol</a>

                        <div class="footer-note">
                            This is an automated transmission from Nexora Core.<br>
                            Identity synchronization completed at ${new Date().toUTCString()}.
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const welcomeMailOptions = {
            from: `"${process.env.GMAIL_NAME || 'Nexora Private Chat'}" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Welcome to Nexora: Protocol Established',
            html: welcomeHtml
        };
        await emailTransporter.sendMail(welcomeMailOptions);

        res.status(201).json({ status: "success", message: "User identity initialized. Welcome transmission sent." });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Server Error: Failed to process signup." });
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
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.1); border: 1px solid rgba(108,92,231,0.1); }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); padding: 60px 40px; text-align: center; position: relative; }
                    .logo-circle { width: 80px; height: 80px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
                    .brand-name { color: #ffffff; font-size: 32px; font-weight: 900; letter-spacing: -2px; margin: 0; }
                    .content { padding: 60px 40px; text-align: center; }
                    .title { font-size: 36px; font-weight: 900; color: #1a1a2e; margin-bottom: 16px; letter-spacing: -1.5px; }
                    .greeting { font-size: 20px; font-weight: 600; color: #6c5ce7; margin-bottom: 24px; }
                    .message { color: #64748b; font-size: 16px; line-height: 1.8; margin-bottom: 48px; max-width: 440px; margin-left: auto; margin-right: auto; }
                    .button { background: linear-gradient(135deg, #6c5ce7 0%, #00d4ff 100%); color: #ffffff !important; padding: 22px 50px; border-radius: 100px; text-decoration: none; font-weight: 800; font-size: 16px; display: inline-block; box-shadow: 0 25px 50px -12px rgba(108,92,231,0.5); transition: all 0.3s ease; letter-spacing: 1px; }
                    .footer { background: #f1f5f9; padding: 40px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; }
                    .copyright { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 20px; }
                    .disclaimer-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: left; margin-top: 20px; }
                    .disclaimer-text { font-size: 10px; color: #94a3b8; line-height: 1.6; margin: 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo-circle" style="background:transparent; border:none; box-shadow:none;">
                            <img src="https://drive.google.com/uc?id=1cDmOorgwIHnDSPCq7cWODP4ZZMmBhXxn" alt="Nexora Logo" style="width: 80px; height: 80px; object-fit: contain; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);" />
                        </div>
                        <h1 class="brand-name">Nexora.</h1>
                    </div>
                    <div class="content">
                        <h2 class="title">Welcome to the Void.</h2>
                        <div class="greeting">Access Granted: ${username}</div>
                        <p class="message">
                            Your identity has been verified. You are now authorized to use the Nexora Private Protocol. Enter the unified communication hub to start your deeply encrypted journey.
                        </p>
                        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/auth" class="button">START SURFING</a>
                    </div>
                    <div class="footer">
                        <div class="copyright">&copy; 2026 NEXORA SYSTEMS &bull; ALL RIGHTS RESERVED</div>
                        <div class="disclaimer-box">
                            <p class="disclaimer-text">
                                <strong>SECURITY DISCLAIMER:</strong> This is an automated protocol transmission. Nexora is a zero-knowledge relay service. We do not store, monitor, or have decryption keys for your communications. You are solely responsible for managing your Private Vault keys and session security. 
                                <br><br>
                                If you did not request this access, please ignore this transmission. Reference-ID: SEC-NODE-${Math.random().toString(36).substring(7).toUpperCase()}
                            </p>
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
            <div style="font-family: 'Inter', sans-serif; padding: 40px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; max-width: 500px; margin: auto; text-align: center;">
                <img src="https://drive.google.com/uc?id=1cDmOorgwIHnDSPCq7cWODP4ZZMmBhXxn" alt="Nexora Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 24px; border-radius: 20px; box-shadow: 0 10px 20px rgba(108,92,231,0.2);" />
                <div style="color: #6c5ce7; font-weight: 900; font-size: 24px; margin-bottom: 24px;">NEXORA</div>
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
// DYNAMIC CMS CONFIGURATION (SEO & Brand)
// ------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

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
            SELECT username, full_name AS fullName, color 
            FROM users 
            WHERE (LOWER(username) LIKE ? OR LOWER(full_name) LIKE ?) 
              AND LOWER(username) != LOWER(?)
            LIMIT 20
        `, [`%${q}%`, `%${q}%`, me]);

        const mappedUsers = users.map(u => ({ ...u, online: true }));
        res.json({ users: mappedUsers });
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ users: [] });
    }
});

// NEW: Endpoint to get specific user profile and check username
app.get('/api/users/profile', async (req, res) => {
    const username = (req.query.username || '').toLowerCase();
    try {
        if (!db || !username) return res.status(400).json({ error: "Invalid username" });
        const user = await db.get('SELECT username, full_name AS fullName, email, role, created_at, color, phone_number AS phoneNumber FROM users WHERE username = ?', [username]);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
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
        const existingReqFromMe = await db.get('SELECT id FROM connection_requests WHERE LOWER(from_username) = LOWER(?) AND LOWER(to_username) = LOWER(?) AND status = "pending"', [from, to]);
        if (existingReqFromMe) return res.json({ status: 'already_sent' });

        const existingReqToMe = await db.get('SELECT id FROM connection_requests WHERE LOWER(from_username) = LOWER(?) AND LOWER(to_username) = LOWER(?) AND status = "pending"', [to, from]);

        if (existingReqToMe) {
            // BACK-ACTION: Cross-request exists, auto-accept it!
            await db.run('UPDATE connection_requests SET status = "accepted" WHERE id = ?', [existingReqToMe.id]);

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
            const fromSocket = userSockets.get(from.toLowerCase());
            const targetSocket = userSockets.get(to.toLowerCase());
            if (targetSocket) {
                io.to(targetSocket).emit('connection_accepted', { by: from, byName: fromName || from });
                io.to(targetSocket).emit('new_notification', { type: 'request_accepted', message: `${fromName || from} accepted your follow request.`, from_username: from.toLowerCase() });
            }
            if (fromSocket) {
                io.to(fromSocket).emit('connection_accepted', { by: to, byName: to });
                io.to(fromSocket).emit('new_notification', { type: 'request_back_prompt', message: `${to} started following you back.`, from_username: to.toLowerCase() });
            }
            return res.json({ status: 'accepted', message: 'Bidirectional request: Connected!' });
        }

        // 3. Insert into DB (Standard pending request)
        await db.run(
            'INSERT INTO connection_requests (from_username, to_username, from_name, from_color) VALUES (?, ?, ?, ?)',
            [from.toLowerCase(), to.toLowerCase(), fromName || from, fromColor || COLORS[0]]
        );

        // Notify via socket if target is online
        const targetSocket = userSockets.get(to);
        if (targetSocket) {
            io.to(targetSocket).emit('connection_request', { from, fromName, fromColor });
        }
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
        const reqs = await db.all('SELECT id, from_username AS "from", from_name AS fromName, from_color AS fromColor, created_at AS time FROM connection_requests WHERE LOWER(to_username) = LOWER(?) AND status = "pending"', [username]);
        // Format time
        const formatted = reqs.map(r => ({
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
            SELECT u.id, u.username, u.full_name as name, u.color
            FROM connections c
            JOIN users u ON
                (c.user_a = u.username AND c.user_b = ?) OR
                (c.user_b = u.username AND c.user_a = ?)
        `, [username, username]);
        // Attach real-time online status from the live socket map
        const enriched = rows.map(r => ({
            ...r,
            online: userSockets.has(r.username),
            preview: 'Secure tunnel established',
            unread: 0,
        }));
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
            'SELECT id, to_username AS "to", created_at AS time FROM connection_requests WHERE LOWER(from_username) = LOWER(?) AND status = "pending"',
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
            await db.run('UPDATE connection_requests SET status = "accepted" WHERE id = ?', [requestId]);

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
            const senderSocket = userSockets.get(req_.from_username.toLowerCase());
            if (senderSocket) {
                io.to(senderSocket).emit('connection_accepted', { by: username.toLowerCase(), byName: username });
                io.to(senderSocket).emit('new_notification', { type: 'request_accepted', message: `${username} accepted your follow request.`, from_username: username.toLowerCase() });
            }

            // Notify the receiver via socket
            const receiverSocket = userSockets.get(username.toLowerCase());
            if (receiverSocket) {
                 io.to(receiverSocket).emit('new_notification', { type: 'request_back_prompt', message: `${req_.from_name} started following you.`, from_username: req_.from_username.toLowerCase() });
            }
        } else {
            await db.run('UPDATE connection_requests SET status = "declined" WHERE id = ?', [requestId]);
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
        await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
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
            SELECT s.*, u.full_name as name, u.color,
            (SELECT COUNT(*) FROM story_views WHERE story_id = s.id) as views_count,
            (SELECT EXISTS(SELECT 1 FROM story_views WHERE story_id = s.id AND viewer_username = ?)) as is_viewed,
            (SELECT COUNT(*) FROM story_likes WHERE story_id = s.id) as likes_count,
            (SELECT EXISTS(SELECT 1 FROM story_likes WHERE story_id = s.id AND liker_username = ?)) as is_liked
            FROM stories s
            JOIN users u ON s.username = u.username
            WHERE s.username IN (${placeholders}) AND s.created_at >= datetime('now', '-1 day')
            ORDER BY s.created_at DESC
        `, [username, username, ...friends]);

        res.json({ stories });
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
        await db.run('INSERT OR IGNORE INTO story_views (story_id, viewer_username) VALUES (?, ?)', [storyId, username.toLowerCase()]);
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
        const exists = await db.get('SELECT 1 FROM story_likes WHERE story_id = ? AND liker_username = ?', [storyId, username.toLowerCase()]);
        if (exists) {
            await db.run('DELETE FROM story_likes WHERE story_id = ? AND liker_username = ?', [storyId, username.toLowerCase()]);
        } else {
            await db.run('INSERT INTO story_likes (story_id, liker_username) VALUES (?, ?)', [storyId, username.toLowerCase()]);
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
            msgId: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: false,
            fromStory: true
        };

        // Notify via socket if online
        const targetSocket = userSockets.get(receiver);
        if (targetSocket) {
             io.to(targetSocket).emit('new_notification', { type: 'story_reply', message: `Replied to your story: "${message}"`, from_username: sender });
             io.to(targetSocket).emit('dm:message', storyRelayPayload);
        } else {
             queueMessageForUser(receiver, storyRelayPayload);
        }

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
            FROM story_views sv JOIN users u ON sv.viewer_username = u.username 
            WHERE sv.story_id = ? ORDER BY sv.created_at DESC
        `, [storyId]);
        
        const likes = await db.all(`
            SELECT u.username, u.full_name as name, u.color 
            FROM story_likes sl JOIN users u ON sl.liker_username = u.username 
            WHERE sl.story_id = ? ORDER BY sl.created_at DESC
        `, [storyId]);

        res.json({ views, likes });
    } catch (err) {
        console.error("Story Stats Error:", err);
        res.status(500).json({ views: [], likes: [] });
    }
});

// ------------------------------------------------------------------
// START SERVER
// ------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`[SERVER] Nexora Core operational on port ${PORT}`);
    console.log(`[SECURITY] Helmet active | HSTS enabled | Zero-knowledge relay mode`);
});
