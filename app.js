import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { CONFIG } from "./config.js";
import {
  DIVISIONS_LIST, ASSOCIATION_CLUBS, DEFAULT_STANDINGS, DIRECTIVA_DATA, LOGROS_DATA,
  NOTICIAS_DATA, DEFAULT_CLUB_PHOTOS, FIELD_HOURS
} from "./data.js";


function toLocalDateStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getTodayStr() {
    return toLocalDateStr(new Date());
}

function getWeekDaysFor(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const dayOfWeek = base.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMonday);

    const names = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const days = [];
    for (let i = 0; i < 7; i++) {
        const curr = new Date(monday);
        curr.setDate(monday.getDate() + i);
        days.push({
            dateStr: toLocalDateStr(curr),
            dayName: names[i],
            dayNum: curr.getDate()
        });
    }
    return days;
}

function getShortSpanishDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    return `${names[dt.getDay()]} ${d}`;
}

function formatCLP(amount) {
    return '$' + (Number(amount) || 0).toLocaleString('es-CL');
}

function buildDefaultBookings() {
    const today = getTodayStr();
    return [
        {
            id: 'bk-1',
            date: today,
            hour: '10:00',
            team: 'Los Halcones',
            phone: '+56 9 8412 3301',
            type: 'Cancha completa',
            price: CONFIG.fieldPrice,
            status: 'paid'
        },
        {
            id: 'bk-2',
            date: today,
            hour: '18:00',
            team: 'Villa Esperanza',
            phone: '+56 9 7654 1120',
            type: 'Cancha completa',
            price: CONFIG.fieldPrice,
            status: 'paid'
        },
        {
            id: 'bk-3',
            date: today,
            hour: '19:00',
            team: 'Deportivo Unión',
            phone: '+56 9 9123 8845',
            type: 'Media cancha',
            price: CONFIG.fieldPrice,
            status: 'pending'
        }
    ];
}

// ==========================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
const state = {
    activeTab: 'home',
    selectedDivisionId: 'primera-adulta',
    editMode: false,
    adminPin: CONFIG.defaultAdminPin,
    standings: JSON.parse(JSON.stringify(DEFAULT_STANDINGS)),
    customCrest: null,
    presidentName: CONFIG.presidentName,
    presidentRole: CONFIG.presidentRole,
    customPresidentPhoto: null,
    directiva: JSON.parse(JSON.stringify(DIRECTIVA_DATA)),
    logros: JSON.parse(JSON.stringify(LOGROS_DATA)),
    noticias: JSON.parse(JSON.stringify(NOTICIAS_DATA)),
    clubPhotos: JSON.parse(JSON.stringify(DEFAULT_CLUB_PHOTOS)),
    customFieldPhoto: null,
    selectedDate: getTodayStr(),
    selectedMonth: getTodayStr().slice(0, 7),
    fieldSubTab: 'agenda',
    bookings: buildDefaultBookings(),
    ledger: []
};

// ==========================================
// PERSISTENCIA EN LA NUBE (FIREBASE FIRESTORE)
// ==========================================
const RUNTIME_APP_ID = (typeof __app_id !== 'undefined' && __app_id) ? __app_id : 'club-vicente-martinez-app';
const FIXED_CLOUD_PATH = ['artifacts', RUNTIME_APP_ID, 'public', 'data', 'club_state', 'club_vicente_martinez_official_v1'];
const LOCAL_BACKUP_KEY = CONFIG.localBackupKey;
let db = null;
let auth = null;
let currentUser = null;
let isSavingToCloud = false;
// Respaldo en memoria de sesión para no perder fotos ni clave si hay re-renders
window.__VM_SESSION_MEDIA__ = window.__VM_SESSION_MEDIA__ || {
    adminPin: null,
    crest: null,
    president: null,
    fieldPhoto: null,
    directivaPhotos: {},
    clubPhotos: {}
};

function saveLocalBackup() {
    try {
        window.__VM_SESSION_MEDIA__.adminPin = String(state.adminPin);
        if (state.customCrest) window.__VM_SESSION_MEDIA__.crest = state.customCrest;
        if (state.customPresidentPhoto) window.__VM_SESSION_MEDIA__.president = state.customPresidentPhoto;
        if (state.customFieldPhoto) window.__VM_SESSION_MEDIA__.fieldPhoto = state.customFieldPhoto;
        state.directiva.forEach(d => {
            if (d.photo) window.__VM_SESSION_MEDIA__.directivaPhotos[d.id] = d.photo;
        });
        state.clubPhotos.forEach(p => {
            if (p.imageUrl) window.__VM_SESSION_MEDIA__.clubPhotos[p.id] = p.imageUrl;
        });

        localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify({
            adminPin: String(state.adminPin),
            standings: state.standings,
            customCrest: state.customCrest,
            presidentName: state.presidentName,
            presidentRole: state.presidentRole,
            customPresidentPhoto: state.customPresidentPhoto,
            customFieldPhoto: state.customFieldPhoto,
            directiva: state.directiva,
            logros: state.logros,
            noticias: state.noticias,
            clubPhotos: state.clubPhotos,
            bookings: state.bookings,
            ledger: state.ledger
        }));
    } catch (e) {}
}

function loadLocalBackup() {
    try {
        const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.adminPin) state.adminPin = String(data.adminPin);
            if (data.standings) state.standings = { ...state.standings, ...data.standings };
            if ('customCrest' in data && data.customCrest) state.customCrest = data.customCrest;
            if (data.presidentName) state.presidentName = data.presidentName;
            if (data.presidentRole) state.presidentRole = data.presidentRole;
            if ('customPresidentPhoto' in data && data.customPresidentPhoto) state.customPresidentPhoto = data.customPresidentPhoto;
            if ('customFieldPhoto' in data && data.customFieldPhoto) state.customFieldPhoto = data.customFieldPhoto;
            if (data.directiva) state.directiva = data.directiva;
            if (data.logros) state.logros = data.logros;
            if (data.noticias) state.noticias = data.noticias;
            if (data.clubPhotos) state.clubPhotos = data.clubPhotos;
            if (data.bookings) state.bookings = data.bookings;
            if (data.ledger) state.ledger = data.ledger;
        }

        // Recuperar desde respaldo de sesión si existe (incluye clave PIN y fotos)
        const mem = window.__VM_SESSION_MEDIA__;
        if (mem.adminPin) state.adminPin = String(mem.adminPin);
        if (!state.customCrest && mem.crest) state.customCrest = mem.crest;
        if (!state.customPresidentPhoto && mem.president) state.customPresidentPhoto = mem.president;
        if (!state.customFieldPhoto && mem.fieldPhoto) state.customFieldPhoto = mem.fieldPhoto;
        state.directiva.forEach(d => {
            if (!d.photo && mem.directivaPhotos[d.id]) d.photo = mem.directivaPhotos[d.id];
        });
        state.clubPhotos.forEach(p => {
            if (!p.imageUrl && mem.clubPhotos[p.id]) p.imageUrl = mem.clubPhotos[p.id];
        });
    } catch (e) {}
}

async function persistClubStateToCloud() {
    saveLocalBackup();
    const statusEl = document.getElementById('cloud-sync-status');
    if (!db || !currentUser) {
        if (statusEl) statusEl.textContent = 'Guardado en este navegador ✓';
        return true;
    }
    try {
        isSavingToCloud = true;
        if (statusEl) statusEl.textContent = 'Guardando cambios...';
        const publicDocRef = doc(db, ...FIXED_CLOUD_PATH);
        await setDoc(publicDocRef, {
            adminPin: String(state.adminPin),
            standingsJson: JSON.stringify(state.standings),
            customCrest: state.customCrest,
            presidentName: state.presidentName,
            presidentRole: state.presidentRole,
            customPresidentPhoto: state.customPresidentPhoto,
            customFieldPhoto: state.customFieldPhoto,
            directivaJson: JSON.stringify(state.directiva),
            logrosJson: JSON.stringify(state.logros),
            noticiasJson: JSON.stringify(state.noticias),
            clubPhotosJson: JSON.stringify(state.clubPhotos),
            bookingsJson: JSON.stringify(state.bookings),
            ledgerJson: JSON.stringify(state.ledger),
            updatedAt: Date.now()
        }, { merge: true });
        if (statusEl) statusEl.textContent = 'Guardado en la nube ✓';
        return true;
    } catch (err) {
        console.error('Error guardando en Firestore:', err);
        if (statusEl) statusEl.textContent = 'Guardado en este navegador ✓';
        return true;
    } finally {
        setTimeout(() => { isSavingToCloud = false; }, 400);
    }
}

