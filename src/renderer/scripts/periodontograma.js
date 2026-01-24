// periodontograma.js (Vanilla JS) - VERSIÓN MEJORADA VISUAL
// Integrado con base de datos y ficha clínica

// DB helpers
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
      if (db.get && db.get.length >= 3) {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      } else if (db.get) {
        db.get(sql, params).then(row => resolve(row)).catch(reject);
      } else {
        resolve(null);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve([]);
      if (db.all && db.all.length >= 3) {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else if (db.all) {
        db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
      } else {
        resolve([]);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve();
      if (db.run && db.run.length >= 3) {
        db.run(sql, params, (err) => {
          if (err) return reject(err);
          resolve();
        });
      } else if (db.run) {
        db.run(sql, params).then(resolve).catch(reject);
      } else {
        resolve();
      }
    } catch (e) {
      reject(e);
    }
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

const COLORS = {
  brand: "#1D5D69",
  accent: "#4EABBE",
  soft: "#8BCFDD",
  danger: "#EF4444",
  warn: "#EAB308",
  ok: "#22C55E",
  ink: "#0F2532",
  bg: "#F8F7F7",
  border: "#8BCFDD",
};

const ICONS = {
  tooth: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3c-3 0-5.5 2.2-5.5 5 0 1.6.7 3 1.8 4 .7.6 1.1 1.5 1.3 2.5.3 1.6 1 3.5 2.4 3.5 1.2 0 1.9-1.1 2-2.6.1 1.5.8 2.6 2 2.6 1.4 0 2.1-1.9 2.4-3.5.2-1 .6-1.9 1.3-2.5 1.1-1 1.8-2.4 1.8-4 0-2.8-2.5-5-5.5-5-.9 0-1.7.3-2.4.8-.4.3-.9.3-1.3 0C13.7 3.3 12.9 3 12 3z" />
  </svg>`,
  toothLg: `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3c-3 0-5.5 2.2-5.5 5 0 1.6.7 3 1.8 4 .7.6 1.1 1.5 1.3 2.5.3 1.6 1 3.5 2.4 3.5 1.2 0 1.9-1.1 2-2.6.1 1.5.8 2.6 2 2.6 1.4 0 2.1-1.9 2.4-3.5.2-1 .6-1.9 1.3-2.5 1.1-1 1.8-2.4 1.8-4 0-2.8-2.5-5-5.5-5-.9 0-1.7.3-2.4.8-.4.3-.9.3-1.3 0C13.7 3.3 12.9 3 12 3z" />
  </svg>`,
  chart: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3v18h18" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 17v-5" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 17V7" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 17V11" />
  </svg>`,
  chartLg: `<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3v18h18" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 17v-5" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 17V7" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 17V11" />
  </svg>`,
  check: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
  </svg>`,
  warn: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.65 18h16.7a1 1 0 00.86-1.5l-7.5-13a1 1 0 00-1.72 0z" />
  </svg>`,
  danger: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
  </svg>`,
  drop: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3s-5 5.2-5 9a5 5 0 0010 0c0-3.8-5-9-5-9z" />
  </svg>`,
  plaque: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" stroke-width="2" />
    <circle cx="6" cy="8" r="1" fill="currentColor" />
    <circle cx="18" cy="8" r="1" fill="currentColor" />
    <circle cx="6" cy="16" r="1" fill="currentColor" />
    <circle cx="18" cy="16" r="1" fill="currentColor" />
  </svg>`,
  checkBadge: `<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
  </svg>`,
};

function iconSpan(svg, color) {
  return `<span class="inline-flex items-center" style="color:${color}">${svg}</span>`;
}

function severityLabel(sev) {
  if (!sev) return "Sin datos";
  if (sev === COLORS.ok) return `${iconSpan(ICONS.check, COLORS.ok)} Saludable (0-3 mm)`;
  if (sev === COLORS.warn) return `${iconSpan(ICONS.warn, COLORS.warn)} Moderado (4-5 mm)`;
  return `${iconSpan(ICONS.danger, COLORS.danger)} Severo (>= 6 mm)`;
}

function pillLabel(text, color, svg) {
  return `<span class="inline-flex items-center gap-2">${iconSpan(svg, color)}<span>${text}</span></span>`;
}

const SITES = ["MB", "B", "DB", "ML", "L", "DL"];
const RANGE_PS = { min: 0, max: 15 };
const RANGE_REC = { min: -10, max: 10 };
const RANGE_03 = { min: 0, max: 3 };

const adultTeeth = {
  superior: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  inferior: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
};
const childTeeth = {
  superior: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  inferior: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
};

let showAdult = true;
let selectedTooth = null;

// perTooth[num] = { sites: {MB:{ps,rec,bop,plaque,supp}}, mobility, furcation }
let perTooth = {};

const $ = (id) => document.getElementById(id);

function getTeeth() {
  return showAdult ? adultTeeth : childTeeth;
}

function ensureTooth(num) {
  if (!perTooth[num]) {
    perTooth[num] = {
      sites: Object.fromEntries(SITES.map(s => [s, { ps: "", rec: "", bop: false, plaque: false, supp: false }])),
      mobility: 0,
      furcation: 0,
    };
  }
  return perTooth[num];
}

function clampInt(val, min, max) {
  if (val === "" || val === null || val === undefined) return "";
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return "";
  return Math.max(min, Math.min(max, n));
}

function psSeverityColor(psVal) {
  const ps = Number(psVal);
  if (!Number.isFinite(ps)) return null;
  if (ps >= 6) return COLORS.danger;
  if (ps >= 4) return COLORS.warn;
  return COLORS.ok;
}

function renderDentitionButtons() {
  const radioInf = $("radioInfantil");
  const radioAdu = $("radioAdulto");
  const labelDent = $("labelDenticion");

  if (radioInf && radioAdu) {
    radioInf.checked = !showAdult;
    radioAdu.checked = showAdult;
  }

  if (labelDent) {
    labelDent.textContent = showAdult ? "Adulto" : "Infantil";
  }
}

function toothHasAny(num) {
  const t = perTooth[num];
  if (!t) return false;
  if ((t.mobility || 0) > 0 || (t.furcation || 0) > 0) return true;
  return SITES.some(site => {
    const s = t.sites[site];
    return s.ps !== "" || s.rec !== "" || s.bop || s.plaque || s.supp;
  });
}

// Función mejorada para determinar el tipo de diente
function getToothType(num) {
  // Molares (tres raíces/grandes)
  if ([16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(num)) {
    return 'molar';
  }
  // Premolares (dos cúspides)
  if ([14, 15, 24, 25, 34, 35, 44, 45].includes(num)) {
    return 'premolar';
  }
  // Caninos (puntiagudos)
  if ([13, 23, 33, 43].includes(num)) {
    return 'canine';
  }
  // Incisivos (planos)
  if ([11, 12, 21, 22, 31, 32, 41, 42].includes(num)) {
    return 'incisor';
  }
  // Dientes infantiles
  if ([55, 54, 64, 65, 85, 84, 74, 75].includes(num)) {
    return 'child-molar';
  }
  if ([53, 63, 83, 73].includes(num)) {
    return 'child-canine';
  }
  if ([52, 51, 61, 62, 82, 81, 71, 72].includes(num)) {
    return 'child-incisor';
  }
  return 'molar';
}

// SVG alineado con el odontograma
function createToothSVG(num, isUpper, isSelected, hasData) {
  const toothType = getToothType(num).replace("child-", "");
  const width = 80;
  const height = 104;
  const strokeWidth = 2.6;
  const borderColor = isSelected ? COLORS.accent : "#CBD5E1";

  let path = "";
  const gradientId = `grad-${num}-${isUpper ? "u" : "l"}`;
  const shineId = `shine-${num}-${isUpper ? "u" : "l"}`;
  let detailPath = "";

  if (toothType === "molar") {
    if (isUpper) {
      path = `M ${width * 0.18} ${height * 0.12}
              L ${width * 0.45} ${height * 0.08}
              L ${width * 0.55} ${height * 0.08}
              L ${width * 0.82} ${height * 0.12}
              Q ${width * 0.92} ${height * 0.18} ${width * 0.92} ${height * 0.28}
              L ${width * 0.92} ${height * 0.72}
              Q ${width * 0.92} ${height * 0.86} ${width * 0.82} ${height * 0.92}
              L ${width * 0.18} ${height * 0.92}
              Q ${width * 0.08} ${height * 0.86} ${width * 0.08} ${height * 0.72}
              L ${width * 0.08} ${height * 0.28}
              Q ${width * 0.08} ${height * 0.18} ${width * 0.18} ${height * 0.12}
              Z`;
      detailPath = `
        <path d="M ${width * 0.25} ${height * 0.16} L ${width * 0.5} ${height * 0.36}"
              stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
        <path d="M ${width * 0.75} ${height * 0.16} L ${width * 0.5} ${height * 0.36}"
              stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
        <path d="M ${width * 0.5} ${height * 0.26} L ${width * 0.5} ${height * 0.56}"
              stroke="rgba(15,37,50, 0.10)" stroke-width="1" fill="none"/>
      `;
    } else {
      path = `M ${width * 0.18} ${height * 0.08}
              L ${width * 0.82} ${height * 0.08}
              Q ${width * 0.92} ${height * 0.14} ${width * 0.92} ${height * 0.28}
              L ${width * 0.92} ${height * 0.72}
              Q ${width * 0.92} ${height * 0.82} ${width * 0.82} ${height * 0.88}
              L ${width * 0.55} ${height * 0.92}
              L ${width * 0.45} ${height * 0.92}
              L ${width * 0.18} ${height * 0.88}
              Q ${width * 0.08} ${height * 0.82} ${width * 0.08} ${height * 0.72}
              L ${width * 0.08} ${height * 0.28}
              Q ${width * 0.08} ${height * 0.14} ${width * 0.18} ${height * 0.08}
              Z`;
      detailPath = `
        <path d="M ${width * 0.25} ${height * 0.84} L ${width * 0.5} ${height * 0.64}"
              stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
        <path d="M ${width * 0.75} ${height * 0.84} L ${width * 0.5} ${height * 0.64}"
              stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
      `;
    }
  } else if (toothType === "premolar") {
    if (isUpper) {
      path = `M ${width * 0.22} ${height * 0.15}
              L ${width * 0.5} ${height * 0.10}
              L ${width * 0.78} ${height * 0.15}
              Q ${width * 0.88} ${height * 0.22} ${width * 0.88} ${height * 0.32}
              L ${width * 0.88} ${height * 0.70}
              Q ${width * 0.88} ${height * 0.84} ${width * 0.78} ${height * 0.90}
              L ${width * 0.22} ${height * 0.90}
              Q ${width * 0.12} ${height * 0.84} ${width * 0.12} ${height * 0.70}
              L ${width * 0.12} ${height * 0.32}
              Q ${width * 0.12} ${height * 0.22} ${width * 0.22} ${height * 0.15}
              Z`;
      detailPath = `
        <path d="M ${width * 0.35} ${height * 0.20} L ${width * 0.5} ${height * 0.35}"
              stroke="rgba(15,37,50, 0.11)" stroke-width="1.1" fill="none"/>
        <path d="M ${width * 0.65} ${height * 0.20} L ${width * 0.5} ${height * 0.35}"
              stroke="rgba(15,37,50, 0.11)" stroke-width="1.1" fill="none"/>
      `;
    } else {
      path = `M ${width * 0.22} ${height * 0.10}
              L ${width * 0.78} ${height * 0.10}
              Q ${width * 0.88} ${height * 0.16} ${width * 0.88} ${height * 0.30}
              L ${width * 0.88} ${height * 0.68}
              Q ${width * 0.88} ${height * 0.78} ${width * 0.78} ${height * 0.85}
              L ${width * 0.5} ${height * 0.90}
              L ${width * 0.22} ${height * 0.85}
              Q ${width * 0.12} ${height * 0.78} ${width * 0.12} ${height * 0.68}
              L ${width * 0.12} ${height * 0.30}
              Q ${width * 0.12} ${height * 0.16} ${width * 0.22} ${height * 0.10}
              Z`;
      detailPath = `
        <path d="M ${width * 0.35} ${height * 0.80} L ${width * 0.5} ${height * 0.65}"
              stroke="rgba(15,37,50, 0.11)" stroke-width="1.1" fill="none"/>
        <path d="M ${width * 0.65} ${height * 0.80} L ${width * 0.5} ${height * 0.65}"
              stroke="rgba(15,37,50, 0.11)" stroke-width="1.1" fill="none"/>
      `;
    }
  } else if (toothType === "canine") {
    if (isUpper) {
      path = `M ${width * 0.25} ${height * 0.15}
              Q ${width * 0.15} ${height * 0.25} ${width * 0.18} ${height * 0.35}
              L ${width * 0.18} ${height * 0.70}
              Q ${width * 0.15} ${height * 0.82} ${width * 0.25} ${height * 0.90}
              L ${width * 0.75} ${height * 0.90}
              Q ${width * 0.85} ${height * 0.82} ${width * 0.82} ${height * 0.70}
              L ${width * 0.82} ${height * 0.35}
              Q ${width * 0.85} ${height * 0.25} ${width * 0.75} ${height * 0.15}
              L ${width * 0.5} ${height * 0.08}
              Z`;
      detailPath = `
        <path d="M ${width * 0.5} ${height * 0.14} L ${width * 0.5} ${height * 0.54}"
              stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
      `;
    } else {
      path = `M ${width * 0.25} ${height * 0.10}
              Q ${width * 0.15} ${height * 0.18} ${width * 0.18} ${height * 0.30}
              L ${width * 0.18} ${height * 0.65}
              Q ${width * 0.15} ${height * 0.75} ${width * 0.25} ${height * 0.85}
              L ${width * 0.5} ${height * 0.92}
              L ${width * 0.75} ${height * 0.85}
              Q ${width * 0.85} ${height * 0.75} ${width * 0.82} ${height * 0.65}
              L ${width * 0.82} ${height * 0.30}
              Q ${width * 0.85} ${height * 0.18} ${width * 0.75} ${height * 0.10}
              Z`;
      detailPath = `
        <path d="M ${width * 0.5} ${height * 0.88} L ${width * 0.5} ${height * 0.50}"
              stroke="rgba(15,37,50, 0.12)" stroke-width="1.2" fill="none"/>
      `;
    }
  } else {
    if (isUpper) {
      path = `M ${width * 0.25} ${height * 0.12}
              Q ${width * 0.20} ${height * 0.18} ${width * 0.20} ${height * 0.28}
              L ${width * 0.20} ${height * 0.72}
              Q ${width * 0.20} ${height * 0.84} ${width * 0.25} ${height * 0.90}
              L ${width * 0.75} ${height * 0.90}
              Q ${width * 0.80} ${height * 0.84} ${width * 0.80} ${height * 0.72}
              L ${width * 0.80} ${height * 0.28}
              Q ${width * 0.80} ${height * 0.18} ${width * 0.75} ${height * 0.12}
              Z`;
      detailPath = `
        <path d="M ${width * 0.35} ${height * 0.30} Q ${width * 0.5} ${height * 0.35} ${width * 0.65} ${height * 0.30}"
              stroke="rgba(15,37,50, 0.10)" stroke-width="1" fill="none"/>
      `;
    } else {
      path = `M ${width * 0.25} ${height * 0.10}
              Q ${width * 0.20} ${height * 0.16} ${width * 0.20} ${height * 0.28}
              L ${width * 0.20} ${height * 0.72}
              Q ${width * 0.20} ${height * 0.82} ${width * 0.25} ${height * 0.88}
              L ${width * 0.75} ${height * 0.88}
              Q ${width * 0.80} ${height * 0.82} ${width * 0.80} ${height * 0.72}
              L ${width * 0.80} ${height * 0.28}
              Q ${width * 0.80} ${height * 0.16} ${width * 0.75} ${height * 0.10}
              Z`;
      detailPath = `
        <path d="M ${width * 0.35} ${height * 0.70} Q ${width * 0.5} ${height * 0.65} ${width * 0.65} ${height * 0.70}"
              stroke="rgba(15,37,50, 0.10)" stroke-width="1" fill="none"/>
      `;
    }
  }

  const miniChart = hasData ? miniChartSVGImproved(num) : "";

  const t = perTooth[num];
  let warningIndicators = "";
  if (t) {
    let hasWarning = false;
    let hasDanger = false;

    SITES.forEach(site => {
      const ps = Number(t.sites[site].ps);
      if (Number.isFinite(ps)) {
        if (ps >= 6) hasDanger = true;
        else if (ps >= 4) hasWarning = true;
      }
    });

    if (hasDanger) {
      warningIndicators = `
        <circle cx="${width - 12}" cy="12" r="6" fill="${COLORS.danger}" opacity="0.9">
          <animate attributeName="r" values="6;7;6" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x="${width - 12}" y="15" text-anchor="middle" font-size="8" font-weight="bold" fill="white">!</text>
      `;
    } else if (hasWarning) {
      warningIndicators = `
        <circle cx="${width - 12}" cy="12" r="5" fill="${COLORS.warn}" opacity="0.85"/>
        <text x="${width - 12}" y="14.5" text-anchor="middle" font-size="7" font-weight="bold" fill="white">!</text>
      `;
    }
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-full">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
          <stop offset="55%" style="stop-color:#F5FAFD;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ECF2F5;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="${shineId}" cx="50%" cy="${isUpper ? "30%" : "70%"}">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.72);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
        </radialGradient>
      </defs>

      <path d="${path}" fill="url(#${gradientId})" stroke="${borderColor}" stroke-width="${strokeWidth}" />
      ${detailPath}
      <ellipse cx="${width * 0.5}" cy="${isUpper ? height * 0.3 : height * 0.7}"
               rx="${width * 0.28}" ry="${height * 0.18}"
               fill="url(#${shineId})" opacity="0.7"/>
      ${miniChart}
      ${warningIndicators}
    </svg>
  `;
}

function toothButton(num) {
  const isSel = selectedTooth === num;
  const hasAny = toothHasAny(num);
  const teeth = getTeeth();
  const isUpper = teeth.superior.includes(num);

  const border = isSel ? COLORS.accent : "#CBD5E1";
  const shadow = isSel
    ? "0 0 0 4px rgba(78,171,190,0.18), 0 18px 40px rgba(15,37,50,.16)"
    : hasAny
      ? "0 0 0 3px rgba(78,171,190,0.18), 0 14px 26px rgba(15,37,50,.14)"
      : "0 10px 22px rgba(15,37,50,.10)";
  const badge = hasAny ? `
    <span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-[#4EABBE] to-[#1D5D69] border-2 border-white dark:border-[#0E1A25] flex items-center justify-center shadow-lg animate-pulse">
      ${ICONS.checkBadge}
    </span>
  ` : "";

  return `
    <div class="flex flex-col items-center gap-2 group">
      <button data-tooth="${num}"
        class="relative rounded-2xl border-2 bg-white dark:bg-[#0B1721] transition-all duration-300 hover:scale-110 hover:shadow-2xl overflow-hidden"
        style="border-color:${border}; box-shadow:${shadow};"
        title="Pieza ${num} - Click para seleccionar"
      >
        ${badge}
        ${createToothSVG(num, isUpper, isSel, hasAny)}
        <div class="absolute inset-0 bg-gradient-to-t from-transparent to-white dark:to-[#0B1721] opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"></div>
      </button>
      <span class="text-xs font-bold text-[#1D5D69] dark:text-white opacity-60 group-hover:opacity-100 group-hover:text-[#4EABBE] transition-all">${num}</span>
    </div>
  `;
}

function renderToothRows() {
  const teeth = getTeeth();
  $("filaSuperior").innerHTML = teeth.superior.map(toothButton).join("");
  $("filaInferior").innerHTML = teeth.inferior.map(toothButton).join("");

  document.querySelectorAll("[data-tooth]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedTooth = parseInt(btn.getAttribute("data-tooth"), 10);
      ensureTooth(selectedTooth);
      render();
    });
  });
}

