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

const mailOptions = {
    from: `"${process.env.GMAIL_NAME || 'Nexora'}" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: 'Nexora SMTP Test: ' + new Date().toLocaleString(),
    text: 'This is a test email to verify that SMTP relay is working correctly for login/recovery mails.'
};

console.log(`[TEST] Sending real test email to: ${process.env.GMAIL_USER}...`);

emailTransporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error('[FAILED] Email failed to send:', error);
        process.exit(1);
    } else {
        console.log('[SUCCESS] Email sent successfully:', info.response);
        process.exit(0);
    }
});
