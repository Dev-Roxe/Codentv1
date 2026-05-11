// contabilidad.js
'use strict';

const api = window.api?.accounting;
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };

let state = {
  tab: 'dashboard',
  categorias: [],
  empleados: [],
  catalogo: [], // Nuevo: medicinas + miscelanea
  gastoEditId: null,
  empleadoEditId: null,
  nominaEditId: null,
  compraEditId: null,
};

// ── Tab navigation ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('bg-[#4EABBE]', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('bg-gray-100', !active);
    b.classList.toggle('dark:bg-slate-800', !active);
    b.classList.toggle('text-[#0F2532]', !active);
    b.classList.toggle('dark:text-slate-300', !active);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(`content-${tab}`)?.classList.remove('hidden');
  loadTab(tab);
}

function loadTab(tab) {
  if (tab === 'dashboard') loadDashboard();
  else if (tab === 'gastos') loadGastos();
  else if (tab === 'nomina') loadNomina();
  else if (tab === 'compras') loadCompras();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api.getDashboard({ fechaInicio: firstDayOfMonth(), fechaFin: today() });
    const r = data.resumen;
    document.getElementById('dash-gastos').textContent = fmt(r.totalGastos);
    document.getElementById('dash-nomina').textContent = fmt(r.totalNomina);
    document.getElementById('dash-compras').textContent = fmt(r.totalCompras);
    document.getElementById('dash-total').textContent = fmt(r.totalEgresos);
    document.getElementById('dash-pendientes').textContent = fmt(r.gastosPendientes);
    document.getElementById('dash-pendientes-count').textContent = r.gastosPendientesCount;

    // Categorías chart
    const chartEl = document.getElementById('chart-categorias');
    if (chartEl && data.gastosPorCategoria?.length) {
      const max = Math.max(...data.gastosPorCategoria.map(c => c.total), 1);
      chartEl.innerHTML = data.gastosPorCategoria.filter(c => c.total > 0).slice(0, 6).map(c => `
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${c.color}"></div>
          <div class="flex-1 min-w-0"><p class="text-xs truncate text-gray-700 dark:text-gray-300">${c.nombre}</p>
            <div class="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 mt-1">
              <div class="h-1.5 rounded-full" style="width:${Math.round((c.total/max)*100)}%;background:${c.color}"></div>
            </div>
          </div>
          <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0">${fmt(c.total)}</span>
        </div>`).join('');
    } else if (chartEl) {
      chartEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Sin datos este mes</p>';
    }
  } catch (e) {
    console.error('Dashboard error', e);
  }
}

// ── Gastos ────────────────────────────────────────────────────────────────────
async function loadGastos() {
  const fi = document.getElementById('g-fecha-inicio')?.value || firstDayOfMonth();
  const ff = document.getElementById('g-fecha-fin')?.value || today();
  const cat = document.getElementById('g-cat-filter')?.value || '';
  const est = document.getElementById('g-estado-filter')?.value || '';
  try {
    const rows = await api.listGastos({ fechaInicio: fi, fechaFin: ff, categoriaId: cat || undefined, estado: est || undefined });
    const tbody = document.getElementById('gastos-tbody');
    if (!tbody) return;
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">Sin gastos en el período</td></tr>'; return; }
    tbody.innerHTML = rows.map(g => `
      <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
        <td class="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">${esc(g.concepto)}</td>
        <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" style="background:${g.categoria_color||'#6B7280'}22;color:${g.categoria_color||'#6B7280'}">${esc(g.categoria_nombre||'Sin categoría')}</span></td>
        <td class="px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400">${fmt(g.monto)}</td>
        <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">${g.fecha_gasto}</td>
        <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(g.estado)}">${g.estado}</span></td>
        <td class="px-4 py-3 text-right">
          <button onclick="editGasto(${g.id})" class="text-[#4EABBE] hover:text-[#1D5D69] text-xs font-medium mr-2">Editar</button>
          <button onclick="delGasto(${g.id})" class="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
        </td>
      </tr>`).join('');
    const total = rows.reduce((s, g) => s + Number(g.monto), 0);
    const totEl = document.getElementById('gastos-total');
    if (totEl) totEl.textContent = fmt(total);
  } catch(e) { console.error(e); }
}

async function editGasto(id) {
  try {
    const rows = await api.listGastos({});
    const g = rows.find(r => r.id === id);
    if (!g) return;
    state.gastoEditId = id;
    fillGastoForm(g);
    openModal('modal-gasto');
  } catch(e) {}
}

async function delGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  try { await api.deleteGasto(id); loadGastos(); showToast('Gasto eliminado', 'success'); } catch(e) { showToast(e.message, 'error'); }
}

