require('dotenv').config();
const { transporter } = require('./functions/emails'); // adjust path

(async () => {
  console.log('Testing email with host:', process.env.EMAIL_HOST, 'port:', process.env.EMAIL_PORT);
  console.log('User:', process.env.EMAIL_USER ? 'set' : 'MISSING', 'Pass:', process.env.EMAIL_PASS ? 'set' : 'MISSING');

  try {
    const info = await transporter.sendMail({
      from: '"Test" <test@test.com>',
      to: 'elnemrhosny@gmail.com',
      subject: 'Test',
      text: '7raaaam',
    });
    console.log('Email sent:', info.messageId);
  } catch (err) {
    console.error('Email error:', err);
  }
})();