// odontograma.js - Sonalía Odontograma (mejorado)
// =================================================

// ===== CONFIG BD =====
let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
}
let currentPacienteId = null;
const PEDIATRIC_MAX_YEARS = 12;

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve(null);
      if (db.get && db.get.length >= 3) db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
      else if (db.get) db.get(sql, params).then(resolve).catch(reject);
      else resolve(null);
    } catch (e) { reject(e); }
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve([]);
      if (db.all && db.all.length >= 3) db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      else if (db.all) db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
      else resolve([]);
    } catch (e) { reject(e); }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve();
      // standard sqlite3 callback matches (err) => ... BUT the callback is 'function(err) {}' to access this.lastID
      if (db.run && db.run.length >= 3) {
        db.run(sql, params, function(err) {
          if (err) return reject(err);
          resolve(this ? this.lastID : undefined);
        });
      }
      else if (db.run) {
        db.run(sql, params).then(result => {
          // Some wrappers return { lastID }
          resolve(result?.lastID || result?.id);
        }).catch(reject);
      }
      else resolve();
    } catch (e) { reject(e); }
  });
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  if (value !== null && value !== '') return value;
  if (window.parent && window.parent !== window) {
    const parentParams = new URLSearchParams(window.parent.location.search);
    const parentValue = parentParams.get(name);
    if (parentValue !== null && parentValue !== '') return parentValue;
  }
  return null;
}

function calculateAgeYears(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years -= 1;
  }
  return years;
}

// ===== BRAND (Application Colors) =====
const BRAND = {
  bg: "#F8F7F7",
  ink: "#0F2532",
  primary: "#4EABBE",
  accent: "#8BCFDD",
  dark: "#1D5D69",
  ring: "rgba(78,171,190,.18)",
};

const ICONS = {
  tooth: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3c-3 0-5.5 2.2-5.5 5 0 1.6.7 3 1.8 4 .7.6 1.1 1.5 1.3 2.5.3 1.6 1 3.5 2.4 3.5 1.2 0 1.9-1.1 2-2.6.1 1.5.8 2.6 2 2.6 1.4 0 2.1-1.9 2.4-3.5.2-1 .6-1.9 1.3-2.5 1.1-1 1.8-2.4 1.8-4 0-2.8-2.5-5-5.5-5-.9 0-1.7.3-2.4.8-.4.3-.9.3-1.3 0C13.7 3.3 12.9 3 12 3z" /></svg>',
  plus: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>',
  drop: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3s-5 5.2-5 9a5 5 0 0010 0c0-3.8-5-9-5-9z" /></svg>',
  circle: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" stroke-width="2" /></svg>',
  bolt: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>',
  alert: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.65 18h16.7a1 1 0 00.86-1.5l-7.5-13a1 1 0 00-1.72 0z" /></svg>',
  x: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>',
  check: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',
  star: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.364 1.118l1.519 4.674c.3.921-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.519-4.674a1 1 0 00-.364-1.118L2.98 9.101c-.783-.57-.38-1.81.588-1.81h4.915a1 1 0 00.95-.69l1.519-4.674z" /></svg>',
  link: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m1.172-1.172a4 4 0 015.656 0l1.5 1.5" /></svg>',
  pin: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.5 12.5l-5.5 5.5a3 3 0 01-4.243-4.243l7.5-7.5a1.5 1.5 0 112.121 2.121l-7 7a.5.5 0 01-.707-.707l6.5-6.5" /></svg>',
  clipboard: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5a2 2 0 002 2h2a2 2 0 002-2" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6M9 16h6" /></svg>',
  adjust: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16M14 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>',
  square: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" stroke-width="2" /></svg>',
  chevronLeft: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 18l-6-6 6-6" /></svg>',
  chevronRight: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 6l6 6-6 6" /></svg>',
  chevronUp: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 15l-6-6-6 6" /></svg>',
  chevronDown: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6" /></svg>'
};

// ===== ESTADO =====
let selectedTooth = null;
let teethStatus = {};
let showAdultTeeth = true;
let showSurfaceModal = false;
let selectedSurfaces = {};
let currentTreatment = null;
let diagnosticsState = {};
let dxContext = { tooth: null, face: null };
let dxCount = 0;
let toothImages = {};
let recentDxFeedback = { tooth: null, key: null };

// ===== DATA =====
const adultTeeth = {
  superior: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  inferior: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
};

const childTeeth = {
  superior: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  inferior: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
};

// Treatments: dejé profilaxis con tu primary/accent para que “huela” a Sonalía
let treatments = [
  { id: "profilaxis-simple", name: "Profilaxis Simple", color: BRAND.primary, icon: ICONS.plus },
  { id: "profilaxis-profunda", name: "Profilaxis Profunda", color: "#2C93A8", icon: ICONS.drop },

  { id: "caries", name: "Lesión de Caries", color: "#EF4444", icon: ICONS.circle },
  { id: "pulpar", name: "Infección Pulpar", color: "#F97316", icon: ICONS.bolt },
  { id: "fractura", name: "Fractura", color: "#EAB308", icon: ICONS.alert },
  { id: "ausente", name: "Ausente", color: "#6B7280", icon: ICONS.x },
  { id: "restauracion", name: "Restauración", color: "#10B981", icon: ICONS.check },
  { id: "endodoncia", name: "Endodoncia", color: "#A855F7", icon: ICONS.bolt },
  { id: "corona", name: "Corona", color: "#FBBF24", icon: ICONS.star },
  { id: "implante", name: "Implante", color: "#059669", icon: ICONS.link },
  { id: "perno", name: "Perno Muñón", color: "#374151", icon: ICONS.pin },
];

const FACE_LABELS = {
  oclusal: "Oclusal",
  mesial: "Mesial",
  distal: "Distal",
  vestibular: "Vestibular",
  lingual: "Lingual",
};

const DIAGNOSES = [
  // target:"tooth"  → Afecta la pieza entera; se guarda en state.tooth
  { id: "crown-ok",  name: "Corona",              cssClass: "tooth-crown-ok",  target: "tooth", status: "Realizado", color: "#3b82f6", icon: ICONS.star },
  { id: "crown-bad", name: "Corona (Mal Estado)",  cssClass: "tooth-crown-bad", target: "tooth", status: "Pendiente", color: "#ef4444", icon: ICONS.alert },
  { id: "absent",    name: "Ausente",              cssClass: "tooth-absent",    target: "tooth", status: "Pendiente", color: "#6b7280", icon: ICONS.x },

  // target:"face"   → Afecta una o más caras puntuales; se guarda en state.faces[cara]
  { id: "caries-dx", name: "Caries",                     cssClass: "state-caries",   target: "face", status: "Pendiente", color: "#ef4444", icon: ICONS.circle },
  { id: "rest-ok",   name: "Restauración",               cssClass: "state-rest-ok",  target: "face", status: "Realizado", color: "#3b82f6", icon: ICONS.check },
  { id: "rest-bad",  name: "Restauración (Mal Estado)",  cssClass: "state-rest-bad", target: "face", status: "Pendiente", color: "#f97316", icon: ICONS.alert },
  { id: "sealant",   name: "Sellante",                   cssClass: "state-sealant",  target: "face", status: "Realizado", color: "#facc15", icon: ICONS.square },
  { id: "amalgam",   name: "Amalgama",                   cssClass: "state-amalgam",  target: "face", status: "Realizado", color: "#0f172a", icon: ICONS.square },
  { id: "sano",      name: "Sano",                       cssClass: "clean",          target: "face", status: "Realizado", color: "#10b981", icon: ICONS.check },

  // target:"whole"  → Afecta la pieza completa visualmente (overlay); se guarda en state.tooth (face=null en BD)
  { id: "endo",      name: "Endodoncia",       cssClass: "state-endo",    target: "whole", status: "Realizado", color: "#a855f7", icon: ICONS.bolt },
  { id: "implante",  name: "Implante",         cssClass: "state-implante",target: "whole", status: "Realizado", color: "#059669", icon: ICONS.link },
  { id: "perno",     name: "Perno Muñón",      cssClass: "state-perno",   target: "whole", status: "Realizado", color: "#0f172a", icon: ICONS.pin },
  { id: "fractura",  name: "Fractura",         cssClass: "state-fractura",target: "whole", status: "Pendiente", color: "#f59e0b", icon: ICONS.alert },
  { id: "pulpar",    name: "Infección Pulpar", cssClass: "state-pulpar",  target: "whole", status: "Pendiente", color: "#f87171", icon: ICONS.bolt },
  { id: "movilidad", name: "Movilidad",        cssClass: "state-mov",     target: "whole", status: "Pendiente", color: "#0ea5e9", icon: ICONS.adjust },
  { id: "resto",     name: "Resto Radicular",  cssClass: "state-resto",   target: "whole", status: "Pendiente", color: "#0f172a", icon: ICONS.x },
  { id: "erupcion",  name: "Sin Erupcionar",   cssClass: "state-erup",    target: "whole", status: "Pendiente", color: "#cbd5e1", icon: ICONS.circle },
];

