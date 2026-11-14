const { ROOT, parseDateKey, toDateKey, normalizeFrequency, normalizeDays, mergeWaterDates } = require('./storage');

const DATASET_TYPES = [
  { id: 'number_time', label: 'Number & Time' },
  { id: 'text', label: 'Text List' },
  { id: 'note', label: 'Notes' },
  { id: 'note_time', label: 'Notes & Time' },
];

const WIDGET_TYPES = [
  { id: 'stat', label: 'Metric Stat' },
  { id: 'goal_bar', label: 'Goal Comparison Bar' },
  { id: 'chart', label: 'Time Graph' },
  { id: 'note_navigator', label: 'Note Navigator' },
  { id: 'streak', label: 'Habit Streak' },
];

const STAT_AGGS = [
  { id: 'count', label: 'Count' },
  { id: 'sum', label: 'Sum' },
  { id: 'average', label: 'Average' },
  { id: 'latest', label: 'Latest' },
  { id: 'max', label: 'Max' },
  { id: 'min', label: 'Min' },
];

const BAR_MODES = [
  { id: 'latest', label: 'Latest entry' },
  { id: 'max', label: 'Best / Max' },
  { id: 'sum', label: 'Total sum' },
  { id: 'count', label: 'Entry count' },
];

const CHART_VARIANTS = [
  { id: 'line', label: 'Line' },
  { id: 'bar', label: 'Bar' },
];

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function stripMd(name) {
  return typeof name === 'string' && name.endsWith('.md') ? name.slice(0, -3) : String(name || '');
}

function normalizeDatasetType(type) {
  return DATASET_TYPES.some(item => item.id === type) ? type : 'number_time';
}

function normalizeWidgetType(type) {
  return WIDGET_TYPES.some(item => item.id === type) ? type : 'stat';
}

function normalizeStatAgg(agg) {
  return STAT_AGGS.some(item => item.id === agg) ? agg : 'latest';
}

function normalizeBarMode(mode) {
  return BAR_MODES.some(item => item.id === mode) ? mode : 'latest';
}

function normalizeChartVariant(variant) {
  return CHART_VARIANTS.some(item => item.id === variant) ? variant : 'line';
}

function toFiniteNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeEntry(type, raw) {
  if (raw === null || raw === undefined) return null;
  if (type === 'number_time') {
    if (typeof raw !== 'object') return null;
    const value = toFiniteNumber(raw.value);
    const date = typeof raw.date === 'string' && parseDateKey(raw.date) ? raw.date.trim() : toDateKey();
    if (value === null) return null;
    return { value, date };
  }
  if (type === 'text') {
    const value = typeof raw === 'string' ? raw.trim() : typeof raw?.value === 'string' ? raw.value.trim() : '';
    if (!value) return null;
    const date = typeof raw?.date === 'string' && parseDateKey(raw.date) ? raw.date.trim() : null;
    return date ? { value, date } : { value };
  }
  if (type === 'note') {
    const path = typeof raw === 'string' ? raw.trim() : typeof raw?.path === 'string' ? raw.path.trim() : '';
    if (!path) return null;
    return { path };
  }
  if (type === 'note_time') {
    if (typeof raw !== 'object') return null;
    const path = typeof raw.path === 'string' ? raw.path.trim() : '';
    if (!path) return null;
    const date = typeof raw.date === 'string' && parseDateKey(raw.date) ? raw.date.trim() : toDateKey();
    const value = toFiniteNumber(raw.value);
    return value !== null ? { path, date, value } : { path, date };
  }
  return null;
}

function normalizeDataset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const type = normalizeDatasetType(raw.type);
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(item => normalizeEntry(type, item)).filter(Boolean)
    : [];
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId('ds'),
    name,
    type,
    unit: typeof raw.unit === 'string' ? raw.unit.trim() : '',
    metricKey: typeof raw.metricKey === 'string' && raw.metricKey.trim() ? raw.metricKey.trim() : 'score',
    entries,
  };
}

