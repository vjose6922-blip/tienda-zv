const NOTIF_CACHE_KEY = 'zr_notifications_v2';
const NOTIF_CACHE_TTL = 30000;

let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let autoRefreshInterval = null;
let refreshTimeout = null;
let lazyImageObserver = null;
let allGroups = [];
let currentStatusFilter = 'all';


function getCachedNotifications() {
  try {
    const cached = localStorage.getItem(NOTIF_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp, version } = JSON.parse(cached);
    if (version !== '2.0') return null;
    if (Date.now() - timestamp > NOTIF_CACHE_TTL) {
      localStorage.removeItem(NOTIF_CACHE_KEY);
      return null;
    }
    console.log("📦 Notificaciones desde caché local");
    return data;
  } catch(e) { 
    console.warn("Error leyendo caché:", e);
    return null; 
  }
}

function setCachedNotifications(data) {
  try {
    localStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify({
      data: data,
      timestamp: Date.now(),
      version: '2.0'
    }));
    console.log("💾 Notificaciones guardadas en caché");
  } catch(e) { 
    console.warn("Error guardando caché:", e);
  }
}

function invalidateNotificationsCache() {
  localStorage.removeItem(NOTIF_CACHE_KEY);
  console.log("🗑️ Caché de notificaciones invalidado");
}


function getGroupStatus(group) {
  if (!group.notifications || group.notifications.length === 0) return 'pending';
  
  const allConfirmed = group.notifications.every(n => n.status === 'confirmed');
  const allRejected = group.notifications.every(n => n.status === 'rejected');
  
  if (allConfirmed) return 'confirmed';
  if (allRejected) return 'rejected';
  return 'pending';
}


function addStatusFilterUI() {
  const container = document.getElementById("notifications");
  if (!container) return;
  
  if (document.querySelector('.notifications-filters')) return;
  
  const filterBar = document.createElement("div");
  filterBar.className = "notifications-filters";
  
  const filters = [
    { value: 'all', label: '📋 Todas', color: '#3b1f5f' },
    { value: 'pending', label: '⏳ Pendientes', color: '#f97316' },
    { value: 'confirmed', label: '✅ Confirmadas', color: '#22c55e' },
    { value: 'rejected', label: '❌ Rechazadas', color: '#ef4444' }
  ];
  
  filters.forEach(filter => {
    const btn = document.createElement("button");
    btn.className = `filter-btn ${currentStatusFilter === filter.value ? 'active' : ''}`;
    btn.setAttribute('data-filter', filter.value);
    btn.innerHTML = filter.label;
    btn.style.cssText = `
      padding: 8px 20px;
      border: none;
      border-radius: 40px;
      background: ${currentStatusFilter === filter.value ? filter.color : '#f0f0f0'};
      color: ${currentStatusFilter === filter.value ? 'white' : '#555'};
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      transition: all 0.2s ease;
    `;
    
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        const f = b.getAttribute('data-filter');
        const filterConfig = filters.find(fc => fc.value === f);
        b.style.background = '#f0f0f0';
        b.style.color = '#555';
        b.classList.remove('active');
      });
      
      btn.style.background = filter.color;
      btn.style.color = 'white';
      btn.classList.add('active');
      
      currentStatusFilter = filter.value;
      applyStatusFilter();
    };
    
    filterBar.appendChild(btn);
  });
  
  
  const resultCounter = document.createElement("span");
  resultCounter.id = "filter-result-counter";
  resultCounter.style.cssText = `
    margin-left: auto;
    font-size: 12px;
    color: #666;
    background: #f5f5f5;
    padding: 4px 14px;
    border-radius: 20px;
  `;
  filterBar.appendChild(resultCounter);
  
  container.parentNode.insertBefore(filterBar, container);
}

