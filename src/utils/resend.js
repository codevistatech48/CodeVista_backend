const { Resend } = require("resend");
const env = require("../config/env");
const AppError = require("./AppError");

let resendClient = null;

function getResendClient() {
  if (!env.resendApiKey) {
    throw new AppError("RESEND_API_KEY is not configured", 500);
  }

  if (!resendClient) {
    resendClient = new Resend(env.resendApiKey);
  }

  return resendClient;
}

async function sendOtpEmail({ to, name, otp }) {
  const client = getResendClient();
  const from = env.resendFromEmail || "onboarding@resend.dev";

  const subject = "Your CodeVista OTP Code";

  const text = `Hello ${name || "there"},

Your OTP is: ${otp}

This OTP will expire in 10 minutes.

If you didn't request this email, please ignore it.`;

  const html = `
    <div style="font-family:Arial,sans-serif;padding:20px;">
      <h2>CodeVista Email Verification</h2>
      <p>Hello ${name || "there"},</p>
      <p>Your OTP is:</p>
      <h1 style="letter-spacing:6px;">${otp}</h1>
      <p>This OTP will expire in <b>10 minutes</b>.</p>
      <p>If you didn't request this email, simply ignore it.</p>
    </div>
  `;

  try {
    const response = await client.emails.send({
      from,
      to,
      subject,
      text,
      html,
    });

    // Resend returns 200 with an error field when delivery fails
    if (response?.error) {
      const errMsg = response.error.message || "Unknown Resend error";
      throw new AppError(errMsg, 422);
    }

    return response;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error.message || "Unable to send OTP email",
      500
    );
  }
}

async function sendPasswordResetEmail({ to, name, resetLink }) {
  const client = getResendClient();
  const from = env.resendFromEmail || "onboarding@resend.dev";

  const subject = "Reset your CodeVista Password";

  const text = `
Hello ${name || "there"},

We received a request to reset your password.

Click the link below:

${resetLink}

This link expires in 1 hour.

If you didn't request this, simply ignore this email.
`;

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:40px;">
      <div style="max-width:600px;margin:auto;background:white;border-radius:10px;overflow:hidden;">

        <div style="background:#4F46E5;padding:25px;text-align:center;">
          <h1 style="color:white;margin:0;">CodeVista</h1>
        </div>

        <div style="padding:30px;">
          <h2>Reset Password</h2>
          <p>Hello <strong>${name || "there"}</strong>,</p>
          <p>We received a request to reset your password.</p>
          <p>Click the button below to create a new password.</p>

          <div style="text-align:center;margin:35px 0;">
            <a
              href="${resetLink}"
              style="
                background:#4F46E5;
                color:#fff;
                text-decoration:none;
                padding:14px 30px;
                border-radius:8px;
                display:inline-block;
                font-weight:bold;
              "
            >
              Reset Password
            </a>
          </div>

          <p>This link is valid for <b>1 hour</b>.</p>
          <p>If you didn't request a password reset, simply ignore this email.</p>

          <hr>

          <p style="font-size:12px;color:#666;">
            If the button doesn't work, copy and paste this URL into your browser:
          </p>
          <p style="font-size:12px;word-break:break-all;">
            ${resetLink}
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    const response = await client.emails.send({
      from,
      to,
      subject,
      text,
      html,
    });

    // Resend returns 200 with an error field when delivery fails
    if (response?.error) {
      const errMsg = response.error.message || "Unknown Resend error";
      throw new AppError(errMsg, 422);
    }

    return response;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error.message || "Unable to send password reset email",
      500
    );
  }
}

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail,
};