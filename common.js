
const WHATSAPP_NUMBER = "528671781272";
const CACHE_KEY = 'zr_products_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; 
const API_URL = "https://script.google.com/macros/s/AKfycbzNshrt3zldBNiyoB8x36ktCEO02H0cKxebiTuK7UAbsgd5R9biaCW7W4ihm1aVOJG7ww/exec";
const RECENT_PRODUCTS_KEY = 'zr_recent_products';
const MAX_RECENT_PRODUCTS = 12;

let localCart = {};
let imageObserver = null;
let activeModal = null;
let connectionBanner = null;
let isOnline = navigator.onLine;
let productsByCategoryMap = null;
let allProductsIndexed = [];
let lastPhoneDisplayed = null;

function buildProductIndex(products) {
  if (!products || products.length === 0) return;
  
  allProductsIndexed = products;
  productsByCategoryMap = new Map();
  
  productsByCategoryMap.set('TODOS', products);
  
  products.forEach(product => {
    const category = product.Categoria;
    if (!category) return;
    
    if (!productsByCategoryMap.has(category)) {
      productsByCategoryMap.set(category, []);
    }
    productsByCategoryMap.get(category).push(product);
  });
  
  console.log(`✅ Indexados ${products.length} productos en ${productsByCategoryMap.size - 1} categorías`);
}

function getProductsByCategoryIndexed(category) {
  if (!category || category === '') return allProductsIndexed;
  return productsByCategoryMap?.get(category) || [];
}

function clearProductIndex() {
  productsByCategoryMap = null;
  allProductsIndexed = [];
}



function showLoader(text = "Cargando...") {
  let loader = document.getElementById("global-loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "global-loader";
    loader.className = "global-loader";
    loader.innerHTML = `<div class="loader-spinner"></div><div class="loader-text">${text}</div>`;
    document.body.appendChild(loader);
  } else {
    const txt = loader.querySelector(".loader-text");
    if (txt) txt.textContent = text;
    loader.classList.remove("hidden");
  }
}

function hideLoader() {
  const loader = document.getElementById("global-loader");
  if (loader) loader.classList.add("hidden");
}

function showTemporaryMessage(text, type = "info") {
  const existing = document.querySelector('.temporary-message');
  if (existing) existing.remove();
  
  const messageDiv = document.createElement("div");
  messageDiv.className = `temporary-message ${type}`;
  messageDiv.textContent = text;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.style.animation = "slideDown 0.3s ease";
    setTimeout(() => messageDiv.remove(), 300);
  }, 3000);
}

function closeCurrentModal() {
  if (activeModal) {
    activeModal.classList.add("closing");
    setTimeout(() => {
      if (activeModal && activeModal.parentNode) activeModal.remove();
      activeModal = null;
    }, 150);
  }
}

function showCustomAlert(options) {
  const { title, message, icon = "ℹ️", confirmText = "Aceptar", onConfirm } = options;
  const modal = document.createElement("div");
  modal.className = "custom-alert-modal";
  modal.innerHTML = `
    <div class="custom-alert-content">
      <div class="custom-alert-header"><span class="custom-alert-icon">${escapeHtml(icon)}</span><h3>${escapeHtml(title)}</h3></div>
      <div class="custom-alert-body"><p>${escapeHtml(message)}</p></div>
      <div class="custom-alert-footer"><button class="custom-alert-btn confirm">${escapeHtml(confirmText)}</button></div>
    </div>
  `;
  document.body.appendChild(modal);
  activeModal = modal;
  const confirmBtn = modal.querySelector(".custom-alert-btn.confirm");
  const close = () => {
    if (!modal.parentNode) return;
    modal.classList.add("closing");
    setTimeout(() => { if (modal.parentNode) modal.remove(); if (activeModal === modal) activeModal = null; if (onConfirm) onConfirm(); }, 150);
  };
  confirmBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal && !modal.classList.contains("closing")) close(); });
}

function showCustomConfirm(options) {
  const { title, message, icon = "❓", confirmText = "Aceptar", cancelText = "Cancelar", onConfirm, onCancel } = options;
  const modal = document.createElement("div");
  modal.className = "custom-alert-modal";
  modal.innerHTML = `
    <div class="custom-alert-content">
      <div class="custom-alert-header"><span class="custom-alert-icon">${escapeHtml(icon)}</span><h3>${escapeHtml(title)}</h3></div>
      <div class="custom-alert-body"><p>${escapeHtml(message)}</p></div>
      <div class="custom-alert-footer">
        <button class="custom-alert-btn cancel">${escapeHtml(cancelText)}</button>
        <button class="custom-alert-btn confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  activeModal = modal;
  const confirmBtn = modal.querySelector(".custom-alert-btn.confirm");
  const cancelBtn = modal.querySelector(".custom-alert-btn.cancel");
  const close = (callback) => {
    if (!modal.parentNode) return;
    modal.classList.add("closing");
    setTimeout(() => { if (modal.parentNode) modal.remove(); if (activeModal === modal) activeModal = null; if (callback) callback(); }, 150);
  };
  confirmBtn.addEventListener("click", () => close(onConfirm));
  cancelBtn.addEventListener("click", () => close(onCancel));
  modal.addEventListener("click", (e) => { if (e.target === modal && !modal.classList.contains("closing")) close(onCancel); });
}

function showCustomPrompt(options) {
  const { title, message, icon = "📝", defaultValue = "", confirmText = "Aceptar", cancelText = "Cancelar", onConfirm, onCancel } = options;
  const modal = document.createElement("div");
  modal.className = "custom-alert-modal";
  modal.innerHTML = `
    <div class="custom-alert-content">
      <div class="custom-alert-header"><span class="custom-alert-icon">${escapeHtml(icon)}</span><h3>${escapeHtml(title)}</h3></div>
      <div class="custom-alert-body">
        <p>${escapeHtml(message)}</p>
        <input type="text" class="custom-alert-input" id="custom-prompt-input" value="${escapeHtml(defaultValue)}" autocomplete="off">
      </div>
      <div class="custom-alert-footer">
        <button class="custom-alert-btn cancel">${escapeHtml(cancelText)}</button>
        <button class="custom-alert-btn confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  activeModal = modal;
  const input = modal.querySelector("#custom-prompt-input");
  const confirmBtn = modal.querySelector(".custom-alert-btn.confirm");
  const cancelBtn = modal.querySelector(".custom-alert-btn.cancel");
  setTimeout(() => input.focus(), 100);
  const close = (callback, value = null) => {
    if (!modal.parentNode) return;
    modal.classList.add("closing");
    setTimeout(() => { if (modal.parentNode) modal.remove(); if (activeModal === modal) activeModal = null; if (callback) callback(value); }, 150);
  };
  confirmBtn.addEventListener("click", () => close(onConfirm, input.value));
  cancelBtn.addEventListener("click", () => close(onCancel, null));
  input.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); close(onConfirm, input.value); } });
  modal.addEventListener("click", (e) => { if (e.target === modal && !modal.classList.contains("closing")) close(onCancel, null); });
}

