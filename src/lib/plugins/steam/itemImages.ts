import { normalizeImageField } from '@/lib/itemImages';
import { getSteamAppId, getSteamImageUrl } from './steamUtils';

/** Fill only Steam-owned images; manual images and the selected cover survive updates. */
export function prepareSteamItem(collection: any, item: any) {
  const steam = collection?.properties?.find((property: any) => property.type === 'steam');
  const imageFields = (collection?.properties || []).filter((property: any) => property.type === 'image');
  const configured = collection?.plugins?.steam?.imagePropertyId;
  const target = imageFields.find((property: any) => property.id === configured) || imageFields[0];
  if (!steam || !target || configured === 'none') return item;
  const appid = getSteamAppId(item[steam.id]);
  const data = normalizeImageField(item[target.id]);
  const previous = data.images.find(image => image.source === 'steam');
  if (!appid && !previous) return item;
  if (appid && (previous?.steamAppId === appid || data.autoSources?.steam === appid)) return item;
  const images = data.images.filter(image => image.source !== 'steam');
  if (appid) images.push({ id: 'steam-cover', src: getSteamImageUrl(appid, 'header')!, name: 'Steam', source: 'steam', steamAppId: appid });
  const next = normalizeImageField({ images, defaultImageId: data.defaultImageId, autoSources: { ...data.autoSources, steam: appid || 0 } });
  return { ...item, [target.id]: next };
}