function updateResultCounter(count, statusFilter) {
  const counter = document.getElementById("filter-result-counter");
  if (counter) {
    let statusText = "";
    switch(statusFilter) {
      case 'pending': statusText = "pendientes"; break;
      case 'confirmed': statusText = "confirmadas"; break;
      case 'rejected': statusText = "rechazadas"; break;
      default: statusText = "total";
    }
    counter.textContent = `${count} solicitud${count !== 1 ? 'es' : ''} ${statusText !== 'total' ? statusText : ''}`;
  }
}


function applyStatusFilter() {
  if (!allGroups.length) {
    updateResultCounter(0, currentStatusFilter);
    const container = document.getElementById("notifications");
    if (container && !document.querySelector('.notifications-filters')) {
      container.innerHTML = '<div class="empty">📭 No hay solicitudes</div>';
    }
    return;
  }
  
  let filteredGroups = [...allGroups];
  
  if (currentStatusFilter !== 'all') {
    filteredGroups = allGroups.filter(group => {
      const groupStatus = getGroupStatus(group);
      return groupStatus === currentStatusFilter;
    });
  }
  
  updateResultCounter(filteredGroups.length, currentStatusFilter);
  renderFilteredGroups(filteredGroups);
}


function renderFilteredGroups(groups) {
  const container = document.getElementById("notifications");
  if (!container) return;
  
  if (groups.length === 0) {
    let emptyMessage = "📭 ";
    switch(currentStatusFilter) {
      case 'pending': emptyMessage += "No hay solicitudes pendientes"; break;
      case 'confirmed': emptyMessage += "No hay solicitudes confirmadas"; break;
      case 'rejected': emptyMessage += "No hay solicitudes rechazadas"; break;
      default: emptyMessage += "No hay solicitudes";
    }
    container.innerHTML = `<div class="empty">${emptyMessage}</div>`;
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  for (const group of groups) {
    const card = createOptimizedNotificationCard(group);
    fragment.appendChild(card);
  }
  
  container.innerHTML = '';
  container.appendChild(fragment);
  
  initLazyImagesInNotifications();
}


async function loadNotificationsOptimized(forceRefresh = false) {
  if (typeof API_URL === 'undefined') {
    console.error("❌ API_URL no está definida");
    const container = document.getElementById("notifications");
    if (container) {
      container.innerHTML = '<div class="empty">❌ Error de configuración. Recarga la página.</div>';
    }
    return;
  }
  
  if (isLoading) {
    console.log("⏭️ Carga en progreso, omitiendo...");
    return;
  }
  
  isLoading = true;
  showSkeletonNotifications();
  
  try {
    let data;
    
    if (!forceRefresh) {
      const cached = getCachedNotifications();
      if (cached && cached.groups) {
        data = cached;
        processAndRenderNotifications(data);
        refreshInBackground();
        isLoading = false;
        return;
      }
    }
    
    if (typeof showLoader === 'function') showLoader("Cargando solicitudes...");
    
    const url = `${API_URL}?action=notificationsBatch&page=1&pageSize=100&noCache=${forceRefresh ? 'true' : 'false'}`;
    console.log("📡 Cargando desde:", url);
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || "Error al cargar");
    }
    
    data = result;
    setCachedNotifications(data);
    processAndRenderNotifications(data);
    
  } catch (err) {
    console.error("Error:", err);
    
    const fallbackCache = getCachedNotifications();
    if (fallbackCache && fallbackCache.groups) {
      console.log("⚠️ Usando caché de respaldo por error");
      processAndRenderNotifications(fallbackCache);
      if (typeof showTemporaryMessage === 'function') {
        showTemporaryMessage("⚠️ Usando datos guardados - Error de conexión", "error");
      }
    } else {
      const container = document.getElementById("notifications");
      if (container) {
        container.innerHTML = `<div class="empty">❌ Error cargando solicitudes</div>`;
      }
    }
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
    isLoading = false;
    hideSkeletonNotifications();
  }
}

