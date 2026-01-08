import { useAuth } from '@/auth/AuthProvider';

export const usePermissions = (activeCollection: string | null) => {
  const { isAdmin, isAdminBase, isEditor, permissions } = useAuth();

  const hasPerm = (
    scope: { collectionId?: string | null; itemId?: string | null; fieldId?: string | null },
    action: string
  ) => {
    if (isAdmin) return true;
    const flag = action;
    const perms = permissions || [];
    const { collectionId = null, itemId = null, fieldId = null } = scope;

    if (fieldId) {
      const match = perms.find(
        (p: any) =>
          (p.field_id || null) === fieldId &&
          (p.item_id || null) === itemId &&
          (p.collection_id || null) === collectionId
      );
      if (match) return Boolean(match[flag]);
    }
    if (itemId) {
      const match = perms.find(
        (p: any) =>
          (p.item_id || null) === itemId &&
          (p.collection_id || null) === collectionId &&
          (p.field_id || null) === null
      );
      if (match) return Boolean(match[flag]);
    }
    if (collectionId) {
      const match = perms.find(
        (p: any) =>
          (p.collection_id || null) === collectionId &&
          (p.item_id || null) === null &&
          (p.field_id || null) === null
      );
      if (match) return Boolean(match[flag]);
    }
    const globalMatch = perms.find(
      (p: any) =>
        (p.collection_id || null) === null &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (globalMatch) return Boolean(globalMatch[flag]);
    return false;
  };

  const canEditField = (fieldId: string) => {
    if (isAdmin || isEditor) return true;
    return hasPerm({ collectionId: activeCollection, fieldId }, 'can_write');
  };

  const canEdit =
    isAdmin ||
    isEditor ||
    hasPerm({}, 'can_write') ||
    (activeCollection ? hasPerm({ collectionId: activeCollection }, 'can_write') : false);

  const canManagePermissions = isAdminBase;

  return {
    hasPerm,
    canEditField,
    canEdit,
    canManagePermissions
  };
};