const DX_CATEGORIES = [
  { title: "Preexistencias", ids: ["crown-ok", "endo", "implante", "perno", "rest-ok", "amalgam", "absent"] },
  { title: "Lesiones", ids: ["caries-dx", "fractura", "pulpar", "movilidad", "resto", "rest-bad"] },
  { title: "Otras Simbologías", ids: ["sano", "sealant", "erupcion", "crown-bad"] },
];

// IDs de diagnósticos de tipo cara que sólo aplican a una cara puntual seleccionada
const SURFACE_DX_IDS = new Set(["caries-dx", "rest-ok", "rest-bad", "sealant", "amalgam"]);

// IDs de diagnósticos de tipo "whole" — afectan la pieza completa (se guardan en state.tooth)
const WHOLE_DX_IDS = new Set(["endo", "implante", "perno", "fractura", "pulpar", "movilidad", "resto", "erupcion"]);

const WHOLE_TOOTH_TREATMENT_IDS = new Set(["corona", "implante", "perno", "endodoncia", "fractura", "pulpar", "ausente"]);

// Load treatments from catalog
async function loadTreatmentCatalog() {
  try {
    const rows = await dbAll('SELECT * FROM tratamientos_catalogo WHERE activo = 1 ORDER BY categoria, nombre ASC');

    if (rows.length > 0) {
      treatments = rows.map(t => {
        let color = BRAND.primary;
        let icon = ICONS.tooth;

        // Color by category
        const catColors = {
          "Odontología General": { color: "#4EABBE", icon: ICONS.tooth },
          "Endodoncia": { color: "#A855F7", icon: ICONS.bolt },
          "Periodoncia": { color: "#2C93A8", icon: ICONS.drop },
          "Prótesis": { color: "#FBBF24", icon: ICONS.star },
          "Ortodoncia": { color: "#8B5CF6", icon: ICONS.adjust },
          "Estetica": { color: "#EC4899", icon: ICONS.star },
          "Cirugía": { color: "#EF4444", icon: ICONS.alert },
          "Diagnostico": { color: "#10B981", icon: ICONS.clipboard }
        };

        if (catColors[t.categoria]) {
          color = catColors[t.categoria].color;
          icon = catColors[t.categoria].icon;
        }

        // Override by name
        const name = String(t.nombre || "").toLowerCase();
        const namePlain = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (namePlain.includes("caries")) { color = "#EF4444"; icon = ICONS.circle; }
        else if (namePlain.includes("restauracion") || namePlain.includes("obturacion")) { color = "#10B981"; icon = ICONS.check; }
        else if (namePlain.includes("extraccion")) { color = "#6B7280"; icon = ICONS.x; }
        else if (namePlain.includes("corona")) { color = "#FBBF24"; icon = ICONS.star; }
        else if (namePlain.includes("implante")) { color = "#059669"; icon = ICONS.link; }

        return {
          id: `catalog-${t.id}`,
          name: t.nombre,
          color,
          icon,
          catalogoId: t.id,
          costo: t.costo_base || 0
        };
      });

      treatments.push({ id: "ausente", name: "Ausente", color: "#6B7280", icon: ICONS.x, catalogoId: null, costo: 0 });
      console.log(`Loaded ${treatments.length} treatments from catalog`);
    }
  } catch (e) {
    console.error("Error loading catalog:", e);
  }
}

const surfaceMeta = [
  { id: "oclusal", name: "Oclusal", desc: "Superficie de masticación", icon: ICONS.square },
  { id: "mesial", name: "Mesial", desc: "Hacia el centro", icon: ICONS.chevronLeft },
  { id: "distal", name: "Distal", desc: "Alejada del centro", icon: ICONS.chevronRight },
  { id: "vestibular", name: "Vestibular", desc: "Cara externa/labial", icon: ICONS.chevronUp },
  { id: "lingual", name: "Lingual", desc: "Cara interna/lingual", icon: ICONS.chevronDown },
];

// ===== DOM =====
const $ = (id) => document.getElementById(id);

function toast(msg, type = "info") {
  const el = $("toast");
  const text = $("toastText");
  const dot = $("toastDot");
  if (!el || !text || !dot) return;

  text.textContent = msg;

  const colors = {
    info: BRAND.primary,
    ok: "#10B981",
    warn: "#F59E0B",
    error: "#EF4444",
  };
  dot.style.background = colors[type] || BRAND.primary;

  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2400);
}

function currentTeeth() { return showAdultTeeth ? adultTeeth : childTeeth; }

function findDiagnosis(id) {
  return DIAGNOSES.find(d => d.id === id) || null;
}

function findTreatment(id) {
  return treatments.find(t => t.id === id) || null;
}

function findVisualSpec(id) {
  return findDiagnosis(id) || findTreatment(id) || null;
}

function ensureDxState(tooth) {
  if (!diagnosticsState[tooth]) diagnosticsState[tooth] = { faces: {}, tooth: null };
  if (!diagnosticsState[tooth].faces) diagnosticsState[tooth].faces = {};
  return diagnosticsState[tooth];
}

function faceLabel(faceId) {
  return FACE_LABELS[faceId] || faceId || "Cara";
}

function normalizeFaceId(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  if (raw === "tooth" || raw.includes("pieza")) return "tooth";
  if (FACE_LABELS[raw]) return raw;

  const byLabel = Object.entries(FACE_LABELS).find(([, label]) => String(label).trim().toLowerCase() === raw);
  if (byLabel) return byLabel[0];

  if (raw.includes("oclusal")) return "oclusal";
  if (raw.includes("mesial")) return "mesial";
  if (raw.includes("distal")) return "distal";
  if (raw.includes("vestibular") || raw.includes("labial")) return "vestibular";
  if (raw.includes("lingual") || raw.includes("palatal")) return "lingual";
  return null;
}

function statusBadge(status) {
  if (status && status.toLowerCase().includes("pend")) {
    return `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">Pendiente</span>`;
  }
  return `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">Realizado</span>`;
}

function escapeAttr(val) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getDiagnosisPriority(dxId) {
  const priorityMap = {
    absent: 100,
    pulpar: 95,
    fractura: 92,
    "rest-bad": 88,
    "caries-dx": 85,
    movilidad: 82,
    resto: 80,
    "crown-bad": 72,
    erupcion: 60,
    endo: 54,
    implante: 52,
    perno: 50,
    "rest-ok": 45,
    amalgam: 44,
    sealant: 40,
    "crown-ok": 38,
    sano: 10,
  };
  return priorityMap[dxId] || 20;
}

