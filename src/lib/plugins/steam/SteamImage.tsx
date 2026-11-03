import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ImgHTMLAttributes,
  type ReactNode,
} from 'react';
import { getSteamImageUrl } from './steamUtils';
import { resolveSteamHeader, steamImagesRevision, subscribeSteamImages } from './steamImages';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  appid?: number | string | null;
  variant?: 'portrait' | 'header';
  fallback?: ReactNode;
};
function SteamImageAttempt({ appid, variant = 'header', fallback = null, ...props }: Props) {
  const [stage, setStage] = useState(0);
  const [header, setHeader] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const candidates = [
    ...new Set(
      [getSteamImageUrl(appid, variant), header, getSteamImageUrl(appid, 'header')].filter(
        (url): url is string => !!url,
      ),
    ),
  ];
  const src = candidates[stage];
  if (!src || resolving) return <>{fallback}</>;
  return (
    <img
      {...props}
      src={src}
      onError={() => {
        if (stage === 0 && appid) {
          setResolving(true);
          void resolveSteamHeader(appid).then((url) => {
            if (!active.current) return;
            setHeader(url);
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
