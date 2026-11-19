import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAppStateAdminRoutes } from './appStateAdminRoutes.js';
const ORG='00000000-0000-0000-0000-000000000001';
const USER='00000000-0000-0000-0000-000000000002';
const ROLE='00000000-0000-0000-0000-000000000003';
function setup() {
  const routes=new Map(); const queries=[];
  const client={release(){},query:async(sql,args)=>{
    queries.push({sql,args});
    if(sql.includes('SELECT id FROM users')) return {rows:[{id:USER}],rowCount:1};
    if(sql.includes('INSERT INTO roles')) return {rows:[{id:ROLE}],rowCount:1};
    return {rows:[],rowCount:0};
  }};
  const app=Object.fromEntries(['get','post'].map(method=>[method,(route,_auth,handler)=>routes.set(`${method} ${route}`,handler)]));
  registerAppStateAdminRoutes({app,appContext:{logger:{error(){}},requireAuth(){},isSiteCreator:async()=>false,
    pool:{connect:async()=>client,query:client.query},upsertPermission:async()=>{},syncAppStateIdSequence:async()=>{},
    ensureSystemRolesForOrganization:async()=>{},getRoleByNameInOrganization:async()=>({rows:[{id:ROLE}]}),uuidv4:()=>ROLE,
  }});
  const response=()=>({code:200,status(code){this.code=code;return this},json(body){this.body=body;return this}});
  return{routes,queries,response};
}
test('global JSON import/export cannot bypass the creator-only full restoration policy',async()=>{
  const {routes,response,queries}=setup();
  for(const method of ['get','post']) {
    const res=response();
    await routes.get(`${method} /api/appstate`)({query:{scope:'global'},auth:{user:{id:USER},roles:[{name:'admin'}],baseIsAdmin:true}},res);
    assert.equal(res.code,403);
  }
  assert.deepEqual(queries,[]);
});
test('organization JSON imports reconnect users without overwriting their shared identity or password',async()=>{
  const {routes,response,queries}=setup();
  const res=response();
  await routes.get('post /api/appstate')({query:{scope:'organization'},auth:{user:{id:USER},roles:[{name:'admin'}],activeOrganization:{id:ORG}},body:{scope:'organization',
    users:[{id:USER,email:'existing@example.invalid',password_hash:'must-not-replace',name:'must-not-replace'}],
    app_state:[{data:JSON.stringify({collections:[]})}],roles:[],permissions:[],user_roles:[],organization_members:[],
  }},res);
  assert.equal(res.code,200);
  assert.ok(queries.some(({sql})=>sql.includes('COMMIT')));
  assert.ok(!queries.some(({sql})=>sql.includes('UPDATE users')||sql.includes('INSERT INTO users')));
});