function getToothDiagnostics(toothNumber) {
  const state = diagnosticsState[toothNumber];
  if (!state) return [];

  const entries = [];
  if (state.tooth?.id) {
    const dx = findDiagnosis(state.tooth.id) || state.tooth;
    // Propagar el target real (tooth / whole) para que los helpers visuales distingan correctamente
    const realTarget = dx.target || state.tooth.target || "tooth";
    entries.push({
      key: "tooth",
      id: dx.id,
      name: dx.name,
      cssClass: dx.cssClass,
      status: dx.status || state.tooth.status || "",
      color: dx.color || BRAND.primary,
      icon: dx.icon || ICONS.circle,
      target: realTarget,
      face: null,
      priority: getDiagnosisPriority(dx.id),
    });
  }

  Object.entries(state.faces || {}).forEach(([face, rawDx]) => {
    if (!rawDx?.id) return;
    const dx = findDiagnosis(rawDx.id) || rawDx;
    entries.push({
      key: face,
      id: dx.id,
      name: dx.name,
      cssClass: rawDx.cssClass || dx.cssClass,
      status: rawDx.status || dx.status || "",
      color: dx.color || BRAND.primary,
      icon: dx.icon || ICONS.circle,
      target: "face",
      face,
      priority: getDiagnosisPriority(dx.id),
    });
  });

  return entries.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

function getDiagnosisSummaryTitle(toothNumber) {
  const entries = getToothDiagnostics(toothNumber);
  if (!entries.length) return `Pieza ${toothNumber}`;
  const detail = entries
    .map((entry) => {
      const isWide = entry.target === "tooth" || entry.target === "whole";
      return isWide ? `Pieza: ${entry.name}` : `${faceLabel(entry.face)}: ${entry.name}`;
    })
    .join(" | ");
  return `Pieza ${toothNumber} | ${detail}`;
}

function buildDxStyle(color) {
  return `--dx-color:${color || BRAND.primary}; --dx-glow:${hexToRgba(color || BRAND.primary, 0.34)};`;
}

function getToothVisualState(toothNumber) {
  const status = teethStatus[toothNumber] || null;
  const treatment = status?.treatment ? findTreatment(status.treatment) : null;
  const entries = getToothDiagnostics(toothNumber);
  // tooth-level entry = target "tooth" OR target "whole" (pieza completa visualmente)
  const toothEntry = entries.find((entry) => entry.target === "tooth" || entry.target === "whole") || null;
  const faceEntries = entries.filter((entry) => entry.target === "face");
  const ids = new Set(entries.map((entry) => entry.id));
  if (status?.treatment) ids.add(status.treatment);

  return {
    status,
    treatment,
    entries,
    toothEntry,
    faceEntries,
    has(id) { return ids.has(id); },
    primaryColor: toothEntry?.color || treatment?.color || faceEntries[0]?.color || BRAND.primary,
  };
}

function compactVisualLabel(name) {
  const plain = String(name || "").toLowerCase();
  if (!plain) return "";
  if (plain.includes("corona") && plain.includes("mal")) return "Corona mal";
  if (plain.includes("corona")) return "Corona";
  if (plain.includes("implante")) return "Implante";
  if (plain.includes("perno")) return "Perno";
  if (plain.includes("endodon")) return "Endodoncia";
  if (plain.includes("caries")) return "Caries";
  if (plain.includes("restaur") && plain.includes("mal")) return "Rest. mal";
  if (plain.includes("restaur")) return "Restauracion";
  if (plain.includes("fractura")) return "Fractura";
  if (plain.includes("pulpar")) return "Pulpar";
  if (plain.includes("ausent")) return "Ausente";
  if (plain.includes("radicular")) return "Resto rad.";
  if (plain.includes("movilidad")) return "Movilidad";
  if (plain.includes("erup")) return "No erup.";
  return name;
}

function getToothQuickTag(toothNumber) {
  const visual = getToothVisualState(toothNumber);
  const primaryEntry = visual.entries[0] || null;

  if (primaryEntry) {
    return {
      text: compactVisualLabel(primaryEntry.name),
      color: primaryEntry.color || BRAND.primary,
    };
  }

  if (visual.treatment && visual.treatment.id !== "profilaxis-simple" && visual.treatment.id !== "profilaxis-profunda") {
    return {
      text: compactVisualLabel(visual.treatment.name),
      color: visual.treatment.color || BRAND.primary,
    };
  }

  return null;
}

function isDiagnosisFresh(toothNumber, key) {
  return recentDxFeedback.tooth === toothNumber && recentDxFeedback.key === key;
}

function triggerDiagnosisFeedback(toothNumber, key) {
  recentDxFeedback = { tooth: toothNumber, key };
  clearTimeout(triggerDiagnosisFeedback._t);
  triggerDiagnosisFeedback._t = setTimeout(() => {
    recentDxFeedback = { tooth: null, key: null };
    render();
  }, 1450);
}

function renderToothDiagnosisMarkers(toothNumber) {
  const visual = getToothVisualState(toothNumber);
  if (!visual.entries.length && !visual.treatment) return "";

  const toothFresh = isDiagnosisFresh(toothNumber, "tooth") ? " dx-feedback-fresh" : "";
  const showFrame = !!visual.toothEntry || WHOLE_TOOTH_TREATMENT_IDS.has(visual.treatment?.id);
  const frame = showFrame ? `
    <span class="tooth-dx-frame${visual.has("absent") || visual.has("ausente") ? " dxfx-absent" : ""}${toothFresh}"
      style="${buildDxStyle(visual.primaryColor)}"></span>
  ` : "";

  const crownId = visual.has("crown-bad") ? "crown-bad" : visual.has("crown-ok") ? "crown-ok" : visual.has("corona") ? "corona" : "";
  const crown = crownId ? `
    <span class="tooth-dx-crown dxfx-${crownId}${toothFresh}" style="${buildDxStyle(findVisualSpec(crownId)?.color)}">
      <span class="tooth-dx-crown-band"></span>
    </span>
  ` : "";

  const implant = visual.has("implante") ? `
    <span class="tooth-dx-implant dxfx-implante${toothFresh}" style="${buildDxStyle(findVisualSpec("implante")?.color)}">
      <span class="tooth-dx-implant-cap"></span>
      <span class="tooth-dx-implant-body"></span>
      <span class="tooth-dx-implant-tip"></span>
    </span>
  ` : "";

  const post = visual.has("perno") ? `
    <span class="tooth-dx-post dxfx-perno${toothFresh}" style="${buildDxStyle(findVisualSpec("perno")?.color)}">
      <span class="tooth-dx-post-core"></span>
      <span class="tooth-dx-post-pin"></span>
    </span>
  ` : "";

  const endoId = visual.has("endo") ? "endo" : visual.has("endodoncia") ? "endodoncia" : "";
  const endo = endoId ? `
    <span class="tooth-dx-endo dxfx-${endoId}${toothFresh}" style="${buildDxStyle(findVisualSpec(endoId)?.color)}">
      <span class="tooth-dx-endo-line"></span>
      <span class="tooth-dx-endo-node"></span>
    </span>
  ` : "";

  const fracture = visual.has("fractura") ? `
    <span class="tooth-dx-fracture dxfx-fractura${toothFresh}" style="${buildDxStyle(findVisualSpec("fractura")?.color)}">
      <span class="tooth-dx-fracture-a"></span>
      <span class="tooth-dx-fracture-b"></span>
    </span>
  ` : "";

  const pulpar = visual.has("pulpar") ? `
    <span class="tooth-dx-pulp dxfx-pulpar${toothFresh}" style="${buildDxStyle(findVisualSpec("pulpar")?.color)}"></span>
  ` : "";

  const rootStub = visual.has("resto") ? `
    <span class="tooth-dx-root-stub dxfx-resto${toothFresh}" style="${buildDxStyle(findVisualSpec("resto")?.color)}"></span>
  ` : "";

  const eruption = visual.has("erupcion") ? `
    <span class="tooth-dx-eruption dxfx-erupcion${toothFresh}" style="${buildDxStyle(findVisualSpec("erupcion")?.color)}"></span>
  ` : "";

  const mobility = visual.has("movilidad") ? `
    <span class="tooth-dx-mobility dxfx-movilidad${toothFresh}" style="${buildDxStyle(findVisualSpec("movilidad")?.color)}">
      <span class="tooth-dx-mobility-bar left"></span>
      <span class="tooth-dx-mobility-bar right"></span>
    </span>
  ` : "";

  const surfaceEntries = visual.faceEntries.filter((entry) => SURFACE_DX_IDS.has(entry.id));
  const surfaces = surfaceEntries.length ? `
    <div class="tooth-dx-surface-map">
      ${surfaceEntries.map((entry) => `
        <span class="tooth-dx-surface tooth-dx-surface-${entry.face} dxsurface-${entry.id}${isDiagnosisFresh(toothNumber, entry.face) ? " dx-feedback-fresh" : ""}"
          style="${buildDxStyle(entry.color)}"
          title="${escapeAttr(`${faceLabel(entry.face)}: ${entry.name}`)}"></span>
      `).join("")}
    </div>
  ` : "";

  return `<div class="tooth-dx-layer">${frame}${surfaces}${crown}${endo}${post}${implant}${pulpar}${fracture}${rootStub}${eruption}${mobility}</div>`;
}

function renderToothDxHud(toothNumber, isUpper) {
  const entries = getToothDiagnostics(toothNumber);
  if (!entries.length) return "";

  const popoverClass = isUpper ? "tooth-dx-popover-top" : "tooth-dx-popover-bottom";
  const rows = entries.map((entry) => `
    <div class="tooth-dx-item">
      <span class="tooth-dx-chip" style="${buildDxStyle(entry.color)}">${escapeAttr(entry.target === "tooth" ? "Pieza" : faceLabel(entry.face))}</span>
      <span class="tooth-dx-text">${escapeAttr(entry.name)}</span>
    </div>
  `).join("");

  return `
    <div class="tooth-dx-hud">
      <div class="tooth-dx-popover ${popoverClass}">
        <p class="tooth-dx-popover-title">Diagnosticos activos</p>
        ${rows}
      </div>
    </div>
  `;
}

function renderToothQuickTag(toothNumber) {
  const tag = getToothQuickTag(toothNumber);
  if (!tag) return `<div class="tooth-quick-tag-slot"></div>`;

  return `
    <div class="tooth-quick-tag-slot">
      <span class="tooth-quick-tag" style="${buildDxStyle(tag.color)}">${escapeAttr(tag.text)}</span>
    </div>
  `;
}

function normalizeToothImageEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return { imagen_v: "", imagen_p: "", imagen_url: "" };
  }

  const normalized = {
    imagen_v: typeof entry.imagen_v === "string" ? entry.imagen_v : "",
    imagen_p: typeof entry.imagen_p === "string" ? entry.imagen_p : "",
    imagen_url: typeof entry.imagen_url === "string" ? entry.imagen_url : "",
  };

  if (!normalized.imagen_v && !normalized.imagen_p && normalized.imagen_url) {
    normalized.imagen_v = normalized.imagen_url;
    normalized.imagen_p = normalized.imagen_url;
  }

  return normalized;
}

function getToothImageUrl(toothNumber) {
  const entry = toothImages[toothNumber];
  if (!entry) return "";
  return (entry.imagen_v || entry.imagen_url || entry.imagen_p || "").trim();
}

