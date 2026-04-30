const ADMIN_ACTIONS = {
    CREATE: 'admin_create',
    UPDATE: 'admin_update',
    DELETE: 'admin_delete'
};

let pendingActions = [];


function loadPendingActions() {
    try {
        const saved = localStorage.getItem('zr_admin_pending');
        if (saved) {
            pendingActions = JSON.parse(saved);
            console.log(`📦 Cargadas ${pendingActions.length} acciones pendientes`);
        }
    } catch(e) { pendingActions = []; }
    updatePendingBadge();
}

function savePendingActions() {
    try {
        localStorage.setItem('zr_admin_pending', JSON.stringify(pendingActions));
        updatePendingBadge();
    } catch(e) {}
}

function addPendingAction(type, data, productId = null) {
    pendingActions.push({
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        type: type,
        data: data,
        productId: productId,
        timestamp: Date.now(),
        retries: 0
    });
    savePendingActions();
    showMessage(`📡 Producto guardado localmente. Se sincronizará cuando haya internet.`, 'info');
    console.log(`📝 Acción "${type}" guardada. Total pendientes: ${pendingActions.length}`);
}


const ADMIN_API = "https:

async function syncPendingActions() {
    if (!navigator.onLine) {
        console.log("📡 Sin conexión, no se puede sincronizar");
        return;
    }
    
    if (pendingActions.length === 0) return;
    
    console.log(`🔄 Sincronizando ${pendingActions.length} acciones pendientes...`);
    showMessage(`🔄 Sincronizando ${pendingActions.length} producto(s)...`, 'info');
    
    for (let i = 0; i < pendingActions.length; i++) {
        const action = pendingActions[i];
        
        try {
            let success = false;
            
            if (action.type === ADMIN_ACTIONS.CREATE) {
                const response = await fetch(ADMIN_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: new URLSearchParams({ action: "create", token: sessionStorage.getItem("admin_token") || "", ...action.data }).toString()
                });
                const result = await response.json();
                success = result.ok === true;
                if (success) console.log(`✅ Producto creado: ${action.data.Nombre}`);
            }
            else if (action.type === ADMIN_ACTIONS.UPDATE) {
                const response = await fetch(ADMIN_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: new URLSearchParams({ action: "update", id: action.productId, token: sessionStorage.getItem("admin_token") || "", ...action.data }).toString()
                });
                const result = await response.json();
                success = result.ok === true;
                if (success) console.log(`✅ Producto actualizado: ID ${action.productId}`);
            }
            else if (action.type === ADMIN_ACTIONS.DELETE) {
                const response = await fetch(ADMIN_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: new URLSearchParams({ action: "delete", id: action.productId, token: sessionStorage.getItem("admin_token") || "" }).toString()
                });
                const result = await response.json();
                success = result.ok === true;
                if (success) console.log(`✅ Producto eliminado: ID ${action.productId}`);
            }
            
            if (success) {
                pendingActions.splice(i, 1);
                i--;
                savePendingActions();
            } else {
                action.retries++;
                if (action.retries >= 3) {
                    console.warn(`❌ Acción fallida tras ${action.retries} intentos, eliminando`);
                    pendingActions.splice(i, 1);
                    i--;
                    savePendingActions();
                } else {
                    console.log(`⚠️ Reintento ${action.retries}/3 para ${action.type}`);
                }
            }
        } catch (err) {
            console.error(`Error sincronizando:`, err);
            action.retries++;
            if (action.retries >= 3) {
                pendingActions.splice(i, 1);
                i--;
                savePendingActions();
            }
        }
    }
    
    if (pendingActions.length === 0) {
        showMessage(`✅ Todos los productos sincronizados`, 'success');
        if (typeof loadAdminProducts === 'function') {
            loadAdminProducts();
        }
    }
    
    updatePendingBadge();
}


let pendingBadge = null;

