// Se carga dentro del service worker. Cuando una versión nueva se activa, recarga las pantallas
// abiertas para que no se queden con la copia vieja guardada. No toca IndexedDB (tus datos).
self.addEventListener('activate', (e) => {
  e.waitUntil(
    self.clients.claim().then(() => self.clients.matchAll({ type: 'window' })).then((cs) => Promise.all(cs.map((c) => c.navigate(c.url).catch(() => {})))),
  )
})
