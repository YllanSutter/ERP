import type { useAccessManagerController } from './useAccessManagerController';

export type AccessContext = ReturnType<typeof useAccessManagerController>['panelContext'];
