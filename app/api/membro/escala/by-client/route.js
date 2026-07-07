import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error('Supabase admin não configurado.');
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return compact(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mapRowToMusician(row = {}, contact = null) {
  const contactName = contact?.name || row?.snapshot_name || row?.musician_name || '';

  return {
    id: row?.id,
    musician_id: row?.musician_id || row?.contact_id || contact?.id || null,
    role: row?.role || row?.suggested_role_name || contact?.tag || '',
    status: row?.status || 'pending',
    full_name: contactName,
    name: contactName,
    musician_name: row?.musician_name || row?.snapshot_name || contact?.name || '',
    snapshot_name: row?.snapshot_name || '',
    contact,
    notes: row?.notes || row?.message || '',
    musician_email: contact?.email || row?.email || '',
    musician_phone: contact?.phone || row?.phone || '',
    contact_tag_text: contact?.tag || '',
  };
}

async function fetchContactsByIds(supabase, ids = []) {
  const safeIds = Array.from(new Set(ids.map((id) => compact(id)).filter(Boolean)));
  if (!safeIds.length) return new Map();

  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, email, phone, tag')
    .in('id', safeIds);

  if (error) throw error;

  return new Map((data || []).map((contact) => [String(contact.id), contact]));
}

async function resolveEvent(supabase, clientName) {
  const normalizedName = normalize(clientName);
  if (!normalizedName) return null;

  const { data, error } = await supabase
    .from('events')
    .select('id, client_name, event_date, event_time')
    .order('event_date', { ascending: true });

  if (error) throw error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matches = (data || []).filter((event) => {
    const name = normalize(event?.client_name);
    return name && (name === normalizedName || name.includes(normalizedName) || normalizedName.includes(name));
  });

  if (!matches.length) return null;

  const upcoming = matches.filter((event) => {
    const date = new Date(`${event?.event_date || ''}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date >= today;
  });

  return upcoming[0] || matches[matches.length - 1] || null;
}

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const clientName = compact(url.searchParams.get('clientName'));

    if (!clientName) {
      return NextResponse.json({ ok: false, error: 'clientName é obrigatório.' }, { status: 400 });
    }

    const event = await resolveEvent(supabase, clientName);
    if (!event?.id) {
      return NextResponse.json({ ok: true, event: null, musicians: [] });
    }

    const { data: scaleRows, error: scaleError } = await supabase
      .from('event_musicians')
      .select('id, event_id, musician_id, musician_name, snapshot_name, role, status, notes')
      .eq('event_id', event.id);

    if (scaleError) throw scaleError;

    const scaleContactIds = (scaleRows || []).map((row) => row?.musician_id).filter(Boolean);
    const scaleContacts = await fetchContactsByIds(supabase, scaleContactIds);

    let musicians = (scaleRows || []).map((row) => {
      const contact = scaleContacts.get(String(row?.musician_id)) || null;
      return mapRowToMusician(row, contact);
    });

    if (!musicians.length) {
      const { data: inviteRows, error: inviteError } = await supabase
        .from('invites')
        .select('id, event_id, contact_id, suggested_role_name, message, status, sent_at, responded_at')
        .eq('event_id', event.id)
        .neq('status', 'removed');

      if (inviteError) throw inviteError;

      const inviteContactIds = (inviteRows || []).map((row) => row?.contact_id).filter(Boolean);
      const inviteContacts = await fetchContactsByIds(supabase, inviteContactIds);
      musicians = (inviteRows || []).map((row) => {
        const contact = inviteContacts.get(String(row?.contact_id)) || null;
        return mapRowToMusician(row, contact);
      });
    }

    return NextResponse.json({ ok: true, event, musicians });
  } catch (error) {
    console.error('[MEMBRO_ESCALA_BY_CLIENT][ERROR]', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Não foi possível carregar escala.' },
      { status: 500 }
    );
  }
}
