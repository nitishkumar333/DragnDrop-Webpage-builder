/** Accepts watch / short / embed YouTube links and returns an embed URL. */
export const toYoutubeEmbed = (url: string) => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
};
