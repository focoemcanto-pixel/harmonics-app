import { Resend } from 'resend';

const EMAIL_SUBJECT = 'Redefinição de senha — Banda Harmonics';
const PROFESSIONAL_EMAIL_NOT_CONFIGURED = 'Serviço de e-mail profissional não configurado.';
const SECURITY_REPLY_TO = 'banda.harmonics@hotmail.com';

function buildPasswordResetEmailHtml({ resetLink, recipientEmail }) {
  const year = new Date().getFullYear();

  return `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#09090f;padding:24px;color:#e5e7eb;">
    <div style="max-width:560px;margin:0 auto;background:linear-gradient(145deg,rgba(67,56,202,0.2),rgba(17,24,39,0.95));border:1px solid rgba(167,139,250,0.35);border-radius:18px;padding:28px;">
      <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c4b5fd;font-weight:700;">Banda Harmonics</p>
      <h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.2;color:#fff;font-weight:800;">Redefinição de senha</h1>
      <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#d1d5db;">Olá,</p>
      <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#d1d5db;">Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color:#fde68a;">Banda Harmonics</strong>. Use o botão abaixo para criar uma nova senha com segurança.</p>
      <a href="${resetLink}" style="display:inline-block;background:linear-gradient(90deg,#8b5cf6,#6366f1);color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">Redefinir minha senha</a>
      <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#9ca3af;">Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#c4b5fd;">${resetLink}</p>
      <p style="margin:18px 0 0 0;font-size:12px;color:#6b7280;">Solicitação enviada para ${recipientEmail}. Se você não pediu redefinição de senha, ignore este e-mail e mantenha sua conta protegida.</p>
    </div>
    <p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#6b7280;text-align:center;">© ${year} Banda Harmonics</p>
  </div>
  `;
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return {
      ok: false,
      error: PROFESSIONAL_EMAIL_NOT_CONFIGURED,
      code: 'EMAIL_NOT_CONFIGURED',
    };
  }

  try {
    const resend = new Resend(resendApiKey);
    const from = fromEmail.includes('<') ? fromEmail : `Banda Harmonics <${fromEmail}>`;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: EMAIL_SUBJECT,
      html: buildPasswordResetEmailHtml({ resetLink, recipientEmail: to }),
      reply_to: SECURITY_REPLY_TO,
    });

    if (error) {
      return { ok: false, error: error.message || 'Falha ao enviar e-mail.', code: 'EMAIL_SEND_FAILED' };
    }

    return { ok: true, emailId: data?.id || null };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Falha ao enviar e-mail.',
      code: 'EMAIL_SEND_FAILED',
    };
  }
}
