const CACHE='salary-v42';
const STATIC=['./index.html','./manifest.json','./icon.svg','./messenger-v2.js?v=2'];

// Dynamic APIs that must NEVER be touched by the service worker: Supabase
// (REST/auth/realtime) and the exchange-rate sources. Caching these cache-first
// would serve stale data, and a network blip surfaces as noisy uncaught
// rejections from inside the SW. Let them hit the network directly so the app's
// own fetch/retry logic handles success and failure.
const BYPASS=/(^|\.)(supabase\.co|cbr-xml-daily\.ru|er-api\.com)$/i;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  let url;
  try{url=new URL(e.request.url);}catch(_){return;}

  // Don't intercept dynamic APIs — pass through to the network untouched.
  if(BYPASS.test(url.hostname))return;

  const isHTML=e.request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('/');

  if(isHTML){
    // Network-first for HTML, bypassing the browser HTTP cache (cache:'no-store')
    // so a freshly deployed build is picked up immediately instead of being
    // masked by GitHub Pages' max-age. Falls back to cache only when offline.
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(resp=>{
        if(resp.ok){
          const clone=resp.clone();
          e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,clone)));
        }
        return resp;
      }).catch(async()=>{
        const cached=await caches.match(e.request);
        return cached||caches.match('./index.html');
      })
    );
  }else{
    // Cache-first for static assets (fonts, icons, CDN scripts). The trailing
    // catch swallows network errors (offline + cache miss) so they never become
    // uncaught rejections.
    e.respondWith(
      caches.match(e.request)
        .then(cached=>cached||fetch(e.request).then(resp=>{
          if(resp.ok){
            const clone=resp.clone();
            e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,clone)));
          }
          return resp;
        }))
        .catch(()=>new Response('',{status:503,statusText:'Offline'}))
    );
  }
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.openWindow('/Qwe/'));
});
