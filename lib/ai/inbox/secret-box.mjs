/**
 * Criptografia de credenciais de canal (AES-256-GCM, WebCrypto).
 * A chave fica APENAS no ambiente do servidor (AI_CHANNEL_ENCRYPTION_KEY, base64 de 32 bytes);
 * o banco guarda só "v1:<iv>:<ciphertext>". Sem chave: falha fechada.
 */
const PREFIX = 'v1';

function b64encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64decode(text) {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function importKey(rawKey) {
  const keyText = String(rawKey || '').trim();
  if (!keyText) throw new Error('AI_CHANNEL_ENCRYPTION_KEY ausente');
  const bytes = b64decode(keyText);
  if (bytes.length !== 32) throw new Error('AI_CHANNEL_ENCRYPTION_KEY deve ter 32 bytes (base64)');
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plainText, rawKey = process.env.AI_CHANNEL_ENCRYPTION_KEY) {
  const key = await importKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plainText)));
  return `${PREFIX}:${b64encode(iv)}:${b64encode(new Uint8Array(cipher))}`;
}

export async function decryptSecret(boxed, rawKey = process.env.AI_CHANNEL_ENCRYPTION_KEY) {
  const [prefix, ivText, cipherText] = String(boxed || '').split(':');
  if (prefix !== PREFIX || !ivText || !cipherText) throw new Error('Credencial em formato inválido');
  const key = await importKey(rawKey);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(ivText) }, key, b64decode(cipherText));
  return new TextDecoder().decode(plain);
}

export function maskSecret(value) {
  const text = String(value || '');
  return text ? `••••${text.slice(-4)}` : '';
}
