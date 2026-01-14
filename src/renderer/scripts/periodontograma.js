// periodontograma.js (Vanilla JS) - VERSIÓN MEJORADA VISUAL
// Integrado con base de datos y ficha clínica

// DB helpers
let db = (window.api && window.api.db) ? window.api.db : null;
let currentPacienteId = null;

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
  return params.get(name);
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
  border: "#D9D9D9",
};

const SITES = ["MB", "B", "DB", "ML", "L", "DL"];
const RANGE_PS = { min: 0, max: 15 };
const RANGE_REC = { min: -10, max: 10 };
const RANGE_03 = { min: 0, max: 3 };

const adultTeeth = {
  superior: [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28],
  inferior: [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38],
};
const childTeeth = {
  superior: [55,54,53,52,51,61,62,63,64,65],
  inferior: [85,84,83,82,81,71,72,73,74,75],
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
  if ([16,17,18,26,27,28,36,37,38,46,47,48].includes(num)) {
    return 'molar';
  }
  // Premolares (dos cúspides)
  if ([14,15,24,25,34,35,44,45].includes(num)) {
    return 'premolar';
  }
  // Caninos (puntiagudos)
  if ([13,23,33,43].includes(num)) {
    return 'canine';
  }
  // Incisivos (planos)
  if ([11,12,21,22,31,32,41,42].includes(num)) {
    return 'incisor';
  }
  // Dientes infantiles
  if ([55,54,64,65,85,84,74,75].includes(num)) {
    return 'child-molar';
  }
  if ([53,63,83,73].includes(num)) {
    return 'child-canine';
  }
  if ([52,51,61,62,82,81,71,72].includes(num)) {
    return 'child-incisor';
  }
  return 'molar';
}

