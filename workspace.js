/* Presentation, navigation and keyboard access helpers. */
(() => {
  'use strict';
  const pages = [
    ['work', 'Дневник работы', 'Дни, выполненные работы и заработок', '▦'],
    ['period', 'Расчётный период', 'Выплата, цели, расходы и доплаты', '◷'],
    ['archive', 'Архив', 'Все сохранённые месяцы и периоды', '▤'],
    ['calc', 'Расчёты', 'Бюджет на день и план заработка', '＋'],
    ['friends', 'Сообщения', 'Друзья, переписка и рабочие группы', '☏'],
    ['stats', 'Статистика', 'Динамика доходов и результаты', '↗'],
    ['profile', 'Профиль', 'Имя, оформление, аккаунт и данные', '○'],
  ];
  const iconPaths = {
    work:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    period:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2"/>',
    archive:'<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v11h14V9M10 13h4"/>',
    calc:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 6h8M8 11h1M15 11h1M8 15h1M15 15h1M8 19h1M15 19h1"/>',
    friends:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z"/><path d="M7 10h10M7 14h6"/>',
    stats:'<path d="M4 20h16M7 16v-5M12 16V4M17 16V8"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    moon:'<path d="M20.5 13.5A8.5 8.5 0 0 1 10.5 3a9 9 0 1 0 10 10.5Z"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    mark:'<path d="M5 18V9M12 18V5M19 18v-6"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    box:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
    coins:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v5c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 10v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5M4 15v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    photo:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-7 5 8"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>'
  };
  const uiIcon = name => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (iconPaths[name] || iconPaths.work) + '</svg>';
  window.workspaceIcon=uiIcon;
  const topbar = document.createElement('header');
  topbar.className = 'workspace-topbar';
  topbar.innerHTML = '<div class="workspace-brandbar"><span class="workspace-brand-icon">'+uiIcon('mark')+'</span><span>Зарплата</span></div><div class="workspace-tools"><button class="workspace-search-button" type="button" aria-label="Найти раздел" title="Найти раздел · Ctrl K" aria-haspopup="dialog">'+uiIcon('search')+'</button><button class="workspace-add-button" id="workspaceAddWork" type="button" aria-label="Добавить работу в выбранный день">'+uiIcon('plus')+'<span class="button-label">Добавить работу</span></button></div><div class="workspace-heading"><h1 class="workspace-title" id="workspaceTitle">Дневник работы</h1><p class="sr-only" id="workspaceSubtitle">Дни, выполненные работы и заработок</p></div><div class="workspace-account"><span class="workspace-date" id="workspaceDate"></span></div>';
  document.getElementById('page-work').before(topbar);
  const account=document.querySelector('#page-work > .header');
  const legacy=document.createElement('div');legacy.hidden=true;
  legacy.append(...account.querySelector('.header-left').children);topbar.append(legacy);
  const sync=account.querySelector('.sync-pill');
  topbar.querySelector('.workspace-account').append(sync);
  const theme=document.createElement('button');theme.type='button';theme.id='themeBtn';theme.className='workspace-icon-button';
  theme.addEventListener('click',()=>toggleTheme());
  const avatar=document.createElement('button');avatar.type='button';avatar.id='workspaceAvatar';avatar.className='workspace-avatar-button';avatar.setAttribute('aria-label','Настройки аватара');avatar.setAttribute('aria-haspopup','dialog');avatar.title='Настройки аватара';
  avatar.addEventListener('click',()=>window.workspaceOpenAvatar?.());avatar.textContent='Р';
  topbar.querySelector('.workspace-tools').append(theme,avatar);
  account.remove();
  document.getElementById('workspaceDate').textContent = new Intl.DateTimeFormat('ru', {weekday:'short',day:'numeric',month:'long'}).format(new Date());
  for (const [id] of pages) {
    const button = document.getElementById('nav' + id[0].toUpperCase() + id.slice(1));
    if (button) button.querySelector('.nav-icon').innerHTML = uiIcon(id);
  }
  document.querySelector('.brand-mark').innerHTML = uiIcon('mark');
  document.querySelector('#navWork .nav-lbl').textContent = 'Дневник';

  const settings = document.createElement('details');
  settings.className = 'workspace-settings';
  settings.innerHTML = '<summary><span>Параметры расчёта<small>Налог и счётчик изделий</small></span><span class="settings-status" id="workspaceTaxStatus"></span><span class="settings-chevron" aria-hidden="true">⌄</span></summary><div class="workspace-settings-body"></div>';
  const counterRow = document.getElementById('counterToggleRow');
  counterRow.before(settings);
  const settingsBody = settings.querySelector('.workspace-settings-body');
  settingsBody.append(counterRow, document.getElementById('counterCard'), document.getElementById('taxToggle').closest('.tax-row'));
  settings.open = !!counter.enabled;
  counterRow.querySelector('.tax-title').textContent = 'Счётчик изделий';

  const payday = document.createElement('button');
  payday.type = 'button'; payday.className = 'workspace-payday';
  payday.innerHTML = '<span class="payday-icon">' + uiIcon('period') + '</span><span class="payday-description"><small>Выплата</small><strong id="workspacePayDate"></strong></span><span class="payday-timing" id="workspacePayIn"></span>';
  payday.addEventListener('click', () => switchPage('period'));
  document.getElementById('totalCard').after(payday);
  const quickAdd=document.getElementById('workspaceAddWork');
  payday.after(quickAdd);
  const currencyRow=document.createElement('div');currencyRow.className='workspace-currency-row';
  const currencyLabel=document.createElement('span');currencyLabel.textContent='Валюта отображения';
  currencyRow.append(currencyLabel,document.getElementById('curToggle'));settingsBody.append(currencyRow);
  const statsButton=document.createElement('button');statsButton.type='button';statsButton.className='workspace-balance-stats workspace-icon-button';
  statsButton.setAttribute('aria-label','Открыть статистику');statsButton.title='Статистика';statsButton.innerHTML=uiIcon('stats');statsButton.addEventListener('click',()=>switchPage('stats'));
  document.getElementById('totalCard').prepend(statsButton);
  function compactControl(element,name,label){
    if(!element)return;element.innerHTML=uiIcon(name);element.setAttribute('aria-label',label);element.title=label;
  }
  compactControl(document.querySelector('#dayPanel .copy-day-btn'),'copy','Копировать работы с другого дня');
  compactControl(document.querySelector('.templates-header .copy-day-btn'),'plus','Создать шаблон');
  compactControl(document.querySelector('#dayPanel .photo-add-btn'),'photo','Прикрепить фотографии');
  const arrows=document.querySelectorAll('.calendar-actions button');
  arrows[0].innerHTML=uiIcon('chevron');arrows[1].innerHTML=uiIcon('chevron');
  document.querySelector('.templates-header .section-title').textContent='Частые работы';
  document.querySelectorAll('.profile-action').forEach((button,index)=>{
    const label=button.querySelector('.profile-action-title').textContent;button.title=label;button.setAttribute('aria-label',label);
    button.querySelector('.profile-action-icon').innerHTML=uiIcon(['friends','work','stats','download'][index]);
  });
  const photoSection = document.querySelector('#dayPanel .photo-section');
  photoSection.before(document.querySelector('#dayPanel .add-work-btn'));
  document.getElementById('dayPanel').after(document.getElementById('todaySummaryCard'));
  const desktopLayout = matchMedia('(min-width:1000px)');
  const placeSettings = () => (desktopLayout.matches ? document.querySelector('.work-overview') : document.querySelector('.work-journal')).append(settings);
  desktopLayout.addEventListener('change', placeSettings); placeSettings();


  window.workspaceAddWork = function () {
    if (selectedDay === null) selectDay(preferredPeriodDay());
    switchPage('work');
    addWork();
    document.getElementById('dayPanel').scrollIntoView({block:'nearest',behavior:'instant'});
  };
  document.getElementById('workspaceAddWork').addEventListener('click', workspaceAddWork);

  function updateThemeIcon() {
    const light = document.body.classList.contains('light'), button = document.getElementById('themeBtn');
    if (button.dataset.workspaceTheme === String(light) && button.querySelector('svg')) return;
    button.dataset.workspaceTheme = String(light);
    button.innerHTML = uiIcon(light ? 'moon' : 'sun');
    button.setAttribute('aria-label', light ? 'Включить тёмную тему' : 'Включить светлую тему');
    button.title = button.getAttribute('aria-label');
    document.querySelector('meta[name="theme-color"]').content = light ? '#f4f6f2' : '#101816';
  }
  updateThemeIcon();

  window.workspaceOverview = function () {
    const info = getPeriodInfo();
    document.getElementById('workspacePayDate').textContent = info.payDate.toLocaleDateString('ru', {day:'numeric',month:'long'});
    document.getElementById('workspacePayIn').textContent = info.diffDays === 0 ? 'Сегодня' : info.diffDays > 0 ? 'Через ' + info.diffDays + ' ' + pl(info.diffDays) : 'Дата прошла';
    document.getElementById('workspaceTaxStatus').textContent = taxEnabled ? 'НДФЛ 13%' : 'Без НДФЛ';
    const {year,month}=getPeriod();
    document.getElementById('workspaceCalendarMonth').textContent=new Intl.DateTimeFormat('ru',{month:'long',year:'numeric'}).format(new Date(year,month,1)).replace(/ г\.$/,'');
    document.getElementById('workspaceCalendarHint').textContent=selectedDay===null?'Выберите день для записи':selectedDay+' '+MG[month]+' · выбранный день';
  };


  const dialog = document.createElement('dialog');
  dialog.className = 'workspace-dialog';
  dialog.setAttribute('aria-labelledby', 'workspaceDialogTitle');
  dialog.innerHTML = '<div class="workspace-dialog-head"><h2 id="workspaceDialogTitle">Куда перейти?</h2><button type="button" class="ui-icon" aria-label="Закрыть">×</button></div><label class="sr-only" for="workspaceFind">Название раздела</label><input id="workspaceFind" class="workspace-search" type="search" placeholder="Например: архив, расходы, друзья…" autocomplete="off"><div class="workspace-destinations"></div><p>Работы сохраняются при вводе. Статус рядом с именем показывает синхронизацию. Резервную копию можно скачать в профиле, в разделе «Данные».</p>';
  document.body.append(dialog);
  const find = dialog.querySelector('input');
  const destinations = dialog.querySelector('.workspace-destinations');
  function drawDestinations() {
    destinations.replaceChildren();
    const query = find.value.trim().toLocaleLowerCase('ru');
    for (const [id, title, description, icon] of pages) {
      if (!(title + ' ' + description).toLocaleLowerCase('ru').includes(query)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'workspace-destination';
      button.innerHTML = '<span class="destination-icon">' + uiIcon(id) + '</span><span>' + title + '<small>' + description + '</small></span>';
      button.addEventListener('click', () => { dialog.close(); switchPage(id); });
      destinations.append(button);
    }
    if (!destinations.childElementCount) {
      const empty = document.createElement('p');
      empty.textContent = 'Раздел не найден. Попробуйте другое слово.';
      destinations.append(empty);
    }
  }
  function openNavigation() {
    if (!document.getElementById('authOverlay').classList.contains('hidden')) return;
    if (document.getElementById('maintOverlay').style.display !== 'none') return;
    if (document.querySelector('dialog[open]')) return;
    if (activeOverlays.length) return;
    find.value = '';
    drawDestinations();
    dialog.showModal();
    find.focus();
  }
  topbar.querySelector('.workspace-search-button').addEventListener('click', openNavigation);
  dialog.querySelector('.ui-icon').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  find.addEventListener('input', drawDestinations);
  find.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); destinations.querySelector('button')?.focus(); }
    if (event.key === 'Enter') { event.preventDefault(); destinations.querySelector('button')?.click(); }
  });

  window.workspaceRefresh = function () {
    const {year, month, startDay, endDay, period} = getPeriod();
    document.getElementById('workspacePeriodLabel').textContent = startDay + '–' + endDay + ' ' + new Intl.DateTimeFormat('ru',{month:'long'}).format(new Date(year,month,1));
    document.getElementById('workspacePeriodMeta').textContent=year+' · '+(period===1?'первая половина':'вторая половина');
    const now=new Date();document.getElementById('workspaceCurrentPeriod').hidden=year===now.getFullYear()&&month===now.getMonth()&&period===(now.getDate()<=15?1:2);
    workspaceOverview();
    const monthLabel = document.getElementById('monthSel');
    monthLabel.setAttribute('aria-label', 'Месяц расчёта');
    document.getElementById('periodSel').setAttribute('aria-label', 'Расчётный период');
  };
  window.workspaceToday = function () {
    const now = new Date();
    const value = `${now.getFullYear()}-${now.getMonth()}`;
    const period = now.getDate() <= 15 ? '1' : '2';
    ensureMonthOption(now.getFullYear(), now.getMonth());
    if (document.getElementById('monthSel').value !== value || document.getElementById('periodSel').value !== period) {
      document.getElementById('monthSel').value = value;
      document.getElementById('periodSel').value = period;
      onPeriodChange();
    }
    switchPage('work');
    selectDay(now.getDate());
    document.getElementById('dayPanel').scrollIntoView({block: 'nearest', behavior: 'instant'});
  };
  window.workspaceNavigation = function (name) {
    const route = pages.find(page => page[0] === name);
    document.getElementById('workspaceTitle').textContent = route?.[1] || ({admin:'Управление',users:'Пользователи',chat:'Переписка'}[name] || 'Зарплата');
    document.getElementById('workspaceSubtitle').textContent = route?.[2] || 'Личный рабочий кабинет';
    document.body.dataset.workspacePage = name;
    if(name==='work')payday.after(quickAdd);else topbar.querySelector('.workspace-tools').insertBefore(quickAdd,theme);
    const active = name === 'chat' ? 'friends' : ['admin','users'].includes(name) ? 'profile' : name;
    document.querySelectorAll('.nav-btn').forEach(button => {
      const selected = button.id === 'nav' + active[0].toUpperCase() + active.slice(1);
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    workspaceRefresh();
  };

  // Expose the clipboard action beside the public ID, with an actionable fallback.
  const idBox = document.getElementById('friendMyId');
  const copyId = document.createElement('button');
  copyId.type = 'button'; copyId.className = 'ui-button'; copyId.textContent = 'Скопировать ID';
  copyId.addEventListener('click', async () => {
    if (!userSeq) { toast('ID ещё загружается'); return; }
    try { await navigator.clipboard.writeText(String(userSeq)); toast('ID скопирован'); }
    catch (_) { toast('Ваш ID: #' + userSeq, null, 6000); }
  });
  idBox.after(copyId);

  // Password visibility is local to each form, never stored.
  for (const formId of ['authLoginForm','authRegisterForm','authRecoverForm']) {
    const form = document.getElementById(formId);
    const fields = [...form.querySelectorAll('input[type=password]')];
    const label = document.createElement('label');
    label.className = 'auth-show-password';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
    label.append(checkbox, document.createTextNode('Показать пароль'));
    fields[fields.length - 1].after(label);
    checkbox.addEventListener('change', () => fields.forEach(field => { field.type = checkbox.checked ? 'text' : 'password'; }));
  }

  // Make legacy click targets and generated form fields keyboard-accessible.
  function enhance(root) {
    if (!(root instanceof Element)) return;
    const targets = [root, ...root.querySelectorAll('div[onclick],span[onclick],input,textarea,select')];
    for (const el of targets) {
      if (el.matches('input,textarea,select') && !el.hasAttribute('aria-label') && !el.labels?.length) {
        const label = el.getAttribute('placeholder') || el.getAttribute('title');
        if (label) el.setAttribute('aria-label', label);
      }
      if (!el.matches('div[onclick],span[onclick]') || el.id.endsWith('Overlay') || el.classList.contains('modal-overlay') || el.classList.contains('work-card-overlay') || el.id === 'photoViewer') continue;
      if (el.querySelector('button,input,select,textarea,[onclick]')) continue;
      if (!el.hasAttribute('role')) el.setAttribute('role', el.classList.contains('toggle') ? 'switch' : 'button');
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      if (!el.hasAttribute('aria-label') && el.title) el.setAttribute('aria-label', el.title);
      if (el.classList.contains('toggle')) {
        el.setAttribute('aria-checked', String(el.classList.contains('on')));
        const title = el.parentElement.querySelector('.tax-title');
        if (title) el.setAttribute('aria-label', title.textContent);
      }
    }
  }
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openNavigation(); return; }
    const target = event.target;
    if ((event.key === 'Enter' || event.key === ' ') && target.matches('[role=button],[role=switch]') && !target.matches('button,input,select,textarea')) {
      event.preventDefault(); target.click();
    }
  });

  // Manage focus for existing overlays while keeping their own close handlers.
  const overlayClosers = {
    tplModal: () => closeTplModal(), copyModal: () => closeCopyModal(),
    goalsModal: () => closeGoalsModal(), copyExpModal: () => closeCopyExpModal(),
    expEditModal: () => closeExpEdit(), dataModal: () => closeDataModal(),
    diagModal: () => closeDiagModal(), msgActModal: () => closeMsgActions(),
    workCardOverlay: () => msgV2CloseWorkCard(), addFriendOverlay: () => closeAddFriend(),
    syncLogOverlay: () => closeSyncLog(), photoViewer: () => closePhotoViewer(),
  };
  const overlays = Object.keys(overlayClosers).map(id => document.getElementById(id)).filter(Boolean);
  const focusOrigins = new Map();
  let activeOverlays = [];
  const isVisible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const isOpen = overlay => {
    if (overlay.classList.contains('modal-overlay') || overlay.id === 'photoViewer') return overlay.classList.contains('open');
    if (overlay.classList.contains('work-card-overlay')) return overlay.classList.contains('show');
    return isVisible(overlay) && getComputedStyle(overlay).display !== 'none';
  };
  const focusable = element => [...element.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el => !el.disabled && !el.closest('[inert]') && isVisible(el));
  function manageOverlays() {
    const visible = overlays.filter(isOpen);
    const opened = visible.filter(overlay => !activeOverlays.includes(overlay));
    const closed = activeOverlays.filter(overlay => !visible.includes(overlay));
    const oldFocus = document.activeElement;
    for (const overlay of overlays) {
      const open = visible.includes(overlay);
      overlay.inert = !open;
      overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
      if (!open) overlay.removeAttribute('aria-modal');
      overlay.setAttribute('aria-hidden', String(!open));
      overlay.setAttribute('aria-label', overlay.querySelector('.modal-title,.synclog-title,h3')?.textContent || 'Диалог');
      overlay.tabIndex = -1;
    }
    activeOverlays = activeOverlays.filter(overlay => visible.includes(overlay)).concat(opened);
    activeOverlays.sort((a,b) => (parseInt(getComputedStyle(a).zIndex)||0) - (parseInt(getComputedStyle(b).zIndex)||0));
    for (const overlay of opened) focusOrigins.set(overlay, oldFocus);
    for (const overlay of closed.reverse()) {
      const origin = focusOrigins.get(overlay);
      if (!opened.length && (overlay.contains(oldFocus) || document.activeElement === document.body) && origin?.isConnected && !origin.closest('[inert]') && isVisible(origin)) origin.focus({preventScroll:true});
      focusOrigins.delete(overlay);
    }
    const top = activeOverlays[activeOverlays.length - 1];
    if (opened.includes(top)) (focusable(top)[0] || top).focus({preventScroll:true});
  }
  document.addEventListener('keydown', event => {
    if (dialog.open || !activeOverlays.length) return;
    const overlay = activeOverlays[activeOverlays.length - 1];
    if (event.key === 'Escape') { event.preventDefault(); overlayClosers[overlay.id](); return; }
    if (event.key !== 'Tab') return;
    const elements = focusable(overlay);
    const first = elements[0], last = elements[elements.length - 1];
    if (!first) { event.preventDefault(); overlay.focus(); }
    else if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  });
  enhance(document.body);
  manageOverlays();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target === document.body) updateThemeIcon();
      if (record.type === 'attributes' && record.target.id === 'taxToggle') workspaceOverview();
      if (record.type === 'childList') record.addedNodes.forEach(enhance);
      else if (record.target.classList?.contains('toggle')) enhance(record.target);
    }
    manageOverlays();
  });
  observer.observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  document.querySelectorAll('.auth-error').forEach(el => el.setAttribute('role', 'alert'));
  document.getElementById('tplList').setAttribute('aria-label', 'Шаблоны работ');
  workspaceNavigation(document.querySelector('.page.active')?.id.replace('page-','') || 'work');
  if (selectedDay === null) selectDay(preferredPeriodDay());
  else renderDayPanel();
})();

