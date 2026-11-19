import {expect,it} from 'vitest';
import {assertProductionBuild} from './buildChecks.js';
const chunk=(fileName:string,imports:string[]=[],code='export const value=1;')=>({type:'chunk',fileName,imports,code});
it('rejects the charts/totals dependency cycle seen in the deployed files',()=>{
  expect(()=>assertProductionBuild({output:[chunk('charts.js',['totals.js']),chunk('totals.js',['charts.js'])]})).toThrow('charts.js -> totals.js -> charts.js');
});
it('accepts lazy entry points importing shared modules without a static cycle',()=>{
  expect(()=>assertProductionBuild({output:[{...chunk('entry.js',['react.js']),dynamicImports:['charts.js']},chunk('charts.js',['react.js']),chunk('react.js')]})).not.toThrow();
});
it('rejects a development React runtime in a production artifact',()=>{
  expect(()=>assertProductionBuild({output:[chunk('react.js',[],'console.info("Download the React DevTools")')]})).toThrow('Development React runtime');
});