async function loadToothImagesFromPeriodontograma() {
  toothImages = {};
  if (!currentPacienteId || !db) return;

  try {
    const columns = await dbAll("PRAGMA table_info(periodontograma)");
    const hasImagesColumn = Array.isArray(columns) && columns.some((column) => column?.name === "dientes_imagenes");
    const selectCols = hasImagesColumn ? "datos, dientes_imagenes" : "datos";
    const row = await dbGet(`SELECT ${selectCols} FROM periodontograma WHERE paciente_id = ?`, [currentPacienteId]);
    if (!row) return;

    if (row.datos) {
      const parsedDatos = JSON.parse(row.datos);
      const rawTeeth = parsedDatos?.teeth && typeof parsedDatos.teeth === "object" ? parsedDatos.teeth : parsedDatos;
      if (rawTeeth && typeof rawTeeth === "object") {
        Object.entries(rawTeeth).forEach(([toothNumber, entry]) => {
          if (!/^\d+$/.test(String(toothNumber))) return;
          toothImages[toothNumber] = normalizeToothImageEntry(entry);
        });
      }
    }

    if (!row.dientes_imagenes) return;

    const parsedImages = JSON.parse(row.dientes_imagenes);
    if (!parsedImages || typeof parsedImages !== "object") return;

    Object.entries(parsedImages).forEach(([toothNumber, entry]) => {
      if (!/^\d+$/.test(String(toothNumber))) return;
      toothImages[toothNumber] = normalizeToothImageEntry(entry);
    });
  } catch (e) {
    console.error("Error cargando imagenes del periodontograma:", e);
  }
}




function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(78, 171, 190, ${alpha})`;
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return `rgba(78, 171, 190, ${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(78, 171, 190, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getToothType(num) {
  if ([16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(num)) return "molar";
  if ([14, 15, 24, 25, 34, 35, 44, 45].includes(num)) return "premolar";
  if ([13, 23, 33, 43].includes(num)) return "canine";
  if ([11, 12, 21, 22, 31, 32, 41, 42].includes(num)) return "incisor";
  if ([55, 54, 64, 65, 85, 84, 74, 75].includes(num)) return "child-molar";
  if ([53, 63, 83, 73].includes(num)) return "child-canine";
  if ([52, 51, 61, 62, 82, 81, 71, 72].includes(num)) return "child-incisor";
  return "molar";
}

function arcOffset(index, total, isUpper) {
  if (total <= 1) return 0;
  const mid = (total - 1) / 2;
  const dist = Math.abs(index - mid) / mid;
  const maxOffset = showAdultTeeth ? 12 : 8;
  const offset = dist * maxOffset;
  return isUpper ? -offset : offset;
}

// ===== SVG MARKS =====
function renderSurfaceMarks(surfaces, isUpper, color, w, h) {
  if (!surfaces) return "";
  const mark = (cond, svg) => (cond ? svg : "");
  const ocY = isUpper ? h * 0.36 : h * 0.64;
  const sideY = isUpper ? h * 0.28 : h * 0.38;
  const sideH = h * 0.34;
  const vestY = isUpper ? h * 0.18 : h * 0.76;
  const lingY = isUpper ? h * 0.76 : h * 0.18;

  return `
    <g opacity="0.92">
      ${mark(surfaces.oclusal, `<ellipse cx="${w * 0.5}" cy="${ocY}" rx="${w * 0.18}" ry="${h * 0.10}" fill="${color}" />`)}
      ${mark(surfaces.mesial, `<rect x="${w * 0.14}" y="${sideY}" width="${w * 0.14}" height="${sideH}" rx="${w * 0.05}" fill="${color}" />`)}
      ${mark(surfaces.distal, `<rect x="${w * 0.72}" y="${sideY}" width="${w * 0.14}" height="${sideH}" rx="${w * 0.05}" fill="${color}" />`)}
      ${mark(surfaces.vestibular, `<rect x="${w * 0.3}" y="${vestY}" width="${w * 0.4}" height="${h * 0.1}" rx="${w * 0.06}" fill="${color}" />`)}
      ${mark(surfaces.lingual, `<rect x="${w * 0.3}" y="${lingY}" width="${w * 0.4}" height="${h * 0.1}" rx="${w * 0.06}" fill="${color}" />`)}
    </g>
  `;
}

function createToothSVG(num, isUpper, isSelected, treatmentColor, surfaces, isMissing) {
  const w = 80;
  const h = 104;
  const strokeWidth = 2.6;

  const borderColor = isSelected ? BRAND.primary : (treatmentColor || "#CBD5E1");
  const gradientId = `tooth-grad-${num}-${isUpper ? "u" : "l"}`;
  const shineId = `tooth-shine-${num}-${isUpper ? "u" : "l"}`;
  const shapeType = getToothType(num).replace("child-", "");

  let path = "";
  let detail = "";

  // (Tu lógica de shapes está bien, la dejo igual — solo mantengo tus paths)
  // === Molar / Premolar / Canine / Incisor ===
  if (shapeType === "molar") {
    if (isUpper) {
      path = `M ${w * 0.18} ${h * 0.12}
              L ${w * 0.45} ${h * 0.08}
              L ${w * 0.55} ${h * 0.08}
              L ${w * 0.82} ${h * 0.12}
              Q ${w * 0.92} ${h * 0.18} ${w * 0.92} ${h * 0.28}
              L ${w * 0.92} ${h * 0.72}
              Q ${w * 0.92} ${h * 0.86} ${w * 0.82} ${h * 0.92}
              L ${w * 0.18} ${h * 0.92}
              Q ${w * 0.08} ${h * 0.86} ${w * 0.08} ${h * 0.72}
              L ${w * 0.08} ${h * 0.28}
              Q ${w * 0.08} ${h * 0.18} ${w * 0.18} ${h * 0.12}
              Z`;
      detail = `
        <path d="M ${w * 0.25} ${h * 0.16} L ${w * 0.5} ${h * 0.36}" stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
        <path d="M ${w * 0.75} ${h * 0.16} L ${w * 0.5} ${h * 0.36}" stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
        <path d="M ${w * 0.5} ${h * 0.26} L ${w * 0.5} ${h * 0.56}" stroke="rgba(15,37,50, 0.10)" stroke-width="1" fill="none"/>
      `;
    } else {
      path = `M ${w * 0.18} ${h * 0.08}
              L ${w * 0.82} ${h * 0.08}
              Q ${w * 0.92} ${h * 0.14} ${w * 0.92} ${h * 0.28}
              L ${w * 0.92} ${h * 0.72}
              Q ${w * 0.92} ${h * 0.82} ${w * 0.82} ${h * 0.88}
              L ${w * 0.55} ${h * 0.92}
              L ${w * 0.45} ${h * 0.92}
              L ${w * 0.18} ${h * 0.88}
              Q ${w * 0.08} ${h * 0.82} ${w * 0.08} ${h * 0.72}
              L ${w * 0.08} ${h * 0.28}
              Q ${w * 0.08} ${h * 0.14} ${w * 0.18} ${h * 0.08}
              Z`;
      detail = `
        <path d="M ${w * 0.25} ${h * 0.84} L ${w * 0.5} ${h * 0.64}" stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
        <path d="M ${w * 0.75} ${h * 0.84} L ${w * 0.5} ${h * 0.64}" stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
      `;
    }
  } else if (shapeType === "premolar") {
    if (isUpper) {
      path = `M ${w * 0.22} ${h * 0.15}
              L ${w * 0.5} ${h * 0.10}
              L ${w * 0.78} ${h * 0.15}
              Q ${w * 0.88} ${h * 0.22} ${w * 0.88} ${h * 0.32}
              L ${w * 0.88} ${h * 0.70}
              Q ${w * 0.88} ${h * 0.84} ${w * 0.78} ${h * 0.90}
              L ${w * 0.22} ${h * 0.90}
              Q ${w * 0.12} ${h * 0.84} ${w * 0.12} ${h * 0.70}
              L ${w * 0.12} ${h * 0.32}
              Q ${w * 0.12} ${h * 0.22} ${w * 0.22} ${h * 0.15}
              Z`;
      detail = `
        <path d="M ${w * 0.35} ${h * 0.20} L ${w * 0.5} ${h * 0.35}" stroke="rgba(15,37,50, 0.11)" stroke-width="1.1" fill="none"/>
        <path d="M ${w * 0.65} ${h * 0.20} L ${w * 0.5} ${h * 0.35}" stroke="rgba(15,37,50, 0.11)" stroke-width="1.1" fill="none"/>
      `;
    } else {
      path = `M ${w * 0.22} ${h * 0.10}
              L ${w * 0.78} ${h * 0.10}
              Q ${w * 0.88} ${h * 0.16} ${w * 0.88} ${h * 0.30}
              L ${w * 0.88} ${h * 0.68}
              Q ${w * 0.88} ${h * 0.78} ${w * 0.78} ${h * 0.85}
              L ${w * 0.5} ${h * 0.90}
              L ${w * 0.22} ${h * 0.85}
              Q ${w * 0.12} ${h * 0.78} ${w * 0.12} ${h * 0.68}
              L ${w * 0.12} ${h * 0.30}
              Q ${w * 0.12} ${h * 0.16} ${w * 0.22} ${h * 0.10}
              Z`;
      detail = `
        <path d="M ${w * 0.35} ${h * 0.80} L ${w * 0.5} ${h * 0.65}" stroke="rgba(15,37,50, 0.11)" stroke-width="1.1" fill="none"/>
        <path d="M ${w * 0.65} ${h * 0.80} L ${w * 0.5} ${h * 0.65}" stroke="rgba(15,37,50, 0.11)" stroke-width="1.1" fill="none"/>
      `;
    }
  } else if (shapeType === "canine") {
    if (isUpper) {
      path = `M ${w * 0.25} ${h * 0.15}
              Q ${w * 0.15} ${h * 0.25} ${w * 0.18} ${h * 0.35}
              L ${w * 0.18} ${h * 0.70}
              Q ${w * 0.15} ${h * 0.82} ${w * 0.25} ${h * 0.90}
              L ${w * 0.75} ${h * 0.90}
              Q ${w * 0.85} ${h * 0.82} ${w * 0.82} ${h * 0.70}
              L ${w * 0.82} ${h * 0.35}
              Q ${w * 0.85} ${h * 0.25} ${w * 0.75} ${h * 0.15}
              L ${w * 0.5} ${h * 0.08}
              Z`;
      detail = `<path d="M ${w * 0.5} ${h * 0.14} L ${w * 0.5} ${h * 0.54}" stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>`;
    } else {
      path = `M ${w * 0.25} ${h * 0.10}
              Q ${w * 0.15} ${h * 0.18} ${w * 0.18} ${h * 0.30}
              L ${w * 0.18} ${h * 0.65}
              Q ${w * 0.15} ${h * 0.75} ${w * 0.25} ${h * 0.85}
              L ${w * 0.5} ${h * 0.92}
              L ${w * 0.75} ${h * 0.85}
              Q ${w * 0.85} ${h * 0.75} ${w * 0.82} ${h * 0.65}
              L ${w * 0.82} ${h * 0.30}
              Q ${w * 0.85} ${h * 0.18} ${w * 0.75} ${h * 0.10}
              Z`;
      detail = `<path d="M ${w * 0.5} ${h * 0.88} L ${w * 0.5} ${h * 0.50}" stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>`;
    }
  } else {
    if (isUpper) {
      path = `M ${w * 0.25} ${h * 0.12}
              Q ${w * 0.20} ${h * 0.18} ${w * 0.20} ${h * 0.28}
              L ${w * 0.20} ${h * 0.72}
              Q ${w * 0.20} ${h * 0.84} ${w * 0.25} ${h * 0.90}
              L ${w * 0.75} ${h * 0.90}
              Q ${w * 0.80} ${h * 0.84} ${w * 0.80} ${h * 0.72}
              L ${w * 0.80} ${h * 0.28}
              Q ${w * 0.80} ${h * 0.18} ${w * 0.75} ${h * 0.12}
              Z`;
      detail = `<path d="M ${w * 0.35} ${h * 0.30} Q ${w * 0.5} ${h * 0.35} ${w * 0.65} ${h * 0.30}" stroke="rgba(15,37,50, 0.10)" stroke-width="1" fill="none"/>`;
    } else {
      path = `M ${w * 0.25} ${h * 0.10}
              Q ${w * 0.20} ${h * 0.16} ${w * 0.20} ${h * 0.28}
              L ${w * 0.20} ${h * 0.72}
              Q ${w * 0.20} ${h * 0.82} ${w * 0.25} ${h * 0.88}
              L ${w * 0.75} ${h * 0.88}
              Q ${w * 0.80} ${h * 0.82} ${w * 0.80} ${h * 0.72}
              L ${w * 0.80} ${h * 0.28}
              Q ${w * 0.80} ${h * 0.16} ${w * 0.75} ${h * 0.10}
              Z`;
      detail = `<path d="M ${w * 0.35} ${h * 0.70} Q ${w * 0.5} ${h * 0.65} ${w * 0.65} ${h * 0.70}" stroke="rgba(15,37,50, 0.10)" stroke-width="1" fill="none"/>`;
    }
  }

  const surfaceColor = treatmentColor || "#EF4444";
  const overlays = !isMissing && surfaces ? renderSurfaceMarks(surfaces, isUpper, surfaceColor, w, h) : "";

  const missingMark = isMissing ? `
    <line x1="${w * 0.2}" y1="${h * 0.2}" x2="${w * 0.8}" y2="${h * 0.8}" stroke="#EF4444" stroke-width="3.5" opacity="0.85" stroke-linecap="round"/>
    <line x1="${w * 0.8}" y1="${h * 0.2}" x2="${w * 0.2}" y2="${h * 0.8}" stroke="#EF4444" stroke-width="3.5" opacity="0.85" stroke-linecap="round"/>
  ` : "";

  const baseOpacity = isMissing ? 0.45 : 1;
  const toothImageUrl = getToothImageUrl(num);

  if (toothImageUrl) {
    return `
      <div class="tooth-visual tooth-visual-image">
        <div class="tooth-image-stage">
          <img src="${escapeAttr(toothImageUrl)}" alt="Diente ${num}"
            class="tooth-illustration"
            style="opacity:${baseOpacity};" draggable="false" />
          ${renderToothDiagnosisMarkers(num)}
          <svg viewBox="0 0 ${w} ${h}" class="absolute inset-0 w-full h-full pointer-events-none">
            ${overlays}
            ${missingMark}
          </svg>
        </div>
      </div>
    `;
  }

  return `
    <div class="tooth-visual">
      <div class="tooth-image-stage tooth-svg-stage">
        ${renderToothDiagnosisMarkers(num)}
        <svg viewBox="0 0 ${w} ${h}" class="w-full h-full">
          <defs>
            <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#FFFEF9;stop-opacity:1" />
              <stop offset="55%" style="stop-color:#FFF7E9;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#F3E9DC;stop-opacity:1" />
            </linearGradient>
            <radialGradient id="${shineId}" cx="50%" cy="${isUpper ? "30%" : "70%"}">
              <stop offset="0%" style="stop-color:rgba(255,255,255,0.72);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
            </radialGradient>
          </defs>

          <path d="${path}"
            fill="url(#${gradientId})"
            stroke="${borderColor}"
            stroke-width="${strokeWidth}"
            stroke-dasharray="${isMissing ? "6 4" : "0"}"
            opacity="${baseOpacity}" />

          ${detail}
          <ellipse cx="${w * 0.5}" cy="${isUpper ? h * 0.28 : h * 0.72}" rx="${w * 0.28}" ry="${h * 0.16}"
            fill="url(#${shineId})" opacity="0.85"/>

          ${overlays}
          ${missingMark}
        </svg>
      </div>
    </div>
  `;
}

function renderGeoCircle(num) {
  const state = diagnosticsState[num] || {};
  const faces = state.faces || {};
  const toothClass = state.tooth?.cssClass || "";
  const isAbsent = state.tooth?.id === "absent";
  const summary = getToothDiagnostics(num);
  const faceCls = (id) => {
    const dx = faces[id];
    if (!dx?.id) return "";
    const classes = [dx.cssClass || "", `dxfx-${dx.id}`];
    if (isDiagnosisFresh(num, id)) classes.push("dx-feedback-fresh");
    return ` ${classes.filter(Boolean).join(" ")}`;
  };
  const circleClasses = ["geo-circle", toothClass || ""];
  if (state.tooth?.id) circleClasses.push(`dxfx-${state.tooth.id}`);
  if (isDiagnosisFresh(num, "tooth")) circleClasses.push("dx-feedback-fresh");
  const countBadge = summary.length ? `<span class="geo-dx-count" style="${buildDxStyle(summary[0].color)}">${summary.length}</span>` : "";

  return `
    <div class="geo-mini ${toothClass || ""}" title="${escapeAttr(getDiagnosisSummaryTitle(num))}">
      ${countBadge}
      <svg viewBox="0 0 100 100" class="geo-svg">
        <circle cx="50" cy="50" r="48" class="${circleClasses.filter(Boolean).join(" ")}" />

        <path d="M15,15 L85,85 M85,15 L15,85" stroke="#0f172a" stroke-width="4" class="geo-cross ${isAbsent ? "" : "hidden"}" />

        <path d="M15,15 L85,15 L65,35 L35,35 Z" class="geo-sector${faceCls("vestibular")}"
          data-geo-face="vestibular" data-tooth="${num}" />
        <path d="M15,85 L85,85 L65,65 L35,65 Z" class="geo-sector${faceCls("lingual")}"
          data-geo-face="lingual" data-tooth="${num}" />
        <path d="M15,15 L15,85 L35,65 L35,35 Z" class="geo-sector${faceCls("mesial")}"
          data-geo-face="mesial" data-tooth="${num}" />
        <path d="M85,15 L85,85 L65,65 L65,35 Z" class="geo-sector${faceCls("distal")}"
          data-geo-face="distal" data-tooth="${num}" />
        <rect x="35" y="35" width="30" height="30" class="geo-sector${faceCls("oclusal")}"
          data-geo-face="oclusal" data-tooth="${num}" />
      </svg>
    </div>
  `;
}

// ===== SELECCIÓN =====
function setSelected(toothNumber) { selectedTooth = toothNumber; render(); }
function clearSelected() { selectedTooth = null; render(); }

// ===== TRATAMIENTOS =====
async function handleTreatmentSelect(treatment) {
  if (!selectedTooth) return;

  // Solo estos piden caras (ajústalo si quieres)
  if (treatment.id === "caries" || treatment.id === "restauracion") {
    currentTreatment = treatment;
    showSurfaceModal = true;
    if (!selectedSurfaces[selectedTooth]) selectedSurfaces[selectedTooth] = {};
    render();
    return;
  }

  teethStatus[selectedTooth] = { treatment: treatment.id, surfaces: {} };
  await saveTreatmentToDB(selectedTooth, treatment.id, {});
  toast(`Guardado: ${treatment.name} en pieza ${selectedTooth}`, "ok");

  selectedTooth = null;
  render();
}

function toggleSurface(surfaceId) {
  if (!selectedTooth) return;
  const cur = selectedSurfaces[selectedTooth] || {};
  selectedSurfaces[selectedTooth] = { ...cur, [surfaceId]: !cur[surfaceId] };
  renderModalContents();
}

async function saveSurfaceSelection() {
  if (!selectedTooth || !currentTreatment) return;

  const surfaces = selectedSurfaces[selectedTooth] || {};
  teethStatus[selectedTooth] = { treatment: currentTreatment.id, surfaces };

  await saveTreatmentToDB(selectedTooth, currentTreatment.id, surfaces);

  toast(`Guardado: ${currentTreatment.name} (${Object.keys(surfaces).filter(k => surfaces[k]).length} caras)`, "ok");

  showSurfaceModal = false;
  currentTreatment = null;
  selectedTooth = null;
  render();
}

async function saveTreatmentToDB(toothNumber, treatmentId, surfaces) {
  if (!currentPacienteId || !db) {
    // no truena si abres la vista suelta
    return;
  }

  try {
    const surfacesList = Object.keys(surfaces).filter(k => surfaces[k]);
    const caras = surfacesList.length > 0 ? surfacesList.join(", ") : null;
    const treatment = treatments.find(t => t.id === treatmentId);
    const procedimiento = treatment?.name || treatmentId;
    const catalogoId = treatment?.catalogoId || null;
    const costo = treatment?.costo || 0;

    await dbRun(
      'INSERT INTO tratamientos (paciente_id, diente, procedimiento, costo, notas, catalogo_id, fecha) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
      [currentPacienteId, toothNumber.toString(), procedimiento, costo, caras ? `Caras: ${caras}` : null, catalogoId]
    );

    if (window.parent !== window) window.parent.postMessage({ type: "tratamiento-guardado" }, "*");
  } catch (e) {
    console.error("Error guardando tratamiento:", e);
    toast("Error al guardar tratamiento (ver consola)", "error");
  }
}

async function loadTreatmentsFromDB() {
  if (!currentPacienteId || !db) return;

  try {
    const rows = await dbAll(
      'SELECT * FROM tratamientos WHERE paciente_id = ? AND diente IS NOT NULL ORDER BY fecha DESC',
      [currentPacienteId]
    );

    teethStatus = {};
    rows.forEach(row => {
      const toothNum = parseInt(row.diente, 10);
      if (isNaN(toothNum)) return;

      let treatmentId = null;
      const proc = (row.procedimiento || "").toLowerCase();

      // Check if it is a diagnosis
      if (row.notas && row.notas.startsWith("DX:")) {
        try {
          const json = JSON.parse(row.notas.substring(3));
          const dx = findDiagnosis(json.dxId);
          if (dx) {
            const recordId = row.id;
            const state = ensureDxState(toothNum);

            // Restaurar según la naturaleza del diagnóstico
            const isToothWide = (dx.target === "tooth" || dx.target === "whole" || !json.face);
            if (isToothWide) {
              // Diagnóstico de pieza completa (tooth o whole)
              state.tooth = { id: dx.id, cssClass: dx.cssClass, name: dx.name, target: dx.target, recordId };
              if (dx.id === "absent") state.faces = {};
            } else {
              // Diagnóstico de cara puntual
              const faceKey = normalizeFaceId(json.face);
              if (faceKey) {
                state.faces = state.faces || {};
                state.faces[faceKey] = { id: dx.id, cssClass: dx.cssClass, name: dx.name, status: dx.status, recordId };
              }
            }

            const zoneLabel = isToothWide ? "Pieza completa" : faceLabel(json.face);
            addDxRow(toothNum, zoneLabel, dx, isToothWide ? null : json.face, recordId);
          }
        } catch (e) { console.error("Error parsing dx note", e); }
        return;
      }

      if (proc.includes("profilaxis simple")) treatmentId = "profilaxis-simple";
      else if (proc.includes("profilaxis profunda")) treatmentId = "profilaxis-profunda";
      else if (proc.includes("caries") || proc.includes("lesión")) treatmentId = "caries";
      else if (proc.includes("restauración") || proc.includes("restauracion")) treatmentId = "restauracion";
      else if (proc.includes("endodoncia")) treatmentId = "endodoncia";
      else if (proc.includes("corona")) treatmentId = "corona";
      else if (proc.includes("implante")) treatmentId = "implante";
      else if (proc.includes("ausente")) treatmentId = "ausente";
      else if (proc.includes("fractura")) treatmentId = "fractura";
      else if (proc.includes("pulpar")) treatmentId = "pulpar";
      else if (proc.includes("perno")) treatmentId = "perno";

      if (!treatmentId) return;

      const surfaces = {};
      if (row.notas && row.notas.includes("Caras:")) {
        const carasStr = row.notas.split("Caras:")[1]?.trim();
        if (carasStr) {
          const carasList = carasStr.split(",").map(c => c.trim().toLowerCase());
          const valid = ["oclusal", "mesial", "distal", "vestibular", "lingual"];
          carasList.forEach(cara => {
            let n = cara;
            if (cara.includes("oclusal")) n = "oclusal";
            else if (cara.includes("mesial")) n = "mesial";
            else if (cara.includes("distal")) n = "distal";
            else if (cara.includes("vestibular") || cara.includes("labial")) n = "vestibular";
            else if (cara.includes("lingual") || cara.includes("palatal")) n = "lingual";
            if (valid.includes(n)) surfaces[n] = true;
          });
        }
      }

      teethStatus[toothNum] = { treatment: treatmentId, surfaces };
    });

    render();
  } catch (e) {
    console.error("Error cargando tratamientos:", e);
    toast("No se pudieron cargar tratamientos (ver consola)", "warn");
  }
}

function cancelModal() {
  showSurfaceModal = false;
  if (selectedTooth) selectedSurfaces[selectedTooth] = {};
  currentTreatment = null;
  render();
}

// ===== UI RENDER =====
function renderToothButton(num, isUpper, index, total) {
  const status = teethStatus[num];
  const surfaces = status?.surfaces || {};
  const hasSurfaces = Object.values(surfaces).some(Boolean);
  const diagTooth = diagnosticsState[num]?.tooth;

  const treatment = status ? treatments.find(t => t.id === status.treatment) : null;
  const treatColor = treatment?.color || "";
  const isSelected = selectedTooth === num;
  const isMissing = status?.treatment === "ausente" || diagTooth?.id === "absent";

  const offset = arcOffset(index, total, isUpper);
  const border = isSelected ? BRAND.primary : (treatColor || "#CBD5E1");

  const shadow = isSelected
    ? `0 0 0 4px ${BRAND.ring}, 0 16px 32px rgba(15,37,50,.14)`
    : treatColor
      ? `0 0 0 2px ${hexToRgba(treatColor, 0.18)}, 0 12px 24px rgba(15,37,50,.12)`
      : `0 8px 18px rgba(15,37,50,.08)`;

  const label = treatment?.name || "";
  const title = escapeAttr(`${getDiagnosisSummaryTitle(num)}${label ? ` | Tratamiento: ${label}` : ""}`);

  // Tailwind look del botón (más “Sonalía”)
  const baseBtn =
    `tooth-btn rounded-[24px] border-[2.5px] bg-white
     transition will-change-transform
     hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(15,37,50,.16)]
     dark:hover:shadow-[0_18px_40px_rgba(0,0,0,.35)]
     active:translate-y-0`;

  const selectedCls = isSelected ? "shadow-ring" : "";

  if (isUpper) {
    // Arcada superior: número arriba → diente → círculo diagnóstico → etiqueta
    return `
      <div class="odonto-tooth odonto-tooth-upper flex flex-col items-center gap-3" style="transform: translateY(${offset}px);">
        ${renderToothDxHud(num, true)}
        <div class="tooth-number-badge">${num}</div>

        <button data-tooth="${num}"
          class="${baseBtn} ${selectedCls} relative overflow-hidden"
          title="${title}" aria-label="${title}"
          style="border-color:${border}; box-shadow:${shadow};">
          <div class="tooth-shell">
            ${createToothSVG(num, !isUpper, isSelected, treatColor, hasSurfaces ? surfaces : null, isMissing)}
          </div>
        </button>

        ${renderGeoCircle(num)}

        ${renderToothQuickTag(num)}
      </div>
    `;
  } else {
    // Arcada inferior: etiqueta → círculo diagnóstico → diente → número abajo
    return `
      <div class="odonto-tooth odonto-tooth-lower flex flex-col items-center gap-3" style="transform: translateY(${offset}px);">
        ${renderToothDxHud(num, false)}
        ${renderGeoCircle(num)}

        <button data-tooth="${num}"
          class="${baseBtn} ${selectedCls} relative overflow-hidden"
          title="${title}" aria-label="${title}"
          style="border-color:${border}; box-shadow:${shadow};">
          <div class="tooth-shell">
            ${createToothSVG(num, !isUpper, isSelected, treatColor, hasSurfaces ? surfaces : null, isMissing)}
          </div>
        </button>

        ${renderToothQuickTag(num)}

        <div class="tooth-number-badge">${num}</div>
      </div>
    `;
  }
}

function renderTreatments() {
  const cont = $("listaTratamientos");
  cont.innerHTML = treatments.map(t => `
    <button data-treatment="${t.id}"
      class="w-full p-3 rounded-2xl transition flex items-center gap-3 font-extrabold text-white shadow-md hover:shadow-lift"
      style="background:${t.color}">
      <span class="text-lg">${t.icon}</span>
      <span>${t.name}</span>
    </button>
  `).join("");

  cont.querySelectorAll("button[data-treatment]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-treatment");
      const t = treatments.find(x => x.id === id);
      if (t) await handleTreatmentSelect(t);
    });
  });
}



