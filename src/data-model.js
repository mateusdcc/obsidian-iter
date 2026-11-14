const {
  ROOT,
  WE_PATH,
  isFolder,
  parseDateKey,
  toDateKey,
  normalizeFrequency,
  normalizeDays,
  mergeWaterDates,
  computeHabitScheduleMeta,
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
  { id: 'habits_today', label: 'Habits appearing today (due today)' },
  { id: 'habits_pending', label: 'Habits needing water today' },
  { id: 'habits_all', label: 'All habits & appearance schedule' },
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

function normalizeAutoQuery(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const folder = typeof raw.folder === 'string'
    ? raw.folder.split(',').map(s => s.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean).join(', ')
    : '';
  const tag = typeof raw.tag === 'string' ? raw.tag.trim() : '';
  const where = typeof raw.where === 'string' ? raw.where.trim() : '';
  const nameMatch = typeof raw.nameMatch === 'string' ? raw.nameMatch.trim() : '';
  if (!folder && !tag && !where && !nameMatch) return null;
  const excludeIndex = raw.excludeIndex !== undefined ? Boolean(raw.excludeIndex) : true;
  return {
    folder,
    tag,
    where,
    nameMatch,
    excludeIndex,
  };
}

function describeAutoQuery(autoQuery) {
  if (!autoQuery) return '';
  const parts = [];
  if (autoQuery.folder) parts.push(`folder "${autoQuery.folder}"`);
  if (autoQuery.tag) parts.push(`tag ${autoQuery.tag.startsWith('#') ? autoQuery.tag : `#${autoQuery.tag}`}`);
  if (autoQuery.where) parts.push(`where ${autoQuery.where}`);
  if (autoQuery.nameMatch) parts.push(`name "${autoQuery.nameMatch}"`);
  return parts.length ? `Auto: ${parts.join(' · ')}` : '';
}

function normalizeDataset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const type = normalizeDatasetType(raw.type);
  const relation = type === 'rollup'
    ? (normalizeRelation(raw.relation) || normalizeRelation({ mode: 'query' }))
    : null;
  const autoQuery = (type === 'note' || type === 'note_time') ? normalizeAutoQuery(raw.autoQuery) : null;
  const excludedPaths = Array.isArray(raw.excludedPaths)
    ? raw.excludedPaths.map(p => (typeof p === 'string' ? p.trim() : '')).filter(Boolean)
    : [];
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
    autoQuery,
    excludedPaths,
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

function normalizeWidgetDimension(val, min = 140, max = 1800) {
  if (val === null || val === undefined || val === '') return null;
  const n = toFiniteNumber(val);
  if (n === null || n <= 0) return null;
  return Math.round(Math.max(min, Math.min(max, n)));
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
    width: normalizeWidgetDimension(raw.width, 180, 1800),
    height: normalizeWidgetDimension(raw.height, 100, 1400),
  };
}

function resolveGoalKind(file, fm) {
  if (file?.path === WE_PATH) return 'garden';
  if (file?.name === '_tree.md') return 'tree';
  if (file?.path?.includes('/subgoals/')) return 'subgoal';
  if (file?.path?.includes('/habits/')) return 'habit';
  const type = typeof fm?.type === 'string' ? fm.type.trim() : '';
  if (type === 'iter-index' || type === 'garden') return 'garden';
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

function readGoalDocument(app, file, now = new Date()) {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  const kind = resolveGoalKind(file, fm);
  const treePath = kind === 'garden' ? ROOT : resolveParentTreePath(file?.path);
  const parentTreeFile = treePath && treePath !== ROOT ? app.vault.getAbstractFileByPath(`${treePath}/_tree.md`) : null;
  const title = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : stripMd(file.name);
  const description = typeof fm.description === 'string' && fm.description.trim()
    ? fm.description.trim()
    : (typeof fm.goal === 'string' ? fm.goal.trim() : '');
  const due = typeof fm.due === 'string' && parseDateKey(fm.due) ? fm.due.trim() : '';
  const target = typeof fm.target === 'string' ? fm.target.trim() : '';
  const datasets = Array.isArray(fm.datasets) ? fm.datasets.map(normalizeDataset).filter(Boolean) : [];
  const widgets = Array.isArray(fm.widgets) ? fm.widgets.map(normalizeWidget).filter(Boolean) : [];
  const frequency = normalizeFrequency(fm.frequency);
  const days = normalizeDays(fm.days);
  const waterLog = mergeWaterDates(fm.water_log);
  const lastWatered = typeof fm.last_watered === 'string' && fm.last_watered.trim() ? fm.last_watered.trim() : null;
  const habitSchedule = kind === 'habit'
    ? computeHabitScheduleMeta(frequency, days, lastWatered, waterLog, now)
    : null;

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
    frequency,
    days,
    waterLog,
    lastWatered,
    habitSchedule,
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

function collectVaultMarkdownFiles(app, folderPrefixes = []) {
  if (typeof app?.vault?.getMarkdownFiles === 'function') {
    const all = app.vault.getMarkdownFiles() || [];
    if (!folderPrefixes.length) return all;
    return all.filter(f => folderPrefixes.some(prefix => f.path === `${prefix}.md` || f.path.startsWith(`${prefix}/`)));
  }
  const acc = [];
  const seen = new Set();
  const walk = node => {
    if (!node) return;
    if (isFolder(node)) {
      for (const child of node.children || []) {
        if (!child?.name || child.name.startsWith('.')) continue;
        walk(child);
      }
    } else if (node.extension === 'md' && !seen.has(node.path)) {
      seen.add(node.path);
      acc.push(node);
    }
  };
  if (folderPrefixes.length) {
    for (const prefix of folderPrefixes) {
      const folder = app?.vault?.getAbstractFileByPath?.(prefix);
      if (folder) walk(folder);
    }
    return acc;
  }
  const root = app?.vault?.getRoot?.() || app?.vault?.getAbstractFileByPath?.('') || app?.vault?.getAbstractFileByPath?.('/');
  if (root) walk(root);
  return acc;
}

function discoverVaultFolders(app) {
  const files = collectVaultMarkdownFiles(app, []);
  const folders = new Set();
  for (const f of files) {
    if (!f?.path || f.path.startsWith(`${ROOT}/`) || f.path.startsWith('.')) continue;
    const slashIdx = f.path.lastIndexOf('/');
    if (slashIdx > 0) {
      const dir = f.path.slice(0, slashIdx);
      if (!dir.split('/').some(seg => seg.startsWith('_') || seg.startsWith('.'))) {
        folders.add(dir);
      }
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function matchesWhereClause(fields, fm, rawClause) {
  const clause = String(rawClause || '').trim();
  if (!clause) return true;

  const opMatch = clause.match(/^([a-zA-Z0-9_.-]+)\s*(!=|>=|<=|>|<|=|:)\s*(.*)$/);
  if (opMatch) {
    const key = opMatch[1].trim();
    const op = opMatch[2];
    const targetRaw = opMatch[3].trim().replace(/^["']|["']$/g, '');
    const actual = lookupNoteField(fields, key) ?? fm?.[key];
    const actualNum = toFiniteNumber(actual);
    const targetNum = toFiniteNumber(targetRaw);

    if (op === '!=') {
      if (actual === undefined || actual === null) return targetRaw !== '';
      if (actualNum !== null && targetNum !== null) return actualNum !== targetNum;
      return String(actual).trim().toLowerCase() !== targetRaw.toLowerCase();
    }
    if (op === '>' || op === '>=' || op === '<' || op === '<=') {
      if (actualNum === null || targetNum === null) return false;
      if (op === '>') return actualNum > targetNum;
      if (op === '>=') return actualNum >= targetNum;
      if (op === '<') return actualNum < targetNum;
      return actualNum <= targetNum;
    }
    // '=' or ':'
    if (actual === undefined || actual === null) return false;
    if (actualNum !== null && targetNum !== null) return actualNum === targetNum;
    return String(actual).trim().toLowerCase() === targetRaw.toLowerCase();
  }

  if (clause.startsWith('!')) {
    const key = clause.slice(1).trim();
    const val = lookupNoteField(fields, key) ?? fm?.[key];
    return val === undefined || val === null || String(val).trim() === '';
  }

  const val = lookupNoteField(fields, clause) ?? fm?.[clause];
  return val !== undefined && val !== null && String(val).trim() !== '';
}

function inferNoteDate(file, fm, fields) {
  for (const key of ['date', 'created', 'completed', 'read_date']) {
    const raw = fields[key] ?? fm?.[key];
    if (typeof raw === 'string' && raw.trim()) {
      const prefix = raw.trim().slice(0, 10);
      if (parseDateKey(prefix)) return prefix;
    }
  }
  const ts = file?.stat?.mtime || file?.stat?.ctime;
  if (Number.isFinite(ts) && ts > 0) {
    return toDateKey(new Date(ts));
  }
  return toDateKey();
}

function discoverAutoQueryNotes(app, rawQuery, sourcePath = '') {
  const query = normalizeAutoQuery(rawQuery);
  if (!query || !app?.vault) return [];

  const folderPrefixes = query.folder
    ? query.folder.split(',').map(s => s.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean)
    : [];
  const candidates = collectVaultMarkdownFiles(app, folderPrefixes);

  const requiredTags = query.tag
    ? query.tag
        .split(',')
        .map(t => t.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean)
    : [];
  const whereClauses = query.where
    ? query.where
        .split(/\s*(?:,|\bAND\b)\s*/i)
        .map(s => s.trim())
        .filter(Boolean)
    : [];
  const nameTokens = query.nameMatch
    ? query.nameMatch.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const whereMentionsBook = /\btype\s*(=|:)\s*["']?book\b/i.test(query.where || '');

  const matched = [];
  for (const file of candidates) {
    if (!file?.path || file.path === sourcePath) continue;
    if (file.path.startsWith(`${ROOT}/`) || file.name.startsWith('_') || file.name.startsWith('.')) continue;

    if (folderPrefixes.length > 0) {
      const inFolder = folderPrefixes.some(prefix => file.path.startsWith(`${prefix}/`));
      if (!inFolder) continue;
    }

    const cache = app.metadataCache?.getFileCache?.(file) || {};
    const fm = cache.frontmatter || {};
    const fields = extractNoteScalarFields(fm);
    const baseName = stripMd(file.name);

    if (query.excludeIndex !== false && folderPrefixes.length > 0 && !whereMentionsBook) {
      const parentFolder = file.path.includes('/')
        ? file.path.slice(0, file.path.lastIndexOf('/')).split('/').pop()
        : '';
      if (parentFolder && baseName.toLowerCase() === parentFolder.toLowerCase()) continue;
      if (typeof fm.type === 'string' && (fm.type.trim().toLowerCase() === 'book' || fm.type.trim().toLowerCase() === 'index')) {
        continue;
      }
    }

    if (requiredTags.length > 0) {
      const fileTags = new Set();
      const rawFmTags = fm.tags ?? fm.tag;
      if (Array.isArray(rawFmTags)) {
        for (const t of rawFmTags) fileTags.add(String(t).trim().replace(/^#/, '').toLowerCase());
      } else if (typeof rawFmTags === 'string') {
        for (const t of rawFmTags.split(/[,\s]+/)) fileTags.add(t.trim().replace(/^#/, '').toLowerCase());
      }
      if (Array.isArray(cache.tags)) {
        for (const tObj of cache.tags) {
          if (tObj?.tag) fileTags.add(String(tObj.tag).trim().replace(/^#/, '').toLowerCase());
        }
      }
      if (!requiredTags.every(req => fileTags.has(req))) continue;
    }

    if (whereClauses.length > 0) {
      if (!whereClauses.every(clause => matchesWhereClause(fields, fm, clause))) continue;
    }

    if (nameTokens.length > 0) {
      const titleStr = (typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : baseName).toLowerCase();
      const baseLower = baseName.toLowerCase();
      let nameOk = true;
      for (const tok of nameTokens) {
        if (tok.startsWith('!')) {
          const neg = tok.slice(1).trim().toLowerCase();
          if (neg && (baseLower.includes(neg) || titleStr.includes(neg))) {
            nameOk = false;
            break;
          }
        } else {
          const pos = tok.toLowerCase();
          if (pos && !baseLower.includes(pos) && !titleStr.includes(pos)) {
            nameOk = false;
            break;
          }
        }
      }
      if (!nameOk) continue;
    }

    matched.push({
      file,
      path: file.path,
      date: inferNoteDate(file, fm, fields),
    });
  }

  matched.sort((a, b) =>
    (a.date || '').localeCompare(b.date || '') ||
    a.path.localeCompare(b.path, undefined, { sensitivity: 'base', numeric: true }),
  );
  return matched;
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
  const manualEntries = Array.isArray(dataset?.entries) ? dataset.entries : [];
  const results = manualEntries.map((entry, index) => {
    if (dataset.type === 'number_time') {
      return {
        index,
        entryIndex: index,
        isAuto: false,
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
        entryIndex: index,
        isAuto: false,
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
        entryIndex: index,
        isAuto: false,
        ...resolved,
      };
    }
    return { index, entryIndex: index, isAuto: false, date: null, value: null, noteFile: null, label: '', fields: {}, propsList: [] };
  });

  if ((dataset?.type === 'note' || dataset?.type === 'note_time') && dataset.autoQuery && app?.vault) {
    const existingPaths = new Set(results.map(r => r.path).filter(Boolean));
    const excluded = new Set(Array.isArray(dataset.excludedPaths) ? dataset.excludedPaths : []);
    const autoNotes = discoverAutoQueryNotes(app, dataset.autoQuery, sourcePath);
    for (const autoItem of autoNotes) {
      if (existingPaths.has(autoItem.path) || excluded.has(autoItem.path)) continue;
      existingPaths.add(autoItem.path);
      const syntheticEntry = dataset.type === 'note_time'
        ? { path: autoItem.path, date: autoItem.date }
        : { path: autoItem.path };
      const resolved = resolveNoteEntryFields(app, syntheticEntry, dataset, sourcePath, metricOverride);
      results.push({
        index: results.length,
        entryIndex: -1,
        isAuto: true,
        ...resolved,
      });
    }
  }

  return results;
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
  const numericTarget = toFiniteNumber(target);
  if (dataset?.isHabitSchedule && (numericTarget === null || numericTarget <= 0)) {
    const entries = resolveDatasetEntries(app, dataset, sourcePath, metricOverride);
    const total = entries.length;
    const wateredCount = entries.filter(e => Boolean(e.schedule?.wateredToday || e.schedule?.wateredInPeriod)).length;
    const ratio = total > 0 ? wateredCount / total : 0;
    const rawPercent = total > 0 ? Math.round(ratio * 100) : 0;
    const fillPercent = Math.max(0, Math.min(100, rawPercent));
    return {
      current: wateredCount,
      currentDisplay: formatNumber(wateredCount),
      target: total,
      targetDisplay: formatNumber(total),
      rawPercent,
      fillPercent,
      unit: dataset.unit || 'habits',
    };
  }
  const normalizedMode = normalizeBarMode(mode);
  const stat = computeStat(app, dataset, normalizedMode, sourcePath, metricOverride);
  const current = stat.value ?? 0;
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

function discoverHabits(app, scopePath = ROOT, now = new Date()) {
  if (!scopePath || typeof scopePath !== 'string') return [];
  const target = app.vault.getAbstractFileByPath(scopePath);
  if (!target) return [];
  const files = isFolder(target)
    ? collectTreeMarkdownFiles(target, []).filter(f => f.name !== '_tree.md')
    : [target];

  const showTreeBadge = scopePath === ROOT;
  const results = [];

  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    if (resolveGoalKind(file, fm) !== 'habit') continue;
    const habitTitle = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : stripMd(file.name);
    const treePath = resolveParentTreePath(file.path) || '';
    const treeFile = treePath ? app.vault.getAbstractFileByPath(`${treePath}/_tree.md`) : null;
    const treeFm = treeFile ? (app.metadataCache.getFileCache(treeFile)?.frontmatter ?? {}) : {};
    const treeTitle = typeof treeFm.title === 'string' && treeFm.title.trim()
      ? treeFm.title.trim()
      : (treePath ? treePath.split('/').pop() : '');

    const frequency = normalizeFrequency(fm.frequency);
    const days = normalizeDays(fm.days);
    const waterLog = mergeWaterDates(fm.water_log);
    const lastWatered = typeof fm.last_watered === 'string' && fm.last_watered.trim() ? fm.last_watered.trim() : null;
    const schedule = computeHabitScheduleMeta(frequency, days, lastWatered, waterLog, now);

    const propsList = [
      ...(showTreeBadge && treeTitle ? [{ key: 'tree', value: treeTitle }] : []),
      { key: 'appear', value: schedule.appearLabel },
      { key: 'cadence', value: schedule.cadenceShort },
      ...(schedule.streak > 0 ? [{ key: 'streak', value: `${schedule.streak}d` }] : []),
    ];

    const fields = {
      title: habitTitle,
      tree: treeTitle,
      treeTitle,
      date: schedule.appearDate,
      appearDate: schedule.appearDate,
      nextAppearDate: schedule.nextAppearDate,
      appearLabel: schedule.appearLabel,
      daysUntil: schedule.daysUntil,
      dueToday: schedule.dueToday,
      pendingToday: schedule.pendingToday,
      wateredToday: schedule.wateredToday,
      wateredInPeriod: schedule.wateredInPeriod,
      status: schedule.status,
      cadence: schedule.cadenceLabel,
      frequency: schedule.frequency,
      streak: schedule.streak,
      value: 1,
    };

    results.push({
      index: 0,
      date: schedule.appearDate,
      value: 1,
      unit: 'habits',
      label: habitTitle,
      path: file.path,
      noteFile: file,
      habitFile: file,
      sourceFile: file,
      sourceTitle: habitTitle,
      treeTitle,
      treePath,
      childKind: 'habit',
      sourceKind: 'habit',
      datasetId: '__habit_schedule',
      datasetName: 'Habit schedule',
      datasetType: 'habit_schedule',
      schedule,
      fields,
      propsList,
    });
  }

  results.sort((a, b) =>
    a.schedule.daysUntil - b.schedule.daysUntil ||
    (a.schedule.pendingToday === b.schedule.pendingToday ? 0 : (a.schedule.pendingToday ? -1 : 1)) ||
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }),
  );
  results.forEach((item, idx) => {
    item.index = idx;
  });
  return results;
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

function resolveVirtualDataset(app, spec, ownerFilePath = '', defaultTreePath = '', metricOverride = '', visited = new Set(), now = new Date()) {
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

  const targetTreePath = relation.treePath || defaultTreePath || resolveParentTreePath(ownerFilePath) || ROOT;

  if (
    relation.dataFilter === 'habits_today' ||
    relation.dataFilter === 'habits_pending' ||
    relation.dataFilter === 'habits_all'
  ) {
    const allHabits = discoverHabits(app, targetTreePath || ROOT, now);
    const queryLower = (relation.nameMatch || '').toLowerCase();
    const matchedHabits = allHabits.filter(h => {
      if (relation.dataFilter === 'habits_today' && !h.schedule.dueToday) return false;
      if (relation.dataFilter === 'habits_pending' && !h.schedule.pendingToday) return false;
      if (queryLower) {
        const hitName = h.label.toLowerCase().includes(queryLower);
        const hitTree = (h.treeTitle || '').toLowerCase().includes(queryLower);
        const hitCadence = (h.schedule.cadenceLabel || '').toLowerCase().includes(queryLower);
        if (!hitName && !hitTree && !hitCadence) return false;
      }
      return true;
    });

    const resolvedEntries = matchedHabits.map((h, idx) => {
      const val = effectiveMetric ? toFiniteNumber(h.fields?.[effectiveMetric]) : 1;
      return {
        ...h,
        index: idx,
        value: val !== null && Number.isFinite(val) ? val : 1,
      };
    });

    const sources = matchedHabits.map(h => ({
      file: h.habitFile,
      filePath: h.path,
      childKind: 'habit',
      childTitle: h.label,
      datasetId: '__habit_schedule',
      datasetName: h.schedule.appearLabel,
      datasetType: 'habit_schedule',
      unit: '',
      entryCount: 1,
      stat: { value: 1, display: h.schedule.appearLabel, unit: '', count: 1 },
    }));

    const inferredUnit = explicitUnit || (effectiveMetric === 'streak' || effectiveMetric === 'daysUntil' ? 'days' : 'habits');
    return {
      id: spec?.id || '',
      name: spec?.name || describeRelation(relation, sources),
      type: 'note_time',
      unit: inferredUnit,
      metricKey: effectiveMetric || 'value',
      metricKeys: ['streak', 'daysUntil'],
      isVirtual: true,
      isHabitSchedule: true,
      relation,
      sources,
      resolvedEntries,
      entries: resolvedEntries,
    };
  }

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
    habits_today: 'Habits appearing today',
    habits_pending: 'Habits needing water today',
    habits_all: 'All habits & schedule',
  };
  const parts = [kindLabel, relation.nameMatch ? `"${relation.nameMatch}"` : (filterMap[relation.dataFilter] || 'Data')];
  if (relation.perChildAgg !== 'all') {
    const aggLabel = RELATION_PER_CHILD.find(p => p.id === relation.perChildAgg)?.label || relation.perChildAgg;
    parts.push(aggLabel);
  }
  return parts.join(' · ');
}

async function addDataset(app, file, { name, type, unit = '', metricKey, metricKeys, relation = null, autoQuery = null }) {
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
  const cleanAutoQuery = (dsType === 'note' || dsType === 'note_time') ? normalizeAutoQuery(autoQuery) : null;
  const cleanKeys = normalizeMetricKeys(metricKeys, metricKey, dsType);
  const dataset = {
    id: generateId('ds'),
    name: cleanName,
    type: dsType,
    unit: typeof unit === 'string' ? unit.trim() : '',
    metricKey: cleanKeys[0] || '',
    metricKeys: cleanKeys,
    relation: cleanRelation,
    autoQuery: cleanAutoQuery,
    excludedPaths: [],
    entries: [],
  };
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.datasets) ? fm.datasets : [];
    fm.datasets = [...existing, dataset];
  });
  return dataset;
}

async function updateDataset(app, file, datasetId, { name, type, unit, metricKey, metricKeys, relation, autoQuery }) {
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
    const cleanAutoQuery = (nextType === 'note' || nextType === 'note_time')
      ? normalizeAutoQuery(autoQuery !== undefined ? autoQuery : current.autoQuery)
      : null;
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
      autoQuery: cleanAutoQuery,
      excludedPaths: Array.isArray(current.excludedPaths) ? current.excludedPaths : [],
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
    if (Array.isArray(ds.excludedPaths) && entry.path) {
      ds.excludedPaths = ds.excludedPaths.filter(p => p !== entry.path);
    }
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
    if (!ds) throw new Error('Dataset not found.');
    if (!Array.isArray(ds.entries)) ds.entries = [];
    const dsType = normalizeDatasetType(ds.type);
    const entry = normalizeEntry(dsType, rawEntry);
    if (!entry) throw new Error('Invalid entry value.');
    if (entryIndex === -1 && entry.path) {
      const existingIdx = ds.entries.findIndex(e => e?.path === entry.path);
      if (existingIdx >= 0) ds.entries[existingIdx] = entry;
      else ds.entries.push(entry);
      updated = entry;
      return;
    }
    if (entryIndex < 0 || entryIndex >= ds.entries.length) {
      throw new Error('Entry index out of range.');
    }
    ds.entries[entryIndex] = entry;
    updated = entry;
  });
  return updated;
}

async function removeDatasetEntry(app, file, datasetId, entryIndex, entryPath = '') {
  await app.fileManager.processFrontMatter(file, fm => {
    if (!Array.isArray(fm.datasets)) return;
    const ds = fm.datasets.find(item => item?.id === datasetId);
    if (!ds) return;
    if (!Array.isArray(ds.entries)) ds.entries = [];
    if (entryIndex >= 0 && entryIndex < ds.entries.length) {
      ds.entries.splice(entryIndex, 1);
    } else if (entryPath) {
      const cleanPath = String(entryPath).trim();
      if (!Array.isArray(ds.excludedPaths)) ds.excludedPaths = [];
      if (cleanPath && !ds.excludedPaths.includes(cleanPath)) {
        ds.excludedPaths.push(cleanPath);
      }
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
    width: normalizeWidgetDimension(raw.width, 180, 1800),
    height: normalizeWidgetDimension(raw.height, 100, 1400),
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
  let widget = buildWidgetPayload(config, widgetId);
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.widgets) ? fm.widgets : [];
    const idx = existing.findIndex(item => item?.id === widgetId);
    if (idx === -1) {
      fm.widgets = [...existing, widget];
    } else {
      const prev = existing[idx] || {};
      widget = {
        ...widget,
        width: config.width !== undefined
          ? normalizeWidgetDimension(config.width, 180, 1800)
          : normalizeWidgetDimension(prev.width, 180, 1800),
        height: config.height !== undefined
          ? normalizeWidgetDimension(config.height, 100, 1400)
          : normalizeWidgetDimension(prev.height, 100, 1400),
      };
      fm.widgets = existing.map((item, i) => (i === idx ? widget : item));
    }
  });
  return widget;
}

async function resizeWidget(app, file, widgetId, { width, height }) {
  let updated = null;
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.widgets) ? [...fm.widgets] : [];
    const idx = existing.findIndex(item => item?.id === widgetId);
    if (idx === -1) return;
    const prev = existing[idx] || {};
    updated = {
      ...prev,
      width: width !== undefined
        ? normalizeWidgetDimension(width, 180, 1800)
        : normalizeWidgetDimension(prev.width, 180, 1800),
      height: height !== undefined
        ? normalizeWidgetDimension(height, 100, 1400)
        : normalizeWidgetDimension(prev.height, 100, 1400),
    };
    existing[idx] = updated;
    fm.widgets = existing;
  });
  return updated;
}

async function removeWidget(app, file, widgetId) {
  await app.fileManager.processFrontMatter(file, fm => {
    fm.widgets = Array.isArray(fm.widgets)
      ? fm.widgets.filter(item => item?.id !== widgetId)
      : [];
  });
}

async function moveWidget(app, file, widgetId, direction) {
  let moved = false;
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.widgets) ? [...fm.widgets] : [];
    const idx = existing.findIndex(item => item?.id === widgetId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= existing.length) return;
    const temp = existing[idx];
    existing[idx] = existing[targetIdx];
    existing[targetIdx] = temp;
    fm.widgets = existing;
    moved = true;
  });
  return moved;
}

async function duplicateWidget(app, file, widgetId) {
  let cloned = null;
  await app.fileManager.processFrontMatter(file, fm => {
    const existing = Array.isArray(fm.widgets) ? [...fm.widgets] : [];
    const idx = existing.findIndex(item => item?.id === widgetId);
    if (idx === -1) return;
    const orig = existing[idx];
    const baseTitle = typeof orig.title === 'string' && orig.title.trim() ? orig.title.trim() : 'Widget';
    cloned = JSON.parse(JSON.stringify(orig));
    cloned.id = generateId('w');
    cloned.title = `${baseTitle} (copy)`;
    existing.splice(idx + 1, 0, cloned);
    fm.widgets = existing;
  });
  return cloned;
}

function buildSmartWidgetSuggestions(app, doc) {
  if (!doc) return [];
  const existing = Array.isArray(doc.widgets) ? doc.widgets : [];
  const hasMatch = (type, datasetId, aggOrMode, metricKey) =>
    existing.some(w => {
      if (w.type !== type) return false;
      if (datasetId && w.datasetId !== datasetId) return false;
      if (aggOrMode && w.agg !== aggOrMode && w.mode !== aggOrMode) return false;
      if (metricKey && (w.metricKey || '') !== metricKey) return false;
      return true;
    });

  const suggestions = [];

  if (doc.kind === 'habit' && !existing.some(w => w.type === 'streak')) {
    suggestions.push({
      label: '+ Habit Streak',
      icon: 'flame',
      config: { title: 'Streak', type: 'streak' },
    });
  }

  for (const ds of doc.datasets || []) {
    if (ds.type === 'number_time') {
      if (!hasMatch('stat', ds.id, 'sum', '')) {
        suggestions.push({
          label: `+ Sum of ${ds.name}`,
          icon: 'sigma',
          config: { title: `Total ${ds.name}`, type: 'stat', datasetId: ds.id, agg: 'sum', unit: ds.unit || '' },
        });
      }
      if (!hasMatch('goal_bar', ds.id, 'progress', '')) {
        suggestions.push({
          label: `+ ${ds.name} Progress Bar`,
          icon: 'bar-chart-horizontal',
          config: { title: `${ds.name} Progress`, type: 'goal_bar', datasetId: ds.id, mode: 'progress', unit: ds.unit || '' },
        });
      }
      if (!hasMatch('chart', ds.id, '', '')) {
        suggestions.push({
          label: `+ ${ds.name} Time Graph`,
          icon: 'trending-up',
          config: { title: `${ds.name} Over Time`, type: 'chart', datasetId: ds.id, variant: 'line', unit: ds.unit || '' },
        });
      }
    } else if (ds.type === 'note' || ds.type === 'note_time') {
      if (!hasMatch('note_navigator', ds.id, '', '')) {
        suggestions.push({
          label: `+ ${ds.name} Navigator`,
          icon: 'folder-open',
          config: { title: ds.name, type: 'note_navigator', datasetId: ds.id, metricKey: ds.metricKeys?.[0] || '' },
        });
      }
      for (const key of ds.metricKeys || []) {
        if (!hasMatch('stat', ds.id, 'sum', key)) {
          suggestions.push({
            label: `+ Sum "${key}" (${ds.name})`,
            icon: 'sigma',
            config: { title: `Total ${key}`, type: 'stat', datasetId: ds.id, agg: 'sum', metricKey: key },
          });
        }
      }
    } else if (ds.type === 'text') {
      if (!hasMatch('stat', ds.id, 'count', '')) {
        suggestions.push({
          label: `+ Count ${ds.name}`,
          icon: 'hash',
          config: { title: `${ds.name} Count`, type: 'stat', datasetId: ds.id, agg: 'count', unit: ds.unit || '' },
        });
      }
    } else if (ds.type === 'rollup') {
      if (!hasMatch('stat', ds.id, 'sum', '')) {
        suggestions.push({
          label: `+ Sum ${ds.name}`,
          icon: 'git-merge',
          config: { title: ds.name, type: 'stat', datasetId: ds.id, agg: 'sum', unit: ds.unit || '' },
        });
      }
    }
  }

  if ((doc.kind === 'tree' || doc.kind === 'garden') && doc.treePath) {
    const scopeLabel = doc.kind === 'garden' ? 'Garden' : 'Tree';
    const habitsInScope = discoverHabits(app, doc.treePath);
    if (habitsInScope.length > 0) {
      const hasHabitsTodayNav = existing.some(
        w => (w.type === 'note_navigator' && (w.relation?.dataFilter === 'habits_today' || w.relation?.dataFilter === 'habits_pending')) ||
          (w.title || '').toLowerCase() === 'habits for today' ||
          (w.type === 'pipeline' && JSON.stringify(w.pipeline || {}).includes('habits_today')),
      );
      if (!hasHabitsTodayNav) {
        suggestions.unshift({
          label: '+ Habits for Today',
          icon: 'droplet',
          config: {
            title: 'Habits for Today',
            type: 'note_navigator',
            relation: { mode: 'query', childKinds: 'habits', dataFilter: 'habits_today', perChildAgg: 'all' },
          },
        });
      }
      const hasHabitsTodayBar = existing.some(
        w => w.type === 'goal_bar' && (w.relation?.dataFilter === 'habits_today' || w.relation?.dataFilter === 'habits_pending'),
      );
      if (!hasHabitsTodayBar) {
        suggestions.push({
          label: "+ Today's Habits Progress",
          icon: 'check-circle-2',
          config: {
            title: "Today's Habits Progress",
            type: 'goal_bar',
            mode: 'count',
            relation: { mode: 'query', childKinds: 'habits', dataFilter: 'habits_today', perChildAgg: 'all' },
          },
        });
      }
    }

    const childDs = discoverChildDatasets(app, doc.treePath);
    if (childDs.length > 0) {
      const hasTreeTotal = existing.some(w => w.type === 'stat' && w.relation && !w.metricKey && w.relation.dataFilter === 'numeric');
      if (!hasTreeTotal) {
        suggestions.push({
          label: `+ Sum All ${scopeLabel === 'Garden' ? 'Garden' : 'Child'} Counters`,
          icon: 'git-merge',
          config: {
            title: `${scopeLabel} Total`,
            type: 'stat',
            agg: 'sum',
            relation: { mode: 'query', childKinds: 'all', dataFilter: 'numeric', perChildAgg: 'all' },
          },
        });
      }
      const childKeys = new Set();
      for (const item of childDs) {
        for (const k of item.dataset.metricKeys || []) {
          if (k) childKeys.add(k);
        }
      }
      for (const propKey of childKeys) {
        const alreadyHasProp = existing.some(
          w => (w.metricKey === propKey || w.relation?.metricKey === propKey) ||
            (w.type === 'pipeline' && JSON.stringify(w.pipeline || {}).includes(`"${propKey}"`)),
        );
        if (!alreadyHasProp) {
          suggestions.push({
            label: `+ ${scopeLabel} "${propKey}" Sum`,
            icon: 'sparkles',
            config: {
              title: `Total ${propKey}`,
              type: 'stat',
              agg: 'sum',
              metricKey: propKey,
              relation: { mode: 'query', childKinds: 'all', dataFilter: 'numeric', perChildAgg: 'all', metricKey: propKey },
            },
          });
        }
      }
      const hasNoteChildren = childDs.some(c => c.dataset.type === 'note' || c.dataset.type === 'note_time');
      const hasTreeNav = existing.some(w => w.type === 'note_navigator' && w.relation?.dataFilter === 'note');
      if (hasNoteChildren && !hasTreeNav) {
        suggestions.push({
          label: `+ All ${scopeLabel} Notes Navigator`,
          icon: 'book-open',
          config: {
            title: `All ${scopeLabel} Notes`,
            type: 'note_navigator',
            relation: { mode: 'query', childKinds: 'all', dataFilter: 'note', perChildAgg: 'all' },
          },
        });
      }
    }
  }

  return suggestions.slice(0, 6);
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
  normalizeAutoQuery,
  describeAutoQuery,
  discoverVaultFolders,
  discoverAutoQueryNotes,
  normalizePipelineRef,
  readGoalDocument,
  discoverHabits,
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
  resizeWidget,
  removeWidget,
  moveWidget,
  duplicateWidget,
  buildSmartWidgetSuggestions,
};
