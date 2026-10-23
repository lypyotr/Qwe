import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {testServer,blockExternal} from './test-server.mjs';

let nextVersion=false;
const server=await testServer((file,body)=>file==='sw.js'&&nextVersion?body.replace("salary-v49","salary-test-next"):body);
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
let assertions=0;
const check=(name,value)=>{assert.ok(value,name);assertions++;console.log('PASS:',name);};
try {
  const context=await browser.newContext({serviceWorkers:'allow'});await blockExternal(context);
  const page=await context.newPage();let loads=0;page.on('domcontentloaded',()=>loads++);
  await page.goto(server.url,{waitUntil:'networkidle'});
  await page.evaluate(async()=>watchPWARegistration(await navigator.serviceWorker.register('./sw.js')));
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.waitForTimeout(100);
  check('first install does not reload the page',loads===1);
  await page.evaluate(async()=>{
    showAuthOverlay(false);hideLoader();await caches.open('unrelated-test-cache');currentUser={id:'test-user'};msgV2PrepareChat('room:A');_chatFriend={id:'room:A'};
    document.getElementById('chatInput').value='Черновик до обновления';msgV2SetContext('reply',{id:42,text:'Исходное сообщение'});
  });
  const second=await context.newPage();let secondLoads=0;second.on('domcontentloaded',()=>secondLoads++);
  await second.goto(server.url,{waitUntil:'networkidle'});
  await second.evaluate(async()=>{
    watchPWARegistration(await navigator.serviceWorker.getRegistration());
    showAuthOverlay(false);hideLoader();
    currentUser={id:'second-user'};msgV2PrepareChat('room:B');_chatFriend={id:'room:B'};document.getElementById('chatInput').value='Вторая вкладка';msgV2SaveDraft();
  });
  nextVersion=true;
  await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
  await page.waitForFunction(()=>!!document.getElementById('pwaUpdateBanner')&&!document.getElementById('pwaUpdateBanner').hidden);
  check('update waits for the button in both tabs',loads===1&&secondLoads===1&&await second.locator('#pwaUpdateBanner').isVisible());
  await page.evaluate(()=>{msgV2Sending=true;});await page.locator('#pwaUpdateBtn').click();
  check('update is blocked during sending',await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting));
  await page.evaluate(()=>{msgV2Sending=false;});
  await Promise.all([page.waitForEvent('domcontentloaded'),second.waitForEvent('domcontentloaded'),page.locator('#pwaUpdateBtn').click()]);
  await page.waitForFunction(()=>typeof workspaceNavigation==='function');await second.waitForFunction(()=>typeof workspaceNavigation==='function');
  check('approved update reloads both tabs once',loads===2&&secondLoads===2);
  check('text and reply survive update',await page.evaluate(()=>{
    currentUser={id:'test-user'};msgV2PrepareChat('room:A');return document.getElementById('chatInput').value==='Черновик до обновления'&&msgV2.reply?.id===42;
  }));
  check('other tab draft is preserved separately',await second.evaluate(()=>{
    currentUser={id:'second-user'};msgV2PrepareChat('room:B');return document.getElementById('chatInput').value==='Вторая вкладка';
  }));
  check('old app cache is deleted and unrelated cache survives',await page.evaluate(async()=>{
    const keys=await caches.keys();return keys.includes('salary-test-next')&&!keys.includes('salary-v49')&&keys.includes('unrelated-test-cache');
  }));
  await context.setOffline(true);await page.reload({waitUntil:'networkidle'});
  check('updated app opens offline with its styles and scripts',await page.evaluate(()=>typeof workspaceNavigation==='function'&&!![...document.styleSheets].find(sheet=>sheet.href?.includes('workspace.css?v=2'))));
  console.log(`PWA tests OK: ${assertions} assertions`);
} finally {await browser.close();await server.close();}
