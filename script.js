const PAGE_SIZE = 10;
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
let isLoading = false;
let sliderState = new Map();
let initialHashHandled = false;
const SECRET_TAPS_REQUIRED = 5;
let secretTapCount = 0;
let secretTapTimeout = null;
let isBackgroundLoading = false;

class BackgroundLoadQueue {
  constructor() {
    this.isLoading = false;
    this.pending = false;
  }
  
  async request() {
    if (this.isLoading) {
      this.pending = true;
      console.log("⏳ Carga en progreso, encolando...");
      return;
    }
    
    this.isLoading = true;
    this.pending = false;
    
    try {
      await this.execute();
    } finally {
      this.isLoading = false;
      
      if (this.pending) {
        console.log("🔄 Ejecutando solicitud pendiente");
        this.request();
      }
    }
  }
  
  async execute() {
    if (!navigator.onLine) {
      console.log("📡 Offline, no se carga background");
      return;
    }
    
    console.log("🔄 Actualizando productos en background...");
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      const freshProducts = (data.products || data || []).slice(0, 500);
      
      if (JSON.stringify(freshProducts) !== JSON.stringify(allProducts)) {
        console.log("✨ Productos actualizados en background");
        allProducts = freshProducts;
        setCachedProducts(allProducts);
        
        if (typeof buildProductIndex === "function") {
          buildProductIndex(allProducts);
        }
        
        const currentGender = document.getElementById("gender-filter")?.value || "";
        const currentCategory = document.getElementById("category-filter")?.value || "";
        const currentSearch = document.getElementById("search-input")?.value || "";
        
        if (currentGender || currentCategory || currentSearch || currentPage > 1) {
          applyFilters();
        } else {
          filteredProducts = [...allProducts];
          renderProductsPage(true);
          populateCategoryFilter(currentGender);
        }
        
        showTemporaryMessage("✨ Catálogo actualizado", "info");
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("⏱️ Actualización background timeout (normal)");
      } else {
        console.warn("Error en actualización background:", err.message);
      }
    }
  }
}

const backgroundQueue = new BackgroundLoadQueue();

async function loadProductsInBackground() {
  await backgroundQueue.request();
}





function applyFiltersFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const genderParam = urlParams.get('gender');
  const categoryParam = urlParams.get('category');
  const badgeParam = urlParams.get('badge');
  
  let filtersApplied = false;
  
  
  if (genderParam) {
    const genderSelect = document.getElementById("gender-filter");
    if (genderSelect && (genderParam === 'HOMBRE' || genderParam === 'MUJER')) {
      genderSelect.value = genderParam;
      filtersApplied = true;
    }
  }
  
  
  if (categoryParam) {
    
    setTimeout(() => {
      const categorySelect = document.getElementById("category-filter");
      if (categorySelect) {
        
        for (let i = 0; i < categorySelect.options.length; i++) {
          if (categorySelect.options[i].value.toLowerCase().includes(categoryParam.toLowerCase()) ||
              categorySelect.options[i].value === categoryParam) {
            categorySelect.value = categorySelect.options[i].value;
            break;
          }
        }
      }
      if (filtersApplied || categoryParam) {
        applyFilters();
      }
    }, 100);
  } else if (filtersApplied) {
    applyFilters();
  }
  
  
  if (badgeParam && typeof applyFilters === 'function') {
    
    window._pendingBadgeFilter = badgeParam;
    setTimeout(() => {
      if (typeof applyFilters === 'function') applyFilters();
    }, 100);
  }
}


const originalApplyFilters = applyFilters;
window.applyFilters = function() {
  if (window._pendingBadgeFilter) {
    const badgeValue = window._pendingBadgeFilter;
    
    if (typeof filteredProducts !== 'undefined') {
      
      const badgeFiltered = allProducts.filter(p => p.Badge === badgeValue);
      if (badgeFiltered.length > 0) {
        filteredProducts = badgeFiltered;
        currentPage = 1;
        renderProductsPage(true);
        window._pendingBadgeFilter = null;
        return;
      }
    }
    window._pendingBadgeFilter = null;
  }
  if (originalApplyFilters) originalApplyFilters();
};


document.addEventListener('DOMContentLoaded', () => {
  setTimeout(applyFiltersFromURL, 200);
});









async function checkOfflineOnStart() {
  if (!navigator.onLine) {
    console.log('📡 Iniciando en modo offline');
    if (window.ConnectionMonitor && window.ConnectionMonitor.showOfflineBanner) {
      window.ConnectionMonitor.showOfflineBanner();
    }
    showTemporaryMessage('📡 Modo offline - Mostrando catálogo guardado', 'info');
  }
}

window.addEventListener('beforeunload', () => {
  sessionStorage.setItem('index_scroll_position', window.scrollY);
});


function getGenderFromCategory(categoria) {
  if (!categoria) return null;
  const categoriaLower = categoria.toLowerCase().trim();
  const genderMap = {
    "playeras": "HOMBRE",
    "pantalon para caballero": "HOMBRE",
    "short para caballero": "HOMBRE",
    "calzado para caballero": "HOMBRE",
    "sueter para caballero": "HOMBRE",
    "chamarra para caballero": "HOMBRE",
    "blusas": "MUJER",
    "pantalon para dama": "MUJER",
    "short para dama": "MUJER",
    "vestidos": "MUJER",
    "calzado para dama": "MUJER",
    "sueter para dama": "MUJER",
    "chamarra para dama": "MUJER",
    "faldas": "MUJER",
    "accesorios": "UNISEX"
  };
  return genderMap[categoriaLower] || null;
}

async function fetchProducts(force = false) {
  if (!navigator.onLine && !force) {
    console.log('📡 Offline - Usando solo caché');
    const cached = getCachedProducts();
    if (cached && cached.length > 0) {
      allProducts = cached;
      buildProductIndex(allProducts); 
      filteredProducts = [...allProducts];
      currentPage = 1;
      renderProductsPage(true);
      populateCategoryFilter(document.getElementById("gender-filter")?.value);
      handleInitialHash();
      showTemporaryMessage('📡 Sin conexión - Mostrando productos guardados', 'info');
      return;
    }
  }
  
  if (force) {
    isLoading = true;
    showLoader("Actualizando productos...");
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      allProducts = (data.products || data || []).slice(0, 500);
      setCachedProducts(allProducts);
      buildProductIndex(allProducts); 
      filteredProducts = [...allProducts];
      currentPage = 1;
      renderProductsPage(true);
      populateCategoryFilter(document.getElementById("gender-filter")?.value);
      handleInitialHash();
    } catch (err) {
      console.error(err);
    } finally {
      isLoading = false;
      hideLoader();
    }
    return;
  }
  
  const cached = getCachedProducts();
  if (cached && cached.length > 0) {
    console.log("⚡ CARGA INSTANTÁNEA desde caché");
    allProducts = cached;
    buildProductIndex(allProducts); 
    filteredProducts = [...allProducts];
    currentPage = 1;
    renderProductsPage(true);
    populateCategoryFilter(document.getElementById("gender-filter")?.value);
    handleInitialHash();
    
    const savedScroll = sessionStorage.getItem('index_scroll_position');
    if (savedScroll && !initialHashHandled) {
      setTimeout(() => window.scrollTo(0, parseInt(savedScroll)), 100);
      sessionStorage.removeItem('index_scroll_position');
    }
    
    loadProductsInBackground();
    return;
  }
  
  isLoading = true;
  showLoader("Cargando productos...");
  
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    allProducts = (data.products || data || []).slice(0, 500);
    setCachedProducts(allProducts);
    buildProductIndex(allProducts); 
    filteredProducts = [...allProducts];
    currentPage = 1;
    renderProductsPage(true);
    populateCategoryFilter(document.getElementById("gender-filter")?.value);
    handleInitialHash();
  } catch (err) {
    console.error(err);
    const staleCache = localStorage.getItem(CACHE_KEY);
    if (staleCache) {
      const { data } = JSON.parse(staleCache);
      if (data && data.length > 0) {
        allProducts = data;
        buildProductIndex(allProducts); 
        filteredProducts = [...allProducts];
        renderProductsPage(true);
        populateCategoryFilter(document.getElementById("gender-filter")?.value);
      }
    }
  } finally {
    isLoading = false;
    hideLoader();
  }
}

