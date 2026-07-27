/* Worker Messenger v2: replies, edits, reactions, search, pins, work cards,
   forwarding, presence, moderation and protected group rooms. */
var msgV2={room:null,reply:null,edit:null,forward:null,kind:'text',meta:{},pinnedOnly:false,typing:null,presence:null,lastSeen:null,online:false};
var msgV2BaseOpenActions=window.openMsgActions;
var msgV2LastLoadError='',msgV2LastLoadErrorAt=0;
var msgV2MediaUrls=new Map(),msgV2PresenceTimer=null;

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
  if(tab==='groups')msgV2LoadGroups();
}
async function msgV2LoadGroups(){
  const box=document.getElementById('groupsList');if(!box||!sbClient||!currentUser)return;
  box.innerHTML='<div class="friend-empty">Загрузка…</div>';
  const{data,error}=await sbClient.from('chat_members').select('room_id,role,chat_rooms(id,title,owner_id,updated_at)').eq('user_id',currentUser.id);
  if(error){box.innerHTML='<div class="friend-empty">Не удалось загрузить группы</div>';return;}
  box.innerHTML=(data||[]).map(x=>{const r=x.chat_rooms;return`<div class="friend-row" onclick="msgV2OpenGroup('${r.id}','${esc(r.title)}')"><div class="friend-av">👥</div><div class="friend-info"><div class="friend-name">${esc(r.title)}</div><div class="friend-id">${x.role==='owner'?'Руководитель':'Участник'}</div></div></div>`}).join('')||'<div class="friend-empty">Групп пока нет</div>';
}
async function msgV2CreateGroup(){
  const inp=document.getElementById('groupTitleInput'),title=(inp.value||'').trim();if(!title){toast('Введите название');return;}
  const selected=_friendsCache.slice(0,50);
  const{data,error}=await sbClient.rpc('room_create',{room_title:title,member_ids:selected});
  if(error){toast('Не удалось создать: '+error.message);return;}
  inp.value='';toast('Рабочий чат создан');await msgV2LoadGroups();if(data)msgV2OpenGroup(data,title);
}
async function msgV2OpenGroup(id,title){
  msgV2.room={id,title};_chatFriend={id:'room:'+id,pubkey:null};
  document.getElementById('chatTitle').textContent=title;
  document.getElementById('chatAvatar').textContent='👥';
  document.getElementById('chatSub').textContent='🛡 защищённый групповой чат';
  _chatMsgs=[];_chatSig='';switchPage('chat');await loadChatMessages();msgV2StartPresence();
}
var msgV2BaseOpenChat=window.openChat;
window.openChat=async function(fid){msgV2.room=null;await msgV2BaseOpenChat(fid);document.getElementById('chatAvatar').textContent=_avatar(fid);msgV2StartPresence();};