function normalizeWidget(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = normalizeWidgetType(raw.type);
  const datasetId = typeof raw.datasetId === 'string' ? raw.datasetId.trim() : '';
  if (type !== 'streak' && !datasetId) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId('w'),
    title,
    type,
    datasetId,
    agg: normalizeStatAgg(raw.agg),
    mode: normalizeBarMode(raw.mode),
    target: toFiniteNumber(raw.target),
    variant: normalizeChartVariant(raw.variant),
    metricKey: typeof raw.metricKey === 'string' && raw.metricKey.trim() ? raw.metricKey.trim() : '',
  };
}

function resolveGoalKind(file, fm) {
  if (file?.name === '_tree.md') return 'tree';
  if (file?.path?.includes('/subgoals/')) return 'subgoal';
  if (file?.path?.includes('/habits/')) return 'habit';
  const type = typeof fm?.type === 'string' ? fm.type.trim() : '';
  if (type === 'tree' || type === 'subgoal' || type === 'habit') return type;
  return 'goal';
}

function resolveParentTreePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.startsWith(`${ROOT}/`)) return null;
  const rest = filePath.slice(ROOT.length + 1);
  const treeName = rest.split('/')[0];
  if (!treeName || treeName.startsWith('_')) return null;
  return `${ROOT}/${treeName}`;
}

function readGoalDocument(app, file) {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  const kind = resolveGoalKind(file, fm);
  const treePath = resolveParentTreePath(file?.path);
  const parentTreeFile = treePath ? app.vault.getAbstractFileByPath(`${treePath}/_tree.md`) : null;
  const title = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : stripMd(file.name);
  const description = typeof fm.description === 'string' && fm.description.trim()
    ? fm.description.trim()
    : (typeof fm.goal === 'string' ? fm.goal.trim() : '');
  const due = typeof fm.due === 'string' && parseDateKey(fm.due) ? fm.due.trim() : '';
  const target = typeof fm.target === 'string' ? fm.target.trim() : '';
  const datasets = Array.isArray(fm.datasets) ? fm.datasets.map(normalizeDataset).filter(Boolean) : [];
  const widgets = Array.isArray(fm.widgets) ? fm.widgets.map(normalizeWidget).filter(Boolean) : [];

  return {
    file,
    kind,
    treePath,
    parentTreeFile: parentTreeFile && parentTreeFile.path !== file.path ? parentTreeFile : null,
    title,
    description,
    due,
    endless: kind === 'tree' && Boolean(fm.endless),
    target,
    done: Boolean(fm.done),
    frequency: normalizeFrequency(fm.frequency),
    days: normalizeDays(fm.days),
    waterLog: mergeWaterDates(fm.water_log),
    lastWatered: typeof fm.last_watered === 'string' && fm.last_watered.trim() ? fm.last_watered.trim() : null,
    module: typeof fm.module === 'string' ? fm.module : 'general',
    datasets,
    widgets,
  };
}

function resolveNoteFile(app, pathOrLink, sourcePath = '') {
  if (!pathOrLink) return null;
  const direct = app.vault.getAbstractFileByPath(pathOrLink);
  if (direct && !Array.isArray(direct.children)) return direct;
  return app.metadataCache.getFirstLinkpathDest?.(pathOrLink, sourcePath) ?? null;
}

function resolveDatasetEntries(app, dataset, sourcePath = '') {
  return dataset.entries.map((entry, index) => {
    if (dataset.type === 'number_time') {
      return { index, date: entry.date, value: entry.value, noteFile: null, label: `${entry.value}${dataset.unit ? ` ${dataset.unit}` : ''}` };
    }
    if (dataset.type === 'text') {
      return { index, date: entry.date ?? null, value: null, noteFile: null, label: entry.value };
    }
    if (dataset.type === 'note') {
      const noteFile = resolveNoteFile(app, entry.path, sourcePath);
      const name = noteFile ? stripMd(noteFile.name) : stripMd(entry.path.split('/').pop());
      return { index, date: null, value: null, noteFile, path: noteFile?.path ?? entry.path, label: name };
    }
    if (dataset.type === 'note_time') {
      const noteFile = resolveNoteFile(app, entry.path, sourcePath);
      const fm = noteFile ? app.metadataCache.getFileCache(noteFile)?.frontmatter : null;
      const key = dataset.metricKey || 'score';
      const fmVal = toFiniteNumber(fm?.[key]);
      const value = fmVal !== null ? fmVal : toFiniteNumber(entry.value);
      const name = noteFile ? stripMd(noteFile.name) : stripMd(entry.path.split('/').pop());
      return { index, date: entry.date, value, noteFile, path: noteFile?.path ?? entry.path, label: name };
    }
    return { index, date: null, value: null, noteFile: null, label: '' };
  });
}

