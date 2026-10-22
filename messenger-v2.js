/* Worker Messenger v2: replies, edits, reactions, search, pins, work cards,
   forwarding, presence, moderation and protected group rooms. */
var msgV2={room:null,reply:null,edit:null,forward:null,kind:'text',meta:{},pinnedOnly:false,typing:null,presence:null,lastSeen:null,online:false};
var msgV2BaseOpenActions=window.openMsgActions;
var msgV2LastLoadError='',msgV2LastLoadErrorAt=0;
var msgV2MediaUrls=new Map(),msgV2PresenceTimer=null;
var msgV2Sending=false,msgV2CreatingGroup=false,msgV2Rendered='',msgV2Drafts=new Map(),msgV2RequestedPeer=null,msgV2DraftOwner=null;

function msgV2DraftKey(peer){return currentUser?.id&&peer?currentUser.id+':'+peer:null;}
function msgV2SaveDraft(){
  if(msgV2DraftOwner!==currentUser?.id)return;
  const key=msgV2DraftKey(msgV2RequestedPeer||_chatFriend?.id),input=document.getElementById('chatInput');
  if(key&&input&&!msgV2.edit){if(input.value)msgV2Drafts.set(key,input.value);else msgV2Drafts.delete(key);}
}
function msgV2PrepareChat(peer){
  msgV2SaveDraft();msgV2CancelVoice();stopChatPoll();msgV2ClearContext();msgV2RequestedPeer=peer;msgV2DraftOwner=currentUser?.id;msgV2Rendered='';
  msgV2.pinnedOnly=false;document.getElementById('chatSearch').value='';
  const pinned=document.querySelector('[onclick="msgV2TogglePinned()"]');if(pinned)pinned.setAttribute('aria-pressed','false');
  document.getElementById('chatTyping').textContent='';
  const input=document.getElementById('chatInput');input.value=msgV2Drafts.get(msgV2DraftKey(peer))||'';chatInputResize(input);
}
function msgV2LeaveChat(){
  msgV2SaveDraft();msgV2CancelVoice();msgV2RequestedPeer=null;
  clearTimeout(msgV2.typing);
  if(msgV2.presence){const channel=msgV2.presence;msgV2.presence=null;void sbClient?.removeChannel(channel);}
}

async function msgV2MarkRead(peer){
  try{
    const{error}=await sbClient.rpc('message_mark_read',{peer});
    if(error)console.warn('message_mark_read',error);
  }catch(e){console.warn('message_mark_read',e);}
}

