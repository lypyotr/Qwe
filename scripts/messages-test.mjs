import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {testServer,blockExternal} from './test-server.mjs';
const server=await testServer();
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
let assertions=0;
const check=(name,value)=>{assert.ok(value,name);assertions++;console.log('PASS:',name);};
fs.mkdirSync('artifacts/design',{recursive:true});
try{
  const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
  await blockExternal(context);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.url,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    showAuthOverlay(false);hideLoader();switchPage('friends');userSeq=10;
    document.getElementById('friendMyId').textContent='#10';
    _profileCache.demo={name:'Геральт',seq:1};_friendsCache=['demo'];_reqCache=[];_outCache=[];renderFriends();
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedId=value;}}});
  });
  check('three personal dashboard cards',await page.locator('#msgPeoplePane>.message-card').count()===3);
  check('exactly one visible sync control, in top toolbar',await page.locator('.sync-pill:visible').count()===1&&await page.locator('.workspace-tools>.sync-pill:visible').count()===1);
  await page.getByRole('button',{name:'Скопировать ID',exact:true}).click();
  check('copy icon copies actual ID',await page.evaluate(()=>copiedId==='10'));
  await page.locator('#friendSearch').fill('никого');
  check('search shows empty result',await page.locator('#friendsList').innerText().then(s=>s.includes('Никого не найдено')));
  await page.locator('#friendSearch').fill('#1');
  check('search by ID finds friend',await page.locator('#friendsList .friend-name').innerText()==='Геральт');
  await page.evaluate(()=>{window.openChat=id=>{window.openedPeer=id;};});
  await page.getByRole('button',{name:'Открыть чат с Геральт'}).click();
  check('friend still opens its chat',await page.evaluate(()=>openedPeer==='demo'));
  await page.locator('.message-find-button').click();
  check('lookup validates empty ID',await page.locator('#friendAddMsg').innerText()==='Введи номер');
  await page.locator('#friendAddInput').fill('10');await page.locator('#friendAddInput').press('Enter');
  check('Enter performs lookup and rejects own ID',await page.locator('#friendAddMsg').innerText()==='Это твой ID');
  await page.locator('#friendAddInput').clear();
  await page.evaluate(()=>document.getElementById('friendAddMsg').textContent='');
  for(const light of [false,true]){
    await page.evaluate(light=>document.body.classList.toggle('light',light),light);
    for(const width of [320,390,768,999,1000,1241,1440]){
      await page.setViewportSize({width,height:960});
      check('square cards and no horizontal overflow '+width+' '+(light?'light':'dark'),await page.evaluate(()=>{
        const cards=[...document.querySelectorAll('#msgPeoplePane>.message-card')];
        const tools=document.querySelector('.workspace-tools').getBoundingClientRect();
        return document.documentElement.scrollWidth<=innerWidth+1&&tools.left>=0&&tools.right<=innerWidth+1&&cards.every(el=>{
          const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)<2&&r.left>=0&&r.right<=innerWidth+1;
        });
      }));
      if(width===390||width===1440)await page.screenshot({path:`artifacts/design/messages-${light?'light':'dark'}-${width}.png`,fullPage:true});
    }
  }
  await page.evaluate(()=>{
    _reqCache=['demo'];_friendsCache=Array.from({length:30},(_,i)=>'peer'+i);
    _friendsCache.forEach(id=>_profileCache[id]={name:'Длинное имя друга для проверки',seq:2});renderFriends();
  });
  check('requests remain visible and long contact list scrolls inside card',await page.evaluate(()=>{
    const list=document.querySelector('.message-friends-card .message-card-list');
    return document.getElementById('friendReqWrap').style.display!=='none'&&list.scrollHeight>list.clientHeight&&getComputedStyle(list).overflowY==='auto';
  }));
  await page.locator('#msgGroupsTab').click();
  check('groups tab opens dashboard and hides personal cards',await page.locator('#msgGroupsPane').isVisible()&&!await page.locator('#msgPeoplePane').isVisible());
  check('friend picker remains usable',await page.locator('#groupMemberPicker input').count()===30);
  await page.locator('#groupMemberPicker input').first().check();
  await page.evaluate(()=>msgV2RenderMembers());
  check('member selection survives rerender',await page.locator('#groupMemberPicker input').first().isChecked());
  await page.locator('#msgPeopleTab').click();
  check('personal tab restores dashboard',await page.locator('#msgPeoplePane').isVisible()&&await page.locator('#msgPeopleTab').getAttribute('aria-pressed')==='true');
  check('no uncaught browser errors',errors.length===0);
  console.log(`messages tests OK: ${assertions} assertions`);
}finally{await browser.close();await server.close();}
