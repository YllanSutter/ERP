import { registerAuthRoutes } from './authRoutes.js';
import { registerOrganizationRoutes } from './organizationRoutes.js';
import { registerUserAccessRoutes } from './userAccessRoutes.js';
import { registerRolePermissionRoutes } from './rolePermissionRoutes.js';

export const registerAccessRoutes = ({ app, appContext }) => {
  const routeContext = { app, appContext };
  registerAuthRoutes(routeContext);
  registerOrganizationRoutes(routeContext);
  registerUserAccessRoutes(routeContext);
  registerRolePermissionRoutes(routeContext);
};
