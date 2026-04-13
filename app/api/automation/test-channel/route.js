import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-whatsapp-message';

export async function POST(request) {
  try {
    const body = await request.json();
    const { channelId, phone } = body;

    if (!channelId || !phone) {
      return NextResponse.json(
        { error: 'channelId e phone são obrigatórios' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Buscar canal do banco
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('whatsapp_channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
    }

    if (!channel.api_url || !channel.api_key) {
      return NextResponse.json(
        { error: 'Canal sem api_url ou api_key configurados' },
        { status: 400 }
      );
    }

    const providerResult = await sendWhatsAppMessage({
      to: phone,
      message: `✅ Teste de canal Harmonics\n\nCanal: ${channel.name}\nData: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      channel,
    });

    return NextResponse.json({
      ok: true,
      message: 'Mensagem de teste enviada com sucesso',
      provider: providerResult,
    });
  } catch (error) {
    console.error('[POST /api/automation/test-channel] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
