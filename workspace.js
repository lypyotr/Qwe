/* Presentation and navigation helpers; no new account or salary storage. */
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
  const topbar = document.createElement('header');
  topbar.className = 'workspace-topbar';
  topbar.innerHTML = '<div><div class="workspace-kicker">Личный рабочий кабинет</div><h1 class="workspace-title" id="workspaceTitle">Дневник работы</h1></div><button class="workspace-search-button" type="button" aria-label="Найти раздел" aria-haspopup="dialog">Разделы <kbd>Ctrl K</kbd></button>';
  document.getElementById('page-work').before(topbar);

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
      button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${title}<small>${description}</small></span>`;
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
    if (dialog.open) return;
    find.value = '';
    drawDestinations();
    dialog.showModal();
    find.focus();
  }
  topbar.querySelector('button').addEventListener('click', openNavigation);
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
    const {year, month, startDay, endDay} = getPeriod();
    document.getElementById('workspacePeriodLabel').textContent = `${startDay}–${endDay} ${MG[month]} ${year}`;
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
  const focusable = element => [...element.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el => !el.disabled && isVisible(el));
  function manageOverlays() {
    const visible = overlays.filter(isVisible);
    for (const overlay of visible) {
      if (activeOverlays.includes(overlay)) continue;
      focusOrigins.set(overlay, document.activeElement);
      overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-label', overlay.querySelector('.modal-title,.synclog-title,h3')?.textContent || 'Диалог');
      overlay.tabIndex = -1;
      (focusable(overlay)[0] || overlay).focus({preventScroll:true});
    }
    for (const overlay of activeOverlays) {
      if (visible.includes(overlay)) continue;
      const origin = focusOrigins.get(overlay);
      if (origin?.isConnected && isVisible(origin)) origin.focus({preventScroll:true});
      focusOrigins.delete(overlay);
    }
    activeOverlays = visible;
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
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(enhance);
      else if (record.target.classList?.contains('toggle')) enhance(record.target);
    }
    manageOverlays();
  });
  observer.observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  document.querySelectorAll('.auth-error').forEach(el => el.setAttribute('role', 'alert'));
  document.getElementById('tplList').setAttribute('aria-label', 'Шаблоны работ');
  workspaceNavigation(document.querySelector('.page.active')?.id.replace('page-','') || 'work');
  if (selectedDay === null) {
    const {year,month,startDay,endDay} = getPeriod(), now = new Date();
    selectDay(now.getFullYear() === year && now.getMonth() === month && now.getDate() >= startDay && now.getDate() <= endDay ? now.getDate() : startDay);
  }
})();
