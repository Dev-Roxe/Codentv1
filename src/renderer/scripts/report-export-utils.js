(function initReportExportUtils(globalScope) {
  function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function normalizarTexto(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s\-.,()/#:&@%$+|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizarMonto(valor) {
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return roundMoney(valor);
    }
    if (valor === null || valor === undefined || valor === '') return 0;

    let limpio = String(valor).replace(/[^0-9,.\-]/g, '');
    if (limpio.includes(',') && limpio.includes('.')) {
      const lastComma = limpio.lastIndexOf(',');
      const lastDot = limpio.lastIndexOf('.');
      if (lastComma > lastDot) {
        limpio = limpio.replace(/\./g, '').replace(/,/g, '.');
      } else {
        limpio = limpio.replace(/,(?=\d{3}\b)/g, '');
      }
    } else if (limpio.includes(',') && !limpio.includes('.')) {
      limpio = limpio.replace(/,/g, '.');
    } else {
      limpio = limpio.replace(/,(?=\d{3}\b)/g, '');
    }
    const parsed = Number.parseFloat(limpio);
    return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
  }

  function formatFileDate(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return 'reporte';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateOnly(value) {
    if (!value) return '';
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return formatFileDate(date);
    }

    const raw = String(value).trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : normalizarTexto(raw);
  }

  function formatDateTime(value, locale) {
    if (!value) return '';
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) return normalizarTexto(value);
    return normalizarTexto(
      date.toLocaleString(locale || 'es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  }

  function formatAmount(value) {
    return `$${normalizarMonto(value).toFixed(2)}`;
  }

  function resolveJsPDF() {
    const jsPDF = globalScope.jspdf && globalScope.jspdf.jsPDF;
    if (!jsPDF) {
      throw new Error('La libreria jsPDF no esta disponible.');
    }
    return jsPDF;
  }

  function resolveXLSX() {
    const XLSX = globalScope.XLSX;
    if (!XLSX) {
      throw new Error('La libreria SheetJS no esta disponible.');
    }
    return XLSX;
  }

  function detectColumnType(key, rows) {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const value = row && typeof row === 'object' ? row[key] : null;
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'number') return 'number';
      return 'text';
    }
    return 'text';
  }

  function estimateColumnWidth(key, rows, override) {
    const header = override.header || key;
    let maxLength = String(header || '').length;

    rows.slice(0, 50).forEach((row) => {
      const rawValue = typeof override.value === 'function' ? override.value(row) : row[key];
      const safeValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
      maxLength = Math.max(maxLength, safeValue.length);
    });

    return Math.max(10, Math.min(45, maxLength + 2));
  }

  function buildColumnsFromRows(rows, overrides) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeOverrides = overrides && typeof overrides === 'object' ? overrides : {};
    const keys = [];

    safeRows.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      Object.keys(row).forEach((key) => {
        if (!keys.includes(key)) keys.push(key);
      });
    });

    if (!keys.length) keys.push('Sin datos');

    return keys.map((key) => {
      const override = safeOverrides[key] || {};
      const type = override.type || detectColumnType(key, safeRows);
      return {
        key,
        header: override.header || key,
        type,
        width: Number(override.width || estimateColumnWidth(key, safeRows, override)),
        align: override.align || (type === 'number' ? 'right' : 'left'),
        value: override.value,
      };
    });
  }

  function normalizeSheetCellValue(value, type) {
    if (type === 'number' || type === 'currency') {
      return normalizarMonto(value);
    }
    if (value instanceof Date) {
      return formatDateOnly(value);
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    return normalizarTexto(value);
  }

  function createWorksheet(XLSX, options) {
    const rows = Array.isArray(options.rows) ? options.rows : [];
    const columns = Array.isArray(options.columns) && options.columns.length
      ? options.columns
      : buildColumnsFromRows(rows, options.columnsByKey);
    const metadataRows = Array.isArray(options.metadataRows) ? options.metadataRows : [];
    const title = normalizarTexto(options.title || '');
    const aoa = [];

    if (title) aoa.push([title]);

    metadataRows.forEach((entry) => {
      if (Array.isArray(entry)) {
        aoa.push(entry.map((cell) => (typeof cell === 'number' ? cell : normalizarTexto(cell))));
        return;
      }
      if (entry && typeof entry === 'object') {
        const label = normalizarTexto(entry.label || entry.Indicador || '');
        const rawValue = entry.value !== undefined ? entry.value : entry.Valor;
        const value = typeof rawValue === 'number' ? rawValue : normalizarTexto(rawValue);
        aoa.push([label, value]);
      }
    });

    if (title || metadataRows.length) aoa.push([]);

    const headerRowIndex = aoa.length;
    aoa.push(columns.map((column) => normalizarTexto(column.header || column.key)));

    if (!rows.length) {
      aoa.push(columns.map((column, index) => (index === 0 ? 'Sin datos' : '')));
    } else {
      rows.forEach((row) => {
        aoa.push(columns.map((column) => {
          const rawValue = typeof column.value === 'function' ? column.value(row) : row[column.key];
          return normalizeSheetCellValue(rawValue, column.type);
        }));
      });
    }

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet['!cols'] = columns.map((column) => ({
      wch: Math.max(8, Math.min(45, Number(column.width || 14))),
    }));

    if (rows.length) {
      worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: headerRowIndex, c: 0 },
          e: { r: headerRowIndex + rows.length, c: Math.max(columns.length - 1, 0) },
        }),
      };
    }

    return worksheet;
  }

  function exportWorkbook(options) {
    const XLSX = resolveXLSX();
    const workbook = XLSX.utils.book_new();
    const sheets = Array.isArray(options && options.sheets) ? options.sheets : [];

    if (!sheets.length) {
      throw new Error('No hay hojas configuradas para exportar.');
    }

    sheets.forEach((sheet, index) => {
      const safeSheet = sheet || {};
      const sheetName = normalizarTexto(safeSheet.name || `Reporte ${index + 1}`).slice(0, 31) || `Reporte${index + 1}`;
      const worksheet = createWorksheet(XLSX, safeSheet);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    XLSX.writeFile(workbook, options.filename || `Reporte_${formatFileDate()}.xlsx`);
    return true;
  }

  function buildPdfColumnStyles(columns) {
    return columns.reduce((styles, column, index) => {
      const currentStyle = {};
      if (column.width) currentStyle.cellWidth = column.width;
      if (column.align) currentStyle.halign = column.align;
      if (Object.keys(currentStyle).length) styles[index] = currentStyle;
      return styles;
    }, {});
  }

  function normalizePdfCell(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return normalizarTexto(value);
  }

  function exportPdfTable(options) {
    const jsPDF = resolveJsPDF();
    const columns = Array.isArray(options && options.columns) ? options.columns : [];
    const rows = Array.isArray(options && options.rows) ? options.rows : [];
    if (!columns.length) {
      throw new Error('No hay columnas configuradas para el PDF.');
    }

    const doc = new jsPDF({
      orientation: options.orientation || 'landscape',
      unit: 'mm',
      format: options.format || 'a4',
    });

    if (typeof doc.autoTable !== 'function') {
      throw new Error('El plugin autoTable no esta disponible.');
    }

    const margin = {
      top: 14,
      right: 12,
      bottom: 14,
      left: 12,
      ...(options.margin || {}),
    };
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const printableWidth = pageWidth - margin.left - margin.right;
    let cursorY = margin.top;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(normalizarTexto(options.title || 'Reporte'), margin.left, cursorY);
    cursorY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const metadataLines = []
      .concat(options.subtitleLines || [])
      .concat(options.metadataLines || []);

    metadataLines.forEach((line) => {
      const wrapped = doc.splitTextToSize(normalizarTexto(line), printableWidth);
      doc.text(wrapped, margin.left, cursorY);
      cursorY += wrapped.length * 4.2;
    });

    const body = rows.map((row) => columns.map((column) => {
      const rawValue = typeof column.value === 'function' ? column.value(row) : row[column.key];
      return normalizePdfCell(rawValue);
    }));

    const totalsRowIndex = Number.isInteger(options.totalsRowIndex) ? options.totalsRowIndex : null;
    const externalDidParseCell = typeof options.didParseCell === 'function' ? options.didParseCell : null;

    doc.autoTable({
      startY: cursorY + 2,
      head: [columns.map((column) => normalizarTexto(column.header || column.key))],
      body,
      theme: options.theme || 'grid',
      margin,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'middle',
        ...(options.styles || {}),
      },
      headStyles: {
        fillColor: [29, 93, 105],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        ...(options.headStyles || {}),
      },
      columnStyles: {
        ...buildPdfColumnStyles(columns),
        ...(options.columnStyles || {}),
      },
      didParseCell(data) {
        if (totalsRowIndex !== null && data.row.section === 'body' && data.row.index === totalsRowIndex) {
          data.cell.styles.fillColor = [241, 196, 15];
          data.cell.styles.fontStyle = 'bold';
        }
        if (externalDidParseCell) externalDidParseCell(data);
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    const footerLeftText = normalizarTexto(options.footerLeftText || 'Sistema: Sonalia');
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(footerLeftText, margin.left, pageHeight - 6);
      doc.text(`Pagina ${page} de ${pageCount}`, pageWidth - margin.right, pageHeight - 6, { align: 'right' });
    }

    doc.save(options.filename || `Reporte_${formatFileDate()}.pdf`);
    return true;
  }

  const api = {
    buildColumnsFromRows,
    exportPdfTable,
    exportWorkbook,
    formatAmount,
    formatDateOnly,
    formatDateTime,
    formatFileDate,
    normalizarMonto,
    normalizarTexto,
    roundMoney,
  };

  globalScope.SonaliaReportExport = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}(typeof window !== 'undefined' ? window : globalThis));
