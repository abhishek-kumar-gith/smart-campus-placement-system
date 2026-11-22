const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('./logger');

const createTransporter = () => {
  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    logger.warn('Email credentials not configured. Emails will be logged only.');
    return null;
  }
  return nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
  });
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  if (!transporter) {
    logger.info(`[EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
    return { delivered: false, skipped: true };
  }
  try {
    const info = await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { delivered: true, skipped: false };
  } catch (err) {
    logger.error(`Failed to send email to ${to}: ${err.message}`);
    return { delivered: false, skipped: false, error: err.message };
  }
};

const sendOtpEmail = (to, otp) => sendEmail({
  to,
  subject: 'Verify your Campus Placement account',
  html: `<div style="font-family:Arial,sans-serif;color:#1f2937"><h2>Smart Campus Placement</h2><p>Use the following 6-digit OTP to complete registration:</p><div style="font-size:28px;font-weight:bold;letter-spacing:8px;color:#1d4ed8">${otp}</div><p>This OTP expires in 10 minutes.</p><p>If you did not request this registration, you can ignore this email.</p></div>`,
});

const sendVerificationEmail = (to, token) => {
  const url = `${env.FRONTEND_URL}/verify-email/${token}`;
  return sendEmail({
    to, subject: 'Verify your Campus Placement Account',
    html: `<h2>Welcome to Campus Placement System</h2><p>Verify your email:</p><a href="${url}" style="background:#1e40af;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">Verify Email</a><p>Link expires in 24 hours.</p>`,
  });
};

const sendPasswordResetEmail = (to, token) => {
  const url = `${env.FRONTEND_URL}/reset-password/${token}`;
  return sendEmail({
    to, subject: 'Reset your Campus Placement Password',
    html: `<h2>Password Reset</h2><p>Click to reset your password:</p><a href="${url}" style="background:#dc2626;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">Reset Password</a><p>Expires in 1 hour.</p>`,
  });
};

const sendNotificationEmail = (to, subject, html) => sendEmail({ to, subject, html });

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendNotificationEmail, sendOtpEmail };
