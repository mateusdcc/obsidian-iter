const {
  ROOT,
  isFolder,
  parseDateKey,
  toDateKey,
  normalizeFrequency,
  normalizeDays,
  mergeWaterDates,
} = require('./storage');

const DATASET_TYPES = [
  { id: 'number_time', label: 'Number & Time' },
  { id: 'text', label: 'Text List' },
  { id: 'note', label: 'Notes' },
  { id: 'note_time', label: 'Notes & Time' },
  { id: 'rollup', label: 'Child Rollup (from children)' },
];

const RELATION_CHILD_KINDS = [
  { id: 'all', label: 'All subgoals & habits' },
  { id: 'habits', label: 'Habits only' },
  { id: 'subgoals', label: 'Subgoals only' },
];

const RELATION_DATA_FILTERS = [
  { id: 'numeric', label: 'Numeric (numbers & scored notes)' },
  { id: 'note', label: 'Notes' },
  { id: 'text', label: 'Text lists' },
  { id: 'any', label: 'All data types' },
];

const RELATION_PER_CHILD = [
  { id: 'all', label: 'All entries combined' },
  { id: 'sum', label: 'Sum per child' },
  { id: 'latest', label: 'Latest entry per child' },
  { id: 'average', label: 'Average per child' },
  { id: 'max', label: 'Max per child' },
  { id: 'min', label: 'Min per child' },
  { id: 'count', label: 'Entry count per child' },
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
  if (type === 'pipeline') return 'pipeline';
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

function parseMetricKeysInput(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const seen = new Set();
  const keys = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const clean = item.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    keys.push(clean);
  }
  return keys;
}

function normalizeMetricKeys(rawKeys, rawSingle, type) {
  if (rawKeys !== undefined) {
    const parsed = parseMetricKeysInput(rawKeys);
    if (parsed.length) return parsed;
    if (typeof rawSingle === 'string' && rawSingle.trim()) return parseMetricKeysInput(rawSingle);
    return [];
  }
  if (rawSingle !== undefined) {
    return parseMetricKeysInput(rawSingle);
  }
  return type === 'note_time' ? ['score'] : [];
}

function normalizeEntryProps(rawProps) {
  if (!rawProps || typeof rawProps !== 'object' || Array.isArray(rawProps)) return null;
  const out = {};
  let hasAny = false;
  for (const [rawKey, rawVal] of Object.entries(rawProps)) {
    const key = String(rawKey || '').trim();
    if (!key || rawVal === null || rawVal === undefined || rawVal === '') continue;
    const num = toFiniteNumber(rawVal);
    if (num !== null) {
      out[key] = num;
      hasAny = true;
    } else if (typeof rawVal === 'string') {
      const str = rawVal.trim();
      if (str) {
        out[key] = str;
        hasAny = true;
      }
    } else if (typeof rawVal === 'boolean') {
      out[key] = rawVal;
      hasAny = true;
    }
  }
  return hasAny ? out : null;
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
    const props = typeof raw === 'object' ? normalizeEntryProps(raw.props) : null;
    return props ? { path, props } : { path };
  }
  if (type === 'note_time') {
    if (typeof raw !== 'object') return null;
    const path = typeof raw.path === 'string' ? raw.path.trim() : '';
    if (!path) return null;
    const date = typeof raw.date === 'string' && parseDateKey(raw.date) ? raw.date.trim() : toDateKey();
    const value = toFiniteNumber(raw.value);
    const props = normalizeEntryProps(raw.props);
    const entry = { path, date };
    if (value !== null) entry.value = value;
    if (props) entry.props = props;
    return entry;
  }
  return null;
}

function normalizeChildKinds(raw) {
  return RELATION_CHILD_KINDS.some(item => item.id === raw) ? raw : 'all';
}

function normalizeDataFilter(raw) {
  return RELATION_DATA_FILTERS.some(item => item.id === raw) ? raw : 'numeric';
}

function normalizePerChildAgg(raw) {
  return RELATION_PER_CHILD.some(item => item.id === raw) ? raw : 'all';
}

