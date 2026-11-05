import type { ReactNode } from 'react';
import { primaryImage, imageDisplayStyle } from '@/lib/itemImages';
import { ItemImageView } from './ItemImageView';

export function ItemBanner({ collection, item, fallback }: { collection: any; item: any; fallback?: ReactNode }) {
  const fields = (collection.properties || []).filter((property: any) => property.type === 'image');
  const property = fields.find((field: any) => primaryImage(item[field.id]))
    || fields.find((field: any) => primaryImage(field.defaultImage));
  const image = property && (primaryImage(item[property.id]) || primaryImage(property.defaultImage));
  if (!image) return fields.length ? null : <>{fallback}</>;
  return <ItemImageView image={image} style={imageDisplayStyle(property.imageDisplay)} className="mb-4 block h-auto w-full shrink-0 rounded-xl" alt={image.name || 'Bannière'} />;
}
