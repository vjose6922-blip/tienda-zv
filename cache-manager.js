const CACHE_KEYS = {
  PAGE_STATE: 'zr_page_cache',      
  PRODUCTS: 'zr_products_data'      
};


function setProductsCache(products, persistent = false) {
  try {
    const cacheData = {
      data: products,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    
    sessionStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(cacheData));
    
    
    if (persistent) {
      localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(cacheData));
    }
  } catch(e) { console.warn('Error guardando caché de productos:', e); }
}

function getProductsCache(maxAge = 300000, preferPersistent = false) {
  try {
    
    let cached = sessionStorage.getItem(CACHE_KEYS.PRODUCTS);
    let source = 'session';
    
    
    if (!cached && preferPersistent) {
      cached = localStorage.getItem(CACHE_KEYS.PRODUCTS);
      source = 'local';
    }
    
    if (!cached) return null;
    
    const { data, timestamp, version } = JSON.parse(cached);
    
    
    if (Date.now() - timestamp > maxAge) {
      
      if (source === 'session') {
        sessionStorage.removeItem(CACHE_KEYS.PRODUCTS);
      } else {
        localStorage.removeItem(CACHE_KEYS.PRODUCTS);
      }
      return null;
    }
    
    
    if (version !== '1.0') return null;
    
    console.log(`📦 Productos desde caché (${source})`);
    return data;
  } catch(e) { 
    console.warn('Error leyendo caché de productos:', e);
    return null; 
  }
}


function setSessionProductsCache(products) {
  setProductsCache(products, false);
}

function getSessionProductsCache(maxAge = 300000) {
  return getProductsCache(maxAge, false);
}


const PAGE_CACHE_KEY = CACHE_KEYS.PAGE_STATE;

function savePageState(pageName, state) {
  try {
    const allStates = JSON.parse(sessionStorage.getItem(PAGE_CACHE_KEY) || '{}');
    allStates[pageName] = {
      ...state,
      timestamp: Date.now()
    };
    sessionStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(allStates));
  } catch(e) {}
}

function restorePageState(pageName) {
  try {
    const allStates = JSON.parse(sessionStorage.getItem(PAGE_CACHE_KEY) || '{}');
    const state = allStates[pageName];
    if (state && (Date.now() - state.timestamp) < 300000) {
      return state;
    }
    return null;
  } catch(e) { return null; }
}


function preloadPage(pageUrl) {
  if (!pageUrl) return;
  
  
  if (navigator.connection && (navigator.connection.saveData || 
      navigator.connection.effectiveType === 'slow-2g' ||
      navigator.connection.effectiveType === '2g')) {
    console.log('📡 Conexión lenta, omitiendo prefetch');
    return;
  }
  
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = pageUrl;
  link.as = 'document';
  document.head.appendChild(link);
  
  const scriptMap = {
    'index.html': 'script.js',
    'looks.html': 'looks.js',
    'admin.html': 'admin.js',
    'notificaciones.html': null
  };
  
  const scriptName = scriptMap[pageUrl.split('/').pop()];
  if (scriptName) {
    const scriptLink = document.createElement('link');
    scriptLink.rel = 'prefetch';
    scriptLink.href = scriptName;
    scriptLink.as = 'script';
    document.head.appendChild(scriptLink);
  }
}

function initPreloading() {
  
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target;
          const href = link.getAttribute('href');
          if (href && href.includes('.html')) {
            preloadPage(href);
          }
          observer.unobserve(link);
        }
      });
    }, { rootMargin: '100px' });
    
    document.querySelectorAll('a[href*=".html"]').forEach(link => {
      observer.observe(link);
    });
  } else {
    
    document.querySelectorAll('a[href*=".html"]').forEach(link => {
      link.addEventListener('mouseenter', () => {
        preloadPage(link.getAttribute('href'));
      });
      
      let touchTimeout;
      link.addEventListener('touchstart', () => {
        clearTimeout(touchTimeout);
        touchTimeout = setTimeout(() => {
          preloadPage(link.getAttribute('href'));
        }, 100);
      });
    });
  }
}

function isOfflineModeAvailable() {
  const cached = getProductsCache(300000, true);
  return !!cached;
}


window.CacheManager = {
  
  setProductsCache,
  getProductsCache,
  
  
  setSessionProductsCache,
  getSessionProductsCache,
  savePageState,
  restorePageState,
  preloadPage,
  initPreloading,
  isOfflineModeAvailable
};