function updatePendingBadge() {
    const count = pendingActions.length;
    
    if (!pendingBadge && count > 0) {
        pendingBadge = document.createElement('div');
        pendingBadge.id = 'pending-badge';
        pendingBadge.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #f97316;
            color: white;
            padding: 8px 16px;
            border-radius: 40px;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            font-family: monospace;
        `;
        pendingBadge.onclick = () => {
            if (confirm(`¿Sincronizar ${count} producto(s) pendiente(s) ahora?`)) {
                syncPendingActions();
            }
        };
        document.body.appendChild(pendingBadge);
    }
    
    if (pendingBadge) {
        if (count > 0) {
            pendingBadge.style.display = 'flex';
            pendingBadge.innerHTML = `📡 ${count} pendiente${count !== 1 ? 's' : ''} · Click para sincronizar`;
        } else {
            pendingBadge.style.display = 'none';
        }
    }
}

function showMessage(msg, type = 'info') {
    if (typeof showTemporaryMessage === 'function') {
        showTemporaryMessage(msg, type);
    } else {
        console.log(`[Offline] ${msg}`);
    }
}


function setupInterception() {
    // Esperar a que admin.js señale que está listo, en lugar de hacer polling
    window.addEventListener('adminReady', () => {
        console.log("✅ adminReady recibido, aplicando interceptación offline");

        window._originalSubmit = window.handleProductFormSubmit;
        window._originalDelete = window.deleteProduct;

        window.handleProductFormSubmit = async function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (!navigator.onLine) {
                const id = document.getElementById("product-id")?.value || "";
                const productData = {
                    Nombre: document.getElementById("product-name")?.value.trim() || "",
                    Precio: Number(document.getElementById("product-price")?.value || 0),
                    Stock: Number(document.getElementById("product-stock")?.value || 0),
                    Descripcion: document.getElementById("product-description")?.value.trim() || "",
                    Talla: document.getElementById("product-sizes")?.value.trim() || "",
                    Categoria: document.getElementById("product-category")?.value.trim() || "",
                    Badge: document.getElementById("product-badge")?.value || "",
                    Imagen1: document.getElementById("product-image1")?.value.trim() || "",
                    Imagen2: document.getElementById("product-image2")?.value.trim() || "",
                    Imagen3: document.getElementById("product-image3")?.value.trim() || "",
                };

                if (!productData.Nombre) {
                    if (typeof showCustomAlert === 'function') {
                        await showCustomAlert({ title: "⚠️ Campo requerido", message: "El nombre del producto es obligatorio.", icon: "📝", confirmText: "Aceptar" });
                    }
                    return;
                }

                addPendingAction(id ? ADMIN_ACTIONS.UPDATE : ADMIN_ACTIONS.CREATE, productData, id || null);
                if (typeof resetProductForm === 'function') resetProductForm();
                if (typeof clearImageUploads === 'function') clearImageUploads();
                if (typeof showCustomAlert === 'function') {
                    await showCustomAlert({ title: "📡 Guardado localmente", message: "Se sincronizará cuando haya internet.", icon: "📡", confirmText: "Aceptar" });
                }
                return;
            }

            await window._originalSubmit(e);
        };

        const productForm = document.getElementById("product-form");
        if (productForm) {
            const newForm = productForm.cloneNode(true);
            productForm.parentNode.replaceChild(newForm, productForm);
            newForm.addEventListener("submit", window.handleProductFormSubmit);
        }

        window.deleteProduct = async function(id) {
            if (!navigator.onLine) {
                addPendingAction(ADMIN_ACTIONS.DELETE, null, id);
                const row = document.querySelector(`.admin-product-row button[data-id="${id}"]`)?.closest('.admin-product-row');
                if (row) row.remove();
                if (typeof showCustomAlert === 'function') {
                    await showCustomAlert({ title: "📡 Producto marcado", message: "Se eliminará cuando haya internet.", icon: "📡", confirmText: "Aceptar" });
                }
                return;
            }
            await window._originalDelete(id);
        };
    }, { once: true }); // once:true — se ejecuta una sola vez y se limpia solo
}

window.addEventListener('online', () => {
    console.log("🟢 Conexión recuperada - Sincronizando...");
    showMessage("🟢 Conexión recuperada. Sincronizando cambios...", 'success');
    setTimeout(() => syncPendingActions(), 1000);
});

window.addEventListener('offline', () => {
    console.log("🔴 Conexión perdida");
    showMessage("📡 Sin conexión - Los cambios se guardarán localmente", 'warning');
});


loadPendingActions();
setupInterception();

if (navigator.onLine && pendingActions.length > 0) {
    setTimeout(() => syncPendingActions(), 3000);
}


window.debugPending = () => console.table(pendingActions);
window.syncNow = () => syncPendingActions();
window.clearPending = () => {
    if (confirm('¿Eliminar TODAS las acciones pendientes?')) {
        pendingActions = [];
        savePendingActions();
        updatePendingBadge();
        console.log("🗑️ Cola limpiada");
    }
};
