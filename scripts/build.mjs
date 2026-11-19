// A deployment shell may export NODE_ENV=development. Never ship React's dev
// runtime in compiled assets; set this before Vite/plugins resolve dependencies.
process.env.NODE_ENV = 'production';
const { build } = await import('vite');
const result = await build();
const { assertProductionBuild } = await import('../shared/buildChecks.js');
assertProductionBuild(result);
