import React, { useMemo, useState } from 'react';
import { getSteamImageUrl } from '@/lib/plugins/steam/steamUtils';

interface SteamCardFullArtProps {
  item: any;
  steamProperty?: any;
  properties: any[];
  onViewDetail: (item: any) => void;
}

const getDisplayValue = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map(getDisplayValue).filter(Boolean).join(' · ');
  if (typeof value === 'object') {
    return getDisplayValue(value.label ?? value.name ?? value.title ?? value.value ?? value.id);
  }
  return String(value);
};

const getOption = (property: any, value: any) => {
  const raw = Array.isArray(value) ? value[0] : value;
  return (property?.options || []).find((option: any) =>
    String(typeof option === 'string' ? option : option?.value) === String(raw)
  );
};

const getAppId = (value: any): string | number | null => {
  if (typeof value === 'object' && value) return value.appid ?? value.id ?? null;
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) return value;
  return null;
};

const SteamCardFullArt: React.FC<SteamCardFullArtProps> = ({
  item,
  steamProperty,
  properties,
  onViewDetail,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const steamValue = steamProperty ? item?.[steamProperty.id] : null;
  const appid = getAppId(steamValue);
  const imageUrl = getSteamImageUrl(appid, 'header');
  const title = getDisplayValue(steamValue) || getDisplayValue(item?.name) || getDisplayValue(item?.title) || 'Sans titre';

  const badges = useMemo(
    () => properties
      .filter((property) => ['select', 'multiselect', 'multi_select', 'checkbox'].includes(property.type))
      .map((property) => {
        const value = item?.[property.id];
        const label = getDisplayValue(value);
        if (!label) return null;
        const option = getOption(property, value);
        return {
          id: property.id,
          label: property.name,
          value: label,
          color: typeof option === 'object' ? option?.color : undefined,
        };
      })
      .filter(Boolean)
      .slice(0, 2),
    [item, properties]
  );

  const stats = useMemo(
    () => properties
      .filter((property) => property.type === 'number')
      .map((property) => ({ id: property.id, label: property.name, value: getDisplayValue(item?.[property.id]) }))
      .filter((stat) => stat.value)
      .slice(0, 3),
    [item, properties]
  );

  const metadata = useMemo(
    () => properties
      .filter((property) => !['steam', 'select', 'multiselect', 'multi_select', 'checkbox', 'number', 'richtext'].includes(property.type))
      .map((property) => ({ id: property.id, label: property.name, value: getDisplayValue(item?.[property.id]) }))
      .filter((entry) => entry.value)
      .slice(0, 2),
    [item, properties]
  );

  return (
    <article
      className="group relative aspect-[1.65/1] min-h-[190px] overflow-hidden rounded-xl border border-amber-500/60 bg-neutral-950 shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(0,0,0,0.4)]"
      onClick={() => onViewDetail(item)}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#7c2d12,#171717_55%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
        <span className="rounded-full border border-amber-300/70 bg-black/65 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-100">
          Steam card
        </span>
        {appid && <span className="rounded-full bg-black/65 px-2 py-1 text-[9px] text-white/80">#{appid}</span>}
      </div>
      <div className="absolute inset-x-3 bottom-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-lg font-black uppercase leading-tight tracking-wide text-white drop-shadow-lg">
              {title}
            </h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {badges.map((badge: any) => (
                <span
                  key={badge.id}
                  className="rounded border border-white/30 bg-black/55 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white"
                  style={badge.color ? { borderColor: `${badge.color}99`, color: badge.color } : undefined}
                >
                  {badge.value}
                </span>
              ))}
            </div>
          </div>
          {stats.length > 0 && (
            <div className="flex shrink-0 gap-1.5">
              {stats.map((stat) => (
                <div key={stat.id} className="min-w-10 rounded border border-amber-200/50 bg-black/65 px-1.5 py-1 text-center">
                  <div className="text-sm font-bold text-amber-100">{stat.value}</div>
                  <div className="max-w-14 truncate text-[8px] uppercase text-white/60">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {metadata.length > 0 && (
          <div className="mt-2 flex gap-3 truncate border-t border-white/20 pt-1.5 text-[9px] uppercase tracking-wide text-white/65">
            {metadata.map((entry) => <span key={entry.id} className="truncate">{entry.label}: {entry.value}</span>)}
          </div>
        )}
      </div>
    </article>
  );
};

export default SteamCardFullArt;