function resolveNumericSeries(app, dataset, sourcePath = '', metricOverride = '') {
  const effectiveDataset = metricOverride ? { ...dataset, metricKey: metricOverride } : dataset;
  const resolved = resolveDatasetEntries(app, effectiveDataset, sourcePath);
  const timed = resolved.filter(item => item.value !== null && Number.isFinite(item.value));
  if (dataset.type === 'number_time' || dataset.type === 'note_time') {
    timed.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.index - b.index);
  }
  return timed;
}

function formatNumber(num) {
  if (!Number.isFinite(num)) return '—';
  const rounded = Math.round(num * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function computeStat(app, dataset, agg, sourcePath = '', metricOverride = '') {
  const normalizedAgg = normalizeStatAgg(agg);
  if (normalizedAgg === 'count') {
    return {
      value: dataset.entries.length,
      display: formatNumber(dataset.entries.length),
      unit: '',
      count: dataset.entries.length,
    };
  }
  const points = resolveNumericSeries(app, dataset, sourcePath, metricOverride);
  if (!points.length) {
    return { value: null, display: '—', unit: dataset.unit, count: 0 };
  }
  let value = null;
  if (normalizedAgg === 'sum') value = points.reduce((acc, p) => acc + p.value, 0);
  else if (normalizedAgg === 'average') value = points.reduce((acc, p) => acc + p.value, 0) / points.length;
  else if (normalizedAgg === 'latest') value = points[points.length - 1].value;
  else if (normalizedAgg === 'max') value = Math.max(...points.map(p => p.value));
  else if (normalizedAgg === 'min') value = Math.min(...points.map(p => p.value));

  return {
    value,
    display: formatNumber(value),
    unit: dataset.unit,
    count: points.length,
  };
}

function computeGoalBar(app, dataset, mode, target, sourcePath = '', metricOverride = '') {
  const normalizedMode = normalizeBarMode(mode);
  const stat = computeStat(app, dataset, normalizedMode, sourcePath, metricOverride);
  const current = stat.value ?? 0;
  const numericTarget = toFiniteNumber(target);
  const ratio = numericTarget && numericTarget > 0 ? current / numericTarget : 0;
  const rawPercent = numericTarget && numericTarget > 0 ? Math.round(ratio * 100) : 0;
  const fillPercent = Math.max(0, Math.min(100, rawPercent));
  const unit = normalizedMode === 'count' ? '' : dataset.unit;

  return {
    current: stat.value,
    currentDisplay: stat.value === null ? '—' : formatNumber(stat.value),
    target: numericTarget,
    targetDisplay: numericTarget === null ? '—' : formatNumber(numericTarget),
    rawPercent,
    fillPercent,
    unit,
  };
}

function formatDueStatus(due, now = new Date()) {
  const parsedDue = parseDateKey(due);
  if (!parsedDue) return null;
  const todayStr = toDateKey(now);
  const parsedToday = parseDateKey(todayStr);
  const diffDays = Math.round((parsedDue.getTime() - parsedToday.getTime()) / 86400000);
  const formatted = parsedDue.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  if (diffDays < 0) return { formatted, badge: `${Math.abs(diffDays)}d overdue`, tone: 'overdue' };
  if (diffDays === 0) return { formatted, badge: 'Due today', tone: 'today' };
  if (diffDays <= 7) return { formatted, badge: `${diffDays}d left`, tone: 'soon' };
  return { formatted, badge: `${diffDays}d left`, tone: 'calm' };
}

async function updateGoalMeta(app, file, { description, due, endless }) {
  await app.fileManager.processFrontMatter(file, fm => {
    if (description !== undefined) {
      const clean = String(description).trim();
      fm.description = clean;
      if (file.name === '_tree.md') fm.goal = clean;
    }
    if (endless !== undefined && file.name === '_tree.md') {
      fm.endless = Boolean(endless);
      if (fm.endless) fm.due = '';
    }
    if (due !== undefined && !(file.name === '_tree.md' && fm.endless)) {
      const cleanDue = String(due).trim();
      fm.due = parseDateKey(cleanDue) ? cleanDue : '';
    }
  });
}

async function addDataset(app, file, { name, type, unit = '', metricKey = 'score' }) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName) throw new Error('Dataset name is required.');
  const dataset = {
    id: generateId('ds'),
    name: cleanName,
    type: normalizeDatasetType(type),
    unit: typeof unit === 'string' ? unit.trim() : '',
    metricKey: typeof metricKey === 'string' && metricKey.trim() ? metricKey.trim() : 'score',
    entries: [],
  };
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.datasets) ? fm.datasets : [];
    fm.datasets = [...existing, dataset];
  });
  return dataset;
}

