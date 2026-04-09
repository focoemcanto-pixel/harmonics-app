export function getYoutubeVideoId(url) {
  if (!url) return '';

  try {
    const parsed = new URL(String(url).trim());
    const hostname = parsed.hostname.replace('www.', '').toLowerCase();

    if (hostname.includes('youtube.com')) {
      const fromQuery = parsed.searchParams.get('v') || '';
      if (fromQuery) return fromQuery.trim();

      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.replace('/embed/', '').split('/')[0].trim();
      }

      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.replace('/shorts/', '').split('/')[0].trim();
      }
    }

    if (hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '').split('/')[0].trim();
    }

    return '';
  } catch {
    return '';
  }
}
