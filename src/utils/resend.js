const { Resend } = require('resend');
const env = require('../config/env');
const AppError = require('./AppError');

let resendClient = null;

function getResendClient() {
  if (!env.resendApiKey) {
    throw new AppError('RESEND_API_KEY is not configured', 500);
  }

  if (!resendClient) {
    resendClient = new Resend(env.resendApiKey);
  }

  return resendClient;
}

async function sendOtpEmail({ to, name, otp }) {
  const client = getResendClient();
  const from = env.resendFromEmail || 'onboarding@resend.dev';

  const subject = 'Your CodeVista OTP code';
  const text = `Hello ${name || 'there'},\n\nYour OTP code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 16px;">Verify your email</h2>
      <p>Hello ${name || 'there'},</p>
      <p>Your one-time password is:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; margin: 20px 0;">${otp}</div>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return client.emails.send({
    from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendOtpEmail };