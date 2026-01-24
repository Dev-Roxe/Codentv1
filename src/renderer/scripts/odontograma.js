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
      if (db.run && db.run.length >= 3) db.run(sql, params, (err) => err ? reject(err) : resolve());
      else if (db.run) db.run(sql, params).then(resolve).catch(reject);
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
const treatments = [
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

function escapeAttr(val) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

  return `
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

  const treatment = status ? treatments.find(t => t.id === status.treatment) : null;
  const treatColor = treatment?.color || "";
  const isSelected = selectedTooth === num;
  const isMissing = status?.treatment === "ausente";

  const offset = arcOffset(index, total, isUpper);
  const border = isSelected ? BRAND.primary : (treatColor || "#CBD5E1");

  const shadow = isSelected
    ? `0 0 0 4px ${BRAND.ring}, 0 18px 40px rgba(15,37,50,.16)`
    : treatColor
      ? `0 0 0 3px ${hexToRgba(treatColor, 0.22)}, 0 14px 26px rgba(15,37,50,.14)`
      : `0 10px 22px rgba(15,37,50,.10)`;

  const label = treatment?.name || "";
  const title = escapeAttr(label ? `Pieza ${num} - ${label}` : `Pieza ${num}`);

  // Tailwind look del botón (más “Sonalía”)
  const baseBtn =
    `tooth-btn rounded-2xl border-[2.5px] bg-white dark:bg-slate-900
     transition will-change-transform
     hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(15,37,50,.16)]
     dark:hover:shadow-[0_18px_40px_rgba(0,0,0,.35)]
     active:translate-y-0`;

  const selectedCls = isSelected ? "shadow-ring" : "";
  const hasTreatmentDot = treatment ? `
    <span class="absolute top-2 right-2 w-2.5 h-2.5 rounded-full pulse-dot"
      style="background:${treatColor || BRAND.primary}; box-shadow:0 0 0 2px rgba(255,255,255,.9), 0 8px 18px rgba(15,37,50,.18)"></span>
  ` : "";

  return `
    <div class="odonto-tooth flex flex-col items-center gap-2" style="transform: translateY(${offset}px);">
      <div class="text-[11px] font-extrabold tracking-wide opacity-80 text-black/70 dark:text-white/70">${num}</div>

      <button data-tooth="${num}"
        class="${baseBtn} ${selectedCls} relative overflow-hidden"
        title="${title}" aria-label="${title}"
        style="border-color:${border}; box-shadow:${shadow};">
        ${hasTreatmentDot}
        ${createToothSVG(num, isUpper, isSelected, treatColor, hasSurfaces ? surfaces : null, isMissing)}
      </button>

      <div class="min-h-[14px] text-[10px] font-semibold text-black/60 dark:text-white/60 text-center max-w-[var(--tooth-w)]">
        ${label}
      </div>
    </div>
  `;
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

function renderLegend() {
  const cont = $("leyenda");
  if (!cont) return;

  cont.innerHTML = treatments.map(t => `
    <div class="rounded-2xl p-3 border border-[#8BCFDD]/30 dark:border-slate-700 bg-white dark:bg-[#0E1A25] shadow-sm hover:shadow-soft transition">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl shadow flex items-center justify-center text-xl" style="background:${t.color}">
          ${t.icon}
        </div>
        <span class="text-xs font-extrabold text-black/75 dark:text-white/80">${t.name}</span>
      </div>
    </div>
  `).join("");
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

function render() {
  const radioInf = $("radioInfantil");
  const radioAdu = $("radioAdulto");
  const labelInf = $("labelInfantil");
  const labelAdu = $("labelAdulto");

  if (radioInf && radioAdu) {
    radioInf.checked = !showAdultTeeth;
    radioAdu.checked = showAdultTeeth;
  }

  // labels activos con tu gradiente
  const activeStyle = `linear-gradient(to right, ${BRAND.primary}, ${BRAND.accent})`;
  if (labelInf && labelAdu) {
    if (showAdultTeeth) {
      labelAdu.style.background = activeStyle;
      labelAdu.style.color = "#fff";
      labelInf.style.background = "transparent";
      labelInf.style.color = "";
    } else {
      labelInf.style.background = activeStyle;
      labelInf.style.color = "#fff";
      labelAdu.style.background = "transparent";
      labelAdu.style.color = "";
    }
  }

  const titulo = $("tituloDenticion");
  if (titulo) titulo.textContent = showAdultTeeth ? "Odontograma · Adulto" : "Odontograma · Infantil";

  const teeth = currentTeeth();
  $("filaSuperior").innerHTML = teeth.superior.map((n, idx) => renderToothButton(n, true, idx, teeth.superior.length)).join("");
  $("filaInferior").innerHTML = teeth.inferior.map((n, idx) => renderToothButton(n, false, idx, teeth.inferior.length)).join("");

  // Click dientes
  document.querySelectorAll("button[data-tooth]").forEach(btn => {
    btn.addEventListener("click", () => setSelected(parseInt(btn.getAttribute("data-tooth"), 10)));
  });

  // Panel tratamientos
  const panel = $("tratamientosPanel");
  if (selectedTooth && panel) {
    panel.classList.remove("hidden");
    $("piezaPanel").textContent = selectedTooth;
    renderTreatments();
  } else {
    panel?.classList.add("hidden");
    const list = $("listaTratamientos");
    if (list) list.innerHTML = "";
  }

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

  renderLegend();
}

// ===== INIT =====
async function init() {
  const pacienteId = getQueryParam("id");
  if (pacienteId) currentPacienteId = pacienteId;

  let ageDetected = false;
  if (currentPacienteId) {
    try {
      const paciente = await dbGet('SELECT fecha_nacimiento FROM pacientes WHERE id = ?', [currentPacienteId]);
      const edad = calculateAgeYears(paciente?.fecha_nacimiento);
      if (edad !== null) {
        showAdultTeeth = edad >= PEDIATRIC_MAX_YEARS;
        ageDetected = true;
      }
    } catch (e) {
      console.error('Error calculando edad de paciente:', e);
    }
  }

  // Deshabilitar radio buttons si la edad fue detectada automáticamente
  const radioInf = $("radioInfantil");
  const radioAdu = $("radioAdulto");
  const labelInf = $("labelInfantil");
  const labelAdu = $("labelAdulto");

  if (ageDetected) {
    if (radioInf) radioInf.disabled = true;
    if (radioAdu) radioAdu.disabled = true;
    // Deshabilitar también los labels para evitar clics
    if (labelInf) {
      labelInf.style.pointerEvents = 'none';
      labelInf.style.opacity = '0.6';
    }
    if (labelAdu) {
      labelAdu.style.pointerEvents = 'none';
      labelAdu.style.opacity = '0.6';
    }
  }

  // Radios
  radioInf?.addEventListener("change", (e) => {
    // No permitir cambios si la edad fue detectada automáticamente
    if (ageDetected) {
      radioInf.checked = !showAdultTeeth;
      return;
    }
    if (e.target.checked) { showAdultTeeth = false; clearSelected(); }
  });
  radioAdu?.addEventListener("change", (e) => {
    // No permitir cambios si la edad fue detectada automáticamente
    if (ageDetected) {
      radioAdu.checked = showAdultTeeth;
      return;
    }
    if (e.target.checked) { showAdultTeeth = true; clearSelected(); }
  });

  // Limpiar
  $("btnLimpiarSeleccion")?.addEventListener("click", () => {
    clearSelected();
    toast("Selección limpia", "info");
  });

  // Profilaxis dropdown
  const btn = $("btnProfilaxis");
  const dd = $("dropdownProfilaxis");
  if (btn && dd) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dd.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!btn.contains(e.target) && !dd.contains(e.target)) dd.classList.add("hidden");
    });

    dd.querySelectorAll("[data-treatment]").forEach(b => {
      b.addEventListener("click", async () => {
        const id = b.getAttribute("data-treatment");
        const treatment = treatments.find(t => t.id === id);

        if (!selectedTooth) {
          toast("Primero selecciona una pieza dental", "warn");
          dd.classList.add("hidden");
          return;
        }
        if (treatment) {
          await handleTreatmentSelect(treatment);
          dd.classList.add("hidden");
        }
      });
    });
  }

  // Cerrar panel
  $("btnCerrarPanel")?.addEventListener("click", clearSelected);

  // Modal buttons
  $("btnCancelarModal")?.addEventListener("click", cancelModal);
  $("btnGuardarModal")?.addEventListener("click", saveSurfaceSelection);

  // click afuera modal
  $("modalOverlay")?.addEventListener("click", (e) => {
    if (e.target === $("modalOverlay")) cancelModal();
  });

  // Esc para cerrar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (showSurfaceModal) cancelModal();
      else if (selectedTooth) clearSelected();
    }
  });

  // Hacer el panel arrastrable
  const panel = $("tratamientosPanel");
  const panelHeader = $("panelHeader");

  if (panel && panelHeader) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    panelHeader.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    // Touch events para móviles
    panelHeader.addEventListener("touchstart", dragStart);
    document.addEventListener("touchmove", drag);
    document.addEventListener("touchend", dragEnd);

    function dragStart(e) {
      if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
      } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
      }

      if (e.target === panelHeader || panelHeader.contains(e.target)) {
        // No arrastrar si se clickea el botón de cerrar
        if (e.target.closest('#btnCerrarPanel')) return;
        isDragging = true;
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();

        if (e.type === "touchmove") {
          currentX = e.touches[0].clientX - initialX;
          currentY = e.touches[0].clientY - initialY;
        } else {
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, panel);
      }
    }

    function dragEnd(e) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
      el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }
  }

  // Load treatment catalog first
  await loadTreatmentCatalog();

  // Cargar de BD
  if (currentPacienteId) await loadTreatmentsFromDB();

  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
