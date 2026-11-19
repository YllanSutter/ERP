import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAppStateAdminRoutes } from './appStateAdminRoutes.js';
const ORG='00000000-0000-0000-0000-000000000001';
const USER='00000000-0000-0000-0000-000000000002';
const ROLE='00000000-0000-0000-0000-000000000003';
function setup({ creator = false, failOn = null } = {}) {
  const routes=new Map(); const queries=[];
  const client={release(){},query:async(sql,args)=>{
    queries.push({sql,args});
    if (failOn && sql.includes(failOn)) throw new Error("Simulated database failure");
    if(sql.includes('SELECT id FROM users')) return {rows:[{id:USER}],rowCount:1};
    if(sql.includes('INSERT INTO roles')) return {rows:[{id:ROLE}],rowCount:1};
    return {rows:[],rowCount:0};
  }};
  const app=Object.fromEntries(['get','post'].map(method=>[method,(route,_auth,handler)=>routes.set(`${method} ${route}`,handler)]));
  registerAppStateAdminRoutes({app,appContext:{logger:{error(){}},requireAuth(){},isSiteCreator:async()=>creator,withDatabaseMaintenance:async(_req,run)=>run(),
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

const globalRequest = (body) => ({ query: { scope: 'global' },
  auth: { user: { id: USER }, roles: [{ name: 'member' }], baseIsAdmin: false }, body });
const globalPayload = () => ({ scope: 'global', users: [{ id: USER, email: 'owner@example.invalid' }],
  organizations: [{ id: ORG, name: 'Example', owner_user_id: USER }],
  organization_members: [{ organization_id: ORG, user_id: USER }],
  app_state: [{ id: 1, user_id: USER, organization_id: ORG, data: { collections: [] } }],
  roles: [], permissions: [], user_roles: [] });
test('the principal account can export globally regardless of the active organization role', async () => {
  const { routes, response } = setup({ creator: true });
  const res = response();
  await routes.get('get /api/appstate')(globalRequest(), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.scope, 'global');
});
test('global import uses one transaction and respects foreign key order without privileged SQL', async () => {
  const { routes, response, queries } = setup({ creator: true });
  const res = response();
  await routes.get('post /api/appstate')(globalRequest(globalPayload()), res);
  assert.equal(res.code, 200);
  const sql = queries.map(q => q.sql);
  assert.equal(sql[0], 'BEGIN');
  assert.equal(sql.at(-1), 'COMMIT');
  assert.ok(sql.indexOf('DELETE FROM user_roles') < sql.indexOf('DELETE FROM roles'));
  assert.ok(sql.indexOf('DELETE FROM organizations') < sql.indexOf('DELETE FROM users'));
  assert.ok(!sql.some(query => query.includes('session_replication_role')));
});
test('failed global imports roll back instead of leaving a partially replaced database', async () => {
  const { routes, response, queries } = setup({ creator: true, failOn: 'INSERT INTO organizations' });
  const res = response();
  await routes.get('post /api/appstate')(globalRequest(globalPayload()), res);
  assert.equal(res.code, 500);
  assert.equal(queries.at(-1).sql, 'ROLLBACK');
  assert.ok(!queries.some(q => q.sql === 'COMMIT'));
});
test('incomplete global files and files missing the principal account are rejected before any writes', async () => {
  for (const patch of [{ organizations: undefined }, { organization_members: undefined }, { users: [] }]) {
    const { routes, response, queries } = setup({ creator: true });
    const res = response();
    await routes.get('post /api/appstate')(globalRequest({ ...globalPayload(), ...patch }), res);
    assert.equal(res.code, 400);
    assert.deepEqual(queries, []);
  }
});

test('global transfer visibility follows the principal account independently of backup access', async () => {
  for (const creator of [true, false]) {
    const { routes, response } = setup({ creator });
    const res = response();
    await routes.get('get /api/appstate/access')(globalRequest(), res);
    assert.equal(res.body.canManageGlobalState, creator);
  }
});
