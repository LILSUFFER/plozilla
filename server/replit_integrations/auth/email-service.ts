import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn("SMTP not configured. Email sending will be simulated.");
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      return transporter;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

function getAppDomain(): string {
  if (process.env.APP_DOMAIN) return process.env.APP_DOMAIN;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5000";
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@plozilla.com";
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const domain = getAppDomain();
  const verifyUrl = `${domain}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #333;">Plozilla — Email Verification</h2>
      <p>Click the button below to verify your email address:</p>
      <a href="${verifyUrl}" 
         style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Verify Email
      </a>
      <p style="margin-top: 16px; color: #666; font-size: 13px;">
        Or copy this link: <br/>${verifyUrl}
      </p>
      <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
    </div>
  `;

  const transport = getTransporter();
  const info = await transport.sendMail({
    from: getFromAddress(),
    to: email,
    subject: "Plozilla — Verify your email",
    html,
  });

  if (!process.env.SMTP_HOST) {
    console.log("=== SIMULATED VERIFICATION EMAIL ===");
    console.log(`To: ${email}`);
    console.log(`Verify URL: ${verifyUrl}`);
    console.log("====================================");
  }
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const domain = getAppDomain();
  const resetUrl = `${domain}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #333;">Plozilla — Password Reset</h2>
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}"
         style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Reset Password
      </a>
      <p style="margin-top: 16px; color: #666; font-size: 13px;">
        Or copy this link: <br/>${resetUrl}
      </p>
      <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
  `;

  const transport = getTransporter();
  await transport.sendMail({
    from: getFromAddress(),
    to: email,
    subject: "Plozilla — Reset your password",
    html,
  });

  if (!process.env.SMTP_HOST) {
    console.log("=== SIMULATED PASSWORD RESET EMAIL ===");
    console.log(`To: ${email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log("======================================");
  }
}