window.editGasto = editGasto;
window.delGasto = delGasto;

function fillGastoForm(g) {
  const f = document.getElementById('form-gasto');
  if (!f) return;
  f.querySelector('[name=concepto]').value = g.concepto || '';
  f.querySelector('[name=monto]').value = g.monto || '';
  f.querySelector('[name=fecha_gasto]').value = g.fecha_gasto || today();
  f.querySelector('[name=categoria_id]').value = g.categoria_id || '';
  f.querySelector('[name=estado]').value = g.estado || 'pagado';
  f.querySelector('[name=metodo_pago]').value = g.metodo_pago || 'efectivo';
  f.querySelector('[name=proveedor]').value = g.proveedor || '';
  f.querySelector('[name=referencia]').value = g.referencia || '';
  f.querySelector('[name=descripcion]').value = g.descripcion || '';
}

// ── Nómina ────────────────────────────────────────────────────────────────────
async function loadNomina() {
  try {
    const [empleados, pagos] = await Promise.all([
      api.listEmpleados(false),
      api.listNominaPagos({ fechaInicio: firstDayOfMonth(), fechaFin: today() }),
    ]);
    state.empleados = empleados;

    const empEl = document.getElementById('empleados-tbody');
    if (empEl) {
      empEl.innerHTML = empleados.map(e => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
          <td class="px-4 py-3 font-medium text-sm text-gray-800 dark:text-gray-200">${esc(e.nombre)} ${esc(e.apellido)}</td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">${esc(e.puesto||'—')}</td>
          <td class="px-4 py-3 text-sm">${esc(e.tipo||'')}</td>
          <td class="px-4 py-3 text-sm font-semibold">${fmt(e.salario_base)}</td>
          <td class="px-4 py-3 text-sm">${esc(e.frecuencia_pago||'')}</td>
          <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs ${e.activo?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}">${e.activo?'Activo':'Inactivo'}</span></td>
          <td class="px-4 py-3 text-right">
            <button onclick="editEmpleado(${e.id})" class="text-[#4EABBE] hover:text-[#1D5D69] text-xs font-medium mr-2">Editar</button>
            <button onclick="delEmpleado(${e.id})" class="text-red-500 hover:text-red-700 text-xs">Dar de baja</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="7" class="text-center py-6 text-gray-400">Sin empleados registrados</td></tr>';
    }

    // populate empleado select in pago form
    const sel = document.getElementById('pago-empleado-select');
    if (sel) {
      sel.innerHTML = '<option value="">Seleccionar empleado...</option>' +
        empleados.filter(e=>e.activo).map(e => `<option value="${e.id}">${esc(e.nombre)} ${esc(e.apellido)}</option>`).join('');
    }

    const pagosEl = document.getElementById('pagos-tbody');
    if (pagosEl) {
      pagosEl.innerHTML = pagos.map(p => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
          <td class="px-4 py-3 font-medium text-sm text-gray-800 dark:text-gray-200">${esc(p.empleado_nombre)}</td>
          <td class="px-4 py-3 text-sm text-gray-500">${p.periodo_inicio} → ${p.periodo_fin}</td>
          <td class="px-4 py-3 text-sm">${fmt(p.monto_bruto)}</td>
          <td class="px-4 py-3 text-sm text-red-500">${fmt(p.deducciones)}</td>
          <td class="px-4 py-3 text-sm font-semibold text-green-600">${fmt(p.monto_neto)}</td>
          <td class="px-4 py-3 text-sm">${p.metodo_pago||''}</td>
          <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs ${estadoBadge(p.estado)}">${p.estado}</span></td>
          <td class="px-4 py-3 text-right">
            <button onclick="delPago(${p.id})" class="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="8" class="text-center py-6 text-gray-400">Sin pagos este período</td></tr>';
    }
  } catch(e) { console.error(e); }
}

async function editEmpleado(id) {
  const e = state.empleados.find(x => x.id === id);
  if (!e) return;
  state.empleadoEditId = id;
  const f = document.getElementById('form-empleado');
  if (!f) return;
  f.querySelector('[name=nombre]').value = e.nombre || '';
  f.querySelector('[name=apellido]').value = e.apellido || '';
  f.querySelector('[name=puesto]').value = e.puesto || '';
  f.querySelector('[name=tipo]').value = e.tipo || 'empleado';
  f.querySelector('[name=salario_base]').value = e.salario_base || '';
  f.querySelector('[name=frecuencia_pago]').value = e.frecuencia_pago || 'mensual';
  f.querySelector('[name=telefono]').value = e.telefono || '';
  f.querySelector('[name=email]').value = e.email || '';
  f.querySelector('[name=rfc]').value = e.rfc || '';
  openModal('modal-empleado');
}

async function delEmpleado(id) {
  if (!confirm('¿Dar de baja a este empleado?')) return;
  try { await api.deleteEmpleado(id); loadNomina(); showToast('Empleado dado de baja', 'info'); } catch(e) { showToast(e.message,'error'); }
}

async function delPago(id) {
  if (!confirm('¿Eliminar este pago de nómina?')) return;
  try { await api.deleteNominaPago(id); loadNomina(); showToast('Pago eliminado','success'); } catch(e) { showToast(e.message,'error'); }
}

window.editEmpleado = editEmpleado;
window.delEmpleado = delEmpleado;
window.delPago = delPago;

// ── Compras ───────────────────────────────────────────────────────────────────
async function loadCompras() {
  const fi = document.getElementById('c-fecha-inicio')?.value || firstDayOfMonth();
  const ff = document.getElementById('c-fecha-fin')?.value || today();
  try {
    const rows = await api.listCompras({ fechaInicio: fi, fechaFin: ff });
    const tbody = document.getElementById('compras-tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(c => `
      <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
        <td class="px-4 py-3 font-medium text-sm text-gray-800 dark:text-gray-200">${esc(c.producto_nombre)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${esc(c.proveedor||'—')}</td>
        <td class="px-4 py-3 text-sm">${c.cantidad} ${esc(c.unidad||'')}</td>
        <td class="px-4 py-3 text-sm">${fmt(c.costo_unitario)}</td>
        <td class="px-4 py-3 text-sm font-semibold text-red-600">${fmt(c.costo_total)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${c.fecha_compra}</td>
        <td class="px-4 py-3 text-right">
          <button onclick="delCompra(${c.id})" class="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="7" class="text-center py-6 text-gray-400">Sin compras en el período</td></tr>';
    const total = rows.reduce((s,c) => s + Number(c.costo_total), 0);
    const totEl = document.getElementById('compras-total');
    if (totEl) totEl.textContent = fmt(total);
  } catch(e) { console.error(e); }
}

async function delCompra(id) {
  if (!confirm('¿Eliminar esta compra?')) return;
  try { await api.deleteCompra(id); loadCompras(); showToast('Compra eliminada','success'); } catch(e) { showToast(e.message,'error'); }
}
window.delCompra = delCompra;

// ── Forms ─────────────────────────────────────────────────────────────────────
async function loadCategorias() {
  try {
    state.categorias = await api.listCategorias();
    const sel = document.getElementById('g-cat-filter');
    const sel2 = document.querySelector('[name=categoria_id]');
    const opts = '<option value="">Todas las categorías</option>' +
      state.categorias.map(c => `<option value="${c.id}" style="color:${c.color}">${esc(c.nombre)}</option>`).join('');
    if (sel) sel.innerHTML = opts;
    if (sel2) sel2.innerHTML = '<option value="">Sin categoría</option>' +
      state.categorias.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  } catch(e) {}
}

document.getElementById('form-gasto')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.id = state.gastoEditId || undefined;
  payload.deducir_caja = !!payload.deducir_caja;
  try {
    await api.saveGasto(payload);
    closeModal('modal-gasto');
    state.gastoEditId = null;
    e.target.reset();
    loadGastos();
    showToast('Gasto guardado correctamente', 'success');
  } catch(err) { showToast(err.message, 'error'); }
});

document.getElementById('form-empleado')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.id = state.empleadoEditId || undefined;
  try {
    await api.saveEmpleado(payload);
    closeModal('modal-empleado');
    state.empleadoEditId = null;
    e.target.reset();
    loadNomina();
    showToast('Empleado guardado', 'success');
  } catch(err) { showToast(err.message, 'error'); }
});

document.getElementById('form-pago')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.id = state.nominaEditId || undefined;
  payload.deducir_caja = !!payload.deducir_caja;
  try {
    await api.saveNominaPago(payload);
    closeModal('modal-pago');
    state.nominaEditId = null;
    e.target.reset();
    loadNomina();
    showToast('Pago de nómina registrado', 'success');
  } catch(err) { showToast(err.message, 'error'); }
});

document.getElementById('form-compra')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.id = state.compraEditId || undefined;
  payload.deducir_caja = !!payload.deducir_caja;
  // auto-calc total
  if (!payload.costo_total) {
    payload.costo_total = (Number(payload.cantidad)||1) * (Number(payload.costo_unitario)||0);
  }
  try {
    await api.saveCompra(payload);
    closeModal('modal-compra');
    state.compraEditId = null;
    e.target.reset();
    loadCompras();
    showToast('Compra registrada', 'success');
  } catch(err) { showToast(err.message, 'error'); }
});

// auto-calc compra total
document.getElementById('form-compra')?.addEventListener('input', (e) => {
  const f = e.currentTarget;
  const qty = Number(f.querySelector('[name=cantidad]')?.value) || 0;
  const unit = Number(f.querySelector('[name=costo_unitario]')?.value) || 0;
  const totEl = f.querySelector('[name=costo_total]');
  if (totEl) totEl.value = (qty * unit).toFixed(2);
});

// Vincular inventario select
document.getElementById('c-catalogo-select')?.addEventListener('change', (e) => {
  const val = e.target.value; // "tipo:id"
  const form = document.getElementById('form-compra');
  if (!val) {
    form.querySelector('[name=actualizar_inventario]').value = "0";
    form.querySelector('[name=catalogo_id]').value = "";
    form.querySelector('[name=catalogo_tipo]').value = "";
    return;
  }
  const [tipo, id] = val.split(':');
  const item = state.catalogo.find(x => x.tipo === tipo && String(x.id) === id);
  if (item) {
    form.querySelector('#c-producto-nombre').value = item.nombre;
    form.querySelector('[name=costo_unitario]').value = item.precio || 0;
    form.querySelector('[name=actualizar_inventario]').value = "1";
    form.querySelector('[name=catalogo_id]').value = id;
    form.querySelector('[name=catalogo_tipo]').value = tipo;
    // trigger calc
    form.querySelector('[name=costo_total]').value = (Number(form.querySelector('[name=cantidad]').value) * (item.precio || 0)).toFixed(2);
  }
});

