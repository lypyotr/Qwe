/* Visual direction: a kinetic, editorial work journal. No account data changes. */
(() => {
  'use strict';
  document.body.classList.add('studio');
  const updateTheme=()=>document.querySelector('meta[name="theme-color"]').content=document.body.classList.contains('light')?'#efeee7':'#161a18';
  new MutationObserver(updateTheme).observe(document.body,{attributes:true,attributeFilter:['class']});updateTheme();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const mark='<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M20 20h40L20 60h40" stroke="currentColor" stroke-width="7" stroke-linecap="square"/><circle cx="40" cy="40" r="36" stroke="currentColor" stroke-width="1.4"/></svg>';
  const orbit='<svg viewBox="0 0 300 300" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1"><ellipse cx="150" cy="150" rx="131" ry="43" transform="rotate(-45 150 150)"/><ellipse cx="150" cy="150" rx="131" ry="43" transform="rotate(15 150 150)"/><ellipse cx="150" cy="150" rx="131" ry="43" transform="rotate(75 150 150)"/><circle cx="150" cy="150" r="92"/><path d="M150 0v22M150 278v22M0 150h22M278 150h22"/></g><circle cx="216" cy="84" r="9" fill="currentColor"/><circle cx="150" cy="150" r="5" fill="currentColor"/></svg>';
  document.querySelectorAll('.brand-mark,.workspace-brand-icon,.auth-logo').forEach(el=>el.innerHTML=mark);
  const brand=document.querySelector('.nav-brand>div');
  if(brand)brand.innerHTML='Зарплата<span class="studio-brand-period">.</span><small>ТВОЙ ТРУД. ТВОИ ПРАВИЛА.</small>';
  document.querySelector('.workspace-brandbar>span:last-child').innerHTML='ЗАРПЛАТА<span class="studio-brand-period">.</span>';

  const nav=document.querySelector('.bottom-nav');
  const rail=document.createElement('div');rail.className='studio-rail-note';
  rail.innerHTML='<span class="studio-small">ЛИЧНЫЙ УЧЁТ / 01</span><div class="studio-rail-orbit">'+orbit+'</div><p>Время работает<br><em>на тебя.</em></p><span class="studio-small">СДЕЛАНО → ЗАПИСАНО</span>';
  nav.append(rail);
  document.querySelectorAll('.nav-btn').forEach((el,i)=>el.dataset.index=String(i+1).padStart(2,'0'));

  const heading=document.querySelector('.workspace-heading');
  const eyebrow=document.createElement('div');eyebrow.className='studio-eyebrow';eyebrow.innerHTML='<span class="studio-live-dot"></span><span id="studioEyebrow">РАБОТА В ДВИЖЕНИИ</span><span class="studio-page-index" id="studioPageIndex">01 / 07</span>';
  heading.prepend(eyebrow);
  const subtitle=document.createElement('p');subtitle.className='studio-subtitle';subtitle.id='studioSubtitle';heading.append(subtitle);
  const note=document.createElement('span');note.className='studio-header-note';note.textContent='МЕНЬШЕ ХАОСА. БОЛЬШЕ СВОБОДЫ.';
  document.querySelector('.workspace-account').prepend(note);

  const hero=document.getElementById('totalCard');
  const heroTop=document.createElement('div');heroTop.className='studio-hero-top';heroTop.innerHTML='<span>КАЖДАЯ СМЕНА ИМЕЕТ ЗНАЧЕНИЕ</span><span class="studio-asterisk" aria-hidden="true">✳</span>';
  hero.prepend(heroTop);
  const art=document.createElement('div');art.className='studio-orbit';art.innerHTML=orbit;art.setAttribute('aria-hidden','true');hero.append(art);
  const caption=document.createElement('div');caption.className='studio-hero-caption';caption.innerHTML='<span>РЕЗУЛЬТАТ ТВОЕЙ РАБОТЫ</span><span aria-hidden="true">↗</span>';hero.append(caption);
  const journalIntro=document.createElement('div');journalIntro.className='studio-journal-label';journalIntro.innerHTML='<span>01 / ДНЕВНИК</span><span>ЗАПИСЫВАЙ. НАБЛЮДАЙ. РАСТИ.</span>';
  document.querySelector('.day-strip-wrap').prepend(journalIntro);
  const footer=document.createElement('footer');footer.className='studio-footer';footer.innerHTML='<span>ЗАРПЛАТА<span class="studio-brand-period">.</span> / ЛИЧНЫЙ УЧЁТ ТРУДА</span><span>Хорошая работа заслуживает точных цифр.</span>';nav.before(footer);

  // A presentation surface for visitors, separate from the functional login form.
  const auth=document.getElementById('authOverlay');
  const story=document.createElement('section');story.className='studio-auth-story';story.setAttribute('aria-label','Зарплата — личный учёт труда');
  story.innerHTML='<div class="studio-auth-brand">'+mark+'<span>ЗАРПЛАТА.</span><span class="studio-small">ЛИЧНЫЙ УЧЁТ ТРУДА</span></div><div class="studio-auth-heading"><span class="studio-small">ТВОЁ ВРЕМЯ ИМЕЕТ ЗНАЧЕНИЕ</span><h1>У твоего<br>труда есть<br><em>цена.</em></h1><div class="studio-auth-orbit">'+orbit+'</div></div><div class="studio-auth-bottom"><p>Преврати рабочие дни<br>в понятные цифры.</p><a href="?demo=1" class="studio-demo-link">Исследовать демо <span aria-hidden="true">↗</span></a></div>';
  auth.prepend(story);
  const syncAuthLayer=()=>document.querySelectorAll('.page,.workspace-topbar,.bottom-nav,.studio-footer,.studio-demo-strip').forEach(el=>el.inert=!auth.classList.contains('hidden'));
  new MutationObserver(syncAuthLayer).observe(auth,{attributes:true,attributeFilter:['class','style']});syncAuthLayer();
  document.querySelector('.auth-title').textContent='С возвращением.';
  const welcome=document.createElement('p');welcome.className='studio-auth-welcome';welcome.textContent='Твой личный кабинет. Твой следующий шаг.';document.querySelector('.auth-title').after(welcome);
  const demoEntry=document.createElement('a');demoEntry.className='studio-auth-demo';demoEntry.href='?demo=1';demoEntry.textContent='Сначала посмотреть демо ↗';document.querySelector('.auth-box').append(demoEntry);
  if(!new URLSearchParams(location.search).has('debug'))document.getElementById('authDiag').hidden=true;

  const routes={work:['РАБОТА В ДВИЖЕНИИ','Твой труд. В ясных цифрах.',1],period:['ОТ СМЕНЫ ДО ВЫПЛАТЫ','Всё сходится. И планы, и цифры.',2],archive:['НИЧЕГО НЕ ТЕРЯЕТСЯ','У каждой суммы есть своя история.',3],calc:['БОЛЬШЕ ЯСНОСТИ ВПЕРЕДИ','Планы становятся конкретнее.',4],friends:['НА ОДНОЙ ВОЛНЕ','Работа объединяет. Общение продолжает.',5],stats:['СМОТРИ НА СВОЙ РОСТ','Большая картина складывается из дней.',6],profile:['ЭТО ТВОЯ ТЕРРИТОРИЯ','Немного о тебе. Всё — под твоим контролем.',7],chat:['НА ОДНОЙ ВОЛНЕ','Разговор по делу. И не только.',5]};
  function refreshRoute(){
    const [label,description,index]=routes[document.body.dataset.workspacePage]||routes.work;
    document.getElementById('studioEyebrow').textContent=label;
    document.getElementById('studioPageIndex').textContent=String(index).padStart(2,'0')+' / 07';
    subtitle.textContent=description;
  }
  new MutationObserver(refreshRoute).observe(document.body,{attributes:true,attributeFilter:['data-workspace-page']});refreshRoute();

  // Motion supports state changes; amounts themselves stay immediately accurate.
  const amount=document.getElementById('totalDisplay');let previous=amount.textContent;
  new MutationObserver(()=>{if(amount.textContent===previous)return;previous=amount.textContent;if(!reduced.matches)amount.animate([{opacity:.45,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.2,.7,.1,1)'});}).observe(amount,{childList:true,subtree:true,characterData:true});
  if(matchMedia('(pointer:fine)').matches){
    hero.addEventListener('pointermove',event=>{if(reduced.matches)return;const r=hero.getBoundingClientRect();hero.style.setProperty('--orbit-x',((event.clientX-r.left)/r.width-.5)*16+'px');hero.style.setProperty('--orbit-y',((event.clientY-r.top)/r.height-.5)*16+'px');});
    hero.addEventListener('pointerleave',()=>{hero.style.setProperty('--orbit-x','0px');hero.style.setProperty('--orbit-y','0px');});
  }

  if(DEMO_MODE){
    document.body.classList.add('studio-demo');
    const strip=document.createElement('div');strip.className='studio-demo-strip';strip.innerHTML='<span><i></i> ДЕМОРЕЖИМ <small>Примерные данные. Можно экспериментировать.</small></span><a href="'+location.pathname+'">Войти в аккаунт ↗</a>';
    document.querySelector('.workspace-topbar').before(strip);
    document.getElementById('logoutBtn').textContent='Открыть личный аккаунт ↗';document.getElementById('logoutBtn').onclick=()=>location.assign(location.pathname);
    document.getElementById('profileEmail').textContent='Примерный профиль — без регистрации';
    document.querySelector('#encBtn').closest('.calc-card').hidden=true;
    document.querySelectorAll('.sync-pill').forEach(el=>{el.onclick=()=>toast('Деморежим: изменения существуют только в этой вкладке');el.title='Деморежим — примерные данные';el.setAttribute('aria-label','Деморежим — примерные данные');el.innerHTML='<span class="sp-dot"></span><span class="sp-txt">Демо</span>';});
    const social=document.createElement('div');social.className='studio-demo-social';social.innerHTML='<span class="studio-small">ОСТАВАЙСЯ НА СВЯЗИ</span><h2>Хорошая работа —<br><em>общая история.</em></h2><p>В личном кабинете можно добавлять друзей, создавать рабочие группы и обмениваться сообщениями с шифрованием.</p><a class="studio-demo-link" href="'+location.pathname+'">Открыть личный кабинет <span aria-hidden="true">↗</span></a>';
    document.querySelector('#page-friends').prepend(social);
  }
})();
