/** Keep legacy public images and new drafts on the same explicitly trusted HTTPS hosts. */
const IMAGE_HOSTS = new Set(['images.unsplash.com', 'upload.wikimedia.org', 'image.pollinations.ai']);

export function approvedImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).filter((item): item is string => {
    if (typeof item !== 'string' || item.length > 6000) return false;
    try {
      const url = new URL(item);
      return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname)
        && !url.username && !url.password && !url.port;
    } catch {
      return false;
    }
  });
}