function renderSelectedLabels() {
  $("piezaSeleccionada").textContent = selectedTooth ? String(selectedTooth) : "--";
  $("labelPiezaPanel").textContent = selectedTooth ? String(selectedTooth) : "--";
}

function inputNumber(id, value, placeholder, min, max, highlightColor = null) {
  const border = highlightColor || COLORS.soft;
  return `
    <input
      id="${id}"
      inputmode="numeric"
      class="w-full px-3 py-2.5 rounded-xl border-2 focus:outline-none transition-all bg-white dark:bg-[#0B1721] text-[#0F2532] dark:text-slate-200 focus:ring-2 focus:ring-[#4EABBE] hover:border-[#4EABBE]"
      style="border-color:${border}"
      placeholder="${placeholder} (${min}-${max})"
      value="${value}"
    />
  `;
}

function togglePill(id, active, label) {
  return `
    <button
      id="${id}"
      class="px-3 py-2 rounded-xl font-semibold border-2 transition-all hover:scale-105 text-sm shadow-sm hover:shadow-md"
      style="
        border-color:${active ? COLORS.accent : COLORS.soft};
        background:${active ? "linear-gradient(135deg, rgba(78,171,190,0.18), rgba(139,207,221,0.12))" : "transparent"};
        color:inherit;
      "
      type="button"
    >${label}</button>
  `;
}

