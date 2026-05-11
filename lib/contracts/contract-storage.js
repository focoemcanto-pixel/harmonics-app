const DEFAULT_CONTRACT_BUCKET = 'contract-pdfs';
const WORKSPACE_PATH_REGEX = /^workspaces\/([a-z0-9-]+)\//i;

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/');
}

function sanitizeBucketName(value) {
  const bucket = String(value || '').trim();
  return bucket || DEFAULT_CONTRACT_BUCKET;
}

export function resolveContractBucketName() {
  if (typeof window === 'undefined') {
    return sanitizeBucketName(
      process.env.SUPABASE_CONTRACTS_BUCKET ||
        process.env.NEXT_PUBLIC_SUPABASE_CONTRACTS_BUCKET ||
        DEFAULT_CONTRACT_BUCKET
    );
  }

  return sanitizeBucketName(process.env.NEXT_PUBLIC_SUPABASE_CONTRACTS_BUCKET || DEFAULT_CONTRACT_BUCKET);
}

export function extractWorkspaceIdFromStoragePath(path) {
  const normalized = normalizePath(path);
  const match = normalized.match(WORKSPACE_PATH_REGEX);
  return match?.[1] || null;
}

export function isWorkspaceScopedStoragePath(path) {
  return Boolean(extractWorkspaceIdFromStoragePath(path));
}

export function buildWorkspaceContractPath({ workspaceId, contractId, extension = 'pdf' }) {
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  const normalizedContractId = String(contractId || '').trim();
  const normalizedExtension = String(extension || 'pdf')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);

  if (!normalizedWorkspaceId) {
    throw new Error('workspaceId é obrigatório para gerar paths de contratos.');
  }

  if (!normalizedContractId) {
    throw new Error('contractId é obrigatório para gerar paths de contratos.');
  }

  return `workspaces/${normalizedWorkspaceId}/contracts/${normalizedContractId}.${normalizedExtension || 'pdf'}`;
}

export function extractContractStoragePath(pdfUrl) {
  const rawUrl = String(pdfUrl || '').trim();
  if (!rawUrl) return { bucket: null, path: null, workspaceId: null };

  try {
    const parsed = new URL(rawUrl);
    const markers = ['/storage/v1/object/public/', '/storage/v1/object/sign/'];
    const marker = markers.find((item) => parsed.pathname.includes(item));
    if (!marker) {
      return { bucket: null, path: null, workspaceId: null };
    }

    const markerIndex = parsed.pathname.indexOf(marker);
    const storagePath = parsed.pathname.slice(markerIndex + marker.length);
    const [rawBucket, ...pathParts] = storagePath.split('/').filter(Boolean);
    if (!rawBucket || pathParts.length === 0) {
      return { bucket: null, path: null, workspaceId: null };
    }

    const normalizedPath = normalizePath(
      pathParts.map((part) => decodeURIComponent(part)).join('/')
    );

    return {
      bucket: decodeURIComponent(rawBucket),
      path: normalizedPath,
      workspaceId: extractWorkspaceIdFromStoragePath(normalizedPath),
    };
  } catch {
    return { bucket: null, path: null, workspaceId: null };
  }
}

export function buildContractPublicUrl({ supabaseUrl, bucket, path }) {
  const baseUrl = String(supabaseUrl || '').trim().replace(/\/$/, '');
  const safeBucket = sanitizeBucketName(bucket || resolveContractBucketName());
  const safePath = normalizePath(path)
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');

  if (!baseUrl || !safePath) return null;
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(safeBucket)}/${safePath}`;
}

export async function createContractSignedUrl({ supabase, bucket, path, expiresIn = 60 * 30 }) {
  const safeBucket = sanitizeBucketName(bucket || resolveContractBucketName());
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

export function resolveContractStoragePath(pdfUrl, bucket = DEFAULT_CONTRACT_BUCKET) {
  const parsed = extractContractStoragePath(pdfUrl);
  if (parsed.bucket && parsed.path) return parsed;

  const fallbackPath = normalizePath(pdfUrl);
  if (!fallbackPath) {
    return { bucket: null, path: null, workspaceId: null };
  }

  return {
    bucket: sanitizeBucketName(bucket),
    path: fallbackPath,
    workspaceId: extractWorkspaceIdFromStoragePath(fallbackPath),
  };
}

export function resolveContractPreviewFromStoredUrl(storedPdfUrl, options = {}) {
  const rawStored = String(storedPdfUrl || '').trim();
  if (!rawStored) return { bucket: null, path: null, workspaceId: null, url: '' };

  const parsed = extractContractStoragePath(rawStored);
  if (parsed.bucket && parsed.path) {
    return {
      bucket: parsed.bucket,
      path: parsed.path,
      workspaceId: parsed.workspaceId,
      url: rawStored,
    };
  }

  const fallbackBucket = sanitizeBucketName(options.bucket || resolveContractBucketName());
  const fallbackPath = normalizePath(rawStored);
  const fallbackUrl = buildContractPublicUrl({
    supabaseUrl: options.supabaseUrl,
    bucket: fallbackBucket,
    path: fallbackPath,
  });

  return {
    bucket: fallbackBucket,
    path: fallbackPath,
    workspaceId: extractWorkspaceIdFromStoragePath(fallbackPath),
    url: fallbackUrl || rawStored,
  };
}
