window.originalHandleProductFormSubmit = null;

window.originalDeleteProduct = null;

setTimeout(() => {

    if (typeof handleProductFormSubmit === 'function') {

        window.originalHandleProductFormSubmit = handleProductFormSubmit;

        console.log("✅ Función original handleProductFormSubmit guardada");

    }

    if (typeof deleteProduct === 'function') {

        window.originalDeleteProduct = deleteProduct;

        console.log("✅ Función original deleteProduct guardada");

    }

}, 100);

const ADMIN_API_URL = "https://script.google.com/macros/s/AKfycbzNshrt3zldBNiyoB8x36ktCEO02H0cKxebiTuK7UAbsgd5R9biaCW7W4ihm1aVOJG7ww/exec";

let adminSession = null;

let adminProducts = [];

let adminCurrentPage = 1;

let adminFilteredProducts = [];

let adminProductsPerPage = 10;

let lastNotifCount = 0;

let notificationInterval = null;



async function apiRequest(method, body) {
  try {
    let url = ADMIN_API_URL;

    if (method === "GET" && body) {
      url += "?" + new URLSearchParams(body).toString();
    }

    const options = {
      method: method === "POST" ? "POST" : "GET",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    };

    if (method === "POST" && body) {
      // Inyectar token automáticamente en todas las llamadas POST
      const token = sessionStorage.getItem("admin_token") || "";
      const params = new URLSearchParams({ ...body, token });
      options.body = params.toString();
    }

    const res = await fetch(url, options);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();

  } catch (err) {
    console.error("API ERROR:", err);
    throw err;
  }
}


async function handleAdminLogin(e) {

  e.preventDefault();

  const password = document.getElementById("admin-password").value;

  const token = document.getElementById("admin-token").value;

  

  showLoader("Verificando credenciales...");

  

  try {

    const data = await apiRequest("POST", { action: "login", password, token });

    if (!data || !data.ok) {

      await showCustomAlert({

        title: "❌ Acceso denegado",

        message: "Credenciales incorrectas. Verifica tu contraseña y token.",

        icon: "🔒",

        confirmText: "Intentar nuevamente"

      });

      return;

    }

    

    adminSession = data.session || "ok";
    sessionStorage.setItem("admin_token", document.getElementById("admin-token").value);

    document.getElementById("admin-login-view").hidden = true;

    document.getElementById("admin-panel-view").hidden = false;

    

    loadAdminProducts();

    startNotificationMonitoring();

    

  } catch (err) {

    console.error(err);

    await showCustomAlert({

      title: "❌ Error",

      message: "Error al iniciar sesión. Intenta nuevamente.",

      icon: "⚠️",

      confirmText: "Aceptar"

    });

  } finally {

    hideLoader();

  }

}



function handleAdminLogout() {

  

  stopNotificationMonitoring();

  

  adminSession = null;

  

  const loginView = document.getElementById("admin-login-view");

  const panelView = document.getElementById("admin-panel-view");

  

  if (loginView) loginView.hidden = false;

  if (panelView) panelView.hidden = true;

  

  const loginForm = document.getElementById("admin-login-form");

  if (loginForm) loginForm.reset();

  

  const passwordInput = document.getElementById("admin-password");

  const tokenInput = document.getElementById("admin-token");

  if (passwordInput) passwordInput.value = "";

  if (tokenInput) tokenInput.value = "";

  

  

}



async function loadAdminProducts() {

  showLoader("Cargando productos...");

  

  try {

    const data = await apiRequest("GET");

    adminProducts = data.products || data || [];

    updateAdminStats();

    populateAdminCategoryFilter();

    adminCurrentPage = 1;

    renderAdminProductsWithFilters();

  } catch (err) {

    console.error(err);

    await showCustomAlert({

      title: "❌ Error",

      message: "Error al cargar productos. Verifica tu conexión.",

      icon: "⚠️",

      confirmText: "Aceptar"

    });

  } finally {

    hideLoader();

  }

}



