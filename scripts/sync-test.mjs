import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('async function fetchWithRetry('),html.indexOf('// Auth lock:'));
let calls=0,aborts=0;
const ctx=vm.createContext({Request,Response,DOMException,AbortController,document:{visibilityState:'visible'},Math,
  setTimeout:(fn,ms)=>setTimeout(fn,ms===8000?15:1),clearTimeout,
  fetch:async()=>{calls++;return new Response('{"ok":true}',{headers:{'content-type':'application/json'}});}});
vm.runInContext(source,ctx);
const run=init=>ctx.fetchWithRetry('https://example.test',init);
assert.deepEqual(await (await run()).json(),{ok:true});
console.log('PASS: complete JSON response survives buffering');
calls=0;ctx.fetch=async()=>{calls++;if(calls===1)return {body:true,arrayBuffer:async()=>{throw new TypeError('HTTP2_PING_FAILED');}};return new Response('recovered');};
assert.equal(await (await run()).text(),'recovered');assert.equal(calls,2);
console.log('PASS: body failure after headers retries the request');
calls=0;aborts=0;ctx.fetch=async(_input,options)=>{calls++;options.signal.addEventListener('abort',()=>aborts++);return {body:true,arrayBuffer:()=>new Promise(()=>{})};};
await assert.rejects(run(),e=>e.name==='TimeoutError');assert.equal(calls,3);assert.equal(aborts,3);
console.log('PASS: stalled response bodies time out and abort all three attempts');
calls=0;ctx.fetch=async()=>{calls++;return new Response(null,{status:204});};
assert.equal((await run()).status,204);assert.equal(calls,1);
console.log('PASS: empty write response is preserved');
calls=0;ctx.fetch=async()=>{calls++;return new Response('{"message":"denied"}',{status:403});};
assert.equal((await run()).status,403);assert.equal(calls,1);
console.log('PASS: permission errors are returned without network retries');
const controller=new AbortController();controller.abort();calls=0;
await assert.rejects(run({signal:controller.signal}),e=>e.name==='AbortError');assert.equal(calls,0);
console.log('PASS: caller cancellation is respected');
console.log('sync transport tests OK: 6 scenarios');