async function removeDataset(app, file, datasetId) {
  await app.fileManager.processFrontMatter(file, fm => {
    fm.datasets = Array.isArray(fm.datasets)
      ? fm.datasets.filter(item => item?.id !== datasetId)
      : [];
    if (Array.isArray(fm.widgets)) {
      fm.widgets = fm.widgets.filter(w => w?.datasetId !== datasetId);
    }
  });
}

async function addDatasetEntry(app, file, datasetId, rawEntry) {
  let added = null;
  await app.fileManager.processFrontMatter(file, fm => {
    if (!Array.isArray(fm.datasets)) throw new Error('No datasets found on this goal.');
    const ds = fm.datasets.find(item => item?.id === datasetId);
    if (!ds) throw new Error('Dataset not found.');
    const entry = normalizeEntry(normalizeDatasetType(ds.type), rawEntry);
    if (!entry) throw new Error('Invalid entry value.');
    if (!Array.isArray(ds.entries)) ds.entries = [];
    ds.entries.push(entry);
    added = entry;
  });
  return added;
}

async function removeDatasetEntry(app, file, datasetId, entryIndex) {
  await app.fileManager.processFrontMatter(file, fm => {
    if (!Array.isArray(fm.datasets)) return;
    const ds = fm.datasets.find(item => item?.id === datasetId);
    if (!ds || !Array.isArray(ds.entries)) return;
    if (entryIndex >= 0 && entryIndex < ds.entries.length) {
      ds.entries.splice(entryIndex, 1);
    }
  });
}

async function addWidget(app, file, { title = '', type, datasetId = '', agg = 'latest', mode = 'latest', target = null, variant = 'line', metricKey = '' }) {
  const wType = normalizeWidgetType(type);
  const resolvedDatasetId = wType === 'streak' ? '' : (typeof datasetId === 'string' ? datasetId.trim() : '');
  if (wType !== 'streak' && !resolvedDatasetId) {
    throw new Error('Select a data list to link this widget to.');
  }
  const widget = {
    id: generateId('w'),
    title: typeof title === 'string' ? title.trim() : '',
    type: wType,
    datasetId: resolvedDatasetId,
    agg: normalizeStatAgg(agg),
    mode: normalizeBarMode(mode),
    target: toFiniteNumber(target),
    variant: normalizeChartVariant(variant),
    metricKey: typeof metricKey === 'string' ? metricKey.trim() : '',
  };
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.widgets) ? fm.widgets : [];
    fm.widgets = [...existing, widget];
  });
  return widget;
}

async function removeWidget(app, file, widgetId) {
  await app.fileManager.processFrontMatter(file, fm => {
    fm.widgets = Array.isArray(fm.widgets)
      ? fm.widgets.filter(item => item?.id !== widgetId)
      : [];
  });
}

module.exports = {
  DATASET_TYPES,
  WIDGET_TYPES,
  STAT_AGGS,
  BAR_MODES,
  CHART_VARIANTS,
  generateId,
  stripMd,
  normalizeEntry,
  readGoalDocument,
  resolveDatasetEntries,
  resolveNumericSeries,
  formatNumber,
  computeStat,
  computeGoalBar,
  formatDueStatus,
  updateGoalMeta,
  addDataset,
  removeDataset,
  addDatasetEntry,
  removeDatasetEntry,
  addWidget,
  removeWidget,
};