function processAndRenderNotifications(data) {
  if (!data.groups) {
    console.error("No hay grupos en los datos");
    return;
  }
  
  allGroups = data.groups;
  
  
  allGroups.sort((a, b) => new Date(b.firstDate) - new Date(a.firstDate));
  
  
  if (!document.querySelector('.notifications-filters')) {
    addStatusFilterUI();
  }
  
  
  applyStatusFilter();
}

function getOptimizedThumbnail(imagenUrl) {
  if (!imagenUrl) return 'https:
  if (imagenUrl.includes('lh3.googleusercontent.com')) {
    return imagenUrl.replace(/=w[0-9]+/, '=w100');
  }
  return imagenUrl;
}

function getStatusLabel(status, hasStock) {
  if (status === 'confirmed') return '✅ Confirmado';
  if (status === 'rejected') return '❌ Rechazado';
  return hasStock ? '⏳ Pendiente' : '❌ Sin stock';
}

function createOptimizedNotificationCard(group) {
  const card = document.createElement("div");
  card.className = "request-card";
  card.setAttribute("data-request-id", escapeHtml(group.requestId));

  const groupStatus = getGroupStatus(group);

  let statusBadge = '';
  switch (groupStatus) {
    case 'confirmed':
      statusBadge = '<span class="group-status-badge confirmed">✅ Confirmado</span>';
      break;
    case 'rejected':
      statusBadge = '<span class="group-status-badge rejected">❌ Rechazado</span>';
      break;
    default:
      statusBadge = '<span class="group-status-badge pending">⏳ Pendiente</span>';
  }

  const firstDate = new Date(group.firstDate);
  const formattedDate = firstDate.toLocaleString();
  const totalAmount = group.totalAmount || 0;

  card.innerHTML = `
    <div class="request-header">
      <div class="request-header-left">
        <strong>Solicitud:</strong> 
        <span class="request-id">${escapeHtml(group.requestId)}</span>
        ${statusBadge}
      </div>
      <div class="request-header-right">
        <div class="request-date">📅 ${formattedDate}</div>
        ${group.clientPhone ? `<div class="client-phone">📱 +52 ${escapeHtml(group.clientPhone)}</div>` : ''}
      </div>
    </div>

    <div class="request-summary">
      <div class="summary-stats">
        <span class="stat-badge available">✅ ${group.availableCount} disponibles</span>
        <span class="stat-badge unavailable">❌ ${group.unavailableCount} sin stock</span>
        <span class="stat-badge total">💰 $${totalAmount.toLocaleString()}</span>
      </div>
    </div>

    <div class="request-products-container">
      ${group.notifications.map(notif => `
        <div class="request-product-item ${!notif.hasStock ? 'out-of-stock' : ''}" 
             data-product-id="${escapeHtml(String(notif.productId))}">
          
          <div class="request-product-image">
            <img 
              class="lazy-notif"
              data-src="${escapeHtml(getOptimizedThumbnail(notif.imagen))}"
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3C/svg%3E"
              alt="${escapeHtml(notif.nombre)}"
              onerror="this.src='https://via.placeholder.com/80?text=IMG';"
            >
          </div>

          <div class="request-product-info">
            <div class="request-product-name">${escapeHtml(notif.nombre)}</div>
            <div class="request-product-meta">
              <span class="meta-item">🔑 ID: ${escapeHtml(String(notif.productId))}</span>
              <span class="meta-item">📏 Talla: ${escapeHtml(notif.talla || 'N/A')}</span>
              <span class="meta-item">💰 Precio: $${(notif.precio || 0).toLocaleString()}</span>
              <span class="meta-item">📦 Cantidad: ${notif.cantidad}</span>
              ${!notif.hasStock ? `<span class="meta-item stock-warning">⚠️ Stock: ${notif.currentStock}</span>` : ''}
            </div>
          </div>

          <div class="request-product-status ${
            notif.status === 'confirmed'
              ? 'status-confirmed'
              : (notif.hasStock ? 'status-pending' : 'status-outofstock')
          }">
            ${getStatusLabel(notif.status, notif.hasStock)}
          </div>

        </div>
      `).join('')}
    </div>

    <div class="request-actions">
      ${groupStatus === 'pending' ? `
        ${group.unavailableCount > 0 ? 
          `<button class="btn btn-secondary" data-action="remove-stock">
             🗑️ Eliminar sin stock (${group.unavailableCount})
           </button>` : ''}
        ${group.availableCount > 0 ? 
          `<button class="btn btn-confirm" data-action="confirm">
             ✅ Confirmar compra (${group.availableCount})
           </button>` : ''}
        <button class="btn btn-cancel" data-action="cancel">
          ❌ Cancelar solicitud
        </button>
      ` : `
        <span class="completed-badge ${groupStatus}">
          ${groupStatus === 'confirmed' ? '✅ Pedido confirmado' : '❌ Pedido cancelado'}
        </span>
      `}
    </div>
  `;

  const requestId = group.requestId;
  card.querySelector('[data-action="remove-stock"]')?.addEventListener('click', () => removeOutOfStockNotifications(requestId));
  card.querySelector('[data-action="confirm"]')?.addEventListener('click', () => confirmGroupPurchase(requestId));
  card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => cancelGroupPurchase(requestId));

  return card;
}