function applyFilters() {
  const searchValue = document.getElementById("search-input")?.value.trim().toLowerCase() || "";
  const categoryValue = document.getElementById("category-filter")?.value || "";
  const genderValue = document.getElementById("gender-filter")?.value || "";
  const sortValue = document.getElementById("sort-select")?.value || "";

  populateCategoryFilter(genderValue);

  
  let productsByCat = getProductsByCategoryIndexed(categoryValue);
  
  
  filteredProducts = productsByCat.filter((p) => {
    const matchesSearch = !searchValue ||
      (p.Nombre || "").toLowerCase().includes(searchValue) ||
      (p.Descripcion || "").toLowerCase().includes(searchValue);
    
    let matchesGender = true;
    if (genderValue) {
      const productGender = getGenderFromCategory(p.Categoria);
      matchesGender = productGender === genderValue;
    }
    return matchesSearch && matchesGender;
  });

  
  if (sortValue === "price-asc") {
    filteredProducts.sort((a, b) => Number(a.Precio || 0) - Number(b.Precio || 0));
  } else if (sortValue === "price-desc") {
    filteredProducts.sort((a, b) => Number(b.Precio || 0) - Number(a.Precio || 0));
  }

  currentPage = 1;
  renderProductsPage(true);
}

function populateCategoryFilter(genderFilter = null) {
  const select = document.getElementById("category-filter");
  if (!select) return;
  const currentValue = select.value;
  if (genderFilter === null) {
    const genderSelect = document.getElementById("gender-filter");
    if (genderSelect) genderFilter = genderSelect.value;
  }
  const categories = new Set();
  allProducts.forEach((p) => {
    if (p.Categoria) {
      if (genderFilter) {
        const productGender = getGenderFromCategory(p.Categoria);
        if (productGender === genderFilter) categories.add(p.Categoria);
      } else {
        categories.add(p.Categoria);
      }
    }
  });
  select.innerHTML = '<option value="">Todas las categorías</option>';
  Array.from(categories).sort().forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  if (currentValue && categories.has(currentValue)) select.value = currentValue;
  else select.value = "";
}

