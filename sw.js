const CACHE='salary-v28';
const STATIC=['./manifest.json','./icon.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const isHTML=e.request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/');

  if(isHTML){
    // Network-first for HTML, bypassing the browser HTTP cache (cache:'no-store')
    // so a freshly deployed build is picked up immediately instead of being
    // masked by GitHub Pages' max-age. Falls back to cache only when offline.
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(resp=>{
        const clone=resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return resp;
      }).catch(()=>caches.match(e.request))
    );
  }else{
    // Cache-first for static assets (fonts, icons, CDN scripts)
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
  }
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.openWindow('/Qwe/'));
});
