// まつにゃん: 電波の弱い所でも画面を開けるようにする控え。
// 版の4つ(この VER・app.js の APP_VER・index.html の meta app-ver・?v=)は必ず同じ数にする。
// 画面と設定は毎回サーバーに確かめ、3秒で返らなければ控えを出す。「?v=版」付きの物は版の組で控える。
const VER = 7, CACHE = 'matsunyan-v' + VER, NET_WAIT_MS = 3000;
const PLAIN = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './help.html', './terms.html'];
const PAIRED = ['./app.js', './config.js', './style.css', './lib/qr.js'].map(f => f + '?v=' + VER);
const FILES = PLAIN.concat(PAIRED);
const verNum = k => { const m = /^matsunyan-v(\d+)$/.exec(k); return m ? +m[1] : 0; };
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'skipWaiting') self.skipWaiting();
  else if (d.type === 'ver' && e.ports[0]) e.ports[0].postMessage(CACHE);
});
// 今の版と、すぐ前の版だけ残す
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => {
  const prev = ks.filter(k => k !== CACHE && verNum(k) > 0 && verNum(k) < VER).sort((a, b) => verNum(b) - verNum(a))[0];
  return Promise.all(ks.filter(k => k !== CACHE && k !== prev).map(k => caches.delete(k)));
}).then(() => self.clients.claim())));
const inTime = (p, ms) => new Promise((ok, ng) => { const t = setTimeout(() => ng(new Error('slow')), ms); p.then(r => { clearTimeout(t); ok(r); }, x => { clearTimeout(t); ng(x); }); });
const keep = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // 受け付け(Apps Script)と Google には触らない
  const v = u.searchParams.get('v');
  if (v) { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request, { cache: 'no-cache' }).then(res => +v === VER ? keep(e.request, res) : res))); return; }
  const nav = e.request.mode === 'navigate';
  const net = fetch(nav ? e.request.url : e.request, { cache: 'no-cache' }).then(res => keep(nav ? new Request('./index.html') : e.request, res));
  net.catch(() => {});
  const fromCache = () => caches.open(CACHE).then(c => c.match(nav ? './index.html' : e.request, { ignoreSearch: true }));
  e.respondWith(inTime(net, NET_WAIT_MS).catch(() => fromCache().then(r => r || net)));
});
