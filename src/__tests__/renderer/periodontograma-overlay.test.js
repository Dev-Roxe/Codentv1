const {
  getChartDisplayUpper,
  buildOverlayPoints,
  buildBleedingFillSvg,
} = require('../../renderer/scripts/periodontograma-overlay');

function createToothData() {
  return {
    11: {
      ausente: false,
      sangrado_v: { m: false, c: false, d: false },
      margen_v: { m: 0, c: 0, d: 0 },
      profundidad_v: { m: 0, c: 0, d: 0 },
    },
    12: {
      ausente: false,
      sangrado_v: { m: false, c: false, d: false },
      margen_v: { m: 0, c: 0, d: 0 },
      profundidad_v: { m: 0, c: 0, d: 0 },
    },
  };
}

describe('periodontograma overlay helpers', () => {
  test('fills a bleeding site even when probing depth is below 4 mm', () => {
    const perioData = createToothData();
    perioData[11].sangrado_v.c = true;
    perioData[11].profundidad_v.c = 3;

    const { profPts, margenPts, siteWidth } = buildOverlayPoints({
      teeth: [11],
      perioData,
      fieldProf: 'profundidad_v',
      fieldMargen: 'margen_v',
      displayUpper: false,
    });

    const svg = buildBleedingFillSvg({
      profPts,
      margenPts,
      perioData,
      sangraField: 'sangrado_v',
      siteWidth,
    });

    expect(svg).toContain('<path');
  });

  test('does not fill when the site does not bleed', () => {
    const perioData = createToothData();
    perioData[11].profundidad_v.c = 6;

    const { profPts, margenPts, siteWidth } = buildOverlayPoints({
      teeth: [11],
      perioData,
      fieldProf: 'profundidad_v',
      fieldMargen: 'margen_v',
      displayUpper: false,
    });

    const svg = buildBleedingFillSvg({
      profPts,
      margenPts,
      perioData,
      sangraField: 'sangrado_v',
      siteWidth,
    });

    expect(svg).toBe('');
  });

  test('joins consecutive bleeding sites into a continuous red area', () => {
    const perioData = createToothData();
    perioData[11].sangrado_v = { m: true, c: true, d: true };
    perioData[11].profundidad_v = { m: 5, c: 5, d: 4 };
    perioData[12].sangrado_v = { m: true, c: false, d: false };
    perioData[12].profundidad_v = { m: 4, c: 0, d: 0 };

    const { profPts, margenPts, siteWidth } = buildOverlayPoints({
      teeth: [11, 12],
      perioData,
      fieldProf: 'profundidad_v',
      fieldMargen: 'margen_v',
      displayUpper: false,
    });

    const svg = buildBleedingFillSvg({
      profPts,
      margenPts,
      perioData,
      sangraField: 'sangrado_v',
      siteWidth,
    });

    expect((svg.match(/<path /g) || []).length).toBe(1);
  });

  test('keeps chart orientation consistent for upper and lower rows', () => {
    expect(getChartDisplayUpper(true, false)).toBe(false);
    expect(getChartDisplayUpper(true, true)).toBe(true);
    expect(getChartDisplayUpper(false, true)).toBe(false);
    expect(getChartDisplayUpper(false, false)).toBe(true);
  });
});
