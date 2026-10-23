import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {testServer,blockExternal} from './test-server.mjs';

const server = await testServer();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
let assertions = 0;
const check = (name,value) => { assert.ok(value,name); assertions++; console.log('PASS:',name); };
try {
  const context = await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
  await blockExternal(context);
  const page = await context.newPage();
  const errors = []; page.on('pageerror',error => errors.push(error.message));
  const open = async () => {
    await page.goto(server.url,{waitUntil:'networkidle'});
    await page.evaluate(() => { showAuthOverlay(false); hideLoader(); });
  };
  await open();
  await page.keyboard.press('Tab');
  check('closed dialogs do not trap Tab',await page.evaluate(() => !document.activeElement.closest('.modal-overlay')));
  await page.evaluate(() => { document.querySelector('[onclick="openTplModal()"]').focus(); openTplModal(); });
  await page.waitForFunction(() => document.getElementById('tplModal').contains(document.activeElement));
  await page.keyboard.press('Shift+Tab');
  check('Tab stays in the opened dialog',await page.evaluate(() => document.getElementById('tplModal').contains(document.activeElement)));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('tplModal').classList.contains('open'));
  check('Escape restores the opener',await page.evaluate(() => document.activeElement.getAttribute('onclick') === 'openTplModal()'));
  await page.keyboard.press('Control+k'); await page.locator('#workspaceFind').fill('архив'); await page.locator('#workspaceFind').press('Enter');
  check('section search navigates to archive',await page.locator('.page.active').getAttribute('id') === 'page-archive');

  for (const light of [false,true]) {
    await page.evaluate(light => { document.body.classList.toggle('light',light); switchPage('work'); },light);
    for (const width of [320,390,768,999,1000,1440]) {
      await page.setViewportSize({width,height:900});
      check(`calendar fits at ${width}px (${light?'light':'dark'})`,await page.evaluate(() => {
        const grid = document.getElementById('dayStrip'), right = grid.getBoundingClientRect().right;
        const cells = [...grid.querySelectorAll('.day-cell')];
        return cells.every(cell => cell.getBoundingClientRect().right <= right + 1) && cells.every((cell,i) => {
          const a=cell.getBoundingClientRect(), b=cells[i+1]?.getBoundingClientRect();
          return !b || Math.abs(a.top-b.top)>1 || a.right <= b.left+1;
        });
      }));
    }
  }
  check('tax label and undo match calculation',await page.evaluate(() => {
    days={1:[{id:1,name:'Тест',qty:1,price:10000}]};bonuses=[];expenseItems=[{id:1,amount:100}];taxEnabled=true;renderTaxToggle();renderTotal();
    const correct=calcTotal()===8700 && document.getElementById('tvtGross').textContent==='До расходов';
    const snapshot=periodSnapshot();shiftPeriod(1);taxEnabled=false;renderTaxToggle();restorePeriodSnapshot(snapshot);
    return correct && taxEnabled && document.getElementById('taxToggle').classList.contains('on') && document.getElementById('taxToggle').getAttribute('aria-checked')==='true';
  }));
  check('each period remembers its day',await page.evaluate(() => {
    goToHistory('2020-1',1);selectDay(3);goToHistory('2020-1',2);selectDay(20);goToHistory('2020-1',1);
    return selectedDay===3 && getComputedStyle(document.getElementById('dayPanel')).display!=='none';
  }));
  await open();
  check('remembered day survives reload',await page.evaluate(() => {goToHistory('2020-1',1);return selectedDay===3;}));
  await page.evaluate(() => {
    _friendsCache=[];msgV2ShowTab('groups');_friendsCache=['peer'];_profileCache.peer={name:'Друг',seq:2};renderFriends();
    window.testOpenedPeer=null;window.openChat=id=>window.testOpenedPeer=id;switchPage('friends');msgV2ShowTab('people');
  });
  check('group members refresh after friends arrive',await page.locator('#groupMemberPicker input').count() === 1);
  await page.locator('#friendsList .friend-open').focus();await page.keyboard.press('Enter');
  check('keyboard opens a personal chat',await page.evaluate(() => testOpenedPeer==='peer'));

  await page.evaluate(() => {
    currentUser={id:'test-user'};msgV2PrepareChat('room:A');msgV2.room={id:'A'};_chatFriend={id:'room:A'};
    document.getElementById('workCardTitle').value='Сборка';document.getElementById('workCardAmount').value='3';msgV2SaveWorkCard();
    msgV2PrepareChat('room:B');_chatFriend={id:'room:B'};msgV2PrepareChat('room:A');
  });
  check('work card survives switching chats',await page.evaluate(() => msgV2.kind==='work'&&msgV2.meta.title==='Сборка'&&msgV2.meta.amount==='3'));
  await open();
  check('structured draft survives reload and is account scoped',await page.evaluate(() => {
    currentUser={id:'other-user'};msgV2PrepareChat('room:A');const empty=document.getElementById('chatInput').value==='';
    msgV2ResetSession();currentUser={id:'test-user'};msgV2PrepareChat('room:A');
    return empty&&msgV2.kind==='work'&&msgV2.meta.title==='Сборка'&&msgV2.reply?.text.includes('Сборка');
  }));
  check('send is single, keeps its recipient and preserves a newer draft',await page.evaluate(async () => {
    msgV2ClearContext();msgV2.room={id:'A'};_chatFriend={id:'room:A'};document.getElementById('chatInput').value='В A';
    const rows=[];let resolve;sbClient={from:()=>({insert:row=>{rows.push(row);return new Promise(r=>resolve=r);}})};window.loadChatMessages=async()=>{};
    const sending=chatSend();await chatSend();msgV2PrepareChat('room:B');msgV2.room={id:'B'};_chatFriend={id:'room:B'};document.getElementById('chatInput').value='В B';msgV2SaveDraft();resolve({error:null});await sending;
    return rows.length===1&&rows[0].room_id==='A'&&rows[0].body==='В A'&&document.getElementById('chatInput').value==='В B'&&!localStorage.getItem('salary-chat-draft:test-user:room:A');
  }));
  check('failed send persists the draft',await page.evaluate(async () => {
    sbClient={from:()=>({insert:async()=>({error:{message:'offline'}})})};await chatSend();
    return document.getElementById('chatInput').value==='В B'&&JSON.parse(localStorage.getItem('salary-chat-draft:test-user:room:B')).text==='В B'&&!document.getElementById('chatSendBtn').disabled;
  }));
  check('unchanged chat retries failed media without replacing messages',await page.evaluate(async () => {
    switchPage('chat');let calls=0;
    const image='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    sbClient={functions:{invoke:async()=>++calls===1?{error:{message:'offline'}}:{data:{url:image}}}};msgV2Rendered='';msgV2MediaUrls.clear();
    const rows=[{id:1,sender:'peer',text:'Фото',kind:'image',meta:{name:'Фото'},t:new Date().toISOString(),reactions:[]}];
    renderChat(rows);await new Promise(r=>setTimeout(r,20));const node=document.querySelector('[data-msg-media]');
    node.dataset.mediaRetryAt='0';renderChat(rows);await new Promise(r=>setTimeout(r,20));
    return calls===2&&document.querySelector('[data-msg-media]')===node&&node.src===image&&!node.closest('.cb-media').classList.contains('media-error');
  }));
  check('leaving chat cancels recording and microphone tracks',await page.evaluate(() => {
    let stopped=0,tracks=0;msgV2Recorder={state:'recording',stop(){stopped++;this.state='inactive';},stream:{getTracks:()=>[{stop(){tracks++;}}]}};
    msgV2LeaveChat();return stopped===1&&tracks===1;
  }));
  check('no uncaught browser errors',errors.length===0);
  console.log(`workspace tests OK: ${assertions} assertions`);
} finally { await browser.close(); await server.close(); }
