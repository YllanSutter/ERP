import { useAuth } from '@/auth/AuthProvider';
import { pluginManager } from '@/lib/plugins';

export function SteamCollectionSettings({
  collection,
  collections,
  onChange,
}: {
  collection: any;
  collections: any[];
  onChange: (changes: any) => void;
}) {
  const { activeOrganizationId } = useAuth();
  if (!activeOrganizationId || !pluginManager.isPluginActive(activeOrganizationId, 'steam'))
    return null;
  const settings = collection.plugins?.steam || {};
  const update = (value: any) =>
    onChange({ plugins: { ...collection.plugins, steam: { ...settings, ...value } } });
  const bundleCollection = collections.find(
    (c) => c.plugins?.steam?.role === 'bundles' && c.id !== collection.id,
  );
  const relations = (collection.properties || []).filter(
    (p: any) =>
      p.type === 'relation' &&
      (!bundleCollection || p.relation?.targetCollectionId === bundleCollection.id),
  );
  const selectClass =
    'w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-2 text-sm';
  return (
    <fieldset className="space-y-3 border-t border-black/10 dark:border-white/10 pt-4">
      <legend className="font-medium">Steam</legend>
      <label className="block text-sm space-y-1">
        <span>Rôle de cette collection</span>
        <select
          className={selectClass}
          value={settings.role || ''}
          onChange={(e) => update({ role: e.target.value, bundleRelationPropertyId: '' })}
        >
          <option value="">Aucun rôle Steam</option>
          {[
            ['games', 'Jeux'],
            ['bundles', 'Bundles'],
          ].map(([role, label]) => {
            const other = collections.find(
              (c) => c.id !== collection.id && c.plugins?.steam?.role === role,
            );
            return (
              <option key={role} value={role} disabled={!!other}>
                {label}
                {other ? ` (déjà attribué à ${other.name})` : ''}
              </option>
            );
          })}
        </select>
      </label>
      {settings.role === 'games' && (
        <>
          <label className="block text-sm space-y-1">
            <span>Relation vers les bundles</span>
            <select
              className={selectClass}
              value={settings.bundleRelationPropertyId || ''}
              onChange={(e) => update({ bundleRelationPropertyId: e.target.value })}
            >
              <option value="">
                {relations.length === 1
                  ? `Automatique : ${relations[0].name}`
                  : 'Sélectionner une relation existante'}
              </option>
              {relations.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {!collection.properties?.some((p: any) => p.type === 'steam') && (
            <p className="text-xs text-amber-600">
              Ajoutez un champ Steam pour identifier les jeux lors du partage et de l’import.
            </p>
          )}
          {!relations.length && (
            <p className="text-xs text-neutral-500">
              Ajoutez une propriété de relation vers votre collection de bundles.
            </p>
          )}
        </>
      )}
      <p className="text-xs text-neutral-500">
        Choisissez seulement la relation parent Bundle. Ses champs liés (mois, année…) sont reconnus
        automatiquement pour préremplir la création et grouper les bundles.
      </p>
    </fieldset>
  );
}
