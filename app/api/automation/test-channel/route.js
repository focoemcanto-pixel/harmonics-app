import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-whatsapp-message';
import { validateChannelConfig } from '@/lib/whatsapp/channel-config';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';

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
    const workspace = await getDefaultWorkspaceSettings();

    // Buscar canal do banco respeitando workspace atual
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('whatsapp_channels')
      .select('*')
      .eq('id', channelId)
      .eq('workspace_id', workspace.id)
      .single();

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
    }

    const validation = validateChannelConfig(channel);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: `Canal inválido para envio. Faltando: ${validation.missing.join(', ')}` },
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