// Filter buttons
document.getElementById('btn-filtrar-gastos')?.addEventListener('click', loadGastos);
document.getElementById('btn-filtrar-compras')?.addEventListener('click', loadCompras);

// Modal triggers
document.getElementById('btn-nuevo-gasto')?.addEventListener('click', () => {
  state.gastoEditId = null;
  document.getElementById('form-gasto')?.reset();
  document.querySelector('#form-gasto [name=fecha_gasto]').value = today();
  openModal('modal-gasto');
});
document.getElementById('btn-nuevo-empleado')?.addEventListener('click', () => {
  state.empleadoEditId = null;
  document.getElementById('form-empleado')?.reset();
  openModal('modal-empleado');
});
document.getElementById('btn-nuevo-pago')?.addEventListener('click', () => {
  state.nominaEditId = null;
  document.getElementById('form-pago')?.reset();
  document.querySelector('#form-pago [name=fecha_pago]').value = today();
  openModal('modal-pago');
});
document.getElementById('btn-nueva-compra')?.addEventListener('click', () => {
  state.compraEditId = null;
  document.getElementById('form-compra')?.reset();
  document.querySelector('#form-compra [name=fecha_compra]').value = today();
  loadCatalog(); // Cargar productos existentes
  openModal('modal-compra');
});

// Modal close
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
function esc(s) { const d = document.createElement('div'); d.textContent = String(s||''); return d.innerHTML; }
function estadoBadge(s) {
  const m = { pagado:'bg-green-100 text-green-700', pendiente:'bg-yellow-100 text-yellow-700', vencido:'bg-red-100 text-red-700', cancelado:'bg-gray-100 text-gray-500' };
  return m[s] || 'bg-gray-100 text-gray-600';
}

async function loadCatalog() {
  try {
    const [meds, sups] = await Promise.all([
      window.api.catalog.listMedicines(),
      window.api.catalog.listSupplies()
    ]);
    state.catalogo = [
      ...meds.map(m => ({ ...m, tipo: 'medicamento' })),
      ...sups.map(s => ({ ...s, tipo: 'miscelaneo' }))
    ];
    const sel = document.getElementById('c-catalogo-select');
    if (sel) {
      sel.innerHTML = '<option value="">-- No vincular --</option>' +
        '<optgroup label="Medicamentos">' +
        meds.map(m => `<option value="medicamento:${m.id}">${esc(m.nombre)} (Stock: ${m.stock})</option>`).join('') +
        '</optgroup>' +
        '<optgroup label="Materiales">' +
        sups.map(s => `<option value="miscelaneo:${s.id}">${esc(s.nombre)} (Stock: ${s.stock})</option>`).join('') +
        '</optgroup>';
    }
  } catch (e) { console.error('Error loading catalog', e); }
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadCategorias();
  // set default date filters
  ['g-fecha-inicio','c-fecha-inicio'].forEach(id => { const el = document.getElementById(id); if (el) el.value = firstDayOfMonth(); });
  ['g-fecha-fin','c-fecha-fin'].forEach(id => { const el = document.getElementById(id); if (el) el.value = today(); });
  switchTab('dashboard');
})();
