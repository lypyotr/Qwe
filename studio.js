/* Visual direction: a kinetic, editorial work journal. No account data changes. */
(() => {
  'use strict';
  document.body.classList.add('studio');
  const updateTheme=()=>document.querySelector('meta[name="theme-color"]').content=document.body.classList.contains('light')?'#efeee7':'#161a18';
  new MutationObserver(updateTheme).observe(document.body,{attributes:true,attributeFilter:['class']});updateTheme();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const motionDisabled=()=>localStorage.getItem('salary_motion')==='off'||(localStorage.getItem('salary_motion')!=='on'&&reduced.matches);
  const motionButton=document.createElement('button');
  motionButton.className='btn-secondary';motionButton.id='studioMotionToggle';
  const syncMotion=()=>{
    const enabled=!motionDisabled();
    document.body.classList.toggle('motion-full',enabled);
    document.body.classList.toggle('motion-off',!enabled);
    motionButton.textContent='Анимации: '+(enabled?'включены':'выключены');
    motionButton.setAttribute('aria-pressed',String(enabled));
  };
  motionButton.onclick=()=>{localStorage.setItem('salary_motion',motionDisabled()?'on':'off');syncMotion();};
  const themeControl=document.querySelector('#page-profile [onclick*="toggleTheme"]');
  if(themeControl)themeControl.after(motionButton);
  else document.querySelector('#page-profile').append(motionButton);
  reduced.addEventListener('change',syncMotion);syncMotion();
  const mark='<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M20 20h40L20 60h40" stroke="currentColor" stroke-width="7" stroke-linecap="square"/><circle cx="40" cy="40" r="36" stroke="currentColor" stroke-width="1.4"/></svg>';
  const orbit='<svg viewBox="0 0 300 300" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1"><ellipse cx="150" cy="150" rx="131" ry="43" transform="rotate(-45 150 150)"/><ellipse cx="150" cy="150" rx="131" ry="43" transform="rotate(15 150 150)"/><ellipse cx="150" cy="150" rx="131" ry="43" transform="rotate(75 150 150)"/><circle cx="150" cy="150" r="92"/><path d="M150 0v22M150 278v22M0 150h22M278 150h22"/></g><circle cx="216" cy="84" r="9" fill="currentColor"/><circle cx="150" cy="150" r="5" fill="currentColor"/></svg>';
  document.querySelectorAll('.brand-mark,.workspace-brand-icon,.auth-logo').forEach(el=>el.innerHTML=mark);
  const brand=document.querySelector('.nav-brand>div');
  if(brand)brand.innerHTML='Зарплата<span class="studio-brand-period">.</span>';
  document.querySelector('.workspace-brandbar>span:last-child').innerHTML='ЗАРПЛАТА<span class="studio-brand-period">.</span>';

  const nav=document.querySelector('.bottom-nav');
  const hero=document.getElementById('totalCard');
  const heroTop=document.createElement('div');heroTop.className='studio-hero-top';heroTop.innerHTML='<span>ТЕКУЩИЙ ПЕРИОД</span><span class="studio-asterisk" aria-hidden="true">✳</span>';
  hero.prepend(heroTop);
  const art=document.createElement('div');art.className='studio-orbit';art.innerHTML=orbit;art.setAttribute('aria-hidden','true');hero.append(art);
  // A presentation surface for visitors, separate from the functional login form.
  const auth=document.getElementById('authOverlay');
  const story=document.createElement('section');story.className='studio-auth-story';story.setAttribute('aria-label','Зарплата — личный учёт труда');
  story.innerHTML='<div class="studio-auth-brand">'+mark+'<span>ЗАРПЛАТА.</span><span class="studio-small">ЛИЧНЫЙ УЧЁТ ТРУДА</span></div><div class="studio-auth-heading"><span class="studio-small">УЧЁТ РАБОТЫ И ВЫПЛАТ</span><h1>Зарплата<br><em>по дням.</em></h1><div class="studio-auth-orbit">'+orbit+'</div></div><div class="studio-auth-bottom"><p>Смены, начисления,<br>премии и расходы.</p><a href="?demo=1" class="studio-demo-link">Исследовать демо <span aria-hidden="true">↗</span></a></div>';
  auth.prepend(story);
  const syncAuthLayer=()=>document.querySelectorAll('.page,.workspace-topbar,.bottom-nav,.studio-footer,.studio-demo-strip').forEach(el=>el.inert=!auth.classList.contains('hidden'));
  new MutationObserver(syncAuthLayer).observe(auth,{attributes:true,attributeFilter:['class','style']});syncAuthLayer();
  document.querySelector('.auth-title').textContent='Вход';
  const welcome=document.createElement('p');welcome.className='studio-auth-welcome';welcome.textContent='';document.querySelector('.auth-title').after(welcome);
  const demoEntry=document.createElement('a');demoEntry.className='studio-auth-demo';demoEntry.href='?demo=1';demoEntry.textContent='Сначала посмотреть демо ↗';document.querySelector('.auth-box').append(demoEntry);
  if(!new URLSearchParams(location.search).has('debug'))document.getElementById('authDiag').hidden=true;

  function animateRoute(){
    if(motionDisabled())return;
    const page=document.querySelector('.page.active');
    if(!page)return;
    const cards=[...page.querySelectorAll('.total-card,.day-strip-wrap,.day-panel,.period-card,.calc-card,.hist-card,.chart-wrap,.goals-card,.expenses-card,.profile-hero,.work-card')].filter(el=>el.getBoundingClientRect().height>0);
    cards.slice(0,14).forEach((el,i)=>{
      el.getAnimations().filter(a=>a.id==='studio-route').forEach(a=>a.cancel());
      const animation=el.animate([{opacity:0,transform:'translateY(32px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:650,delay:Math.min(i,7)*55,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});
      animation.id='studio-route';
    });
  }
  function refreshRoute(){requestAnimationFrame(animateRoute);}
  new MutationObserver(refreshRoute).observe(document.body,{attributes:true,attributeFilter:['data-workspace-page']});refreshRoute();

  // Motion supports state changes; amounts themselves stay immediately accurate.
  const amount=document.getElementById('totalDisplay');let previous=amount.textContent;
  new MutationObserver(()=>{if(amount.textContent===previous)return;previous=amount.textContent;if(!motionDisabled())amount.animate([{opacity:.45,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.2,.7,.1,1)'});}).observe(amount,{childList:true,subtree:true,characterData:true});
  if(matchMedia('(pointer:fine)').matches){
    hero.addEventListener('pointermove',event=>{if(motionDisabled())return;const r=hero.getBoundingClientRect();hero.style.setProperty('--orbit-x',((event.clientX-r.left)/r.width-.5)*16+'px');hero.style.setProperty('--orbit-y',((event.clientY-r.top)/r.height-.5)*16+'px');});
    hero.addEventListener('pointerleave',()=>{hero.style.setProperty('--orbit-x','0px');hero.style.setProperty('--orbit-y','0px');});
  }

  // Delegated feedback also covers controls rendered after changing a day.
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,.day-cell,.work-summary');
    if(!target||target.disabled||reduced.matches)return;
    target.animate([{scale:'1'},{scale:'.94',offset:.35},{scale:'1'}],{duration:340,easing:'cubic-bezier(.2,.8,.2,1)'});
  });
  const reveal=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      reveal.unobserve(entry.target);
      if(!motionDisabled())entry.target.animate([{opacity:0,transform:'translateY(25px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.16,1,.3,1)'});
    }
  },{threshold:.1});
  document.querySelectorAll('.studio-auth-heading,.studio-auth-bottom,.auth-box').forEach(el=>reveal.observe(el));
  if(DEMO_MODE){
    document.body.classList.add('studio-demo');
    const strip=document.createElement('div');strip.className='studio-demo-strip';strip.innerHTML='<span><i></i> ДЕМОРЕЖИМ <small>Примерные данные. Можно экспериментировать.</small></span><a href="'+location.pathname+'">Войти в аккаунт ↗</a>';
    document.querySelector('.workspace-topbar').before(strip);
    document.getElementById('logoutBtn').textContent='Открыть личный аккаунт ↗';document.getElementById('logoutBtn').onclick=()=>location.assign(location.pathname);
    document.getElementById('profileEmail').textContent='Примерный профиль — без регистрации';
    document.querySelector('#encBtn').closest('.calc-card').hidden=true;
    document.querySelectorAll('.sync-pill').forEach(el=>{el.onclick=()=>toast('Деморежим: изменения существуют только в этой вкладке');el.title='Деморежим — примерные данные';el.setAttribute('aria-label','Деморежим — примерные данные');el.innerHTML='<span class="sp-dot"></span><span class="sp-txt">Демо</span>';});
    const social=document.createElement('div');social.className='studio-demo-social';social.innerHTML='<span class="studio-small">СООБЩЕНИЯ</span><h2>Друзья<br><em>и группы.</em></h2><p>В личном кабинете можно добавлять друзей, создавать рабочие группы и обмениваться сообщениями с шифрованием.</p><a class="studio-demo-link" href="'+location.pathname+'">Открыть личный кабинет <span aria-hidden="true">↗</span></a>';
    document.querySelector('#page-friends').prepend(social);
  }
})();