async function msgV2FetchReactions(ids){
  if(!ids.length)return{};
  const{data}=await sbClient.from('message_reactions').select('message_id,user_id,emoji').in('message_id',ids);
  const out={};(data||[]).forEach(r=>{(out[r.message_id]??=[]).push(r)});return out;
}
window.loadChatMessages=async function(){
  if(!_chatFriend||!currentUser||!sbClient||_chatLoading)return;_chatLoading=true;
  try{
    // Some older/new accounts have not published an E2EE key yet. The legacy
    // chat handled this as an informational empty state; v2 used to continue
    // into msgConvKey(), throw, and repeat a toast on every 4-second poll.
    if(!msgV2.room&&!_chatFriend.pubkey){
      renderChat([{system:'У собеседника ещё нет ключа шифрования. Попросите его открыть приложение и вкладку «Профиль».'}]);
      return;
    }
    let q=sbClient.from('messages').select('id,sender,recipient,room_id,body,created_at,client_id,read_at,reply_to,edited_at,kind,metadata,forwarded_from').order('created_at',{ascending:false}).limit(300);
    q=msgV2.room?q.eq('room_id',msgV2.room.id):q.or(`and(sender.eq.${currentUser.id},recipient.eq.${_chatFriend.id}),and(sender.eq.${_chatFriend.id},recipient.eq.${currentUser.id})`);
    const{data,error}=await q;if(error)throw error;
    const rows=(data||[]).reverse().filter(m=>!hiddenMsgsGet()[m.id]),reactions=await msgV2FetchReactions(rows.map(x=>x.id));
    let key=null;if(!msgV2.room){await msgEnsureKeys();key=await msgConvKey(_chatFriend.id,_chatFriend.pubkey);}
    const texts={};const out=[];
    for(const m of rows){
      const text=String(msgV2.room?m.body:await msgDecrypt(key,m.body)??'');texts[m.id]=text;
      out.push({id:m.id,clientId:m.client_id,me:m.sender===currentUser.id,sender:m.sender,text,t:m.created_at,readAt:m.read_at,status:'sent',replyTo:m.reply_to,replyText:texts[m.reply_to]||'',editedAt:m.edited_at,kind:m.kind||'text',meta:m.metadata||{},forwardedFrom:m.forwarded_from,reactions:reactions[m.id]||[]});
    }
    _chatMsgs=out;renderChat(out);if(!msgV2.room){void msgV2MarkRead(_chatFriend.id);markReadNow(_chatFriend.id);clearUnread(_chatFriend.id);}
    msgV2LastLoadError='';
  }catch(e){
    const detail=(e&&e.message)||String(e||'Неизвестная ошибка');
    console.warn('v2 load',detail,e);
    const now=Date.now();
    // Polling is expected to retry silently. Show one actionable notification
    // per distinct error, at most once a minute, instead of spamming the user.
    if(detail!==msgV2LastLoadError||now-msgV2LastLoadErrorAt>60000){
      msgV2LastLoadError=detail;msgV2LastLoadErrorAt=now;
      toast('Не удалось обновить чат: '+detail);
    }
  }finally{_chatLoading=false;}
};
window.chatSend=async function(){
  const inp=document.getElementById('chatInput');if(!inp||!_chatFriend)return;
  let text=(inp.value||'').trim().slice(0,4000);if(!text&&msgV2.kind==='text')return;
  if(msgV2.edit){
    try{const body=msgV2.room?text:await msgEncrypt(await msgConvKey(_chatFriend.id,_chatFriend.pubkey),text);const{error}=await sbClient.from('messages').update({body,edited_at:new Date().toISOString()}).eq('id',msgV2.edit.id).eq('sender',currentUser.id);if(error)throw error;msgV2ClearContext();inp.value='';await loadChatMessages();toast('Сообщение изменено');}catch(e){toast('Не удалось изменить: '+e.message)}return;
  }
  inp.value='';chatInputResize(inp);const clientId=chatClientId();
  try{
    const body=msgV2.room?text:await msgEncrypt(await msgConvKey(_chatFriend.id,_chatFriend.pubkey),text);
    const row={sender:currentUser.id,recipient:msgV2.room?null:_chatFriend.id,room_id:msgV2.room?.id||null,body,client_id:clientId,reply_to:msgV2.reply?.id||null,forwarded_from:msgV2.forward?.id||null,kind:msgV2.kind,metadata:msgV2.meta};
    const{error}=await sbClient.from('messages').insert(row);if(error)throw error;
    msgV2ClearContext();await loadChatMessages();if(!msgV2.room)pingFriend(_chatFriend.id);
  }catch(e){inp.value=text;toast(e.message?.includes('too many')?'Слишком много сообщений — подождите минуту':'Не отправлено: '+e.message);}
};
window.renderChat=function(list){
  const box=document.getElementById('chatMessages');if(!box)return;
  const q=(document.getElementById('chatSearch')?.value||'').toLowerCase(),near=box.scrollHeight-box.scrollTop-box.clientHeight<100||!box.childElementCount;
  const rows=(list||[]).filter(m=>(!q||String(m.text||'').toLowerCase().includes(q))&&(!msgV2.pinnedOnly||m.meta?.pinned));
  if(!rows.length){box.innerHTML='<div class="chat-empty">Сообщений не найдено</div>';return;}
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
function msgV2SetContext(type,m){msgV2[type]=m;document.getElementById('chatContext').classList.add('show');document.getElementById('chatContextIcon').textContent=type==='edit'?'✎':type==='forward'?'↗':'↩';document.getElementById('chatContextText').textContent=m.text;}
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
function msgV2TogglePinned(){msgV2.pinnedOnly=!msgV2.pinnedOnly;renderChat(_chatMsgs);toast(msgV2.pinnedOnly?'Только закреплённые':'Все сообщения');}
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
  if(!title||!amount){toast('Заполните название и количество');return;}
  msgV2.kind='work';msgV2.meta={title,amount,unit};
  document.getElementById('chatInput').value='Карточка работы';
  msgV2SetContext('reply',{text:`${title}: ${amount} ${unit}`});
  msgV2CloseWorkCard();
  document.getElementById('chatInput')?.focus();
}
async function msgV2UploadBlob(file,kind){
  if(!file||!_chatFriend)return;toast('Загружаю…');
  const target={action:'upload',name:file.name||`${kind}.webm`,type:file.type,size:file.size,recipient:msgV2.room?'':_chatFriend.id,room_id:msgV2.room?.id||''};
  const{data,error}=await sbClient.functions.invoke('chat-files',{body:target});if(error||data?.error){toast(data?.error||error.message);return;}
  const up=await sbClient.storage.from('chat-files').uploadToSignedUrl(data.path,data.token,file,{contentType:file.type});if(up.error){toast(up.error.message);return;}
  const text=kind==='image'?'Фото':kind==='voice'?'Голосовое сообщение':file.type.startsWith('video/')?'Видео':'Файл';
  const body=msgV2.room?text:await msgEncrypt(await msgConvKey(_chatFriend.id,_chatFriend.pubkey),text);
  const{error:ie}=await sbClient.from('messages').insert({sender:currentUser.id,recipient:msgV2.room?null:_chatFriend.id,room_id:msgV2.room?.id||null,body,client_id:chatClientId(),kind,metadata:{path:data.path,name:file.name||text,type:file.type,size:file.size}});
  if(ie){toast(ie.message);return;}await loadChatMessages();toast('Отправлено');
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
async function msgV2HydrateMedia(){
  const nodes=[...document.querySelectorAll('[data-msg-media]:not([data-media-loading])')];
  await Promise.all(nodes.map(async el=>{
    el.dataset.mediaLoading='1';
    const url=await msgV2MediaUrl(el.dataset.msgMedia);
    if(url)el.src=url;else el.closest('.cb-media')?.classList.add('media-error');
  }));
}
async function msgV2Download(id){const{data,error}=await sbClient.functions.invoke('chat-files',{body:{action:'download',message_id:Number(id)}});if(error||data?.error){toast(data?.error||error.message);return;}window.open(data.url,'_blank','noopener');}
var msgV2Recorder=null,msgV2VoiceParts=[];
async function msgV2Voice(){
  const btn=document.getElementById('chatVoiceBtn');
  if(msgV2Recorder&&msgV2Recorder.state==='recording'){msgV2Recorder.stop();btn.textContent='🎙';return;}
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});msgV2VoiceParts=[];msgV2Recorder=new MediaRecorder(stream);msgV2Recorder.ondataavailable=e=>{if(e.data.size)msgV2VoiceParts.push(e.data)};msgV2Recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(msgV2VoiceParts,{type:msgV2Recorder.mimeType||'audio/webm'});Object.defineProperty(blob,'name',{value:'voice.webm'});await msgV2UploadBlob(blob,'voice')};msgV2Recorder.start();btn.textContent='■';toast('Запись началась — нажмите ещё раз для отправки');}catch(e){toast('Нет доступа к микрофону');}
}
function msgV2Typing(){
  if(!sbClient||!_chatFriend)return;clearTimeout(msgV2.typing);
  const topic=msgV2.room?'room-presence-'+msgV2.room.id:'typing-'+[currentUser.id,_chatFriend.id].sort().join('-');
  const ch=sbClient.channel(topic);ch.subscribe(s=>{if(s==='SUBSCRIBED')ch.send({type:'broadcast',event:'typing',payload:{from:currentUser.id}})});setTimeout(()=>sbClient.removeChannel(ch),1200);
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
  if(msgV2.presence)try{sbClient.removeChannel(msgV2.presence)}catch(_){}
  msgV2.lastSeen=null;msgV2.online=false;void msgV2LoadLastSeen();void msgV2TouchLastSeen();
  const topic=msgV2.room?'room-presence-'+msgV2.room.id:'typing-'+[currentUser.id,_chatFriend.id].sort().join('-');
  msgV2.presence=sbClient.channel(topic).on('broadcast',{event:'typing'},({payload})=>{if(payload.from!==currentUser.id){const el=document.getElementById('chatTyping');el.textContent='печатает…';clearTimeout(msgV2.typing);msgV2.typing=setTimeout(()=>el.textContent='',1300)}}).on('presence',{event:'sync'},()=>{
    const people=Object.values(msgV2.presence.presenceState()).flat(),ids=new Set(people.map(p=>p.user_id).filter(Boolean));
    const sub=document.getElementById('chatSub');
    if(msgV2.room)sub.textContent=`🛡 защищено · онлайн ${ids.size}`;
    else{msgV2.online=ids.has(_chatFriend.id);msgV2RenderPresence(msgV2.online);}
  }).subscribe(s=>{if(s==='SUBSCRIBED')msgV2.presence.track({user_id:currentUser.id,online_at:new Date().toISOString()})});
}
msgV2PresenceTimer=setInterval(()=>{if(document.visibilityState==='visible')void msgV2TouchLastSeen()},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void msgV2TouchLastSeen()});
setTimeout(()=>void msgV2TouchLastSeen(),2000);
