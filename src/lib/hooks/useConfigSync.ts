import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Synchronise un état local avec une valeur de config de vue.
 * - Si configValue est défini, l'état prend cette valeur.
 * - Sinon, l'état est calculé par getInitialValue().
 * - Se réinitialise quand viewKey change.
 */
export function useConfigSync<T>(
  configValue: T | undefined,
  getInitialValue: () => T,
  viewKey: string | null
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => configValue !== undefined ? configValue : getInitialValue());

  useEffect(() => {
    if (configValue !== undefined) {
      setState(configValue);
    } else {
      setState(getInitialValue());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configValue, viewKey]);

  return [state, setState];
}