if (!window.alertIntercepted) {
  window.originalAlert = window.alert;
  window.alert = function(message) { return new Promise((resolve) => { closeCurrentModal(); showCustomAlert({ title: "Aviso", message: String(message), icon: "ℹ️", confirmText: "Aceptar", onConfirm: () => resolve() }); }); };
  window.originalConfirm = window.confirm;
  window.confirm = function(message) { return new Promise((resolve) => { closeCurrentModal(); showCustomConfirm({ title: "Confirmar", message: String(message), icon: "❓", confirmText: "Aceptar", cancelText: "Cancelar", onConfirm: () => resolve(true), onCancel: () => resolve(false) }); }); };
  window.originalPrompt = window.prompt;
  window.prompt = function(message, defaultValue = "") { return new Promise((resolve) => { closeCurrentModal(); showCustomPrompt({ title: "Ingresar información", message: String(message), icon: "📝", defaultValue: defaultValue, confirmText: "Aceptar", cancelText: "Cancelar", onConfirm: (value) => resolve(value), onCancel: () => resolve(null) }); }); };
  window.alertIntercepted = true;
}

function getCachedProducts() {
  if (window.CacheManager && window.CacheManager.getSessionProductsCache) {
    const sessionCached = window.CacheManager.getSessionProductsCache();
    if (sessionCached && sessionCached.length > 0) {
      console.log("✅ Usando caché de sesión (instantáneo)");
      return sessionCached;
    }
  }
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_EXPIRY) { 
      localStorage.removeItem(CACHE_KEY); 
      return null; 
    }
    console.log("📦 Usando caché de localStorage");
    return data;
  } catch { return null; }
}

function setCachedProducts(products) {
  if (window.CacheManager && window.CacheManager.setSessionProductsCache) {
    window.CacheManager.setSessionProductsCache(products);
  }
  
  try { 
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: products, timestamp: Date.now() })); 
  } catch (e) { console.warn("No se pudo guardar en caché:", e); }
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return `$${num.toLocaleString("es-MX", { minimumFractionDigits: 0 })}`;
}




function hasFreeShipping(price) {
  const numericPrice = Number(price) || 0;
  return numericPrice >= 300;
}

function getShippingBadge(price) {
  if (hasFreeShipping(price)) {
    return `<span class="shipping-badge" title="Envío a domicilio o punto intermedio">🚚</span>`;
  }
  return '';
}






function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')      // backticks
    .replace(/\//g, '&#x2F;');    // forward slash
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}
function safeHtml(strings, ...values) {
  return strings.reduce((result, string, i) => {
    const value = values[i];
    const escaped = typeof value === 'string' ? escapeHtml(value) : 
                    value === null || value === undefined ? '' : 
                    String(value);
    return result + string + escaped;
  }, '');
}

function escapeJsString(str) {
  return String(str)
    .replace(/\\/g, "\\\\")   
    .replace(/'/g, "\\'")     
    .replace(/"/g, '\\"')     
    .replace(/\n/g, "\\n")    
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\u2028/g, "\\u2028") 
    .replace(/\u2029/g, "\\u2029");
}


function optimizeDriveUrl(url, size = 400) {
  if (!url) return "";
  const match = url.match(/[-\w]{25,}/);
  if (match) {
    const id = match[0];
    // Tamaños responsivos según dispositivo real
    const screenWidth = window.innerWidth;
    let actualSize;
    
    if (screenWidth < 480) {
      actualSize = 300;   // Móvil pequeño
    } else if (screenWidth < 768) {
      actualSize = 400;   // Móvil grande/tablet
    } else if (screenWidth < 1200) {
      actualSize = 600;   // Desktop pequeño
    } else {
      actualSize = 800;   // Desktop grande
    }
    
    // Si la función fue llamada con un tamaño específico, respetarlo pero sin exceder 800
    if (size && size < actualSize) {
      actualSize = Math.min(size, 800);
    }
    
    return `https://drive.google.com/thumbnail?id=${id}&sz=w${actualSize}`;
  }
  return url;
}

function generateRequestId() {
  return 'REQ_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
}

function updateSavedPhoneDisplay() {
  const container = document.getElementById("saved-phone-container");
  const display = document.getElementById("saved-phone-display");
  const savedPhone = localStorage.getItem("client_phone");
  
  if (container && display) {
    if (savedPhone && savedPhone.length === 10) {
      const formatted = `${savedPhone.slice(0,2)}-${savedPhone.slice(2,6)}-${savedPhone.slice(6)}`;
      
      if (lastPhoneDisplayed !== formatted) {
        display.textContent = formatted;
        container.style.display = "block";
        container.style.setProperty('display', 'block', 'important');
        lastPhoneDisplayed = formatted;
      }
    } else if (lastPhoneDisplayed !== null) {
      container.style.display = "none";
      lastPhoneDisplayed = null;
    }
  }
}

async function changePhoneNumber() {
  
  const currentPhone = localStorage.getItem("client_phone") || "";
  const formattedCurrent = currentPhone && currentPhone.length === 10 
    ? `${currentPhone.slice(0,2)}-${currentPhone.slice(2,6)}-${currentPhone.slice(6)}` 
    : "no guardado";
  
  const newPhone = await new Promise((resolve) => {
    showCustomPrompt({
      title: "📱 Cambiar número de teléfono",
      message: `Número actual: ${formattedCurrent}\n\nIngresa tu nuevo número (10 dígitos):\nEjemplo: 8671234567\n\n⚠️ Solo números, sin espacios ni código país.`,
      icon: "📱",
      defaultValue: currentPhone || "",
      confirmText: "Guardar",
      cancelText: "Cancelar",
      onConfirm: (value) => resolve(value),
      onCancel: () => resolve(null)
    });
  });
  
  if (newPhone === null) {
    return;
  }
  
  if (newPhone === "") {
    const confirmDelete = await new Promise((resolve) => {
      showCustomConfirm({
        title: "🗑️ Eliminar número",
        message: "¿Eliminar tu número guardado? Deberás ingresarlo nuevamente en tu próxima compra.",
        icon: "⚠️",
        confirmText: "Sí, eliminar",
        cancelText: "Cancelar",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
    
    if (confirmDelete) {
      localStorage.removeItem("client_phone");
      updateSavedPhoneDisplay();
    }
    return;
  }
  
  let cleanPhone = newPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.length !== 10) {
    showCustomAlert({
      title: "❌ Número inválido",
      message: "El número debe tener exactamente 10 dígitos.\nEjemplo: 8671234567",
      icon: "❌",
      confirmText: "Entendido"
    });
    return;
  }
  
  localStorage.setItem("client_phone", cleanPhone);
  updateSavedPhoneDisplay();
  
  const formatted = `${cleanPhone.slice(0,2)}-${cleanPhone.slice(2,6)}-${cleanPhone.slice(6)}`;
  showCustomAlert({
    title: "✅ ¡Número actualizado!",
    message: `Tu nuevo número es: ${formatted}\n\nSe usará para futuras compras.`,
    icon: "📱",
    confirmText: "Aceptar"
  });
  
}

function showPrivacyModal(onAccept) {
  let modal = document.getElementById("privacy-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "privacy-modal";
    modal.className = "privacy-modal";
    modal.innerHTML = `
      <div class="privacy-modal-content">
        <div class="privacy-modal-header"><span class="privacy-icon">🔒</span><h2>Aviso de Privacidad</h2></div>
        <div class="privacy-modal-body">
          <p><strong>Z&R</strong>, con responsabilidad en el tratamiento de sus datos personales, le informa lo siguiente:</p>
          <h3>📱 Datos recopilados</h3><p>Para procesar tus compras, recopilamos tu <strong>número de teléfono</strong> (WhatsApp).</p>
          <h3>🎯 Finalidad</h3><p>Tu número será utilizado EXCLUSIVAMENTE para:</p>
          <ul><li>✓ Confirmar tu identidad en las solicitudes de compra</li><li>✓ Enviarte el link de pago cuando el administrador confirme tu pedido</li><li>✓ Comunicarme contigo sobre el estado de tu compra</li></ul>
          <h3>🚫 No compartimos tus datos</h3><p>Tu número de teléfono NO será vendido, cedido ni compartido con terceros. Solo será visible para el administrador de Z&R para procesar tu pedido.</p>
          <h3>⏰ Conservación</h3><p>Tus datos se conservarán únicamente durante el tiempo necesario para cumplir con las finalidades descritas.</p>
          <h3>✋ Tus derechos (ARCO)</h3><p>Puedes solicitar la eliminacíon de tus datos escribiendo a: <strong>zrstore@email.com</strong></p>
          <p class="privacy-date">Última actualización: Abril 2026</p>
        </div>
        <div class="privacy-modal-footer">
          <button id="reject-privacy-btn" class="privacy-btn reject">❌ Rechazar</button>
          <button id="accept-privacy-btn" class="privacy-btn accept">✅ Aceptar y continuar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = "flex";
  const acceptBtn = document.getElementById("accept-privacy-btn");
  const rejectBtn = document.getElementById("reject-privacy-btn");
  const handleAccept = () => { localStorage.setItem("privacy_accepted", "true"); modal.style.display = "none"; if (onAccept) onAccept(); cleanup(); };
  const handleReject = () => { modal.style.display = "none"; showTemporaryMessage("❌ Debes aceptar el aviso de privacidad para continuar", "error"); cleanup(); };
  const cleanup = () => { if (acceptBtn) acceptBtn.removeEventListener("click", handleAccept); if (rejectBtn) rejectBtn.removeEventListener("click", handleReject); };
  if (acceptBtn) acceptBtn.addEventListener("click", handleAccept);
  if (rejectBtn) rejectBtn.addEventListener("click", handleReject);
}

function loadCartFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem("cart") || "{}");
    localCart = {};

    for (const [key, item] of Object.entries(raw)) {
      // Validar que cada item tenga la estructura esperada y valores sensatos
      if (
        item && typeof item === 'object' &&
        item.id !== undefined &&
        typeof item.quantity === 'number' && item.quantity > 0 && item.quantity <= 99 &&
        typeof item.price === 'number' && item.price >= 0 && item.price <= 999999
      ) {
        localCart[key] = {
          id:       item.id,
          name:     String(item.name || '').slice(0, 200),
          price:    item.price,
          quantity: Math.floor(item.quantity),
          Imagen1:  String(item.Imagen1 || '').slice(0, 500),
          Talla:    String(item.Talla || '').slice(0, 50)
        };
      }
    }
  } catch {
    localCart = {};
  }
  updateCartBadge();
}
function saveCartToStorage() { localStorage.setItem("cart", JSON.stringify(localCart)); }

function updateCartBadge() {
  const countEl = document.getElementById("cart-count");
  if (countEl) { const totalQty = Object.values(localCart).reduce((sum, item) => sum + (item.quantity || 0), 0); countEl.textContent = totalQty; }
}

function addToCart(product) {
  const id = product.ID;
  if (!id) { console.error("Producto sin ID:", product); return; }
  if (!localCart[id]) {
    localCart[id] = { id: id, name: product.Nombre || "Producto", price: Number(product.Precio || 0), quantity: 0, Imagen1: product.Imagen1 || "", Talla: product.Talla || "" };
  }
  localCart[id].quantity += 1;
  saveCartToStorage();
  updateCartBadge();
  animateCartAdd();
  
  let wishlist = getWishlist();
  const existedInWishlist = wishlist.some(item => item.id === String(id));
  if (existedInWishlist) {
    wishlist = wishlist.filter(item => item.id !== String(id));
    saveWishlist(wishlist);
    updateAllWishlistButtons(id, false);
    if (typeof renderWishlist === 'function') renderWishlist();
  } else {
  }
  
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: localCart }));
}

function animateCartAdd() {
  const btn = document.getElementById("floating-cart-btn");
  if (btn) { btn.style.transform = "translateY(-4px) scale(1.05)"; setTimeout(() => btn.style.transform = "", 180); }
}


function openCartDrawer() {
  console.log("🔍 [CARRITO] Abriendo carrito...");
  
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("overlay");
  
  if (!drawer) {
    console.error("❌ [CARRITO] No existe #cart-drawer");
    return;
  }
  
  if (!overlay) {
    console.error("❌ [CARRITO] No existe #overlay");
    return;
  }
  
  drawer.classList.add("open");
  overlay.classList.add("visible");
  
  if (typeof renderCart === 'function') {
    renderCart();
  }
  
  if (typeof updateSavedPhoneDisplay === 'function') {
    updateSavedPhoneDisplay();
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("overlay");
  if (drawer) drawer.classList.remove("open");
  if (overlay) overlay.classList.remove("visible");
}



function renderCart() {
  console.log("🔄 [RENDER] renderCart() iniciada");
  
  const container = document.getElementById("cart-items-container");
  if (!container) {
    console.error("❌ [RENDER] No existe #cart-items-container");
    return;
  }
  
  container.innerHTML = "";
  const items = Object.values(localCart);
  
  if (items.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">🛍️</div>
        <p class="helper-text">Tu carrito está vacío.</p>
        <p class="cart-empty-hint">Agrega productos para comenzar</p>
      </div>`;
  } else {
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      
      const imgUrl = item.Imagen1 ? optimizeDriveUrl(item.Imagen1, 120) : '';
      const imgHtml = imgUrl
        ? `<div class="cart-item-img-wrap">
             <img class="cart-item-img" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.parentElement.style.display='none'">
           </div>`
        : `<div class="cart-item-img-wrap cart-item-img-placeholder">
             <span>👕</span>
           </div>`;

      const tallaBadge = item.Talla
        ? `<span class="cart-item-talla">Talla: ${escapeHtml(item.Talla)}</span>`
        : '';

      row.innerHTML = `
        ${imgHtml}
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(item.name || `ID ${item.id}`)}</div>
          ${tallaBadge}
          <div class="cart-item-meta">${formatCurrency(item.price)} c/u</div>
          <div class="cart-item-actions">
            <button class="qty-btn" data-action="decrement" data-id="${item.id}">−</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn" data-action="increment" data-id="${item.id}">+</button>
            <button class="cart-item-remove" data-action="remove" data-id="${item.id}">🗑</button>
          </div>
        </div>
      `;
      container.appendChild(row);
    });
    
    document.querySelectorAll('.qty-btn[data-action="decrement"]').forEach(btn => {
      btn.removeEventListener('click', handleDecrement);
      btn.addEventListener('click', handleDecrement);
    });
    
    document.querySelectorAll('.qty-btn[data-action="increment"]').forEach(btn => {
      btn.removeEventListener('click', handleIncrement);
      btn.addEventListener('click', handleIncrement);
    });
    
    document.querySelectorAll('.cart-item-remove[data-action="remove"]').forEach(btn => {
      btn.removeEventListener('click', handleRemove);
      btn.addEventListener('click', handleRemove);
    });
  }
  
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotalEl = document.getElementById("cart-subtotal");
  const totalEl = document.getElementById("cart-total");
  
  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (totalEl) totalEl.textContent = formatCurrency(subtotal);
  
  // ========== 🚚 AGREGAR INFORMACIÓN DE ENVÍO EN EL CARRITO ==========
  const hasShippingItem = items.some(item => hasFreeShipping(item.price));
  const footer = document.querySelector('#cart-drawer .cart-footer');
  const existingShipping = footer ? footer.querySelector('.cart-shipping-info') : null;
  
  if (hasShippingItem && footer && !existingShipping) {
    const requestBtn = footer.querySelector('#request-purchase-btn');
    if (requestBtn) {
      const shippingHtml = `
        <div class="cart-shipping-info">
          <div class="shipping-badge-cart">🚚 Envío disponible</div>
          <p class="shipping-note">📦 Las entregas pueden variar dependiendo la distancia. Se puede realizar a domicilio o punto intermedio.</p>
        </div>
      `;
      requestBtn.insertAdjacentHTML('beforebegin', shippingHtml);
    }
  } else if (!hasShippingItem && existingShipping) {
    existingShipping.remove();
  } else if (hasShippingItem && existingShipping) {
    // Ya existe, no hacer nada
  }
  // ========== FIN AGREGADO ==========
  
  // Configurar botón de cambio de número
  setTimeout(() => {
    const changePhoneBtn = document.getElementById('change-phone-btn');
    if (changePhoneBtn) {
      console.log("📞 Configurando botón change-phone-btn");
      const newBtn = changePhoneBtn.cloneNode(true);
      changePhoneBtn.parentNode.replaceChild(newBtn, changePhoneBtn);
      
      newBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log("🖱️ Click en botón Cambiar número");
        if (typeof window.changePhoneNumber === 'function') {
          await window.changePhoneNumber();
        } else if (typeof changePhoneNumber === 'function') {
          await changePhoneNumber();
        } else {
          console.error("❌ changePhoneNumber no está definida");
          if (typeof showCustomAlert === 'function') {
            showCustomAlert({
              title: "Error",
              message: "Función no disponible. Recarga la página.",
              icon: "❌",
              confirmText: "Aceptar"
            });
          }
        }
      });
    } else {
      console.warn("📞 No se encontró el botón change-phone-btn en el DOM");
    }
  }, 100);
  
  updateSavedPhoneDisplay();
}
function handleDecrement(e) {
  e.stopPropagation();
  const id = e.currentTarget.getAttribute('data-id');
  if (id && typeof window.changeCartQty === 'function') {
    window.changeCartQty(id, -1);
    renderCart();
  }
}