async function initCloudSync() {
    const statusEl = document.getElementById('cloud-sync-status');
    try {
        const injected = (typeof __firebase_config !== 'undefined' && __firebase_config) ? JSON.parse(__firebase_config) : null;
        const firebaseConfig = CONFIG.firebaseConfig || injected;
        if (!firebaseConfig) {
            if (statusEl) statusEl.textContent = 'Guardado en este navegador ✓';
            return;
        }
                const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            const cred = await signInWithCustomToken(auth, __initial_auth_token);
            currentUser = cred.user;
        } else {
            const cred = await signInAnonymously(auth);
            currentUser = cred.user;
        }

        const publicDocRef = doc(db, ...FIXED_CLOUD_PATH);
        onSnapshot(publicDocRef, (snap) => {
            if (isSavingToCloud) return;
            if (snap.exists()) {
                const data = snap.data();
                if (data.adminPin) state.adminPin = String(data.adminPin);
                if (data.standingsJson) {
                    try { state.standings = { ...state.standings, ...JSON.parse(data.standingsJson) }; } catch (e) {}
                }
                if ('customCrest' in data) state.customCrest = data.customCrest;
                if (data.presidentName) state.presidentName = data.presidentName;
                if (data.presidentRole) state.presidentRole = data.presidentRole;
                if ('customPresidentPhoto' in data) state.customPresidentPhoto = data.customPresidentPhoto;
                if ('customFieldPhoto' in data) state.customFieldPhoto = data.customFieldPhoto;
                if (data.directivaJson) {
                    try { state.directiva = JSON.parse(data.directivaJson); } catch (e) {}
                }
                if (data.logrosJson) {
                    try { state.logros = JSON.parse(data.logrosJson); } catch (e) {}
                }
                if (data.noticiasJson) {
                    try { state.noticias = JSON.parse(data.noticiasJson); } catch (e) {}
                }
                if (data.clubPhotosJson) {
                    try { state.clubPhotos = JSON.parse(data.clubPhotosJson); } catch (e) {}
                }
                if (data.bookingsJson) {
                    try { state.bookings = JSON.parse(data.bookingsJson); } catch (e) {}
                }
                if (data.ledgerJson) {
                    try { state.ledger = JSON.parse(data.ledgerJson); } catch (e) {}
                }
                saveLocalBackup();
                applyCustomCrest();
                render();
            } else {
                persistClubStateToCloud();
            }
            if (statusEl) statusEl.textContent = 'Guardado en la nube ✓';
        }, (err) => {
            console.warn('Error en listener Firestore:', err);
            if (statusEl) statusEl.textContent = 'Guardado en este navegador ✓';
        });
    } catch (err) {
        console.warn('Firebase no disponible, usando respaldo local:', err);
        if (statusEl) statusEl.textContent = 'Guardado en este navegador ✓';
    }
}

// ==========================================
// UTILIDADES DE IMÁGENES Y NOTIFICACIONES
// ==========================================
function showToast(msg) {
    const el = document.getElementById('toast-msg');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function compressImageToDataUrl(file, maxDim = 680, quality = 0.78) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function applyCustomCrest() {
    const container = document.getElementById('crest-container');
    if (!container) return;
    if (state.customCrest) {
        container.innerHTML = `<img src="${state.customCrest}" alt="Insignia Vicente Martínez" class="w-full h-full object-contain rounded-xl">`;
    } else {
        container.innerHTML = `
            <svg viewBox="0 0 120 120" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 26 L98 26 L92 78 C89 96 60 109 60 109 C60 109 31 96 28 78 Z" fill="#EC6625" stroke="#111111" stroke-width="4.5"/>
                <path d="M12 18 Q60 8 108 18 L102 32 Q60 23 18 32 Z" fill="#FFFFFF" stroke="#111111" stroke-width="3.5"/>
                <text x="60" y="25" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="10.5" fill="#111111" letter-spacing="1.2">VICENTE</text>
                <text x="60" y="64" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="30" fill="#FFFFFF" stroke="#111111" stroke-width="1.8">V</text>
                <text x="60" y="83" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="28" fill="#FFFFFF" stroke="#111111" stroke-width="1.8">M</text>
                <path d="M14 82 Q60 95 106 82 L100 96 Q60 108 20 96 Z" fill="#FFFFFF" stroke="#111111" stroke-width="3.5"/>
                <text x="60" y="95" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="9.5" fill="#111111" letter-spacing="0.8">MARTÍNEZ</text>
            </svg>
        `;
    }
}

window.handleImageUpload = async function(event, targetType, targetId = null) {
    if (!state.editMode) {
        showToast('Activa el Modo Edición Admin primero');
        return;
    }
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
        showToast('Procesando y guardando imagen...');
        const maxDim = targetType === 'crest' ? 420 : 680;
        const dataUrl = await compressImageToDataUrl(file, maxDim, 0.78);
        if (targetType === 'crest') {
            state.customCrest = dataUrl;
            applyCustomCrest();
        } else if (targetType === 'president') {
            state.customPresidentPhoto = dataUrl;
        } else if (targetType === 'fieldPhoto') {
            state.customFieldPhoto = dataUrl;
        } else if (targetType === 'directiva' && targetId) {
            const member = state.directiva.find(d => d.id === targetId);
            if (member) member.photo = dataUrl;
        } else if (targetType === 'clubPhoto' && targetId) {
            const photoItem = state.clubPhotos.find(p => p.id === targetId);
            if (photoItem) photoItem.imageUrl = dataUrl;
        } else if (targetType === 'newClubPhoto') {
            state.clubPhotos.unshift({
                id: 'photo-' + Date.now(),
                tag: 'Galería VM',
                title: 'Postal Club Vicente Martínez',
                desc: 'Recuerdo oficial compartido por la administración.',
                imageUrl: dataUrl,
                preset: null
            });
        }
        await persistClubStateToCloud();
        render();
        showToast('Imagen guardada permanentemente ✓');
    } catch (err) {
        console.error(err);
        showToast('No se pudo procesar la imagen');
    }
};

// ==========================================
// CONTROLES DE ADMINISTRADOR (PIN + MODAL)
// ==========================================
window.toggleSettingsModal = function() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const willOpen = modal.classList.contains('hidden');
    modal.classList.toggle('hidden');
    if (willOpen) {
        syncAdminModalUI();
        if (window.lucide) lucide.createIcons();
    }
};

function syncAdminModalUI() {
    const sw = document.getElementById('edit-toggle-switch');
    const knob = document.getElementById('edit-toggle-knob');
    const pinBox = document.getElementById('admin-pin-box');
    const authPanel = document.getElementById('admin-authenticated-panel');
    const banner = document.getElementById('edit-mode-banner');
    const dot = document.getElementById('edit-badge-dot');
    const crestBtn = document.getElementById('crest-upload-btn');

    if (state.editMode) {
        if (sw) { sw.classList.remove('bg-gray-300'); sw.classList.add('bg-clubOrange'); }
        if (knob) { knob.classList.remove('translate-x-0'); knob.classList.add('translate-x-5'); }
        if (pinBox) pinBox.classList.add('hidden');
        if (authPanel) authPanel.classList.remove('hidden');
        if (banner) banner.classList.remove('hidden');
        if (dot) dot.classList.remove('hidden');
        if (crestBtn) crestBtn.classList.remove('hidden');

        const mStats = getMonthFinancials(state.selectedMonth);
        const colEl = document.getElementById('modal-month-collected');
        const penEl = document.getElementById('modal-month-pending');
        if (colEl) colEl.textContent = formatCLP(mStats.collected);
        if (penEl) penEl.textContent = formatCLP(mStats.pending);
    } else {
        if (sw) { sw.classList.add('bg-gray-300'); sw.classList.remove('bg-clubOrange'); }
        if (knob) { knob.classList.add('translate-x-0'); knob.classList.remove('translate-x-5'); }
        if (authPanel) authPanel.classList.add('hidden');
        if (banner) banner.classList.add('hidden');
        if (dot) dot.classList.add('hidden');
        if (crestBtn) crestBtn.classList.add('hidden');
    }
}

window.handleAdminSwitchClick = function() {
    if (state.editMode) {
        toggleEditMode(false);
    } else {
        const pinBox = document.getElementById('admin-pin-box');
        const pinInput = document.getElementById('admin-pin-input');
        if (pinBox) pinBox.classList.remove('hidden');
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
    }
};

window.verifyAdminPin = function() {
    const pinInput = document.getElementById('admin-pin-input');
    const entered = (pinInput ? pinInput.value : '').trim();
    if (entered === String(state.adminPin)) {
        toggleEditMode(true);
        showToast('Modo Edición Admin activado ✓');
    } else {
        showToast('Código PIN incorrecto');
        if (pinInput) pinInput.value = '';
    }
};

window.toggleEditMode = function(enabled) {
    state.editMode = !!enabled;
    syncAdminModalUI();
    render();
    if (!enabled) {
        showToast('Modo Administrador cerrado');
    }
};

window.updateAdminPin = async function() {
    if (!state.editMode) return;
    const input = document.getElementById('new-admin-pin-input');
    const nextPin = (input ? input.value : '').trim();
    if (nextPin.length < 4) {
        showToast('El PIN debe tener al menos 4 caracteres');
        return;
    }
    state.adminPin = nextPin;
    window.__VM_SESSION_MEDIA__.adminPin = String(nextPin);
    if (input) input.value = '';
    await persistClubStateToCloud();
    showToast('Nuevo PIN guardado ✓');
};

window.openTreasuryFromModal = function() {
    if (!state.editMode) return;
    toggleSettingsModal();
    state.activeTab = 'field';
    state.fieldSubTab = 'treasury';
    render();
};

