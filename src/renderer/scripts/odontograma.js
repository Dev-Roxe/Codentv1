// odontograma.js (Vanilla JS)
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

// Estado
let selectedTooth = null;
let teethStatus = {}; // { [toothNumber]: { treatment: 'caries', surfaces: { oclusal:true ... } } }
let showAdultTeeth = true;

let showSurfaceModal = false;
let selectedSurfaces = {}; // { [toothNumber]: { oclusal:true ... } }
let currentTreatment = null;

// Datos
const adultTeeth = {
  superior: [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28],
  inferior: [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38],
};

const childTeeth = {
  superior: [55,54,53,52,51,61,62,63,64,65],
  inferior: [85,84,83,82,81,71,72,73,74,75],
};

const treatments = [
  { id: "profilaxis-simple", name: "Profilaxis Simple", color: "#4EABBE" },
  { id: "profilaxis-profunda", name: "Profilaxis Profunda", color: "#1D5D69" },
  { id: "caries", name: "Lesión de Caries", color: "#EF4444" },
  { id: "pulpar", name: "Infección Pulpar", color: "#F97316" },
  { id: "fractura", name: "Fractura", color: "#EAB308" },
  { id: "ausente", name: "Ausente", color: "#6B7280" },
  { id: "restauracion", name: "Restauración", color: "#4EABBE" },
  { id: "endodoncia", name: "Endodoncia", color: "#A855F7" },
  { id: "corona", name: "Corona", color: "#FBBF24" },
  { id: "implante", name: "Implante", color: "#1D5D69" },
  { id: "perno", name: "Perno Muñón", color: "#374151" },
];

const surfaceMeta = [
  { id: "oclusal", name: "Oclusal", desc: "Superficie de masticación" },
  { id: "mesial", name: "Mesial", desc: "Hacia el centro" },
  { id: "distal", name: "Distal", desc: "Alejada del centro" },
  { id: "vestibular", name: "Vestibular", desc: "Cara externa/labial" },
  { id: "lingual", name: "Lingual", desc: "Cara interna/lingual" },
];

// Helpers DOM
const $ = (id) => document.getElementById(id);

function currentTeeth() {
  return showAdultTeeth ? adultTeeth : childTeeth;
}

function getToothColor(toothNumber) {
  const status = teethStatus[toothNumber];
  if (!status) return "#FFFFFF";
  const t = treatments.find(x => x.id === status.treatment);
  return t?.color || "#FFFFFF";
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
  const maxOffset = showAdultTeeth ? 10 : 7;
  const offset = dist * maxOffset;
  return isUpper ? -offset : offset;
}