// SVG MEJORADO con animaciones y mejor realismo
function createToothSVG(num, isUpper, isSelected, hasData) {
  const toothType = getToothType(num);
  const width = 70;
  const height = 90;
  const strokeWidth = 2.5;
  const borderColor = isSelected ? COLORS.accent : COLORS.soft;
  
  let path = '';
  let gradientId = `grad-${num}-${isUpper ? 'u' : 'l'}`;
  let detailPath = '';
  
  // Diferentes formas según el tipo de diente (MEJORADAS)
  if (toothType === 'molar') {
    // Muela - forma cuadrada con 4 cúspides
    if (isUpper) {
      path = `M ${width*0.18} ${height*0.12} 
              L ${width*0.45} ${height*0.08}
              L ${width*0.55} ${height*0.08}
              L ${width*0.82} ${height*0.12}
              Q ${width*0.92} ${height*0.18} ${width*0.92} ${height*0.28}
              L ${width*0.92} ${height*0.72}
              Q ${width*0.92} ${height*0.86} ${width*0.82} ${height*0.92}
              L ${width*0.18} ${height*0.92}
              Q ${width*0.08} ${height*0.86} ${width*0.08} ${height*0.72}
              L ${width*0.08} ${height*0.28}
              Q ${width*0.08} ${height*0.18} ${width*0.18} ${height*0.12}
              Z`;
      // Líneas de cúspides
      detailPath = `
        <path d="M ${width*0.25} ${height*0.15} L ${width*0.5} ${height*0.35}" 
              stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.5" fill="none"/>
        <path d="M ${width*0.75} ${height*0.15} L ${width*0.5} ${height*0.35}" 
              stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.5" fill="none"/>
        <path d="M ${width*0.5} ${height*0.25} L ${width*0.5} ${height*0.55}" 
              stroke="rgba(139, 207, 221, 0.25)" stroke-width="1.2" fill="none"/>
      `;
    } else {
      path = `M ${width*0.18} ${height*0.08} 
              L ${width*0.82} ${height*0.08}
              Q ${width*0.92} ${height*0.14} ${width*0.92} ${height*0.28}
              L ${width*0.92} ${height*0.72}
              Q ${width*0.92} ${height*0.82} ${width*0.82} ${height*0.88}
              L ${width*0.55} ${height*0.92}
              L ${width*0.45} ${height*0.92}
              L ${width*0.18} ${height*0.88}
              Q ${width*0.08} ${height*0.82} ${width*0.08} ${height*0.72}
              L ${width*0.08} ${height*0.28}
              Q ${width*0.08} ${height*0.14} ${width*0.18} ${height*0.08}
              Z`;
      detailPath = `
        <path d="M ${width*0.25} ${height*0.85} L ${width*0.5} ${height*0.65}" 
              stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.5" fill="none"/>
        <path d="M ${width*0.75} ${height*0.85} L ${width*0.5} ${height*0.65}" 
              stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.5" fill="none"/>
      `;
    }
  } else if (toothType === 'premolar') {
    // Premolar - más pequeño que molar, 2 cúspides
    if (isUpper) {
      path = `M ${width*0.22} ${height*0.15} 
              L ${width*0.5} ${height*0.10}
              L ${width*0.78} ${height*0.15}
              Q ${width*0.88} ${height*0.22} ${width*0.88} ${height*0.32}
              L ${width*0.88} ${height*0.70}
              Q ${width*0.88} ${height*0.84} ${width*0.78} ${height*0.90}
              L ${width*0.22} ${height*0.90}
              Q ${width*0.12} ${height*0.84} ${width*0.12} ${height*0.70}
              L ${width*0.12} ${height*0.32}
              Q ${width*0.12} ${height*0.22} ${width*0.22} ${height*0.15}
              Z`;
      detailPath = `
        <path d="M ${width*0.35} ${height*0.20} L ${width*0.5} ${height*0.35}" 
              stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.2" fill="none"/>
        <path d="M ${width*0.65} ${height*0.20} L ${width*0.5} ${height*0.35}" 
              stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.2" fill="none"/>
      `;
    } else {
      path = `M ${width*0.22} ${height*0.10} 
              L ${width*0.78} ${height*0.10}
              Q ${width*0.88} ${height*0.16} ${width*0.88} ${height*0.30}
              L ${width*0.88} ${height*0.68}
              Q ${width*0.88} ${height*0.78} ${width*0.78} ${height*0.85}
              L ${width*0.5} ${height*0.90}
              L ${width*0.22} ${height*0.85}
              Q ${width*0.12} ${height*0.78} ${width*0.12} ${height*0.68}
              L ${width*0.12} ${height*0.30}
              Q ${width*0.12} ${height*0.16} ${width*0.22} ${height*0.10}
              Z`;
      detailPath = `
        <path d="M ${width*0.35} ${height*0.80} L ${width*0.5} ${height*0.65}" 
              stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.2" fill="none"/>
        <path d="M ${width*0.65} ${height*0.80} L ${width*0.5} ${height*0.65}" 
              stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.2" fill="none"/>
      `;
    }
  } else if (toothType === 'canine') {
    // Canino - forma puntiaguda característica
    if (isUpper) {
      path = `M ${width*0.25} ${height*0.15}
              Q ${width*0.15} ${height*0.25} ${width*0.18} ${height*0.35}
              L ${width*0.18} ${height*0.70}
              Q ${width*0.15} ${height*0.82} ${width*0.25} ${height*0.90}
              L ${width*0.75} ${height*0.90}
              Q ${width*0.85} ${height*0.82} ${width*0.82} ${height*0.70}
              L ${width*0.82} ${height*0.35}
              Q ${width*0.85} ${height*0.25} ${width*0.75} ${height*0.15}
              L ${width*0.5} ${height*0.08}
              Z`;
      detailPath = `
        <path d="M ${width*0.5} ${height*0.12} L ${width*0.5} ${height*0.50}" 
              stroke="rgba(139, 207, 221, 0.35)" stroke-width="1.5" fill="none"/>
      `;
    } else {
      path = `M ${width*0.25} ${height*0.10}
              Q ${width*0.15} ${height*0.18} ${width*0.18} ${height*0.30}
              L ${width*0.18} ${height*0.65}
              Q ${width*0.15} ${height*0.75} ${width*0.25} ${height*0.85}
              L ${width*0.5} ${height*0.92}
              L ${width*0.75} ${height*0.85}
              Q ${width*0.85} ${height*0.75} ${width*0.82} ${height*0.65}
              L ${width*0.82} ${height*0.30}
              Q ${width*0.85} ${height*0.18} ${width*0.75} ${height*0.10}
              Z`;
      detailPath = `
        <path d="M ${width*0.5} ${height*0.88} L ${width*0.5} ${height*0.50}" 
              stroke="rgba(139, 207, 221, 0.35)" stroke-width="1.5" fill="none"/>
      `;
    }
  } else {
    // Incisivo - forma plana y rectangular
    if (isUpper) {
      path = `M ${width*0.25} ${height*0.12}
              Q ${width*0.20} ${height*0.18} ${width*0.20} ${height*0.28}
              L ${width*0.20} ${height*0.72}
              Q ${width*0.20} ${height*0.84} ${width*0.25} ${height*0.90}
              L ${width*0.75} ${height*0.90}
              Q ${width*0.80} ${height*0.84} ${width*0.80} ${height*0.72}
              L ${width*0.80} ${height*0.28}
              Q ${width*0.80} ${height*0.18} ${width*0.75} ${height*0.12}
              Z`;
      detailPath = `
        <path d="M ${width*0.35} ${height*0.30} Q ${width*0.5} ${height*0.35} ${width*0.65} ${height*0.30}" 
              stroke="rgba(139, 207, 221, 0.25)" stroke-width="1" fill="none"/>
      `;
    } else {
      path = `M ${width*0.25} ${height*0.10}
              Q ${width*0.20} ${height*0.16} ${width*0.20} ${height*0.28}
              L ${width*0.20} ${height*0.72}
              Q ${width*0.20} ${height*0.82} ${width*0.25} ${height*0.88}
              L ${width*0.75} ${height*0.88}
              Q ${width*0.80} ${height*0.82} ${width*0.80} ${height*0.72}
              L ${width*0.80} ${height*0.28}
              Q ${width*0.80} ${height*0.16} ${width*0.75} ${height*0.10}
              Z`;
      detailPath = `
        <path d="M ${width*0.35} ${height*0.70} Q ${width*0.5} ${height*0.65} ${width*0.65} ${height*0.70}" 
              stroke="rgba(139, 207, 221, 0.25)" stroke-width="1" fill="none"/>
      `;
    }
  }

  // Mini gráfica mejorada si hay datos
  const miniChart = hasData ? miniChartSVGImproved(num) : '';

  // Indicadores de problemas
  const t = perTooth[num];
  let warningIndicators = '';
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
        <text x="${width - 12}" y="14.5" text-anchor="middle" font-size="7" font-weight="bold" fill="white">⚠</text>
      `;
    }
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-full">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#FFFEF9;stop-opacity:1" />
          <stop offset="40%" style="stop-color:#FFFBF0;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#F5EFE6;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow-${num}">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="3" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.4"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <radialGradient id="highlight-${num}" cx="50%" cy="30%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.6);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
        </radialGradient>
      </defs>
      
      <!-- Sombra externa mejorada -->
      <path d="${path}" fill="rgba(0,0,0,0.15)" transform="translate(2, 3)" filter="url(#shadow-${num})"/>
      
      <!-- Diente principal con gradiente -->
      <path d="${path}" 
            fill="url(#${gradientId})" 
            stroke="${borderColor}" 
            stroke-width="${strokeWidth}"
            class="transition-all duration-300"
            style="filter: ${isSelected ? 'drop-shadow(0 0 12px rgba(78, 171, 190, 0.6))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'};">
        ${isSelected ? `<animate attributeName="stroke-width" values="${strokeWidth};${strokeWidth + 1};${strokeWidth}" dur="1s" repeatCount="indefinite"/>` : ''}
      </path>
      
      <!-- Detalles anatómicos -->
      ${detailPath}
      
      <!-- Highlight brillante para dar profundidad -->
      <ellipse cx="${width*0.5}" cy="${isUpper ? height*0.25 : height*0.75}" 
               rx="${width*0.28}" ry="${height*0.18}" 
               fill="url(#highlight-${num})"
               opacity="0.7"/>
      
      <!-- Mini chart -->
      ${miniChart}
      
      <!-- Indicadores de alerta -->
      ${warningIndicators}
      
      <!-- Número del diente con mejor contraste -->
      <text x="${width/2 + 1}" y="${(isUpper ? height*0.18 : height*0.82) + 1}" 
            text-anchor="middle" 
            font-size="11" 
            font-weight="bold" 
            fill="rgba(29,93,105,0.25)"
            class="pointer-events-none">${num}</text>
      <text x="${width/2}" y="${isUpper ? height*0.18 : height*0.82}" 
            text-anchor="middle" 
            font-size="11" 
            font-weight="bold" 
            fill="${COLORS.brand}"
            class="pointer-events-none">${num}</text>
    </svg>
  `;
}

