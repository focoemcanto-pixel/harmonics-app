const DEFAULT_PAYMENT_PROOFS_BUCKET = 'payment-proofs';

function sanitizeBucketName(value) {
  const bucket = String(value || '').trim();
  return bucket || DEFAULT_PAYMENT_PROOFS_BUCKET;
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

export function extractBucketAndPathFromProofUrl(proofUrl) {
  if (!proofUrl) return { bucket: null, path: null };

  try {
    const parsed = new URL(proofUrl);
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return { bucket: null, path: null };

    const storagePath = parsed.pathname.slice(markerIndex + marker.length);
    const [rawBucket, ...rawPathParts] = storagePath.split('/').filter(Boolean);
    if (!rawBucket || rawPathParts.length === 0) return { bucket: null, path: null };

    return {
      bucket: decodeURIComponent(rawBucket),
      path: rawPathParts.map((part) => decodeURIComponent(part)).join('/'),
    };
  } catch {
    return { bucket: null, path: null };
  }
}

export function buildPaymentProofPublicUrl({ supabaseUrl, bucket, path }) {
  const baseUrl = String(supabaseUrl || '').trim().replace(/\/$/, '');
  const safeBucket = sanitizeBucketName(bucket);
  const safePath = String(path || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');

  if (!baseUrl || !safePath) return null;

  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(safeBucket)}/${safePath}`;
}

export function resolveProofPreviewFromStoredUrl(storedProofUrl, options = {}) {
  const rawStored = String(storedProofUrl || '').trim();
  if (!rawStored) return { bucket: null, path: null, url: '' };

  const parsed = extractBucketAndPathFromProofUrl(rawStored);
  if (parsed.bucket && parsed.path) {
    return {
      bucket: parsed.bucket,
      path: parsed.path,
      url: rawStored,
    };
  }

  const fallbackBucket = sanitizeBucketName(options.bucket || resolvePaymentProofBucketName());
  const fallbackPath = rawStored.replace(/^\/+/, '');
  const fallbackUrl = buildPaymentProofPublicUrl({
    supabaseUrl: options.supabaseUrl,
    bucket: fallbackBucket,
    path: fallbackPath,
  });

  return {
    bucket: fallbackBucket,
    path: fallbackPath,
    url: fallbackUrl || rawStored,
  };
}
