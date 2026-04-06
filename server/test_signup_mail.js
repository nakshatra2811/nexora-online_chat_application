const http = require('http');

const id = Date.now();
const data = JSON.stringify({
    username: 'user_' + id,
    email: 'test_' + id + '@example.com', // Unique email
    fullName: 'Test User',
    password: 'Password@123'
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/signup',
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

console.log(`Triggering SIGNUP for user_${id}...`);
req.write(data);
req.end();