function handleIncrement(e) {
  e.stopPropagation();
  const id = e.currentTarget.getAttribute('data-id');
  if (id && typeof window.changeCartQty === 'function') {
    window.changeCartQty(id, 1);
    renderCart();
  }
}

function handleRemove(e) {
  e.stopPropagation();
  const id = e.currentTarget.getAttribute('data-id');
  if (id && typeof window.removeFromCart === 'function') {
    window.removeFromCart(id);
    renderCart();
  }
}

function openImageModal(url, productId = null) {
  const modal = document.getElementById("image-modal");
  const img = document.getElementById("image-modal-img");
  const overlay = document.getElementById("overlay");
  
  if (modal && img) {
    img.src = url;
    modal.classList.add("open");
    if (overlay) overlay.classList.add("visible");
    
    // Trackear producto visto si se proporciona el ID
    if (productId && typeof addToRecentProducts === 'function') {
      addToRecentProducts(productId);
      console.log(`📌 Producto ${productId} registrado como visto (desde modal)`);
    }
  }
}

function closeImageModal() {
  const modal = document.getElementById("image-modal");
  const overlay = document.getElementById("overlay");
  if (modal) modal.classList.remove("open");
  if (overlay) overlay.classList.remove("visible");
}
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;

function shareProduct(id) {
  const url = `${window.location.origin}${window.location.pathname}#producto-${id}`;
  if (navigator.share) {
    navigator.share({ title: "Producto", text: "Mira este producto", url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => alert("Enlace copiado")).catch(() => {});
  }
}

function createImageObserver() {
  if ("IntersectionObserver" in window) {
    imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const dataSrc = img.getAttribute("data-src");
          if (dataSrc) {
            const newImg = new Image();
            newImg.onload = () => { img.src = dataSrc; img.removeAttribute("data-src"); };
            newImg.src = dataSrc;
          }
          imageObserver.unobserve(img);
        }
      });
    }, { rootMargin: "50px 0px", threshold: 0.01 });
  }
  return imageObserver;
}