function normalizeRelationRefs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(ref => {
      if (!ref || typeof ref !== 'object') return null;
      const filePath = typeof ref.filePath === 'string' ? ref.filePath.trim() : '';
      const datasetId = typeof ref.datasetId === 'string' ? ref.datasetId.trim() : '';
      if (!datasetId) return null;
      return { filePath, datasetId };
    })
    .filter(Boolean);
}

function normalizeRelation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const mode = raw.mode === 'pick' ? 'pick' : 'query';
  return {
    scope: 'tree_children',
    treePath: typeof raw.treePath === 'string' ? raw.treePath.trim() : '',
    mode,
    childKinds: normalizeChildKinds(raw.childKinds),
    dataFilter: normalizeDataFilter(raw.dataFilter),
    nameMatch: typeof raw.nameMatch === 'string' ? raw.nameMatch.trim() : '',
    perChildAgg: normalizePerChildAgg(raw.perChildAgg),
    refs: mode === 'pick' ? normalizeRelationRefs(raw.refs) : [],
  };
}

function normalizeDataset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const type = normalizeDatasetType(raw.type);
  const relation = type === 'rollup'
    ? (normalizeRelation(raw.relation) || normalizeRelation({ mode: 'query' }))
    : null;
  const metricKeys = normalizeMetricKeys(raw.metricKeys, raw.metricKey, type);
  const entries = type === 'rollup'
    ? []
    : (Array.isArray(raw.entries) ? raw.entries.map(item => normalizeEntry(type, item)).filter(Boolean) : []);
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId('ds'),
    name,
    type,
    unit: typeof raw.unit === 'string' ? raw.unit.trim() : '',
    metricKey: metricKeys[0] || '',
    metricKeys,
    relation,
    entries,
  };
}