function toothButton(num) {
  const isSel = selectedTooth === num;
  const hasAny = toothHasAny(num);
  const teeth = getTeeth();
  const isUpper = teeth.superior.includes(num);

  const border = isSel ? COLORS.accent : COLORS.soft;
  const ring = isSel ? "0 0 0 4px rgba(78, 171, 190, 0.25)" : "none";
  const badge = hasAny ? `
    <span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-[#4EABBE] to-[#1D5D69] border-2 border-white dark:border-[#0E1A25] flex items-center justify-center shadow-lg animate-pulse">
      <span class="text-[9px] text-white font-bold">✓</span>
    </span>
  ` : "";

  return `
    <div class="flex flex-col items-center gap-2 group">
      <button data-tooth="${num}"
        class="relative w-[72px] h-[92px] rounded-2xl border-2 bg-gradient-to-br from-white to-[#F8F7F7] dark:from-[#0B1721] dark:to-[#0E1A25] transition-all duration-300 hover:scale-110 hover:shadow-2xl overflow-hidden"
        style="border-color:${border}; box-shadow:${ring};"
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
  $("piezaSeleccionada").textContent = selectedTooth ? String(selectedTooth) : "—";
  $("labelPiezaPanel").textContent = selectedTooth ? String(selectedTooth) : "—";
}

function inputNumber(id, value, placeholder, min, max, highlightColor = null) {
  const border = highlightColor || COLORS.soft;
  return `
    <input
      id="${id}"
      inputmode="numeric"
      class="w-full px-3 py-2.5 rounded-xl border-2 focus:outline-none transition-all bg-white dark:bg-[#0B1721] text-[#0F2532] dark:text-slate-200 focus:ring-2 focus:ring-[#4EABBE] hover:border-[#4EABBE]"
      style="border-color:${border}"
      placeholder="${placeholder} (${min}–${max})"
      value="${value}"
    />
  `;
}

function togglePill(id, active, label) {
  return `
    <button
      id="${id}"
      class="px-3 py-2 rounded-xl font-semibold border-2 transition-all hover:scale-105 text-sm dark:text-slate-200 shadow-sm hover:shadow-md"
      style="
        border-color:${active ? COLORS.accent : COLORS.soft};
        background:${active ? "linear-gradient(135deg, rgba(78,171,190,0.18), rgba(139,207,221,0.12))" : "white"};
        color:${COLORS.ink};
      "
      type="button"
    >${label}</button>
  `;
}

function selectPillBlock(key, value, label) {
  const opts = [0,1,2,3].map(v => `
    <button data-pill="${key}" data-val="${v}"
      class="px-4 py-2.5 rounded-xl font-bold border-2 transition-all hover:scale-105 text-sm dark:text-slate-200 shadow-sm"
      style="
        border-color:${value === v ? COLORS.accent : COLORS.soft};
        background:${value === v ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.brand})` : "white"};
        color:${value === v ? "#FFF" : COLORS.ink};
      "
      type="button"
    >${v}</button>
  `).join("");

  return `
    <div class="p-4 rounded-xl bg-gradient-to-br from-[#F8F7F7] to-white dark:from-[#0B1721] dark:to-[#0E1A25] border-2 border-[#D9D9D9] dark:border-slate-700 shadow-md">
      <div class="flex items-center justify-between mb-3">
        <div class="font-bold text-[#1D5D69] dark:text-white text-sm">${label}</div>
        <div class="text-xs opacity-70 text-[#0F2532] dark:text-slate-300 bg-[#8BCFDD]/10 px-2 py-1 rounded-lg">0–3</div>
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
          <div class="text-6xl mb-4 opacity-30">🦷</div>
          <div class="text-xl font-bold text-[#1D5D69] dark:text-white mb-2">Selecciona una pieza dental</div>
          <div class="text-sm opacity-70 text-[#0F2532] dark:text-slate-300">Haz clic en cualquier diente arriba para comenzar el registro periodontal.</div>
        </div>
      `;
    }
    const chartEl = $("chartSelectedTooth");
    if (chartEl) chartEl.innerHTML = `
      <div class="flex items-center justify-center h-48 text-center">
        <div>
          <div class="text-4xl mb-3 opacity-20">📊</div>
          <div class="text-sm opacity-60 text-[#0F2532] dark:text-slate-400">La gráfica aparecerá al seleccionar un diente</div>
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
      <div class="p-4 rounded-2xl bg-gradient-to-br from-white via-[#FFFEF9] to-[#F8F7F7] dark:from-[#0B1721] dark:via-[#0E1A25] dark:to-[#0E1A25] border-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]" 
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
                ${sev ? (sev === COLORS.ok ? "✓ Saludable (0–3mm)" : (sev === COLORS.warn ? "⚠ Moderado (4–5mm)" : "⚠️ Severo (≥6mm)")) : "Sin datos"}
              </span>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold mb-2 uppercase tracking-wider opacity-70 text-[#1D5D69] dark:text-white">Recesión / Margen Gingival</label>
            ${inputNumber(`rec_${site}`, s.rec, "REC/MG", RANGE_REC.min, RANGE_REC.max)}
            <div class="mt-2 p-2 rounded-lg text-xs bg-gradient-to-r from-[#8BCFDD]/10 to-[#4EABBE]/10 border border-[#8BCFDD]/30">
              <span class="opacity-70">CAL estimado:</span> 
              <span id="cal_${site}" class="font-bold text-[#1D5D69] dark:text-white ml-1">${calcCAL(s.ps, s.rec)}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mt-4">
          ${togglePill(`bop_${site}`, !!s.bop, `${s.bop ? '🩸' : '◯'} BOP`)}
          ${togglePill(`plq_${site}`, !!s.plaque, `${s.plaque ? '🦠' : '◯'} Placa`)}
          ${togglePill(`sup_${site}`, !!s.supp, `${s.supp ? '💧' : '◯'} Supuración`)}
        </div>
      </div>
    `;
  }).join("");

  const extra = `
    <div class="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      ${selectPillBlock("mob", clampInt(t.mobility, 0, 3) || 0, "Movilidad Dental")}
      ${selectPillBlock("fur", clampInt(t.furcation, 0, 3) || 0, "Compromiso de Furcación")}
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
  if (!Number.isFinite(p) || !Number.isFinite(r)) return "—";
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
    $("avgPS").textContent = st ? st.avgPS.toFixed(1) + " mm" : "—";
    $("avgREC").textContent = st ? st.avgREC.toFixed(1) + " mm" : "—";
    $("avgCAL").textContent = st ? st.avgCAL.toFixed(1) + " mm" : "—";
    $("pctBOP").textContent = st ? Math.round((st.bop / 6) * 100) + "%" : "—";
    $("pctPlaca").textContent = st ? Math.round((st.plaque / 6) * 100) + "%" : "—";
    $("cntSuppTooth").textContent = st ? String(st.supp) : "—";
  } else {
    $("avgPS").textContent = "—";
    $("avgREC").textContent = "—";
    $("avgCAL").textContent = "—";
    $("pctBOP").textContent = "—";
    $("pctPlaca").textContent = "—";
    $("cntSuppTooth").textContent = "—";
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

  const w = 58, h = 20, pad = 2;
  const ptsPS = [];
  let hasData = false;
  let maxPS = 0;
  
  for (let i = 0; i < SITES.length; i++) {
    const s = t.sites[SITES[i]];
    const p = Number(s.ps);
    if (Number.isFinite(p)) {
      hasData = true;
      maxPS = Math.max(maxPS, p);
      const x = pad + (i * (w - pad*2) / (SITES.length - 1));
      const normalizedPS = Math.min(p / 10, 1); // Normalizar a escala 0-1
      const y = h - pad - (normalizedPS * (h - pad*2));
      ptsPS.push([x, y, p]);
    }
  }
  
  if (!hasData || ptsPS.length < 2) return "";
  
  // Crear path suavizado
  let d = `M ${ptsPS[0][0]} ${ptsPS[0][1]}`;
  for (let i = 1; i < ptsPS.length; i++) {
    const prevX = ptsPS[i-1][0];
    const prevY = ptsPS[i-1][1];
    const currX = ptsPS[i][0];
    const currY = ptsPS[i][1];
    const cpX = (prevX + currX) / 2;
    d += ` Q ${cpX} ${prevY}, ${cpX} ${(prevY + currY)/2} Q ${cpX} ${currY}, ${currX} ${currY}`;
  }
  
  // Area fill
  const areaPath = d + ` L ${ptsPS[ptsPS.length-1][0]} ${h-pad} L ${ptsPS[0][0]} ${h-pad} Z`;
  
  const severity = maxPS >= 6 ? COLORS.danger : (maxPS >= 4 ? COLORS.warn : COLORS.ok);
  
  return `
    <g transform="translate(6, 62)">
      <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs>
          <linearGradient id="miniGrad-${toothNum}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${severity};stop-opacity:0.4" />
            <stop offset="100%" style="stop-color:${severity};stop-opacity:0.05" />
          </linearGradient>
        </defs>
        <!-- Fondo -->
        <rect x="${pad}" y="${pad}" width="${w - pad*2}" height="${h - pad*2}" 
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
  const yTicks = [0,3,5,6,10,15].map(mm => {
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
    
    return `<g>
      <text x="${x}" y="${h - 28}" text-anchor="middle" font-size="13" font-weight="bold" fill="${COLORS.brand}">${site}</text>
      <text x="${x}" y="${h - 12}" text-anchor="middle" font-size="10" fill="rgba(15,37,50,0.5)">
        ${hasBOP ? '🩸' : ''}${hasPlaque ? '🦠' : ''}${hasSupp ? '💧' : ''}
      </text>
    </g>`;
  }).join("");

  // PS points con severidad
  const psDots = ptsPS.filter(p => p[1] !== null).map(([x, y, site, ps, bop]) => {
    const c = psSeverityColor(ps);
    const r = bop ? 6 : 5;
    return `
      <circle cx="${x}" cy="${y}" r="${r + 2}" fill="white" opacity="0.8"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.95" stroke="white" stroke-width="1.5">
        <animate attributeName="r" values="${r};${r+1};${r}" dur="2s" repeatCount="indefinite"/>
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
      
      <circle cx="${padL+20}" cy="${padT+21}" r="5" fill="${COLORS.accent}" stroke="white" stroke-width="1.5"/>
      <text x="${padL+32}" y="${padT+25}" font-size="12" font-weight="600" fill="${COLORS.ink}">Profundidad de Sondaje (PS)</text>

      <line x1="${padL+190}" y1="${padT+21}" x2="${padL+215}" y2="${padT+21}" stroke="${COLORS.brand}" stroke-width="3" stroke-linecap="round"/>
      <text x="${padL+222}" y="${padT+25}" font-size="12" font-weight="600" fill="${COLORS.ink}">REC/MG</text>

      <line x1="${padL+285}" y1="${padT+21}" x2="${padL+310}" y2="${padT+21}" stroke="${COLORS.warn}" stroke-width="3" stroke-dasharray="6 4" stroke-linecap="round"/>
      <text x="${padL+317}" y="${padT+25}" font-size="12" font-weight="600" fill="${COLORS.ink}">CAL</text>
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
      <rect x="${padL}" y="${y3}" width="${innerW}" height="${(padT+innerH) - y3}" fill="url(#okGrad)"/>

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
    d += ` Q ${cpX} ${curr[1]}, ${cpX} ${(curr[1] + next[1])/2} Q ${cpX} ${next[1]}, ${next[0]} ${next[1]}`;
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
    const ps = (s?.ps ?? "") === "" ? "—" : s.ps;
    const rec = (s?.rec ?? "") === "" ? "—" : s.rec;
    const cal = (s?.ps !== "" && s?.rec !== "" && Number.isFinite(Number(s.ps)) && Number.isFinite(Number(s.rec)))
      ? (Number(s.ps) + Number(s.rec)) : null;

    const bop = s?.bop ? "✓" : "—";
    const plq = s?.plaque ? "✓" : "—";
    const sup = s?.supp ? "✓" : "—";

    return `
      <tr class="border-b border-[#D9D9D9]/30">
        <td class="py-2 pr-3 font-bold text-[#1D5D69]">${site}</td>
        <td class="py-2 pr-3 text-center">${ps}</td>
        <td class="py-2 pr-3 text-center">${rec}</td>
        <td class="py-2 pr-3 text-center font-semibold">${cal === null ? "—" : cal}</td>
        <td class="py-2 pr-3 text-center">${bop}</td>
        <td class="py-2 pr-3 text-center">${plq}</td>
        <td class="py-2 pr-3 text-center">${sup}</td>
      </tr>
    `;
  }).join("");

  const mob = empty ? "—" : (t.mobility ?? 0);
  const fur = empty ? "—" : (t.furcation ?? 0);

  return `
    <div class="p-4 rounded-xl border-2 border-[#8BCFDD]/50 bg-white shadow-sm">
      <div class="flex items-center justify-between mb-3 pb-2 border-b-2 border-[#8BCFDD]">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🦷</span>
          <span class="font-bold text-lg text-[#1D5D69]">Pieza ${num}</span>
        </div>
        <div class="text-xs opacity-70 bg-[#F8F7F7] px-3 py-1 rounded-lg">
          Movilidad: <span class="font-bold">${mob}</span> • Furcación: <span class="font-bold">${fur}</span>
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
  rows.push(["tooth","site","ps","rec","cal","bop","plaque","supp","mobility","furcation"].join(","));

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
      if (!payload || !payload.perTooth) throw new Error("JSON inválido");
      showAdult = !!payload.showAdult;
      selectedTooth = payload.selectedTooth ?? null;
      perTooth = payload.perTooth || {};
      render();
      alert("Importación exitosa ✓");
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
    console.error('ID de paciente no especificado');
    return;
  }
  currentPacienteId = pacienteId;

  try {
    const paciente = await dbGet('SELECT * FROM pacientes WHERE id = ?', [pacienteId]);
    if (paciente) {
      const nombreEl = $("pacienteNombre");
      const idEl = $("pacienteId");
      if (nombreEl) nombreEl.textContent = `${paciente.nombre || ''} ${paciente.apellido || ''}`.trim() || 'Paciente';
      if (idEl) idEl.textContent = paciente.id || pacienteId;
    }
  } catch (e) {
    console.error('Error cargando paciente:', e);
  }

  const loaded = await loadFromDB();
  if (!loaded) {
    loadLocal();
  }

  const radioAdu = $("radioAdulto");
  const radioInf = $("radioInfantil");
  
  if (radioAdu) {
    radioAdu.addEventListener("change", () => {
      if (radioAdu.checked) {
        showAdult = true;
        selectedTooth = null;
        render();
      }
    });
  }
  
  if (radioInf) {
    radioInf.addEventListener("change", () => {
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
        btnGuardar.textContent = "✓ Guardado";
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
      if (!confirm("¿Seguro que deseas borrar todo el periodontograma? Esta acción no se puede deshacer.")) return;
      perTooth = {};
      selectedTooth = null;
      await saveToDB();
      render();
      alert("Periodontograma reiniciado ✓");
    });
  }

  const btnImprimir = $("btnImprimir");
  if (btnImprimir) {
    btnImprimir.addEventListener("click", () => {
      const printPaciente = $("printPaciente");
      const printId = $("printId");
      const printDenticion = $("printDenticion");
      const printFecha = $("printFecha");
      const printTable = $("printTable");
      
      if (printPaciente) printPaciente.textContent = ($("pacienteNombre")?.textContent || "").trim();
      if (printId) printId.textContent = ($("pacienteId")?.textContent || "").trim();
      if (printDenticion) printDenticion.textContent = showAdult ? "Adulto" : "Infantil";
      if (printFecha) printFecha.textContent = new Date().toLocaleString();
      if (printTable) printTable.innerHTML = buildPrintTableHTML();

      window.print();
    });
  }

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}