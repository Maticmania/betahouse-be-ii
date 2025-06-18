import transporter from "../config/mailer.config.js";

export const sendVerificationEmail = async (email, name, token) => {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"BetaHouse" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Verify your email",
    template: "emailverification",
    context: { name, url, year: new Date().getFullYear() },
  });
};