function renderProductsPage(reset = false) {
  const container = document.getElementById("products-container");
  if (!container) return;
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = filteredProducts.slice(start, end);
  container.innerHTML = "";
  if (pageItems.length === 0) {
    container.innerHTML = '<p class="helper-text">No hay productos para mostrar</p>';
    renderPagination();
    return;
  }
  pageItems.forEach((product) => {
    const card = createProductCard(product);
    container.appendChild(card);
  });
  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const pagination = document.getElementById("pagination");
  if (!pagination) return;
  pagination.innerHTML = "";
  if (totalPages <= 1) return;
   
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active-page");
    btn.onclick = (function(page) { return function() { currentPage = page; renderProductsPage(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }; })(i);
    pagination.appendChild(btn);
  }
  
  if (currentPage < totalPages) {
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Siguiente →";
    nextBtn.onclick = () => { currentPage++; renderProductsPage(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    pagination.appendChild(nextBtn);
  }
}



function hasFreeShipping(price) {
  const numericPrice = Number(price) || 0;
  return numericPrice >= 300;
}





function createProductCard(product) {
  const { ID, Nombre, Precio, Stock, Descripcion, Talla, Categoria, Imagen1, Imagen2, Imagen3, Badge } = product;

  
  const safeNombre = escapeHtml(Nombre || "Producto");
  const safeDescripcion = escapeHtml(Descripcion || "");
  const safeTalla = escapeHtml(Talla || "Única");
  const safeCategoria = escapeHtml(Categoria || "");
  const safeBadge = Badge ? escapeHtml(Badge) : "";

  const stockNum = Number(Stock || 0);
  const isOutOfStock = stockNum <= 0;

  
  const card = document.createElement("article");
  card.className = "product-card";
  card.id = `producto-${ID}`;

  
  const slider = document.createElement("div");
  slider.className = "product-slider";
  slider.dataset.productId = ID;

  const track = document.createElement("div");
  track.className = "product-slider-track";

  const images = [Imagen1, Imagen2, Imagen3]
    .map(u => optimizeDriveUrl(u))
    .filter(Boolean);

  if (images.length === 0) {
    images.push("https:
  }

  images.forEach((url) => {
    const slide = document.createElement("div");
    slide.className = "product-slide";

    const img = document.createElement("img");
    img.alt = safeNombre;
    img.src = url;
    img.loading = "lazy";
    img.addEventListener("click", () => openImageModal(url, ID));

    slide.appendChild(img);
    track.appendChild(slide);
  });

  slider.appendChild(track);

  
  const dotsContainer = document.createElement("div");
  dotsContainer.className = "slider-dots";

  images.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.className = "slider-dot" + (index === 0 ? " active" : "");
    dot.dataset.index = index;
    dotsContainer.appendChild(dot);
  });

  slider.appendChild(dotsContainer);

  
  if (safeBadge) {
    const badgeEl = document.createElement("div");
    badgeEl.className = "product-badge";
    badgeEl.textContent = safeBadge;
    slider.appendChild(badgeEl);
  }

  attachSliderEvents(slider, images.length);

  
  const info = document.createElement("div");
  info.className = "product-info";

  const titleRow = document.createElement("div");
  titleRow.className = "product-title-row";

  const nameEl = document.createElement("h2");
  nameEl.className = "product-name";
  nameEl.textContent = safeNombre;

  const priceEl = document.createElement("div");
  priceEl.className = "product-price";
  priceEl.textContent = formatCurrency(Precio);

  titleRow.appendChild(nameEl);
  titleRow.appendChild(priceEl);

  const metaRow = document.createElement("div");
  metaRow.className = "product-meta-row";

  if (safeCategoria) {
    const categoryEl = document.createElement("span");
    categoryEl.className = "category-badge";
    categoryEl.textContent = safeCategoria;
    metaRow.appendChild(categoryEl);
  }

  const gender = getGenderFromCategory(Categoria);
  if (gender) {
    const genderBadge = document.createElement("span");
    genderBadge.className = `gender-badge gender-${gender.toLowerCase()}`;
    genderBadge.textContent =
      gender === "UNISEX" ? "⚪" :
      gender === "HOMBRE" ? "👔" :
      "👗";
    metaRow.appendChild(genderBadge);
  }

  const stockEl = document.createElement("span");
  stockEl.className = "stock-badge";

  if (isOutOfStock) {
    stockEl.classList.add("out-of-stock");
    stockEl.textContent = "❌ Sin stock";
  } else {
    stockEl.textContent = `📦 Stock: ${stockNum}`;
  }

  metaRow.appendChild(stockEl);

  if (hasFreeShipping(Precio)) {
    const shippingEl = document.createElement("span");
    shippingEl.className = "shipping-badge";
    shippingEl.textContent = "🚚";
    shippingEl.title = "Envío a domicilio o punto intermedio";
    metaRow.appendChild(shippingEl);
  }

  const descEl = document.createElement("p");
  descEl.className = "product-description";
  descEl.textContent = safeDescripcion;

  const sizesEl = document.createElement("div");
  sizesEl.className = "product-sizes";
  sizesEl.textContent = safeTalla;

  info.appendChild(titleRow);
  info.appendChild(metaRow);
  info.appendChild(descEl);
  info.appendChild(sizesEl);

  
  const actions = document.createElement("div");
  actions.className = "product-actions";

  const addBtn = document.createElement("button");
  addBtn.className = "primary-button";
  addBtn.textContent = isOutOfStock ? "Sin stock" : "Añadir al carrito";
  addBtn.disabled = isOutOfStock;

  if (!isOutOfStock) {
    addBtn.dataset.productId = ID;
    addBtn.dataset.productName = Nombre || "Producto";
    addBtn.dataset.productPrice = Precio || 0;
    addBtn.dataset.productImage = Imagen1 || "";
    addBtn.dataset.productTalla = Talla || "";

    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart({
        ID: addBtn.dataset.productId,
        Nombre: addBtn.dataset.productName,
        Precio: Number(addBtn.dataset.productPrice),
        Imagen1: addBtn.dataset.productImage,
        Talla: addBtn.dataset.productTalla
      });
    });
  }

  actions.appendChild(addBtn);

  
  card.appendChild(slider);
  card.appendChild(info);
  card.appendChild(actions);

  return card;
}