function normalizePipelineRef(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.filter(n => n && typeof n === 'object') : [];
  const edges = Array.isArray(raw.edges) ? raw.edges.filter(e => e && typeof e === 'object') : [];
  if (!nodes.length) return null;
  return {
    version: 1,
    zoom: Number.isFinite(Number(raw.zoom)) ? Number(raw.zoom) : 1,
    panX: Number.isFinite(Number(raw.panX)) ? Number(raw.panX) : 0,
    panY: Number.isFinite(Number(raw.panY)) ? Number(raw.panY) : 0,
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
}

function normalizeWidget(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = normalizeWidgetType(raw.type);
  const pipeline = type === 'pipeline' ? normalizePipelineRef(raw.pipeline) : null;
  if (type === 'pipeline' && !pipeline) return null;
  const relation = (type === 'streak' || type === 'pipeline') ? null : normalizeRelation(raw.relation);
  const datasetId = (type === 'streak' || type === 'pipeline' || relation)
    ? ''
    : (typeof raw.datasetId === 'string' ? raw.datasetId.trim() : '');
  if (type !== 'streak' && type !== 'pipeline' && !datasetId && !relation) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId('w'),
    title,
    type,
    datasetId,
    relation,
    pipeline,
    unit: typeof raw.unit === 'string' ? raw.unit.trim() : '',
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

const IGNORED_FM_KEYS = new Set(['position', 'datasets', 'widgets', 'water_log', 'days']);
const AUTO_PROP_SKIP_KEYS = new Set([
  'position',
  'datasets',
  'widgets',
  'water_log',
  'days',
  'type',
  'title',
  'created',
  'updated',
  'tags',
  'aliases',
  'cssclasses',
  'cssclass',
  'date',
  'done',
  'due',
  'frequency',
  'target',
  'module',
  'style',
  'endless',
  'goal',
  'description',
  'last_watered',
]);

function lookupNoteField(fields, key) {
  if (!fields || typeof fields !== 'object' || !key) return undefined;
  if (Object.prototype.hasOwnProperty.call(fields, key)) return fields[key];
  const lower = String(key).trim().toLowerCase();
  for (const [k, v] of Object.entries(fields)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function extractNoteScalarFields(fm) {
  const fields = {};
  if (!fm || typeof fm !== 'object') return fields;
  for (const [key, val] of Object.entries(fm)) {
    if (!key || IGNORED_FM_KEYS.has(key) || val === null || val === undefined) continue;
    if (typeof val === 'number' && Number.isFinite(val)) {
      fields[key] = val;
    } else if (typeof val === 'string' && val.trim() !== '') {
      fields[key] = val.trim();
    } else if (typeof val === 'boolean') {
      fields[key] = val;
    }
  }
  return fields;
}

function resolveNoteEntryFields(app, entry, dataset, sourcePath = '', metricOverride = '') {
  const noteFile = resolveNoteFile(app, entry.path, sourcePath);
  const fm = noteFile ? app.metadataCache.getFileCache(noteFile)?.frontmatter : null;
  const fields = extractNoteScalarFields(fm);

  if (entry.props && typeof entry.props === 'object') {
    for (const [k, v] of Object.entries(entry.props)) {
      if (lookupNoteField(fields, k) === undefined && v !== undefined && v !== null && v !== '') {
        fields[k] = v;
      }
    }
  }

  const primaryKey = dataset.metricKey || dataset.metricKeys?.[0] || (dataset.type === 'note_time' ? 'score' : '');
  if (dataset.type === 'note_time' && entry.value !== undefined && entry.value !== null && primaryKey && lookupNoteField(fields, primaryKey) === undefined) {
    fields[primaryKey] = entry.value;
  }

  const declaredKeys = Array.isArray(dataset.metricKeys) && dataset.metricKeys.length
    ? dataset.metricKeys
    : (primaryKey ? [primaryKey] : []);

  const propsList = [];
  const seenPropKeys = new Set();
  for (const k of declaredKeys) {
    const rawVal = lookupNoteField(fields, k);
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;
    seenPropKeys.add(k.toLowerCase());
    const num = toFiniteNumber(rawVal);
    propsList.push({
      key: k,
      raw: rawVal,
      num,
    });
  }

  // Also surface any extra custom scalar frontmatter properties present on the note
  for (const [fk, rawVal] of Object.entries(fields)) {
    const lower = fk.toLowerCase();
    if (seenPropKeys.has(lower) || AUTO_PROP_SKIP_KEYS.has(lower)) continue;
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;
    seenPropKeys.add(lower);
    propsList.push({
      key: fk,
      raw: rawVal,
      num: toFiniteNumber(rawVal),
    });
  }

  const activeKey = metricOverride || primaryKey;
  let value = activeKey ? toFiniteNumber(lookupNoteField(fields, activeKey)) : null;
  if (value === null && dataset.type === 'note_time' && (!activeKey || activeKey === primaryKey)) {
    value = toFiniteNumber(entry.value);
  }

  const date = dataset.type === 'note_time'
    ? entry.date
    : (typeof fields.date === 'string' && parseDateKey(fields.date) ? fields.date.trim() : null);

  return {
    noteFile,
    path: noteFile?.path ?? entry.path,
    label: noteFile ? stripMd(noteFile.name) : stripMd(entry.path.split('/').pop()),
    date,
    value,
    fields,
    propsList,
  };
}

function resolveDatasetEntries(app, dataset, sourcePath = '', metricOverride = '') {
  if (dataset?.isVirtual && Array.isArray(dataset.resolvedEntries)) {
    if (!metricOverride || metricOverride === dataset.metricKey) {
      return dataset.resolvedEntries;
    }
    return dataset.resolvedEntries.map(item => {
      const nextVal = item.fields ? toFiniteNumber(item.fields[metricOverride]) : item.value;
      return { ...item, value: nextVal };
    });
  }
  return dataset.entries.map((entry, index) => {
    if (dataset.type === 'number_time') {
      return {
        index,
        date: entry.date,
        value: entry.value,
        noteFile: null,
        label: `${entry.value}${dataset.unit ? ` ${dataset.unit}` : ''}`,
        fields: { value: entry.value, date: entry.date, ...(dataset.unit ? { unit: dataset.unit } : {}) },
        propsList: [],
      };
    }
    if (dataset.type === 'text') {
      return {
        index,
        date: entry.date ?? null,
        value: null,
        noteFile: null,
        label: entry.value,
        fields: { value: entry.value, ...(entry.date ? { date: entry.date } : {}) },
        propsList: [],
      };
    }
    if (dataset.type === 'note' || dataset.type === 'note_time') {
      const resolved = resolveNoteEntryFields(app, entry, dataset, sourcePath, metricOverride);
      return {
        index,
        ...resolved,
      };
    }
    return { index, date: null, value: null, noteFile: null, label: '', fields: {}, propsList: [] };
  });
}

function resolveNumericSeries(app, dataset, sourcePath = '', metricOverride = '') {
  const effectiveDataset = metricOverride ? { ...dataset, metricKey: metricOverride } : dataset;
  const resolved = resolveDatasetEntries(app, effectiveDataset, sourcePath, metricOverride);
  const timed = resolved.filter(item => item.value !== null && Number.isFinite(item.value));
  if (timed.some(item => Boolean(item.date))) {
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
    const entries = resolveDatasetEntries(app, dataset, sourcePath, metricOverride);
    return {
      value: entries.length,
      display: formatNumber(entries.length),
      unit: '',
      count: entries.length,
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

function collectTreeMarkdownFiles(folder, acc = []) {
  if (!isFolder(folder)) return acc;
  for (const child of folder.children) {
    if (!child?.name || child.name.startsWith('.') || child.name.startsWith('_')) continue;
    if (isFolder(child)) {
      collectTreeMarkdownFiles(child, acc);
    } else if (child.extension === 'md') {
      acc.push(child);
    }
  }
  return acc;
}

function discoverChildDatasets(app, treePath) {
  if (!treePath || typeof treePath !== 'string') return [];
  const folder = app.vault.getAbstractFileByPath(treePath);
  if (!isFolder(folder)) return [];
  const files = collectTreeMarkdownFiles(folder, []).filter(f => f.name !== '_tree.md');
  const results = [];
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm || !Array.isArray(fm.datasets)) continue;
    const childKind = resolveGoalKind(file, fm);
    const childTitle = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : stripMd(file.name);
    for (const rawDs of fm.datasets) {
      const ds = normalizeDataset(rawDs);
      if (!ds) continue;
      results.push({
        file,
        filePath: file.path,
        childKind,
        childTitle,
        dataset: ds,
      });
    }
  }
  results.sort((a, b) =>
    a.childTitle.localeCompare(b.childTitle, undefined, { sensitivity: 'base', numeric: true }) ||
    a.dataset.name.localeCompare(b.dataset.name, undefined, { sensitivity: 'base', numeric: true }),
  );
  return results;
}

function datasetMatchesFilter(ds, dataFilter) {
  if (!ds) return false;
  if (dataFilter === 'any') return true;
  if (dataFilter === 'numeric') {
    if (ds.type === 'number_time' || ds.type === 'note_time') return true;
    if (ds.type === 'note' && Array.isArray(ds.metricKeys) && ds.metricKeys.length > 0) return true;
    if (ds.type === 'rollup') {
      const df = ds.relation?.dataFilter || 'numeric';
      return df === 'numeric' || df === 'any';
    }
    return false;
  }
  if (dataFilter === 'note') {
    if (ds.type === 'note' || ds.type === 'note_time') return true;
    if (ds.type === 'rollup') {
      const df = ds.relation?.dataFilter || 'numeric';
      return df === 'note' || df === 'any';
    }
    return false;
  }
  if (dataFilter === 'text') {
    if (ds.type === 'text') return true;
    if (ds.type === 'rollup') {
      const df = ds.relation?.dataFilter || 'numeric';
      return df === 'text' || df === 'any';
    }
    return false;
  }
  return true;
}

function inferRollupUnit(datasets, explicitUnit = '') {
  const cleanExplicit = typeof explicitUnit === 'string' ? explicitUnit.trim() : '';
  if (cleanExplicit) return cleanExplicit;
  const units = new Set(
    datasets
      .map(ds => (typeof ds?.unit === 'string' ? ds.unit.trim() : ''))
      .filter(Boolean),
  );
  return units.size === 1 ? Array.from(units)[0] : '';
}

function resolvePickedRefs(app, refs, childItems, ownerFilePath, excludedDatasetId) {
  const byKey = new Map();
  const byDsId = new Map();
  for (const item of childItems) {
    byKey.set(`${item.filePath}::${item.dataset.id}`, item);
    if (!byDsId.has(item.dataset.id)) byDsId.set(item.dataset.id, item);
  }
  const matched = [];
  const seen = new Set();
  for (const ref of refs) {
    let item = byKey.get(`${ref.filePath}::${ref.datasetId}`) || byDsId.get(ref.datasetId) || null;
    if (!item && ref.filePath) {
      const directFile = app.vault.getAbstractFileByPath(ref.filePath);
      if (directFile && !isFolder(directFile)) {
        const fm = app.metadataCache.getFileCache(directFile)?.frontmatter ?? {};
        const rawDs = Array.isArray(fm.datasets) ? fm.datasets.find(d => d?.id === ref.datasetId) : null;
        const ds = normalizeDataset(rawDs);
        if (ds) {
          item = {
            file: directFile,
            filePath: directFile.path,
            childKind: resolveGoalKind(directFile, fm),
            childTitle: typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : stripMd(directFile.name),
            dataset: ds,
          };
        }
      }
    }
    if (!item) continue;
    if (item.filePath === ownerFilePath && item.dataset.id === excludedDatasetId) continue;
    const key = `${item.filePath}::${item.dataset.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matched.push(item);
  }
  return matched;
}

function resolveVirtualDataset(app, spec, ownerFilePath = '', defaultTreePath = '', metricOverride = '', visited = new Set()) {
  const relation = normalizeRelation(spec?.relation);
  const explicitUnit = typeof spec?.unit === 'string' ? spec.unit.trim() : '';
  const effectiveMetric = (metricOverride || spec?.metricKey || '').trim();
  const emptyResult = {
    id: spec?.id || '',
    name: spec?.name || 'Child Rollup',
    type: 'number_time',
    unit: explicitUnit,
    metricKey: effectiveMetric || 'score',
    isVirtual: true,
    relation,
    sources: [],
    resolvedEntries: [],
    entries: [],
  };
  if (!relation) return emptyResult;

  const targetTreePath = relation.treePath || defaultTreePath || resolveParentTreePath(ownerFilePath) || '';
  const childItems = targetTreePath ? discoverChildDatasets(app, targetTreePath) : [];

  let matched = [];
  if (relation.mode === 'pick') {
    matched = resolvePickedRefs(app, relation.refs, childItems, ownerFilePath, spec?.id);
  } else {
    const queryLower = relation.nameMatch.toLowerCase();
    matched = childItems.filter(item => {
      if (item.filePath === ownerFilePath && item.dataset.id === spec?.id) return false;
      if (relation.childKinds === 'habits' && item.childKind !== 'habit') return false;
      if (relation.childKinds === 'subgoals' && item.childKind !== 'subgoal') return false;
      if (!datasetMatchesFilter(item.dataset, relation.dataFilter)) return false;
      if (queryLower) {
        const matchName = item.dataset.name.toLowerCase().includes(queryLower);
        const matchChild = item.childTitle.toLowerCase().includes(queryLower);
        if (!matchName && !matchChild) return false;
      }
      return true;
    });
  }

  const resolvedChildren = [];
  const sources = [];
  const resolvedEntries = [];

  for (const item of matched) {
    const visitKey = `${item.filePath}::${item.dataset.id}`;
    if (visited.has(visitKey) || visited.size >= 4) continue;
    const nextVisited = new Set(visited);
    nextVisited.add(visitKey);

    let childDs = item.dataset;
    if (childDs.type === 'rollup') {
      childDs = resolveVirtualDataset(app, childDs, item.filePath, targetTreePath, effectiveMetric, nextVisited);
    } else if (effectiveMetric && (childDs.type === 'note_time' || childDs.type === 'note')) {
      childDs = { ...childDs, metricKey: effectiveMetric };
    } else if (effectiveMetric && childDs.type === 'number_time') {
      const needle = effectiveMetric.toLowerCase();
      const nameHit = (childDs.name || '').toLowerCase().includes(needle);
      const unitHit = (childDs.unit || '').toLowerCase().includes(needle);
      if (!nameHit && !unitHit) continue;
    }

    resolvedChildren.push(childDs);
    const childEntries = resolveDatasetEntries(app, childDs, item.filePath, effectiveMetric);
    const numericPoints = resolveNumericSeries(app, childDs, item.filePath, effectiveMetric);

    const isNumericChild = childDs.type === 'number_time'
      || childDs.type === 'note_time'
      || (childDs.type === 'note' && Boolean(childDs.metricKeys?.length || effectiveMetric));
    const previewAgg = relation.perChildAgg === 'all'
      ? (isNumericChild ? 'sum' : 'count')
      : relation.perChildAgg;
    const summaryStat = computeStat(app, childDs, previewAgg, item.filePath, effectiveMetric);

    sources.push({
      file: item.file,
      filePath: item.filePath,
      childKind: item.childKind,
      childTitle: item.childTitle,
      datasetId: item.dataset.id,
      datasetName: item.dataset.name,
      datasetType: childDs.type,
      unit: childDs.unit,
      entryCount: childEntries.length,
      stat: summaryStat,
    });

    if (relation.perChildAgg === 'all') {
      for (const entry of childEntries) {
        if (relation.dataFilter === 'numeric' && (entry.value === null || !Number.isFinite(entry.value))) {
          continue;
        }
        resolvedEntries.push({
          ...entry,
          index: resolvedEntries.length,
          sourceFile: entry.sourceFile || item.file,
          sourceTitle: entry.sourceTitle || item.childTitle,
          datasetName: entry.datasetName || item.dataset.name,
        });
      }
    } else if (summaryStat.value !== null && Number.isFinite(summaryStat.value)) {
      const latestDate = numericPoints.length ? (numericPoints[numericPoints.length - 1].date || '') : '';
      resolvedEntries.push({
        index: resolvedEntries.length,
        date: latestDate,
        value: summaryStat.value,
        noteFile: null,
        label: `${item.childTitle}: ${formatNumber(summaryStat.value)}${childDs.unit ? ` ${childDs.unit}` : ''}`,
        sourceFile: item.file,
        sourceTitle: item.childTitle,
        datasetName: item.dataset.name,
      });
    }
  }

  let effectiveType = 'number_time';
  if (relation.perChildAgg !== 'all') {
    effectiveType = 'number_time';
  } else if (relation.dataFilter === 'text' || (resolvedChildren.length && resolvedChildren.every(d => d.type === 'text'))) {
    effectiveType = 'text';
  } else if (resolvedEntries.some(e => e.path)) {
    effectiveType = resolvedEntries.some(e => e.date || (e.value !== null && Number.isFinite(e.value))) ? 'note_time' : 'note';
  }

  const metricKeys = [];
  const seenKeys = new Set();
  for (const childDs of resolvedChildren) {
    for (const k of childDs.metricKeys || []) {
      if (k && !seenKeys.has(k)) {
        seenKeys.add(k);
        metricKeys.push(k);
      }
    }
  }

  return {
    id: spec?.id || '',
    name: spec?.name || describeRelation(relation, sources),
    type: effectiveType,
    unit: inferRollupUnit(resolvedChildren, explicitUnit),
    metricKey: effectiveMetric || metricKeys[0] || '',
    metricKeys,
    isVirtual: true,
    relation,
    sources,
    resolvedEntries,
    entries: resolvedEntries,
  };
}

function resolveWidgetDataset(app, widget, datasetById, doc) {
  if (widget.relation) {
    return resolveVirtualDataset(
      app,
      {
        id: widget.id,
        name: widget.title || '',
        unit: widget.unit || '',
        metricKey: widget.metricKey || '',
        relation: widget.relation,
      },
      doc.file?.path || '',
      doc.treePath || '',
      widget.metricKey || '',
    );
  }
  const ds = widget.datasetId ? datasetById.get(widget.datasetId) : null;
  if (!ds) return null;
  if (ds.type === 'rollup') {
    return resolveVirtualDataset(
      app,
      ds,
      doc.file?.path || '',
      doc.treePath || '',
      widget.metricKey || ds.metricKey || '',
      new Set([`${doc.file?.path || ''}::${ds.id}`]),
    );
  }
  return ds;
}

function describeRelation(relation, sources = null) {
  if (!relation) return 'Child rollup';
  if (relation.mode === 'pick') {
    const count = Array.isArray(sources) ? sources.length : relation.refs.length;
    const base = `${count} selected ${count === 1 ? 'list' : 'lists'}`;
    if (relation.perChildAgg !== 'all') {
      const aggLabel = RELATION_PER_CHILD.find(p => p.id === relation.perChildAgg)?.label || relation.perChildAgg;
      return `${base} · ${aggLabel}`;
    }
    return base;
  }
  const kindLabel = relation.childKinds === 'habits'
    ? 'Habits'
    : relation.childKinds === 'subgoals'
      ? 'Subgoals'
      : 'Tree children';
  const filterMap = {
    numeric: 'Numeric',
    note: 'Notes',
    text: 'Text',
    any: 'All data',
  };
  const parts = [kindLabel, relation.nameMatch ? `"${relation.nameMatch}"` : (filterMap[relation.dataFilter] || 'Data')];
  if (relation.perChildAgg !== 'all') {
    const aggLabel = RELATION_PER_CHILD.find(p => p.id === relation.perChildAgg)?.label || relation.perChildAgg;
    parts.push(aggLabel);
  }
  return parts.join(' · ');
}

async function addDataset(app, file, { name, type, unit = '', metricKey, metricKeys, relation = null }) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName) throw new Error('Dataset name is required.');
  const dsType = normalizeDatasetType(type);
  let cleanRelation = null;
  if (dsType === 'rollup') {
    cleanRelation = normalizeRelation(relation) || normalizeRelation({ mode: 'query' });
    if (cleanRelation.mode === 'pick' && !cleanRelation.refs.length) {
      throw new Error('Select at least one child data list.');
    }
  }
  const cleanKeys = normalizeMetricKeys(metricKeys, metricKey, dsType);
  const dataset = {
    id: generateId('ds'),
    name: cleanName,
    type: dsType,
    unit: typeof unit === 'string' ? unit.trim() : '',
    metricKey: cleanKeys[0] || '',
    metricKeys: cleanKeys,
    relation: cleanRelation,
    entries: [],
  };
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.datasets) ? fm.datasets : [];
    fm.datasets = [...existing, dataset];
  });
  return dataset;
}

async function updateDataset(app, file, datasetId, { name, type, unit, metricKey, metricKeys, relation }) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName) throw new Error('Dataset name is required.');
  let updated = null;
  await app.fileManager.processFrontMatter(file, fm => {
    if (!Array.isArray(fm.datasets)) throw new Error('No datasets found on this goal.');
    const idx = fm.datasets.findIndex(item => item?.id === datasetId);
    if (idx === -1) throw new Error('Dataset not found.');
    const current = normalizeDataset(fm.datasets[idx]) || fm.datasets[idx];
    const nextType = type ? normalizeDatasetType(type) : current.type;
    let cleanRelation = null;
    if (nextType === 'rollup') {
      cleanRelation = normalizeRelation(relation ?? current.relation) || normalizeRelation({ mode: 'query' });
      if (cleanRelation.mode === 'pick' && !cleanRelation.refs.length) {
        throw new Error('Select at least one child data list.');
      }
    }
    const cleanKeys = (metricKeys !== undefined || metricKey !== undefined)
      ? normalizeMetricKeys(metricKeys, metricKey, nextType)
      : (current.metricKeys || []);
    updated = {
      ...current,
      name: cleanName,
      type: nextType,
      unit: typeof unit === 'string' ? unit.trim() : (current.unit || ''),
      metricKey: cleanKeys[0] || '',
      metricKeys: cleanKeys,
      relation: cleanRelation,
      entries: nextType === 'rollup' ? [] : (current.entries || []),
    };
    fm.datasets[idx] = updated;
  });
  return updated;
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
    const dsType = normalizeDatasetType(ds.type);
    if (dsType === 'rollup') {
      throw new Error('Child rollup lists are computed automatically from child data.');
    }
    const entry = normalizeEntry(dsType, rawEntry);
    if (!entry) throw new Error('Invalid entry value.');
    if (!Array.isArray(ds.entries)) ds.entries = [];
    ds.entries.push(entry);
    added = entry;
  });
  return added;
}

async function updateDatasetEntry(app, file, datasetId, entryIndex, rawEntry) {
  let updated = null;
  await app.fileManager.processFrontMatter(file, fm => {
    if (!Array.isArray(fm.datasets)) throw new Error('No datasets found on this goal.');
    const ds = fm.datasets.find(item => item?.id === datasetId);
    if (!ds || !Array.isArray(ds.entries)) throw new Error('Dataset not found.');
    if (entryIndex < 0 || entryIndex >= ds.entries.length) {
      throw new Error('Entry index out of range.');
    }
    const dsType = normalizeDatasetType(ds.type);
    const entry = normalizeEntry(dsType, rawEntry);
    if (!entry) throw new Error('Invalid entry value.');
    ds.entries[entryIndex] = entry;
    updated = entry;
  });
  return updated;
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

function buildWidgetPayload(raw, existingId = '') {
  const wType = normalizeWidgetType(raw.type);
  const cleanPipeline = wType === 'pipeline' ? normalizePipelineRef(raw.pipeline) : null;
  if (wType === 'pipeline' && !cleanPipeline) {
    throw new Error('Add at least one node before saving this flow widget.');
  }
  const cleanRelation = (wType === 'streak' || wType === 'pipeline') ? null : normalizeRelation(raw.relation);
  if (cleanRelation && cleanRelation.mode === 'pick' && !cleanRelation.refs.length) {
    throw new Error('Select at least one child data list.');
  }
  const resolvedDatasetId = (wType === 'streak' || wType === 'pipeline' || cleanRelation)
    ? ''
    : (typeof raw.datasetId === 'string' ? raw.datasetId.trim() : '');
  if (wType !== 'streak' && wType !== 'pipeline' && !resolvedDatasetId && !cleanRelation) {
    throw new Error('Select a data list to link this widget to.');
  }
  return {
    id: existingId || generateId('w'),
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    type: wType,
    datasetId: resolvedDatasetId,
    relation: cleanRelation,
    pipeline: cleanPipeline,
    unit: typeof raw.unit === 'string' ? raw.unit.trim() : '',
    agg: normalizeStatAgg(raw.agg),
    mode: normalizeBarMode(raw.mode),
    target: toFiniteNumber(raw.target),
    variant: normalizeChartVariant(raw.variant),
    metricKey: typeof raw.metricKey === 'string' ? raw.metricKey.trim() : '',
  };
}

async function addWidget(app, file, config) {
  const widget = buildWidgetPayload(config);
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.widgets) ? fm.widgets : [];
    fm.widgets = [...existing, widget];
  });
  return widget;
}

async function updateWidget(app, file, widgetId, config) {
  const widget = buildWidgetPayload(config, widgetId);
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.widgets) ? fm.widgets : [];
    const idx = existing.findIndex(item => item?.id === widgetId);
    if (idx === -1) {
      fm.widgets = [...existing, widget];
    } else {
      fm.widgets = existing.map((item, i) => (i === idx ? widget : item));
    }
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
  RELATION_CHILD_KINDS,
  RELATION_DATA_FILTERS,
  RELATION_PER_CHILD,
  generateId,
  stripMd,
  toFiniteNumber,
  parseMetricKeysInput,
  normalizeMetricKeys,
  normalizeEntryProps,
  extractNoteScalarFields,
  normalizeEntry,
  normalizeRelation,
  normalizePipelineRef,
  readGoalDocument,
  discoverChildDatasets,
  datasetMatchesFilter,
  resolveDatasetEntries,
  resolveNumericSeries,
  resolveVirtualDataset,
  resolveWidgetDataset,
  describeRelation,
  formatNumber,
  computeStat,
  computeGoalBar,
  formatDueStatus,
  updateGoalMeta,
  addDataset,
  updateDataset,
  removeDataset,
  addDatasetEntry,
  updateDatasetEntry,
  removeDatasetEntry,
  addWidget,
  updateWidget,
  removeWidget,
};
