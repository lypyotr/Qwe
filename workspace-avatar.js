/* Personal avatar UI; photo stays in the existing private profile settings. */
(() => {
  'use strict';
  const icon=name=>window.workspaceIcon(name);
  const dialog=document.createElement('dialog');
  dialog.id='workspaceAvatarDialog';
  dialog.className='workspace-avatar-dialog';
  dialog.setAttribute('aria-labelledby','workspaceAvatarTitle');
  dialog.innerHTML='<div class="avatar-dialog-heading"><h2 id="workspaceAvatarTitle">Настройки аватара</h2><button type="button" class="workspace-icon-button" id="avatarClose" aria-label="Закрыть">'+icon('close')+'</button></div>'+
    '<div class="avatar-preview" id="avatarPreview"></div><p class="avatar-description">Фото для вашего кабинета</p>'+
    '<input type="file" id="avatarFile" accept="image/*" hidden>'+
    '<button type="button" class="avatar-action" id="avatarChoose">'+icon('photo')+'<span>Выбрать фото</span></button>'+
    '<button type="button" class="avatar-action danger" id="avatarRemove">'+icon('trash')+'<span>Удалить фото</span></button>'+
    '<p class="avatar-error" id="avatarError" role="alert"></p>'+
    '<button type="button" class="avatar-save" id="avatarSave">Сохранить</button>';
  document.body.append(dialog);
  const byId=id=>document.getElementById(id);
  let draft='',owner='',generation=0,busy=false,closing=false,opener=null,animation=null;
  const account=()=>String(currentUser?.id||'local');
  const photo=value=>typeof value==='string'&&value.length<=160000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)?value:'';
  const initial=()=>String(goals?.profile?.name||'Р').trim().charAt(0).toUpperCase()||'Р';
  function paintAvatar(element,url){
    if(!element)return;
    element.replaceChildren();
    if(url){const img=document.createElement('img');img.alt='';img.src=url;img.draggable=false;element.append(img);}
    else element.textContent=initial();
  }
  function preview(){
    paintAvatar(byId('avatarPreview'),draft);
    byId('avatarRemove').disabled=!draft;
    byId('avatarSave').disabled=busy;
  }
  function setBusy(value){busy=value;byId('avatarChoose').disabled=value;byId('avatarSave').disabled=value;dialog.setAttribute('aria-busy',String(value));}
  function clear(){
    generation++;animation?.cancel();animation=null;closing=false;draft='';owner='';busy=false;byId('avatarFile').value='';
    byId('avatarError').textContent='';document.body.classList.remove('avatar-dialog-open');
  }
  function dismiss(immediate=false){
    if(!dialog.open)return;
    generation++;setBusy(false);
    if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){dialog.close();return;}
    if(closing)return;
    closing=true;animation?.cancel();
    animation=dialog.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.96)'}],{duration:120,easing:'ease-in',fill:'forwards'});
    animation.finished.then(()=>{if(dialog.open)dialog.close();}).catch(()=>{});
  }
  window.workspaceRenderAvatar=function(){
    paintAvatar(byId('workspaceAvatar'),photo(goals?.profile?.avatar));
    paintAvatar(byId('profileAvatar'),photo(goals?.profile?.avatar));
    if(dialog.open&&owner!==account())dismiss(true);
  };
  window.workspaceOpenAvatar=function(){
    if(!byId('authOverlay').classList.contains('hidden')||document.querySelector('dialog[open]')||document.querySelector('.modal-overlay.open,.work-card-overlay.show'))return;
    opener=document.activeElement;owner=account();draft=photo(goals?.profile?.avatar);generation++;closing=false;
    byId('avatarError').textContent='';setBusy(false);preview();dialog.showModal();document.body.classList.add('avatar-dialog-open');byId('avatarClose').focus();
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)animation=dialog.animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:160,easing:'cubic-bezier(.2,.7,.2,1)'});
  };
  byId('avatarClose').addEventListener('click',()=>dismiss());
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  dialog.addEventListener('close',()=>{clear();if(opener?.isConnected&&!opener.closest('[inert]'))opener.focus({preventScroll:true});opener=null;});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dismiss();
  });
  byId('avatarChoose').addEventListener('click',()=>byId('avatarFile').click());
  byId('avatarRemove').addEventListener('click',()=>{generation++;draft='';byId('avatarFile').value='';byId('avatarError').textContent='';setBusy(false);preview();});
  byId('avatarFile').addEventListener('change',async()=>{
    const file=byId('avatarFile').files?.[0];if(!file)return;
    const token=++generation,startedOwner=owner;
    byId('avatarError').textContent='';
    if(!/^image\//.test(file.type)||file.type==='image/svg+xml'){byId('avatarError').textContent='Выберите фотографию в формате JPG, PNG или другом формате изображения.';byId('avatarFile').value='';return;}
    if(file.size>20*1024*1024){byId('avatarError').textContent='Выберите фотографию меньше 20 МБ.';byId('avatarFile').value='';return;}
    setBusy(true);
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=url;await image.decode();
      if(!dialog.open||token!==generation||startedOwner!==account())return;
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
      const side=Math.min(image.naturalWidth,image.naturalHeight);
      if(!side)throw new Error('Empty image');
      ctx.fillStyle='#eef2ea';ctx.fillRect(0,0,256,256);
      ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,256,256);
      const result=canvas.toDataURL('image/jpeg',.82);
      if(!photo(result))throw new Error('Photo too large');
      draft=result;preview();
    }catch(_){if(token===generation&&dialog.open)byId('avatarError').textContent='Не удалось открыть фотографию. Попробуйте JPG или PNG.';}
    finally{URL.revokeObjectURL(url);if(token===generation){setBusy(false);preview();byId('avatarFile').value='';}}
  });
  byId('avatarSave').addEventListener('click',()=>{
    if(busy||closing)return;
    if(owner!==account()){dismiss(true);return;}
    const next={...goals,profile:{...goals?.profile,avatar:draft}};
    try{localStorage.setItem('salary_goals',JSON.stringify(next));}
    catch(_){byId('avatarError').textContent='Не удалось сохранить фото: на устройстве недостаточно места.';return;}
    goals=next;scheduleSettingsSave();workspaceRenderAvatar();toast('Аватар сохранён');dismiss();
  });
  workspaceRenderAvatar();
})();
