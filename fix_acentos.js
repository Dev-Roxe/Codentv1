#!/usr/bin/env node
// fix_acentos.js — repara secuencias UTF-8 doblemente codificadas en archivos fuente
'use strict';
const fs = require('fs');
const path = require('path');

// Mapa de secuencias corruptas → carácter correcto
// Origen: archivo guardado como Latin-1(Windows-1252) pero leído como UTF-8
// Cada "corrupto" es cómo se ve en UTF-8 la secuencia de bytes Latin-1
const REPLACEMENTS = [
  // Vocales minúsculas con tilde
  ['\u00C3\u00A1', '\u00E1'],  // á
  ['\u00C3\u00A9', '\u00E9'],  // é
  ['\u00C3\u00AD', '\u00ED'],  // í
  ['\u00C3\u00B3', '\u00F3'],  // ó
  ['\u00C3\u00BA', '\u00FA'],  // ú
  // Vocales mayúsculas con tilde
  ['\u00C3\u0081', '\u00C1'],  // Á
  ['\u00C3\u0089', '\u00C9'],  // É
  ['\u00C3\u008D', '\u00CD'],  // Í
  ['\u00C3\u0093', '\u00D3'],  // Ó
  ['\u00C3\u009A', '\u00DA'],  // Ú
  // ñ/Ñ
  ['\u00C3\u00B1', '\u00F1'],  // ñ
  ['\u00C3\u0091', '\u00D1'],  // Ñ
  // ü/ö/ä
  ['\u00C3\u00BC', '\u00FC'],  // ü
  ['\u00C3\u00B6', '\u00F6'],  // ö
  ['\u00C3\u00A4', '\u00E4'],  // ä
  // ¿ ¡
  ['\u00C2\u00BF', '\u00BF'],  // ¿
  ['\u00C2\u00A1', '\u00A1'],  // ¡
  // Em dash, comillas, apóstrofe, etc.
  ['\u00E2\u0080\u0094', '\u2014'],  // —
  ['\u00E2\u0080\u009C', '\u201C'],  // "
  ['\u00E2\u0080\u009D', '\u201D'],  // "
  ['\u00E2\u0080\u0099', '\u2019'],  // '
  ['\u00E2\u0080\u00A2', '\u2022'],  // •
  ['\u00E2\u0080\u00A6', '\u2026'],  // …
  // Símbolos comunes
  ['\u00C2\u00B0', '\u00B0'],  // °
  ['\u00C2\u00A9', '\u00A9'],  // ©
  ['\u00C2\u00AE', '\u00AE'],  // ®
  ['\u00C2\u00A0', '\u00A0'],  // NBSP
  ['\u00C2\u00B7', '\u00B7'],  // ·
  ['\u00C3\u00A7', '\u00E7'],  // ç
  // Emojis corruptos comunes (4-byte UTF-8 mal leídos como Latin-1)
  ['\u00F0\u009F\u0094\u00A7', '\u{1F527}'],  // 🔧
  ['\u00F0\u009F\u0094\u008A', '\u{1F50A}'],  // 🔊  
  ['\u00F0\u009F\u0091\u0081\uFFFD\u00B8','\u{1F441}\uFE0F'],  // 👁️
  ['\u00F0\u009F\u0091\u0081\u00EF\u00B8','\u{1F441}\uFE0F'], // 👁️ variant
  ['\u00F0\u009F\u0094\u00A7', '\u{1F527}'],  // 🔧
  // ç (cedille) 
  ['\u00C3\u00A7', '\u00E7'],  // ç
  ['\u00C3\u0087', '\u00C7'],  // Ç
];

const EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.md']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__']);

let totalFiles = 0;
let totalChanges = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let changes = 0;
  
  for (const [corrupt, correct] of REPLACEMENTS) {
    const before = content;
    // Reemplazar todas las ocurrencias
    const escaped = corrupt.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    // Simple string split-join para reemplazar todo
    while (content.includes(corrupt)) {
      content = content.split(corrupt).join(correct);
      changes++;
    }
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    totalChanges += changes;
    console.log(`  Fixed: ${path.basename(filePath)} (${changes} reemplazos)`);
  }
}

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return; }
  
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      fixFile(full);
    }
  }
}

console.log('Iniciando reparación de acentos...\n');
walk(path.join(__dirname, 'src'));

console.log(`\n=== COMPLETADO: ${totalFiles} archivos corregidos, ${totalChanges} reemplazos ===`);
