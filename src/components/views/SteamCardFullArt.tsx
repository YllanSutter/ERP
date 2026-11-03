import { getSteamAppId } from '@/lib/plugins/steam/steamUtils';
import React, { useId, useMemo, useState } from 'react';
import { SteamImage } from '@/lib/plugins/steam/SteamImage';
import * as Icons from 'lucide-react';
import EditableProperty from '@/components/fields/EditableProperty';
import { OptionTags } from '@/components/inputs/OptionTags';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface SteamCardFullArtProps {
  item: any;
  steamProperty?: any;
  styleProperty?: any;
  iconProperty?: any;
  fieldPlacements?: Record<string, string>;
  fullArt?: boolean;
  density?: 'compact' | 'comfortable' | 'spacious';
  properties: any[];
  onViewDetail: (item: any) => void;
  onEdit: (item: any) => void;
  canEdit: boolean;
  canEditField: (fieldId: string) => boolean;
  collections: any[];
  collection: any;
  onRelationChange: (property: any, item: any, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  selected: boolean;
  onSelectionChange: (itemId: string, checked: boolean) => void;
  draggable: boolean;
  isDragging: boolean;
  onDragStart: (itemId: string) => void;
  onDragEnd: () => void;
  onDropOnItem: (itemId: string) => void;
}

// Everything is drawn in a 500x700 box: the card's aspect is fixed to 5/7, so circles stay round.
const SERIF = "'Cinzel', 'Trajan Pro', 'Cormorant Garamond', Georgia, serif";
const FRAME = 'M30 12H470A18 18 0 0 0 488 30V670A18 18 0 0 0 470 688H30A18 18 0 0 0 12 670V30A18 18 0 0 0 30 12Z';
const TEXT_TYPES_EXCLUDED = ['steam', 'select', 'multiselect', 'multi_select', 'checkbox', 'number', 'richtext'];

const getDisplayValue = (value: any): string => {
  if (value === null || value === undefined || value === '' || value === false) return '';
  if (value === true) return 'Oui';
  if (Array.isArray(value)) return value.map(getDisplayValue).filter(Boolean).join(' · ');
  if (typeof value === 'object') {
    return getDisplayValue(value.label ?? value.name ?? value.title ?? value.value ?? value.id);
  }
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

const starPath = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.45 : r;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${i ? 'L' : 'M'}${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join('') + 'Z';

const sparklePath = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x + 1} ${y - 1} ${x + r} ${y}Q${x + 1} ${y + 1} ${x} ${y + r}Q${x - 1} ${y + 1} ${x - r} ${y}Q${x - 1} ${y - 1} ${x} ${y - r}Z`;

const diamondPath = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`;

const RAYS = [40, 65, 90, 115, 140].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return `M${250 + 34 * Math.cos(a)} ${27 + 34 * Math.sin(a)}L${250 + 46 * Math.cos(a)} ${27 + 46 * Math.sin(a)}`;
}).join('');

