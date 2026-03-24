import { registerServerPlugin } from './registry.js';
import { steamServerPlugin } from './steam/index.js';

let builtinsLoaded = false;

export const loadBuiltinServerPlugins = () => {
  if (builtinsLoaded) return;
  registerServerPlugin(steamServerPlugin);
  builtinsLoaded = true;
};
