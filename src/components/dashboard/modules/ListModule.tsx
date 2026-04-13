/**
 * ListModule – liste compacte d'items avec champs configurables.
 */

import React, { useMemo } from 'react';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import { getNameValue } from '@/lib/calendarUtils';
import { compareValues } from '@/lib/utils/sortUtils';

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
  onViewDetail?: (item: any) => void;
}

const ListModule: React.FC<Props> = ({ module, data, onViewDetail }) => {
  const { filteredItems, properties, collection } = data;

  const visibleProps = useMemo(() => {
    const hidden = new Set(module.hiddenFields ?? []);
    return properties.filter(
      (p) => !hidden.has(p.id) && p.type !== 'relation' && p.type !== 'steam'
    ).slice(0, 4); // max 4 champs secondaires en liste
  }, [properties, module.hiddenFields]);

  const sortedItems = useMemo(() => {
    let items = [...filteredItems];
    if (module.sortField) {
      items = items.sort((a, b) =>
        compareValues(
          a[module.sortField!],
          b[module.sortField!],
          module.sortDirection === 'desc' ? 'desc' : 'asc'
        )
      );
    }
    const limit = module.listLimit ?? module.sortLimit ?? 50;
    return items.slice(0, limit);
  }, [filteredItems, module.sortField, module.sortDirection, module.listLimit, module.sortLimit]);

  const titleValues = useMemo(
    () => sortedItems
      .map((item) => String(getNameValue(item, collection) ?? '').trim())
      .filter(Boolean),
    [sortedItems, collection]
  );

  const urlFieldIds = useMemo(
    () => visibleProps.filter((p) => p.type === 'url').map((p) => p.id),
    [visibleProps]
  );

  const urlValues = useMemo(
    () => sortedItems.flatMap((item) =>
      urlFieldIds
        .map((fid) => String(item[fid] ?? '').trim())
        .filter((v) => v.length > 0)
        .map((v) => (v.startsWith('http://') || v.startsWith('https://')) ? v : `https://${v}`)
    ),
    [sortedItems, urlFieldIds]
  );

  const copyText = async (values: string[]) => {
    const payload = values.join('\n').trim();
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const el = document.createElement('textarea');
      el.value = payload;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const openAllUrls = (values: string[]) => {
    const urls = values
      .map((v) => v.trim())
      .filter((v) => v.startsWith('http://') || v.startsWith('https://'));
    for (let i = urls.length - 1; i >= 0; i -= 1) {
      window.open(urls[i], '_blank', 'noopener');
    }
  };

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune collection sélectionnée
      </div>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucun élément
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto divide-y divide-border">
      <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-border bg-card/70 sticky top-0 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); void copyText(titleValues); }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Copier tous les titres affichés"
        >
          <Copy size={12} /> Titres
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); void copyText(urlValues); }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Copier toutes les URLs affichées"
          disabled={urlValues.length === 0}
        >
          <Link2 size={12} /> URLs
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); openAllUrls(urlValues); }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Ouvrir toutes les URLs affichées"
          disabled={urlValues.length === 0}
        >
          <ExternalLink size={12} /> Ouvrir URLs
        </button>
      </div>

      {sortedItems.map((item) => {
        const name = getNameValue(item, collection);
        return (
          <div
            key={item.id}
            className="px-3 py-2 hover:bg-accent/50 cursor-pointer flex items-start gap-2 group"
            onClick={() => onViewDetail?.(item)}
          >
            {/* Nom principal */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-foreground">
                {name || <span className="text-muted-foreground italic">Sans nom</span>}
              </div>
              {/* Champs secondaires */}
              {visibleProps.length > 0 && (
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {visibleProps.map((prop) => {
                    const val = item[prop.id];
                    if (val === null || val === undefined || val === '') return null;

                    // Évite le doublon du champ principal déjà affiché en titre
                    if (String(val).trim() === String(name ?? '').trim()) return null;

                    if (prop.type === 'url') {
                      const href = String(val).trim();
                      if (!href) return null;
                      return (
                        <a
                          key={prop.id}
                          href={href.startsWith('http') ? href : `https://${href}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded hover:text-foreground hover:bg-accent transition-colors"
                          title={`${prop.name}: ${href}`}
                        >
                          <span className="opacity-60">{prop.name}</span>
                          <ExternalLink size={12} />
                        </a>
                      );
                    }

                    let display: string;
                    if (Array.isArray(val)) {
                      display = val.join(', ');
                    } else if (typeof val === 'boolean') {
                      display = val ? '✓' : '✗';
                    } else {
                      display = String(val);
                    }
                    if (!display) return null;
                    return (
                      <span
                        key={prop.id}
                        className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]"
                      >
                        <span className="opacity-60">{prop.name}: </span>
                        {display}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {filteredItems.length > sortedItems.length && (
        <div className="px-3 py-2 text-xs text-muted-foreground text-center">
          + {filteredItems.length - sortedItems.length} éléments masqués
        </div>
      )}
    </div>
  );
};

export default ListModule;