const SteamCardFullArt: React.FC<SteamCardFullArtProps> = ({
  item,
  steamProperty,
  styleProperty,
  iconProperty,
  fieldPlacements = {},
  fullArt = true,
  density = 'comfortable',
  properties,
  onViewDetail,
  onEdit,
  canEdit,
  canEditField,
  collections,
  collection,
  onRelationChange,
  onNavigateToCollection,
  selected,
  onSelectionChange,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOnItem,
}) => {
  const [editing, setEditing] = useState(false);
  const uid = useId().replace(/:/g, '');
  const steamValue = steamProperty ? item?.[steamProperty.id] : null;
  const appid = getSteamAppId(steamValue);
  const title = getDisplayValue(steamValue) || getDisplayValue(item?.name) || getDisplayValue(item?.title) || 'Sans titre';

  const { header, description, footer, tags } = useMemo(() => {
    const filled = properties
      .filter((property) => property.type !== 'steam' && property.id !== steamProperty?.id && fieldPlacements[property.id] !== 'hidden')
      .map((property) => ({ property, value: getDisplayValue(item?.[property.id]) }))
      .filter((entry) => entry.value);
    const inZone = (zone: string, fallback: boolean) => filled.filter((entry) => fieldPlacements[entry.property.id] === zone || (!fieldPlacements[entry.property.id] && fallback));
    const tagEntries = inZone('tags', false).concat(filled.filter((entry) => !fieldPlacements[entry.property.id] && ['select', 'multiselect', 'multi_select'].includes(entry.property.type)));
    return {
      header: inZone('header', false),
      description: inZone('description', true),
      footer: inZone('footer', false),
      tags: tagEntries.map((entry) => ({ property: entry.property, value: item?.[entry.property.id] })),
    };
  }, [fieldPlacements, item, properties, steamProperty?.id]);

  // Frame colour and badge icon come from the item's option in the view's style field.
  const styleValue = styleProperty ? item?.[styleProperty.id] : undefined;
  const styleOption = (styleProperty?.options || []).find((option: any) =>
    typeof option === 'object' && String(option.value) === String(Array.isArray(styleValue) ? styleValue[0] : styleValue)
  );
  const StyleIcon: React.ElementType | null = (styleOption?.icon && (Icons as any)[styleOption.icon]) || null;
  const iconValue = iconProperty ? item?.[iconProperty.id] : undefined;
  const iconOption = (iconProperty?.options || []).find((option: any) =>
    typeof option === 'object' && String(option.value) === String(Array.isArray(iconValue) ? iconValue[0] : iconValue)
  );
  const IconFieldIcon: React.ElementType | null = (iconOption?.icon && (Icons as any)[iconOption.icon]) || null;
  const BadgeIcon = IconFieldIcon || StyleIcon;
  const descriptionGap = density === 'compact' ? 'gap-[1.4cqw]' : density === 'spacious' ? 'gap-[3.8cqw]' : 'gap-[2.6cqw]';

  // The title banner rises to make room for the extra fields.
  const lift = Math.min(Math.ceil((description.length + footer.length) / 2), 5) * 18;
  const T = 557 - lift;
  const B = T + 40;
  const titleSize = Math.min(26, 520 / Math.max(title.length, 1));
  const pct = (y: number) => `${(y / 700) * 100}%`;

  return (
    <article
      className={`group relative aspect-[5/7] cursor-pointer overflow-hidden rounded-[16px] bg-[var(--cb)] shadow-[0_8px_22px_rgba(60,35,10,0.25)] transition-all [container-type:inline-size] [--band:#fbf7f0] [--cb:#f3ece0] [--hex:rgba(90,55,20,0.13)] [--ink:#2b1d11] [--muted:#7c705f] [--or:#d16d14] hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(60,35,10,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--or)] ${selected ? 'ring-2 ring-[var(--or)] ring-offset-2 ring-offset-background' : ''} ${isDragging ? 'scale-[0.98] opacity-60' : ''} dark:shadow-[0_10px_28px_rgba(0,0,0,0.55)] dark:hover:shadow-[0_18px_38px_rgba(0,0,0,0.7)] dark:[--band:#0a0908] dark:[--cb:#0d0c0b] dark:[--hex:rgba(255,255,255,0.06)] dark:[--ink:#f4ece0] dark:[--muted:#9a948c] dark:[--or:#e8862a]`}
      style={{ fontFamily: SERIF, ...(styleOption?.color ? { '--or': styleOption.color } : {}) } as React.CSSProperties}
      onClick={() => onViewDetail(item)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onViewDetail(item);
      }}
      draggable={draggable}
      onDragStart={(event) => { if (!draggable) return; event.dataTransfer.effectAllowed = 'move'; onDragStart(item.id); }}
      onDragOver={(event) => { if (draggable) event.preventDefault(); }}
      onDrop={(event) => { if (!draggable) return; event.preventDefault(); onDropOnItem(item.id); }}
      onDragEnd={onDragEnd}
    >
      <label
        className={`absolute left-[4%] top-[4%] z-30 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/40 bg-black/45 shadow-sm backdrop-blur-sm transition-[opacity,background-color,border-color] ${selected ? 'pointer-events-auto border-[var(--or)] bg-[var(--or)]/90 opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100'}`}
        onClick={(event) => event.stopPropagation()}
        onDragStart={(event) => event.preventDefault()}
      >
        <Checkbox
          aria-label={`Sélectionner ${title}`}
          checked={selected}
          onChange={(event) => onSelectionChange(item.id, event.target.checked)}
          className="peer sr-only"
        />
        <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/75 bg-black/20 text-white transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black/50 peer-checked:border-white peer-checked:bg-white/15">
          <Icons.Check className={`h-3 w-3 transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
        </span>
      </label>
      {/* Art, laid under the frame; the SVG masks its corners and lower part */}
      <div className="absolute left-[2.4%] top-[1.7%] h-[96.6%] w-[95.2%] overflow-hidden">
        <SteamImage
          appid={appid}
          variant="portrait"
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          fallback={<div className="h-full w-full bg-[radial-gradient(circle_at_50%_25%,#6b2fa0,#2a1240_55%,#0c0b0a)]" />}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      </div>

      <svg viewBox="0 0 500 700" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id={`hex-${uid}`} width="34" height="58.9" patternUnits="userSpaceOnUse">
            <path d="M17 0L34 9.8V29.4L17 39.3L0 29.4V9.8ZM17 39.3V58.9" fill="none" className="stroke-[var(--hex)]" strokeWidth="1" />
            <circle cx="17" cy="19.6" r="1" className="fill-[var(--hex)]" />
            <circle cx="0" cy="49.1" r="1" className="fill-[var(--hex)]" />
            <circle cx="34" cy="49.1" r="1" className="fill-[var(--hex)]" />
          </pattern>
          <clipPath id={`frame-${uid}`}><path d={FRAME} /></clipPath>
        </defs>

        {/* Outside the frame: card background + honeycomb */}
        <path d={`M0 0H500V700H0Z${FRAME}`} fillRule="evenodd" className="fill-[var(--cb)]" />
        <path d={`M0 0H500V700H0Z${FRAME}`} fillRule="evenodd" fill={`url(#hex-${uid})`} />

        {/* Title banner + description panel */}
        <g clipPath={`url(#frame-${uid})`}>
          {!fullArt && <path d={`M0 ${T}Q250 ${T - 38} 500 ${T}V700H0Z`} className="fill-[var(--band)]" />}
          {!fullArt && <path d={`M0 ${B}Q250 ${B - 44} 500 ${B}V700H0Z`} className="fill-[var(--cb)]" />}
          {!fullArt && <path d={`M0 ${B}Q250 ${B - 44} 500 ${B}V700H0Z`} fill={`url(#hex-${uid})`} />}
          <path d={`M0 ${T}Q250 ${T - 38} 500 ${T}`} fill="none" className="stroke-[var(--or)]" strokeWidth="3" />
          <path d={`M0 ${B}Q250 ${B - 44} 500 ${B}`} fill="none" className="stroke-[var(--or)]" strokeWidth="2" />
          <circle cx="34" cy={T + 18} r="2.6" className="fill-[var(--or)]" />
          <circle cx="466" cy={T + 18} r="2.6" className="fill-[var(--or)]" />
        </g>

        {/* Title, following the banner's curve */}
        <path id={`title-${uid}`} d={`M20 ${T + 30}Q250 ${T - 12} 480 ${T + 30}`} fill="none" />
        <text fontSize={titleSize} fontWeight="700" letterSpacing={titleSize * 0.12} className={fullArt ? 'fill-white' : 'fill-[var(--ink)]'} style={{ fontFamily: SERIF, ...(fullArt ? { paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.8)', strokeWidth: 3, strokeLinejoin: 'round' } : {}) }}>
          <textPath href={`#title-${uid}`} startOffset="50%" textAnchor="middle">{title.toUpperCase()}</textPath>
        </text>

        {/* Frame line, rounded inner corners and their rings */}
        <path d={FRAME} fill="none" className="stroke-[var(--or)]" strokeWidth="2.4" />
        {[[24.7, 24.7], [475.3, 24.7], [24.7, 675.3], [475.3, 675.3]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5" className="fill-[var(--cb)] stroke-[var(--or)]" strokeWidth="2" />
        ))}

        {/* Corner ornaments (top-left, mirrored top-right) */}
        {['', 'matrix(-1 0 0 1 500 0)'].map((transform) => (
          <g key={transform || 'left'} transform={transform || undefined}>
            <path d="M36 22H84M36 28H64M22 36V84M28 36V64" className="stroke-[var(--or)]" strokeWidth="3.6" />
            <path d="M37 22H83M37 28H63M22 37V83M28 37V63" className="stroke-[var(--cb)]" strokeWidth="1.2" />
            <path d={diamondPath(89, 22, 5)} className="fill-[var(--cb)] stroke-[var(--or)]" strokeWidth="2" />
            <path d={diamondPath(22, 89, 5)} className="fill-[var(--cb)] stroke-[var(--or)]" strokeWidth="2" />
            <path d={diamondPath(12, 651, 6)} className="fill-[var(--cb)] stroke-[var(--or)]" strokeWidth="2" />
            <path d={sparklePath(56, 63, 8)} className="fill-[var(--or)]" />
            <path d={sparklePath(51, T - 67, 7)} className="fill-[var(--or)]" />
          </g>
        ))}

        {/* Top badge */}
        <path d={RAYS} className="stroke-[var(--or)]" strokeWidth="2" strokeLinecap="round" />
        <path d="M250 2L271.6 14.5V39.5L250 52L228.4 39.5V14.5Z" fill="#0b0a09" className="stroke-[var(--or)]" strokeWidth="3" />
        {BadgeIcon
          ? <BadgeIcon x={236} y={13} width={28} height={28} strokeWidth={2.4} className="text-[var(--or)]" />
          : <path d={starPath(250, 28, 13)} className="fill-[var(--or)]" />}

        {/* Rarity / serial tab */}
        <path d="M112 686L126 674H374L388 686L374 698H126Z" className="fill-[var(--cb)] stroke-[var(--or)]" strokeWidth="2" />
        <path d="M120 686L130 678H370L380 686L370 694H130Z" fill="none" className="stroke-[var(--or)]" strokeWidth="1" opacity="0.7" />
        <path d={diamondPath(250, 686, 12)} className="fill-[var(--cb)] stroke-[var(--or)]" strokeWidth="2" />
        {BadgeIcon
          ? <BadgeIcon x={243} y={680} width={14} height={14} strokeWidth={2.6} className="text-[var(--or)]" />
          : <path d={starPath(250, 687, 6.5)} className="fill-[var(--or)]" />}
      </svg>

      {tags.length > 0 && (
        <div className={`absolute inset-x-[7%] z-20 flex flex-wrap justify-center gap-1.5 ${fullArt ? 'top-[12%]' : 'top-[58%]'}`} onClick={(event) => event.stopPropagation()}>
          {tags.map(({ property, value }) => <OptionTags key={property.id} options={property.options || []} value={value} prominent borderless />)}
        </div>
      )}
      {header.length > 0 && <div className="absolute inset-x-[10%] top-[20%] z-10 text-center text-xs font-semibold text-white">{header.map((entry) => <p key={entry.property.id}>{entry.value}</p>)}</div>}

      {/* Description zone: click to edit the fields in place */}
      <div
        role={canEdit ? 'button' : undefined}
        title={canEdit ? 'Modifier les champs' : undefined}
        onClick={canEdit ? (event) => { event.stopPropagation(); setEditing(true); } : undefined}
        className={`absolute inset-x-[7%] z-10 flex flex-col items-center ${descriptionGap} overflow-hidden text-center ${fullArt ? 'text-white' : 'text-[var(--ink)]'}`}
        style={{ top: pct(B + 2), bottom: pct(30) }}
      >
        {description.length > 0 && (
          <dl className="flex w-full flex-wrap justify-center gap-x-[3.5cqw] gap-y-[0.8cqw] text-[max(9px,2.3cqw)] leading-tight">
            {description.map((entry) => (
              <div key={entry.property.id} className="flex min-w-0 max-w-full items-baseline gap-[1cqw]">
                <dt className={`shrink-0 uppercase tracking-[0.08em] ${fullArt ? 'text-white/70' : 'text-[var(--or)]'}`}>{entry.property.name}</dt>
                {['select', 'multiselect', 'multi_select'].includes(entry.property.type)
                  ? <dd><OptionTags options={entry.property.options || []} value={item?.[entry.property.id]} prominent={fullArt} borderless /></dd>
                  : <dd className={`truncate ${fullArt ? 'text-white' : 'text-[var(--ink)]'}`}>{entry.value}</dd>}
              </div>
            ))}
          </dl>
        )}
      </div>
      {footer.length > 0 && (
        <div className={`absolute inset-x-[24%] bottom-[0.45%] z-20 grid grid-cols-[1fr_1.8rem_1fr] items-center gap-1 text-center text-[max(8px,1.9cqw)] font-semibold ${fullArt ? 'text-white' : 'text-[var(--ink)]'}`}>
          <div className="truncate text-right">{footer[0] ? (['select', 'multiselect', 'multi_select'].includes(footer[0].property.type) ? <OptionTags options={footer[0].property.options || []} value={item?.[footer[0].property.id]} prominent={fullArt} borderless /> : `${footer[0].property.name} : ${footer[0].value}`) : ''}</div>
          <span aria-hidden="true" />
          <div className="truncate text-left">{footer[1] ? (['select', 'multiselect', 'multi_select'].includes(footer[1].property.type) ? <OptionTags options={footer[1].property.options || []} value={item?.[footer[1].property.id]} prominent={fullArt} borderless /> : `${footer[1].property.name} : ${footer[1].value}`) : ''}</div>
        </div>
      )}

      {editing && (
        <div
          className="absolute inset-x-[2.4%] bottom-[1.7%] top-[30%] flex cursor-default flex-col border-t-2 border-[var(--or)] bg-[var(--cb)] font-sans"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {properties.map((property) => (
              <div key={property.id}>
                <span className="mb-0.5 block text-[10px] uppercase tracking-[0.08em] text-[var(--or)]">{property.name}</span>
                <EditableProperty
                  property={property}
                  value={item?.[property.id]}
                  onChange={(value) => onEdit({ ...item, [property.id]: value })}
                  size="sm"
                  collections={collections}
                  collection={collection}
                  currentItem={item}
                  onRelationChange={onRelationChange}
                  onNavigateToCollection={onNavigateToCollection}
                  readOnly={!canEditField(property.id)}
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-auto rounded-none border-t border-[var(--or)] py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--or)] hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => setEditing(false)}
          >
            Terminé
          </Button>
        </div>
      )}
    </article>
  );
};

export default SteamCardFullArt;
