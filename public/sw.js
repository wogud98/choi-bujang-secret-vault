// 11단계: 설치형 웹앱의 오프라인 안내만 맡는 서비스 워커입니다.
// 화면 껍데기(오프라인 안내·아이콘)만 미리 받아 두고, /api 요청과 메모 자료는 가로채거나 저장하지 않습니다.
// 이 워커가 설치되었다는 사실만으로 기기를 믿지 않습니다. 기기 승인은 서버가 확인합니다.
const CACHE = 'vault-shell-v1';
const SHELL = ['/offline.html', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    // 화면은 늘 서버에서 새로 받고, 연결이 끊겼을 때만 오프라인 안내를 보여 줍니다.
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
  }
});
