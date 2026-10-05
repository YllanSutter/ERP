import AccessManagerController from '@/features/access/AccessManager';

export type AccessManagerProps = {
  collections: any[];
  dashboards: any[];
  onClose: () => void;
  onImportCollections?: (collections: any[]) => void;
  onUpdateDashboards?: (dashboards: any[]) => void;
};

/** Compatibility entry point for existing imports. */
const AccessManager = (props: AccessManagerProps) => <AccessManagerController {...props} />;

export default AccessManager;