function renderAdminProductsWithFilters() {

  const searchTerm = document.getElementById("admin-search-input")?.value.toLowerCase() || "";

  const categoryFilter = document.getElementById("admin-category-filter")?.value || "";

  const stockFilter = document.getElementById("admin-stock-filter")?.value || "";

  

  adminFilteredProducts = adminProducts.filter(product => {

    const matchesSearch = !searchTerm || 

      (product.Nombre || "").toLowerCase().includes(searchTerm) ||

      String(product.ID || "").includes(searchTerm);

    const matchesCategory = !categoryFilter || (product.Categoria || "") === categoryFilter;

    const stock = Number(product.Stock || 0);

    let matchesStock = true;

    if (stockFilter === "low") matchesStock = stock > 0 && stock <= 5;

    else if (stockFilter === "out") matchesStock = stock === 0;

    else if (stockFilter === "in") matchesStock = stock > 0;

    return matchesSearch && matchesCategory && matchesStock;

  });

  

  const totalPages = Math.ceil(adminFilteredProducts.length / adminProductsPerPage);

  const start = (adminCurrentPage - 1) * adminProductsPerPage;

  const end = start + adminProductsPerPage;

  const pageProducts = adminFilteredProducts.slice(start, end);

  

  renderAdminProductsList(pageProducts);

  renderAdminPagination(totalPages);

}



function renderAdminProductsList(products) {

  const list = document.getElementById("admin-products-list");

  if (!list) return;

  

  list.innerHTML = "";

  if (!products || products.length === 0) {

    list.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">📭 No hay productos que coincidan con los filtros.</div>';

    return;

  }

  

  products.forEach((p) => {

    const row = document.createElement("div");

    row.className = "admin-product-row";

    const stock = Number(p.Stock || 0);

    let stockClass = "";

    let stockText = "";

    

    if (stock === 0) {

      stockClass = "out-stock";

      stockText = "❌ Sin stock";

    } else if (stock <= 5) {

      stockClass = "low-stock";

      stockText = `⚠️ ${stock} unidades`;

    } else {

      stockText = `✅ ${stock} unidades`;

    }

    

    row.innerHTML = `

  <div class="admin-product-id">#${escapeHtml(String(p.ID || "N/A"))}</div>

  <div class="admin-product-name">${escapeHtml(p.Nombre || "Sin nombre")}</div>

  <div class="admin-product-price">${formatCurrency(p.Precio)}</div>

  <div class="admin-product-stock ${stockClass}">${escapeHtml(stockText)}</div>

  <div class="admin-product-actions">

    <button class="edit-product-btn" data-id="${escapeHtml(String(p.ID))}">✏️ Editar</button>

    <button class="delete-product-btn" data-id="${escapeHtml(String(p.ID))}">🗑️ Eliminar</button>

  </div>

`;

    list.appendChild(row);

  });

  

  document.querySelectorAll(".edit-product-btn").forEach(btn => {

    btn.addEventListener("click", () => {

      const id = btn.getAttribute("data-id");

      const product = adminProducts.find(p => String(p.ID) === id);

      if (product) fillFormForEdit(product);

    });

  });

  

  document.querySelectorAll(".delete-product-btn").forEach(btn => {

    btn.addEventListener("click", () => {

      const id = btn.getAttribute("data-id");

      deleteProduct(id);

    });

  });

}



