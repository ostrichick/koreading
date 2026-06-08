// Koreading 서비스 워커 (PWA 설치 가능 요건 충족용)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // 네트워크 리퀘스트 통과 처리 (PWA 설치 프롬프트 활성화 조건)
  e.respondWith(fetch(e.request));
});