function refreshInBackground() {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  
  refreshTimeout = setTimeout(async () => {
    if (document.hidden) {
      refreshTimeout = setTimeout(() => refreshInBackground(), 5000);
      return;
    }
    
    console.log("🔄 Actualización en background...");
    try {
      const url = `${API_URL}?action=notificationsBatch&page=1&pageSize=100&noCache=true`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.ok && result.groups) {
        if (JSON.stringify(result.groups) !== JSON.stringify(allGroups)) {
          console.log("✨ Cambios detectados, actualizando vista");
          setCachedNotifications(result);
          allGroups = result.groups;
          allGroups.sort((a, b) => new Date(b.firstDate) - new Date(a.firstDate));
          applyStatusFilter();
          
          if (typeof showTemporaryMessage === 'function') {
            showTemporaryMessage("✨ Solicitudes actualizadas", "info");
          }
        }
      }
    } catch (err) {
      console.log("Background refresh falló:", err);
    }
  }, 5000);
}


function showSkeletonNotifications() {
  const container = document.getElementById("notifications");
  if (!container) return;
  
  if (container.children.length > 0 && container.querySelector('.request-card')) return;
  
  const skeletonCards = [];
  for (let i = 0; i < 3; i++) {
    skeletonCards.push(`
      <div class="request-card skeleton-notif">
        <div class="skeleton-header shimmer"></div>
        <div class="skeleton-products">
          <div class="skeleton-product shimmer"></div>
          <div class="skeleton-product shimmer"></div>
        </div>
        <div class="skeleton-actions shimmer"></div>
      </div>
    `);
  }
  
  container.innerHTML = skeletonCards.join('');
}

function hideSkeletonNotifications() {
  const skeletons = document.querySelectorAll('.skeleton-notif');
  skeletons.forEach(s => {
    s.style.opacity = '0';
    setTimeout(() => {
      if (s && s.parentNode) s.remove();
    }, 200);
  });
}


function initLazyImagesInNotifications() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.lazy-notif').forEach(img => {
      const dataSrc = img.getAttribute('data-src');
      if (dataSrc) img.src = dataSrc;
    });
    return;
  }
  
  if (lazyImageObserver) lazyImageObserver.disconnect();
  
  lazyImageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
          img.src = dataSrc;
          img.classList.add('loaded');
        }
        lazyImageObserver.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });
  
  document.querySelectorAll('.lazy-notif').forEach(img => {
    lazyImageObserver.observe(img);
  });
}


