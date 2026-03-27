const MONTH_LABELS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const DAY_LABELS = ['do.', 'lu.', 'ma.', 'mi.', 'ju.', 'vi.', 'sa.'];
const DATE_PICKER_STATE = new WeakMap();

function safeParseJSON(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function getDatePreferences() {
  const settings = safeParseJSON(localStorage.getItem('app_settings'), {});
  const dateFormat = settings?.dateFormat || document.documentElement.dataset.dateFormat || 'dd/mm/yyyy';
  const firstDayWeekRaw = Number(settings?.firstDayWeek);
  const firstDayWeek = Number.isInteger(firstDayWeekRaw) ? ((firstDayWeekRaw % 7) + 7) % 7 : 1;
  return { dateFormat, firstDayWeek };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateForDisplay(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) return '';

  const { dateFormat } = getDatePreferences();
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  switch (dateFormat) {
    case 'mm/dd/yyyy':
      return `${month}/${day}/${year}`;
    case 'yyyy-mm-dd':
      return `${year}-${month}-${day}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

function getPlaceholder() {
  const { dateFormat } = getDatePreferences();
  switch (dateFormat) {
    case 'mm/dd/yyyy':
      return 'mm/dd/aaaa';
    case 'yyyy-mm-dd':
      return 'aaaa-mm-dd';
    default:
      return 'dd/mm/aaaa';
  }
}

function buildDayHeaders(firstDayWeek) {
  return Array.from({ length: 7 }, (_, index) => DAY_LABELS[(index + firstDayWeek) % 7]);
}

function createPickerMarkup() {
  return `
    <div class="sonalia-date-picker hidden absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[120] overflow-hidden rounded-2xl border border-[#8BCFDD]/35 bg-white shadow-2xl shadow-[#0F2532]/15 dark:border-slate-700 dark:bg-[#0E1A25]">
      <div class="flex items-center justify-between border-b border-[#8BCFDD]/25 px-4 py-3 dark:border-slate-700">
        <button type="button" data-action="prev-month" class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#1D5D69] transition hover:bg-[#8BCFDD]/20 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Mes anterior">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="min-w-0 text-center">
          <button type="button" data-action="toggle-monthyear" class="truncate text-sm font-semibold text-[#1D5D69] hover:text-[#4EABBE] dark:text-white dark:hover:text-[#8BCFDD] transition px-2 py-1 rounded-lg hover:bg-[#8BCFDD]/10" aria-label="Seleccionar mes y año" data-role="month-label"></button>
        </div>
        <button type="button" data-action="next-month" class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#1D5D69] transition hover:bg-[#8BCFDD]/20 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Mes siguiente">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Calendar view -->
      <div data-role="calendar-view" class="px-4 pt-4">
        <div data-role="day-headers" class="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D5D69]/70 dark:text-slate-400"></div>
        <div data-role="days-grid" class="grid grid-cols-7 gap-1 pb-4"></div>
      </div>

      <!-- Month/Year quick-select view (hidden by default) -->
      <div data-role="monthyear-view" class="hidden px-4 pt-3 pb-4">
        <div class="flex items-center justify-center gap-2 mb-3">
          <button type="button" data-action="prev-year" class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#1D5D69] transition hover:bg-[#8BCFDD]/20 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Año anterior">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <input data-role="year-input" type="number" min="1900" max="2100"
            class="w-24 text-center text-base font-bold text-[#1D5D69] dark:text-white bg-[#F8F7F7] dark:bg-slate-800 border border-[#8BCFDD]/40 dark:border-slate-600 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"
            placeholder="Año" />
          <button type="button" data-action="next-year" class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#1D5D69] transition hover:bg-[#8BCFDD]/20 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Año siguiente">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        <div data-role="months-grid" class="grid grid-cols-4 gap-1.5"></div>
      </div>

      <div class="flex items-center justify-between border-t border-[#8BCFDD]/25 bg-[#F8F7F7]/85 px-4 py-3 dark:border-slate-700 dark:bg-[#0B1721]">
        <button type="button" data-action="clear-date" class="rounded-xl px-3 py-2 text-sm font-semibold text-[#1D5D69] transition hover:bg-[#8BCFDD]/20 dark:text-slate-300 dark:hover:bg-slate-800">Borrar</button>
        <button type="button" data-action="today-date" class="rounded-xl px-3 py-2 text-sm font-semibold text-[#4EABBE] transition hover:bg-[#8BCFDD]/20 dark:text-[#8BCFDD] dark:hover:bg-slate-800">Hoy</button>
      </div>
    </div>
  `;
}

function setInputValue(hiddenInput, displayInput, isoDate, { dispatch = true } = {}) {
  hiddenInput.value = isoDate || '';
  displayInput.value = formatDateForDisplay(isoDate);
  displayInput.placeholder = getPlaceholder();

  if (dispatch) {
    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function closePicker(state) {
  state.picker.classList.add('hidden');
  state.displayInput.setAttribute('aria-expanded', 'false');
  // Always return to calendar view on close
  showCalendarView(state);
}

function openPicker(state) {
  renderCalendar(state);
  state.picker.classList.remove('hidden');
  state.displayInput.setAttribute('aria-expanded', 'true');
}

function togglePicker(state) {
  if (state.picker.classList.contains('hidden')) {
    openPicker(state);
  } else {
    closePicker(state);
  }
}

function showCalendarView(state) {
  const calView = state.picker.querySelector('[data-role="calendar-view"]');
  const myView = state.picker.querySelector('[data-role="monthyear-view"]');
  const prevBtn = state.picker.querySelector('[data-action="prev-month"]');
  const nextBtn = state.picker.querySelector('[data-action="next-month"]');
  if (calView) calView.classList.remove('hidden');
  if (myView) myView.classList.add('hidden');
  if (prevBtn) prevBtn.classList.remove('hidden');
  if (nextBtn) nextBtn.classList.remove('hidden');
  renderCalendar(state);
}

function showMonthYearView(state) {
  const calView = state.picker.querySelector('[data-role="calendar-view"]');
  const myView = state.picker.querySelector('[data-role="monthyear-view"]');
  const prevBtn = state.picker.querySelector('[data-action="prev-month"]');
  const nextBtn = state.picker.querySelector('[data-action="next-month"]');
  if (calView) calView.classList.add('hidden');
  if (myView) myView.classList.remove('hidden');
  if (prevBtn) prevBtn.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');
  renderMonthYearView(state);
}

function renderMonthYearView(state) {
  const myView = state.picker.querySelector('[data-role="monthyear-view"]');
  if (!myView) return;

  const yearInput = myView.querySelector('[data-role="year-input"]');
  const monthsGrid = myView.querySelector('[data-role="months-grid"]');
  if (!yearInput || !monthsGrid) return;

  yearInput.value = state.viewDate.getFullYear();

  const currentMonth = state.viewDate.getMonth();
  monthsGrid.innerHTML = MONTH_SHORT.map((label, idx) => {
    const isSelected = idx === currentMonth;
    const btnClass = isSelected
      ? 'bg-[#4EABBE] text-white shadow-sm'
      : 'text-[#0F2532] hover:bg-[#8BCFDD]/20 dark:text-slate-100 dark:hover:bg-slate-800';
    return `<button type="button" data-action="select-month" data-month="${idx}" class="py-2 rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#4EABBE] ${btnClass}">${label}</button>`;
  }).join('');
}

function renderCalendar(state) {
  const { firstDayWeek } = getDatePreferences();
  const { picker, hiddenInput } = state;
  const monthLabel = picker.querySelector('[data-role="month-label"]');
  const dayHeaders = picker.querySelector('[data-role="day-headers"]');
  const daysGrid = picker.querySelector('[data-role="days-grid"]');

  if (!monthLabel || !dayHeaders || !daysGrid) return;

  const monthName = MONTH_LABELS[state.viewDate.getMonth()];
  const year = state.viewDate.getFullYear();
  monthLabel.textContent = `${monthName} de ${year}`;

  dayHeaders.innerHTML = buildDayHeaders(firstDayWeek)
    .map(label => `<span class="py-1">${label}</span>`)
    .join('');

  const firstDayOfMonth = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1);
  const monthOffset = (firstDayOfMonth.getDay() - firstDayWeek + 7) % 7;
  const gridStart = new Date(firstDayOfMonth);
  gridStart.setDate(gridStart.getDate() - monthOffset);

  const selectedValue = hiddenInput.value;
  const todayValue = toIsoDate(new Date());
  const dayButtons = [];

  for (let index = 0; index < 42; index += 1) {
    const currentDate = new Date(gridStart);
    currentDate.setDate(gridStart.getDate() + index);
    const isoValue = toIsoDate(currentDate);
    const isCurrentMonth = currentDate.getMonth() === state.viewDate.getMonth();
    const isSelected = isoValue === selectedValue;
    const isToday = isoValue === todayValue;

    const classes = [
      'inline-flex h-10 items-center justify-center rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#4EABBE] focus:ring-offset-2 focus:ring-offset-white',
      'dark:focus:ring-offset-[#0E1A25]'
    ];

    if (isSelected) {
      classes.push('bg-[#4EABBE] text-white shadow-md shadow-[#4EABBE]/25');
    } else if (isToday) {
      classes.push('border border-[#4EABBE] text-[#1D5D69] dark:border-[#8BCFDD] dark:text-[#8BCFDD]');
    } else if (isCurrentMonth) {
      classes.push('text-[#0F2532] hover:bg-[#8BCFDD]/20 dark:text-slate-100 dark:hover:bg-slate-800');
    } else {
      classes.push('text-[#0F2532]/35 hover:bg-[#8BCFDD]/10 dark:text-slate-500 dark:hover:bg-slate-900');
    }

    dayButtons.push(`
      <button type="button" data-action="select-date" data-date="${isoValue}" class="${classes.join(' ')}">
        ${currentDate.getDate()}
      </button>
    `);
  }

  daysGrid.innerHTML = dayButtons.join('');
}

function isMonthYearViewVisible(state) {
  const myView = state.picker.querySelector('[data-role="monthyear-view"]');
  return myView && !myView.classList.contains('hidden');
}

function bindPickerEvents(state) {
  const { wrapper, picker, hiddenInput, displayInput } = state;

  displayInput.addEventListener('click', () => togglePicker(state));
  displayInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      togglePicker(state);
    }
    if (event.key === 'Escape') {
      closePicker(state);
    }
  });

  picker.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;

    // ── Calendar navigation ──────────────────────────────────────────
    if (action === 'prev-month') {
      state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() - 1, 1);
      renderCalendar(state);
      return;
    }

    if (action === 'next-month') {
      state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1);
      renderCalendar(state);
      return;
    }

    // ── Toggle month/year picker ─────────────────────────────────────
    if (action === 'toggle-monthyear') {
      if (isMonthYearViewVisible(state)) {
        showCalendarView(state);
      } else {
        showMonthYearView(state);
      }
      return;
    }

    // ── Month/Year view actions ──────────────────────────────────────
    if (action === 'prev-year') {
      state.viewDate = new Date(state.viewDate.getFullYear() - 1, state.viewDate.getMonth(), 1);
      renderMonthYearView(state);
      return;
    }

    if (action === 'next-year') {
      state.viewDate = new Date(state.viewDate.getFullYear() + 1, state.viewDate.getMonth(), 1);
      renderMonthYearView(state);
      return;
    }

    if (action === 'select-month') {
      const month = parseInt(actionTarget.dataset.month, 10);
      if (!Number.isNaN(month)) {
        state.viewDate = new Date(state.viewDate.getFullYear(), month, 1);
        showCalendarView(state);
      }
      return;
    }

    // ── Date selection / utility ─────────────────────────────────────
    if (action === 'today-date') {
      const today = new Date();
      state.viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
      setInputValue(hiddenInput, displayInput, toIsoDate(today));
      closePicker(state);
      return;
    }

    if (action === 'clear-date') {
      setInputValue(hiddenInput, displayInput, '');
      closePicker(state);
      return;
    }

    if (action === 'select-date') {
      const isoDate = actionTarget.dataset.date || '';
      const selectedDate = parseIsoDate(isoDate);
      if (!selectedDate) return;

      state.viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      setInputValue(hiddenInput, displayInput, isoDate);
      closePicker(state);
    }
  });

  // Year input — update calendar on valid year change
  const yearInput = picker.querySelector('[data-role="year-input"]');
  if (yearInput) {
    yearInput.addEventListener('change', () => {
      const year = parseInt(yearInput.value, 10);
      if (year >= 1900 && year <= 2100) {
        state.viewDate = new Date(year, state.viewDate.getMonth(), 1);
        renderMonthYearView(state);
      }
    });
    yearInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const year = parseInt(yearInput.value, 10);
        if (year >= 1900 && year <= 2100) {
          state.viewDate = new Date(year, state.viewDate.getMonth(), 1);
          showCalendarView(state);
        }
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) {
      closePicker(state);
    }
  });
}

function enhanceDateInput(input) {
  if (!input || input.dataset.sonaliaDateReady === 'true') return;

  const wrapper = document.createElement('div');
  wrapper.className = 'relative';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const inputClasses = input.className;
  const displayInput = document.createElement('input');
  displayInput.type = 'text';
  displayInput.readOnly = true;
  displayInput.placeholder = getPlaceholder();
  displayInput.className = `${inputClasses} cursor-pointer pr-12`;
  displayInput.setAttribute('aria-haspopup', 'dialog');
  displayInput.setAttribute('aria-expanded', 'false');

  const triggerButton = document.createElement('button');
  triggerButton.type = 'button';
  triggerButton.className = 'absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center rounded-r-xl text-[#4EABBE] transition hover:bg-[#8BCFDD]/15 dark:text-[#8BCFDD] dark:hover:bg-slate-800';
  triggerButton.setAttribute('aria-label', 'Abrir calendario');
  triggerButton.innerHTML = `
    <svg class="h-5 w-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  `;

  const pickerHost = document.createElement('div');
  pickerHost.innerHTML = createPickerMarkup();
  const picker = pickerHost.firstElementChild;

  input.type = 'hidden';
  input.dataset.sonaliaDateReady = 'true';

  wrapper.appendChild(displayInput);
  wrapper.appendChild(triggerButton);
  wrapper.appendChild(picker);

  const currentDate = parseIsoDate(input.value) || new Date();
  const state = {
    hiddenInput: input,
    displayInput,
    picker,
    wrapper,
    viewDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  };

  DATE_PICKER_STATE.set(input, state);
  setInputValue(input, displayInput, input.value, { dispatch: false });
  bindPickerEvents(state);

  triggerButton.addEventListener('click', () => togglePicker(state));
}

export function enhanceDateInputs(root = document) {
  root.querySelectorAll('input[type="date"]:not([data-sonalia-date-ready="true"])').forEach(enhanceDateInput);
}

export function refreshDateInputs(root = document) {
  root.querySelectorAll('input[data-sonalia-date-ready="true"]').forEach((input) => {
    const state = DATE_PICKER_STATE.get(input);
    if (!state) return;

    const parsed = parseIsoDate(input.value);
    const baseDate = parsed || new Date();
    state.viewDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    setInputValue(input, state.displayInput, input.value, { dispatch: false });
    renderCalendar(state);
  });
}
