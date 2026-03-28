import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateInviteLink } from '@/lib/escalas/escalas-invite';
import fs from 'fs';
import path from 'path';

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

    // Buscar escala com dados do evento e contato
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
        ),
        contacts (id, name, email)
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
    const inviteLink = generateInviteLink(escala.invite_token);

    // Formatar data
    const eventDate = escala.events?.event_date
      ? new Date(escala.events.event_date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : 'Data não informada';

    // Carregar template HTML
    const templatePath = path.join(process.cwd(), 'templates/email/convite-escala.html');
    let htmlContent;
    try {
      htmlContent = fs.readFileSync(templatePath, 'utf-8');
    } catch {
      throw new Error('Falha ao carregar template de email: templates/email/convite-escala.html');
    }

    // Substituir placeholders
    const musicianName = escala.musician_name || escala.contacts?.name || 'Músico';
    const eventName = escala.events?.client_name || 'Evento não identificado';
    const role = escala.role || 'Sem função';
    const year = new Date().getFullYear();

    htmlContent = htmlContent
      .replace(/\{\{MUSICIAN_NAME\}\}/g, musicianName)
      .replace(/\{\{EVENT_NAME\}\}/g, eventName)
      .replace(/\{\{EVENT_DATE\}\}/g, eventDate)
      .replace(/\{\{ROLE\}\}/g, role)
      .replace(/\{\{INVITE_LINK\}\}/g, inviteLink)
      .replace(/\{\{YEAR\}\}/g, String(year));

    // Enviar email via Resend
    const resend = new Resend(resendApiKey);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Harmonics <convites@harmonics.app>',
      to: escala.musician_email,
      subject: `🎵 Convite: ${eventName} - ${eventDate}`,
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
