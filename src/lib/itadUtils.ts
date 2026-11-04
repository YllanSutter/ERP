/**
 * Utilitaires pour l'intégration ITAD
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function importPricesFromItad(
  organizationId: string,
  itemIds: string[],
  config?: Record<string, any>
): Promise<{
  updated: number;
  errors: number;
  details: { updates: { itemId: string; prices: { sale: number; regular: number } }[] };
}> {
  try {
    console.log('[ITAD] Importing prices for', itemIds.length, 'items');

    const response = await fetch(`${API_URL}/plugins/steam/import-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Organization-Id': organizationId },
      credentials: 'include',
      body: JSON.stringify({
        itemIds,
        organizationId,
        config: config || {},
        persist: false
      })
    });

    if (!response.ok) {
      let errorMessage = `Import failed: ${response.statusText}`;
      try {
        const errorBody = await response.json();
        if (errorBody?.error && errorBody?.details) {
          errorMessage = `Import failed: ${errorBody.error} (${errorBody.details})`;
        } else if (errorBody?.error) {
          errorMessage = `Import failed: ${errorBody.error}`;
        } else if (errorBody?.details) {
          errorMessage = `Import failed: ${errorBody.details}`;
        }
      } catch {
        // Keep default status text when response body is not JSON
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[ITAD] Import completed:', result);

    return result;
  } catch (error) {
    console.error('[ITAD] Import error:', error);
    alert(`❌ Erreur lors de l'import ITAD: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
