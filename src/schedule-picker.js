const { WEEKDAYS, normalizeFrequency, normalizeDays, formatCadenceLabel } = require('./storage');

const CADENCE_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Specific days' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

function renderSchedulePicker(container, { frequency = 'daily', days = [], onChange } = {}) {
  let currentFreq = normalizeFrequency(frequency);
  let currentDays = new Set(normalizeDays(days));

  const root = container.createDiv({ cls: 'iter-schedule-picker' });
  const cadenceRow = root.createDiv({ cls: 'iter-cadence-pills', attr: { role: 'radiogroup', 'aria-label': 'Habit repetitivity' } });
  const weekdayWrap = root.createDiv({ cls: 'iter-weekday-wrap' });
  const weekdayGrid = weekdayWrap.createDiv({ cls: 'iter-weekday-grid', attr: { role: 'group', 'aria-label': 'Days of the week' } });
  const summaryEl = weekdayWrap.createDiv({ cls: 'iter-schedule-summary' });

  const cadenceButtons = new Map();
  const dayButtons = new Map();

  const snapshot = () => ({
    frequency: currentFreq,
    days: currentFreq === 'weekdays' ? normalizeDays(Array.from(currentDays)) : [],
  });

  const syncUi = () => {
    for (const [id, btn] of cadenceButtons) {
      const active = id === currentFreq;
      btn.toggleClass?.('is-active', active);
      if (!btn.toggleClass) {
        btn.className = `iter-cadence-pill${active ? ' is-active' : ''}`;
      }
      btn.setAttribute('aria-checked', String(active));
    }

    const showDays = currentFreq === 'weekdays';
    weekdayWrap.style.display = showDays ? '' : 'none';

    const orderedDays = normalizeDays(Array.from(currentDays));
    for (const [id, btn] of dayButtons) {
      const selected = currentDays.has(id);
      btn.toggleClass?.('is-selected', selected);
      if (!btn.toggleClass) {
        btn.className = `iter-weekday-pill${selected ? ' is-selected' : ''}`;
      }
      btn.setAttribute('aria-pressed', String(selected));
    }

    if (showDays) {
      summaryEl.textContent = orderedDays.length
        ? `Water on ${formatCadenceLabel('weekdays', orderedDays)}`
        : 'Select one or more days of the week';
      summaryEl.toggleClass?.('is-empty', orderedDays.length === 0);
    }
  };

  for (const option of CADENCE_OPTIONS) {
    const btn = cadenceRow.createEl('button', {
      text: option.label,
      type: 'button',
      cls: 'iter-cadence-pill',
      attr: { role: 'radio' },
    });
    cadenceButtons.set(option.id, btn);
    btn.addEventListener('click', () => {
      if (currentFreq === option.id) return;
      currentFreq = option.id;
      syncUi();
      onChange?.(snapshot());
    });
  }

  for (const day of WEEKDAYS) {
    const btn = weekdayGrid.createEl('button', {
      text: day.label,
      type: 'button',
      cls: 'iter-weekday-pill',
      attr: { title: day.full, 'aria-label': day.full },
    });
    dayButtons.set(day.id, btn);
    btn.addEventListener('click', () => {
      if (currentDays.has(day.id)) currentDays.delete(day.id);
      else currentDays.add(day.id);
      syncUi();
      onChange?.(snapshot());
    });
  }

  syncUi();

  return {
    getValue: snapshot,
    setValue(nextFreq, nextDays = []) {
      currentFreq = normalizeFrequency(nextFreq);
      currentDays = new Set(normalizeDays(nextDays));
      syncUi();
    },
  };
}

module.exports = {
  CADENCE_OPTIONS,
  renderSchedulePicker,
};
