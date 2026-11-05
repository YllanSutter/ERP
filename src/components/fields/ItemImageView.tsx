import { createContext, useContext, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import type { ItemImage } from '@/lib/itemImages';

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;
export type ItemImageRenderer = (image: ItemImage, props: ImageProps) => ReactNode;
const RendererContext = createContext<ItemImageRenderer | undefined>(undefined);
export const ItemImageRendererProvider = RendererContext.Provider;

function ImageAttempt({ image, fallback = null, ...props }: ImageProps & { image: ItemImage; fallback?: ReactNode }) {
  const render = useContext(RendererContext);
  const [failed, setFailed] = useState(false);
  const custom = render?.(image, props);
  if (custom !== undefined) return <>{custom}</>;
  return failed ? <>{fallback}</> : <img {...props} src={image.src} onError={event => { setFailed(true); props.onError?.(event); }} />;
}
export function ItemImageView(props: ImageProps & { image: ItemImage; fallback?: ReactNode }) {
  return <ImageAttempt key={props.image.src} {...props} />;
}
