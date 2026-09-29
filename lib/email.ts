import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  return resend.emails.send({
    from: "Certify <onboarding@resend.dev>",
    to,
    subject: "Reset your Certify password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Click the link below to reset your Certify password. This link expires in 30 minutes.</p>
        <a href="${resetLink}" style="display:inline-block;background:#6C63FF;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;margin-top:12px;">Reset Password</a>
        <p style="color:#888;font-size:13px;margin-top:20px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