function renderAdminPagination(totalPages) {

  const pagination = document.getElementById("admin-pagination");

  if (!pagination) return;

  pagination.innerHTML = "";

  if (totalPages <= 1) return;

  

  if (adminCurrentPage > 1) {

    const prevBtn = document.createElement("button");

    prevBtn.textContent = "← Anterior";

    prevBtn.onclick = () => { adminCurrentPage--; renderAdminProductsWithFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    pagination.appendChild(prevBtn);

  }

  

  let startPage = Math.max(1, adminCurrentPage - 2);

  let endPage = Math.min(totalPages, startPage + 4);

  if (endPage - startPage < 4 && startPage > 1) startPage = Math.max(1, endPage - 4);

  

  for (let i = startPage; i <= endPage; i++) {

    const btn = document.createElement("button");

    btn.textContent = i;

    if (i === adminCurrentPage) btn.classList.add("active-page");

    btn.onclick = () => { adminCurrentPage = i; renderAdminProductsWithFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    pagination.appendChild(btn);

  }

  

  if (adminCurrentPage < totalPages) {

    const nextBtn = document.createElement("button");

    nextBtn.textContent = "Siguiente →";

    nextBtn.onclick = () => { adminCurrentPage++; renderAdminProductsWithFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    pagination.appendChild(nextBtn);

  }

}



function populateAdminCategoryFilter() {

  const select = document.getElementById("admin-category-filter");

  if (!select) return;

  const categories = new Set();

  adminProducts.forEach(p => { if (p.Categoria) categories.add(p.Categoria); });

  select.innerHTML = '<option value="">📁 Todas las categorías</option>';

  Array.from(categories).sort().forEach(cat => {

    const opt = document.createElement("option");

    opt.value = cat;

    opt.textContent = cat;

    select.appendChild(opt);

  });

}



function updateAdminStats() {

  const totalProducts = adminProducts.length;

  const totalInventoryValue = adminProducts.reduce((sum, p) => sum + (Number(p.Precio || 0) * Number(p.Stock || 0)), 0);

  const outOfStock = adminProducts.filter(p => Number(p.Stock || 0) <= 0).length;

  const lowStock = adminProducts.filter(p => { const s = Number(p.Stock || 0); return s > 0 && s <= 5; }).length;

  

  const totalStockElem = document.getElementById("stat-total-products");

  const totalValueElem = document.getElementById("stat-total-stock");

  const outStockElem = document.getElementById("stat-out-of-stock");

  const lowStockElem = document.getElementById("stat-low-stock");

  

  if (totalStockElem) totalStockElem.textContent = totalProducts;

  if (totalValueElem) totalValueElem.textContent = formatCurrency(totalInventoryValue);

  if (outStockElem) outStockElem.textContent = outOfStock;

  if (lowStockElem) lowStockElem.textContent = lowStock;

}





function resetProductForm() {

  document.getElementById("product-form").reset();

  document.getElementById("product-id").value = "";

  document.getElementById("product-form-title").textContent = "✨ Crear Producto";

  clearImageUploads();

}



function fillFormForEdit(product) {

  document.getElementById("product-id").value = product.ID || "";

  document.getElementById("product-name").value = product.Nombre || "";

  document.getElementById("product-price").value = product.Precio || "";

  document.getElementById("product-stock").value = product.Stock || "";

  document.getElementById("product-description").value = product.Descripcion || "";

  document.getElementById("product-sizes").value = product.Talla || "";

  document.getElementById("product-category").value = product.Categoria || "";

  document.getElementById("product-badge").value = product.Badge || "";

  

  const img1 = document.getElementById("product-image1");

  if (img1) img1.value = product.Imagen1 || "";

  const img2 = document.getElementById("product-image2");

  if (img2) img2.value = product.Imagen2 || "";

  const img3 = document.getElementById("product-image3");

  if (img3) img3.value = product.Imagen3 || "";

  

  document.getElementById("product-form-title").textContent = "Editar Producto";

  

  if (product.Imagen1) {

    const preview1 = document.getElementById("preview-image-upload-1");

    if (preview1) {

      preview1.src = product.Imagen1;

      preview1.style.display = "block";

    }

  }

  if (product.Imagen2) {

    const preview2 = document.getElementById("preview-image-upload-2");

    if (preview2) {

      preview2.src = product.Imagen2;

      preview2.style.display = "block";

    }

  }

  if (product.Imagen3) {

    const preview3 = document.getElementById("preview-image-upload-3");

    if (preview3) {

      preview3.src = product.Imagen3;

      preview3.style.display = "block";

    }

  }

  

  window.scrollTo({ top: 0, behavior: 'smooth' });

}



async function handleProductFormSubmit(e) {

  e.preventDefault();
if (!adminSession) { showTemporaryMessage("❌ Sesión no válida", "error"); return; }

  const id = document.getElementById("product-id").value;

  const data = {

    Nombre: document.getElementById("product-name").value.trim(),

    Precio: Number(document.getElementById("product-price").value || 0),

    Stock: Number(document.getElementById("product-stock").value || 0),

    Descripcion: document.getElementById("product-description").value.trim(),

    Talla: document.getElementById("product-sizes").value.trim(),

    Categoria: document.getElementById("product-category").value.trim(),

    Badge: document.getElementById("product-badge").value,

    Imagen1: document.getElementById("product-image1").value.trim(),

    Imagen2: document.getElementById("product-image2").value.trim(),

    Imagen3: document.getElementById("product-image3").value.trim(),

  };

  

  if (!data.Nombre) {

    await showCustomAlert({

      title: "⚠️ Campo requerido",

      message: "El nombre del producto es obligatorio.",

      icon: "📝",

      confirmText: "Aceptar"

    });

    return;

  }

  

  showLoader(id ? "Actualizando producto..." : "Creando producto...");

  

  try {

    let res;

    if (id) {

      res = await apiRequest("POST", { action: "update", id, ...data });

    } else {

      res = await apiRequest("POST", { action: "create", ...data });

    }

    

    if (!res || !res.ok) {

      throw new Error(res?.error || "Error desconocido");

    }

    

    resetProductForm();

    clearImageUploads();

    await loadAdminProducts();

    

    await showCustomAlert({

      title: id ? "✅ Producto actualizado" : "✅ Producto creado",

      message: id ? "El producto se ha actualizado correctamente." : "El producto se ha creado correctamente.",

      icon: "🎉",

      confirmText: "Aceptar"

    });

    

  } catch (err) {

    console.error(err);

    await showCustomAlert({

      title: "❌ Error",

      message: "Error al guardar el producto: " + err.message,

      icon: "⚠️",

      confirmText: "Aceptar"

    });

  } finally {

    hideLoader();

  }

}



async function deleteProduct(id) {
if (!adminSession) { showTemporaryMessage("❌ Sesión no válida", "error"); return; }

  const confirmDelete = await new Promise((resolve) => {

    showCustomConfirm({

      title: "Eliminar producto",

      message: "¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.",

      icon: "⚠️",

      confirmText: "Sí, eliminar",

      cancelText: "Cancelar",

      onConfirm: () => resolve(true),

      onCancel: () => resolve(false)

    });

  });

  

  if (!confirmDelete) return;

  

  showLoader("Eliminando producto...");

  

  try {

    await apiRequest("POST", { action: "delete", id });

    await loadAdminProducts();

    

  } catch (err) {

    console.error(err);

  

  } finally   {

    hideLoader();

  }

}



const UPLOAD_API_URL = ADMIN_API_URL;



function initImageUploads() {

  setupImageUpload("image-upload-1", "product-image1", "preview-image-upload-1", "progress-image-upload-1");

  setupImageUpload("image-upload-2", "product-image2", "preview-image-upload-2", "progress-image-upload-2");

  setupImageUpload("image-upload-3", "product-image3", "preview-image-upload-3", "progress-image-upload-3");

}



function setupImageUpload(fileInputId, textInputId, previewId, progressId) {

  const fileInput = document.getElementById(fileInputId);

  const textInput = document.getElementById(textInputId);

  const preview = document.getElementById(previewId);

  const progress = document.getElementById(progressId);

  

  if (!fileInput) return;

  

  fileInput.addEventListener("change", async () => {

    const file = fileInput.files[0];

    if (!file) return;

    

    const reader = new FileReader();

    reader.onload = (e) => {

      preview.src = e.target.result;

      preview.style.display = "block";

    };

    reader.readAsDataURL(file);

    

    if (progress) progress.style.width = "10%";

    

    try {

      const compressed = await compressImage(file);

      const base64 = compressed.split(",")[1];

      

      if (progress) progress.style.width = "40%";

      

      const res = await fetch(UPLOAD_API_URL, {

        method: "POST",

        headers: { "Content-Type": "text/plain" },

        body: JSON.stringify({ action: "uploadImage", fileName: file.name, mimeType: "image/jpeg", data: base64 })

      });

      

      if (progress) progress.style.width = "70%";

      

      const json = await res.json();

      

      if (!json.ok) {

        throw new Error(json.error || "Error al subir imagen");

      }

      

      const imageUrl = "https://lh3.googleusercontent.com/d/" + json.id + "=w400-h400-c-rw";

      textInput.value = imageUrl;

      

      if (progress) progress.style.width = "100%";

      setTimeout(() => {

        if (progress) progress.style.width = "0%";

      }, 800);

      

    } catch (err) {

      console.error(err);

      await showCustomAlert({

        title: "❌ Error",

        message: "Error al subir la imagen: " + err.message,

        icon: "🖼️",

        confirmText: "Aceptar"

      });

      if (progress) progress.style.width = "0%";

    }

  });

}



async function compressImage(file) {

  return new Promise((resolve) => {

    const img = new Image();

    const reader = new FileReader();

    reader.onload = e => img.src = e.target.result;

    img.onload = () => {

      const canvas = document.createElement("canvas");

      const MAX = 1200;

      let w = img.width, h = img.height;

      if (w > MAX || h > MAX) {

        if (w > h) {

          h *= MAX / w;

          w = MAX;

        } else {

          w *= MAX / h;

          h = MAX;

        }

      }

      canvas.width = w;

      canvas.height = h;

      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0, w, h);

      resolve(canvas.toDataURL("image/jpeg", 0.8));

    };

    reader.readAsDataURL(file);

  });

}



function clearImageUploads() {

  const previews = document.querySelectorAll(".image-preview");

  const progressBars = document.querySelectorAll(".upload-progress");

  const fileInputs = document.querySelectorAll("input[type=file]");

  

  previews.forEach(img => {

    img.src = "";

    img.style.display = "none";

  });

  progressBars.forEach(bar => {

    if (bar) bar.style.width = "0%";

  });

  fileInputs.forEach(input => {

    if (input) input.value = "";

  });

}



async function checkNotifications() {

  try {

    const res = await fetch(`${ADMIN_API_URL}?action=notifications`);

    const data = await res.json();

    if (!data.ok) return;

    

    const notifications = data.notifications || [];

    const pendingNotifications = notifications.filter(n => n.STATUS === "pending");

    const count = pendingNotifications.length;

    const badge = document.getElementById("notif-badge");

    

    if (badge) {

      badge.textContent = count;

      

      if (count > 0) {

        badge.style.animation = "pulse 0.5s ease";

        setTimeout(() => {

          if (badge) badge.style.animation = "";

        }, 500);

      }

      

      if (count > lastNotifCount && count > 0 && adminSession) {

        const bell = document.querySelector(".admin-notification-bell");

        if (bell) {

          bell.style.transform = "scale(1.05)";

          bell.style.boxShadow = "0 0 20px rgba(255,79,129,0.6)";

          setTimeout(() => {

            if (bell) {

              bell.style.transform = "";

              bell.style.boxShadow = "";

            }

          }, 1000);

        }

      }

    }

    

    lastNotifCount = count;

  } catch(err) {

    console.log("Error checking notifications:", err);

  }

}



function startNotificationMonitoring() {

  if (notificationInterval) clearInterval(notificationInterval);

  checkNotifications();

  notificationInterval = setInterval(checkNotifications, 10000);

}



function stopNotificationMonitoring() {

  if (notificationInterval) {

    clearInterval(notificationInterval);

    notificationInterval = null;

  }

}



function openNotifications() {

  window.location.href = "notificaciones.html";

}



document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("admin-login-form");
  if (loginForm) loginForm.addEventListener("submit", handleAdminLogin);
  const logoutBtn = document.getElementById("admin-logout-btn");
  if (logoutBtn) {
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    newLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🖱️ Botón logout clickeado");
      doAdminLogout();
    });
  }

  

  

  

  const resetBtn = document.getElementById("reset-form-btn");

  if (resetBtn) resetBtn.addEventListener("click", resetProductForm);

  

  const refreshBtn = document.getElementById("admin-refresh-btn");

  if (refreshBtn) refreshBtn.addEventListener("click", loadAdminProducts);

  

  initImageUploads();

  

  const adminSearch = document.getElementById("admin-search-input");

  const adminCategory = document.getElementById("admin-category-filter");

  const adminStock = document.getElementById("admin-stock-filter");

  

  if (adminSearch) {

    adminSearch.addEventListener("input", () => { 

      adminCurrentPage = 1; 

      renderAdminProductsWithFilters(); 

    });

  }

  if (adminCategory) {

    adminCategory.addEventListener("change", () => { 

      adminCurrentPage = 1; 

      renderAdminProductsWithFilters(); 

    });

  }

  if (adminStock) {

    adminStock.addEventListener("change", () => { 

      adminCurrentPage = 1; 

      renderAdminProductsWithFilters(); 

    });

  }

  

  const hasSession = sessionStorage.getItem("admin_session");
const savedToken = sessionStorage.getItem("admin_token") || "";
if (hasSession === "true" && document.getElementById("admin-panel-view")) {
  adminSession = "ok"; 
  document.getElementById("admin-login-view").hidden = true;
  document.getElementById("admin-panel-view").hidden = false;
  loadAdminProducts();
  startNotificationMonitoring();
}
  window.dispatchEvent(new CustomEvent('adminReady'));

});



const originalLoginSuccess = handleAdminLogin;

window.handleAdminLogin = async function(e) {

  await originalLoginSuccess(e);

  if (adminSession) {

    sessionStorage.setItem("admin_session", "true");

  }

};



function doAdminLogout() {

  console.log("🚪 Cerrando sesión...");

  stopNotificationMonitoring();

  adminSession = null;

  sessionStorage.removeItem("admin_session");
  sessionStorage.removeItem("admin_token");

  const loginView = document.getElementById("admin-login-view");

  const panelView = document.getElementById("admin-panel-view");

  if (loginView) loginView.hidden = false;

  if (panelView) panelView.hidden = true;

  

  const loginForm = document.getElementById("admin-login-form");

  if (loginForm) loginForm.reset();  

}