async function openWhatsAppCheckout() {
  const items = Object.values(localCart);
  if (items.length === 0) {
    showTemporaryMessage("No hay productos en el carrito", "error");
    return;
  }
  
  const hasAcceptedPrivacy = localStorage.getItem("privacy_accepted") === "true";
  if (!hasAcceptedPrivacy) {
    showPrivacyModal(() => continueCheckout());
    return;
  }
  continueCheckout();
}

async function continueCheckout() {
  const items = Object.values(localCart);
  if (items.length === 0) return;
  
  let clientPhone = localStorage.getItem("client_phone");
  if (!clientPhone) {
    clientPhone = await prompt(
      "📱 Para procesar tu compra, ingresa tu número de WhatsApp (10 dígitos):\n\n⚠️ Solo números, sin espacios ni código país.\n🔒 Tus datos están protegidos (aceptaste el aviso de privacidad)",
      ""
    );
    if (!clientPhone) {
      showTemporaryMessage("❌ Necesitamos tu número para procesar la compra", "error");
      return;
    }
    clientPhone = clientPhone.replace(/[^0-9]/g, '');
    if (clientPhone.length !== 10) {
      showTemporaryMessage("❌ Número inválido. Debe tener 10 dígitos.", "error");
      return;
    }
    localStorage.setItem("client_phone", clientPhone);
  }
  
  showLoader("Enviando solicitud...");
  const requestId = generateRequestId();
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let adminMessage = "*🛍️ NUEVA SOLICITUD DE COMPRA*\n";
  adminMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  adminMessage += `👤 *Cliente:* +52 ${clientPhone}\n`;
  adminMessage += `🆔 *ID Solicitud:* ${requestId}\n`;
  adminMessage += `📅 *Fecha:* ${new Date().toLocaleString()}\n`;
  adminMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  adminMessage += "*📦 DETALLE DE PRODUCTOS:*\n\n";

  items.forEach((item, index) => {
    const safeName = String(item.name || '').replace(/[\r\n]/g, ' ').trim();
    const safeTalla = String(item.Talla || 'No especificada').replace(/[\r\n]/g, ' ').trim();
    adminMessage += `┌──────────────────────────────┐\n`;
    adminMessage += `│ *${safeName}*\n`;
    adminMessage += `├──────────────────────────────┤\n`;
    adminMessage += `│ 🆔 ID: ${item.id}\n`;
    adminMessage += `│ 📏 Talla: ${safeTalla}\n`;
    adminMessage += `│ 🔢 Cantidad: ${item.quantity}\n`;
    adminMessage += `│ 💰 Precio: $${item.price.toLocaleString()} c/u\n`;
    adminMessage += `│ 💵 Subtotal: $${(item.price * item.quantity).toLocaleString()}\n`;
    if (hasFreeShipping(item.price)) {
      adminMessage += `│ 🚚 Envío disponible\n`;
    }
    adminMessage += `└──────────────────────────────┘\n`;
    if (index < items.length - 1) adminMessage += `\n`;
  });

  adminMessage += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  adminMessage += `💰 *TOTAL: $${total.toLocaleString()} MXN*\n`;
  adminMessage += `🚚 *Envío:* ${items.some(i => hasFreeShipping(i.price)) ? 'Disponible (consultar)' : 'No disponible'}\n`;
  adminMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
  
  const whatsappAdminUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(adminMessage)}`;
  window.open(whatsappAdminUrl, '_blank');
  
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveClientPhone", requestId: requestId, phone: clientPhone })
    });
    
   // En common.js, función continueCheckout()
const notificationItems = items.map(item => ({
  productId: item.id,
  nombre: item.name,
  cantidad: item.quantity,
  imagen: item.Imagen1 || "",
  talla: item.Talla || "",
  precio: item.price || 0          // ← AÑADIR ESTO
}));
    
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "createNotification", items: notificationItems, requestId: requestId })
    });
    
    localCart = {};
    saveCartToStorage();
    updateCartBadge();
    renderCart();
    showTemporaryMessage(`✅ ¡Solicitud enviada! Recibirás el link de pago por WhatsApp cuando el administrador confirme.`, "success");
    closeCartDrawer();
  } catch(err) {
    console.error("Error:", err);
    showTemporaryMessage("❌ Error al enviar la solicitud", "error");
  } finally {
    hideLoader();
  }
}

async function fetchProductsAPI(shouldIndex = false) {
  const cached = getCachedProducts();
  if (cached && cached.length > 0) {
    if (shouldIndex) buildProductIndex(cached);
    return cached;
  }
  
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    const products = data.products || data || [];
    setCachedProducts(products);
    if (shouldIndex) buildProductIndex(products);
    return products;
  } catch (err) {
    console.error("Error fetching products:", err);
    return [];
  }
}

async function getIndexedProducts(forceRefresh = false) {
  if (forceRefresh || !allProductsIndexed.length) {
    await fetchProductsAPI(true);
  }
  return allProductsIndexed;
}


function createConnectionBanner() {
  if (connectionBanner) return;
  
  connectionBanner = document.createElement('div');
  connectionBanner.id = 'connection-banner';
  connectionBanner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10001;
    padding: 12px 16px;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    transform: translateY(-100%);
    transition: transform 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  `;
  
  document.body.insertBefore(connectionBanner, document.body.firstChild);
}