window.resetAllData = async function() {
    if (!state.editMode) return;
    state.standings = JSON.parse(JSON.stringify(DEFAULT_STANDINGS));
    state.directiva = JSON.parse(JSON.stringify(DIRECTIVA_DATA));
    state.logros = JSON.parse(JSON.stringify(LOGROS_DATA));
    state.noticias = JSON.parse(JSON.stringify(NOTICIAS_DATA));
    state.clubPhotos = JSON.parse(JSON.stringify(DEFAULT_CLUB_PHOTOS));
    state.bookings = buildDefaultBookings();
    state.ledger = [];
    await persistClubStateToCloud();
    render();
    showToast('Datos iniciales restablecidos ✓');
};

// ==========================================
// NAVEGACIÓN Y TABLAS DE POSICIONES
// ==========================================
window.switchTab = function(tabName) {
    state.activeTab = tabName;
    if (tabName === 'field' && !state.editMode) {
        state.fieldSubTab = 'agenda';
    }
    render();
};

function getSortedStandings(divisionId) {
    const list = state.standings[divisionId] || [];
    return [...list].sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.dg !== a.dg) return b.dg - a.dg;
        return b.gf - a.gf;
    });
}

window.openStandings = function(divisionId) {
    state.selectedDivisionId = divisionId;
    state.activeTab = 'standings';
    render();
};

window.updateTeamField = async function(divisionId, clubName, field, rawVal) {
    if (!state.editMode) return;
    const list = state.standings[divisionId];
    if (!list) return;
    const team = list.find(t => t.club === clubName);
    if (!team) return;
    const num = parseInt(rawVal, 10);
    team[field] = isNaN(num) ? 0 : num;
    await persistClubStateToCloud();
    render();
};

// ==========================================
// ARRIENDO DE CANCHA Y TESORERÍA MENSUAL
// ==========================================
function getMonthFinancials(monthStr) {
    const monthBookings = state.bookings.filter(b => b.date && b.date.startsWith(monthStr));
    const monthLedger = state.ledger.filter(l => l.date && l.date.startsWith(monthStr));

    let collectedBookings = 0;
    let pendingBookings = 0;
    monthBookings.forEach(b => {
        const val = Number(b.price) || 0;
        if (b.status === 'paid') collectedBookings += val;
        else pendingBookings += val;
    });

    let extraIncome = 0;
    let extraExpense = 0;
    monthLedger.forEach(l => {
        const val = Number(l.amount) || 0;
        if (l.type === 'income') extraIncome += val;
        else extraExpense += val;
    });

    return {
        collected: collectedBookings + extraIncome,
        pending: pendingBookings,
        expenses: extraExpense,
        net: collectedBookings + extraIncome - extraExpense,
        count: monthBookings.length,
        monthBookings,
        monthLedger
    };
}

window.selectFieldDate = function(dateStr) {
    state.selectedDate = dateStr;
    state.selectedMonth = dateStr.slice(0, 7);
    render();
};

window.shiftFieldWeek = function(daysOffset) {
    const [y, m, d] = state.selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + daysOffset);
    const nextStr = toLocalDateStr(dt);
    state.selectedDate = nextStr;
    state.selectedMonth = nextStr.slice(0, 7);
    render();
};

window.setFieldSubTab = function(sub) {
    if (sub === 'treasury' && !state.editMode) {
        showToast('Acceso exclusivo para Administrador');
        return;
    }
    state.fieldSubTab = sub;
    render();
};

window.openBookingModal = function(preselectedHour = null) {
    const modal = document.getElementById('booking-modal');
    const hourSel = document.getElementById('booking-hour-select');
    const sub = document.getElementById('booking-modal-subtitle');
    const teamIn = document.getElementById('booking-team-input');
    const phoneIn = document.getElementById('booking-phone-input');
    const statusWrap = document.getElementById('booking-status-wrapper');

    if (sub) sub.textContent = `Fecha: ${getShortSpanishDateLabel(state.selectedDate)} (${state.selectedDate})`;
    if (teamIn) teamIn.value = '';
    if (phoneIn) phoneIn.value = '';

    const occupiedHours = new Set(
        state.bookings.filter(b => b.date === state.selectedDate).map(b => b.hour)
    );

    if (hourSel) {
        if (preselectedHour && !occupiedHours.has(preselectedHour)) {
            hourSel.value = preselectedHour;
        } else {
            const firstFree = FIELD_HOURS.find(h => !occupiedHours.has(h)) || FIELD_HOURS[0];
            hourSel.value = firstFree;
        }
    }

    if (statusWrap) {
        if (state.editMode) statusWrap.classList.remove('hidden');
        else statusWrap.classList.add('hidden');
    }

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
};

window.closeBookingModal = function() {
    const modal = document.getElementById('booking-modal');
    if (modal) modal.classList.add('hidden');
};

window.confirmBookingSubmit = async function() {
    const hour = document.getElementById('booking-hour-select')?.value || '18:00';
    const team = (document.getElementById('booking-team-input')?.value || '').trim();
    const phone = (document.getElementById('booking-phone-input')?.value || '').trim();
    const type = document.getElementById('booking-type-select')?.value || 'Cancha completa';
    const price = parseInt(document.getElementById('booking-price-input')?.value || String(CONFIG.fieldPrice), 10) || CONFIG.fieldPrice;
    const status = state.editMode
        ? (document.getElementById('booking-status-select')?.value || 'pending')
        : 'pending';

    if (!team) {
        showToast('Ingresa el nombre del equipo o responsable');
        return;
    }

    const exists = state.bookings.some(b => b.date === state.selectedDate && b.hour === hour);
    if (exists) {
        showToast(`El bloque ${hour} hrs ya está reservado`);
        return;
    }

    state.bookings.push({
        id: 'bk-' + Date.now(),
        date: state.selectedDate,
        hour,
        team,
        phone,
        type,
        price,
        status
    });

    closeBookingModal();
    await persistClubStateToCloud();
    render();
    showToast(`Horario ${hour} hrs reservado ✓`);
};

window.toggleBookingPaidStatus = async function(bookingId) {
    if (!state.editMode) return;
    const bk = state.bookings.find(b => b.id === bookingId);
    if (!bk) return;
    bk.status = bk.status === 'paid' ? 'pending' : 'paid';
    await persistClubStateToCloud();
    render();
    showToast(bk.status === 'paid' ? 'Marcado como Pagado ✓' : 'Marcado como Por cobrar');
};

window.deleteBooking = async function(bookingId) {
    if (!state.editMode) return;
    state.bookings = state.bookings.filter(b => b.id !== bookingId);
    await persistClubStateToCloud();
    render();
    showToast('Reserva eliminada');
};

window.addLedgerEntry = async function() {
    if (!state.editMode) return;
    const type = document.getElementById('ledger-type-select')?.value || 'income';
    const concept = (document.getElementById('ledger-concept-input')?.value || '').trim();
    const amount = parseInt(document.getElementById('ledger-amount-input')?.value || '0', 10);
    if (!concept || !amount || amount <= 0) {
        showToast('Completa concepto y monto válido');
        return;
    }
    state.ledger.unshift({
        id: 'led-' + Date.now(),
        date: state.selectedDate,
        type,
        concept,
        amount
    });
    await persistClubStateToCloud();
    render();
    showToast('Movimiento registrado en tesorería ✓');
};

window.deleteLedgerEntry = async function(id) {
    if (!state.editMode) return;
    state.ledger = state.ledger.filter(l => l.id !== id);
    await persistClubStateToCloud();
    render();
    showToast('Movimiento eliminado');
};

window.changeTreasuryMonth = function(monthStr) {
    if (!monthStr) return;
    state.selectedMonth = monthStr;
    render();
};

// ==========================================
// EDICIÓN DIRECTIVA, LOGROS, AVISOS Y GALERÍA
// ==========================================
window.updatePresidentInfo = async function(field, val) {
    if (!state.editMode) return;
    state[field] = val;
    await persistClubStateToCloud();
};

window.updateDirectivaItem = async function(id, field, val) {
    if (!state.editMode) return;
    const item = state.directiva.find(d => d.id === id);
    if (item) {
        item[field] = val;
        await persistClubStateToCloud();
    }
};

window.addDirectivaItem = async function() {
    if (!state.editMode) return;
    state.directiva.push({
        id: 'dir-' + Date.now(),
        role: 'Nuevo Cargo',
        name: 'Nombre Directivo',
        photo: null
    });
    await persistClubStateToCloud();
    render();
};

window.removeDirectivaItem = async function(id) {
    if (!state.editMode) return;
    state.directiva = state.directiva.filter(d => d.id !== id);
    await persistClubStateToCloud();
    render();
};

window.updateLogroItem = async function(id, field, val) {
    if (!state.editMode) return;
    const item = state.logros.find(l => l.id === id);
    if (item) {
        item[field] = val;
        await persistClubStateToCloud();
    }
};

window.addLogroItem = async function() {
    if (!state.editMode) return;
    state.logros.unshift({
        id: 'log-' + Date.now(),
        year: String(new Date().getFullYear()),
        title: 'Nuevo Título / Campeonato',
        desc: 'Descripción del logro deportivo obtenido.'
    });
    await persistClubStateToCloud();
    render();
};

