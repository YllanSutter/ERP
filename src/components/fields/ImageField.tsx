import { useRef, useState } from 'react';
import { ImagePlus, Link, Star, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemImageView } from './ItemImageView';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { SettingsPopoverContent, SettingsBody, SettingsHint } from '@/components/ui/settings-panel';
import { normalizeImageField, primaryImage, validImageSource, type ItemImage } from '@/lib/itemImages';

async function readImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) throw new Error('Choisissez une image PNG, JPEG, WebP, GIF ou AVIF.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choisissez une image de moins de 10 Mo.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossible de lire cette image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.85);
  } finally { bitmap.close(); }
}

export function ImageField({ value, defaultValue, onChange, readOnly = false, name = 'Images' }: { value: unknown; defaultValue?: unknown; onChange: (value: any) => void; readOnly?: boolean; name?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(value);
  current.current = value;
  const stored = normalizeImageField(value);
  const usingDefault = stored.images.length === 0 && normalizeImageField(defaultValue).images.length > 0;
  const data = usingDefault ? normalizeImageField(defaultValue) : stored;
  const cover = primaryImage(data);
  const append = (images: ItemImage[]) => {
    const latest = normalizeImageField(current.current);
    const next = { ...latest, images: [...latest.images, ...images], defaultImageId: latest.defaultImageId || images[0]?.id || null };
    current.current = next;
    onChange(next);
  };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="inline-flex min-h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted" aria-label={`${name} : ${data.images.length} image(s)`}>
        {cover ? <ItemImageView image={cover} alt="" className="h-8 w-14 rounded object-cover" /> : <ImagePlus size={16} className="text-muted-foreground" />}
        <span>{data.images.length ? `${data.images.length} image${data.images.length > 1 ? 's' : ''}` : readOnly ? 'Aucune image' : 'Ajouter une image'}</span>
      </button>
    </PopoverTrigger>
    <SettingsPopoverContent title={name} className="z-[450] w-[min(95vw,34rem)]" align="start">
      <SettingsBody className="max-h-[65dvh] space-y-3">
        {!readOnly && <>
          <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="sr-only" disabled={busy} onChange={async event => {
            const files = Array.from(event.target.files || []);
            event.target.value = '';
            setBusy(true); setError('');
            try {
              const images = await Promise.all(files.map(async file => ({ id: crypto.randomUUID(), name: file.name, src: await readImage(file) })));
              append(images);
            } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible de lire ces images.'); }
            finally { setBusy(false); }
          }} />
          <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={() => input.current?.click()}><Upload size={14} />{busy ? 'Ajout en cours…' : 'Importer des images'}</Button>
          <form className="flex gap-2" onSubmit={event => {
            event.preventDefault(); const src = url.trim();
            if (!validImageSource(src)) { setError('Saisissez un lien HTTP ou HTTPS valide vers une image.'); return; }
            append([{ id: crypto.randomUUID(), src }]); setUrl(''); setError('');
          }}>
            <Input aria-label="Lien de l’image" placeholder="https://cdn…/image.jpg" value={url} disabled={busy} onChange={event => setUrl(event.target.value)} />
            <Button type="submit" variant="outline" size="icon" disabled={busy || !url.trim()} aria-label="Ajouter le lien"><Link size={14} /></Button>
          </form>
          <SettingsHint>L’étoile choisit l’image principale affichée en bannière.</SettingsHint>
        </>}
        {usingDefault && <SettingsHint>Image par défaut de la propriété. Ajouter une image la remplacera pour cet objet.</SettingsHint>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        {!data.images.length && <SettingsHint>Aucune image.</SettingsHint>}
        <div className="grid grid-cols-2 gap-2">
          {data.images.map(image => <div key={image.id} className="overflow-hidden rounded-lg border border-border">
            <ItemImageView image={image} alt={image.name || 'Image'} className="h-28 w-full bg-muted object-contain" />
            <div className="flex items-center gap-1 p-1">
              <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">{image.name || 'Image'}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={readOnly || busy || usingDefault} aria-pressed={image.id === data.defaultImageId} aria-label="Définir comme image principale" onClick={() => onChange({ ...data, defaultImageId: image.id })}><Star size={14} fill={image.id === data.defaultImageId ? 'currentColor' : 'none'} /></Button>
              {!readOnly && !usingDefault && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={busy} aria-label="Supprimer l’image" onClick={() => onChange(normalizeImageField({ ...data, images: data.images.filter(entry => entry.id !== image.id) }))}><Trash2 size={14} /></Button>}
            </div>
          </div>)}
        </div>
      </SettingsBody>
    </SettingsPopoverContent>
  </Popover>;
}
