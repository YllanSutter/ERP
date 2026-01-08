import { useAuth } from '@/auth/AuthProvider';

/**
 * Hook simplifié pour vérifier si l'utilisateur peut éditer
 */
export const useCanEdit = (collectionId?: string | null) => {
  const { isAdmin, isEditor, permissions } = useAuth();
  
  // Si admin ou editor, on peut toujours éditer
  if (isAdmin || isEditor) return true;

  // Vérifier les permissions globales
  const perms = permissions || [];
  const globalPerm = perms.find(
    (p: any) =>
      (p.collection_id || null) === null &&
      (p.item_id || null) === null &&
      (p.field_id || null) === null
  );
  if (globalPerm && globalPerm.can_write) return true;

  // Vérifier les permissions pour la collection spécifique
  if (collectionId) {
    const collectionPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (collectionPerm && collectionPerm.can_write) return true;
  }

  return false;
};

/**
 * Hook simplifié pour vérifier si l'utilisateur peut voir/lire
 */
export const useCanView = (collectionId?: string | null) => {
  const { isAdmin, isEditor, permissions } = useAuth();
  
  // Si admin ou editor, on peut toujours voir
  if (isAdmin || isEditor) return true;

  // Vérifier les permissions globales
  const perms = permissions || [];
  const globalPerm = perms.find(
    (p: any) =>
      (p.collection_id || null) === null &&
      (p.item_id || null) === null &&
      (p.field_id || null) === null
  );
  if (globalPerm && globalPerm.can_read) return true;

  // Vérifier les permissions pour la collection spécifique
  if (collectionId) {
    const collectionPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (collectionPerm && collectionPerm.can_read) return true;
  }

  return false;
};

/**
 * Hook simplifié pour vérifier si l'utilisateur peut éditer un champ spécifique
 */
export const useCanEditField = (fieldId: string, collectionId?: string | null) => {
  const { isAdmin, isEditor, permissions } = useAuth();
  
  // Si admin ou editor, on peut toujours éditer
  if (isAdmin || isEditor) return true;

  const perms = permissions || [];
  
  // Vérifier les permissions pour le champ spécifique
  if (fieldId) {
    const fieldPerm = perms.find(
      (p: any) =>
        (p.field_id || null) === fieldId &&
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null
    );
    if (fieldPerm) return Boolean(fieldPerm.can_write);
  }

  // Fallback sur les permissions de collection
  if (collectionId) {
    const collectionPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (collectionPerm) return Boolean(collectionPerm.can_write);
  }

  // Fallback sur les permissions globales
  const globalPerm = perms.find(
    (p: any) =>
      (p.collection_id || null) === null &&
      (p.item_id || null) === null &&
      (p.field_id || null) === null
  );
  if (globalPerm) return Boolean(globalPerm.can_write);

  return false;
};

/**
 * Hook simplifié pour vérifier si l'utilisateur peut voir un champ spécifique
 */
export const useCanViewField = (fieldId: string, collectionId?: string | null) => {
  const { isAdmin, isEditor, permissions } = useAuth();
  
  // Si admin ou editor, on peut toujours voir
  if (isAdmin || isEditor) return true;

  const perms = permissions || [];
  
  // Vérifier les permissions pour le champ spécifique
  if (fieldId) {
    const fieldPerm = perms.find(
      (p: any) =>
        (p.field_id || null) === fieldId &&
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null
    );
    if (fieldPerm) return Boolean(fieldPerm.can_read);
  }

  // Fallback sur les permissions de collection
  if (collectionId) {
    const collectionPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (collectionPerm) return Boolean(collectionPerm.can_read);
  }

  // Fallback sur les permissions globales
  const globalPerm = perms.find(
    (p: any) =>
      (p.collection_id || null) === null &&
      (p.item_id || null) === null &&
      (p.field_id || null) === null
  );
  if (globalPerm) return Boolean(globalPerm.can_read);

  return false;
};

/**
 * Hook pour vérifier si l'utilisateur peut gérer les permissions
 */
export const useCanManagePermissions = () => {
  const { isAdminBase } = useAuth();
  return isAdminBase;
};
