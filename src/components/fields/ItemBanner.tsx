import type { ReactNode } from 'react';
import { primaryImage, type ItemImage } from '@/lib/itemImages';
import { ItemImageView } from './ItemImageView';

export function ItemBanner({ collection, item, fallback }: { collection: any; item: any; fallback?: ReactNode }) {
  const fields = (collection.properties || []).filter((property: any) => property.type === 'image');
  const images = fields.map((property: any) => primaryImage(item[property.id])).filter(Boolean) as ItemImage[];
  const defaults = fields.map((property: any) => primaryImage(property.defaultImage)).filter(Boolean) as ItemImage[];
  const image = images[0] || defaults[0];
  if (!image) return fields.length ? null : <>{fallback}</>;
  return <ItemImageView image={image} className="mb-4 block h-auto w-full shrink-0 rounded-xl" alt={image.name || 'Bannière'} />;
}
