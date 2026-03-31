require('dotenv').config();
const nodemailer = require('nodemailer');

const emailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

console.log(`[TEST] Verifying SMTP connection for: ${process.env.GMAIL_USER}...`);

emailTransporter.verify((error, success) => {
    if (error) {
        console.error('[FAILED] SMTP Connection Error:', error);
        process.exit(1);
    } else {
        console.log('[SUCCESS] SMTP Relay is operational.');
        process.exit(0);
    }
});