function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  
  autoRefreshInterval = setInterval(() => {
    if (!document.hidden) {
      refreshInBackground();
    }
  }, 30000);
  
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshInBackground();
    }
  });
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}


async function removeOutOfStockNotifications(requestId) {
  if (!confirm("¿Eliminar los productos sin stock de esta solicitud?")) return;
  
  if (typeof showLoader === 'function') showLoader("Eliminando...");
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
body: JSON.stringify({ action: "removeOutOfStockNotifications", requestId: requestId, token: sessionStorage.getItem("admin_token") || "" })
    });
    const data = await response.json();
    
    if (data.ok) {
      alert(`✅ Eliminados ${data.removedCount} producto(s) sin stock`);
      invalidateNotificationsCache();
      loadNotificationsOptimized(true);
    } else {
      throw new Error(data.error || "Error");
    }
  } catch (err) {
    alert(`❌ Ocurrió un error. Intenta nuevamente.`);
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
  }
}

async function confirmGroupPurchase(requestId) {
  if (!confirm(`¿Confirmar TODOS los productos con stock disponible de esta solicitud?`)) return;
  
  if (typeof showLoader === 'function') showLoader("Procesando solicitud completa...");
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
body: JSON.stringify({ action: "confirmGroupPurchase", requestId: requestId, token: sessionStorage.getItem("admin_token") || "" })
    });
    const data = await response.json();
    
    if (!data.ok) throw new Error(data.error || "Error al confirmar");
    
    let summary = `✅ ${data.message}\n\n`;
    if (data.approvedCount > 0) {
      summary += `💰 Total a pagar: $${(data.totalAmount || 0).toLocaleString()}\n`;
    }
    if (data.paymentLink) {
      summary += `\n🔗 Link de pago generado. Se enviará al cliente por WhatsApp.`;
    }
    
    alert(summary);
    
    if (data.whatsappUrl) {
      window.open(data.whatsappUrl, '_blank');
    }
    
    setTimeout(() => {
      invalidateNotificationsCache();
      loadNotificationsOptimized(true);
    }, 2000);
    
  } catch (err) {
    alert(`❌ Ocurrió un error. Intenta nuevamente.`);
    if (typeof hideLoader === 'function') hideLoader();
  }
}

async function cancelGroupPurchase(requestId) {
  if (!confirm("¿Cancelar TODA la solicitud de compra?")) return;
  
  if (typeof showLoader === 'function') showLoader("Cancelando...");
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
body: JSON.stringify({ action: "cancelGroupPurchase", requestId: requestId, token: sessionStorage.getItem("admin_token") || "" })

    });
    const data = await response.json();
    
    if (data.ok) {
      alert(`✅ Solicitud cancelada (${data.cancelledCount} productos)`);
      invalidateNotificationsCache();
      loadNotificationsOptimized(true);
    } else {
      throw new Error(data.error || "Error");
    }
  } catch (err) {
    alert(`❌ Ocurrió un error. Intenta nuevamente.`);
  } finally {
    if (typeof hideLoader === 'function') hideLoader();
  }
}


document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof API_URL !== 'undefined') {
      loadNotificationsOptimized();
      startAutoRefresh();
    } else {
      console.error("❌ API_URL no disponible");
      const container = document.getElementById("notifications");
      if (container) {
        container.innerHTML = '<div class="empty">❌ Error de carga. Recarga la página.</div>';
      }
    }
  }, 100);
  
  const refreshBtn = document.querySelector('.refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      invalidateNotificationsCache();
      loadNotificationsOptimized(true);
    });
  }
});

window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
  if (lazyImageObserver) lazyImageObserver.disconnect();
});


window.removeOutOfStockNotifications = removeOutOfStockNotifications;
window.confirmGroupPurchase = confirmGroupPurchase;
window.cancelGroupPurchase = cancelGroupPurchase;
window.loadNotificationsOptimized = loadNotificationsOptimized;
window.invalidateNotificationsCache = invalidateNotificationsCache;
