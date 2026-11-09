import { NextResponse } from 'next/server';
import { parseSimInput, runSimTurn } from '@/lib/ai/sim/nara-sim.mjs';

export const dynamic = 'force-dynamic';

// SIMULAÇÃO ISOLADA da assistente — somente em versão de PRÉ-VISUALIZAÇÃO (*.workers.dev), nunca no domínio
// de produção. Sem leitura/escrita no banco (banco em memória por chamada), sem WhatsApp, sem envio.
// Acesso: código secreto (aqui só o hash SHA-256), expiração fixa e limites por chamada.
const TOKEN_SHA256 = 'e1f072eb3e492a57aa5bd2f5a5525dfb3ace394554e9c8749f91882bfad776fc';
const EXPIRES_AT = Date.parse('2026-11-10T13:10:00Z');
const MAX_BODY_BYTES = 300_000;

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function sameHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const deny = (status, error) => NextResponse.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const host = String(request.headers.get('host') || new URL(request.url).host).toLowerCase();
  if (!host.endsWith('.workers.dev')) return deny(404, 'Não encontrado.');
  if (Date.now() > EXPIRES_AT) return deny(410, 'Simulação expirada.');
  const token = String(request.headers.get('x-sim-token') || '');
  if (!token || !sameHex(await sha256Hex(token), TOKEN_SHA256)) return deny(401, 'Não autorizado.');
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return deny(413, 'Entrada grande demais.');
  let body;
  try { body = JSON.parse(raw); } catch { return deny(400, 'JSON inválido.'); }
  const parsed = parseSimInput(body);
  if (!parsed.ok) return deny(400, parsed.error);
  // Só a chave do modelo vem do ambiente; nenhum outro segredo ou dado de produção é usado.
  const env = { OPENAI_API_KEY: process.env.OPENAI_API_KEY || '', AI_INBOX_MODEL: process.env.AI_INBOX_MODEL || '' };
  if (!env.OPENAI_API_KEY) return deny(503, 'Chave do modelo não configurada nesta versão.');
  try {
    const result = await runSimTurn(parsed.input, { env });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return deny(502, `Falha na simulação: ${String(error?.message || 'erro').slice(0, 120)}`);
  }
}

export async function GET() { return deny(405, 'Use POST.'); }