function renderDxOptions() {
  const cont = $("dxOptions");
  if (!cont) return;

  cont.innerHTML = DX_CATEGORIES.map(cat => `
    <div>
      <p class="text-[11px] uppercase tracking-[0.18em] text-black/50 dark:text-white/50 mb-2 font-bold">${cat.title}</p>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        ${cat.ids.map(id => {
    const dx = findDiagnosis(id);
    if (!dx) return "";
    const badge = dx.icon
      ? `<span class="inline-flex items-center justify-center w-9 h-9 rounded-xl" style="background:${hexToRgba(dx.color || '#4EABBE', 0.14)}; color:${dx.color}; border:1px solid ${hexToRgba(dx.color || '#4EABBE', 0.35)}">${dx.icon}</span>`
      : `<span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${dx.color || '#4EABBE'}"></span>`;
    return `
            <button class="dx-option w-full p-3 rounded-xl border border-[#8BCFDD]/30 dark:border-slate-700 hover:bg-[#8BCFDD]/10 dark:hover:bg-slate-800 transition text-left font-semibold flex items-start gap-3"
              data-dx="${dx.id}">
              ${badge}
              <span class="min-w-0 text-sm leading-snug whitespace-normal">${dx.name}</span>
            </button>
          `;
  }).join("")}
      </div>
    </div>
  `).join("");

  cont.querySelectorAll("[data-dx]").forEach(btn => {
    btn.addEventListener("click", () => applyDiagnosis(btn.getAttribute("data-dx")));
  });
}

async function saveDiagnosisToDB(tooth, face, dx) {
  if (!currentPacienteId || !db) return null;
  try {
    const noteObj = { type: "diagnosis", dxId: dx.id, face: face || null };
    const nota = "DX:" + JSON.stringify(noteObj);

    const insertedId = await dbRun(
      'INSERT INTO tratamientos (paciente_id, diente, procedimiento, costo, notas, fecha) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [currentPacienteId, tooth.toString(), dx.name, 0, nota]
    );

    if (window.parent !== window) window.parent.postMessage({ type: "tratamiento-guardado" }, "*");
    return insertedId;
  } catch (e) {
    console.error("Error saving diagnosis:", e);
    toast("Error al guardar diagnóstico", "error");
    return null;
  }
}

async function deleteDiagnosisFromDB(tooth, face, dxId, recordId = null) {
  if (!currentPacienteId || !db) return;
  try {
    // Si tenemos recordId, borramos directamente por ID (más seguro)
    if (recordId) {
      await dbRun('DELETE FROM tratamientos WHERE id = ? AND paciente_id = ?', [recordId, currentPacienteId]);
      if (window.parent !== window) window.parent.postMessage({ type: "tratamiento-guardado" }, "*");
      return;
    }

    // Fallback: buscar por nota (lógica original corregida)
    const candidateRows = await dbAll('SELECT id, notas FROM tratamientos WHERE paciente_id = ? AND diente = ?', [currentPacienteId, tooth.toString()]);

    let targetId = null;
    for (const row of candidateRows) {
      if (row.notas && row.notas.startsWith("DX:")) {
        try {
          const json = JSON.parse(row.notas.substring(3));
          if (json.dxId === dxId && json.face === (face || null)) {
            targetId = row.id;
            break; 
          }
        } catch (e) { }
      }
    }

    if (targetId) {
      await dbRun('DELETE FROM tratamientos WHERE id = ?', [targetId]);
      if (window.parent !== window) window.parent.postMessage({ type: "tratamiento-guardado" }, "*");
    }

  } catch (e) {
    console.error("Error deleting diagnosis:", e);
  }
}

function openDxModal(tooth, face) {
  dxContext = { tooth, face };
  const overlay = $("dxModalOverlay");
  if (!overlay) return;
  $("dxToothLabel").textContent = tooth ?? "--";
  $("dxFaceLabel").textContent = faceLabel(face);
  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
  renderDxOptions();
}

function closeDxModal() {
  const overlay = $("dxModalOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.classList.remove("flex");
  dxContext = { tooth: null, face: null };
}

function clearDxFace() {
  if (!dxContext.tooth || !dxContext.face) return;
  const state = diagnosticsState[dxContext.tooth];
  if (state && state.faces) {
    delete state.faces[dxContext.face];
    if (!state.tooth && Object.keys(state.faces).length === 0) delete diagnosticsState[dxContext.tooth];
  }
  render();
  closeDxModal();
}

function clearDxTooth() {
  if (!dxContext.tooth) return;
  delete diagnosticsState[dxContext.tooth];
  render();
  closeDxModal();
}

async function applyDiagnosis(dxId) {
  if (!dxContext.tooth) return;
  const dx = findDiagnosis(dxId);
  if (!dx) return;

  const state = ensureDxState(dxContext.tooth);

  // ── Regla de aplicación centralizada ──────────────────────────────────────
  // target:"tooth"  → pieza completa (crown-ok, crown-bad, absent)
  // target:"whole"  → pieza completa visualmente (endo, implante, movilidad…)
  //                   se almacena en state.tooth igual que tooth, face=null en BD
  // target:"face"   → cara puntual seleccionada (caries, restauración, sellante…)
  // "sano"          → limpia sólo la cara seleccionada (acción especial)
  // ──────────────────────────────────────────────────────────────────────────

  if (dx.id === "sano" || dx.cssClass === "clean") {
    // Limpiar sólo la cara seleccionada
    if (dxContext.face && state.faces) delete state.faces[dxContext.face];

  } else if (dx.target === "tooth" || dx.target === "whole") {
    // Diagnóstico de pieza completa
    state.tooth = { id: dx.id, cssClass: dx.cssClass, name: dx.name, target: dx.target };
    if (dx.id === "absent") state.faces = {}; // Ausente limpia todas las caras

  } else if (dx.target === "face") {
    // Diagnóstico de cara puntual
    if (dxContext.face) {
      state.faces[dxContext.face] = { id: dx.id, cssClass: dx.cssClass, name: dx.name, status: dx.status };
    }
  }

  diagnosticsState[dxContext.tooth] = state;

  // Determinar etiqueta de zona para la tabla y el toast
  const isToothWide = (dx.target === "tooth" || dx.target === "whole");
  const zoneLabel = isToothWide ? "Pieza completa" : faceLabel(dxContext.face);
  const faceForDB  = isToothWide ? null : dxContext.face;

  // Guardar en BD (Primero para tener el ID)
  const recordId = await saveDiagnosisToDB(dxContext.tooth, faceForDB, dx);

  // Vincular ID al estado visual para sincronización
  if (isToothWide) {
    if (state.tooth) state.tooth.recordId = recordId;
  } else if (dxContext.face && state.faces[dxContext.face]) {
    state.faces[dxContext.face].recordId = recordId;
  }

  addDxRow(dxContext.tooth, zoneLabel, dx, faceForDB, recordId);
  triggerDiagnosisFeedback(dxContext.tooth, isToothWide ? "tooth" : dxContext.face);
  toast(
    `DX: ${dx.name} en pieza ${dxContext.tooth}${!isToothWide && dxContext.face ? ` · ${faceLabel(dxContext.face)}` : ""}`,
    dx.status?.toLowerCase().includes("pend") ? "warn" : "ok"
  );

  closeDxModal();
  render();
}

function addDxRow(tooth, face, dx, faceIdRaw = null, recordId = null) {
  const tbody = $("dxTableBody");
  if (!tbody || !dx) return;
  $("dxEmpty")?.classList.add("hidden");

  const normalizedFaceId = (dx.target === "tooth" || dx.target === "whole")
    ? "tooth"
    : (normalizeFaceId(faceIdRaw) || normalizeFaceId(dxContext.face) || normalizeFaceId(face) || "");

  const tr = document.createElement("tr");
  tr.dataset.tooth = tooth;
  tr.dataset.faceId = normalizedFaceId;
  tr.dataset.diag = dx.id;
  if (recordId) tr.dataset.recordId = recordId;

  const date = new Date().toLocaleDateString("es-ES");

  tr.innerHTML = `
    <td class="py-2 text-xs text-black/60 dark:text-white/60">${date}</td>
    <td class="py-2 font-bold text-[#4EABBE] dark:text-[#8BCFDD]">${tooth}</td>
    <td class="py-2 text-sm">${face}</td>
    <td class="py-2 font-semibold">${dx.name}</td>
    <td class="py-2">${statusBadge(dx.status)}</td>
    <td class="py-2 text-right">
      <button class="px-3 py-1 rounded-lg text-[11px] font-bold bg-orange-400 text-white hover:bg-orange-500 transition"
        data-dx-delete>ANULAR</button>
    </td>
  `;

  tr.querySelector("[data-dx-delete]")?.addEventListener("click", () => deleteDxRow(tr));
  tbody.prepend(tr);
  dxCount += 1;
  $("dxTotal").textContent = dxCount;
}

async function deleteDxRow(rowEl) {
  if (!rowEl) return;
  const tooth = parseInt(rowEl.dataset.tooth, 10);
  const faceId = normalizeFaceId(rowEl.dataset.faceId);
  const diagId = rowEl.dataset.diag;
  const recordId = rowEl.dataset.recordId ? parseInt(rowEl.dataset.recordId, 10) : null;
  const dx = findDiagnosis(diagId);
  const state = diagnosticsState[tooth];

  if (state) {
    const isToothDx = faceId === "tooth" || dx?.target === "tooth" || dx?.target === "whole";

    if (isToothDx) {
      // Eliminar solo si el recordId coincide o si no hay recordId (compatibilidad)
      if (!recordId || state.tooth?.recordId == recordId) {
        state.tooth = null;
      }
    } else if (state.faces && faceId && state.faces[faceId]) {
      if (!recordId || state.faces[faceId].recordId == recordId) {
        delete state.faces[faceId];
      }
    }

    if (!state.tooth && (!state.faces || Object.keys(state.faces).length === 0)) {
      delete diagnosticsState[tooth];
    }

    // Eliminar de BD
    await deleteDiagnosisFromDB(tooth, isToothDx ? null : faceId, diagId, recordId);
  }

  rowEl.remove();
  dxCount = Math.max(0, dxCount - 1);
  $("dxTotal").textContent = dxCount;
  updateDxEmptyState();
  render();
}

function updateDxEmptyState() {
  const empty = $("dxEmpty");
  if (!empty) return;
  if (dxCount <= 0) empty.classList.remove("hidden");
  else empty.classList.add("hidden");
}

function renderModalContents() {
  if (!showSurfaceModal) return;

  $("modalPieza").textContent = selectedTooth ?? "";

  const sel = selectedSurfaces[selectedTooth] || {};
  const activeColor = currentTreatment?.color || BRAND.primary;

  // Botón guardar (mantiene tu gradiente, pero ya “Sonalía”)
  $("btnGuardarModal").textContent = currentTreatment ? `Guardar como ${currentTreatment.name}` : "Guardar";
  $("btnGuardarModal").style.background = `linear-gradient(to right, ${activeColor}, ${hexToRgba(activeColor, 0.85)})`;

  // Vista SVG
  $("vistaCaras").innerHTML = `
    <svg viewBox="0 0 200 280" class="w-full">
      ${[
      { id: "oclusal", x: 70, y: 90, w: 60, h: 50, label: "Oclusal" },
      { id: "mesial", x: 30, y: 110, w: 35, h: 70, label: "M" },
      { id: "distal", x: 135, y: 110, w: 35, h: 70, label: "D" },
      { id: "vestibular", x: 70, y: 40, w: 60, h: 45, label: "Vestibular" },
      { id: "lingual", x: 70, y: 195, w: 60, h: 45, label: "Lingual" },
    ].map(s => {
      const active = !!sel[s.id];
      return `
          <g>
            <rect data-surface="${s.id}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="10"
              style="fill:${active ? activeColor : "#334155"}; stroke:${BRAND.primary}; stroke-width:2.6"
              class="cursor-pointer transition-all"></rect>
            <text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + 5}" text-anchor="middle"
              style="fill:${active ? "#FFFFFF" : "#E2E8F0"}; font-weight:800; font-size:${s.label.length > 1 ? 11 : 16}px"
              class="pointer-events-none">${s.label}</text>
          </g>
        `;
    }).join("")}
    </svg>
  `;

  $("vistaCaras").querySelectorAll("[data-surface]").forEach(el => {
    el.addEventListener("click", () => toggleSurface(el.getAttribute("data-surface")));
  });

  // Lista de caras
  $("listaCaras").innerHTML = surfaceMeta.map(s => {
    const active = !!sel[s.id];
    return `
      <button data-surface-btn="${s.id}"
        class="w-full p-4 rounded-2xl border-2 transition text-left shadow-sm hover:shadow-soft dark:hover:bg-slate-800/50"
        style="background:${active ? activeColor : "transparent"};
               border-color:${active ? activeColor : "#8BCFDD"};
               color:${active ? "#FFFFFF" : "inherit"}">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${s.icon}</span>
          <div>
            <div class="font-extrabold">${s.name}</div>
            <div class="text-sm opacity-80">${s.desc}</div>
          </div>
        </div>
      </button>
    `;
  }).join("");

  $("listaCaras").querySelectorAll("[data-surface-btn]").forEach(btn => {
    btn.addEventListener("click", () => toggleSurface(btn.getAttribute("data-surface-btn")));
  });
}

function bindGeoListeners() {
  document.querySelectorAll("[data-geo-face]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const tooth = parseInt(el.getAttribute("data-tooth"), 10);
      const face = el.getAttribute("data-geo-face");
      openDxModal(tooth, face);
    });
  });
}

function render() {
  const denticionAuto = $("denticionAuto");
  if (denticionAuto) {
    denticionAuto.textContent = showAdultTeeth ? "Adulto" : "Infantil";
  }

  const teeth = currentTeeth();
  $("filaSuperior").innerHTML = teeth.superior.map((n, idx) => renderToothButton(n, true, idx, teeth.superior.length)).join("");
  $("filaInferior").innerHTML = teeth.inferior.map((n, idx) => renderToothButton(n, false, idx, teeth.inferior.length)).join("");

  // Click dientes deshabilitado (selección sólo desde el círculo de diagnóstico)
  document.querySelectorAll("button[data-tooth]").forEach(btn => {
    btn.classList.add("pointer-events-none");
    btn.setAttribute("aria-disabled", "true");
  });
  bindGeoListeners();

  // Panel tratamientos eliminado

  // Modal
  const overlay = $("modalOverlay");
  if (showSurfaceModal) {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    renderModalContents();
  } else {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }


  updateDxEmptyState();
}

// ===== INIT =====
async function init() {
  const pacienteId = getQueryParam("id");
  if (pacienteId) currentPacienteId = pacienteId;
  if (currentPacienteId) {
    try {
      const paciente = await dbGet('SELECT fecha_nacimiento FROM pacientes WHERE id = ?', [currentPacienteId]);
      const edad = calculateAgeYears(paciente?.fecha_nacimiento);
      if (edad !== null) {
        showAdultTeeth = edad >= PEDIATRIC_MAX_YEARS;
      }
    } catch (e) {
      console.error('Error calculando edad de paciente:', e);
    }
  }

  // Modal buttons
  $("btnCancelarModal")?.addEventListener("click", cancelModal);
  $("btnGuardarModal")?.addEventListener("click", saveSurfaceSelection);
  $("dxBtnClose")?.addEventListener("click", closeDxModal);
  $("dxClearFace")?.addEventListener("click", clearDxFace);
  $("dxClearTooth")?.addEventListener("click", clearDxTooth);

  // click afuera modal
  $("modalOverlay")?.addEventListener("click", (e) => {
    if (e.target === $("modalOverlay")) cancelModal();
  });
  $("dxModalOverlay")?.addEventListener("click", (e) => {
    if (e.target === $("dxModalOverlay")) closeDxModal();
  });

  // Esc para cerrar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (showSurfaceModal) cancelModal();
      else if (!$("dxModalOverlay")?.classList.contains("hidden")) closeDxModal();
      else if (selectedTooth) clearSelected();
    }
  });

  // Panel tratamientos eliminado

  // Load treatment catalog first
  await loadTreatmentCatalog();

  // Cargar de BD
  if (currentPacienteId) {
    await loadToothImagesFromPeriodontograma();
    await loadTreatmentsFromDB();
  }

  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

