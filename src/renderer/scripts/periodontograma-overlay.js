(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.PerioOverlay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = Object.freeze({
    chartWidth: 1000,
    toothHeight: 108,
    maxDepth: 12,
    positions: ['m', 'c', 'd'],
    fillColor: 'rgba(239, 68, 68, 0.34)',
    minVisibleGap: 0.75,
  });

  function toNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getChartDisplayUpper(isUpper, flipSVG) {
    return flipSVG ? isUpper : !isUpper;
  }

  function buildOverlayPoints(options) {
    const {
      teeth,
      perioData,
      fieldProf,
      fieldMargen,
      displayUpper,
      chartWidth = DEFAULTS.chartWidth,
      toothHeight = DEFAULTS.toothHeight,
      maxDepth = DEFAULTS.maxDepth,
      positions = DEFAULTS.positions,
    } = options || {};

    const totalPoints = (Array.isArray(teeth) ? teeth.length : 0) * positions.length;
    const profPts = [];
    const margenPts = [];

    if (!Array.isArray(teeth) || !perioData || !fieldProf || !fieldMargen || totalPoints <= 0) {
      return {
        profPts,
        margenPts,
        totalPoints,
        siteWidth: 0,
      };
    }

    teeth.forEach((tooth, toothIndex) => {
      const toothData = perioData[tooth];
      if (!toothData || toothData.ausente) return;

      positions.forEach((pos, posIndex) => {
        const x = ((toothIndex * positions.length + posIndex + 0.5) / totalPoints) * chartWidth;
        const pv = toNumber(toothData?.[fieldProf]?.[pos]);
        const mv = toNumber(toothData?.[fieldMargen]?.[pos]);

        let marginY;
        let probingY;
        if (displayUpper) {
          marginY = toothHeight * 0.38 + (mv / maxDepth) * toothHeight * 0.25;
          probingY = marginY + (pv / maxDepth) * toothHeight * 0.50;
        } else {
          marginY = toothHeight * 0.62 - (mv / maxDepth) * toothHeight * 0.25;
          probingY = marginY - (pv / maxDepth) * toothHeight * 0.50;
        }

        profPts.push({ x, y: probingY, v: pv, t: tooth, pos });
        margenPts.push({ x, y: marginY, v: mv, t: tooth, pos });
      });
    });

    return {
      profPts,
      margenPts,
      totalPoints,
      siteWidth: chartWidth / totalPoints,
    };
  }

  function makePath(points) {
    if (!Array.isArray(points) || !points.length) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

    let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let index = 1; index < points.length; index++) {
      path += ` L ${points[index].x.toFixed(1)},${points[index].y.toFixed(1)}`;
    }
    return path;
  }

  function hasRenderableBleedingGap(profPt, margenPt, isBleeding, minVisibleGap) {
    if (!isBleeding || !profPt || !margenPt) return false;
    return Math.abs(profPt.y - margenPt.y) >= (minVisibleGap ?? DEFAULTS.minVisibleGap);
  }

  function buildBleedingFillSvg(options) {
    const {
      profPts,
      margenPts,
      perioData,
      sangraField,
      siteWidth,
      fillColor = DEFAULTS.fillColor,
      minVisibleGap = DEFAULTS.minVisibleGap,
    } = options || {};

    if (!Array.isArray(profPts) || !Array.isArray(margenPts) || !profPts.length || !margenPts.length) {
      return '';
    }

    const active = profPts.map((pt, index) => {
      const toothData = perioData?.[pt.t];
      const isBleeding = !!toothData?.[sangraField]?.[pt.pos];
      return hasRenderableBleedingGap(pt, margenPts[index], isBleeding, minVisibleGap);
    });

    const joinDistance = siteWidth * 1.6;
    let svg = '';
    let index = 0;

    while (index < profPts.length) {
      if (!active[index]) {
        index++;
        continue;
      }

      let end = index;
      while (
        end + 1 < profPts.length &&
        active[end + 1] &&
        Math.abs(profPts[end + 1].x - profPts[end].x) <= joinDistance
      ) {
        end++;
      }

      if (end > index) {
        let path = `M ${margenPts[index].x.toFixed(1)},${margenPts[index].y.toFixed(1)}`;
        for (let pointIndex = index + 1; pointIndex <= end; pointIndex++) {
          path += ` L ${margenPts[pointIndex].x.toFixed(1)},${margenPts[pointIndex].y.toFixed(1)}`;
        }
        for (let pointIndex = end; pointIndex >= index; pointIndex--) {
          path += ` L ${profPts[pointIndex].x.toFixed(1)},${profPts[pointIndex].y.toFixed(1)}`;
        }
        path += ' Z';
        svg += `<path d="${path}" fill="${fillColor}" stroke="none"/>`;
      } else {
        const profPt = profPts[index];
        const margenPt = margenPts[index];
        const halfWidth = siteWidth * 0.24;
        const path = `M ${(margenPt.x - halfWidth).toFixed(1)},${margenPt.y.toFixed(1)}
                    L ${(margenPt.x + halfWidth).toFixed(1)},${margenPt.y.toFixed(1)}
                    L ${(profPt.x + halfWidth).toFixed(1)},${profPt.y.toFixed(1)}
                    L ${(profPt.x - halfWidth).toFixed(1)},${profPt.y.toFixed(1)} Z`;
        svg += `<path d="${path}" fill="${fillColor}" stroke="none"/>`;
      }

      index = end + 1;
    }

    return svg;
  }

  return {
    DEFAULTS,
    getChartDisplayUpper,
    buildOverlayPoints,
    makePath,
    hasRenderableBleedingGap,
    buildBleedingFillSvg,
  };
});
