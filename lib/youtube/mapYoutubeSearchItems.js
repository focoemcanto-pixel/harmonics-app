export function mapYoutubeSearchItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const videoId = item?.id?.videoId || '';

      return {
        videoId,
        title: item?.snippet?.title || '',
        channelTitle: item?.snippet?.channelTitle || '',
        thumbnail:
          item?.snippet?.thumbnails?.medium?.url ||
          item?.snippet?.thumbnails?.default?.url ||
          '',
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
      };
    })
    .filter((item) => item.videoId && item.url);
}