function selectPillBlock(key, value, label) {
  const opts = [0, 1, 2, 3].map(v => `
    <button data-pill="${key}" data-val="${v}"
      class="px-4 py-2.5 rounded-xl font-bold border-2 transition-all hover:scale-105 text-sm shadow-sm"
      style="
        border-color:${value === v ? COLORS.accent : COLORS.soft};
        background:${value === v ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.brand})` : "transparent"};
        color:${value === v ? "#FFF" : "inherit"};
      "
      type="button"
    >${v}</button>
  `).join("");

  return `
    <div class="p-4 rounded-xl bg-gradient-to-br from-[#F8F7F7] to-white dark:from-[#0B1721] dark:to-[#0E1A25] border-2 border-[#D9D9D9] dark:border-slate-700 shadow-md">
      <div class="flex items-center justify-between mb-3">
        <div class="font-bold text-[#1D5D69] dark:text-white text-sm">${label}</div>
        <div class="text-xs opacity-70 text-[#0F2532] dark:text-slate-300 bg-[#8BCFDD]/10 px-2 py-1 rounded-lg">0-3</div>
      </div>
      <div class="flex gap-2 flex-wrap">${opts}</div>
    </div>
  `;
}

function renderToothDetail() {
  const cont = $("detallePieza");
  if (!selectedTooth) {
    if (cont) {
      cont.innerHTML = `
        <div class="xl:col-span-2 p-8 rounded-2xl bg-gradient-to-br from-[#F8F7F7] to-white dark:from-[#0B1721] dark:to-[#0E1A25] border-2 border-dashed border-[#8BCFDD]/50 dark:border-slate-700 text-center">
          <div class="text-6xl mb-4 opacity-30 text-[#8BCFDD]">${ICONS.toothLg}</div>
          <div class="text-xl font-bold text-[#1D5D69] dark:text-white mb-2">Selecciona una pieza dental</div>
          <div class="text-sm opacity-70 text-[#0F2532] dark:text-slate-300">Haz clic en cualquier diente arriba para comenzar el registro periodontal.</div>
        </div>
      `;
    }
    const chartEl = $("chartSelectedTooth");
    if (chartEl) chartEl.innerHTML = `
      <div class="flex items-center justify-center h-48 text-center">
        <div>
          <div class="text-4xl mb-3 opacity-20 text-[#8BCFDD]">${ICONS.chartLg}</div>
          <div class="text-sm opacity-60 text-[#0F2532] dark:text-slate-400">La grafica aparecera al seleccionar un diente</div>
        </div>
      </div>
    `;
    return;
  }

  const t = ensureTooth(selectedTooth);

  // Chart grande mejorado
  $("chartSelectedTooth").innerHTML = bigChartSVGImproved(selectedTooth);

  const blocks = SITES.map(site => {
    const s = t.sites[site];
    const sev = psSeverityColor(s.ps);

    return `
      <div class="p-4 rounded-2xl bg-gradient-to-br from-[#F8F7F7] via-white to-[#F8F7F7] dark:from-[#0B1721] dark:via-[#0E1A25] dark:to-[#0E1A25] border-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]" 
           style="border-color:${sev || COLORS.soft}">
        <div class="flex items-center justify-between mb-4 pb-3 border-b-2 border-[#8BCFDD]/30 dark:border-slate-700">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-md" 
                  style="background:linear-gradient(135deg, ${sev || COLORS.soft}, ${sev ? (sev === COLORS.ok ? '#15803D' : sev === COLORS.warn ? '#CA8A04' : '#B91C1C') : COLORS.brand})">${site}</span>
            <div class="text-base font-bold" style="color:${COLORS.brand}">Sitio ${site}</div>
          </div>
          <div class="text-xs opacity-70 text-[#0F2532] dark:text-slate-300 font-medium bg-[#8BCFDD]/10 px-3 py-1 rounded-lg">CAL = PS + REC</div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold mb-2 uppercase tracking-wider opacity-70 text-[#1D5D69] dark:text-white">Profundidad de Sondaje (PS)</label>
            ${inputNumber(`ps_${site}`, s.ps, "PS", RANGE_PS.min, RANGE_PS.max, sev)}
            <div class="mt-2 p-2 rounded-lg text-xs bg-[#F8F7F7] dark:bg-[#0B1721] border border-[#D9D9D9] dark:border-slate-700">
              <span class="opacity-70">Severidad:</span> 
              <span class="font-bold ml-1" style="color:${sev || COLORS.ink}">
                ${severityLabel(sev)}
              </span>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold mb-2 uppercase tracking-wider opacity-70 text-[#1D5D69] dark:text-white">Recesion / Margen Gingival</label>
            ${inputNumber(`rec_${site}`, s.rec, "REC/MG", RANGE_REC.min, RANGE_REC.max)}
            <div class="mt-2 p-2 rounded-lg text-xs bg-gradient-to-r from-[#8BCFDD]/10 to-[#4EABBE]/10 border border-[#8BCFDD]/30">
              <span class="opacity-70">CAL estimado:</span> 
              <span id="cal_${site}" class="font-bold text-[#1D5D69] dark:text-white ml-1">${calcCAL(s.ps, s.rec)}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mt-4">
          ${togglePill(`bop_${site}`, !!s.bop, pillLabel("BOP", COLORS.danger, ICONS.drop))}
          ${togglePill(`plq_${site}`, !!s.plaque, pillLabel("Placa", COLORS.warn, ICONS.plaque))}
          ${togglePill(`sup_${site}`, !!s.supp, pillLabel("Supuracion", COLORS.accent, ICONS.drop))}
        </div>
      </div>
    `;
  }).join("");

  const extra = `
    <div class="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      ${selectPillBlock("mob", clampInt(t.mobility, 0, 3) || 0, "Movilidad Dental")}
      ${selectPillBlock("fur", clampInt(t.furcation, 0, 3) || 0, "Compromiso de Furcacion")}
    </div>
  `;

  cont.innerHTML = blocks + extra;

  // Bind inputs / toggles
  SITES.forEach(site => {
    const psEl = $(`ps_${site}`);
    const recEl = $(`rec_${site}`);

    psEl.addEventListener("input", () => {
      const v = clampInt(psEl.value, RANGE_PS.min, RANGE_PS.max);
      t.sites[site].ps = v === "" ? "" : v;
      if (String(v) !== String(psEl.value)) psEl.value = v;

      $(`cal_${site}`).textContent = calcCAL(t.sites[site].ps, t.sites[site].rec);
      refreshAfterEdit();
    });

    recEl.addEventListener("input", () => {
      const v = clampInt(recEl.value, RANGE_REC.min, RANGE_REC.max);
      t.sites[site].rec = v === "" ? "" : v;
      if (String(v) !== String(recEl.value)) recEl.value = v;

      $(`cal_${site}`).textContent = calcCAL(t.sites[site].ps, t.sites[site].rec);
      refreshAfterEdit();
    });

    $(`bop_${site}`).addEventListener("click", () => { t.sites[site].bop = !t.sites[site].bop; refreshAfterEdit(true); });
    $(`plq_${site}`).addEventListener("click", () => { t.sites[site].plaque = !t.sites[site].plaque; refreshAfterEdit(true); });
    $(`sup_${site}`).addEventListener("click", () => { t.sites[site].supp = !t.sites[site].supp; refreshAfterEdit(true); });
  });

  document.querySelectorAll('[data-pill="mob"]').forEach(btn => {
    btn.addEventListener("click", () => { t.mobility = parseInt(btn.getAttribute("data-val"), 10); refreshAfterEdit(true); });
  });
  document.querySelectorAll('[data-pill="fur"]').forEach(btn => {
    btn.addEventListener("click", () => { t.furcation = parseInt(btn.getAttribute("data-val"), 10); refreshAfterEdit(true); });
  });
}

function refreshAfterEdit(reRenderFull = false) {
  const chartEl = $("chartSelectedTooth");
  if (chartEl) {
    chartEl.innerHTML = selectedTooth ? bigChartSVGImproved(selectedTooth) : `
      <div class="flex items-center justify-center h-48">
        <div class="text-sm opacity-60 text-[#0F2532] dark:text-slate-400">Selecciona un diente</div>
      </div>
    `;
  }
  renderSummary();
  renderToothRows();
  if (reRenderFull) renderSelectedLabels();
  autoSave();
}

function calcCAL(ps, rec) {
  const p = Number(ps);
  const r = Number(rec);
  if (!Number.isFinite(p) || !Number.isFinite(r)) return "--";
  return String(p + r) + " mm";
}

function computeToothStats(num) {
  const t = perTooth[num];
  if (!t) return null;

  let countSites = 0;
  let sumPS = 0;
  let sumREC = 0;
  let sumCAL = 0;

  let bop = 0;
  let plaque = 0;
  let supp = 0;

  SITES.forEach(site => {
    const s = t.sites[site];
    const has = (s.ps !== "" || s.rec !== "" || s.bop || s.plaque || s.supp);
    if (has) countSites++;

    const p = Number(s.ps);
    const r = Number(s.rec);
    if (Number.isFinite(p)) sumPS += p;
    if (Number.isFinite(r)) sumREC += r;
    if (Number.isFinite(p) && Number.isFinite(r)) sumCAL += (p + r);

    if (s.bop) bop++;
    if (s.plaque) plaque++;
    if (s.supp) supp++;
  });

  return {
    countSites,
    avgPS: sumPS / 6,
    avgREC: sumREC / 6,
    avgCAL: sumCAL / 6,
    bop, plaque, supp,
    mobility: t.mobility || 0,
    furcation: t.furcation || 0,
  };
}

function renderSummary() {
  if (selectedTooth) {
    const st = computeToothStats(selectedTooth);
    $("avgPS").textContent = st ? st.avgPS.toFixed(1) + " mm" : "--";
    $("avgREC").textContent = st ? st.avgREC.toFixed(1) + " mm" : "--";
    $("avgCAL").textContent = st ? st.avgCAL.toFixed(1) + " mm" : "--";
    $("pctBOP").textContent = st ? Math.round((st.bop / 6) * 100) + "%" : "--";
    $("pctPlaca").textContent = st ? Math.round((st.plaque / 6) * 100) + "%" : "--";
    $("cntSuppTooth").textContent = st ? String(st.supp) : "--";
  } else {
    $("avgPS").textContent = "--";
    $("avgREC").textContent = "--";
    $("avgCAL").textContent = "--";
    $("pctBOP").textContent = "--";
    $("pctPlaca").textContent = "--";
    $("cntSuppTooth").textContent = "--";
  }

  let totalSites = 0, totalBOP = 0, totalPlaca = 0, totalSupp = 0, totalMov = 0, totalFur = 0;
  Object.keys(perTooth).forEach(k => {
    const num = parseInt(k, 10);
    const st = computeToothStats(num);
    if (!st) return;

    totalSites += st.countSites;
    totalBOP += st.bop;
    totalPlaca += st.plaque;
    totalSupp += st.supp;
    if (st.mobility >= 1) totalMov++;
    if (st.furcation >= 1) totalFur++;
  });

  $("totalSitios").textContent = String(totalSites);
  $("totalBOP").textContent = String(totalBOP);
  $("totalPlaca").textContent = String(totalPlaca);
  $("totalSupp").textContent = String(totalSupp);
  $("totalMov").textContent = String(totalMov);
  $("totalFur").textContent = String(totalFur);
}

/* ============ CHARTS SVG MEJORADOS ============ */

function miniChartSVGImproved(toothNum) {
  const t = perTooth[toothNum];
  if (!t) return "";

  const w = 66, h = 22, pad = 2;
  const ptsPS = [];
  let hasData = false;
  let maxPS = 0;

  for (let i = 0; i < SITES.length; i++) {
    const s = t.sites[SITES[i]];
    const p = Number(s.ps);
    if (Number.isFinite(p)) {
      hasData = true;
      maxPS = Math.max(maxPS, p);
      const x = pad + (i * (w - pad * 2) / (SITES.length - 1));
      const normalizedPS = Math.min(p / 10, 1); // Normalizar a escala 0-1
      const y = h - pad - (normalizedPS * (h - pad * 2));
      ptsPS.push([x, y, p]);
    }
  }

  if (!hasData || ptsPS.length < 2) return "";

  // Crear path suavizado
  let d = `M ${ptsPS[0][0]} ${ptsPS[0][1]}`;
  for (let i = 1; i < ptsPS.length; i++) {
    const prevX = ptsPS[i - 1][0];
    const prevY = ptsPS[i - 1][1];
    const currX = ptsPS[i][0];
    const currY = ptsPS[i][1];
    const cpX = (prevX + currX) / 2;
    d += ` Q ${cpX} ${prevY}, ${cpX} ${(prevY + currY) / 2} Q ${cpX} ${currY}, ${currX} ${currY}`;
  }

  // Area fill
  const areaPath = d + ` L ${ptsPS[ptsPS.length - 1][0]} ${h - pad} L ${ptsPS[0][0]} ${h - pad} Z`;

  const severity = maxPS >= 6 ? COLORS.danger : (maxPS >= 4 ? COLORS.warn : COLORS.ok);

  return `
    <g transform="translate(7, 74)">
      <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs>
          <linearGradient id="miniGrad-${toothNum}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${severity};stop-opacity:0.4" />
            <stop offset="100%" style="stop-color:${severity};stop-opacity:0.05" />
          </linearGradient>
        </defs>
        <!-- Fondo -->
        <rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" 
              fill="rgba(255,255,255,0.95)" rx="3" stroke="rgba(139,207,221,0.3)" stroke-width="0.5"/>
        <!-- Area bajo la curva -->
        <path d="${areaPath}" fill="url(#miniGrad-${toothNum})"/>
        <!-- Línea del gráfico -->
        <path d="${d}" fill="none" stroke="${severity}" stroke-width="2" 
              stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Puntos -->
        ${ptsPS.map(([x, y, ps]) => `
          <circle cx="${x}" cy="${y}" r="1.8" fill="white" stroke="${severity}" stroke-width="1.2"/>
          ${ps >= 6 ? `<circle cx="${x}" cy="${y}" r="0.8" fill="${severity}"/>` : ''}
        `).join('')}
      </svg>
    </g>
  `;
}

function bigChartSVGImproved(toothNum) {
  const t = perTooth[toothNum];
  if (!t) return `<div class="flex items-center justify-center h-48"><div class="text-sm opacity-60 text-[#0F2532] dark:text-slate-400">Sin datos</div></div>`;

  const w = 800;
  const h = 280;
  const padL = 60, padR = 24, padT = 24, padB = 50;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  // Bandas de severidad
  const bandY = (mm) => padT + (innerH * (1 - (mm / 15)));
  const y3 = bandY(3);
  const y5 = bandY(5);
  const y6 = bandY(6);

  const ptsPS = [];
  const ptsREC = [];
  const ptsCAL = [];

  for (let i = 0; i < SITES.length; i++) {
    const site = SITES[i];
    const s = t.sites[site];

    const x = padL + (i * innerW / (SITES.length - 1));

    const p = Number(s.ps);
    const r = Number(s.rec);

    ptsPS.push([x, Number.isFinite(p) ? mapPSBig(p, padT, innerH) : null, site, p, s.bop]);
    ptsREC.push([x, Number.isFinite(r) ? mapRECBig(r, padT, innerH) : null, site, r]);

    const cal = (Number.isFinite(p) && Number.isFinite(r)) ? (p + r) : null;
    ptsCAL.push([x, cal !== null ? mapCALBig(cal, padT, innerH) : null, site, cal]);
  }

  const dPS = smoothPath(ptsPS.filter(p => p[1] !== null));
  const dREC = smoothPath(ptsREC.filter(p => p[1] !== null));
  const dCAL = smoothPath(ptsCAL.filter(p => p[1] !== null));

  // Grid lines
  const yTicks = [0, 3, 5, 6, 10, 15].map(mm => {
    const y = bandY(mm);
    const isDanger = mm === 6;
    const isWarn = mm === 5;
    const isOk = mm === 3;
    return `<g>
      <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" 
            stroke="${isDanger ? 'rgba(239,68,68,0.2)' : isWarn ? 'rgba(234,179,8,0.2)' : isOk ? 'rgba(34,197,94,0.2)' : 'rgba(15,37,50,0.06)'}" 
            stroke-width="${(isDanger || isWarn || isOk) ? '1.5' : '1'}"
            stroke-dasharray="${(isDanger || isWarn || isOk) ? '5 3' : ''}"/>
      <text x="${padL - 12}" y="${y + 4}" text-anchor="end" font-size="11" font-weight="${(isDanger || isWarn || isOk) ? 'bold' : 'normal'}" 
            fill="${isDanger ? COLORS.danger : isWarn ? COLORS.warn : isOk ? COLORS.ok : 'rgba(15,37,50,0.6)'}">${mm} mm</text>
    </g>`;
  }).join("");

  // X labels con iconos
  const xLabels = SITES.map((site, i) => {
    const x = padL + (i * innerW / (SITES.length - 1));
    const s = t.sites[site];
    const hasBOP = s.bop;
    const hasPlaque = s.plaque;
    const hasSupp = s.supp;

    const markers = [];
    if (hasBOP) markers.push(COLORS.danger);
    if (hasPlaque) markers.push(COLORS.warn);
    if (hasSupp) markers.push(COLORS.accent);

    const markerGap = 8;
    const startX = x - ((markers.length - 1) * markerGap) / 2;
    const markerDots = markers.map((color, idx) => `
      <circle cx="${startX + (idx * markerGap)}" cy="${h - 12}" r="3" fill="${color}"/>
    `).join("");

    return `<g>
      <text x="${x}" y="${h - 28}" text-anchor="middle" font-size="13" font-weight="bold" fill="${COLORS.brand}">${site}</text>
      ${markerDots}
    </g>`;
  }).join("");

  // PS points con severidad
  const psDots = ptsPS.filter(p => p[1] !== null).map(([x, y, site, ps, bop]) => {
    const c = psSeverityColor(ps);
    const r = bop ? 6 : 5;
    return `
      <circle cx="${x}" cy="${y}" r="${r + 2}" fill="white" opacity="0.8"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.95" stroke="white" stroke-width="1.5">
        <animate attributeName="r" values="${r};${r + 1};${r}" dur="2s" repeatCount="indefinite"/>
      </circle>
      ${bop ? `<circle cx="${x}" cy="${y}" r="2" fill="white"/>` : ''}
    `;
  }).join("");

  // REC points
  const recDots = ptsREC.filter(p => p[1] !== null).map(([x, y]) => `
    <circle cx="${x}" cy="${y}" r="4" fill="${COLORS.brand}" opacity="0.8" stroke="white" stroke-width="1"/>
  `).join("");

  // CAL points
  const calDots = ptsCAL.filter(p => p[1] !== null).map(([x, y]) => `
    <circle cx="${x}" cy="${y}" r="3.5" fill="none" stroke="${COLORS.warn}" stroke-width="2" opacity="0.9"/>
  `).join("");

  // Legend mejorada
  const legend = `
    <g>
      <rect x="${padL}" y="${padT}" width="340" height="42" rx="12" fill="rgba(255,255,255,0.95)" stroke="rgba(15,37,50,0.1)" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"/>
      
      <circle cx="${padL + 20}" cy="${padT + 21}" r="5" fill="${COLORS.accent}" stroke="white" stroke-width="1.5"/>
      <text x="${padL + 32}" y="${padT + 25}" font-size="12" font-weight="600" fill="${COLORS.ink}">Profundidad de Sondaje (PS)</text>

      <line x1="${padL + 190}" y1="${padT + 21}" x2="${padL + 215}" y2="${padT + 21}" stroke="${COLORS.brand}" stroke-width="3" stroke-linecap="round"/>
      <text x="${padL + 222}" y="${padT + 25}" font-size="12" font-weight="600" fill="${COLORS.ink}">REC/MG</text>

      <line x1="${padL + 285}" y1="${padT + 21}" x2="${padL + 310}" y2="${padT + 21}" stroke="${COLORS.warn}" stroke-width="3" stroke-dasharray="6 4" stroke-linecap="round"/>
      <text x="${padL + 317}" y="${padT + 25}" font-size="12" font-weight="600" fill="${COLORS.ink}">CAL</text>
    </g>
  `;

  return `
    <svg viewBox="0 0 ${w} ${h}" class="min-w-[800px] w-full">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#F8F7F7;stop-opacity:1" />
        </linearGradient>
        <filter id="chartShadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2"/>
          <feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- Fondo principal -->
      <rect x="${padL}" y="${padT}" width="${innerW}" height="${innerH}" rx="16" fill="url(#bgGrad)" stroke="rgba(15,37,50,0.08)" stroke-width="2"/>
      
      <!-- Bandas de severidad con gradientes -->
      <defs>
        <linearGradient id="dangerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(239,68,68,0.08)" />
          <stop offset="100%" style="stop-color:rgba(239,68,68,0.03)" />
        </linearGradient>
        <linearGradient id="warnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(234,179,8,0.1)" />
          <stop offset="100%" style="stop-color:rgba(234,179,8,0.04)" />
        </linearGradient>
        <linearGradient id="okGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(34,197,94,0.08)" />
          <stop offset="100%" style="stop-color:rgba(34,197,94,0.03)" />
        </linearGradient>
      </defs>
      
      <rect x="${padL}" y="${padT}" width="${innerW}" height="${y6 - padT}" fill="url(#dangerGrad)" rx="16"/>
      <rect x="${padL}" y="${y5}" width="${innerW}" height="${y3 - y5}" fill="url(#warnGrad)"/>
      <rect x="${padL}" y="${y3}" width="${innerW}" height="${(padT + innerH) - y3}" fill="url(#okGrad)"/>

      ${yTicks}
      ${legend}
      ${xLabels}

      <!-- Líneas de datos con sombras -->
      <g filter="url(#chartShadow)">
        <path d="${dPS}" fill="none" stroke="${COLORS.accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
        <path d="${dREC}" fill="none" stroke="${COLORS.brand}" stroke-width="3" opacity="0.85" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${dCAL}" fill="none" stroke="${COLORS.warn}" stroke-width="3" stroke-dasharray="6 4" opacity="0.85" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      ${recDots}
      ${calDots}
      ${psDots}
    </svg>
  `;
}

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  let d = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpX = (curr[0] + next[0]) / 2;
    d += ` Q ${cpX} ${curr[1]}, ${cpX} ${(curr[1] + next[1]) / 2} Q ${cpX} ${next[1]}, ${next[0]} ${next[1]}`;
  }

  return d;
}

function mapPSBig(p, padT, innerH) {
  const v = Math.max(0, Math.min(15, p));
  return padT + (innerH * (1 - (v / 15)));
}

function mapRECBig(r, padT, innerH) {
  const v = Math.max(-10, Math.min(10, r));
  const scaled = ((v + 10) / 20) * 15;
  return padT + (innerH * (1 - (scaled / 15)));
}

function mapCALBig(cal, padT, innerH) {
  const v = Math.max(0, Math.min(15, cal));
  return padT + (innerH * (1 - (v / 15)));
}

/* =============== PRINT VIEW =============== */
function buildPrintTableHTML() {
  const teeth = getTeeth();
  const all = [...teeth.superior, ...teeth.inferior];

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${all.map(num => printToothBlock(num)).join("")}
    </div>
  `;
}

function printToothBlock(num) {
  const t = perTooth[num];
  const empty = !t;

  const rows = SITES.map(site => {
    const s = t?.sites?.[site];
    const ps = (s?.ps ?? "") === "" ? "--" : s.ps;
    const rec = (s?.rec ?? "") === "" ? "--" : s.rec;
    const cal = (s?.ps !== "" && s?.rec !== "" && Number.isFinite(Number(s.ps)) && Number.isFinite(Number(s.rec)))
      ? (Number(s.ps) + Number(s.rec)) : null;

    const bop = s?.bop ? "X" : "-";
    const plq = s?.plaque ? "X" : "-";
    const sup = s?.supp ? "X" : "-";

    return `
      <tr class="border-b border-[#D9D9D9]/30">
        <td class="py-2 pr-3 font-bold text-[#1D5D69]">${site}</td>
        <td class="py-2 pr-3 text-center">${ps}</td>
        <td class="py-2 pr-3 text-center">${rec}</td>
        <td class="py-2 pr-3 text-center font-semibold">${cal === null ? "--" : cal}</td>
        <td class="py-2 pr-3 text-center">${bop}</td>
        <td class="py-2 pr-3 text-center">${plq}</td>
        <td class="py-2 pr-3 text-center">${sup}</td>
      </tr>
    `;
  }).join("");

  const mob = empty ? "--" : (t.mobility ?? 0);
  const fur = empty ? "--" : (t.furcation ?? 0);

  return `
    <div class="p-4 rounded-xl border-2 border-[#8BCFDD]/50 bg-white shadow-sm">
      <div class="flex items-center justify-between mb-3 pb-2 border-b-2 border-[#8BCFDD]">
        <div class="flex items-center gap-2">
          <span class="text-[#4EABBE]">${ICONS.tooth}</span>
          <span class="font-bold text-lg text-[#1D5D69]">Pieza ${num}</span>
        </div>
        <div class="text-xs opacity-70 bg-[#F8F7F7] px-3 py-1 rounded-lg">
          Movilidad: <span class="font-bold">${mob}</span> - Furcacion: <span class="font-bold">${fur}</span>
        </div>
      </div>
      <table class="w-full text-xs">
        <thead>
          <tr class="text-[#1D5D69] font-bold border-b-2 border-[#8BCFDD]/30">
            <th class="text-left py-2 pr-3">Sitio</th>
            <th class="text-center py-2 pr-3">PS</th>
            <th class="text-center py-2 pr-3">REC</th>
            <th class="text-center py-2 pr-3">CAL</th>
            <th class="text-center py-2 pr-3">BOP</th>
            <th class="text-center py-2 pr-3">Placa</th>
            <th class="text-center py-2 pr-3">Sup</th>
          </tr>
        </thead>
        <tbody class="text-[#0F2532]">${rows}</tbody>
      </table>
    </div>
  `;
}

/* =============== GUARDADO EN BASE DE DATOS =============== */
async function saveToDB() {
  if (!currentPacienteId || !db) return;

  try {
    const payload = getPayload();
    const payloadJSON = JSON.stringify(payload);

    const existing = await dbGet(
      "SELECT id FROM tratamientos WHERE paciente_id = ? AND procedimiento = 'Periodontograma'",
      [currentPacienteId]
    );

    if (existing) {
      await dbRun(
        `UPDATE tratamientos SET notas = ?, fecha = datetime('now') 
         WHERE paciente_id = ? AND procedimiento = 'Periodontograma'`,
        [payloadJSON, currentPacienteId]
      );
    } else {
      await dbRun(
        `INSERT INTO tratamientos (paciente_id, procedimiento, notas, fecha) 
         VALUES (?, 'Periodontograma', ?, datetime('now'))`,
        [currentPacienteId, payloadJSON]
      );
    }

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'periodontograma-guardado' }, '*');
    }

    return true;
  } catch (e) {
    console.error('Error guardando periodontograma:', e);
    alert('Error al guardar: ' + (e.message || e));
    return false;
  }
}

