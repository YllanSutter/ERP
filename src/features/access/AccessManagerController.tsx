import AccessManagerWorkspace from './AccessManagerWorkspace';

export type AccessManagerProps = {
  collections: any[];
  dashboards: any[];
  onClose: () => void;
  onImportCollections?: (collections: any[]) => void;
  onUpdateDashboards?: (dashboards: any[]) => void;
};

/** Public compatibility controller; feature rendering lives in access panels/workspace. */
const AccessManagerController = (props: AccessManagerProps) => <AccessManagerWorkspace {...props} />;

export default AccessManagerController;
