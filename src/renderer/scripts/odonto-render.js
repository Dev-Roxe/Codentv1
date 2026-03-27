window.OdontoRender = (function () {

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

    const adultTeeth = {
        superior: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
        inferior: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
    };

    const childTeeth = {
        superior: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
        inferior: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
    };

    const FACE_LABELS = {
        oclusal: "Oclusal",
        mesial: "Mesial",
        distal: "Distal",
        vestibular: "Vestibular",
        lingual: "Lingual",
    };

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

    function arcOffset(index, total, isUpper, showAdultTeeth) {
        if (total <= 1) return 0;
        const mid = (total - 1) / 2;
        const dist = Math.abs(index - mid) / mid;
        const maxOffset = showAdultTeeth ? 12 : 8;
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
        const w = 100;
        const h = 130;
        const strokeWidth = isSelected ? 3 : 1.5;

        const borderColor = isSelected ? BRAND.primary : (treatmentColor ? treatmentColor : "rgba(15,37,50,0.15)");
        const shapeType = getToothType(num).replace("child-", "");

        let mainFill = `url(#tooth-body-${num})`;
        if (treatmentColor && isMissing) { // If missing, tooth is mostly transparent but maybe tinted
             mainFill = "transparent";
        }

        // --- Anatomical Paths ---
        // These paths are redesigned to look much more natural and bulbous, mimicking real teeth
        let crownPath = "";
        let rootsPath = "";
        let details = "";

        if (shapeType === "molar") {
            if (isUpper) {
                // Upper Molar: 3 roots (2 buccal visible), wide crown
                rootsPath = `
                    M ${w*0.25} ${h*0.45} 
                    C ${w*0.2} ${h*0.3}, ${w*0.1} ${h*0.15}, ${w*0.25} ${h*0.05}
                    C ${w*0.35} ${h*0.05}, ${w*0.38} ${h*0.2}, ${w*0.4}  ${h*0.45}
                    M ${w*0.6}  ${h*0.45}
                    C ${w*0.62} ${h*0.2}, ${w*0.65} ${h*0.05}, ${w*0.8}  ${h*0.05}
                    C ${w*0.9}  ${h*0.15}, ${w*0.8} ${h*0.3},  ${w*0.75} ${h*0.45}
                    M ${w*0.4}  ${h*0.45}
                    C ${w*0.45} ${h*0.1}, ${w*0.55} ${h*0.1},  ${w*0.6}  ${h*0.45}
                `;
                crownPath = `
                    M ${w*0.15} ${h*0.42}
                    C ${w*0.02} ${h*0.6}, ${w*0.05} ${h*0.8}, ${w*0.18} ${h*0.88}
                    C ${w*0.3}  ${h*0.95}, ${w*0.4} ${h*0.85}, ${w*0.5}  ${h*0.88}
                    C ${w*0.6}  ${h*0.85}, ${w*0.7} ${h*0.95}, ${w*0.82} ${h*0.88}
                    C ${w*0.95} ${h*0.8}, ${w*0.98} ${h*0.6}, ${w*0.85} ${h*0.42}
                    C ${w*0.7}  ${h*0.35}, ${w*0.3} ${h*0.35}, ${w*0.15} ${h*0.42} Z
                `;
                details = `<path d="M ${w*0.3} ${h*0.6} Q ${w*0.4} ${h*0.75} ${w*0.5} ${h*0.88} M ${w*0.7} ${h*0.6} Q ${w*0.6} ${h*0.75} ${w*0.5} ${h*0.88} M ${w*0.5} ${h*0.4} L ${w*0.5} ${h*0.6}" fill="none" stroke="rgba(15,37,50,0.12)" stroke-width="1.5" stroke-linecap="round"/>`;
            } else {
                // Lower Molar: 2 roots, wide rectangular crown
                rootsPath = `
                    M ${w*0.25} ${h*0.45} 
                    C ${w*0.2} ${h*0.2}, ${w*0.15} ${h*0.05}, ${w*0.3} ${h*0.05}
                    C ${w*0.4} ${h*0.05}, ${w*0.45} ${h*0.3}, ${w*0.45} ${h*0.45}
                    M ${w*0.55} ${h*0.45}
                    C ${w*0.55} ${h*0.3}, ${w*0.6} ${h*0.05}, ${w*0.7} ${h*0.05}
                    C ${w*0.85} ${h*0.05}, ${w*0.8} ${h*0.2}, ${w*0.75} ${h*0.45}
                `;
                crownPath = `
                    M ${w*0.15} ${h*0.42}
                    C ${w*0.05} ${h*0.6}, ${w*0.05} ${h*0.85}, ${w*0.2} ${h*0.9}
                    C ${w*0.35} ${h*0.96}, ${w*0.45} ${h*0.85}, ${w*0.5} ${h*0.88}
                    C ${w*0.55} ${h*0.85}, ${w*0.65} ${h*0.96}, ${w*0.8} ${h*0.9}
                    C ${w*0.95} ${h*0.85}, ${w*0.95} ${h*0.6}, ${w*0.85} ${h*0.42}
                    C ${w*0.65} ${h*0.38}, ${w*0.35} ${h*0.38}, ${w*0.15} ${h*0.42} Z
                `;
                details = `<path d="M ${w*0.3} ${h*0.8} Q ${w*0.4} ${h*0.6} ${w*0.5} ${h*0.65} Q ${w*0.6} ${h*0.6} ${w*0.7} ${h*0.8} M ${w*0.5} ${h*0.4} L ${w*0.5} ${h*0.65}" fill="none" stroke="rgba(15,37,50,0.12)" stroke-width="1.5" stroke-linecap="round"/>`;
            }
        } else if (shapeType === "premolar") {
            if (isUpper) {
                // Upper Premolar: 2 roots often fused, narrower crown
                rootsPath = `
                    M ${w*0.35} ${h*0.45} 
                    C ${w*0.35} ${h*0.2}, ${w*0.3} ${h*0.08}, ${w*0.45} ${h*0.05}
                    C ${w*0.5} ${h*0.15}, ${w*0.5} ${h*0.3}, ${w*0.5} ${h*0.45}
                    M ${w*0.5}  ${h*0.45}
                    C ${w*0.5} ${h*0.3}, ${w*0.5} ${h*0.15}, ${w*0.55} ${h*0.05}
                    C ${w*0.7} ${h*0.08}, ${w*0.65} ${h*0.2}, ${w*0.65} ${h*0.45}
                `;
                crownPath = `
                    M ${w*0.25} ${h*0.42}
                    C ${w*0.15} ${h*0.6}, ${w*0.18} ${h*0.8}, ${w*0.35} ${h*0.9}
                    C ${w*0.5} ${h*0.95}, ${w*0.65} ${h*0.95}, ${w*0.65} ${h*0.9}
                    C ${w*0.82} ${h*0.8}, ${w*0.85} ${h*0.6}, ${w*0.75} ${h*0.42}
                    C ${w*0.6}  ${h*0.38}, ${w*0.4} ${h*0.38}, ${w*0.25} ${h*0.42} Z
                `;
                details = `<path d="M ${w*0.4} ${h*0.6} Q ${w*0.5} ${h*0.75} ${w*0.6} ${h*0.6} M ${w*0.5} ${h*0.4} L ${w*0.5} ${h*0.68}" fill="none" stroke="rgba(15,37,50,0.1)" stroke-width="1.2" stroke-linecap="round"/>`;
            } else {
                // Lower Premolar: 1 root
                rootsPath = `
                    M ${w*0.35} ${h*0.45} 
                    C ${w*0.35} ${h*0.2}, ${w*0.4} ${h*0.05}, ${w*0.5} ${h*0.05}
                    C ${w*0.6} ${h*0.05}, ${w*0.65} ${h*0.2}, ${w*0.65} ${h*0.45}
                `;
                crownPath = `
                    M ${w*0.28} ${h*0.42}
                    C ${w*0.18} ${h*0.6}, ${w*0.2} ${h*0.8}, ${w*0.35} ${h*0.88}
                    C ${w*0.5} ${h*0.92}, ${w*0.65} ${h*0.92}, ${w*0.65} ${h*0.88}
                    C ${w*0.8} ${h*0.8}, ${w*0.82} ${h*0.6}, ${w*0.72} ${h*0.42}
                    C ${w*0.6} ${h*0.38}, ${w*0.4} ${h*0.38}, ${w*0.28} ${h*0.42} Z
                `;
                details = `<path d="M ${w*0.4} ${h*0.75} Q ${w*0.5} ${h*0.6} ${w*0.6} ${h*0.75} M ${w*0.5} ${h*0.4} L ${w*0.5} ${h*0.68}" fill="none" stroke="rgba(15,37,50,0.1)" stroke-width="1.2" stroke-linecap="round"/>`;
            }
        } else if (shapeType === "canine") {
            // Canine: 1 massive root, pointy crown
            rootsPath = `
                M ${w*0.3} ${h*0.45} 
                C ${w*0.3} ${h*0.2}, ${w*0.45} ${h*0.02}, ${w*0.5} ${h*0.02}
                C ${w*0.55} ${h*0.02}, ${w*0.7} ${h*0.2}, ${w*0.7} ${h*0.45}
            `;
            if (isUpper) {
                crownPath = `
                    M ${w*0.25} ${h*0.42}
                    C ${w*0.15} ${h*0.6}, ${w*0.2} ${h*0.75}, ${w*0.35} ${h*0.85}
                    C ${w*0.45} ${h*0.92}, ${w*0.5} ${h*0.98}, ${w*0.5} ${h*0.98}
                    C ${w*0.5} ${h*0.98}, ${w*0.55} ${h*0.92}, ${w*0.65} ${h*0.85}
                    C ${w*0.8} ${h*0.75}, ${w*0.85} ${h*0.6}, ${w*0.75} ${h*0.42}
                    C ${w*0.6} ${h*0.38}, ${w*0.4} ${h*0.38}, ${w*0.25} ${h*0.42} Z
                `;
            } else {
                 crownPath = `
                    M ${w*0.28} ${h*0.42}
                    C ${w*0.18} ${h*0.6}, ${w*0.22} ${h*0.75}, ${w*0.38} ${h*0.85}
                    C ${w*0.45} ${h*0.9}, ${w*0.5} ${h*0.95}, ${w*0.5} ${h*0.95}
                    C ${w*0.5} ${h*0.95}, ${w*0.55} ${h*0.9}, ${w*0.62} ${h*0.85}
                    C ${w*0.78} ${h*0.75}, ${w*0.82} ${h*0.6}, ${w*0.72} ${h*0.42}
                    C ${w*0.6} ${h*0.38}, ${w*0.4} ${h*0.38}, ${w*0.28} ${h*0.42} Z
                `;
            }
            details = `<path d="M ${w*0.5} ${h*0.4} L ${w*0.5} ${h*0.8}" fill="none" stroke="rgba(15,37,50,0.1)" stroke-width="1.2" stroke-linecap="round"/>`;
        } else {
            // Incisor: 1 root, flat blade crown
            rootsPath = `
                M ${w*0.35} ${h*0.45} 
                C ${w*0.35} ${h*0.2}, ${w*0.45} ${h*0.05}, ${w*0.5} ${h*0.05}
                C ${w*0.55} ${h*0.05}, ${w*0.65} ${h*0.2}, ${w*0.65} ${h*0.45}
            `;
            if (isUpper) {
                crownPath = `
                    M ${w*0.25} ${h*0.42}
                    C ${w*0.2} ${h*0.6}, ${w*0.2} ${h*0.8}, ${w*0.25} ${h*0.92}
                    C ${w*0.4} ${h*0.95}, ${w*0.6} ${h*0.95}, ${w*0.75} ${h*0.92}
                    C ${w*0.8} ${h*0.8}, ${w*0.8} ${h*0.6}, ${w*0.75} ${h*0.42}
                    C ${w*0.6} ${h*0.38}, ${w*0.4} ${h*0.38}, ${w*0.25} ${h*0.42} Z
                `;
            } else {
                crownPath = `
                    M ${w*0.28} ${h*0.42}
                    C ${w*0.25} ${h*0.6}, ${w*0.25} ${h*0.8}, ${w*0.3} ${h*0.9}
                    C ${w*0.4} ${h*0.92}, ${w*0.6} ${h*0.92}, ${w*0.7} ${h*0.9}
                    C ${w*0.75} ${h*0.8}, ${w*0.75} ${h*0.6}, ${w*0.72} ${h*0.42}
                    C ${w*0.6} ${h*0.38}, ${w*0.4} ${h*0.38}, ${w*0.28} ${h*0.42} Z
                `;
            }
            details = `<path d="M ${w*0.4} ${h*0.6} L ${w*0.4} ${h*0.8} M ${w*0.6} ${h*0.6} L ${w*0.6} ${h*0.8}" fill="none" stroke="rgba(15,37,50,0.08)" stroke-width="1" stroke-linecap="round"/>`;
        }

        // If lower tooth, flip it vertically
        const transformScale = isUpper ? "" : `transform="scale(1, -1) translate(0, -${h})"`;

        const surfaceColor = treatmentColor || "#EF4444";
        const overlays = !isMissing && surfaces ? renderSurfaceMarks(surfaces, isUpper, surfaceColor, w, h) : "";

        const missingMark = isMissing ? `
            <g opacity="0.85" stroke-linecap="round">
                <line x1="${w * 0.2}" y1="${h * 0.2}" x2="${w * 0.8}" y2="${h * 0.8}" stroke="${surfaceColor}" stroke-width="4" />
                <line x1="${w * 0.8}" y1="${h * 0.2}" x2="${w * 0.2}" y2="${h * 0.8}" stroke="${surfaceColor}" stroke-width="4" />
            </g>
        ` : "";

        // Shading maps
        const innerShadowId = `inner-shadow-${num}`;
        const rootFillId = `root-grad-${num}`;

        return `
      <svg viewBox="0 0 ${w} ${h}" class="w-full h-full" overflow="visible">
        <defs>
          <!-- 3D enamel gradient -->
          <radialGradient id="tooth-body-${num}" cx="35%" cy="35%" r="70%" fx="30%" fy="30%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1" />
            <stop offset="40%" stop-color="#FDFBFA" stop-opacity="1" />
            <stop offset="85%" stop-color="#EBE3D5" stop-opacity="1" />
            <stop offset="100%" stop-color="#D6CBB8" stop-opacity="1" />
          </radialGradient>
          
          <!-- Root gradient (more opaque, yellowish/bone color) -->
          <linearGradient id="${rootFillId}" x1="0%" y1="0%" x2="100%" y2="0%">
             <stop offset="0%" stop-color="#D4C9B3" />
             <stop offset="20%" stop-color="#E8DECD" />
             <stop offset="50%" stop-color="#F5F0E6" />
             <stop offset="80%" stop-color="#E8DECD" />
             <stop offset="100%" stop-color="#C7BAA0" />
          </linearGradient>

          <!-- Inner shadow for depth -->
          <filter id="${innerShadowId}">
            <feOffset dx="0" dy="2"/>
            <feGaussianBlur stdDeviation="3" result="offset-blur"/>
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
            <feFlood flood-color="black" flood-opacity="0.15" result="color"/>
            <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
            <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
          </filter>
        </defs>

        <g ${transformScale}>
            <!-- Roots -->
            <path d="${rootsPath}" 
                fill="${isMissing ? "transparent" : `url(#${rootFillId})`}" 
                stroke="${borderColor}" 
                stroke-width="${strokeWidth}"
                stroke-linejoin="round"
                stroke-linecap="round"
                opacity="${isMissing ? 0.3 : 1}" />

            <!-- Crown -->
            <path d="${crownPath}" 
                fill="${mainFill}" 
                stroke="${borderColor}" 
                stroke-width="${strokeWidth}"
                stroke-linejoin="round"
                filter="${isMissing ? '' : `url(#${innerShadowId})`}"
                opacity="${isMissing ? 0.3 : 1}" />
                
            <!-- 3D Highlights on Crown -->
            ${isMissing ? '' : `<path d="${crownPath}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.6" transform="translate(-1, -1) scale(0.98)" />`}

            <!-- Anatomical Details -->
            <g opacity="${isMissing ? 0.3 : 1}">
                ${details}
            </g>
        </g>

        <!-- Treatments & Marks (these shouldn't flip if the tooth flips, or they'll be upside down mentally, though we used isUpper historically to position them) -->
        ${overlays}
        ${missingMark}
      </svg>
    `;
    }

    function renderGeoCircle(num, diagnosticsState) {
        const state = (diagnosticsState && diagnosticsState[num]) || {};
        const faces = state.faces || {};
        const toothClass = state.tooth?.cssClass || "";
        const isAbsent = state.tooth?.id === "absent";
        const faceCls = (id) => faces[id]?.cssClass ? ` ${faces[id].cssClass}` : "";

        return `
      <div class="geo-mini ${toothClass || ""}">
        <svg viewBox="0 0 100 100" class="geo-svg">
          <circle cx="50" cy="50" r="48" class="geo-circle ${toothClass || ""}" />

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

    return {
        BRAND,
        ICONS,
        adultTeeth,
        childTeeth,
        FACE_LABELS,
        getToothType,
        arcOffset,
        renderSurfaceMarks,
        createToothSVG,
        renderGeoCircle,
        hexToRgba
    };
})();