function attachSliderEvents(slider, totalSlides) {
  const productId = slider.dataset.productId;
  sliderState.set(productId, 0);
  const track = slider.querySelector(".product-slider-track");
  const dots = slider.querySelectorAll(".slider-dot");
  let startX = 0, currentX = 0, isDragging = false;
  function updateSlider(index) {
    const normalizedIndex = ((index % totalSlides) + totalSlides) % totalSlides;
    sliderState.set(productId, normalizedIndex);
    track.style.transform = `translateX(-${normalizedIndex * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle("active", i === normalizedIndex));
  }
  function handleStart(x) { isDragging = true; startX = x; currentX = x; }
  function handleMove(x) { if (isDragging) currentX = x; }
  function handleEnd() {
    if (!isDragging) return;
    const deltaX = currentX - startX;
    const threshold = 40;
    let index = sliderState.get(productId) || 0;
    if (deltaX < -threshold) index++;
    else if (deltaX > threshold) index--;
    updateSlider(index);
    isDragging = false;
  }
  slider.addEventListener("touchstart", (e) => handleStart(e.touches[0].clientX));
  slider.addEventListener("touchmove", (e) => handleMove(e.touches[0].clientX));
  slider.addEventListener("touchend", handleEnd);
  slider.addEventListener("mousedown", (e) => handleStart(e.clientX));
  slider.addEventListener("mousemove", (e) => { if (isDragging) handleMove(e.clientX); });
  slider.addEventListener("mouseup", handleEnd);
  slider.addEventListener("mouseleave", () => { if (isDragging) handleEnd(); });
  dots.forEach((dot) => dot.addEventListener("click", () => updateSlider(Number(dot.dataset.index))));
  setInterval(() => updateSlider((sliderState.get(productId) || 0) + 1), 6000);
}



function handleInitialHash() {
  if (initialHashHandled) return;
  initialHashHandled = true;
  const hash = window.location.hash;
  if (!hash) return;
  const id = hash.replace("#", "");
  const el = document.getElementById(id);
  if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
}

function handleSecretTap() {
  secretTapCount++;
  if (secretTapTimeout) clearTimeout(secretTapTimeout);
  secretTapTimeout = setTimeout(() => secretTapCount = 0, 2000);
  if (secretTapCount >= SECRET_TAPS_REQUIRED) {
    secretTapCount = 0;
    window.location.href = "admin.html";
  }
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
      "📱 Para procesar tu compra, ingresa tu número de WhatsApp (10 dígitos):\n\n⚠️ Solo números, sin espacios ni código país.\n🔒 Tus datos están protegidos",
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
  adminMessage += "━━━━━━━━━━━━━━━━━━━━\n";
  adminMessage += `👤 *Cliente:* +52 ${clientPhone}\n`;
  adminMessage += `🆔 *ID:* ${requestId}\n`;
  adminMessage += "━━━━━━━━━━━━━━━━━━━━\n";
  adminMessage += "*📦 PRODUCTOS:*\n\n";
  
  items.forEach((item, index) => {
    adminMessage += `• *${item.name}*\n`;
    adminMessage += `  Cantidad: ${item.quantity} | $${item.price.toLocaleString()} c/u\n`;
    adminMessage += `  Subtotal: $${(item.price * item.quantity).toLocaleString()}\n`;
    if (index < items.length - 1) adminMessage += "────────────────────\n";
  });
  
  adminMessage += "\n━━━━━━━━━━━━━━━━━━━━\n";
  adminMessage += `💵 *TOTAL:* $${total.toLocaleString()} MXN\n`;
  adminMessage += "━━━━━━━━━━━━━━━━━━━━\n";
  adminMessage += "Una vez confirmado tu pedido te enviaremos un mensaje por este chat.\n";
  
  const whatsappAdminUrl = `https:
  window.open(whatsappAdminUrl, '_blank');
  
  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveClientPhone", requestId: requestId, phone: clientPhone })
    });
    
    