function msgV2ShowTab(tab){
  document.getElementById('msgPeoplePane').style.display=tab==='people'?'':'none';
  document.getElementById('msgGroupsPane').style.display=tab==='groups'?'':'none';
  document.getElementById('msgPeopleTab').classList.toggle('active',tab==='people');
  document.getElementById('msgGroupsTab').classList.toggle('active',tab==='groups');
  document.getElementById('msgPeopleTab').setAttribute('aria-pressed',String(tab==='people'));
  document.getElementById('msgGroupsTab').setAttribute('aria-pressed',String(tab==='groups'));
  if(tab==='groups'){msgV2RenderMembers();msgV2LoadGroups();}
}
function msgV2RenderMembers(){
  const box=document.getElementById('groupMemberPicker');if(!box)return;
  const checked=new Set([...box.querySelectorAll('input:checked')].map(input=>input.value));
  box.replaceChildren();
  for(const id of _friendsCache){
    const label=document.createElement('label');label.className='group-member';
    const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=checked.has(id);
    label.append(input,document.createTextNode(_pname(id)+' · '+_pseq(id)));box.append(label);
  }
  if(!_friendsCache.length)box.textContent='Добавьте друзей во вкладке «Личные», чтобы пригласить их в группу.';
}
async function msgV2LoadGroups(){
  const box=document.getElementById('groupsList');if(!box||!sbClient||!currentUser)return;
  box.innerHTML='<div class="friend-empty">Загрузка…</div>';
  try{
    const{data,error}=await sbClient.from('chat_members').select('room_id,role,chat_rooms(id,title,owner_id,updated_at)').eq('user_id',currentUser.id);
    if(error)throw error;
    box.replaceChildren();
    for(const item of data||[]){
      const room=item.chat_rooms;if(!room)continue;
      const row=document.createElement('button');row.type='button';row.className='friend-row';row.style.width='100%';row.style.textAlign='left';
      row.innerHTML=`<span class="friend-av" aria-hidden="true">👥</span><span class="friend-info"><span class="friend-name">${esc(room.title)}</span><span class="friend-id" style="display:block">${item.role==='owner'?'Руководитель':'Участник'}</span></span>`;
      row.addEventListener('click',()=>msgV2OpenGroup(room.id,room.title));box.append(row);
    }
    if(!box.childElementCount)box.innerHTML='<div class="friend-empty">Групп пока нет. Создайте рабочий чат выше.</div>';
  }catch(e){box.innerHTML='<div class="friend-empty">Не удалось загрузить группы. <button class="ui-button" onclick="msgV2LoadGroups()">Повторить</button></div>';}
}
async function msgV2CreateGroup(){
  if(msgV2CreatingGroup||!currentUser||!sbClient)return;
  const inp=document.getElementById('groupTitleInput'),title=(inp.value||'').trim();if(!title){toast('Введите название');return;}
  const selected=[...document.querySelectorAll('#groupMemberPicker input:checked')].map(input=>input.value).filter(id=>_friendsCache.includes(id));
  if(!selected.length){toast('Выберите хотя бы одного участника');return;}
  if(selected.length>50){toast('Можно выбрать до 50 участников');return;}
  const button=document.getElementById('groupCreateBtn');msgV2CreatingGroup=true;button.disabled=true;button.textContent='Создаём…';
  try{
    const{data,error}=await sbClient.rpc('room_create',{room_title:title,member_ids:selected});
    if(error)throw error;
    inp.value='';toast('Рабочий чат создан');await msgV2LoadGroups();if(data)await msgV2OpenGroup(data,title);
  }catch(e){toast('Не удалось создать чат. Попробуйте ещё раз.');}
  finally{msgV2CreatingGroup=false;button.disabled=false;button.textContent='Создать';}
}
async function msgV2OpenGroup(id,title){
  msgV2PrepareChat('room:'+id);stopChatPoll();
  msgV2.room={id,title};_chatFriend={id:'room:'+id,pubkey:null};
  document.getElementById('chatTitle').textContent=title;
  document.getElementById('chatAvatar').textContent='👥';
  document.getElementById('chatSub').textContent='🛡 защищённый групповой чат';
  _chatMsgs=[];_chatSig='';document.getElementById('chatMessages').innerHTML='<div class="chat-empty">Загрузка…</div>';
  switchPage('chat');await loadChatMessages();
  if(msgV2RequestedPeer==='room:'+id){startChatPoll();msgV2StartPresence();}
}
var msgV2BaseOpenChat=window.openChat;
window.openChat=async function(fid){msgV2PrepareChat(fid);msgV2.room=null;await msgV2BaseOpenChat(fid);if(msgV2RequestedPeer!==fid)return;document.getElementById('chatAvatar').textContent=_avatar(fid);msgV2StartPresence();};

