const nodemailer = require('nodemailer');
require('dotenv').config();

console.log("TEST_EMAIL:", process.env.TEST_EMAIL);
console.log("TEST_EMAIL_APP_PASSWORD length:", process.env.TEST_EMAIL_APP_PASSWORD?.length);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.TEST_EMAIL,
    pass: process.env.TEST_EMAIL_APP_PASSWORD,
  },
});

async function main() {
  try {
    const info = await transporter.sendMail({
      from: process.env.TEST_EMAIL,
      to: process.env.TEST_EMAIL,
      subject: "Test Email from Script",
      text: "This is a test email.",
    });
    console.log("Message sent: %s", info.messageId);
  } catch (err) {
    console.error("Error sending email:", err.message);
  }
}

main();
