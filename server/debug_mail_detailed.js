require('dotenv').config({ path: require('path').join(__dirname, '.env') });
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

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_NAME = process.env.GMAIL_NAME || "Nexora Private Chat";

const mailOptions = {
    from: `"${GMAIL_NAME}" <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject: 'FINAL DEBUG: ' + new Date().toLocaleString(),
    text: 'Testing SMTP with detailed log.'
};

console.log('DEBUG_INFO | USER:', GMAIL_USER);
console.log('DEBUG_INFO | NAME:', GMAIL_NAME);
console.log('DEBUG_INFO | FROM:', mailOptions.from);

emailTransporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error('DEBUG_INFO | FAIL:', error);
    } else {
        console.log('DEBUG_INFO | SUCCESS:', info.response);
    }
    process.exit();
});
