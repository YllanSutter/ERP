/**
 * Filtre les propriétés visibles selon les permissions et les champs cachés
 */
export const useVisibleProperties = (
  properties: any[],
  hiddenFields: string[],
  canViewFieldFn: (fieldId: string) => boolean
) => {
  return properties.filter(
    p => !hiddenFields.includes(p.id) && canViewFieldFn(p.id)
  );
};

/**
 * Filtre les propriétés visibles pour édition rapide (menu contextuel)
 */
export const useQuickEditProperties = (
  properties: any[],
  hiddenFields: string[],
  canEditFieldFn: (fieldId: string) => boolean,
  excludeContextMenu: boolean = true
) => {
  return properties.filter(
    p =>
      !hiddenFields.includes(p.id) &&
      (!excludeContextMenu ? true : !p.showContextMenu) &&
      canEditFieldFn(p.id)
  );
};

/**
 * Filtre les propriétés affichables dans les vues (exclut showContextMenu)
 */
export const useDisplayProperties = (
  properties: any[],
  hiddenFields: string[],
  canViewFieldFn: (fieldId: string) => boolean
) => {
  return properties.filter(
    p =>
      !hiddenFields.includes(p.id) &&
      !p.showContextMenu &&
      canViewFieldFn(p.id)
  );
};

export default {
  useVisibleProperties,
  useQuickEditProperties,
  useDisplayProperties,
};
