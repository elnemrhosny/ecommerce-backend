const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: false, //true for 465 false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout : 10000 , 
});

async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  const mailOptions = {
    from: '"My Store" <noreply@mystore.com ',
    to: email,
    subject: "Please verify your email address",
    html: `
      <h1>Welcome!</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>This link will expire in 24 hours.</p>
    `,
  };
  await transporter.sendMail(mailOptions);
}

module.exports = {transporter , sendVerificationEmail};
