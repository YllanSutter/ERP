import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';

interface UseViewPermissionsReturn {
  canEdit: boolean;
  canEditFieldFn: (fieldId: string) => boolean;
  canViewFieldFn: (fieldId: string) => boolean;
}

/**
 * Hook réutilisable pour les permissions dans les vues
 * Centralise les appels de permission pour les vues de collection
 */
export const useViewPermissions = (collectionId?: string): UseViewPermissionsReturn => {
  const canEdit = useCanEdit(collectionId);
  const canEditFieldFn = (fieldId: string) => useCanEditField(fieldId, collectionId);
  const canViewFieldFn = (fieldId: string) => useCanViewField(fieldId, collectionId);

  return { canEdit, canEditFieldFn, canViewFieldFn };
};

/**
 * Version simplifiée pour les composants qui n'ont besoin que de canEdit et canViewField
 */
export const useSimpleViewPermissions = (collectionId?: string) => {
  const canEdit = useCanEdit(collectionId);
  const canViewFieldFn = (fieldId: string) => useCanViewField(fieldId, collectionId);

  return { canEdit, canViewFieldFn };
};

export default useViewPermissions;
