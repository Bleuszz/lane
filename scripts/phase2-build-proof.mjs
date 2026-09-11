import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
if(!process.env.DATABASE_URL?.includes('127.0.0.1:15439/lane'))throw Error('Isolated fixture required');
const server=spawn(process.execPath,['scripts/start-server.mjs'],{windowsHide:true,env:{...process.env,PORT:'8082',HOST:'127.0.0.1',LANE_ENV:'staging',BETTER_AUTH_URL:'https://lane.example'},stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',b=>{output=(output+b.toString()).slice(-4000);});server.stderr.on('data',()=>{});
const base='http://127.0.0.1:8082';
try{
 let ready=false;
 for(let i=0;i<60;i++){try{const r=await fetch(base,{signal:AbortSignal.timeout(1500)});if(r.ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'built server must start after migration');
 const response=await fetch(base);const html=await response.text();
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.ok(html.includes('rel="canonical" href="https://lane.example/"'));
 assert.ok(html.includes('name="twitter:card"'));
 assert.ok((await(await fetch(base+'/robots.txt')).text()).includes('Disallow: /'));
 const config=await(await fetch(base+'/api/auth/configuration')).json();assert.ok(config.providers.every(p=>!p.available));
 const denied=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{origin:'http://localhost:8080','content-type':'application/json'},body:JSON.stringify({email:'fixture@example.invalid',password:'synthetic-password'})});
 assert.equal(denied.status,403);
 writeFileSync('artifacts/phase2-build-result.json',JSON.stringify({passed:true,nodeBuild:true,startupMigration:true,stagingNoindex:true,canonicalTrustedOrigin:true,noAuthCaching:true,localhostOriginRejected:true,at:new Date().toISOString()},null,2));
 console.log('PASS: built Node server starts after migrations; canonical metadata, staging noindex, security/cache headers and deployed localhost-origin rejection verified.');
}catch(e){console.error('FAIL built server: '+e.message);process.exitCode=1;}finally{if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else server.kill('SIGTERM');}
