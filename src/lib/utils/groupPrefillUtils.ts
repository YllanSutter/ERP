/**
 * Calcule les valeurs à pré-remplir lors de la création d'un item dans un groupe.
 *
 * - Relation directe (type 'relation') → pré-remplit avec l'ID de l'item lié
 * - Colonne liée (isRelationLinkedColumn) → ignorée (ne peut pas être définie directement)
 * - Select / multi_select → pré-remplit avec la valeur de l'option
 * - Autres types → pré-remplit avec la valeur brute
 * - Déduplique : si le même champ apparaît à plusieurs niveaux, ne le définit qu'une fois
 */
export function buildGroupPrefill(
  groupPath: string,
  groups: string[],
  collectionProperties: any[]
): Record<string, any> {
  const parts = groupPath.split('/');
  const result: Record<string, any> = {};
  const seenPropIds = new Set<string>();

  for (let i = 0; i < groups.length && i < parts.length; i++) {
    const propId = groups[i];
    const rawValue = parts[i];
    if (!propId || !rawValue || rawValue === '(vide)') continue;
    if (seenPropIds.has(propId)) continue;

    const prop = collectionProperties.find((p: any) => p.id === propId);
    if (!prop) continue;

    // Les colonnes liées (ex: "bundle - mois") ne peuvent pas être définies directement
    // La relation source aura déjà été traitée à un niveau supérieur du groupPath
    if (prop.isRelationLinkedColumn) continue;

    seenPropIds.add(propId);

    if (prop.type === 'relation') {
      const relationType = prop.relation?.type || 'many_to_many';
      const isMany = relationType === 'one_to_many' || relationType === 'many_to_many';
      result[propId] = isMany ? [rawValue] : rawValue;
    } else if (prop.type === 'multi_select' || prop.type === 'multiselect') {
      result[propId] = [rawValue];
    } else {
      result[propId] = rawValue;
    }
  }

  return result;
}
