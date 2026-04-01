require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

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

const databaseUrl = process.env.DATABASE_URL;
const cleanUrl = databaseUrl.split('?')[0];

const pool = new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false }
});

async function seed() {
    const users = [
        { name: 'Rahul', email: 'rahul@nexora.app', username: 'rahul_12', password: 'Trial 12', color: 'from-purple-500 to-indigo-500' },
        { name: 'Shreya', email: 'shreya@nexora.app', username: 'Shreya_14', password: 'Trial@123', color: 'from-pink-500 to-rose-500' }
    ];

    for (const u of users) {
        const hashed = await bcrypt.hash(u.password, 10);
        try {
            await pool.query(
                'INSERT INTO users (full_name, email, username, password, color, role) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password',
                [encryptField(u.name), u.email, u.username, hashed, u.color, 'Standard']
            );
            ((..._args) => {})(`User ${u.username} seeded.`);
        } catch (e) {
            ((..._args) => {})(`Error seeding ${u.username}:`, e.message);
        }
    }
    
    // Also connect them
    try {
        const [u1, u2] = ['rahul_12', 'Shreya_14'].sort();
        await pool.query('INSERT INTO connections (user_a, user_b) VALUES ($1, $2) ON CONFLICT DO NOTHING', [u1, u2]);
        ((..._args) => {})('Rahul and Shreya connected.');
    } catch (e) {
        ((..._args) => {})('Error connecting users:', e.message);
    }

    pool.end();
}

seed();
