// src/services/email.js
import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required ENV variables
const requiredEnv = [
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'BASE_URL',
];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

// Create the transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send verification email
export const sendVerificationEmail = async (user, token) => {
  const templatePath = path.join(__dirname, '../templates/verification.hbs');
  const source = await readFile(templatePath, 'utf-8');
  const template = handlebars.compile(source);

  const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${token}`;
  const html = template({
    name: user?.profile?.name || 'there',
    verificationUrl,
  });

  return transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'BetaHouse'}" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Verify Your Email',
    html,
  });
};

// Send general notification email
export const sendNotificationEmail = async (to, subject, content) => {
  const templatePath = path.join(__dirname, '../templates/notification.hbs');
  const source = await readFile(templatePath, 'utf-8');
  const template = handlebars.compile(source);
  const html = template({ content });

  return transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'BetaHouse'}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
