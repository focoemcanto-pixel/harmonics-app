const DEFAULT_PAYMENT_PROOFS_BUCKET = 'payment-proofs';
const WORKSPACE_PATH_REGEX = /^workspaces\/([a-z0-9-]+)\//i;

function sanitizeBucketName(value) {
  const bucket = String(value || '').trim();
  return bucket || DEFAULT_PAYMENT_PROOFS_BUCKET;
}

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/');
}

export function resolvePaymentProofBucketName() {
  if (typeof window === 'undefined') {
    return sanitizeBucketName(
      process.env.SUPABASE_PAYMENT_PROOFS_BUCKET ||
        process.env.NEXT_PUBLIC_SUPABASE_PAYMENT_PROOFS_BUCKET
    );
  }

  return sanitizeBucketName(process.env.NEXT_PUBLIC_SUPABASE_PAYMENT_PROOFS_BUCKET);
}

export function extractWorkspaceIdFromPaymentProofPath(path) {
  const normalized = normalizePath(path);
  const match = normalized.match(WORKSPACE_PATH_REGEX);
  return match?.[1] || null;
}

export function isWorkspaceScopedPaymentProofPath(path) {
  return Boolean(extractWorkspaceIdFromPaymentProofPath(path));
}

export function buildWorkspacePaymentProofPath({ workspaceId, eventId, fileName }) {
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  const normalizedEventId = String(eventId || '').trim();
  const normalizedFileName = normalizePath(fileName || `${Date.now()}-payment-proof.bin`)
    .split('/')
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '-') || `${Date.now()}-payment-proof.bin`;

  if (!normalizedWorkspaceId) {
    throw new Error('workspaceId é obrigatório para gerar paths de comprovantes.');
  }

  if (!normalizedEventId) {
    throw new Error('eventId é obrigatório para gerar paths de comprovantes.');
  }

  return `workspaces/${normalizedWorkspaceId}/events/${normalizedEventId}/payments/${normalizedFileName}`;
}

export function extractBucketAndPathFromProofUrl(proofUrl) {
  if (!proofUrl) return { bucket: null, path: null, workspaceId: null };

  try {
    const parsed = new URL(proofUrl);
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return { bucket: null, path: null, workspaceId: null };

    const storagePath = parsed.pathname.slice(markerIndex + marker.length);
    const [rawBucket, ...rawPathParts] = storagePath.split('/').filter(Boolean);
    if (!rawBucket || rawPathParts.length === 0) return { bucket: null, path: null, workspaceId: null };

    const path = normalizePath(rawPathParts.map((part) => decodeURIComponent(part)).join('/'));

    return {
      bucket: decodeURIComponent(rawBucket),
      path,
      workspaceId: extractWorkspaceIdFromPaymentProofPath(path),
    };
  } catch {
    return { bucket: null, path: null, workspaceId: null };
  }
}

export function buildPaymentProofPublicUrl({ supabaseUrl, bucket, path }) {
  const baseUrl = String(supabaseUrl || '').trim().replace(/\/$/, '');
  const safeBucket = sanitizeBucketName(bucket);
  const safePath = normalizePath(path)
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');

  if (!baseUrl || !safePath) return null;

  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(safeBucket)}/${safePath}`;
}

export async function createPaymentProofSignedUrl({ supabase, bucket, path, expiresIn = 60 * 30 }) {
  const safeBucket = sanitizeBucketName(bucket || resolvePaymentProofBucketName());
  const safePath = normalizePath(path);

  if (!supabase || !safePath) {
    return { url: '', error: new Error('Supabase e path são obrigatórios para signed URL.') };
  }

  const { data, error } = await supabase.storage
    .from(safeBucket)
    .createSignedUrl(safePath, expiresIn);

  return {
    url: data?.signedUrl || '',
    error: error || null,
  };
}

export function resolveProofPreviewFromStoredUrl(storedProofUrl, options = {}) {
  const rawStored = String(storedProofUrl || '').trim();
  if (!rawStored) return { bucket: null, path: null, workspaceId: null, url: '' };

  const parsed = extractBucketAndPathFromProofUrl(rawStored);
  if (parsed.bucket && parsed.path) {
    return {
      bucket: parsed.bucket,
      path: parsed.path,
      workspaceId: parsed.workspaceId,
      url: rawStored,
    };
  }

  const fallbackBucket = sanitizeBucketName(options.bucket || resolvePaymentProofBucketName());
  const fallbackPath = normalizePath(rawStored);
  const fallbackUrl = buildPaymentProofPublicUrl({
    supabaseUrl: options.supabaseUrl,
    bucket: fallbackBucket,
    path: fallbackPath,
  });

  return {
    bucket: fallbackBucket,
    path: fallbackPath,
    workspaceId: extractWorkspaceIdFromPaymentProofPath(fallbackPath),
    url: fallbackUrl || rawStored,
  };
}
