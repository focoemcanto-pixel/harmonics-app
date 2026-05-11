const DEFAULT_CONTRACT_BUCKET = 'contract-pdfs';
const WORKSPACE_PATH_REGEX = /^workspaces\/([a-z0-9-]+)\//i;

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/');
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
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return { bucket: null, path: null, workspaceId: null };
    }

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

export function resolveContractStoragePath(pdfUrl, bucket = DEFAULT_CONTRACT_BUCKET) {
  const parsed = extractContractStoragePath(pdfUrl);
  if (parsed.bucket && parsed.path) return parsed;

  const fallbackPath = normalizePath(pdfUrl);
  if (!fallbackPath) {
    return { bucket: null, path: null, workspaceId: null };
  }

  return {
    bucket,
    path: fallbackPath,
    workspaceId: extractWorkspaceIdFromStoragePath(fallbackPath),
  };
}
