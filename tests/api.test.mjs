import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
import {z} from '../node_modules/zod/index.js';
import {transition,defaults} from '../app/engine.ts';

// Exercise the actual route implementation with only auth and D1 I/O replaced.
const routeSource=await readFile(new URL('../app/api/pet/route.ts',import.meta.url),'utf8');
const routeJs=ts.transpileModule(routeSource.replace(/^import.*$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^export /gm,'');
function route({user={userId:'test-user'},current={pet:null,revision:0},writeSuccess=true}={}){let stored=structuredClone(current),writes=0;const users=[];const f=new Function('z','getChatGPTUser','readPet','writePet','transition',routeJs+'\nreturn {GET,POST}');const handlers=f(z,async()=>user,async u=>(users.push(u),structuredClone(stored)),async(u,pet,rev)=>{users.push(u);writes++;if(!writeSuccess||stored.revision!==rev)return false;stored={pet:structuredClone(pet),revision:rev+1};return true;},transition);return {...handlers,get stored(){return stored;},get writes(){return writes;},users};}
const adopt={type:'adopt',egg:0,name:'Remy',timezone:'Australia/Brisbane',commitments:defaults};
const req=(body,origin='https://remy.example')=>new Request('https://remy.example/api/pet',{method:'POST',headers:{'Content-Type':'application/json',origin},body:typeof body==='string'?body:JSON.stringify(body)});

test('GET and POST require authentication',async()=>{const r=route({user:null});assert.equal((await r.GET()).status,401);assert.equal((await r.POST(req({revision:0,action:adopt}))).status,401);assert.equal(r.writes,0);});
test('GET returns uncached state and server time',async()=>{const r=route();const res=await r.GET();assert.equal(res.headers.get('Cache-Control'),'no-store');const data=await res.json();assert.equal(data.revision,0);assert.ok(Number.isFinite(Date.parse(data.now)));});
test('valid adoption persists only under authenticated user ID',async()=>{const r=route();const res=await r.POST(req({revision:0,action:adopt}));assert.equal(res.status,200);assert.equal(r.writes,1);assert.equal(r.stored.revision,1);assert.ok(r.users.every(u=>u==='test-user'));});
test('cross-origin writes are rejected before persistence',async()=>{const r=route();assert.equal((await r.POST(req({revision:0,action:adopt},'https://other.example'))).status,403);assert.equal(r.writes,0);});
test('invalid JSON, extra keys and malformed actions return 400',async()=>{for(const body of ['{', {revision:0,action:{...adopt,userId:'someone-else'}},{revision:-1,action:adopt},{revision:0,action:{...adopt,egg:6}},{revision:0,action:{...adopt,name:'  '}},{revision:0,action:{...adopt,commitments:[]}},{revision:0,action:{...adopt,timezone:'not-a-zone'}}]){const r=route();assert.equal((await r.POST(req(body))).status,400);assert.equal(r.writes,0);}});
test('oversized request is rejected',async()=>{const r=route();assert.equal((await r.POST(req('x'.repeat(12001)))).status,413);assert.equal(r.writes,0);});
test('stale revision returns authoritative state and does not write',async()=>{const pet=transition(null,adopt,new Date(Date.now()-120000));const r=route({current:{pet,revision:2}});const res=await r.POST(req({revision:1,action:{type:'pet'}}));assert.equal(res.status,409);assert.equal((await res.json()).revision,2);assert.equal(r.writes,0);});
test('concurrent conditional write failure returns 409',async()=>{const r=route({writeSuccess:false});const res=await r.POST(req({revision:0,action:adopt}));assert.equal(res.status,409);assert.equal((await res.json()).revision,0);assert.equal(r.stored.pet,null);});
test('new nap/wake actions are accepted by the API schema',async()=>{const pet=transition(null,adopt,new Date(Date.now()-120000));const r=route({current:{pet,revision:1}});assert.equal((await r.POST(req({revision:1,action:{type:'nap'}}))).status,200);assert.equal((await r.POST(req({revision:2,action:{type:'wake'}}))).status,200);});

const clientSource=await readFile(new URL('../app/remybot.tsx',import.meta.url),'utf8');
test('REGRESSION: delayed GET JSON cannot overwrite a newer action response',async()=>{const loadCode=clientSource.match(/const load=useCallback\((async\(\)=>\{[\s\S]*?\}),\[\]\);/)?.[1];assert.ok(loadCode,'load callback extraction must match source');const code=ts.transpileModule('const load='+loadCode,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;let resolveBody;const body=new Promise(r=>resolveBody=r);const lock={current:false},loadSeq={current:0},offset={current:0};let data={revision:0};const fn=new Function('lock','loadSeq','fetch','setSignedIn','setReady','setData','offset','setNowMs','setError',code+';return load');const load=fn(lock,loadSeq,async()=>({status:200,ok:true,json:()=>body}),()=>{},()=>{},p=>data=p,offset,()=>{},()=>{});const pending=load();await Promise.resolve();loadSeq.current++;data={revision:2};resolveBody({pet:null,revision:1,now:new Date().toISOString()});await pending;assert.equal(data.revision,2,'Old GET payload overwrote the current saved revision');});

