export interface ItemImage {
  id: string;
  src: string;
  name?: string;
  source?: string;
  steamAppId?: number;
}
export interface ImageFieldValue { images: ItemImage[]; defaultImageId: string | null; autoSources?: Record<string, number> }

export function generateImageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function validImageSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (/^data:image\/(png|jpeg|webp|gif|avif);base64,/i.test(value)) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}

export function normalizeImageField(value: unknown): ImageFieldValue {
  const raw = typeof value === 'string' ? [value] : Array.isArray(value) ? value : (value as any)?.images;
  const images: ItemImage[] = [];
  for (const [index, entry] of (Array.isArray(raw) ? raw : []).entries()) {
    const image = typeof entry === 'string' ? { src: entry } : entry;
    if (!image || !validImageSource(image.src)) continue;
    const id = typeof image.id === 'string' ? image.id : `image-${index}`;
    if (!images.some(existing => existing.id === id)) images.push({ ...image, id });
  }
  const preferred = (value as any)?.defaultImageId;
  return { images, defaultImageId: images.some(image => image.id === preferred) ? preferred : images[0]?.id || null, ...((value as any)?.autoSources ? { autoSources: { ...(value as any).autoSources } } : {}) };
}

export function primaryImage(value: unknown): ItemImage | null {
  const normalized = normalizeImageField(value);
  return normalized.images.find(image => image.id === normalized.defaultImageId) || null;
}

export function imageDisplayStyle(display: any = {}) {
  const fits = ['contain', 'cover', 'fill', 'none', 'scale-down'] as const;
  const fit = fits.includes(display.fit) ? display.fit as typeof fits[number] : 'contain';
  const positiveSize = (value: unknown) => {
    const size = Number(value);
    return Number.isFinite(size) && size > 0 ? size : undefined;
  };
  return { objectFit: fit, maxWidth: positiveSize(display.maxWidth), maxHeight: positiveSize(display.maxHeight) };
}
