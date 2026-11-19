import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {registerStaticAssets} from './staticAssets.js';
test('hashed assets are immutable for a year while HTML revalidates', {skip:process.env.RUN_HTTP_INTEGRATION!=='1'}, async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'erp-assets-'));
  await mkdir(path.join(directory,'assets'));await writeFile(path.join(directory,'assets','app-abc123.js'),'console.log(1)');await writeFile(path.join(directory,'index.html'),'<html>test</html>');
  const app=express();registerStaticAssets(app,directory);
  const server=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
  try {
    const url=`http://127.0.0.1:${server.address().port}`;
    const asset=await fetch(url+'/assets/app-abc123.js');assert.match(asset.headers.get('cache-control'),/max-age=31536000/);assert.match(asset.headers.get('cache-control'),/immutable/);
    const html=await fetch(url+'/');assert.equal(html.headers.get('cache-control'),'no-cache');
  }finally{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