const notificationItems = items.map(item => ({
  productId: item.id,
  nombre: item.name,
  cantidad: item.quantity,
  imagen: item.Imagen1 || "",
  talla: item.Talla || "",
  precio: item.price || 0          
}));
    
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "createNotification", items: notificationItems, requestId: requestId })
    });
    
    localCart = {};
    saveCartToStorage();
    updateCartBadge();
    if (typeof renderCart === 'function') renderCart();
    
    showTemporaryMessage(`✅ ¡Solicitud enviada! Recibirás el link de pago por WhatsApp cuando el administrador confirme.`, "success");
    closeCartDrawer();
    startSilentPolling(requestId, clientPhone);
  } catch(err) {
    console.error("Error:", err);
    showTemporaryMessage("❌ Error al enviar la solicitud", "error");
  } finally {
    hideLoader();
  }
}

function startSilentPolling(requestId, clientPhone) {
  let interval = setInterval(async () => {
    try {
      const response = await fetch(`${API_URL}?action=checkRequestStatus&requestId=${requestId}`);
      const data = await response.json();
      
      if (data.ok && data.status === 'approved' && data.paymentLink) {
        clearInterval(interval);
        
        
        const itemsFromRequest = data.items || Object.values(localCart);
        
        
        let message = "✅ *¡PEDIDO CONFIRMADO!*\n";
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        message += `💰 *Total a pagar:* $${(data.totalAmount || 0).toLocaleString()} MXN\n\n`;
        
        
        message += "*📦 Tu pedido:*\n";
        itemsFromRequest.forEach((item, idx) => {
          message += `${idx+1}. *${item.name || item.Nombre}*\n`;
          message += `   📏 Talla: ${item.Talla || item.talla || "N/A"} | 🔢 ${item.quantity || item.cantidad || 1} x $${(item.price || item.Precio || 0).toLocaleString()}\n`;
        });
        message += "\n";
        
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        message += "*💳 OPCIONES DE PAGO:*\n\n";
        message += `🔗 *Link de pago seguro* (válido 30 min):\n${data.paymentLink}\n\n`;
        message += "💳 *Transferencia directa:*\n";
        message += "Banco: BBVA\n";
        message += "Cuenta: **** **** **** 1234\n";
        message += "CLABE: 0123 4567 8901 2345 67\n\n";
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        message += "*🚚 INFORMACIÓN DE ENTREGA:*\n";
        
        
        const hasShippingItems = itemsFromRequest.some(i => hasFreeShipping(i.price || i.Precio || 0));
        if (hasShippingItems) {
          message += "✅ Tienes productos que califican para envío\n";
          message += "📍 Las entregas pueden ser a domicilio o punto intermedio\n";
          message += "⏰ Los tiempos varían según la distancia\n\n";
        } else {
          message += "⚠️ Los productos seleccionados no califican para envío\n";
          message += "📦 Acuerda la recolección o punto de entrega\n\n";
        }
        
        message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        message += "⚠️ *Importante:*\n";
        message += "• Envía tu comprobante de pago por este chat\n";
        message += "• Tu pedido se enviará al confirmar el pago\n";
        message += "• Cualquier duda, responde a este mensaje\n\n";
        message += "¡Gracias por tu compra! 🛍️✨";
        
        let cleanPhone = String(clientPhone).replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = "52" + cleanPhone;
        
        window.open(`https:
        localStorage.removeItem('pending_purchase_' + requestId);
        
        
        showTemporaryMessage("✅ ¡Pago confirmado! Revisa WhatsApp para tu link de pago.", "success");
      }
    } catch (err) {
      console.error("Error en polling:", err);
    }
  }, 5000);
  
  
  setTimeout(() => { 
    clearInterval(interval); 
    localStorage.removeItem('pending_purchase_' + requestId);
  }, 600000);
}






async function pagarConMercadoPago() {
  const items = Object.values(localCart).map(item => ({
    id: item.id,
    title: item.name,
    quantity: item.quantity,
    unit_price: item.price
  }));
  if (items.length === 0) {
    alert("No hay productos en el carrito");
    return;
  }
  showLoader("Preparando pago...");
  try {
    const params = new URLSearchParams({ action: "createPreference", items: JSON.stringify(items) });
    const response = await fetch(`${API_URL}?${params.toString()}`, { method: "GET" });
    const data = await response.json();
    if (data.ok && data.initPoint) {
      window.location.href = data.initPoint;
    } else {
      throw new Error(data.error || "Error desconocido");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("❌ Error: " + error.message);
    hideLoader();
  }
}

function verificarEstadoPago() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get("payment");
  if (paymentStatus === "success") {
    localCart = {};
    saveCartToStorage();
    updateCartBadge();
    if (typeof renderCart === 'function') renderCart();
    alert("🎉 ¡Pago completado con éxito!\n\nGracias por tu compra.");
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (paymentStatus === "failure") {
    alert("❌ El pago no pudo completarse.\n\nPor favor, intenta nuevamente.");
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (paymentStatus === "pending") {
    alert("⏳ Tu pago está siendo procesado.\n\nTe notificaremos cuando se confirme.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchProducts();

  let searchDebounceTimeout;
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => applyFilters(), 300);
    });
  }

  const genderFilter = document.getElementById("gender-filter");
  if (genderFilter) genderFilter.addEventListener("change", () => { 
    populateCategoryFilter(genderFilter.value); 
    applyFilters(); 
  });

  const categoryFilter = document.getElementById("category-filter");
  if (categoryFilter) categoryFilter.addEventListener("change", () => applyFilters());

  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) sortSelect.addEventListener("change", () => applyFilters());

  const closeCartBtn = document.getElementById("close-cart-btn");
  if (closeCartBtn) closeCartBtn.addEventListener("click", closeCartDrawer);

  const overlay = document.getElementById("overlay");
  if (overlay) overlay.addEventListener("click", () => { 
    closeCartDrawer(); 
    closeImageModal(); 
  });

  const closeImageBtn = document.getElementById("close-image-modal");
  if (closeImageBtn) closeImageBtn.addEventListener("click", closeImageModal);

  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", () => { 
    if (!isLoading) fetchProducts(true); 
  });

  const secretLogo = document.getElementById("secret-logo");
  if (secretLogo) secretLogo.addEventListener("click", handleSecretTap);

  const requestBtn = document.getElementById("request-purchase-btn");
  if (requestBtn) requestBtn.addEventListener("click", openWhatsAppCheckout);

  const mpBtn = document.getElementById("mp-checkout-btn");
  if (mpBtn) mpBtn.addEventListener("click", pagarConMercadoPago);

  verificarEstadoPago();

  const layoutBtn = document.getElementById("layout-toggle-btn");
  const productsContainer = document.getElementById("products-container");

  if (layoutBtn && productsContainer) {
    const savedLayout = localStorage.getItem("products_layout");

    if (savedLayout === "grid") {
      productsContainer.classList.add("layout-grid");
      layoutBtn.textContent = "▦"; 
    } else {
      layoutBtn.textContent = "≡";
    }

    layoutBtn.addEventListener("click", () => {
      productsContainer.classList.toggle("layout-grid");

      const isGrid = productsContainer.classList.contains("layout-grid");
      localStorage.setItem("products_layout", isGrid ? "grid" : "list");

      layoutBtn.textContent = isGrid ? "▦" : "≡";
    });
  }

  checkOfflineOnStart();
});

window.addEventListener('cartUpdated', () => {
  if (typeof renderCart === 'function') renderCart();
  updateCartBadge();
});