async function loadFromDB() {
  if (!currentPacienteId || !db) return false;

  try {
    const row = await dbGet(
      "SELECT * FROM tratamientos WHERE paciente_id = ? AND procedimiento = 'Periodontograma' ORDER BY fecha DESC LIMIT 1",
      [currentPacienteId]
    );

    if (!row || !row.notas) return false;

    const payload = JSON.parse(row.notas);
    showAdult = !!payload.showAdult;
    selectedTooth = payload.selectedTooth ?? null;
    perTooth = payload.perTooth || {};

    return true;
  } catch (e) {
    console.error('Error cargando periodontograma:', e);
    return false;
  }
}

let autoSaveTimer = null;
function autoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveToDB();
  }, 2000);
}

function getPayload() {
  return {
    version: 2,
    showAdult,
    selectedTooth,
    perTooth,
    patient: {
      name: ($("pacienteNombre")?.textContent || "").trim(),
      id: ($("pacienteId")?.textContent || "").trim(),
    },
    savedAt: new Date().toISOString(),
  };
}

function saveLocal() {
  const STORAGE_KEY = `sonalia_periodontograma_v2_${currentPacienteId || 'local'}`;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getPayload()));
}

function loadLocal() {
  const STORAGE_KEY = `sonalia_periodontograma_v2_${currentPacienteId || 'local'}`;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw);
    showAdult = !!payload.showAdult;
    selectedTooth = payload.selectedTooth ?? null;
    perTooth = payload.perTooth || {};
    return true;
  } catch {
    return false;
  }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function exportJSON() {
  const payload = getPayload();
  downloadText(`periodontograma_${Date.now()}.json`, JSON.stringify(payload, null, 2));
}

