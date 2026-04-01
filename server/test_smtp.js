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

((..._args) => {})(`[TEST] Verifying SMTP connection for: ${process.env.GMAIL_USER}...`);

emailTransporter.verify((error, success) => {
    if (error) {
        ((..._args) => {})('[FAILED] SMTP Connection Error:', error);
        process.exit(1);
    } else {
        ((..._args) => {})('[SUCCESS] SMTP Relay is operational.');
        process.exit(0);
    }
});
