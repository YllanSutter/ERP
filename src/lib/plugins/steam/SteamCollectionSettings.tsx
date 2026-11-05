import { SettingsSection, SettingsSelect, SettingsLabel, SettingsHint } from '@/components/ui/settings-panel';
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
  return (
    <SettingsSection title="Steam">
      <div className="space-y-3">
        <label className="grid gap-1">
          <SettingsLabel>Rôle de cette collection</SettingsLabel>
          <SettingsSelect value={settings.role || ''}
            onChange={(role) => update({ role, bundleRelationPropertyId: '' })}
            options={[
              { value: '', label: 'Aucun rôle Steam' },
              ...[['games', 'Jeux'], ['bundles', 'Bundles']].map(([value, label]) => {
                const other = collections.find((candidate) => candidate.id !== collection.id && candidate.plugins?.steam?.role === value);
                return { value, label: other ? `${label} (déjà attribué à ${other.name})` : label, disabled: Boolean(other) };
              }),
            ]} />
        </label>
        {settings.role === 'games' && (
          <>
            <label className="grid gap-1">
              <SettingsLabel>Relation vers les bundles</SettingsLabel>
              <SettingsSelect value={settings.bundleRelationPropertyId || ''}
                onChange={(bundleRelationPropertyId) => update({ bundleRelationPropertyId })}
                options={[
                  { value: '', label: relations.length === 1 ? `Automatique : ${relations[0].name}` : 'Sélectionner une relation existante' },
                  ...relations.map((property: any) => ({ value: property.id, label: property.name })),
                ]} />
            </label>
            {!collection.properties?.some((property: any) => property.type === 'steam') && (
              <SettingsHint className="text-amber-600">Ajoutez un champ Steam pour identifier les jeux lors du partage et de l’import.</SettingsHint>
            )}
            {!relations.length && <SettingsHint>Ajoutez une propriété de relation vers votre collection de bundles.</SettingsHint>}
          </>
        )}
        <SettingsHint>Choisissez la relation parent Bundle. Ses champs liés (mois, année…) servent à préremplir la création et grouper les bundles.</SettingsHint>
      </div>
    </SettingsSection>
  );
}
