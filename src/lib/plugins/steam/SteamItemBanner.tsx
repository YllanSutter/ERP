import { useAuth } from '@/auth/AuthProvider';
import { pluginManager } from '@/lib/plugins';
import { SteamImage } from './SteamImage';
import { getSteamAppId, getSteamDisplayName } from './steamUtils';

export function SteamItemBanner({ collection, item }: { collection: any; item: any }) {
  const { activeOrganizationId } = useAuth();
  if (!activeOrganizationId || !pluginManager.isPluginActive(activeOrganizationId, 'steam')) return null;
  const property = collection?.properties?.find((field: any) => field.type === 'steam');
  const value = property ? item?.[property.id] : null;
  const appid = getSteamAppId(value);
  if (!appid) return null;
  return (
    <SteamImage appid={appid} variant="header" alt={getSteamDisplayName(value) || 'Bannière Steam'}
      className="mb-4 block h-auto w-full shrink-0 rounded-xl" />
  );
}