function exportCSV() {
  const teeth = getTeeth();
  const all = [...teeth.superior, ...teeth.inferior];

  const rows = [];
  rows.push(["tooth", "site", "ps", "rec", "cal", "bop", "plaque", "supp", "mobility", "furcation"].join(","));

  for (const num of all) {
    const t = perTooth[num] || null;
    const mob = t ? (t.mobility ?? 0) : "";
    const fur = t ? (t.furcation ?? 0) : "";

    for (const site of SITES) {
      const s = t?.sites?.[site] || {};
      const ps = s.ps ?? "";
      const rec = s.rec ?? "";
      const cal = (ps !== "" && rec !== "" && Number.isFinite(Number(ps)) && Number.isFinite(Number(rec)))
        ? (Number(ps) + Number(rec)) : "";
      rows.push([
        num, site, ps, rec, cal,
        s.bop ? 1 : 0,
        s.plaque ? 1 : 0,
        s.supp ? 1 : 0,
        mob, fur
      ].join(","));
    }
  }

  downloadText(`periodontograma_${Date.now()}.csv`, rows.join("\n"));
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      if (!payload || !payload.perTooth) throw new Error("JSON invalido");
      showAdult = !!payload.showAdult;
      selectedTooth = payload.selectedTooth ?? null;
      perTooth = payload.perTooth || {};
      render();
      alert("Importacion exitosa");
    } catch (e) {
      alert("No se pudo importar: " + (e?.message || "error"));
    }
  };
  reader.readAsText(file);
}