function showOfflineBanner() {
  if (!connectionBanner) createConnectionBanner();
  
  connectionBanner.style.background = '#ffebee';
  connectionBanner.style.color = '#c62828';
  connectionBanner.style.borderBottom = '2px solid #ef5350';
  connectionBanner.innerHTML = `
    <span style="font-size: 20px;">📡</span>
    <span><strong>⚠️ Modo offline</strong> - Estás viendo una versión guardada del catálogo</span>
    <button id="dismiss-offline-btn" style="
      background: rgba(198, 40, 40, 0.1);
      border: 1px solid #ef5350;
      padding: 4px 12px;
      border-radius: 20px;
      color: #c62828;
      cursor: pointer;
      font-size: 12px;
    ">Entendido</button>
  `;
  
  connectionBanner.style.transform = 'translateY(0)';
  connectionBanner.style.display = 'flex';
  
  const dismissBtn = document.getElementById('dismiss-offline-btn');
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      connectionBanner.style.transform = 'translateY(-100%)';
      sessionStorage.setItem('offline_banner_dismissed', Date.now().toString());
      setTimeout(() => {
        if (connectionBanner) connectionBanner.style.display = 'none';
      }, 300);
    };
  }
  
  addOfflineIndicator();
}

function showOnlineBanner() {
  if (!connectionBanner) createConnectionBanner();
  
  connectionBanner.style.background = '#e8f5e9';
  connectionBanner.style.color = '#2e7d32';
  connectionBanner.style.borderBottom = '2px solid #4caf50';
  connectionBanner.innerHTML = `
    <span style="font-size: 20px;">✅</span>
    <span><strong>¡Conexión restablecida!</strong> La página se actualizará automáticamente</span>
    <button id="refresh-now-btn" style="
      background: #4caf50;
      border: none;
      padding: 6px 16px;
      border-radius: 20px;
      color: white;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    ">Actualizar ahora</button>
  `;
  
  connectionBanner.style.transform = 'translateY(0)';
  connectionBanner.style.display = 'flex';
  
  setTimeout(() => {
    if (connectionBanner && connectionBanner.style.transform !== 'translateY(-100%)') {
      connectionBanner.style.transform = 'translateY(-100%)';
      setTimeout(() => {
        if (connectionBanner) connectionBanner.style.display = 'none';
      }, 300);
    }
  }, 5000);
  
  const refreshBtn = document.getElementById('refresh-now-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      window.location.reload();
    };
  }
  
  removeOfflineIndicator();
}

function addOfflineIndicator() {
  let indicator = document.getElementById('offline-mode-indicator');
  if (indicator) return;
  
  indicator = document.createElement('div');
  indicator.id = 'offline-mode-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 70px;
    left: 16px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
    color: #ffeb3b;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    pointer-events: none;
  `;
  indicator.innerHTML = '📡 <span>Modo offline</span>';
  document.body.appendChild(indicator);
}

function removeOfflineIndicator() {
  const indicator = document.getElementById('offline-mode-indicator');
  if (indicator) indicator.remove();
}

function startConnectionMonitor() {
  setInterval(() => {
    const wasOnline = isOnline;
    isOnline = navigator.onLine;
    
    if (wasOnline !== isOnline) {
      if (!isOnline) {
        console.log('🔴 Conexión perdida - Activando modo offline');
        showOfflineBanner();
        window.dispatchEvent(new CustomEvent('connection:offline'));
      } else {
        console.log('🟢 Conexión recuperada');
        showOnlineBanner();
        window.dispatchEvent(new CustomEvent('connection:online'));
        
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
          if (typeof fetchProducts === 'function') {
            fetchProducts(true);
          }
        } else if (window.location.pathname.includes('looks.html')) {
          if (typeof loadProducts === 'function') {
            loadProducts();
          }
        }
      }
    }
  }, 3000);
  
  window.addEventListener('online', () => {
    console.log('🟢 Navegador detectó conexión online');
    isOnline = true;
  });
  
  window.addEventListener('offline', () => {
    console.log('🔴 Navegador detectó conexión offline');
    isOnline = false;
    showOfflineBanner();
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('⚠️ Service Worker no soportado');
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/tienda-zvsw.js', {
      scope: '/tienda-zv'
    });
    console.log('✅ Service Worker registrado:', registration.scope);
    
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data.type === 'CONNECTION_STATUS') {
        console.log('📡 Estado desde SW:', event.data.isOnline);
      }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error registrando SW:', error);
    return false;
  }
}


window.changePhoneNumber = changePhoneNumber;
window.updateSavedPhoneDisplay = updateSavedPhoneDisplay;
window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;
window.renderCart = renderCart;
window.addToCart = addToCart;
window.escapeHtml = escapeHtml;


async function checkIfOfflineMode() {
  if (!('serviceWorker' in navigator)) return false;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const cache = await caches.open('zr-cache-v1');
    const cachedResponse = await cache.match(window.location.href);
    
    if (cachedResponse && !navigator.onLine) {
      showOfflineBanner();
      return true;
    }
  } catch (err) {
    console.log('Error verificando modo offline:', err);
  }
  
  if (!navigator.onLine) {
    showOfflineBanner();
    return true;
  }
  return false;
}

window.ConnectionMonitor = {
  showOfflineBanner,
  showOnlineBanner,
  startConnectionMonitor,
  registerServiceWorker,
  checkIfOfflineMode,
  isOnline: () => navigator.onLine
};



document.addEventListener('DOMContentLoaded', async () => {
  loadCartFromStorage();
  createImageObserver();
  
  if (typeof renderCart === 'function') {
    renderCart();
    console.log("✅ Carrito renderizado al inicio");
  }
  
  const floatingCartBtn = document.getElementById("floating-cart-btn");
  if (floatingCartBtn) floatingCartBtn.addEventListener("click", openCartDrawer);
  
  const closeCartBtn = document.getElementById("close-cart-btn");
  if (closeCartBtn) closeCartBtn.addEventListener("click", closeCartDrawer);
  
  const changePhoneBtn = document.getElementById("change-phone-btn");
  if (changePhoneBtn) changePhoneBtn.addEventListener("click", changePhoneNumber);
  
  // ===== OVERLAY ACTUALIZADO - CIERRA TODO =====
  const overlay = document.getElementById("overlay");
  if (overlay) {
    const newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    newOverlay.addEventListener("click", () => {
      // Cerrar carrito
      if (typeof closeCartDrawer === 'function') closeCartDrawer();
      
      // Cerrar wishlist de productos (index)
      const wishlistDrawer = document.getElementById("wishlist-drawer");
      if (wishlistDrawer && wishlistDrawer.classList.contains("open")) {
        wishlistDrawer.classList.remove("open");
      }
      
      // Cerrar wishlist de looks (looks.html)
      const looksWishlistDrawer = document.getElementById("wishlist-looks-drawer");
      if (looksWishlistDrawer && looksWishlistDrawer.classList.contains("open")) {
        looksWishlistDrawer.classList.remove("open");
      }
      
      // Cerrar modal de imagen
      if (typeof closeImageModal === 'function') closeImageModal();
      
      // Remover clase visible del overlay
      newOverlay.classList.remove("visible");
    });
  }
  
  const closeImageBtn = document.getElementById("close-image-modal");
  if (closeImageBtn) closeImageBtn.addEventListener("click", closeImageModal);
  
  updateSavedPhoneDisplay();
  
  const deferTask = (task) => {
    if (window.requestIdleCallback) {
      requestIdleCallback(task, { timeout: 3000 });
    } else {
      setTimeout(task, 100);
    }
  };
  
  deferTask(() => {
    if (window.CacheManager && window.CacheManager.initPreloading) {
      window.CacheManager.initPreloading();
    }
  });
  
  deferTask(async () => {
    await registerServiceWorker();
  });
  
  deferTask(() => {
    startConnectionMonitor();
  });
  
  deferTask(async () => {
    await checkIfOfflineMode();
  });
  
  // ===== EVENTOS GLOBALES =====
  window.addEventListener('cartUpdated', () => {
    if (typeof renderCart === 'function') renderCart();
    updateCartBadge();
  });
  
  window.addEventListener('connection:offline', () => {
    console.log('📡 Evento: Conexión perdida');
  });
  
  window.addEventListener('connection:online', () => {
    console.log('📡 Evento: Conexión recuperada');
    if (typeof loadProductsInBackground === 'function') {
      deferTask(() => loadProductsInBackground());
    }
  });
});



// ========== TEMA CLARO/OSCURO ==========
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  });
} else {
  initTheme();
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
}
// Al final de common.js, agregar:
window.buildProductIndex = buildProductIndex;
window._commonBuildProductIndex = buildProductIndex; // referencia protegida para home.js
window.getProductsByCategoryIndexed = getProductsByCategoryIndexed;
window.getIndexedProducts = getIndexedProducts;
window.clearProductIndex = clearProductIndex;
// Expose indexed products for wishlist button injection
Object.defineProperty(window, 'allProductsIndexed', { get: () => allProductsIndexed, configurable: true });

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 PWA instalable detectada');
  e.preventDefault();
  deferredPrompt = e;
  
  // Mostrar botón de instalación después de 2 segundos
  setTimeout(() => {
    showPWAInstallButton();
  }, 2000);
});

function showPWAInstallButton() {
  if (document.getElementById('pwa-install-btn')) return;
  
  const installBtn = document.createElement('button');
  installBtn.id = 'pwa-install-btn';
  installBtn.innerHTML = '📲 Instalar App Z&R';
  installBtn.style.cssText = `
    position: fixed;
    bottom: 90px;
    left: 16px;
    background: linear-gradient(135deg, #ff4f81, #ff7a4f);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: slideInLeft 0.3s ease;
  `;
  
  installBtn.onclick = async () => {
    if (!deferredPrompt) return;
    installBtn.style.display = 'none';
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Instalación: ${outcome}`);
    deferredPrompt = null;
  };
  
  document.body.appendChild(installBtn);
  
  // Ocultar después de 15 segundos
  setTimeout(() => {
    if (installBtn && installBtn.parentNode) {
      installBtn.style.opacity = '0';
      setTimeout(() => installBtn.remove(), 300);
    }
  }, 15000);
}

