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

const mailOptions = {
    from: `"${process.env.GMAIL_NAME || 'Nexora'}" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: 'DEBUG MAIL: ' + new Date().toLocaleString(),
    text: 'Testing SMTP with full error logging.'
};

console.log('Using User:', process.env.GMAIL_USER);
console.log('Using Pass Length:', process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0);

emailTransporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error('ERROR DETECTED:', error);
    } else {
        console.log('SUCCESS:', info.response);
    }
    process.exit();
});
