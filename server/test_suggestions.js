const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-core-auth-secret-key-2025';

// Connect to DB
const db = new sqlite3.Database('./database.sqlite');

const token = jwt.sign({ username: 'aarav_vibe' }, JWT_SECRET);

console.log("Token:", token);

// Now hit the API
const http = require('http');

const opt = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/suggestions',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`
    }
};

const req = http.request(opt, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Data:", data);
    });
});

req.on('error', (e) => console.error(e));
req.end();