// Detectar si ya está instalada como app
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('📱 Z&R ejecutándose como app instalada');
  document.body.classList.add('pwa-mode');
}

// Agregar animación
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInLeft {
    from {
      opacity: 0;
      transform: translateX(-100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(style);











function addToRecentProducts(productId) {
  if (!productId) return;
  
  try {
    let recent = JSON.parse(localStorage.getItem(RECENT_PRODUCTS_KEY) || '[]');
    
    // Remover si ya existe
    recent = recent.filter(id => String(id) !== String(productId));
    
    // Agregar al inicio
    recent.unshift(String(productId));
    
    // Limitar cantidad
    recent = recent.slice(0, MAX_RECENT_PRODUCTS);
    
    localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(recent));
    console.log(`📌 Producto ${productId} agregado a recientes`);
    
    // Disparar evento para actualizar UI en home si está visible
    window.dispatchEvent(new CustomEvent('recentProductsUpdated'));
  } catch(e) {
    console.warn('Error guardando producto reciente:', e);
  }
}

function getRecentProductIds() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PRODUCTS_KEY) || '[]');
  } catch(e) {
    return [];
  }
}

function getRecentProducts(allProductsArray) {
  const recentIds = getRecentProductIds();
  const recentProducts = [];
  
  for (const id of recentIds) {
    const product = allProductsArray.find(p => String(p.ID) === String(id));
    if (product && product.Stock > 0 && product.Stock !== "0") {
      recentProducts.push(product);
    }
  }
  
  return recentProducts;
}

function clearRecentProducts() {
  localStorage.removeItem(RECENT_PRODUCTS_KEY);
  window.dispatchEvent(new CustomEvent('recentProductsUpdated'));
  showTemporaryMessage('🗑️ Historial de productos recientes eliminado', 'info');
}









// ========== WISHLIST ==========
const WISHLIST_KEY = 'zr_wishlist';

function getWishlist() {
  try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]'); }
  catch { return []; }
}

function saveWishlist(list) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
  updateWishlistBadge(); // ✅ Actualizar badge al guardar
  // ✅ Disparar evento para actualizar cualquier UI
  window.dispatchEvent(new CustomEvent('wishlistUpdated'));
}

function isInWishlist(productId) {
  return getWishlist().some(item => item.id === String(productId));
}

function toggleWishlist(product) {
  const id = String(product.ID || product.id);
  let list = getWishlist();
  const idx = list.findIndex(item => item.id === id);

  if (idx >= 0) {
    list.splice(idx, 1);
    saveWishlist(list);
    updateAllWishlistButtons(id, false);
    showTemporaryMessage('💔 Quitado de favoritos', 'info');
  } else {
    list.push({
      id,
      name: product.Nombre || product.name || 'Producto',
      price: Number(product.Precio || product.price || 0),
      Imagen1: product.Imagen1 || '',
      Talla: product.Talla || '',
      addedAt: Date.now()
    });
    saveWishlist(list);
    updateAllWishlistButtons(id, true);
    showTemporaryMessage('❤️ Agregado a favoritos', 'success');
  }
}

