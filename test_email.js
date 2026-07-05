const nodemailer = require('nodemailer');
require('dotenv').config();

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.TEST_EMAIL,
        pass: process.env.TEST_EMAIL_APP_PASSWORD,
      },
    });
  }
  return _transporter;
}

async function main() {
  const adminEmail = process.env.EMAIL_USER || process.env.TEST_EMAIL;
  console.log("adminEmail:", adminEmail);
  
  if (!adminEmail) {
    console.log('Email config missing');
    return;
  }
  
  const webhookUrl = process.env.GAS_EMAIL_WEBHOOK_URL;
  if (webhookUrl) {
     console.log("Using webhook");
  } else {
    try {
      const info = await getTransporter().sendMail({
        from: `"Proctara Hiring Team" <${process.env.TEST_EMAIL}>`,
        to: adminEmail,
        subject: "Test Issue Alert",
        html: "<p>Test</p>",
      });
      console.log('Issue alert email sent successfully via nodemailer', info.messageId);
    } catch (err) {
      console.error("Nodemailer error:", err);
    }
  }
}

main();