window.removeLogroItem = async function(id) {
    if (!state.editMode) return;
    state.logros = state.logros.filter(l => l.id !== id);
    await persistClubStateToCloud();
    render();
};

window.updateNoticiaItem = async function(id, field, val) {
    if (!state.editMode) return;
    const item = state.noticias.find(n => n.id === id);
    if (item) {
        item[field] = val;
        await persistClubStateToCloud();
    }
};

window.addNoticiaItem = async function() {
    if (!state.editMode) return;
    state.noticias.unshift({
        id: 'not-' + Date.now(),
        tag: 'Comunicado',
        date: 'Hoy',
        title: 'Nuevo Aviso Oficial',
        body: 'Escribe aquí el detalle del comunicado para socios y jugadores.'
    });
    await persistClubStateToCloud();
    render();
};

window.removeNoticiaItem = async function(id) {
    if (!state.editMode) return;
    state.noticias = state.noticias.filter(n => n.id !== id);
    await persistClubStateToCloud();
    render();
};

window.updateClubPhotoTitle = async function(id, val) {
    if (!state.editMode) return;
    const item = state.clubPhotos.find(p => p.id === id);
    if (item) {
        item.title = val;
        await persistClubStateToCloud();
    }
};

window.removeClubPhoto = async function(id) {
    if (!state.editMode) return;
    state.clubPhotos = state.clubPhotos.filter(p => p.id !== id);
    await persistClubStateToCloud();
    render();
    showToast('Foto eliminada de la galería');
};

function getPresetPhotoGraphic(preset) {
    if (preset === 'trophy') {
        return `
            <div class="w-full h-36 bg-gradient-to-br from-fuchsia-900 via-purple-700 to-amber-500 flex flex-col justify-between p-2.5 text-white relative overflow-hidden">
                <div class="flex items-center justify-between z-10">
                    <span class="px-2 py-0.5 rounded-full bg-black/50 text-[8.5px] font-black uppercase tracking-wider">Copa VM</span>
                    <i data-lucide="trophy" class="w-4 h-4 text-amber-300"></i>
                </div>
                <svg viewBox="0 0 220 85" class="w-full h-16 my-auto z-10" xmlns="http://www.w3.org/2000/svg">
                    <!-- Jugador izquierdo -->
                    <circle cx="72" cy="24" r="9" fill="#FDBA74"/>
                    <path d="M56 36 Q72 32 88 36 L92 64 L52 64 Z" fill="#FFFFFF" stroke="#A21CAF" stroke-width="2.5"/>
                    <line x1="60" y1="45" x2="84" y2="45" stroke="#C026D3" stroke-width="2.5"/>
                    <line x1="60" y1="53" x2="84" y2="53" stroke="#C026D3" stroke-width="2.5"/>
                    <!-- Jugador derecho con dorsal 10 -->
                    <circle cx="148" cy="25" r="9" fill="#FDBA74"/>
                    <path d="M132 37 Q148 33 164 37 L168 64 L128 64 Z" fill="#FFFFFF" stroke="#A21CAF" stroke-width="2.5"/>
                    <text x="148" y="54" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="13" fill="#A21CAF">10</text>
                    <!-- Copa dorada al centro -->
                    <path d="M98 28 L122 28 L119 48 Q110 55 101 48 Z" fill="#FACC15" stroke="#854D0E" stroke-width="2"/>
                    <path d="M98 31 Q90 31 90 38 Q90 44 99 44" fill="none" stroke="#FACC15" stroke-width="2.2"/>
                    <path d="M122 31 Q130 31 130 38 Q130 44 121 44" fill="none" stroke="#FACC15" stroke-width="2.2"/>
                    <rect x="107" y="52" width="6" height="8" fill="#EAB308"/>
                    <rect x="101" y="60" width="18" height="5" rx="1.5" fill="#111827"/>
                </svg>
                <span class="text-[9px] font-extrabold text-white/95 truncate z-10">Vicente Martínez · Campeones</span>
            </div>
        `;
    }
    return `
        <div class="w-full h-36 bg-gradient-to-b from-neutral-950 via-neutral-900 to-amber-900 flex flex-col justify-between p-2.5 text-white relative overflow-hidden">
            <div class="flex items-center justify-between z-10">
                <span class="px-2 py-0.5 rounded-full bg-clubOrange text-[8.5px] font-black uppercase tracking-wider">Banderazo VM</span>
                <i data-lucide="flame" class="w-4 h-4 text-orange-400"></i>
            </div>
            <svg viewBox="0 0 220 85" class="w-full h-16 my-auto z-10" xmlns="http://www.w3.org/2000/svg">
                <!-- Banderas en alto -->
                <polygon points="118,8 134,26 116,32" fill="#EC6625"/>
                <polygon points="154,12 172,28 152,35" fill="#FFFFFF"/>
                <!-- Lienzo principal naranja y blanco -->
                <rect x="26" y="34" width="168" height="22" rx="4" fill="#EC6625" stroke="#FFFFFF" stroke-width="2"/>
                <text x="110" y="48" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="9.5" fill="#FFFFFF" letter-spacing="1.5">VICENTE MARTÍNEZ</text>
                <!-- Hinchada agachada al frente -->
                <circle cx="52" cy="64" r="4.5" fill="#FDBA74"/>
                <circle cx="72" cy="63" r="4.5" fill="#FDBA74"/>
                <circle cx="94" cy="64" r="4.5" fill="#FDBA74"/>
                <circle cx="116" cy="63" r="4.5" fill="#FDBA74"/>
                <circle cx="138" cy="64" r="4.5" fill="#FDBA74"/>
                <circle cx="160" cy="63" r="4.5" fill="#FDBA74"/>
            </svg>
            <span class="text-[9px] font-extrabold text-orange-200 truncate z-10">Hinchada Naranja y Blanca</span>
        </div>
    `;
}

window.openPhotoLightbox = function(photoId) {
    if (photoId === 'field-preview') {
        const box = document.getElementById('photo-lightbox');
        const media = document.getElementById('lightbox-media');
        const title = document.getElementById('lightbox-title');
        const desc = document.getElementById('lightbox-desc');
        const tag = document.getElementById('lightbox-tag');

        if (tag) tag.textContent = 'Recinto Deportivo';
        if (title) title.textContent = `Cancha ${CONFIG.clubName}`;
        if (desc) desc.textContent = CONFIG.addressRegion;
        if (media) {
            media.innerHTML = state.customFieldPhoto
                ? `<img src="${state.customFieldPhoto}" alt="Cancha Vicente Martínez" class="w-full max-h-[55vh] object-contain mx-auto">`
                : getFieldDefaultPreviewGraphic(true);
        }
        if (box) box.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
        return;
    }
    const photo = state.clubPhotos.find(p => p.id === photoId);
    if (!photo) return;
    const box = document.getElementById('photo-lightbox');
    const media = document.getElementById('lightbox-media');
    const title = document.getElementById('lightbox-title');
    const desc = document.getElementById('lightbox-desc');
    const tag = document.getElementById('lightbox-tag');

    if (tag) tag.textContent = photo.tag || 'Galería VM';
    if (title) title.textContent = photo.title || 'Club Deportivo Vicente Martínez';
    if (desc) desc.textContent = photo.desc || '';
    if (media) {
        media.innerHTML = photo.imageUrl
            ? `<img src="${photo.imageUrl}" alt="${photo.title}" class="w-full max-h-[55vh] object-contain mx-auto">`
            : getPresetPhotoGraphic(photo.preset);
    }
    if (box) box.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
};

window.closePhotoLightbox = function() {
    const box = document.getElementById('photo-lightbox');
    if (box) box.classList.add('hidden');
};

window.copyClubText = function(text, label) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    try {
        document.execCommand('copy');
        showToast(`${label} copiado ✓`);
    } catch (e) {
        showToast(text);
    }
    document.body.removeChild(temp);
};

// ==========================================
// VISTAS PRINCIPALES (BLANCO Y NARANJA)
// ==========================================
function renderHomeView() {
    const rowsHtml = DIVISIONS_LIST.map(div => {
        const sorted = getSortedStandings(div.id);
        const rankIndex = sorted.findIndex(t => t.club === 'Vicente Martínez');
        const rankLabel = rankIndex >= 0 ? `${rankIndex + 1}°` : '-';

        return `
            <div class="flex items-center gap-2">
                <div class="flex-1 bg-gradient-to-r from-clubOrange to-clubOrangeDark text-white rounded-2xl px-3.5 py-3 shadow-sm flex items-center justify-between gap-2 border border-orange-400/40">
                    <span class="font-black text-[12px] sm:text-[13px] uppercase tracking-wider leading-tight truncate">
                        ${div.name}
                    </span>
                    <span class="shrink-0 px-2 py-0.5 rounded-lg bg-white text-clubOrange font-black text-[10.5px] shadow-2xs">
                        ${rankLabel}
                    </span>
                </div>
                <button onclick="openStandings('${div.id}')"
                        class="shrink-0 bg-clubOrange hover:bg-clubOrangeDark active:scale-95 text-white font-black text-[11px] uppercase tracking-[0.12em] px-3.5 py-3 rounded-2xl shadow-sm transition-all flex items-center gap-1 cursor-pointer">
                    Posición <i data-lucide="chevron-right" class="w-3.5 h-3.5 stroke-[2.8]"></i>
                </button>
            </div>
        `;
    }).join('');

    return `
        <div class="fade-in space-y-3.5">
            <div class="text-center space-y-1">
                <p class="text-[9.5px] font-black uppercase tracking-[0.2em] text-clubOrange">Campeonato Oficial</p>
                <div class="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-clubOrange to-clubOrangeDark text-white font-black text-xs uppercase tracking-[0.18em] shadow-md border-2 border-white">
                    <i data-lucide="trophy" class="w-3.5 h-3.5"></i> Divisiones
                </div>
            </div>

            <div class="p-3 rounded-3xl bg-white/80 border-2 border-dashed border-clubOrange/35 space-y-2.5 shadow-xs">
                ${rowsHtml}
            </div>
        </div>
    `;
}

