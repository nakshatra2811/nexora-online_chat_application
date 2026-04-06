const fetch = require('node-fetch'); // Wait, node 20 has native fetch
// Actually, let's use standard http for safety

const http = require('http');

const data = JSON.stringify({
    identifier: 'aarav_vibe'
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/send-login-otp',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Response:", body);
    });
});

req.on('error', (e) => {
    console.error("FAILED:", e.message);
});

req.write(data);
req.end();
