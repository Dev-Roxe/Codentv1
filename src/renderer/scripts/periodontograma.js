// periodontograma.js â€” Formato SEPA completo
'use strict';

// ===== BD =====
let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
}
// 'api' exposes clinical IPC methods (savePeriodontogram, getPeriodontogram, etc.)
const api = (window.api && window.api.clinical) ? window.api
  : (window.parent && window.parent !== window && window.parent.api && window.parent.api.clinical) ? window.parent.api
  : null;
let currentPacienteId = null;

// dbGet is still used in init() for patient details, so keep it.
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
// dbAll and dbRun are no longer used after removing ensurePeriodontogramaSchema and rewriting guardar.
// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     try {
//       if (!db) return resolve([]);
//       if (db.all && db.all.length >= 3) db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
//       else if (db.all) db.all(sql, params).then(r => resolve(r || [])).catch(reject);
//       else resolve([]);
//     } catch (e) { reject(e); }
//   });
// }
// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     try {
//       if (!db) return resolve();
//       if (db.run && db.run.length >= 3) db.run(sql, params, (err) => err ? reject(err) : resolve());
//       else if (db.run) db.run(sql, params).then(resolve).catch(reject);
//       else resolve();
//     } catch (e) { reject(e); }
//   });
// }
function getQueryParam(name) {
  const p = new URLSearchParams(window.location.search);
  const v = p.get(name);
  if (v !== null && v !== '') return v;
  if (window.parent && window.parent !== window) {
    const pp = new URLSearchParams(window.parent.location.search);
    const pv = pp.get(name);
    if (pv !== null && pv !== '') return pv;
  }
  return null;
}

// ===== DIENTES =====
const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const allTeeth = [...upperTeeth, ...lowerTeeth];

function toothLabel(n) {
  const s = String(n);
  return s.length === 2 ? s[0] + '.' + s[1] : s;
}

// ===== ESTADO =====
const perioData = {};
let imageEditionLocked = false;
// periodontogramaColumns is no longer needed
// let periodontogramaColumns = new Set();
let autoSaveTimer = null;
let saveInFlight = false;
let saveQueued = false;

function initData() {
  [...upperTeeth, ...lowerTeeth].forEach(t => {
    perioData[t] = {
      ausente: false,
      implante: false,
      movilidad: '',
      pronostico: '',
      furca: 0,
      nota: '',
      imagen_v: '',
      imagen_p: '',
      imagen_url: '',
      sangrado_v: { m: false, c: false, d: false },
      supuracion_v: { m: false, c: false, d: false },
      placa_v: { m: false, c: false, d: false },
      margen_v: { m: '', c: '', d: '' },
      profundidad_v: { m: '', c: '', d: '' },
      sangrado_p: { m: false, c: false, d: false },
      supuracion_p: { m: false, c: false, d: false },
      placa_p: { m: false, c: false, d: false },
      margen_p: { m: '', c: '', d: '' },
      profundidad_p: { m: '', c: '', d: '' },
      anchura: { m: '', c: '', d: '' },
    };
    normalizeToothImageFields(perioData[t]);
  });
}

// ===== HELPERS =====
const $ = id => document.getElementById(id);

function toast(msg, type = 'info') {
  const el = $('toast'), text = $('toastText'), dot = $('toastDot');
  if (!el || !text || !dot) return;
  text.textContent = msg;
  const colors = { info: '#4EABBE', ok: '#10B981', warn: '#F59E0B', error: '#EF4444' };
  dot.style.background = colors[type] || '#4EABBE';
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2400);
}

function depthClass(v) {
  const n = parseInt(v);
  if (isNaN(n) || n === 0) return '';
  if (n >= 6) return 'd-severe';
  if (n >= 4) return 'd-moderate';
  return 'd-normal';
}

function anchuraClass(v) {
  const n = parseInt(v);
  if (isNaN(n) || n === 0) return '';
  if (n <= 1) return 'a-low';
  if (n === 2) return 'a-mid';
  return 'a-good';
}

function furcaLabel(v) {
  if (v === 1) return '<span class="furca-I">I</span>';
  if (v === 2) return '<span class="furca-II">II</span>';
  if (v === 3) return '<span class="furca-III">III</span>';
  return '';
}

function escAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function formatDateOnly(v) {
  if (!v) return '--';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function updateHeaderDateTime() {
  const el = $('headerDateTime');
  if (!el) return;
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  el.textContent = `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function normalizeToothImageFields(d) {
  if (!d || typeof d !== 'object') return;
  const isValidStr = (s) => typeof s === 'string' && s !== 'undefined' && s !== 'null' && s !== '[object Object]' && s.trim() !== '';
  if (!isValidStr(d.imagen_v)) d.imagen_v = '';
  if (!isValidStr(d.imagen_p)) d.imagen_p = '';
  if (!isValidStr(d.imagen_url)) d.imagen_url = '';
  if (!d.imagen_v && !d.imagen_p && d.imagen_url) {
    d.imagen_v = d.imagen_url;
    d.imagen_p = d.imagen_url;
  }
}

function countToothImages() {
  return allTeeth.reduce((acc, tooth) => {
    const d = perioData[tooth] || {};
    return acc + (d.imagen_v?.trim() ? 1 : 0) + (d.imagen_p?.trim() ? 1 : 0);
  }, 0);
}

function updateToothImageControls() {
  const status = $('toothImageStatus');

  const loaded = countToothImages();
  const total = allTeeth.length * 2;
  
  const d18 = perioData[18] || {};
  let dbg = 'no';
  if (d18.imagen_v && d18.imagen_v.length > 50) dbg = 'v-ok';
  else if (d18.imagen_url && d18.imagen_url.length > 50) dbg = 'url-ok';
  else if (d18.imagen_p && d18.imagen_p.length > 50) dbg = 'p-ok';
  else if (d18.imagen_v || d18.imagen_url || d18.imagen_p) dbg = 'corrupt';

  if (status) {
    status.textContent = `${loaded} / ${total} [18:${dbg}]`;
  }
}

function onToothClick(tooth, imageSide, ev) {
  void imageSide;
  if (ev && (ev.ctrlKey || ev.metaKey)) {
    onToothToggleAbsent(tooth);
  }
}
window.onToothClick = onToothClick;

// ===== SVG DIENTE (mismo diseño que odontograma) =====
function getToothType(n) {
  if ([16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(n)) return 'molar';
  if ([14, 15, 24, 25, 34, 35, 44, 45].includes(n)) return 'premolar';
  if ([13, 23, 33, 43].includes(n)) return 'canine';
  return 'incisor';
}

function toothSVG(num, isUpper, opts = {}) {
  const w = 80, h = 104;
  const type = getToothType(num);
  const d = perioData[num] || {};
  const isImplant = d.implante;
  const imageSide = opts.imageSide === 'p' ? 'p' : 'v';
  const imageKey = imageSide === 'p' ? 'imagen_p' : 'imagen_v';
  
  const isValidStr = (s) => typeof s === 'string' && s !== 'undefined' && s !== 'null' && s !== '[object Object]' && s.trim() !== '';
  let imageUrl = '';
  if (isValidStr(d[imageKey])) {
    imageUrl = d[imageKey].trim();
  }

  const baseOpacity = d.ausente ? '0.45' : '1';
  let missingMark = d.ausente ? `
    <line x1="${w * 0.2}" y1="${h * 0.2}" x2="${w * 0.8}" y2="${h * 0.8}" stroke="#dc2626" stroke-width="3.5" opacity="0.85" stroke-linecap="round"/>
    <line x1="${w * 0.8}" y1="${h * 0.2}" x2="${w * 0.2}" y2="${h * 0.8}" stroke="#dc2626" stroke-width="3.5" opacity="0.85" stroke-linecap="round"/>
  ` : '';

  // Rendering IMAGES from Database if available
  if (imageUrl) {
    return `
      <div style="width:100%;height:100%;position:relative;padding:2px;">
        <div style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;background:#fff;">
          <img src="${escAttr(imageUrl)}" alt="Diente ${num}"
            style="width:100%;height:100%;display:block;object-fit:contain;opacity:${baseOpacity};" draggable="false" />
          <svg viewBox="0 0 80 104" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
            ${missingMark}
          </svg>
        </div>
      </div>
    `;
  }

  // --- Fallback to high-fidelity SVG from odonto-render.js ---
  const isSelected = false; // Add parameter logic if needed
  const treatColor = null;
  const surfaces = null;
  
  // Create beautiful tooth SVG
  const renderedTooth = window.OdontoRender ? window.OdontoRender.createToothSVG(num, !isUpper, isSelected, treatColor, surfaces, d.ausente) : '';
  
  let furcaSVG = '';
  if (d.furca > 0 && (type === 'molar' || type === 'premolar')) {
    const fy = isUpper ? h * 0.65 : h * 0.35;
    if (d.furca === 1) {
      furcaSVG = `<path d="M ${w * .45} ${isUpper ? fy + 8 : fy - 8} L ${w * .55} ${isUpper ? fy + 8 : fy - 8} L ${w * .5} ${fy} Z" stroke="#0284c7" stroke-width="1.5" fill="none"/>`;
    } else if (d.furca === 2) {
      furcaSVG = `<path d="M ${w * .45} ${isUpper ? fy + 8 : fy - 8} L ${w * .5} ${fy} L ${w * .55} ${isUpper ? fy + 8 : fy - 8}" stroke="#d97706" stroke-width="2" fill="none"/>`;
    } else if (d.furca === 3) {
      furcaSVG = `<path d="M ${w * .45} ${isUpper ? fy + 8 : fy - 8} L ${w * .55} ${isUpper ? fy + 8 : fy - 8} L ${w * .5} ${fy} Z" fill="#dc2626"/>`;
    }
  }

  let placaSVG = '';
  ['v', 'p'].forEach(cara => {
    const pField = `placa_${cara}`;
    if (d[pField]?.m || d[pField]?.c || d[pField]?.d) {
      const py = isUpper ? h * 0.72 : h * 0.28;
      placaSVG += `<circle cx="${w * .5}" cy="${py}" r="${w * .25}" fill="#1d4ed8" opacity="0.15"/>`;
    }
  });

  return `
    <div style="width:100%;height:100%;position:relative;padding:2px;">
      <div class="${d.ausente ? 'dark-tooth-bg' : ''}" style="position:relative;width:100%;height:100%;border-radius:12px;overflow:hidden;background:#fff;">
        ${renderedTooth || `<svg viewBox="0 0 80 104" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">${missingMark}</svg>`}
        <svg viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">
          ${furcaSVG}
          ${placaSVG}
          ${missingMark}
        </svg>
      </div>
    </div>
  `;
}

// ===== FILA DE DIENTES CON OVERLAY DE GRÁFICA =====
function teethRowWithChart(teeth, isUpper, labelText, fieldProf, fieldMargen, quadSepTooth, flipSVG = false) {
  const n = teeth.length;
  const colSpan = n * 3;
  const toothH = 108;
  const imageSide = fieldProf.includes('_p') ? 'p' : 'v';
  const displayUpper = flipSVG ? isUpper : !isUpper;

  let teethHtml = '';
  teeth.forEach((t, ti) => {
    const isQ = t === quadSepTooth;
    const borderRight = isQ ? '3px solid #ef4444' : '1px solid #e2e8f0';
    const borderLeft = ti === 0 ? 'none' : '2px solid #94a3b8';
    teethHtml += `<div style="flex:1;min-width:0;height:${toothH}px;position:relative;
            border-left:${borderLeft};border-right:${borderRight};
            background:transparent;cursor:pointer;" class="dark-tooth-bg" onclick="onToothClick(${t}, '${imageSide}', event)">
            ${toothSVG(t, displayUpper, { imageSide })}
        </div>`;
  });

  const overlayId = `overlay-${isUpper ? 'u' : 'l'}-${fieldProf.replace('_', '')}`;

  return `<tr>
        <td class="label-col" style="font-size:9px;font-weight:800;color:#2f2f2f">${labelText}</td>
        <td colspan="${colSpan}" style="padding:0;position:relative;height:${toothH}px;">
            <div style="display:flex;width:100%;height:${toothH}px;position:relative;" id="teeth-row-${overlayId}">
                ${teethHtml}
                <svg id="${overlayId}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;"
                    preserveAspectRatio="none" viewBox="0 0 1000 ${toothH}">
                </svg>
            </div>
        </td>
    </tr>`;
}

// ===== OVERLAY DE GRÁFICA =====
function drawChartOverlay(teeth, isUpper, fieldProf, fieldMargen) {
  const overlayId = `overlay-${isUpper ? 'u' : 'l'}-${fieldProf.replace('_', '')}`;
  const svg = document.getElementById(overlayId);
  const container = document.getElementById(`teeth-row-${overlayId}`);
  if (!svg || !container) return;

  const n = teeth.length;
  const toothH = 108;
  const maxDepth = 12;
  const positions = ['m', 'c', 'd'];
  const totalPoints = n * 3;
  const displayUpper = fieldProf.includes('_p') ? isUpper : !isUpper;

  const profPts = [];
  const margenPts = [];
  teeth.forEach((tooth, ti) => {
    const d = perioData[tooth];
    if (!d || d.ausente) return;
    positions.forEach((pos, pi) => {
      const x = ((ti * 3 + pi + 0.5) / totalPoints) * 1000;
      const pv = parseFloat(d[fieldProf][pos]) || 0;
      const mv = parseFloat(d[fieldMargen][pos]) || 0;

      const pct_p = pv / maxDepth;
      const pct_m = mv / maxDepth;

      let py, my;
      if (displayUpper) {
        my = toothH * 0.38 + pct_m * toothH * 0.25;
        py = my + (pv / maxDepth) * toothH * 0.50;
      } else {
        my = toothH * 0.62 - pct_m * toothH * 0.25;
        py = my - (pv / maxDepth) * toothH * 0.50;
      }

      profPts.push({ x, y: py, v: pv, t: tooth, pos });
      margenPts.push({ x, y: my, v: mv, t: tooth, pos });
    });
  });

  function makePath(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
    }
    return path;
  }

  const profPath = makePath(profPts);
  const margenPath = makePath(margenPts);

  let sangradoSVG = '';
  const siteWidth = 1000 / totalPoints;
  const isVestibular = fieldProf.includes('_v');
  const sangraField = isVestibular ? 'sangrado_v' : 'sangrado_p';
  const active = profPts.map((pt) => {
    const d = perioData[pt.t];
    return !!(pt.v >= 4 && d && d[sangraField]?.[pt.pos]);
  });

  // Build fills that follow margin/depth lines without rectangular bars.
  const maxJoinDx = siteWidth * 1.6;
  let i = 0;
  while (i < profPts.length) {
    if (!active[i]) { i++; continue; }
    let j = i;
    while (
      j + 1 < profPts.length &&
      active[j + 1] &&
      Math.abs(profPts[j + 1].x - profPts[j].x) <= maxJoinDx
    ) {
      j++;
    }

    if (j > i) {
      let path = `M ${margenPts[i].x.toFixed(1)},${margenPts[i].y.toFixed(1)}`;
      for (let k = i + 1; k <= j; k++) {
        path += ` L ${margenPts[k].x.toFixed(1)},${margenPts[k].y.toFixed(1)}`;
      }
      for (let k = j; k >= i; k--) {
        path += ` L ${profPts[k].x.toFixed(1)},${profPts[k].y.toFixed(1)}`;
      }
      path += ' Z';
      sangradoSVG += `<path d="${path}" fill="rgba(239, 68, 68, 0.34)" stroke="none"/>`;
    } else {
      const pt = profPts[i];
      const mpt = margenPts[i];
      const hw = siteWidth * 0.24;
      const path = `M ${(mpt.x - hw).toFixed(1)},${mpt.y.toFixed(1)}
                    L ${(mpt.x + hw).toFixed(1)},${mpt.y.toFixed(1)}
                    L ${(pt.x + hw).toFixed(1)},${pt.y.toFixed(1)}
                    L ${(pt.x - hw).toFixed(1)},${pt.y.toFixed(1)} Z`;
      sangradoSVG += `<path d="${path}" fill="rgba(239, 68, 68, 0.34)" stroke="none"/>`;
    }

    i = j + 1;
  }

  svg.innerHTML = `
        ${sangradoSVG}
        ${margenPath ? `<path d="${margenPath}" stroke="#b24135" stroke-width="1.8" fill="none"
            stroke-linejoin="round" stroke-linecap="round" opacity="0.92"/>` : ''}
        ${profPath ? `<path d="${profPath}" stroke="#2f7f77" stroke-width="1.8" fill="none"
            stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>` : ''}
    `;
}

function renderChartOverlays() {
  drawChartOverlay(upperTeeth, true, 'profundidad_v', 'margen_v');
  drawChartOverlay(upperTeeth, true, 'profundidad_p', 'margen_p');
  drawChartOverlay(lowerTeeth, false, 'profundidad_p', 'margen_p');
  drawChartOverlay(lowerTeeth, false, 'profundidad_v', 'margen_v');
}

// ===== CELDAS =====
function numCell(tooth, field, pos, isQuadSep = false) {
  const d = perioData[tooth];
  const v = d ? (d[field][pos] ?? '') : '';
  const dc = field.includes('profundidad') ? depthClass(v)
    : field === 'anchura' ? anchuraClass(v)
      : '';
  const sep = isQuadSep ? ' quad-sep' : '';
  const disabled = d?.ausente ? 'disabled' : '';
  return `<td class="data-cell ${dc}${sep}" data-tooth="${tooth}" data-field="${field}" data-pos="${pos}" data-type="num">
                <input class="perio-input ${dc}" type="number" min="0" max="13" step="1" inputmode="numeric" value="${v}" ${disabled}
                    data-tooth="${tooth}" data-field="${field}" data-pos="${pos}"
                    onkeydown="onNumKeyDown(event)" oninput="onNumInput(event)" onfocus="this.select()">
                </td>`;
}

function boolCell(tooth, field, pos, isQuadSep = false) {
  const d = perioData[tooth];
  let symbol = '';
  let cls = '';

  if (field.includes('sangrado')) {
    const supField = field.replace('sangrado', 'supuracion');
    const hasSangrado = !!(d && d[field]?.[pos]);
    const hasSupuracion = !!(d && d[supField]?.[pos]);
    const state = (hasSangrado ? 1 : 0) + (hasSupuracion ? 2 : 0);
    if (state === 1) { symbol = '\u25CF'; cls = 'bool-sangrado'; }
    else if (state === 2) { symbol = '\u2605'; cls = 'bool-supuracion'; }
    else if (state === 3) { symbol = '\u25CF\u2605'; cls = 'bool-sangrado bool-supuracion'; }
  } else {
    const v = d ? (d[field][pos] ?? false) : false;
    symbol = v ? '\u25A0' : '';
    cls = v ? 'bool-placa' : '';
  }

  const sep = isQuadSep ? ' quad-sep' : '';
  const disabledClass = d?.ausente ? 'opacity-30 pointer-events-none' : '';
  return `<td class="data-cell bool-cell ${cls}${sep} ${disabledClass}" data-tooth="${tooth}" data-field="${field}" data-pos="${pos}" data-type="bool"
            onclick="onBoolClick(event)">${symbol}</td>`;
}

function furcaCell(tooth, isQuadSep = false) {
  const d = perioData[tooth];
  const v = d ? (d.furca ?? 0) : 0;
  const sep = isQuadSep ? ' quad-sep' : '';
  return `<td colspan="3" class="furca-cell${sep}" data-tooth="${tooth}" data-type="furca"
            onclick="onFurcaClick(event)" style="cursor:pointer;">${furcaLabel(v)}</td>`;
}

function implanteCell(tooth, isQuadSep = false) {
  const d = perioData[tooth];
  const v = d ? (d.implante ?? false) : false;
  const sep = isQuadSep ? ' quad-sep' : '';
  return `<td colspan="3" class="implante-cell${sep}" data-tooth="${tooth}" data-type="implante"
            onclick="onImplanteClick(event)" style="cursor:pointer;">${v ? '<span class="implante-on">&#10022;</span>' : ''}</td>`;
}

function movilidadCell(tooth, isQuadSep = false) {
  const d = perioData[tooth];
  const v = d ? (d.movilidad ?? '') : '';
  const sep = isQuadSep ? ' quad-sep' : '';
  const disabled = d?.ausente ? 'disabled' : '';
  return `<td colspan="3" class="${sep}" data-tooth="${tooth}">
                <input class="mov-input" type="text" maxlength="2" value="${v}" ${disabled}
                    data-tooth="${tooth}" data-field="movilidad"
                    oninput="onTextInput(event)" onfocus="this.select()">
                </td>`;
}

function pronosticoCell(tooth, isQuadSep = false) {
  const d = perioData[tooth];
  const v = d ? (d.pronostico ?? '') : '';
  const sep = isQuadSep ? ' quad-sep' : '';
  const disabled = d?.ausente ? 'disabled' : '';
  return `<td colspan="3" class="${sep}" data-tooth="${tooth}">
                <input class="mov-input" type="text" maxlength="3" value="${v}" ${disabled}
                    data-tooth="${tooth}" data-field="pronostico"
                    oninput="onTextInput(event)" onfocus="this.select()">
                </td>`;
}

function notaCell(tooth, isQuadSep = false) {
  const d = perioData[tooth];
  const v = d ? (d.nota ?? '') : '';
  const sep = isQuadSep ? ' quad-sep' : '';
  const disabled = d?.ausente ? 'disabled' : '';
  return `<td colspan="3" class="${sep}" data-tooth="${tooth}">
                <input class="nota-input" type="text" maxlength="10" value="${v}" ${disabled}
                    data-tooth="${tooth}" data-field="nota"
                    oninput="onTextInput(event)" onfocus="this.select()">
                </td>`;
}

function toothCell(tooth, isUpper, isQuadSep = false) {
  const sep = isQuadSep ? ' quad-sep' : '';
  return `<td colspan="3" class="tooth-cell${sep}" style="cursor:pointer;" onclick="onToothClick(${tooth}, 'v', event)">
                <div class="tooth-wrapper" id="tooth-svg-wrap-${tooth}">${toothSVG(tooth, isUpper, { imageSide: 'v' })}</div>
  </td>`;
}

// ===== FILAS =====
function row(teeth, label, cellFnPerPos, quadSepTooth) {
  let html = `<tr><td class="label-col">${label}</td>`;
  teeth.forEach(t => {
    const isQ = t === quadSepTooth;
    ['m', 'c', 'd'].forEach((pos, pi) => {
      const isSep = isQ && pi === 2;
      html += cellFnPerPos(t, pos, isSep);
    });
  });
  html += '</tr>';
  return html;
}

function rowSingle(teeth, label, cellFnPerTooth, quadSepTooth) {
  let html = `<tr><td class="label-col">${label}</td>`;
  teeth.forEach(t => {
    const isQ = t === quadSepTooth;
    html += cellFnPerTooth(t, isQ);
  });
  html += '</tr>';
  return html;
}

function buildColGroup(teethCount) {
  const dataCols = '<col class="data-col">'.repeat(teethCount * 3);
  return `<colgroup><col class="label-col-col">${dataCols}</colgroup>`;
}

// ===== RENDER TABLA SUPERIOR =====
function renderUpperTable() {
  const table = $('tablaSuperior');
  if (!table) return;
  const teeth = upperTeeth;
  const quadSep = 11;

  let html = buildColGroup(teeth.length) + '<tbody>';
  html += `<tr><td class="label-col" style="width:var(--label-col-width)"></td><td class="arcada-banner" colspan="${teeth.length * 3}">SUPERIOR</td></tr>`;

  html += `<tr><td class="label-col" style="width:var(--label-col-width)"></td>`;
  teeth.forEach(t => {
    const isQ = t === quadSep;
    html += `<td colspan="3" class="tooth-num-cell${isQ ? ' quad-sep' : ''}">${toothLabel(t)}</td>`;
  });
  html += '</tr>';

  html += rowSingle(teeth, 'Implante', (t, isQ) => implanteCell(t, isQ), quadSep);
  html += rowSingle(teeth, 'Movilidad', (t, isQ) => movilidadCell(t, isQ), quadSep);
  html += rowSingle(teeth, 'Pronostico indiv.', (t, isQ) => pronosticoCell(t, isQ), quadSep);
  html += rowSingle(teeth, 'Furca', (t, isQ) => furcaCell(t, isQ), quadSep);
  html += row(teeth, 'Sangrado / Sup.', (t, pos, isSep) => boolCell(t, 'sangrado_v', pos, isSep), quadSep);
  html += row(teeth, 'Placa', (t, pos, isSep) => boolCell(t, 'placa_v', pos, isSep), quadSep);
  html += row(teeth, 'Anchura encia', (t, pos, isSep) => numCell(t, 'anchura', pos, isSep), quadSep);
  html += row(teeth, 'Margen gingival', (t, pos, isSep) => numCell(t, 'margen_v', pos, isSep), quadSep);
  html += row(teeth, 'Prof. de sondaje', (t, pos, isSep) => numCell(t, 'profundidad_v', pos, isSep), quadSep);
  html += teethRowWithChart(teeth, true, 'Vestibular', 'profundidad_v', 'margen_v', quadSep);
  html += teethRowWithChart(teeth, true, 'Palatino', 'profundidad_p', 'margen_p', quadSep, true);
  html += row(teeth, 'Prof. de sondaje', (t, pos, isSep) => numCell(t, 'profundidad_p', pos, isSep), quadSep);
  html += row(teeth, 'Margen gingival', (t, pos, isSep) => numCell(t, 'margen_p', pos, isSep), quadSep);
  html += row(teeth, 'Placa', (t, pos, isSep) => boolCell(t, 'placa_p', pos, isSep), quadSep);
  html += row(teeth, 'Sangrado / Sup.', (t, pos, isSep) => boolCell(t, 'sangrado_p', pos, isSep), quadSep);
  html += rowSingle(teeth, 'Furca', (t, isQ) => furcaCell(t, isQ), quadSep);
  html += rowSingle(teeth, 'Nota', (t, isQ) => notaCell(t, isQ), quadSep);

  html += '</tbody>';
  table.innerHTML = html;
}

// ===== RENDER TABLA INFERIOR =====
function renderLowerTable() {
  const table = $('tablaInferior');
  if (!table) return;
  const teeth = lowerTeeth;
  const quadSep = 41;

  let html = buildColGroup(teeth.length) + '<tbody>';
  html += `<tr><td class="label-col" style="width:var(--label-col-width)"></td><td class="arcada-banner" colspan="${teeth.length * 3}">INFERIOR</td></tr>`;

  html += `<tr><td class="label-col" style="width:var(--label-col-width)"></td>`;
  teeth.forEach(t => {
    const isQ = t === quadSep;
    html += `<td colspan="3" class="tooth-num-cell${isQ ? ' quad-sep' : ''}">${toothLabel(t)}</td>`;
  });
  html += '</tr>';

  html += rowSingle(teeth, 'Nota', (t, isQ) => notaCell(t, isQ), quadSep);
  html += rowSingle(teeth, 'Furca', (t, isQ) => furcaCell(t, isQ), quadSep);
  html += row(teeth, 'Sangrado / Sup.', (t, pos, isSep) => boolCell(t, 'sangrado_p', pos, isSep), quadSep);
  html += row(teeth, 'Placa', (t, pos, isSep) => boolCell(t, 'placa_p', pos, isSep), quadSep);
  html += row(teeth, 'Margen gingival', (t, pos, isSep) => numCell(t, 'margen_p', pos, isSep), quadSep);
  html += row(teeth, 'Prof. de sondaje', (t, pos, isSep) => numCell(t, 'profundidad_p', pos, isSep), quadSep);
  html += teethRowWithChart(teeth, false, 'Lingual', 'profundidad_p', 'margen_p', quadSep, true);
  html += teethRowWithChart(teeth, false, 'Vestibular', 'profundidad_v', 'margen_v', quadSep);
  html += row(teeth, 'Prof. de sondaje', (t, pos, isSep) => numCell(t, 'profundidad_v', pos, isSep), quadSep);
  html += row(teeth, 'Margen gingival', (t, pos, isSep) => numCell(t, 'margen_v', pos, isSep), quadSep);
  html += row(teeth, 'Anchura encia', (t, pos, isSep) => numCell(t, 'anchura', pos, isSep), quadSep);
  html += row(teeth, 'Placa', (t, pos, isSep) => boolCell(t, 'placa_v', pos, isSep), quadSep);
  html += row(teeth, 'Sangrado / Sup.', (t, pos, isSep) => boolCell(t, 'sangrado_v', pos, isSep), quadSep);
  html += rowSingle(teeth, 'Furca', (t, isQ) => furcaCell(t, isQ), quadSep);
  html += rowSingle(teeth, 'Pronostico indiv.', (t, isQ) => pronosticoCell(t, isQ), quadSep);
  html += rowSingle(teeth, 'Movilidad', (t, isQ) => movilidadCell(t, isQ), quadSep);
  html += rowSingle(teeth, 'Implante', (t, isQ) => implanteCell(t, isQ), quadSep);

  html += '</tbody>';
  table.innerHTML = html;
}

// ===== RENDER COMPLETO =====
function render() {
  renderUpperTable();
  renderLowerTable();
  requestAnimationFrame(() => renderChartOverlays());
  updateToothImageControls();
}

function scheduleAutoSave(delayMs = 700) {
  if (!currentPacienteId) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    void guardar({ silent: true });
  }, delayMs);
}

// ===== HANDLERS =====
function onNumKeyDown(e) {
  if (['e', 'E', '+', '-', '.'].includes(e.key)) {
    e.preventDefault();
  }
}
window.onNumKeyDown = onNumKeyDown;

function onNumInput(e) {
  const inp = e.target;
  const digits = String(inp.value || '').replace(/[^\d]/g, '');
  inp.value = digits;

  const tooth = parseInt(inp.dataset.tooth);
  const field = inp.dataset.field;
  const pos = inp.dataset.pos;
  let v = inp.value.trim();
  if (v === '') {
    perioData[tooth][field][pos] = '';
  } else {
    let n = Math.max(0, Math.min(13, parseInt(v) || 0));
    perioData[tooth][field][pos] = n;
    inp.value = n;
  }
  const dc = field.includes('profundidad') ? depthClass(perioData[tooth]?.[field]?.[pos])
    : field === 'anchura' ? anchuraClass(perioData[tooth]?.[field]?.[pos])
      : '';
  inp.className = `perio-input ${dc}`;
  const td = inp.closest('td');
  const keepQuadSep = td?.classList.contains('quad-sep');
  if (td) td.className = `data-cell ${dc}${keepQuadSep ? ' quad-sep' : ''}`;
  if (field.includes('profundidad') || field.includes('margen')) {
    requestAnimationFrame(() => renderChartOverlays());
  }
  scheduleAutoSave();
}
window.onNumInput = onNumInput;

function onToothToggleAbsent(tooth) {
  const d = perioData[tooth];
  if (!d) return;
  d.ausente = !d.ausente;
  if (d.ausente) {
    Object.keys(d).forEach(k => {
      if (k === 'ausente' || k === 'imagen_v' || k === 'imagen_p' || k === 'imagen_url') return;
      if (typeof d[k] === 'object') {
        Object.keys(d[k]).forEach(pos => d[k][pos] = (typeof d[k][pos] === 'boolean' ? false : ''));
      } else if (typeof d[k] === 'boolean') {
        d[k] = false;
      } else if (typeof d[k] === 'string') {
        d[k] = '';
      } else if (typeof d[k] === 'number') {
        d[k] = 0;
      }
    });
  }
  render();
  scheduleAutoSave();
}
window.onToothToggleAbsent = onToothToggleAbsent;

document.addEventListener('keydown', (e) => {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const active = document.activeElement;
  if (!active || !active.classList.contains('perio-input') && !active.classList.contains('mov-input') && !active.classList.contains('nota-input')) return;

  e.preventDefault();
  const all = Array.from(document.querySelectorAll('.perio-input:not([disabled]), .mov-input:not([disabled]), .nota-input:not([disabled])'));
  const idx = all.indexOf(active);
  if (idx === -1) return;

  if (e.key === 'ArrowRight' && idx < all.length - 1) all[idx + 1].focus();
  else if (e.key === 'ArrowLeft' && idx > 0) all[idx - 1].focus();
});

function onBoolClick(e) {
  const td = e.currentTarget;
  const tooth = parseInt(td.dataset.tooth);
  const field = td.dataset.field;
  const pos = td.dataset.pos;
  const d = perioData[tooth];
  if (!d || d.ausente) return;
  let symbol = '';
  let cls = '';
  if (field.includes('sangrado')) {
    const supField = field.replace('sangrado', 'supuracion');
    const state = ((d[field][pos] ? 1 : 0) + (d[supField][pos] ? 2 : 0) + 1) % 4;
    d[field][pos] = (state & 1) === 1;
    d[supField][pos] = (state & 2) === 2;
    if (state === 1) { symbol = '\u25CF'; cls = ' bool-sangrado'; }
    else if (state === 2) { symbol = '\u2605'; cls = ' bool-supuracion'; }
    else if (state === 3) { symbol = '\u25CF\u2605'; cls = ' bool-sangrado bool-supuracion'; }
  } else {
    d[field][pos] = !d[field][pos];
    if (d[field][pos]) {
      symbol = '\u25A0';
      cls = ' bool-placa';
    }
  }
  td.textContent = symbol;
  td.className = `data-cell bool-cell${cls}${td.className.includes('quad-sep') ? ' quad-sep' : ''}`;
  scheduleAutoSave();
}
window.onBoolClick = onBoolClick;

function onFurcaClick(e) {
  const td = e.currentTarget;
  const tooth = parseInt(td.dataset.tooth);
  const d = perioData[tooth];
  if (!d) return;
  d.furca = (d.furca + 1) % 4;
  td.innerHTML = furcaLabel(d.furca);
  scheduleAutoSave();
}
window.onFurcaClick = onFurcaClick;

function onImplanteClick(e) {
  const td = e.currentTarget;
  const tooth = parseInt(td.dataset.tooth);
  const d = perioData[tooth];
  if (!d) return;
  d.implante = !d.implante;
  render();
  scheduleAutoSave();
}
window.onImplanteClick = onImplanteClick;

function onTextInput(e) {
  const inp = e.target;
  const tooth = parseInt(inp.dataset.tooth);
  const field = inp.dataset.field;
  perioData[tooth][field] = inp.value;
  scheduleAutoSave();
}
window.onTextInput = onTextInput;

// ===== OPCION MANUAl PARA REEMPLAZAR IMAGENES =====
function onToothClick(tooth, side, e) {
  if (imageEditionLocked) {
    toast('La edición de imágenes está bloqueada. Para modificarlas, desbloquéalas primero.', 'warn');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png, image/jpeg, image/jpg, image/webp';
  input.onchange = async (evt) => {
    const file = evt.target.files[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (re) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxW = 400; // Optimal size for teeth
          const maxH = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxW) {
              height *= maxW / width;
              width = maxW;
            }
          } else {
            if (height > maxH) {
              width *= maxH / height;
              height = maxH;
            }
          }
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const imgUrl = canvas.toDataURL('image/jpeg', 0.85);
          const d = perioData[tooth];
          if (d) {
            d['imagen_' + side] = imgUrl; // Update standard image side
            
            render();
            scheduleAutoSave(100);
            toast('Imagen del diente actualizada', 'ok');
          }
        };
        img.src = re.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      toast('Error al leer imagen', 'error');
    }
  };
  input.click();
}
window.onToothClick = onToothClick;

// ===== GUARDAR / CARGAR =====
function getToothImagesPayload() {
  const payload = {};
  allTeeth.forEach(t => {
    const d = perioData[t];
    if (!d) return;
    normalizeToothImageFields(d);
    payload[t] = {
      imagen_v: d.imagen_v || '',
      imagen_p: d.imagen_p || '',
      imagen_url: d.imagen_url || '',
    };
  });
  return payload;
}

function applyToothImagesPayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  allTeeth.forEach(t => {
    const src = payload[t];
    const d = perioData[t];
    if (!d || !src || typeof src !== 'object') return;
    
    const isValidString = (s) => typeof s === 'string' && s !== 'undefined' && s !== 'null' && s !== '[object Object]';
    
    if (isValidString(src.imagen_v)) d.imagen_v = src.imagen_v;
    if (isValidString(src.imagen_p)) d.imagen_p = src.imagen_p;
    if (isValidString(src.imagen_url)) d.imagen_url = src.imagen_url;
    normalizeToothImageFields(d);
  });
}

function countToothImagesInPayload(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  return Object.values(payload).reduce((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    return acc + (((entry.imagen_v && String(entry.imagen_v).trim())
      || (entry.imagen_p && String(entry.imagen_p).trim())
      || (entry.imagen_url && String(entry.imagen_url).trim())) ? 1 : 0);
  }, 0);
}

// extractStoredToothImages is no longer needed as the API will return structured data
// function extractStoredToothImages(row) {
//   const payload = {};
//   const append = (source) => {
//     if (!source || typeof source !== 'object') return;
//     const rawTeeth = source.teeth && typeof source.teeth === 'object' ? source.teeth : source;
//     if (!rawTeeth || typeof rawTeeth !== 'object') return;
//     Object.entries(rawTeeth).forEach(([tooth, entry]) => {
//       if (!/^\d+$/.test(String(tooth)) || !entry || typeof entry !== 'object') return;
//       payload[tooth] = {
//         imagen_v: typeof entry.imagen_v === 'string' ? entry.imagen_v : '',
//         imagen_p: typeof entry.imagen_p === 'string' ? entry.imagen_p : '',
//         imagen_url: typeof entry.imagen_url === 'string' ? entry.imagen_url : '',
//       };
//     });
//   };

//   try {
//     if (row?.datos) append(JSON.parse(row.datos));
//   } catch (_) { }

//   try {
//     if (row?.dientes_imagenes) append(JSON.parse(row.dientes_imagenes));
//   } catch (_) { }

//   return payload;
// }

// ensurePeriodontogramaSchema is removed
// async function ensurePeriodontogramaSchema() {
//   await dbRun(`CREATE TABLE IF NOT EXISTS periodontograma(
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       paciente_id INTEGER NOT NULL,
//       datos TEXT,
//       fecha TEXT,
//       UNIQUE(paciente_id)
//     )`);

//   const cols = await dbAll('PRAGMA table_info(periodontograma)');
//   const names = new Set((cols || []).map(c => c.name));
//   periodontogramaColumns = names;
//   if (!names.has('dientes_imagenes')) {
//     await dbRun('ALTER TABLE periodontograma ADD COLUMN dientes_imagenes TEXT');
//     names.add('dientes_imagenes');
//   }
//   if (!names.has('dientes_bloqueados')) {
//     await dbRun('ALTER TABLE periodontograma ADD COLUMN dientes_bloqueados INTEGER DEFAULT 0');
//     names.add('dientes_bloqueados');
//   }
//   periodontogramaColumns = names;
// }
async function guardar(opts = {}) {
  const { silent = false } = opts;
  if (!currentPacienteId) {
    if (!silent) toast('No hay paciente seleccionado', 'warn');
    return false;
  }
  if (saveInFlight) {
    saveQueued = true;
    return false;
  }
  saveInFlight = true;
  try {
    const datos = { version: 2, teeth: perioData };
    const dientesImagenes = getToothImagesPayload();

    if (!api) {
      throw new Error('window.api no disponible en este contexto (sin preload)');
    }

    const result = await api.clinical.savePeriodontogram({
      paciente_id: currentPacienteId,
      datos,
      dientes_imagenes: dientesImagenes,
      dientes_bloqueados: imageEditionLocked ? 1 : 0,
    });

    if (!result) throw new Error('El backend retornó null/false');
    if (!silent) toast('Guardado correctamente', 'ok');
    return true;
  } catch (err) {
    console.error('Error en guardar():', err);
    if (!silent) toast('Error al guardar: ' + err.message, 'error');
    return false;
  } finally {
    saveInFlight = false;
    if (saveQueued) {
      saveQueued = false;
      scheduleAutoSave(250);
    }
  }
}

async function cargar() {
  if (!currentPacienteId) return;
  try {
    const row = await api.clinical.getPeriodontogram(currentPacienteId);
    if (row) {
      if (row.datos) {
        const parsed = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos;
        const teethData = parsed?.teeth || parsed || {};
        Object.keys(teethData).forEach(k => {
          if (perioData[k]) Object.assign(perioData[k], teethData[k]);
        });
      }

      if (row.dientes_imagenes) {
        const imgs = typeof row.dientes_imagenes === 'string' 
          ? JSON.parse(row.dientes_imagenes) 
          : row.dientes_imagenes;
        applyToothImagesPayload(imgs);
      }
      imageEditionLocked = !!row.dientes_bloqueados;
      allTeeth.forEach(t => normalizeToothImageFields(perioData[t]));
    }
  } catch (err) {
    console.error(err);
  }
}

function limpiar() {
  if (!confirm('Â¿Limpiar todos los datos del periodontograma?')) return;
  const imgs = getToothImagesPayload();
  const lockState = imageEditionLocked;
  initData();
  applyToothImagesPayload(imgs);
  imageEditionLocked = lockState;
  render();
  toast('Datos limpiados (dientes conservados)', 'info');
  scheduleAutoSave(300);
}

// ===== INIT =====
async function init() {
  currentPacienteId = getQueryParam('paciente_id') || getQueryParam('id');
  updateHeaderDateTime();
  setInterval(updateHeaderDateTime, 60000);

  if (currentPacienteId && db) {
    try {
      const p = await dbGet('SELECT nombre, apellido, fecha_nacimiento FROM pacientes WHERE id = ?', [currentPacienteId]);
      if (p) {
        const nom = $('pacienteNombre');
        const ape = $('pacienteApellido');
        const fna = $('pacienteFechaNacimiento');
        const hc = $('pacienteHC');
        const idEl = $('pacienteId');
        if (nom) nom.textContent = (p.nombre || '--');
        if (ape) ape.textContent = (p.apellido || '--');
        if (fna) fna.textContent = formatDateOnly(p.fecha_nacimiento);
        if (hc) hc.textContent = currentPacienteId || '--';
        if (idEl) idEl.textContent = `#${currentPacienteId}`;
      }
    } catch (e) { console.error(e); }
  }

  initData();
  await cargar();
  render();

  $('btnGuardar')?.addEventListener('click', async () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    await guardar({ silent: false });
  });
  $('btnReset')?.addEventListener('click', limpiar);
  $('btn-print-periodontograma')?.addEventListener('click', () => {
    window.print();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
