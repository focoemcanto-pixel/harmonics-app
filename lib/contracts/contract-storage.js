const DEFAULT_CONTRACT_BUCKET = 'contract-pdfs';

export function extractContractStoragePath(pdfUrl) {
  const rawUrl = String(pdfUrl || '').trim();
  if (!rawUrl) return { bucket: null, path: null };

  try {
    const parsed = new URL(rawUrl);
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return { bucket: null, path: null };

    const storagePath = parsed.pathname.slice(markerIndex + marker.length);
    const [rawBucket, ...pathParts] = storagePath.split('/').filter(Boolean);
    if (!rawBucket || pathParts.length === 0) return { bucket: null, path: null };

    return {
      bucket: decodeURIComponent(rawBucket),
      path: pathParts.map((part) => decodeURIComponent(part)).join('/'),
    };
  } catch {
    return { bucket: null, path: null };
  }
}

export function resolveContractStoragePath(pdfUrl, bucket = DEFAULT_CONTRACT_BUCKET) {
  const parsed = extractContractStoragePath(pdfUrl);
  if (parsed.bucket && parsed.path) return parsed;

  const fallbackPath = String(pdfUrl || '').trim().replace(/^\/+/, '');
  if (!fallbackPath) return { bucket: null, path: null };
  return { bucket, path: fallbackPath };
}
