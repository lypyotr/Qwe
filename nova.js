/* NOVA — эффекты оформления. Данные, расчёты и разметку не трогает. */
(() => {
  'use strict';
  const body = document.body;
  body.classList.add('nova');
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const still = () => body.classList.contains('motion-off');

  // Цвет системной панели под текущую тему.
  const meta = document.querySelector('meta[name="theme-color"]');
  const syncMeta = () => { if (meta) meta.content = body.classList.contains('light') ? '#f3f0fa' : '#07060e'; };
  new MutationObserver(syncMeta).observe(body, { attributes: true, attributeFilter: ['class'] });
  syncMeta();

  // ── Небо ───────────────────────────────────────────────────────────────
  const sky = document.createElement('div');
  sky.className = 'nova-sky';
  sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = '<canvas class="nova-stars"></canvas>' +
    ['b1', 'b2', 'b3', 'b4'].map(b => `<div class="nova-blob ${b}"><i></i></div>`).join('');
  const grain = document.createElement('div');
  grain.className = 'nova-grain';
  grain.setAttribute('aria-hidden', 'true');
  body.prepend(sky);
  body.append(grain);

  const canvas = sky.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let stars = [], W = 0, H = 0, dpr = 1, px = 0, py = 0, tx = 0, ty = 0, raf = 0;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const n = Math.round(Math.min(220, W * H / 7000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() ** 3 * 1.6 + .25, z: Math.random() * .9 + .1,
      p: Math.random() * Math.PI * 2, s: Math.random() * 1.4 + .4,
      h: [255, 300, 190, 50][Math.random() * 4 | 0]
    }));
  };
  let lastFrame = 0;
  const frameGap = fine ? 0 : 33; // ~30 кадров/с на телефоне
  const draw = t => {
    raf = 0;
    if (t - lastFrame < frameGap) { loop(); return; }
    lastFrame = t;
    px += (tx - px) * .05; py += (ty - py) * .05;
    sky.style.setProperty('--px', px.toFixed(3));
    sky.style.setProperty('--py', py.toFixed(3));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const light = body.classList.contains('light');
    for (const s of stars) {
      const tw = still() ? .8 : .55 + .45 * Math.sin(t / 1000 * s.s + s.p);
      const x = (s.x - px * 26 * s.z + W) % W, y = (s.y - py * 26 * s.z + (still() ? 0 : t * .004 * s.z) + H) % H;
      ctx.globalAlpha = tw * (light ? .6 : 1);
      ctx.fillStyle = light ? `hsl(${s.h} 60% 45%)` : `hsl(${s.h} 100% ${s.h === 50 ? 80 : 88}%)`;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
      if (s.r > 1.3 && !light) {
        ctx.globalAlpha = tw * .25;
        ctx.fillRect(x - s.r * 4, y - .4, s.r * 8, .8);
        ctx.fillRect(x - .4, y - s.r * 4, .8, s.r * 8);
      }
    }
    if (!still()) loop();
  };
  const loop = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(draw); };
  new MutationObserver(loop).observe(body, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', () => { resize(); loop(); });
  document.addEventListener('visibilitychange', loop);
  resize(); loop();

  // ── Курсор, параллакс, прожектор на карточках ─────────────────────────
  const CARD = '.day-strip-wrap,.day-panel,.workspace-payday,.workspace-settings,.templates-section,.period-card,.chart-wrap,.goals-card,.expenses-card,.calc-card,.profile-hero,.stat-hero,.stat-card,.level-banner,.messenger-card,.message-card,.messenger-hero,.period-premium-row,.hist-card,.archive-item,.stat-tile,.tw-row,.profile-snapshot,.profile-metric,.profile-action,.stats-summary,.stat-summary-card,.stat-metric,.today-summary,.friend-row,.bonus-item,.expense-item,.tpl-item,.auth-box';
  const HOT = 'button,a,[role=button],.nav-btn,.day-cell,.tpl-chip,.tvt-opt,input,select,textarea,label,summary';
  let glow, dot;
  if (fine) {
    glow = document.createElement('div'); glow.className = 'nova-cursor';
    dot = document.createElement('div'); dot.className = 'nova-dot';
    body.append(glow, dot);
  }
  let lastCard = null;
  addEventListener('pointermove', e => {
    tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5;
    if (!fine) return;
    glow.style.setProperty('--cx', e.clientX + 'px'); glow.style.setProperty('--cy', e.clientY + 'px');
    dot.style.setProperty('--dx', e.clientX + 'px'); dot.style.setProperty('--dy', e.clientY + 'px');
    const el = e.target instanceof Element ? e.target : null;
    dot.classList.toggle('hot', !!el?.closest(HOT));
    const card = el?.closest(CARD);
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', e.clientX - r.left + 'px');
      card.style.setProperty('--my', e.clientY - r.top + 'px');
    }
    if (lastCard && lastCard !== card) { lastCard.style.removeProperty('--mx'); lastCard.style.removeProperty('--my'); }
    lastCard = card;
  }, { passive: true });
  document.addEventListener('pointerleave', () => fine && dot.style.setProperty('--dx', '-999px'));

  // ── Голографическая карта: наклон и перелив ───────────────────────────
  const tiltCard = document.getElementById('totalCard');
  if (tiltCard && fine) {
    tiltCard.addEventListener('pointermove', e => {
      if (still()) return;
      const r = tiltCard.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      tiltCard.classList.add('nova-tilting');
      tiltCard.style.setProperty('--ry', ((x - .5) * 14).toFixed(2) + 'deg');
      tiltCard.style.setProperty('--rx', ((.5 - y) * 12).toFixed(2) + 'deg');
      tiltCard.style.setProperty('--sx', (x * 100).toFixed(1) + '%');
      tiltCard.style.setProperty('--sy', (y * 100).toFixed(1) + '%');
      tiltCard.style.setProperty('--hx', (x * 100).toFixed(1) + '%');
      tiltCard.style.setProperty('--hy', (y * 100).toFixed(1) + '%');
    });
    tiltCard.addEventListener('pointerleave', () => {
      tiltCard.classList.remove('nova-tilting');
      ['--rx', '--ry', '--sx', '--sy'].forEach(p => tiltCard.style.removeProperty(p));
    });
  }
  // Перелив от наклона телефона.
  if (!fine && tiltCard && 'DeviceOrientationEvent' in window) {
    addEventListener('deviceorientation', e => {
      if (still() || e.gamma == null) return;
      const x = Math.max(-1, Math.min(1, e.gamma / 30)), y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      tiltCard.style.setProperty('--hx', (50 + x * 50).toFixed(1) + '%');
      tiltCard.style.setProperty('--hy', (50 + y * 50).toFixed(1) + '%');
      tiltCard.style.setProperty('--sx', (50 + x * 50).toFixed(1) + '%');
      tx = x * .5; ty = y * .5;
    }, { passive: true });
  }

  // Сумма меняется — перелистываем её.
  const amount = document.getElementById('totalDisplay');
  if (amount) {
    let prev = amount.textContent;
    new MutationObserver(() => {
      if (amount.textContent === prev || still()) { prev = amount.textContent; return; }
      prev = amount.textContent;
      amount.classList.remove('nova-flip'); void amount.offsetWidth; amount.classList.add('nova-flip');
    }).observe(amount, { childList: true, characterData: true, subtree: true });
  }

  // ── Волна и искры от нажатий ───────────────────────────────────────────
  const RIPPLE = '.workspace-add-button,.add-work-btn,.auth-btn,.modal-btn,.btn-secondary,.ui-button,.nav-btn,.tpl-chip,.day-cell,.workspace-icon-button,.workspace-search-button';
  const SPARK = '.workspace-add-button,.add-work-btn,.tpl-use,.tpl-chip,.auth-btn';
  const colors = ['#8b6cff', '#ff5bd0', '#41e8ff', '#c8ff52', '#ffb35c', '#ffffff'];
  document.addEventListener('pointerdown', e => {
    if (still() || !(e.target instanceof Element)) return;
    const host = e.target.closest(RIPPLE);
    if (host) {
      const r = host.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.style.overflow = 'hidden';
      const rip = document.createElement('span');
      rip.className = 'nova-ripple';
      rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      host.append(rip);
      setTimeout(() => rip.remove(), 750);
    }
    if (e.target.closest(SPARK)) burst(e.clientX, e.clientY, 18);
  }, { passive: true });
  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
      s.className = 'nova-spark';
      s.style.cssText = `--c:${colors[i % colors.length]};--x0:${x}px;--y0:${y}px;--x1:${x + Math.cos(a) * d}px;--y1:${y + Math.sin(a) * d - 30}px;--r:${Math.random() * 540 - 270}deg;animation-delay:${Math.random() * 60}ms`;
      if (i % 3 === 0) s.style.borderRadius = '50%';
      body.append(s);
      setTimeout(() => s.remove(), 1100);
    }
  }

  // ── Магнитные кнопки ───────────────────────────────────────────────────
  if (fine) {
    document.addEventListener('pointermove', e => {
      if (still() || !(e.target instanceof Element)) return;
      const b = e.target.closest('.workspace-icon-button,.workspace-search-button,.workspace-period .ui-icon,.workspace-avatar-button');
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .25}px)`;
      b.onpointerleave = () => { b.style.transform = ''; };
    }, { passive: true });
  }

  // ── Каскадное появление при смене экрана ──────────────────────────────
  const enter = page => {
    if (still()) return;
    const items = [...page.querySelectorAll(CARD + ',.total-card,.workspace-add-button,.workspace-period,.section-shortcuts')]
      .filter(el => el.offsetParent !== null && !el.parentElement.closest(CARD)).slice(0, 16);
    items.forEach((el, i) => {
      el.classList.remove('nova-enter'); void el.offsetWidth;
      el.style.setProperty('--i', i);
      el.classList.add('nova-enter');
      el.addEventListener('animationend', function done(ev) {
        if (ev.animationName !== 'nova-in') return;
        el.classList.remove('nova-enter'); el.removeEventListener('animationend', done);
      });
    });
  };
  document.querySelectorAll('.page').forEach(page => {
    let was = page.classList.contains('active');
    new MutationObserver(() => {
      const now = page.classList.contains('active');
      if (now && !was) enter(page);
      was = now;
    }).observe(page, { attributes: true, attributeFilter: ['class'] });
  });
  const first = document.querySelector('.page.active');
  if (first) requestAnimationFrame(() => enter(first));
})();
