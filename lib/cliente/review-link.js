export function buildClientReviewLink(token, baseUrlInput) {
  const tokenValue = String(token || '').trim();
  if (!tokenValue) return '';

  const baseUrl = String(
    baseUrlInput ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      'https://app.bandaharmonics.com'
  )
    .trim()
    .replace(/\/+$/, '');

  return `${baseUrl}/cliente/${encodeURIComponent(tokenValue)}/review`;
}