async function msgV2FetchReactions(ids){
  if(!ids.length)return{};
  const{data}=await sbClient.from('message_reactions').select('message_id,user_id,emoji').in('message_id',ids);
  const out={};(data||[]).forEach(r=>{(out[r.message_id]??=[]).push(r)});return out;
}
window.loadChatMessages=async function(){
  if(!_chatFriend||!currentUser||!sbClient||_chatLoading)return;_chatLoading=true;
  const friend={..._chatFriend},room=msgV2.room?{...msgV2.room}:null,userId=currentUser.id;
  const stillHere=()=>currentUser?.id===userId&&_chatFriend?.id===friend.id&&document.getElementById('page-chat').classList.contains('active');
  try{
    // Some older/new accounts have not published an E2EE key yet. The legacy
    // chat handled this as an informational empty state; v2 used to continue
    // into msgConvKey(), throw, and repeat a toast on every 4-second poll.
    if(!room&&!friend.pubkey){
      renderChat([{system:'У собеседника ещё нет ключа шифрования. Попросите его открыть приложение и вкладку «Профиль».'}]);
      return;
    }
    let q=sbClient.from('messages').select('id,sender,recipient,room_id,body,created_at,client_id,read_at,reply_to,edited_at,kind,metadata,forwarded_from').order('created_at',{ascending:false}).limit(300);
    q=room?q.eq('room_id',room.id):q.or(`and(sender.eq.${userId},recipient.eq.${friend.id}),and(sender.eq.${friend.id},recipient.eq.${userId})`);
    const{data,error}=await q;if(error)throw error;
    const rows=(data||[]).reverse().filter(m=>!hiddenMsgsGet()[m.id]),reactions=await msgV2FetchReactions(rows.map(x=>x.id));
    if(!stillHere())return;
    let key=null;if(!room){
      await msgEnsureKeys();
      if(_msgIdentityForeign){if(stillHere())renderChat([{system:'Откройте приложение на устройстве с ключом переписки, чтобы синхронизировать его.'}]);return;}
      key=await msgConvKey(friend.id,friend.pubkey);
    }
    const texts={};const out=[];
    for(const m of rows){
      const text=String(room?m.body:await msgDecrypt(key,m.body)??'');texts[m.id]=text;
      out.push({id:m.id,clientId:m.client_id,me:m.sender===currentUser.id,sender:m.sender,text,t:m.created_at,readAt:m.read_at,status:'sent',replyTo:m.reply_to,replyText:texts[m.reply_to]||'',editedAt:m.edited_at,kind:m.kind||'text',meta:m.metadata||{},forwardedFrom:m.forwarded_from,reactions:reactions[m.id]||[]});
    }
    if(!stillHere())return;
    _chatMsgs=out;renderChat(out);if(!room){void msgV2MarkRead(friend.id);markReadNow(friend.id);clearUnread(friend.id);}
    msgV2LastLoadError='';
  }catch(e){
    const detail=(e&&e.message)||String(e||'Неизвестная ошибка');
    console.warn('v2 load',detail,e);
    const now=Date.now();
    // Polling is expected to retry silently. Show one actionable notification
    // per distinct error, at most once a minute, instead of spamming the user.
    if(stillHere()&&(detail!==msgV2LastLoadError||now-msgV2LastLoadErrorAt>60000)){
      msgV2LastLoadError=detail;msgV2LastLoadErrorAt=now;
      toast('Не удалось обновить чат: '+detail);
    }
  }finally{_chatLoading=false;}
};
window.chatSend=async function(){
  const inp=document.getElementById('chatInput');if(!inp||!_chatFriend||!currentUser||!sbClient||msgV2Sending)return;
  if(msgV2RequestedPeer!==_chatFriend.id){toast('Подождите, чат загружается');return;}
  let text=(inp.value||'').trim().slice(0,4000);if(!text&&msgV2.kind==='text')return;
  const friend={..._chatFriend},room=msgV2.room?{...msgV2.room}:null,userId=currentUser.id;
  if(!room&&!friend.pubkey){toast('У собеседника ещё нет ключа шифрования');return;}
  const original=inp.value,edit=msgV2.edit,reply=msgV2.reply,forward=msgV2.forward,kind=msgV2.kind,meta={...msgV2.meta};
  const btn=document.getElementById('chatSendBtn');msgV2Sending=true;btn.disabled=true;btn.setAttribute('aria-busy','true');
  try{
    if(!room){await msgEnsureKeys();if(_msgIdentityForeign)throw new Error('Ключ переписки находится на другом устройстве. Откройте приложение там.');}
    if(currentUser?.id!==userId)return;
    const body=room?text:await msgEncrypt(await msgConvKey(friend.id,friend.pubkey),text);
    if(edit){
      const{error}=await sbClient.from('messages').update({body,edited_at:new Date().toISOString()}).eq('id',edit.id).eq('sender',userId);if(error)throw error;
    }else{
      const row={sender:userId,recipient:room?null:friend.id,room_id:room?.id||null,body,client_id:chatClientId(),reply_to:reply?.id||null,forwarded_from:forward?.id||null,kind,metadata:meta};
      const{error}=await sbClient.from('messages').insert(row);if(error)throw error;
    }
    const draftKey=userId+':'+friend.id;
    if(msgV2Drafts.get(draftKey)===original)msgV2Drafts.delete(draftKey);
    if(currentUser?.id===userId&&_chatFriend?.id===friend.id){
      if(inp.value===original){inp.value='';chatInputResize(inp);}
      if(msgV2.edit===edit&&msgV2.reply===reply&&msgV2.forward===forward)msgV2ClearContext();
      msgV2SaveDraft();await loadChatMessages();
    }
    if(!room&&currentUser?.id===userId)pingFriend(friend.id);
    if(edit)toast('Сообщение изменено');
  }catch(e){toast(e.message?.includes('too many')?'Слишком много сообщений — подождите минуту':'Не отправлено. Текст сохранён в поле сообщения. '+(e.message||'Проверьте подключение.'));}
  finally{msgV2Sending=false;btn.disabled=false;btn.removeAttribute('aria-busy');}
};
window.renderChat=function(list){
  const box=document.getElementById('chatMessages');if(!box)return;
  const q=(document.getElementById('chatSearch')?.value||'').toLowerCase(),near=box.scrollHeight-box.scrollTop-box.clientHeight<100||!box.childElementCount;
  const rows=(list||[]).filter(m=>(!q||String(m.text||'').toLowerCase().includes(q))&&(!msgV2.pinnedOnly||m.meta?.pinned));
  const signature=JSON.stringify([_chatFriend?.id,q,msgV2.pinnedOnly,rows]);
  if(signature===msgV2Rendered)return;msgV2Rendered=signature;
  if(!rows.length){box.innerHTML=`<div class="chat-empty">${q?'Ничего не найдено. Измените запрос.':msgV2.pinnedOnly?'Закреплённых сообщений пока нет.':'Начните разговор — напишите первое сообщение.'}</div>`;return;}
  let lastDay='';
  box.innerHTML=rows.map(m=>{
    if(m.system)return`<div class="chat-empty">${esc(m.system)}</div>`;
    const day=new Date(m.t).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}),dayMark=day!==lastDay?`<div class="chat-day">${day}</div>`:'';lastDay=day;
    const state=m.me?(m.readAt?'✓✓':'✓'):'',name=msgV2.room&&!m.me?`<b>${esc(_pname(m.sender))}</b><br>`:'';
    const reply=m.replyTo?`<div class="cb-reply">↩ ${esc(m.replyText||'Сообщение')}</div>`:'';
    const work=m.kind==='work'?`<div class="cb-work">☑ ${esc(m.meta.title||'Рабочее задание')}<br><b>${esc(m.meta.amount||'')}</b> ${esc(m.meta.unit||'')}</div>`:'';
    const mime=String(m.meta?.type||''),isImage=m.kind==='image'||mime.startsWith('image/'),isVideo=mime.startsWith('video/');
    const media=isImage?`<button class="cb-media" onclick="event.stopPropagation();msgV2Download('${m.id}')" aria-label="Открыть фото"><img data-msg-media="${m.id}" alt="${esc(m.meta?.name||'Фото')}" loading="lazy"></button>`:isVideo?`<div class="cb-media cb-video" onclick="event.stopPropagation()"><video data-msg-media="${m.id}" controls preload="metadata" playsinline></video></div>`:'';
    const file=!media&&['image','file','voice'].includes(m.kind)?`<button class="chat-tool-btn" style="margin-top:7px" onclick="event.stopPropagation();msgV2Download('${m.id}')">${m.kind==='image'?'🖼 Фото':m.kind==='voice'?'▶ Голосовое':'📎 '+esc(m.meta.name||'Файл')}</button>`:'';
    const reacts=Object.entries((m.reactions||[]).reduce((a,r)=>(a[r.emoji]=(a[r.emoji]||0)+1,a),{})).map(([e,n])=>`<button class="cb-react" onclick="event.stopPropagation();msgV2React('${m.id}','${e}')">${e} ${n}</button>`).join('');
    return`${dayMark}<div class="chat-bubble ${m.me?'me':'them'} ${m.meta?.pinned?'pinned':''}" data-id="${m.id}">${name}${m.forwardedFrom?'<div class="cb-edited">↗ переслано</div>':''}${reply}${media}${esc(m.text)}${work}${file}<div class="cb-reactions">${reacts}</div><div class="cb-meta">${m.editedAt?'<span class="cb-edited">изменено</span>':''}<span class="cb-time">${new Date(m.t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} <span class="cb-state">${state}</span></span></div></div>`;
  }).join('');void msgV2HydrateMedia();if(near)box.scrollTop=box.scrollHeight;
};
window.openMsgActions=function(id,isMine){
  msgV2BaseOpenActions(id,isMine);document.getElementById('msgEditBtn').style.display=isMine?'':'none';document.getElementById('msgReportBtn').style.display=isMine?'none':'';document.getElementById('msgBlockBtn').style.display=(!isMine&&!msgV2.room)?'':'none';
};
function msgV2Target(){return _chatMsgs.find(x=>String(x.id)===String(_msgActTarget?.id));}
function msgV2SetContext(type,m){msgV2.reply=msgV2.edit=msgV2.forward=null;msgV2[type]=m;document.getElementById('chatContext').classList.add('show');document.getElementById('chatContextIcon').textContent=type==='edit'?'✎':type==='forward'?'↗':'↩';document.getElementById('chatContextText').textContent=m.text;document.getElementById('chatInput').focus();}
function msgV2ClearContext(){msgV2.reply=msgV2.edit=msgV2.forward=null;msgV2.kind='text';msgV2.meta={};document.getElementById('chatContext')?.classList.remove('show');}
async function msgV2Action(a){
  const m=msgV2Target();closeMsgActions();if(!m)return;
  if(a==='reply')msgV2SetContext('reply',m);
  if(a==='copy'){await navigator.clipboard.writeText(m.text);toast('Скопировано');}
  if(a==='edit'){msgV2SetContext('edit',m);document.getElementById('chatInput').value=m.text;}
  if(a==='forward')msgV2SetContext('forward',m);
  if(a==='pin'){m.meta={...(m.meta||{}),pinned:!m.meta?.pinned};const{error}=await sbClient.from('messages').update({metadata:m.meta}).eq('id',m.id).eq('sender',currentUser.id);if(error)toast('Закреплять может автор');else loadChatMessages();}
  if(a==='react'){const e=prompt('Реакция: 👍 ❤️ 😂 👏 ✅ 👀','👍');if(e)msgV2React(m.id,e);}
  if(a==='report'){const reason=prompt('Причина жалобы');if(reason)await sbClient.from('message_reports').insert({reporter:currentUser.id,message_id:m.id,reported_user:m.sender,reason});toast('Жалоба отправлена');}
  if(a==='block'){if(confirm('Заблокировать пользователя?')){await sbClient.from('user_blocks').upsert({blocker:currentUser.id,blocked:m.sender});toast('Пользователь заблокирован');switchPage('friends');}}
}
async function msgV2React(id,emoji){if(!['👍','❤️','😂','👏','✅','👀'].includes(emoji))return;const{error}=await sbClient.from('message_reactions').upsert({message_id:id,user_id:currentUser.id,emoji});if(error)toast(error.message);else loadChatMessages();}
function msgV2Search(){renderChat(_chatMsgs);}
function msgV2TogglePinned(){msgV2.pinnedOnly=!msgV2.pinnedOnly;document.querySelector('[onclick="msgV2TogglePinned()"]')?.setAttribute('aria-pressed',String(msgV2.pinnedOnly));renderChat(_chatMsgs);toast(msgV2.pinnedOnly?'Только закреплённые':'Все сообщения');}
function msgV2WorkCard(){
  if(!_chatFriend){toast('Сначала откройте чат');return;}
  const overlay=document.getElementById('workCardOverlay');
  overlay?.classList.add('show');
  document.getElementById('workCardTitle').value='';
  document.getElementById('workCardAmount').value='1';
  document.getElementById('workCardUnit').value='шт.';
  setTimeout(()=>document.getElementById('workCardTitle')?.focus(),50);
}
function msgV2CloseWorkCard(){document.getElementById('workCardOverlay')?.classList.remove('show');}
function msgV2SaveWorkCard(){
  const title=document.getElementById('workCardTitle').value.trim().slice(0,120);
  const amount=document.getElementById('workCardAmount').value.trim();
  const unit=document.getElementById('workCardUnit').value;
  if(!title||!Number.isFinite(Number(amount))||Number(amount)<=0){toast('Заполните название и укажите количество больше нуля');return;}
  msgV2.kind='work';msgV2.meta={title,amount,unit};
  document.getElementById('chatInput').value='Карточка работы';
  msgV2SetContext('reply',{text:`${title}: ${amount} ${unit}`});
  msgV2CloseWorkCard();
  document.getElementById('chatInput')?.focus();
}
async function msgV2UploadBlob(file,kind,context){
  if(!file||!_chatFriend||!currentUser||!sbClient)return;
  if(!context&&msgV2RequestedPeer!==_chatFriend.id){toast('Подождите, чат загружается');return;}
  const ctx=context||{friend:{..._chatFriend},room:msgV2.room?{...msgV2.room}:null,userId:currentUser.id};
  const {friend,room,userId}=ctx;if(currentUser.id!==userId)return;
  if(!room&&!friend.pubkey){toast('У собеседника ещё нет ключа шифрования');return;}
  toast('Загружаю…');
  try{
    if(!room){await msgEnsureKeys();if(_msgIdentityForeign)throw new Error('Сначала синхронизируйте ключ переписки с другого устройства.');}
    const target={action:'upload',name:file.name||`${kind}.webm`,type:file.type,size:file.size,recipient:room?'':friend.id,room_id:room?.id||''};
    const{data,error}=await sbClient.functions.invoke('chat-files',{body:target});if(error||data?.error)throw new Error(await msgV2InvokeError(error,data));
    const up=await sbClient.storage.from('chat-files').uploadToSignedUrl(data.path,data.token,file,{contentType:file.type});if(up.error)throw up.error;
    if(currentUser?.id!==userId)return;
    const text=kind==='image'?'Фото':kind==='voice'?'Голосовое сообщение':file.type.startsWith('video/')?'Видео':'Файл';
    const body=room?text:await msgEncrypt(await msgConvKey(friend.id,friend.pubkey),text);
    const{error:ie}=await sbClient.from('messages').insert({sender:userId,recipient:room?null:friend.id,room_id:room?.id||null,body,client_id:chatClientId(),kind,metadata:{path:data.path,name:file.name||text,type:file.type,size:file.size}});
    if(ie)throw ie;
    if(_chatFriend?.id===friend.id)await loadChatMessages();
    if(!room&&currentUser?.id===userId)pingFriend(friend.id);
    toast('Файл отправлен');
  }catch(e){toast('Не удалось отправить файл: '+(e.message||'проверьте подключение'));}
}
async function msgV2UploadFile(input){const f=input.files?.[0];input.value='';if(!f)return;await msgV2UploadBlob(f,f.type.startsWith('image/')?'image':'file');}
async function msgV2MediaUrl(id){
  const cached=msgV2MediaUrls.get(String(id));
  if(cached&&cached.expires>Date.now())return cached.url;
  const{data,error}=await sbClient.functions.invoke('chat-files',{body:{action:'download',message_id:Number(id)}});
  if(error||data?.error){console.warn('media preview',data?.error||error);return'';}
  msgV2MediaUrls.set(String(id),{url:data.url,expires:Date.now()+4*60*1000});
  return data.url;
}
async function msgV2InvokeError(error,data){
  if(data?.error)return data.error;
  try{
    const payload=await error?.context?.clone?.().json();
    if(payload?.error)return payload.error;
  }catch(_){}
  return error?.message||'ошибка сервера';
}
async function msgV2HydrateMedia(){
  const nodes=[...document.querySelectorAll('[data-msg-media]:not([data-media-loading])')];
  await Promise.all(nodes.map(async el=>{
    el.dataset.mediaLoading='1';
    const url=await msgV2MediaUrl(el.dataset.msgMedia);
    if(url)el.src=url;else el.closest('.cb-media')?.classList.add('media-error');
  }));
}
async function msgV2Download(id){const{data,error}=await sbClient.functions.invoke('chat-files',{body:{action:'download',message_id:Number(id)}});if(error||data?.error){toast(data?.error||error.message);return;}window.open(data.url,'_blank','noopener');}
var msgV2Recorder=null,msgV2VoiceParts=[],msgV2VoiceStarting=false,msgV2VoiceToken=0;
function msgV2CancelVoice(){
  msgV2VoiceToken++;
  if(msgV2Recorder&&msgV2Recorder.state==='recording'){msgV2Recorder.onstop=()=>{};msgV2Recorder.stop();msgV2Recorder.stream.getTracks().forEach(track=>track.stop());}
  const button=document.getElementById('chatVoiceBtn');if(button){button.textContent='🎙';button.setAttribute('aria-label','Записать голосовое сообщение');}
}
async function msgV2Voice(){
  const btn=document.getElementById('chatVoiceBtn');
  if(msgV2Recorder&&msgV2Recorder.state==='recording'){msgV2Recorder.stop();btn.textContent='🎙';return;}
  if(msgV2VoiceStarting||!_chatFriend||!currentUser)return;
  if(msgV2RequestedPeer!==_chatFriend.id){toast('Подождите, чат загружается');return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Браузер не поддерживает запись голосовых сообщений');return;}
  msgV2VoiceStarting=true;const token=++msgV2VoiceToken;
  const context={friend:{..._chatFriend},room:msgV2.room?{...msgV2.room}:null,userId:currentUser.id};
  let stream;
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    if(token!==msgV2VoiceToken){stream.getTracks().forEach(track=>track.stop());return;}
    const types=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'];
    const mime=types.find(t=>MediaRecorder.isTypeSupported?.(t))||'';
    const parts=[],recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);msgV2Recorder=recorder;
    recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
    recorder.onstop=async()=>{
      stream.getTracks().forEach(t=>t.stop());
      btn.textContent='🎙';btn.setAttribute('aria-label','Записать голосовое сообщение');
      if(token!==msgV2VoiceToken)return;
      const type=recorder.mimeType||mime||'audio/webm',base=type.split(';',1)[0],ext=base==='audio/mp4'?'m4a':base==='audio/ogg'?'ogg':'webm';
      const blob=new Blob(parts,{type});Object.defineProperty(blob,'name',{value:`voice.${ext}`});
      if(blob.size)await msgV2UploadBlob(blob,'voice',context);
    };
    recorder.start();btn.textContent='■';btn.setAttribute('aria-label','Остановить запись и отправить');toast('Запись началась — нажмите ещё раз для отправки');
  }catch(e){stream?.getTracks().forEach(track=>track.stop());toast(e?.name==='NotAllowedError'?'Нет доступа к микрофону':'Не удалось начать запись: '+(e?.message||e));}
  finally{msgV2VoiceStarting=false;}
}
var msgV2LastTyping=0;
function msgV2Typing(){
  msgV2SaveDraft();
  if(!sbClient||!_chatFriend||!currentUser||!msgV2.presence||Date.now()-msgV2LastTyping<900)return;
  msgV2LastTyping=Date.now();
  void msgV2.presence.send({type:'broadcast',event:'typing',payload:{from:currentUser.id}});
}
function msgV2FormatLastSeen(value){
  if(!value)return'был(а) в сети давно';
  const d=new Date(value);if(Number.isNaN(d.getTime()))return'был(а) в сети недавно';
  const now=new Date(),same=d.toDateString()===now.toDateString();
  const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);
  const time=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  if(same)return`был(а) сегодня в ${time}`;
  if(d.toDateString()===yesterday.toDateString())return`был(а) вчера в ${time}`;
  return`был(а) ${d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'})} в ${time}`;
}
function msgV2RenderPresence(online){
  if(msgV2.room)return;
  const sub=document.getElementById('chatSub');if(!sub||!_chatFriend)return;
  sub.textContent=online?`🟢 в сети · ${_pseq(_chatFriend.id)}`:`${msgV2FormatLastSeen(msgV2.lastSeen)} · ${_pseq(_chatFriend.id)}`;
}
async function msgV2LoadLastSeen(){
  if(msgV2.room||!_chatFriend?.id)return;
  const friendId=_chatFriend.id;
  const{data,error}=await sbClient.from('profiles').select('last_seen_at').eq('user_id',friendId).maybeSingle();
  if(!error&&_chatFriend?.id===friendId){msgV2.lastSeen=data?.last_seen_at||null;msgV2RenderPresence(msgV2.online);}
}
async function msgV2TouchLastSeen(){
  if(!sbClient||!currentUser?.id)return;
  const now=new Date().toISOString();
  const{error}=await sbClient.from('profiles').update({last_seen_at:now}).eq('user_id',currentUser.id);
  if(error)console.warn('last_seen_at',error);
}
function msgV2StartPresence(){
  if(!sbClient||!currentUser||!_chatFriend)return;
  if(msgV2.presence)try{sbClient.removeChannel(msgV2.presence)}catch(_){}
  msgV2.lastSeen=null;msgV2.online=false;void msgV2LoadLastSeen();void msgV2TouchLastSeen();
  const topic=msgV2.room?'room-presence-'+msgV2.room.id:'typing-'+[currentUser.id,_chatFriend.id].sort().join('-');
  const channel=sbClient.channel(topic);msgV2.presence=channel;
  channel.on('broadcast',{event:'typing'},({payload})=>{if(msgV2.presence===channel&&payload.from!==currentUser?.id){const el=document.getElementById('chatTyping');el.textContent='печатает…';clearTimeout(msgV2.typing);msgV2.typing=setTimeout(()=>el.textContent='',1300)}}).on('presence',{event:'sync'},()=>{
    if(msgV2.presence!==channel||!_chatFriend)return;
    const people=Object.values(channel.presenceState()).flat(),ids=new Set(people.map(p=>p.user_id).filter(Boolean));
    const sub=document.getElementById('chatSub');
    if(msgV2.room)sub.textContent=`🛡 защищено · онлайн ${ids.size}`;
    else{msgV2.online=ids.has(_chatFriend.id);msgV2RenderPresence(msgV2.online);}
  }).subscribe(s=>{if(s==='SUBSCRIBED'&&msgV2.presence===channel&&currentUser)channel.track({user_id:currentUser.id,online_at:new Date().toISOString()})});
}
msgV2PresenceTimer=setInterval(()=>{if(document.visibilityState==='visible')void msgV2TouchLastSeen()},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void msgV2TouchLastSeen()});
setTimeout(()=>void msgV2TouchLastSeen(),2000);