/* =============== MAIN RENDER =============== */
function render() {
  renderDentitionButtons();
  renderToothRows();
  renderSelectedLabels();
  renderToothDetail();
  renderSummary();
}

async function init() {
  const pacienteId = getQueryParam('id');
  if (!pacienteId) {
    console.warn('ID de paciente no especificado');
  } else {
    currentPacienteId = pacienteId;
  }

  let ageDetected = false;
  if (pacienteId) {
    try {
      const paciente = await dbGet('SELECT * FROM pacientes WHERE id = ?', [pacienteId]);
      if (paciente) {
        const nombreEl = $("pacienteNombre");
        const idEl = $("pacienteId");
        if (nombreEl) nombreEl.textContent = `${paciente.nombre || ''} ${paciente.apellido || ''}`.trim() || 'Paciente';
        if (idEl) idEl.textContent = paciente.id || pacienteId;
        const edad = calculateAgeYears(paciente.fecha_nacimiento);
        if (edad !== null) {
          showAdult = edad >= PEDIATRIC_MAX_YEARS;
          ageDetected = true;
        }
      }
    } catch (e) {
      console.error('Error cargando paciente:', e);
    }
  }

  const loaded = await loadFromDB();
  if (!loaded) {
    loadLocal();
  }

  const radioAdu = $("radioAdulto");
  const radioInf = $("radioInfantil");
  const labelAdu = $("labelAdulto");
  const labelInf = $("labelInfantil");

  // Deshabilitar radio buttons si la edad fue detectada automáticamente
  if (ageDetected) {
    if (radioAdu) radioAdu.disabled = true;
    if (radioInf) radioInf.disabled = true;
    // Deshabilitar también los labels para evitar clics
    if (labelAdu) {
      labelAdu.style.pointerEvents = 'none';
      labelAdu.style.opacity = '0.6';
    }
    if (labelInf) {
      labelInf.style.pointerEvents = 'none';
      labelInf.style.opacity = '0.6';
    }
  }

  if (radioAdu) {
    radioAdu.addEventListener("change", () => {
      // No permitir cambios si la edad fue detectada automáticamente
      if (ageDetected) {
        radioAdu.checked = showAdult;
        return;
      }
      if (radioAdu.checked) {
        showAdult = true;
        selectedTooth = null;
        render();
      }
    });
  }

  if (radioInf) {
    radioInf.addEventListener("change", () => {
      // No permitir cambios si la edad fue detectada automáticamente
      if (ageDetected) {
        radioInf.checked = !showAdult;
        return;
      }
      if (radioInf.checked) {
        showAdult = false;
        selectedTooth = null;
        render();
      }
    });
  }

  const btnGuardar = $("btnGuardar");
  if (btnGuardar) {
    btnGuardar.addEventListener("click", async () => {
      btnGuardar.textContent = "Guardando...";
      btnGuardar.disabled = true;
      const saved = await saveToDB();
      if (saved) {
        saveLocal();
        btnGuardar.textContent = "Guardado";
        setTimeout(() => {
          btnGuardar.textContent = "Guardar";
          btnGuardar.disabled = false;
        }, 2000);
      } else {
        btnGuardar.textContent = "Guardar";
        btnGuardar.disabled = false;
      }
    });
  }

  const btnReset = $("btnReset");
  if (btnReset) {
    btnReset.addEventListener("click", async () => {
      if (!confirm("Seguro que deseas borrar todo el periodontograma? Esta accion no se puede deshacer.")) return;
      perTooth = {};
      selectedTooth = null;
      await saveToDB();
      render();
      alert("Periodontograma reiniciado");
    });
  }

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