function addAllWishlistToCart() {
  const list = getWishlist();
  if (list.length === 0) {
    showTemporaryMessage("No hay productos en tu lista de deseos", "info");
    return;
  }
  
  list.forEach(item => {
    addToCart({
      ID: item.id,
      Nombre: item.name,
      Precio: item.price,
      Imagen1: item.Imagen1,
      Talla: item.Talla
    });
  });
  saveWishlist([]);
  if (typeof renderWishlist === 'function') renderWishlist();
  updateWishlistBadge();
  }



function updateAllWishlistButtons(id, active) {
  document.querySelectorAll(`.wishlist-btn[data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
    btn.textContent = active ? '❤️' : '🤍';
  });
}

function createWishlistButton(product) {
  const id = String(product.ID || product.id);
  const active = isInWishlist(id);
  const btn = document.createElement('button');
  btn.className = `wishlist-btn${active ? ' active' : ''}`;
  btn.setAttribute('data-id', id);
  btn.setAttribute('aria-label', active ? 'Quitar de favoritos' : 'Agregar a favoritos');
  btn.setAttribute('aria-pressed', active);
  btn.textContent = active ? '❤️' : '🤍';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleWishlist(product);
  });
  return btn;
}

function openWishlistDrawer() {
  console.log("❤️ Abriendo wishlist drawer");
  const drawer = document.getElementById("wishlist-drawer");
  const overlay = document.getElementById("overlay");
  if (drawer) drawer.classList.add("open");
  if (overlay) overlay.classList.add("visible");
  renderWishlist();
}

function closeWishlistDrawer() {
  const drawer = document.getElementById("wishlist-drawer");
  const overlay = document.getElementById("overlay");
  if (drawer) drawer.classList.remove("open");
  if (overlay) overlay.classList.remove("visible");
}

function renderWishlist() {
  const container = document.getElementById("wishlist-items-container");
  if (!container) return;
  
  const items = getWishlist();
  container.innerHTML = "";
  
  if (items.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">❤️</div>
        <p class="helper-text">Tu lista de deseos está vacía.</p>
        <p class="cart-empty-hint">Agrega productos que te gusten</p>
      </div>`;
  } else {
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      const imgUrl = item.Imagen1 ? optimizeDriveUrl(item.Imagen1, 120) : '';
      const imgHtml = imgUrl
        ? `<div class="cart-item-img-wrap"><img class="cart-item-img" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.name)}" loading="lazy"></div>`
        : `<div class="cart-item-img-wrap cart-item-img-placeholder"><span>👕</span></div>`;
      
      row.innerHTML = `
        ${imgHtml}
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(item.name)}</div>
          <div class="cart-item-meta">${formatCurrency(item.price)}</div>
          <div class="cart-item-actions">
            <button class="add-to-cart-wishlist" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-price="${item.price}" data-img="${escapeHtml(item.Imagen1)}" data-talla="${escapeHtml(item.Talla || '')}">🛒 Agregar al carrito</button>
            <button class="remove-from-wishlist" data-id="${item.id}">🗑 Eliminar</button>
          </div>
        </div>
      `;
      container.appendChild(row);
    });
    
    // ✅ Usar manejadores separados para evitar problemas de eventos duplicados
    document.querySelectorAll('.add-to-cart-wishlist').forEach(btn => {
      btn.removeEventListener('click', handleAddFromWishlist);
      btn.addEventListener('click', handleAddFromWishlist);
    });
    
    document.querySelectorAll('.remove-from-wishlist').forEach(btn => {
      btn.removeEventListener('click', handleRemoveFromWishlist);
      btn.addEventListener('click', handleRemoveFromWishlist);
    });
  }
  
  updateWishlistBadge();
}

// ✅ Manejadores separados para el wishlist
function handleAddFromWishlist(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const name = btn.dataset.name;
  const price = parseFloat(btn.dataset.price);
  const img = btn.dataset.img;
  const talla = btn.dataset.talla;
  
  addToCart({ ID: id, Nombre: name, Precio: price, Imagen1: img, Talla: talla });
  showTemporaryMessage(`✅ ${name} agregado al carrito`, 'success');
}

function handleRemoveFromWishlist(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  let list = getWishlist();
  const removedItem = list.find(i => i.id === id);
  list = list.filter(i => i.id !== id);
  saveWishlist(list);
  updateAllWishlistButtons(id, false);
  renderWishlist();
  if (removedItem) {
    showTemporaryMessage(`💔 ${removedItem.name} eliminado de favoritos`, 'info');
  }
}
function updateWishlistBadge() {
  const count = getWishlist().length;
  const badge = document.getElementById("wishlist-count");
  if (badge) badge.textContent = count;
  console.log("❤️ Wishlist badge actualizado:", count);
}

// ✅ Exponer funciones globalmente
window.openWishlistDrawer = openWishlistDrawer;
window.closeWishlistDrawer = closeWishlistDrawer;
window.renderWishlist = renderWishlist;
window.addAllWishlistToCart = addAllWishlistToCart;
window.updateWishlistBadge = updateWishlistBadge;

// Auto-inject wishlist buttons
(function watchProductCards() {
  function injectWishlistBtn(card) {
    if (card.querySelector('.wishlist-btn')) return;
    const slider = card.querySelector('.product-slider');
    if (!slider) return;
    const id = card.id?.replace('producto-', '') || '';
    if (!id) return;
    let product = null;
    if (window.allProductsIndexed && Array.isArray(window.allProductsIndexed)) {
      product = window.allProductsIndexed.find(p => String(p.ID) === id);
    }
    if (!product) {
      const nameEl = card.querySelector('.product-name');
      const priceEl = card.querySelector('.product-price');
      product = {
        ID: id,
        Nombre: nameEl?.textContent || '',
        Precio: priceEl?.textContent?.replace(/[^0-9]/g, '') || 0,
        Imagen1: card.querySelector('img')?.src || ''
      };
    }
    const btn = createWishlistButton(product);
    slider.style.position = 'relative';
    slider.appendChild(btn);
  }
  
  function injectAll() {
    document.querySelectorAll('.product-card').forEach(injectWishlistBtn);
  }
  
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mut => {
      mut.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.classList?.contains('product-card')) {
          injectWishlistBtn(node);
        } else {
          node.querySelectorAll?.('.product-card').forEach(injectWishlistBtn);
        }
      });
    });
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectAll();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    injectAll();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();



window.API_URL = API_URL;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.safeHtml = safeHtml;
