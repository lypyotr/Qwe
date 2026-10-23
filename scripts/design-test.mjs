import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {testServer,blockExternal} from './test-server.mjs';

const server=await testServer();
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
let assertions=0;
const check=(name,value)=>{assert.ok(value,name);assertions++;console.log('PASS:',name);};
fs.mkdirSync('artifacts/design',{recursive:true});
try {
  const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
  await blockExternal(context);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.url,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    showAuthOverlay(false);hideLoader();
    days={[selectedDay]:[
      {id:1,name:'Сборка и монтаж каркаса',qty:12,price:350},
      {id:2,name:'Подготовка деталей',qty:8,price:175}
    ]};bonuses=[];expenseItems=[];renderAll();switchPage('work');
  });
  check('navigation uses consistent vector icons',await page.locator('.nav-btn .nav-icon svg').count()===7);
  check('account and sync remain available in the shared header',await page.locator('.workspace-account #themeBtn').count()===1&&await page.locator('.workspace-account .sync-pill').count()===1);
  check('payment card shows the selected period payout',await page.locator('#workspacePayDate').textContent()!=='');
  for(const light of [false,true]){
    await page.evaluate(light=>document.body.classList.toggle('light',light),light);
    for(const width of [320,390,768,999,1000,1440]){
      await page.setViewportSize({width,height:960});
      await page.waitForTimeout(50);
      check('main action and calendar fit at '+width+'px '+(light?'light':'dark'),await page.evaluate(()=>{
        const add=document.getElementById('workspaceAddWork').getBoundingClientRect();
        const grid=document.getElementById('dayStrip').getBoundingClientRect();
        const cells=[...document.querySelectorAll('#dayStrip .day-cell')];
        return add.left>=0&&add.right<=innerWidth+1&&grid.left>=0&&grid.right<=innerWidth+1&&
          cells.every(cell=>cell.getBoundingClientRect().right<=grid.right+1);
      }));
      check('calculation settings follow the responsive reading order at '+width+'px '+(light?'light':'dark'),await page.evaluate(()=>{
        const parent=document.querySelector('.workspace-settings').parentElement;
        return parent.classList.contains(innerWidth>=1000?'work-overview':'work-journal');
      }));
      if(width===390||width===1440)await page.screenshot({path:'artifacts/design/'+(light?'light':'dark')+'-'+width+'.png',fullPage:true});
    }
  }
  await page.locator('#navCalc').click();
  const before=await page.evaluate(()=>({key:saveKey(),day:selectedDay,count:(days[selectedDay]||[]).length}));
  await page.locator('#workspaceAddWork').click();
  await page.waitForFunction(()=>document.activeElement?.classList.contains('dw-name'));
  check('quick add preserves period and day and focuses the new work',await page.evaluate(before=>
    saveKey()===before.key&&selectedDay===before.day&&days[selectedDay].length===before.count+1&&document.querySelector('.page.active').id==='page-work',before));
  await page.setViewportSize({width:390,height:844});
  await page.locator('.work-journal>.workspace-settings>summary').click();
  await page.locator('#taxToggle').click();
  check('collapsed calculation settings remain usable on mobile',await page.evaluate(()=>taxEnabled&&document.getElementById('workspaceTaxStatus').textContent==='НДФЛ 13%'));
  check('primary work action precedes optional photo controls',await page.evaluate(()=>!!(document.querySelector('#dayPanel .add-work-btn').compareDocumentPosition(document.querySelector('#dayPanel .photo-section'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  check('chat keeps a readable input size',await page.evaluate(()=>{switchPage('chat');return getComputedStyle(document.getElementById('chatInput')).fontSize==='16px';}));
  check('no uncaught browser errors',errors.length===0);
  console.log('design tests OK: '+assertions+' assertions');
} finally {await browser.close();await server.close();}
