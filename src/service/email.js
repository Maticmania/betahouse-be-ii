// src/services/email.js
import nodemailer from 'nodemailer';
import { engine } from 'express-handlebars';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Configure Handlebars
const hbs = engine({
  extname: '.hbs',
  layoutsDir: path.join(__dirname, '../templates'),
  defaultLayout: false,
});

const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${token}`;
  const template = await readFile(path.join(__dirname, '../templates/verification.hbs'), 'utf-8');
  const html = await hbs.renderView(template, { name: user.profile.name, verificationUrl });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Verify Your Email',
    html,
  });
};

const sendNotificationEmail = async (to, subject, content) => {
  const template = await readFile(path.join(__dirname, '../templates/notification.hbs'), 'utf-8');
  const html = await hbs.renderView(template, { content });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
};

export { sendVerificationEmail, sendNotificationEmail };