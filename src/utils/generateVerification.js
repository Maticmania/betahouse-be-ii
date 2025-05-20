import crypto from 'crypto';

export const generateVerificationToken = () => {
  const token = crypto.randomBytes(20).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  return { token, expires };
};
