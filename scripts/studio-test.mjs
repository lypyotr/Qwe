import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {testServer,blockExternal} from './test-server.mjs';

const server=await testServer();
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
const check=(name,value)=>{assert.ok(value,name);console.log('PASS:',name);};
fs.mkdirSync('artifacts/design',{recursive:true});
try{
  const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
  await blockExternal(context);
  const nativeSentinel='PRIVATE_ACCOUNT_RECORD_DO_NOT_SHOW';
  await context.addInitScript(value=>{window.localStorage.setItem('salary_2026_10_1',JSON.stringify({private:value}));window.localStorage.setItem('account-sentinel',value);},nativeSentinel);
  const page=await context.newPage(),errors=[],backend=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co'))backend.push(request.url());});
  await page.goto(server.url+'?demo=1',{waitUntil:'networkidle'});
  check('public demo opens without authentication',await page.locator('.studio-demo-strip').isVisible()&&await page.locator('#authOverlay').isHidden());
  check('demo starts with coherent sample work and premium',await page.evaluate(()=>calcBase()>0&&hasPeriodPremium()&&calcTotal()>calcBase()));
  check('demo never displays the native account record',!(await page.locator('body').innerText()).includes(nativeSentinel));
  const initial=await page.evaluate(()=>calcTotal());
  await page.locator('#navPeriod').click();await page.locator('#periodPremiumToggle').click();
  check('demo premium is interactive',await page.locator('#periodPremiumToggle').getAttribute('aria-checked')==='false');
  await page.locator('#navWork').click();
  check('demo total responds to the premium change',await page.evaluate(()=>calcTotal())<initial);
  check('native account storage is untouched by demo edits',await page.evaluate(value=>window.localStorage.getItem('account-sentinel')===value&&JSON.parse(window.localStorage.getItem('salary_2026_10_1')).private===value,nativeSentinel));
  await page.reload({waitUntil:'networkidle'});
  check('reloading resets disposable demo edits',await page.evaluate(()=>calcTotal())===initial);
  for(const width of [320,390,768,1000,1440]){
    await page.setViewportSize({width,height:960});
    for(const route of ['work','period','archive','calc','stats','profile']){
      await page.evaluate(route=>switchPage(route),route);
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      check(route+' has no horizontal overflow at '+width,layout.scroll<=layout.width+1);
    }
  }
  await page.setViewportSize({width:1440,height:1080});await page.locator('#navWork').click();
  await page.screenshot({path:'artifacts/design/studio-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/design/studio-mobile.png',fullPage:true});
  await page.locator('#themeBtn').click();
  check('dark theme remains available',await page.evaluate(()=>!document.body.classList.contains('light')));
  check('demo status stays accurate after changing theme',await page.locator('.workspace-tools .sp-txt').textContent()==='Демо');
  check('reduced motion disables decorative animation',await page.evaluate(()=>getComputedStyle(document.querySelector('.studio-orbit svg')).animationName==='none'));
  check('demo made no project backend requests',backend.length===0);
  check('no uncaught browser errors',errors.length===0);
  console.log('studio presentation and demo safety checks OK');
}finally{await browser.close();await server.close();}
