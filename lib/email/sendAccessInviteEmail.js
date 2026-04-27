import { Resend } from 'resend';

const EMAIL_SUBJECT = 'Seu acesso ao Banda Harmonics foi liberado';
const PROFESSIONAL_EMAIL_NOT_CONFIGURED = 'Serviço de e-mail profissional não configurado.';

function buildInviteEmailHtml({ inviteLink, recipientEmail }) {
  const year = new Date().getFullYear();

  return `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#09090f;padding:24px;color:#e5e7eb;">
    <div style="max-width:560px;margin:0 auto;background:linear-gradient(145deg,rgba(67,56,202,0.2),rgba(17,24,39,0.95));border:1px solid rgba(167,139,250,0.35);border-radius:18px;padding:28px;">
      <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c4b5fd;font-weight:700;">Banda Harmonics</p>
      <h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.2;color:#fff;font-weight:800;">Seu acesso administrativo foi liberado</h1>
      <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#d1d5db;">Olá,</p>
      <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#d1d5db;">Seu perfil de administrador no <strong style="color:#fde68a;">Banda Harmonics</strong> já está disponível. Clique no botão abaixo para definir sua senha de primeiro acesso com segurança.</p>
      <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(90deg,#8b5cf6,#6366f1);color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">Criar senha e acessar painel</a>
      <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#9ca3af;">Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#c4b5fd;">${inviteLink}</p>
      <p style="margin:18px 0 0 0;font-size:12px;color:#6b7280;">Este convite foi enviado para ${recipientEmail}. Se você não solicitou este acesso, ignore este e-mail.</p>
    </div>
    <p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#6b7280;text-align:center;">© ${year} Banda Harmonics</p>
  </div>
  `;
}

export async function sendAccessInviteEmail({ to, inviteLink }) {
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
    const from = fromEmail.includes('<')
      ? fromEmail
      : `Banda Harmonics <${fromEmail}>`;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: EMAIL_SUBJECT,
      html: buildInviteEmailHtml({ inviteLink, recipientEmail: to }),
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