function renderStandingsView() {
    const currentDiv = DIVISIONS_LIST.find(d => d.id === state.selectedDivisionId) || DIVISIONS_LIST[0];
    const sorted = getSortedStandings(currentDiv.id);

    const selectorPills = DIVISIONS_LIST.map(d => {
        const active = d.id === currentDiv.id;
        return `
            <button onclick="openStandings('${d.id}')"
                    class="shrink-0 px-3 py-1.5 rounded-full text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        active
                            ? 'bg-clubOrange text-white shadow-xs'
                            : 'bg-white text-gray-600 border border-orange-200 hover:border-clubOrange'
                    }">
                ${d.name}
            </button>
        `;
    }).join('');

    const tableRows = sorted.map((team, index) => {
        const isVM = team.club === 'Vicente Martínez';
        const editInputs = state.editMode ? `
            <div class="mt-2 pt-2 border-t border-orange-200/70 grid grid-cols-7 gap-1 text-center">
                ${['pj', 'pg', 'pe', 'pp', 'gf', 'dg', 'pts'].map(key => `
                    <div>
                        <label class="block text-[8px] font-black uppercase text-gray-500">${key}</label>
                        <input type="number" value="${team[key]}"
                               onchange="updateTeamField('${currentDiv.id}', '${team.club}', '${key}', this.value)"
                               class="w-full text-center bg-white border border-orange-300 rounded-lg py-1 text-[10.5px] font-black text-gray-900 focus:outline-none focus:border-clubOrange">
                    </div>
                `).join('')}
            </div>
        ` : '';

        return `
            <div class="p-2.5 rounded-2xl border transition-all ${
                isVM
                    ? 'bg-orange-50 border-clubOrange shadow-xs'
                    : 'bg-white border-gray-100'
            }">
                <div class="grid grid-cols-12 items-center text-[11px] gap-0.5">
                    <div class="col-span-1 font-black ${index < 2 ? 'text-clubOrange' : 'text-gray-500'}">
                        ${index + 1}
                    </div>
                    <div class="col-span-4 font-extrabold truncate pr-1 ${isVM ? 'text-clubOrange' : 'text-gray-900'}">
                        ${team.club}
                    </div>
                    <div class="col-span-1 text-center font-semibold text-gray-600">${team.pj}</div>
                    <div class="col-span-1 text-center font-semibold text-gray-600">${team.pg}</div>
                    <div class="col-span-1 text-center font-semibold text-gray-600">${team.pe}</div>
                    <div class="col-span-1 text-center font-semibold text-gray-600">${team.pp}</div>
                    <div class="col-span-1 text-center font-semibold text-gray-600">${team.dg > 0 ? '+' + team.dg : team.dg}</div>
                    <div class="col-span-2 text-right font-black text-xs ${isVM ? 'text-clubOrange' : 'text-gray-900'}">
                        ${team.pts} <span class="text-[8.5px] font-bold text-gray-400">pts</span>
                    </div>
                </div>
                ${editInputs}
            </div>
        `;
    }).join('');

    return `
        <div class="fade-in space-y-3">
            <div class="flex items-center justify-between gap-2">
                <button onclick="switchTab('home')" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-clubOrange font-black text-xs shadow-2xs cursor-pointer">
                    <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Divisiones
                </button>
                <span class="px-3 py-1 rounded-full bg-clubOrange text-white font-black text-[10px] uppercase tracking-wider">
                    ${currentDiv.category}
                </span>
            </div>

            <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                ${selectorPills}
            </div>

            <div class="bg-white rounded-3xl p-3.5 shadow-sm border border-orange-100 space-y-2">
                <div class="flex items-center justify-between pb-1">
                    <h2 class="text-sm font-black uppercase text-gray-900 tracking-wide">${currentDiv.name}</h2>
                    <span class="text-[10px] font-bold text-clubOrange">Asociación Villa Alemana</span>
                </div>

                <div class="grid grid-cols-12 text-[9px] font-black uppercase text-gray-400 px-2.5 pb-1 border-b border-gray-100">
                    <div class="col-span-1">#</div>
                    <div class="col-span-4">Club</div>
                    <div class="col-span-1 text-center">PJ</div>
                    <div class="col-span-1 text-center">PG</div>
                    <div class="col-span-1 text-center">PE</div>
                    <div class="col-span-1 text-center">PP</div>
                    <div class="col-span-1 text-center">DG</div>
                    <div class="col-span-2 text-right">PTS</div>
                </div>

                <div class="space-y-1.5">
                    ${tableRows}
                </div>
            </div>
        </div>
    `;
}