function renderSurfaceMarks(surfaces, isUpper, color, w, h) {
  if (!surfaces) return "";
  const mark = (cond, svg) => (cond ? svg : "");
  const ocY = isUpper ? h * 0.36 : h * 0.64;
  const sideY = isUpper ? h * 0.28 : h * 0.38;
  const sideH = h * 0.34;
  const vestY = isUpper ? h * 0.18 : h * 0.76;
  const lingY = isUpper ? h * 0.76 : h * 0.18;

  return `
    <g opacity="0.85">
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
  const strokeWidth = 2.4;
  const borderColor = isSelected ? "#4EABBE" : (treatmentColor || "#8BCFDD");
  const gradientId = `tooth-grad-${num}-${isUpper ? "u" : "l"}`;
  const shineId = `tooth-shine-${num}-${isUpper ? "u" : "l"}`;
  const shapeType = getToothType(num).replace("child-", "");

  let path = "";
  let detail = "";

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
        <path d="M ${w * 0.25} ${h * 0.16} L ${w * 0.5} ${h * 0.36}" stroke="rgba(139, 207, 221, 0.35)" stroke-width="1.2" fill="none"/>
        <path d="M ${w * 0.75} ${h * 0.16} L ${w * 0.5} ${h * 0.36}" stroke="rgba(139, 207, 221, 0.35)" stroke-width="1.2" fill="none"/>
        <path d="M ${w * 0.5} ${h * 0.26} L ${w * 0.5} ${h * 0.56}" stroke="rgba(139, 207, 221, 0.25)" stroke-width="1" fill="none"/>
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
        <path d="M ${w * 0.25} ${h * 0.84} L ${w * 0.5} ${h * 0.64}" stroke="rgba(139, 207, 221, 0.35)" stroke-width="1.2" fill="none"/>
        <path d="M ${w * 0.75} ${h * 0.84} L ${w * 0.5} ${h * 0.64}" stroke="rgba(139, 207, 221, 0.35)" stroke-width="1.2" fill="none"/>
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
        <path d="M ${w * 0.35} ${h * 0.20} L ${w * 0.5} ${h * 0.35}" stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.1" fill="none"/>
        <path d="M ${w * 0.65} ${h * 0.20} L ${w * 0.5} ${h * 0.35}" stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.1" fill="none"/>
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
        <path d="M ${w * 0.35} ${h * 0.80} L ${w * 0.5} ${h * 0.65}" stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.1" fill="none"/>
        <path d="M ${w * 0.65} ${h * 0.80} L ${w * 0.5} ${h * 0.65}" stroke="rgba(139, 207, 221, 0.3)" stroke-width="1.1" fill="none"/>
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
      detail = `
        <path d="M ${w * 0.5} ${h * 0.14} L ${w * 0.5} ${h * 0.54}" stroke="rgba(139, 207, 221, 0.35)" stroke-width="1.2" fill="none"/>
      `;
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
      detail = `
        <path d="M ${w * 0.5} ${h * 0.88} L ${w * 0.5} ${h * 0.50}" stroke="rgba(139, 207, 221, 0.35)" stroke-width="1.2" fill="none"/>
      `;
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
      detail = `
        <path d="M ${w * 0.35} ${h * 0.30} Q ${w * 0.5} ${h * 0.35} ${w * 0.65} ${h * 0.30}" stroke="rgba(139, 207, 221, 0.25)" stroke-width="1" fill="none"/>
      `;
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
      detail = `
        <path d="M ${w * 0.35} ${h * 0.70} Q ${w * 0.5} ${h * 0.65} ${w * 0.65} ${h * 0.70}" stroke="rgba(139, 207, 221, 0.25)" stroke-width="1" fill="none"/>
      `;
    }
  }

  const surfaceColor = treatmentColor || "#EF4444";
  const overlays = !isMissing && surfaces ? renderSurfaceMarks(surfaces, isUpper, surfaceColor, w, h) : "";
  const missingMark = isMissing
    ? `
      <line x1="${w * 0.2}" y1="${h * 0.2}" x2="${w * 0.8}" y2="${h * 0.8}" stroke="#EF4444" stroke-width="3" opacity="0.7"/>
      <line x1="${w * 0.8}" y1="${h * 0.2}" x2="${w * 0.2}" y2="${h * 0.8}" stroke="#EF4444" stroke-width="3" opacity="0.7"/>
    `
    : "";
  const baseOpacity = isMissing ? 0.45 : 1;

  return `
    <svg viewBox="0 0 ${w} ${h}" class="w-full h-full">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#FFFEF9;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#FFF7E9;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#F3E9DC;stop-opacity:1" />
        </linearGradient>
        <radialGradient id="${shineId}" cx="50%" cy="${isUpper ? "30%" : "70%"}">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.6);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
        </radialGradient>
      </defs>
      <path d="${path}"
            fill="url(#${gradientId})"
            stroke="${borderColor}"
            stroke-width="${strokeWidth}"
            stroke-dasharray="${isMissing ? "5 4" : "0"}"
            opacity="${baseOpacity}" />
      ${detail}
      <ellipse cx="${w * 0.5}" cy="${isUpper ? h * 0.28 : h * 0.72}" rx="${w * 0.28}" ry="${h * 0.16}" fill="url(#${shineId})" opacity="0.7"/>
      ${overlays}
      ${missingMark}
    </svg>
  `;
}

function setSelected(toothNumber) {
  selectedTooth = toothNumber;
  render();
}

function clearSelected() {
  selectedTooth = null;
  render();
}

async function handleTreatmentSelect(treatment) {
  if (!selectedTooth || !currentPacienteId) return;

  // caries/restauracion -> modal por caras
  if (treatment.id === "caries" || treatment.id === "restauracion") {
    currentTreatment = treatment;
    showSurfaceModal = true;
    if (!selectedSurfaces[selectedTooth]) selectedSurfaces[selectedTooth] = {};
    render();
    return;
  }

  // directos (guardar en BD)
  teethStatus[selectedTooth] = { treatment: treatment.id, surfaces: {} };
  await saveTreatmentToDB(selectedTooth, treatment.id, {});
  selectedTooth = null;
  render();
}

function toggleSurface(surfaceId) {
  if (!selectedTooth) return;
  const cur = selectedSurfaces[selectedTooth] || {};
  selectedSurfaces[selectedTooth] = {
    ...cur,
    [surfaceId]: !cur[surfaceId],
  };
  renderModalContents();
}

async function saveSurfaceSelection() {
  if (!selectedTooth || !currentTreatment || !currentPacienteId) return;

  const surfaces = selectedSurfaces[selectedTooth] || {};
  const surfacesList = Object.keys(surfaces).filter(k => surfaces[k]);

  teethStatus[selectedTooth] = {
    treatment: currentTreatment.id,
    surfaces: surfaces,
  };

  await saveTreatmentToDB(selectedTooth, currentTreatment.id, surfaces);

  showSurfaceModal = false;
  currentTreatment = null;
  selectedTooth = null;
  render();
}

async function saveTreatmentToDB(toothNumber, treatmentId, surfaces) {
  if (!currentPacienteId || !db) return;
  
  try {
    const surfacesList = Object.keys(surfaces).filter(k => surfaces[k]);
    const caras = surfacesList.length > 0 ? surfacesList.join(', ') : null;
    const procedimiento = treatments.find(t => t.id === treatmentId)?.name || treatmentId;
    
    await dbRun(
      'INSERT INTO tratamientos (paciente_id, diente, procedimiento, notas, fecha) VALUES (?, ?, ?, ?, datetime("now"))',
      [currentPacienteId, toothNumber.toString(), procedimiento, caras ? `Caras: ${caras}` : null]
    );
    
    // Notificar al padre si está en iframe para actualizar historial
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'tratamiento-guardado' }, '*');
    }
  } catch (e) {
    console.error('Error guardando tratamiento:', e);
    alert('Error al guardar tratamiento: ' + (e.message || e));
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
      
      // Extraer tipo de tratamiento del procedimiento
      let treatmentId = null;
      const proc = row.procedimiento?.toLowerCase() || '';
      
      if (proc.includes('profilaxis simple')) treatmentId = 'profilaxis-simple';
      else if (proc.includes('profilaxis profunda')) treatmentId = 'profilaxis-profunda';
      else if (proc.includes('caries') || proc.includes('lesión')) treatmentId = 'caries';
      else if (proc.includes('restauración') || proc.includes('restauracion')) treatmentId = 'restauracion';
      else if (proc.includes('endodoncia')) treatmentId = 'endodoncia';
      else if (proc.includes('corona')) treatmentId = 'corona';
      else if (proc.includes('implante')) treatmentId = 'implante';
      else if (proc.includes('ausente')) treatmentId = 'ausente';
      else if (proc.includes('fractura')) treatmentId = 'fractura';
      else if (proc.includes('pulpar')) treatmentId = 'pulpar';
      else if (proc.includes('perno')) treatmentId = 'perno';
      
      if (!treatmentId) return;
      
      // Extraer caras si existen
      const surfaces = {};
      if (row.notas && row.notas.includes('Caras:')) {
        const carasStr = row.notas.split('Caras:')[1]?.trim();
        if (carasStr) {
          const carasList = carasStr.split(',').map(c => c.trim().toLowerCase());
          const validSurfaces = ['oclusal', 'mesial', 'distal', 'vestibular', 'lingual'];
          carasList.forEach(cara => {
            // Normalizar nombres de caras
            let normalized = cara;
            if (cara.includes('oclusal') || cara.includes('oclusal')) normalized = 'oclusal';
            else if (cara.includes('mesial')) normalized = 'mesial';
            else if (cara.includes('distal')) normalized = 'distal';
            else if (cara.includes('vestibular') || cara.includes('labial')) normalized = 'vestibular';
            else if (cara.includes('lingual') || cara.includes('palatal')) normalized = 'lingual';
            
            if (validSurfaces.includes(normalized)) {
              surfaces[normalized] = true;
            }
          });
        }
      }
      
      teethStatus[toothNum] = {
        treatment: treatmentId,
        surfaces: surfaces
      };
    });
    
    render();
  } catch (e) {
    console.error('Error cargando tratamientos:', e);
  }
}

function cancelModal() {
  showSurfaceModal = false;
  if (selectedTooth) selectedSurfaces[selectedTooth] = {};
  currentTreatment = null;
  render();
}

// Renderers
function renderToothButton(num, isUpper, index, total) {
  const status = teethStatus[num];
  const surfaces = status?.surfaces || {};
  const hasSurfaces = Object.values(surfaces).some(Boolean);
  const treatment = status ? treatments.find(t => t.id === status.treatment) : null;
  const treatColor = treatment?.color || "";
  const isSelected = selectedTooth === num;
  const isMissing = status?.treatment === "ausente";
  const offset = arcOffset(index, total, isUpper);

  const border = isSelected ? "#4EABBE" : (treatColor || "#8BCFDD");
  const shadow = isSelected
    ? "0 0 0 4px rgba(78, 171, 190, 0.25), 0 12px 24px rgba(15, 37, 50, 0.18)"
    : treatColor
      ? `0 0 0 3px ${hexToRgba(treatColor, 0.22)}, 0 10px 20px rgba(15, 37, 50, 0.12)`
      : "0 6px 14px rgba(15, 37, 50, 0.08)";

  const label = treatment?.name || "";
  const title = escapeAttr(label ? `Pieza ${num} - ${label}` : `Pieza ${num}`);

  return `
    <div class="odonto-tooth" style="transform: translateY(${offset}px);">
      <div class="odonto-tooth-number">${num}</div>
      <button data-tooth="${num}"
        class="odonto-tooth-btn ${isSelected ? "is-selected" : ""} ${treatment ? "has-treatment" : ""}"
        title="${title}"
        aria-label="${title}"
        style="border-color:${border}; box-shadow:${shadow}; --treat-color:${treatColor || "#8BCFDD"};"
      >
        ${createToothSVG(num, isUpper, isSelected, treatColor, hasSurfaces ? surfaces : null, isMissing)}
      </button>
      <div class="odonto-tooth-label">${label}</div>
    </div>
  `;
}
function renderTreatments() {
  const cont = $("listaTratamientos");
  cont.innerHTML = treatments.map(t => `
    <button data-treatment="${t.id}"
      class="w-full p-4 rounded-lg transition-all transform hover:scale-105 hover:shadow-lg flex items-center gap-3 text-white font-semibold shadow-md"
      style="background:${t.color}"
    >
      <span>${t.name}</span>
    </button>
  `).join("");

  cont.querySelectorAll("button[data-treatment]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-treatment");
      const t = treatments.find(x => x.id === id);
      if (t) {
        await handleTreatmentSelect(t);
      }
    });
  });
}

function renderLegend() {
  const cont = $("leyenda");
  if (!cont) return;
  cont.innerHTML = treatments.map(t => `
    <div class="flex items-center gap-3 p-3 rounded-lg bg-[#F8F7F7] dark:bg-[#0B1721] border border-[#8BCFDD]/30 dark:border-slate-700">
      <div class="w-10 h-10 rounded-lg shadow-md" style="background:${t.color}"></div>
      <span class="text-sm font-semibold text-[#0F2532] dark:text-slate-200">${t.name}</span>
    </div>
  `).join("");
}

function renderModalContents() {
  if (!showSurfaceModal) return;

  $("modalPieza").textContent = selectedTooth ?? "";
  $("btnGuardarModal").textContent = currentTreatment
    ? `Guardar como ${currentTreatment.name}`
    : "Guardar";
  $("btnGuardarModal").style.backgroundColor = currentTreatment?.color || "#4EABBE";

  // Vista
  const sel = selectedSurfaces[selectedTooth] || {};
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
            <rect data-surface="${s.id}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="8"
              style="fill:${active ? "#EF4444" : "#E5E7EB"}; stroke:#1D5D69; stroke-width:2"
              class="cursor-pointer"
            ></rect>
            <text x="${s.x + s.w/2}" y="${s.y + s.h/2 + 5}" text-anchor="middle"
              style="fill:${active ? "#FFFFFF" : "#0F2532"}; font-weight:700; font-size:${s.label.length > 1 ? 12 : 16}px"
              class="pointer-events-none"
            >${s.label}</text>
          </g>
        `;
      }).join("")}
    </svg>
  `;

  $("vistaCaras").querySelectorAll("[data-surface]").forEach(el => {
    el.addEventListener("click", () => toggleSurface(el.getAttribute("data-surface")));
  });

  // Lista
  $("listaCaras").innerHTML = surfaceMeta.map(s => {
    const active = !!sel[s.id];
    return `
      <button data-surface-btn="${s.id}"
        class="w-full p-4 rounded-xl border-2 transition-all text-left shadow-sm"
        style="background:${active ? "#4EABBE" : "#FFFFFF"};
               border-color:${active ? "#4EABBE" : "#8BCFDD"};
               color:${active ? "#FFFFFF" : "#0F2532"}"
      >
        <div class="font-bold">${s.name}</div>
        <div class="text-sm opacity-80">${s.desc}</div>
      </button>
    `;
  }).join("");

  $("listaCaras").querySelectorAll("[data-surface-btn]").forEach(btn => {
    btn.addEventListener("click", () => toggleSurface(btn.getAttribute("data-surface-btn")));
  });
}

function render() {
  // radio buttons adulto/infantil
  const radioInf = $("radioInfantil");
  const radioAdu = $("radioAdulto");

  if (radioInf && radioAdu) {
    radioInf.checked = !showAdultTeeth;
    radioAdu.checked = showAdultTeeth;
  }

  const titulo = $("tituloDenticion");
  if (titulo) {
    titulo.textContent = showAdultTeeth
      ? "Dentigrama Adulto"
      : "Dentigrama Infantil";
  }

  // dientes
  const teeth = currentTeeth();
  $("filaSuperior").innerHTML = teeth.superior
    .map((n, idx) => renderToothButton(n, true, idx, teeth.superior.length))
    .join("");
  $("filaInferior").innerHTML = teeth.inferior
    .map((n, idx) => renderToothButton(n, false, idx, teeth.inferior.length))
    .join("");

  // listeners dientes
  document.querySelectorAll("button[data-tooth]").forEach(btn => {
    btn.addEventListener("click", () => setSelected(parseInt(btn.getAttribute("data-tooth"), 10)));
  });

  // panel de tratamientos
  const panel = $("tratamientosPanel");

  if (selectedTooth && panel) {
    panel.classList.remove("hidden");
    const piezaPanel = $("piezaPanel");
    if (piezaPanel) piezaPanel.textContent = selectedTooth;
    renderTreatments();
  } else {
    if (panel) panel.classList.add("hidden");
    const listaTratamientos = $("listaTratamientos");
    if (listaTratamientos) listaTratamientos.innerHTML = "";
  }

  // modal
  const overlay = $("modalOverlay");
  if (showSurfaceModal) {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    renderModalContents();
  } else {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }

  // leyenda
  renderLegend();
}

// Init
async function init() {
  // Cargar ID del paciente desde URL
  const pacienteId = getQueryParam('id');
  if (!pacienteId) {
    console.error('ID de paciente no especificado');
    return;
  }
  currentPacienteId = pacienteId;

  // Configurar radio buttons
  const radioInf = $("radioInfantil");
  const radioAdu = $("radioAdulto");
  
  if (radioInf) {
    radioInf.addEventListener("change", () => {
      if (radioInf.checked) {
        showAdultTeeth = false;
        clearSelected();
      }
    });
  }
  
  if (radioAdu) {
    radioAdu.addEventListener("change", () => {
      if (radioAdu.checked) {
        showAdultTeeth = true;
        clearSelected();
      }
    });
  }

  // Botón profilaxis
  const btnProfilaxis = $("btnProfilaxis");
  const dropdownProfilaxis = $("dropdownProfilaxis");
  
  if (btnProfilaxis && dropdownProfilaxis) {
    btnProfilaxis.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownProfilaxis.classList.toggle("hidden");
    });
    
    // Cerrar dropdown al hacer click fuera
    document.addEventListener("click", (e) => {
      if (btnProfilaxis && dropdownProfilaxis && 
          !btnProfilaxis.contains(e.target) && 
          !dropdownProfilaxis.contains(e.target)) {
        dropdownProfilaxis.classList.add("hidden");
      }
    });
    
    // Eventos de los items del dropdown
    dropdownProfilaxis.querySelectorAll("[data-treatment]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const treatmentId = btn.getAttribute("data-treatment");
        const treatment = treatments.find(t => t.id === treatmentId);
        if (treatment && selectedTooth) {
          await handleTreatmentSelect(treatment);
          dropdownProfilaxis.classList.add("hidden");
        } else if (!selectedTooth) {
          alert("Por favor, seleccione una pieza dental primero");
          dropdownProfilaxis.classList.add("hidden");
        }
      });
    });
  }

  // Botón cerrar panel
  const btnCerrarPanel = $("btnCerrarPanel");
  if (btnCerrarPanel) {
    btnCerrarPanel.addEventListener("click", () => {
      clearSelected();
    });
  }

  // Modal
  const btnCancelarModal = $("btnCancelarModal");
  const btnGuardarModal = $("btnGuardarModal");
  
  if (btnCancelarModal) {
    btnCancelarModal.addEventListener("click", cancelModal);
  }
  
  if (btnGuardarModal) {
    btnGuardarModal.addEventListener("click", saveSurfaceSelection);
  }

  // Cargar tratamientos desde BD
  await loadTreatmentsFromDB();
  
  // Render inicial
  render();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
