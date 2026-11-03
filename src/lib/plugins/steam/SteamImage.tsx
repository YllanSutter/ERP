import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ImgHTMLAttributes,
  type ReactNode,
} from 'react';
import { steamImageCandidates } from './steamUtils';
import { resolveSteamImages, steamImagesRevision, subscribeSteamImages } from './steamImages';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  appid?: number | string | null;
  variant?: 'portrait' | 'header';
  fallback?: ReactNode;
};
function SteamImageAttempt({ appid, variant = 'header', fallback = null, ...props }: Props) {
  const [stage, setStage] = useState(0);
  const [resolved, setResolved] = useState<{ portrait: string | null; header: string | null }>({
    portrait: null,
    header: null,
  });
  const [resolving, setResolving] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const candidate = steamImageCandidates(appid, variant, resolved)[stage];
  const src = candidate?.url;
  const landscapeFallback = variant === 'portrait' && candidate?.format === 'header';
  if (!src || resolving) return <>{fallback}</>;
  return (
    <img
      {...props}
      src={src}
      style={
        landscapeFallback
          ? {
              ...props.style,
              objectFit: 'contain',
              objectPosition: 'center',
              backgroundColor: '#171110',
            }
          : props.style
      }
      onError={() => {
        if (stage === 0 && appid) {
          setResolving(true);
          void resolveSteamImages(appid).then((images) => {
            if (!active.current) return;
            setResolved(images);
            setStage(1);
            setResolving(false);
          });
        } else {
          setStage((value) => value + 1);
        }
      }}
    />
  );
}
export function SteamImage(props: Props) {
  const revision = useSyncExternalStore(subscribeSteamImages, steamImagesRevision, () => '0');
  return (
    <SteamImageAttempt key={`${props.appid}:${props.variant || 'header'}:${revision}`} {...props} />
  );
}