function renderFieldView() {
    const weekDays = getWeekDaysFor(state.selectedDate);
    const dayBookings = state.bookings.filter(b => b.date === state.selectedDate);
    const monthStats = getMonthFinancials(state.selectedMonth);

    let dayExpected = 0;
    let dayCollected = 0;
    dayBookings.forEach(b => {
        const val = Number(b.price) || 0;
        dayExpected += val;
        if (b.status === 'paid') dayCollected += val;
    });

    const adminSubTabs = state.editMode ? `
        <div class="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white border border-orange-200">
            <button onclick="setFieldSubTab('agenda')" class="py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
                state.fieldSubTab === 'agenda' ? 'bg-clubOrange text-white shadow-xs' : 'text-gray-600'
            }">
                Agenda Cancha
            </button>
            <button onclick="setFieldSubTab('treasury')" class="py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
                state.fieldSubTab === 'treasury' ? 'bg-clubOrange text-white shadow-xs' : 'text-gray-600'
            }">
                Ingresos del Mes
            </button>
        </div>
    ` : '';

    if (state.editMode && state.fieldSubTab === 'treasury') {
        const ledgerRows = monthStats.monthLedger.map(l => `
            <div class="flex items-center justify-between p-2.5 rounded-2xl bg-clubCream border border-orange-100 text-xs">
                <div>
                    <p class="font-extrabold text-gray-900">${l.concept}</p>
                    <p class="text-[10px] text-gray-500">${l.date} · ${l.type === 'income' ? 'Ingreso extra' : 'Gasto / Egreso'}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-black ${l.type === 'income' ? 'text-emerald-600' : 'text-red-600'}">
                        ${l.type === 'income' ? '+' : '-'}${formatCLP(l.amount)}
                    </span>
                    <button onclick="deleteLedgerEntry('${l.id}')" class="p-1.5 rounded-lg bg-red-50 text-red-600 cursor-pointer">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
        `).join('');

        return `
            <div class="fade-in space-y-3.5">
                ${adminSubTabs}

                <div class="bg-clubCarbon text-white rounded-3xl p-4 shadow-md space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[10px] font-black uppercase tracking-wider text-clubOrange">Rendición Mensual · Solo Admin</p>
                            <h3 class="text-base font-black">Balance del Mes</h3>
                        </div>
                        <input type="month" value="${state.selectedMonth}" onchange="changeTreasuryMonth(this.value)"
                               class="bg-white/10 text-white text-xs font-extrabold px-2.5 py-1.5 rounded-xl border border-white/15 focus:outline-none">
                    </div>

                    <div class="grid grid-cols-2 gap-2.5">
                        <div class="p-3 rounded-2xl bg-white/10">
                            <p class="text-[10px] text-gray-300 font-bold">Total Cobrado</p>
                            <p class="text-lg font-black text-clubOrange">${formatCLP(monthStats.collected)}</p>
                        </div>
                        <div class="p-3 rounded-2xl bg-white/10">
                            <p class="text-[10px] text-gray-300 font-bold">Por Cobrar</p>
                            <p class="text-lg font-black text-amber-300">${formatCLP(monthStats.pending)}</p>
                        </div>
                    </div>

                    <div class="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                        <span class="text-gray-300">Gastos registrados: <strong class="text-red-400">-${formatCLP(monthStats.expenses)}</strong></span>
                        <span class="font-black text-emerald-400">Neto: ${formatCLP(monthStats.net)}</span>
                    </div>
                </div>

                <div class="bg-white rounded-3xl p-4 border border-orange-100 shadow-xs space-y-2.5">
                    <h4 class="text-xs font-black uppercase text-gray-900">Registrar Ingreso o Gasto del Club</h4>
                    <div class="grid grid-cols-3 gap-2">
                        <select id="ledger-type-select" class="bg-clubCream border border-orange-200 rounded-xl px-2 py-2 text-xs font-extrabold text-gray-900">
                            <option value="income">+ Ingreso</option>
                            <option value="expense">- Gasto</option>
                        </select>
                        <input type="number" id="ledger-amount-input" placeholder="Monto $"
                               class="col-span-2 bg-clubCream border border-orange-200 rounded-xl px-3 py-2 text-xs font-black text-gray-900">
                    </div>
                    <div class="flex gap-2">
                        <input type="text" id="ledger-concept-input" placeholder="Concepto (Ej: Cuotas socios, pelotas, luz)"
                               class="flex-1 bg-clubCream border border-orange-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900">
                        <button onclick="addLedgerEntry()" class="px-4 py-2 rounded-xl bg-clubOrange text-white font-black text-xs cursor-pointer">
                            Guardar
                        </button>
                    </div>
                    <div class="space-y-1.5 pt-1">
                        ${ledgerRows || '<p class="text-[11px] text-gray-400 text-center py-2">Sin movimientos extra en este mes.</p>'}
                    </div>
                </div>
            </div>
        `;
    }

    const weekStripHtml = weekDays.map(d => {
        const isSelected = d.dateStr === state.selectedDate;
        return `
            <button onclick="selectFieldDate('${d.dateStr}')"
                    class="flex flex-col items-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
                        isSelected
                            ? 'bg-clubOrange text-white shadow-sm scale-105'
                            : 'bg-white text-gray-700 border border-orange-100 hover:border-clubOrange'
                    }">
                <span class="text-[9.5px] font-bold ${isSelected ? 'text-orange-100' : 'text-gray-400'}">${d.dayName}</span>
                <span class="text-sm font-black mt-0.5">${d.dayNum}</span>
            </button>
        `;
    }).join('');

    const adminDaySummaryCard = state.editMode ? `
        <div class="bg-clubCarbon text-white rounded-3xl p-4 shadow-md flex items-center justify-between">
            <div>
                <p class="text-[10.5px] text-gray-300 font-semibold">Debió entrar el ${getShortSpanishDateLabel(state.selectedDate)}</p>
                <p class="text-2xl font-black text-clubOrange mt-0.5">${formatCLP(dayExpected)}</p>
            </div>
            <div class="text-right">
                <p class="text-[10.5px] text-gray-300 font-semibold">Cobrado</p>
                <p class="text-lg font-black text-white mt-0.5">${formatCLP(dayCollected)}</p>
                <p class="text-[10px] text-gray-400">${dayBookings.length} arriendo(s)</p>
            </div>
        </div>
    ` : `
        <div class="bg-white rounded-2xl p-3 border border-orange-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-orange-100 text-clubOrange flex items-center justify-center">
                    <i data-lucide="clock" class="w-4 h-4"></i>
                </div>
                <div>
                    <p class="text-xs font-black text-gray-900">Horario Cancha: 08:00 a 20:00 hrs</p>
                    <p class="text-[10.5px] text-gray-500">Valor arriendo: <strong class="text-clubOrange">${CONFIG.fieldPriceLabel}</strong> por hora</p>
                </div>
            </div>
        </div>
    `;

    const slotsHtml = FIELD_HOURS.map(hour => {
        const booking = dayBookings.find(b => b.hour === hour);
        if (!booking) {
            return `
                <div class="bg-white rounded-2xl px-3.5 py-2.5 border border-orange-100 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-black text-gray-900 w-11">${hour}</span>
                        <span class="text-xs font-semibold text-gray-400">Libre</span>
                    </div>
                    <button onclick="openBookingModal('${hour}')"
                            class="text-clubOrange hover:text-clubOrangeDark font-black text-xs flex items-center gap-1 cursor-pointer">
                        + Arrendar
                    </button>
                </div>
            `;
        }

        const statusBadge = state.editMode
            ? `
                <div class="flex items-center gap-1.5">
                    <button onclick="toggleBookingPaidStatus('${booking.id}')"
                            class="px-2.5 py-1 rounded-full text-[10px] font-black cursor-pointer ${
                                booking.status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                            }">
                        ${booking.status === 'paid' ? 'Pagado' : 'Por cobrar'}
                    </button>
                    <button onclick="deleteBooking('${booking.id}')" class="p-1 rounded-lg bg-red-50 text-red-600 cursor-pointer">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            `
            : `
                <span class="px-2.5 py-1 rounded-full bg-orange-100 text-clubOrange text-[10px] font-black">
                    Reservado
                </span>
            `;

        return `
            <div class="bg-white rounded-2xl px-3.5 py-2.5 border border-clubOrange/35 flex items-center justify-between gap-2 shadow-2xs">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="text-xs font-black text-clubOrange w-11 shrink-0">${hour}</span>
                    <div class="min-w-0">
                        <p class="text-xs font-black text-gray-900 truncate">${booking.team}</p>
                        <p class="text-[10px] text-gray-500 truncate">${booking.type}${state.editMode ? ' · ' + formatCLP(booking.price) : ''}</p>
                    </div>
                </div>
                ${statusBadge}
            </div>
        `;
    }).join('');

    return `
        <div class="fade-in space-y-3.5">
            ${adminSubTabs}

            <div class="flex items-center justify-between gap-2">
                <button onclick="shiftFieldWeek(-7)" class="p-2 rounded-xl bg-white border border-orange-200 text-clubOrange cursor-pointer">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <input type="date" value="${state.selectedDate}" onchange="selectFieldDate(this.value)"
                       class="bg-white border border-orange-200 rounded-xl px-3 py-1.5 text-xs font-black text-gray-900 focus:outline-none focus:border-clubOrange">
                <button onclick="shiftFieldWeek(7)" class="p-2 rounded-xl bg-white border border-orange-200 text-clubOrange cursor-pointer">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="grid grid-cols-7 gap-1.5">
                ${weekStripHtml}
            </div>

            ${adminDaySummaryCard}

            <div class="space-y-2">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-xs font-black uppercase text-gray-900">Horarios Disponibles</h3>
                    <span class="text-[10px] font-bold text-clubOrange">${CONFIG.fieldPriceLabel} / hora</span>
                </div>
                <div class="space-y-2">
                    ${slotsHtml}
                </div>
            </div>

            <button onclick="openBookingModal()"
                    class="w-full py-3.5 rounded-2xl bg-clubOrange hover:bg-clubOrangeDark text-white font-black text-xs uppercase tracking-wider shadow-md cursor-pointer">
                + Nuevo Arriendo de Cancha
            </button>
        </div>
    `;
}

