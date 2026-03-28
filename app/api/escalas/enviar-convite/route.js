import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

function getAdminSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta (Supabase)' },
        { status: 500 }
      );
    }

    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta (Resend)' },
        { status: 500 }
      );
    }

    const { escalaId } = await request.json();

    if (!escalaId) {
      return NextResponse.json(
        { error: 'escalaId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();

    // Buscar escala com dados do evento
    const { data: escala, error: escalaError } = await supabase
      .from('escalas')
      .select(`
        *,
        events (
          id,
          client_name,
          event_date,
          event_time,
          location
        )
      `)
      .eq('id', escalaId)
      .single();

    if (escalaError) throw escalaError;
    if (!escala) {
      return NextResponse.json(
        { error: 'Escala não encontrada' },
        { status: 404 }
      );
    }

    // Validar email do snapshot
    if (!escala.musician_email) {
      return NextResponse.json(
        { error: 'Músico não possui email cadastrado' },
        { status: 400 }
      );
    }

    // Gerar link do convite
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/membro/${escala.invite_token}`;

    // Formatar data
    const eventDate = escala.events?.event_date
      ? new Date(escala.events.event_date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : 'Data não informada';

    const eventTime = escala.events?.event_time || 'Horário não informado';

    // Template do email (HTML)
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite de Escala</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 40px 32px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">
        🎵 Convite de Escala
      </h1>
    </div>

    <!-- Corpo -->
    <div style="padding: 40px 32px;">
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #0f172a;">
        Olá, <strong>${escala.musician_name}</strong>!
      </p>

      <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #475569;">
        Você foi escalado(a) para participar do seguinte evento:
      </p>

      <!-- Card do Evento -->
      <div style="background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 20px; padding: 28px; margin-bottom: 32px;">
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #7c3aed; margin-bottom: 8px;">
            Evento
          </div>
          <div style="font-size: 20px; font-weight: 900; color: #0f172a;">
            ${escala.events?.client_name || 'Evento não informado'}
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px;">
            📅 Data
          </div>
          <div style="font-size: 16px; font-weight: 700; color: #1e293b;">
            ${eventDate}
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px;">
            ⏰ Horário
          </div>
          <div style="font-size: 16px; font-weight: 700; color: #1e293b;">
            ${eventTime}
          </div>
        </div>

        <div>
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px;">
            🎸 Sua função
          </div>
          <div style="font-size: 16px; font-weight: 700; color: #7c3aed;">
            ${escala.role}
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${inviteLink}"
           style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 16px; font-size: 16px; font-weight: 900; letter-spacing: 0.3px; box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3);">
          Acessar convite
        </a>
      </div>

      <p style="margin: 0; font-size: 14px; line-height: 20px; color: #64748b; text-align: center;">
        Clique no botão acima para confirmar sua participação ou enviar recusa.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">
        Harmonics • Sistema de gestão musical
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // Enviar email via Resend
    const resend = new Resend(resendApiKey);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Harmonics <convites@harmonics.app>',
      to: escala.musician_email,
      subject: `Convite de escala: ${escala.events?.client_name || 'Evento'}`,
      html: htmlContent,
    });

    if (emailError) {
      console.error('Erro ao enviar email:', emailError);
      throw new Error('Falha ao enviar email: ' + emailError.message);
    }

    // Atualizar invite_sent_at
    const { error: updateError } = await supabase
      .from('escalas')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', escalaId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Convite enviado com sucesso',
      emailId: emailData?.id,
      inviteLink,
    });

  } catch (error) {
    console.error('Erro ao enviar convite:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar convite' },
      { status: 500 }
    );
  }
}
