
// ============================================
// sw.js - Service Worker para Z&R PWA
// ============================================

const CACHE_NAME = 'zr-cache-v3';
const DYNAMIC_CACHE = 'zr-dynamic-v3';
const OFFLINE_URL = '/tienda-zv/offline.html';

// Recursos estáticos que siempre deben estar en caché
const STATIC_ASSETS = [
  '/tienda-zv/',
  '/tienda-zv/index.html',
  '/tienda-zv/catalogo.html',
  '/tienda-zv/outfit.html',
  '/tienda-zv/admin.html',
  '/tienda-zv/notificaciones.html',
  '/tienda-zv/offline.html',
  '/tienda-zv/styles.css',
  '/tienda-zv/common.js',
  '/tienda-zv/script.js',
  '/tienda-zv/looks.js',
  '/tienda-zv/home.js',
  '/tienda-zv/admin.js',
  '/tienda-zv/cache-manager.js',
  '/tienda-zv/manifest.json'
];
// Extensiones de imágenes para caché dinámico
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const API_DOMAINS = ['script.google.com', 'googleusercontent.com', 'wttr.in', 'openweathermap.org'];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Instalando PWA...');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('[SW] Cacheando assets estáticos');
      
      // Cachear recursos estáticos con manejo de errores
      const cachePromises = STATIC_ASSETS.map(async (asset) => {
        try {
          const response = await fetch(asset);
          if (response.ok) {
            await cache.put(asset, response);
          }
        } catch (error) {
          console.log(`[SW] No se pudo cachear: ${asset}`, error);
        }
      });
      
      await Promise.allSettled(cachePromises);
      
      // Cachear offline page específicamente
      const offlineResponse = await fetch(OFFLINE_URL);
      if (offlineResponse.ok) {
        await cache.put(OFFLINE_URL, offlineResponse);
      }
      
      await self.skipWaiting();
    })()
  );
});

// Activación - limpiar cachés viejos
self.addEventListener('activate', event => {
  console.log('[SW] Activando PWA...');
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
            console.log('[SW] Eliminando caché viejo:', cache);
            return caches.delete(cache);
          }
        })
      );
      await self.clients.claim();
      
      // Notificar a todos los clientes que el SW está listo
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ type: 'SW_ACTIVATED' });
      });
    })()
  );
});

// Determinar estrategia de caché según el tipo de request
function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // Imágenes
  if (IMAGE_EXTENSIONS.some(ext => url.pathname.toLowerCase().endsWith(ext))) {
    return 'CACHE_FIRST';
  }
  
  // Clima - siempre pedir red, nunca servir caché viejo
  if (url.hostname.includes('wttr.in') || url.hostname.includes('openweathermap.org')) {
    return 'NETWORK_ONLY';
  }
  
  // API y recursos externos (Google Apps Script)
  if (API_DOMAINS.some(domain => url.hostname.includes(domain))) {
    return 'NETWORK_FIRST';
  }
  
  // HTML, CSS, JS - stale-while-revalidate
  if (request.destination === 'document' || 
      request.destination === 'style' || 
      request.destination === 'script') {
    return 'STALE_WHILE_REVALIDATE';
  }
  
  return 'CACHE_FIRST';
}

// Interceptar peticiones
self.addEventListener('fetch', event => {
  const strategy = getCacheStrategy(event.request);
  
  // Prevenir fetch de chrome-extension://
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  switch (strategy) {
    case 'CACHE_FIRST':
      event.respondWith(cacheFirstStrategy(event.request));
      break;
      
    case 'NETWORK_ONLY':
      event.respondWith(networkOnlyStrategy(event.request));
      break;
      
    case 'NETWORK_FIRST':
      event.respondWith(networkFirstStrategy(event.request));
      break;
      
    case 'STALE_WHILE_REVALIDATE':
      event.respondWith(staleWhileRevalidateStrategy(event.request));
      break;
      
    default:
      event.respondWith(networkFirstStrategy(event.request));
  }
});

// Estrategia: Cache First (para imágenes y assets estáticos)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Si es una navegación a HTML, mostrar offline page
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    return new Response('Error de conexión', { status: 404, statusText: 'Offline' });
  }
}

// Estrategia: Network Only (para clima - siempre datos frescos)
async function networkOnlyStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Sin red y sin caché: devolver respuesta vacía para que la app maneje el fallback
    return new Response(JSON.stringify(null), {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Estrategia: Network First (para API)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Para navegación, mostrar offline page
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    
    throw error;
  }
}

// Estrategia: Stale While Revalidate (para HTML/CSS/JS)
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.status === 200) {
      const cache = caches.open(CACHE_NAME);
      cache.then(c => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => null);
  
  if (cachedResponse) {
    // Actualizar en segundo plano
    fetchPromise.catch(() => {});
    return cachedResponse;
  }
  
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }
  
  // Fallback a offline page para navegación
  if (request.mode === 'navigate') {
    return caches.match(OFFLINE_URL);
  }
  
  return new Response('Contenido no disponible', { status: 404 });
}

// Push Notifications (opcional)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || '¡Novedades en Z&R!',
    icon: '/tienda-zv/icons/icon-192.png',
    badge: '/tienda-zv/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/tienda-zv/'
    },
    actions: [
      { action: 'open', title: 'Ver ahora' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Z&R', options)
  );
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/tienda-zv/';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          for (let client of windowClients) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          if (self.clients.openWindow) {
            return self.clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Sincronización en segundo plano (Background Sync)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }
});

async function syncCart() {
  // Implementar sincronización de carrito pendiente
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_CART' });
  });
}

// Period Sync (actualización periódica en background)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-products') {
    event.waitUntil(updateProductsInBackground());
  }
});

async function updateProductsInBackground() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch('https://script.google.com/macros/s/AKfycbzNshrt3zldBNiyoB8x36ktCEO02H0cKxebiTuK7UAbsgd5R9biaCW7W4ihm1aVOJG7ww/exec');
    if (response.ok) {
      await cache.put('/tienda-zv/api/products', response.clone());
    }
  } catch (error) {
    console.log('[SW] Background sync falló:', error);
  }
          }