function renderClubView() {
    const presidentAvatar = state.customPresidentPhoto
        ? `<img src="${state.customPresidentPhoto}" alt="${state.presidentName}" class="w-full h-full object-cover">`
        : `<div class="w-full h-full bg-gradient-to-br from-clubOrange to-clubOrangeDark text-white flex items-center justify-center font-black text-2xl">RM</div>`;

    const directivaCards = state.directiva.map(member => {
        const avatar = member.photo
            ? `<img src="${member.photo}" alt="${member.name}" class="w-full h-full object-cover">`
            : `<i data-lucide="user" class="w-5 h-5 text-clubOrange"></i>`;

        return `
            <div class="bg-white rounded-2xl p-3 border border-orange-100 shadow-2xs flex items-center gap-3">
                <div class="relative w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center overflow-hidden shrink-0">
                    ${avatar}
                    ${state.editMode ? `
                        <label class="absolute inset-0 bg-black/50 text-white flex items-center justify-center cursor-pointer">
                            <i data-lucide="camera" class="w-4 h-4"></i>
                            <input type="file" accept="image/*" class="hidden" onchange="handleImageUpload(event, 'directiva', '${member.id}')">
                        </label>
                    ` : ''}
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                    ${state.editMode ? `
                        <input type="text" value="${member.role}" onchange="updateDirectivaItem('${member.id}', 'role', this.value)"
                               class="w-full text-[10px] font-black uppercase text-clubOrange bg-orange-50 rounded-lg px-2 py-0.5">
                        <input type="text" value="${member.name}" onchange="updateDirectivaItem('${member.id}', 'name', this.value)"
                               class="w-full text-xs font-extrabold text-gray-900 bg-clubCream rounded-lg px-2 py-1">
                    ` : `
                        <p class="text-[10px] font-black uppercase tracking-wider text-clubOrange">${member.role}</p>
                        <p class="text-xs font-extrabold text-gray-900 truncate">${member.name}</p>
                    `}
                </div>
                ${state.editMode ? `
                    <button onclick="removeDirectivaItem('${member.id}')" class="p-1.5 rounded-xl bg-red-50 text-red-600 cursor-pointer">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');

    const logrosCards = state.logros.map(l => `
        <div class="bg-white rounded-2xl p-3.5 border border-orange-100 shadow-2xs space-y-1">
            <div class="flex items-center justify-between gap-2">
                ${state.editMode ? `
                    <input type="text" value="${l.year}" onchange="updateLogroItem('${l.id}', 'year', this.value)"
                           class="w-16 px-2 py-0.5 rounded-full bg-clubOrange text-white font-black text-[10px] text-center">
                    <button onclick="removeLogroItem('${l.id}')" class="p-1 rounded-lg bg-red-50 text-red-600 cursor-pointer">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                ` : `
                    <span class="px-2.5 py-0.5 rounded-full bg-clubOrange text-white font-black text-[10px]">${l.year}</span>
                    <i data-lucide="award" class="w-4 h-4 text-clubOrange"></i>
                `}
            </div>
            ${state.editMode ? `
                <input type="text" value="${l.title}" onchange="updateLogroItem('${l.id}', 'title', this.value)"
                       class="w-full text-xs font-black text-gray-900 bg-clubCream rounded-xl px-2.5 py-1">
                <textarea rows="2" onchange="updateLogroItem('${l.id}', 'desc', this.value)"
                          class="w-full text-[11px] text-gray-600 bg-clubCream rounded-xl px-2.5 py-1">${l.desc}</textarea>
            ` : `
                <h4 class="text-xs font-black text-gray-900">${l.title}</h4>
                <p class="text-[11px] text-gray-600 leading-relaxed">${l.desc}</p>
            `}
        </div>
    `).join('');

    return `
        <div class="fade-in space-y-4">
            <!-- Presidencia -->
            <div class="bg-white rounded-3xl p-4 border-2 border-clubOrange/30 shadow-sm space-y-3">
                <div class="flex items-center justify-between">
                    <span class="px-2.5 py-0.5 rounded-full bg-clubOrange text-white font-black text-[10px] uppercase tracking-wider">
                        Presidencia
                    </span>
                    <i data-lucide="shield" class="w-4 h-4 text-clubOrange"></i>
                </div>

                <div class="flex items-center gap-3.5">
                    <div class="relative w-20 h-20 rounded-full border-2 border-clubOrange overflow-hidden shrink-0 shadow-sm">
                        ${presidentAvatar}
                        ${state.editMode ? `
                            <label class="absolute inset-0 bg-black/50 text-white flex items-center justify-center cursor-pointer">
                                <i data-lucide="camera" class="w-5 h-5"></i>
                                <input type="file" accept="image/*" class="hidden" onchange="handleImageUpload(event, 'president')">
                            </label>
                        ` : ''}
                    </div>

                    <div class="flex-1 min-w-0 space-y-1">
                        ${state.editMode ? `
                            <input type="text" value="${state.presidentRole}" onchange="updatePresidentInfo('presidentRole', this.value)"
                                   class="w-full text-[10px] font-black uppercase text-clubOrange bg-orange-50 rounded-lg px-2 py-0.5">
                            <input type="text" value="${state.presidentName}" onchange="updatePresidentInfo('presidentName', this.value)"
                                   class="w-full text-xs font-black text-gray-900 bg-clubCream rounded-lg px-2 py-1">
                        ` : `
                            <p class="text-[10px] font-black uppercase tracking-wider text-clubOrange">${state.presidentRole}</p>
                            <h3 class="text-sm font-black text-gray-900 leading-snug">${state.presidentName}</h3>
                            <p class="text-[10.5px] text-gray-500 font-medium">Club Deportivo Vicente Martínez</p>
                        `}
                    </div>
                </div>
            </div>

            <!-- Directiva -->
            <div class="space-y-2">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-xs font-black uppercase tracking-wider text-gray-900">Directiva del Club</h3>
                    ${state.editMode ? `
                        <button onclick="addDirectivaItem()" class="px-3 py-1 rounded-xl bg-clubOrange text-white font-black text-[10px] cursor-pointer">
                            + Añadir Cargo
                        </button>
                    ` : ''}
                </div>
                <div class="space-y-2">
                    ${directivaCards}
                </div>
            </div>

            <!-- Logros y Palmarés -->
            <div class="space-y-2">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-xs font-black uppercase tracking-wider text-gray-900">Logros y Palmarés</h3>
                    ${state.editMode ? `
                        <button onclick="addLogroItem()" class="px-3 py-1 rounded-xl bg-clubOrange text-white font-black text-[10px] cursor-pointer">
                            + Añadir Logro
                        </button>
                    ` : ''}
                </div>
                <div class="space-y-2">
                    ${logrosCards}
                </div>
            </div>
        </div>
    `;
}

function getFieldDefaultPreviewGraphic(isLarge = false) {
    const heightClass = isLarge ? 'h-64' : 'h-40';
    return `
        <div class="w-full ${heightClass} relative overflow-hidden bg-gradient-to-b from-sky-500 via-amber-200 to-amber-700 flex flex-col justify-between p-3 select-none">
            <!-- Cielo y cordillera de Villa Alemana -->
            <div class="flex items-center justify-between z-10">
                <span class="px-2.5 py-0.5 rounded-full bg-black/65 text-white text-[9.5px] font-black uppercase tracking-wider backdrop-blur-xs">
                    Vista Previa Cancha
                </span>
                <span class="px-2 py-0.5 rounded-full bg-clubOrange text-white text-[9px] font-black uppercase">
                    Villa Alemana
                </span>
            </div>
            <!-- Silueta cerros y focos -->
            <svg viewBox="0 0 400 160" preserveAspectRatio="none" class="absolute inset-0 w-full h-full">
                <defs>
                    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#0284C7"/>
                        <stop offset="55%" stop-color="#7DD3FC"/>
                        <stop offset="100%" stop-color="#FDE68A"/>
                    </linearGradient>
                    <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#D97706"/>
                        <stop offset="45%" stop-color="#B45309"/>
                        <stop offset="100%" stop-color="#78350F"/>
                    </linearGradient>
                </defs>
                <rect width="400" height="90" fill="url(#skyGrad)"/>
                <path d="M0 72 Q65 44 135 66 T280 56 T400 68 L400 95 L0 95 Z" fill="#15803D" opacity="0.75"/>
                <path d="M0 78 Q100 58 210 74 T400 72 L400 95 L0 95 Z" fill="#166534"/>
                <!-- Cancha -->
                <rect y="84" width="400" height="76" fill="url(#pitchGrad)"/>
                <!-- Líneas blancas de cancha en perspectiva -->
                <polygon points="55,92 345,92 385,154 15,154" fill="none" stroke="#FFFFFF" stroke-width="2.2" opacity="0.9"/>
                <line x1="200" y1="92" x2="200" y2="154" stroke="#FFFFFF" stroke-width="2" opacity="0.9"/>
                <ellipse cx="200" cy="121" rx="34" ry="12" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.9"/>
                <!-- Arco izquierdo y derecho -->
                <rect x="44" y="106" width="14" height="26" fill="none" stroke="#FFFFFF" stroke-width="2"/>
                <rect x="342" y="106" width="14" height="26" fill="none" stroke="#FFFFFF" stroke-width="2"/>
                <!-- Torre iluminación -->
                <line x1="88" y1="42" x2="88" y2="86" stroke="#1F2937" stroke-width="3"/>
                <rect x="78" y="38" width="20" height="7" rx="1.5" fill="#F9FAFB" stroke="#1F2937" stroke-width="1.5"/>
                <line x1="312" y1="42" x2="312" y2="86" stroke="#1F2937" stroke-width="3"/>
                <rect x="302" y="38" width="20" height="7" rx="1.5" fill="#F9FAFB" stroke="#1F2937" stroke-width="1.5"/>
            </svg>
            <div class="relative z-10 flex items-center justify-between text-white drop-shadow">
                <span class="text-[11px] font-black">Cancha Oficial Vicente Martínez</span>
                <span class="text-[9.5px] font-bold bg-black/45 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <i data-lucide="maximize-2" class="w-3 h-3"></i> Ampliar
                </span>
            </div>
        </div>
    `;
}

function renderLocationView() {
    const fieldPreviewMedia = state.customFieldPhoto
        ? `
            <div onclick="openPhotoLightbox('field-preview')" class="relative w-full h-44 cursor-pointer group">
                <img src="${state.customFieldPhoto}" alt="Cancha Club Deportivo Vicente Martínez" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25 flex flex-col justify-between p-3">
                    <div class="flex items-center justify-between">
                        <span class="px-2.5 py-0.5 rounded-full bg-clubOrange text-white text-[9.5px] font-black uppercase tracking-wider shadow-xs">
                            Recinto Oficial
                        </span>
                        <span class="px-2 py-0.5 rounded-full bg-black/60 text-white text-[9.5px] font-bold flex items-center gap-1">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i> Ver foto
                        </span>
                    </div>
                    <p class="text-white text-xs font-black">Cancha ${CONFIG.addressShort}</p>
                </div>
            </div>
        `
        : `<div onclick="openPhotoLightbox('field-preview')" class="cursor-pointer">${getFieldDefaultPreviewGraphic(false)}</div>`;

    return `
        <div class="fade-in space-y-4">
            <div class="bg-white rounded-3xl overflow-hidden border border-orange-100 shadow-sm">
                <!-- Vista Previa Fotográfica de la Cancha -->
                <div class="relative">
                    ${fieldPreviewMedia}
                    ${state.editMode ? `
                        <label class="absolute bottom-3 right-3 z-20 px-3 py-1.5 rounded-xl bg-clubOrange hover:bg-clubOrangeDark text-white font-black text-[10.5px] shadow-lg border border-white/40 flex items-center gap-1.5 cursor-pointer">
                            <i data-lucide="camera" class="w-3.5 h-3.5"></i> Subir Foto Cancha
                            <input type="file" accept="image/*" class="hidden" onchange="handleImageUpload(event, 'fieldPhoto')">
                        </label>
                    ` : ''}
                </div>

                <div class="p-4 space-y-3">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-2xl bg-clubOrange text-white flex items-center justify-center shrink-0 shadow-xs">
                            <i data-lucide="map-pin" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <span class="text-[10px] font-black uppercase tracking-wider text-clubOrange">Cancha Oficial</span>
                            <h2 class="text-sm font-black text-gray-900">${CONFIG.addressShort.split(',')[0]}</h2>
                            <p class="text-[11px] text-gray-500">Villa Alemana, Región de Valparaíso, Chile</p>
                        </div>
                    </div>

                    <div class="rounded-2xl border border-orange-200 bg-orange-50/60 p-3.5 text-center space-y-2.5">
                        <p class="text-xs font-bold text-gray-700">¿Cómo llegar a la cancha del Club Vicente Martínez?</p>
                        <div class="grid grid-cols-2 gap-2">
                            <a href="https://maps.app.goo.gl/Jz7Ug5MX1mBdJ5cT8" target="_blank" rel="noopener noreferrer"
                               class="py-2.5 px-3 rounded-xl bg-clubOrange hover:bg-clubOrangeDark text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs">
                                <i data-lucide="map" class="w-3.5 h-3.5"></i> Google Maps
                            </a>
                            <a href="https://waze.com/ul?q=${encodeURIComponent(CONFIG.addressShort)}" target="_blank" rel="noopener noreferrer"
                               class="py-2.5 px-3 rounded-xl bg-clubCarbon text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs">
                                <i data-lucide="compass" class="w-3.5 h-3.5"></i> Abrir Waze
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-3xl p-4 border border-orange-100 shadow-sm space-y-3">
                <h3 class="text-xs font-black uppercase tracking-wider text-gray-900">Contacto Institucional</h3>
                <div class="p-3 rounded-2xl bg-clubCream border border-orange-100 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[10px] font-black uppercase text-clubOrange">Correo Oficial</p>
                        <p class="text-xs font-extrabold text-gray-900 truncate">${CONFIG.email}</p>
                    </div>
                    <button onclick="copyClubText('${CONFIG.email}', 'Correo')"
                            class="px-3 py-1.5 rounded-xl bg-clubOrange text-white font-black text-[11px] shrink-0 cursor-pointer">
                        Copiar
                    </button>
                </div>

                <div class="p-3 rounded-2xl bg-clubCream border border-orange-100 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[10px] font-black uppercase text-clubOrange">Dirección Sede & Cancha</p>
                        <p class="text-xs font-extrabold text-gray-900 truncate">${CONFIG.addressShort}</p>
                    </div>
                    <button onclick="copyClubText('${CONFIG.addressFull}', 'Dirección')"
                            class="px-3 py-1.5 rounded-xl bg-white border border-orange-200 text-clubOrange font-black text-[11px] shrink-0 cursor-pointer">
                        Copiar
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderNewsView() {
    const photosHtml = state.clubPhotos.map(p => {
        const media = p.imageUrl
            ? `<img src="${p.imageUrl}" alt="${p.title}" class="w-full h-36 object-cover">`
            : getPresetPhotoGraphic(p.preset);

        return `
            <div class="bg-white rounded-2xl overflow-hidden border border-orange-100 shadow-xs flex flex-col">
                <div onclick="openPhotoLightbox('${p.id}')" class="cursor-pointer relative">
                    ${media}
                    <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/65 text-white text-[9px] font-black uppercase">
                        ${p.tag || 'Galería VM'}
                    </span>
                </div>
                <div class="p-2.5 flex-1 flex flex-col justify-between gap-2">
                    ${state.editMode ? `
                        <input type="text" value="${p.title}" onchange="updateClubPhotoTitle('${p.id}', this.value)"
                               class="w-full text-[11px] font-extrabold text-gray-900 bg-clubCream rounded-lg px-2 py-1">
                        <div class="flex items-center gap-1.5">
                            <label class="flex-1 py-1.5 rounded-lg bg-clubOrange text-white font-black text-[10px] text-center cursor-pointer">
                                Cambiar Foto
                                <input type="file" accept="image/*" class="hidden" onchange="handleImageUpload(event, 'clubPhoto', '${p.id}')">
                            </label>
                            <button onclick="removeClubPhoto('${p.id}')" class="p-1.5 rounded-lg bg-red-50 text-red-600 cursor-pointer">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    ` : `
                        <p onclick="openPhotoLightbox('${p.id}')" class="text-[11px] font-extrabold text-gray-900 leading-snug cursor-pointer">
                            ${p.title}
                        </p>
                    `}
                </div>
            </div>
        `;
    }).join('');

    const newsHtml = state.noticias.map(n => `
        <div class="bg-white rounded-3xl p-4 border border-orange-100 shadow-xs space-y-2">
            <div class="flex items-center justify-between gap-2">
                ${state.editMode ? `
                    <input type="text" value="${n.tag}" onchange="updateNoticiaItem('${n.id}', 'tag', this.value)"
                           class="px-2.5 py-0.5 rounded-full bg-orange-100 text-clubOrange font-black text-[10px] w-28">
                    <input type="text" value="${n.date}" onchange="updateNoticiaItem('${n.id}', 'date', this.value)"
                           class="text-[10px] font-bold text-gray-500 bg-clubCream rounded-lg px-2 py-0.5 w-28 text-right">
                    <button onclick="removeNoticiaItem('${n.id}')" class="p-1 rounded-lg bg-red-50 text-red-600 cursor-pointer">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                ` : `
                    <span class="px-2.5 py-0.5 rounded-full bg-orange-100 text-clubOrange font-black text-[10px] uppercase">${n.tag}</span>
                    <span class="text-[10px] font-bold text-gray-400">${n.date}</span>
                `}
            </div>
            ${state.editMode ? `
                <input type="text" value="${n.title}" onchange="updateNoticiaItem('${n.id}', 'title', this.value)"
                       class="w-full text-xs font-black text-gray-900 bg-clubCream rounded-xl px-2.5 py-1.5">
                <textarea rows="3" onchange="updateNoticiaItem('${n.id}', 'body', this.value)"
                          class="w-full text-xs text-gray-600 bg-clubCream rounded-xl px-2.5 py-1.5">${n.body}</textarea>
            ` : `
                <h4 class="text-sm font-black text-gray-900">${n.title}</h4>
                <p class="text-xs text-gray-600 leading-relaxed">${n.body}</p>
            `}
        </div>
    `).join('');

    return `
        <div class="fade-in space-y-4">
            <!-- Galería Fotos del Club -->
            <div class="space-y-2">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-xs font-black uppercase tracking-wider text-gray-900">Fotos del Club</h3>
                    ${state.editMode ? `
                        <label class="px-3 py-1 rounded-xl bg-clubOrange text-white font-black text-[10px] cursor-pointer">
                            + Añadir Foto
                            <input type="file" accept="image/*" class="hidden" onchange="handleImageUpload(event, 'newClubPhoto')">
                        </label>
                    ` : ''}
                </div>
                <div class="grid grid-cols-2 gap-2.5">
                    ${photosHtml}
                </div>
            </div>

            <!-- Avisos y Comunicados -->
            <div class="space-y-2.5">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-xs font-black uppercase tracking-wider text-gray-900">Avisos y Comunicados</h3>
                    ${state.editMode ? `
                        <button onclick="addNoticiaItem()" class="px-3 py-1 rounded-xl bg-clubOrange text-white font-black text-[10px] cursor-pointer">
                            + Nuevo Aviso
                        </button>
                    ` : ''}
                </div>
                <div class="space-y-2.5">
                    ${newsHtml}
                </div>
            </div>
        </div>
    `;
}

function render() {
    const main = document.getElementById('main-content');
    if (!main) return;

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-clubOrange');
        btn.classList.add('text-gray-400');
    });

    const activeNavId = state.activeTab === 'standings' ? 'nav-home' : `nav-${state.activeTab}`;
    const activeNavEl = document.getElementById(activeNavId);
    if (activeNavEl) {
        activeNavEl.classList.remove('text-gray-400');
        activeNavEl.classList.add('text-clubOrange');
    }

    if (state.activeTab === 'home') main.innerHTML = renderHomeView();
    else if (state.activeTab === 'standings') main.innerHTML = renderStandingsView();
    else if (state.activeTab === 'field') main.innerHTML = renderFieldView();
    else if (state.activeTab === 'club') main.innerHTML = renderClubView();
    else if (state.activeTab === 'location') main.innerHTML = renderLocationView();
    else if (state.activeTab === 'news') main.innerHTML = renderNewsView();

    syncAdminModalUI();
    if (window.lucide) lucide.createIcons();
}

loadLocalBackup();
applyCustomCrest();
render();
initCloudSync();
// Rellena los textos fijos del index.html con lo definido en config.js
document.querySelectorAll('[data-cfg]').forEach(el => { el.textContent = CONFIG[el.dataset.cfg]; });
document.querySelectorAll('[data-cfg-value]').forEach(el => { el.value = CONFIG[el.dataset.cfgValue]; });
