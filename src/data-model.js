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
  const entries = type === 'rollup'
    ? []
    : (Array.isArray(raw.entries) ? raw.entries.map(item => normalizeEntry(type, item)).filter(Boolean) : []);
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId('ds'),
    name,
    type,
    unit: typeof raw.unit === 'string' ? raw.unit.trim() : '',
    metricKey: typeof raw.metricKey === 'string' && raw.metricKey.trim() ? raw.metricKey.trim() : 'score',
    relation,
    entries,
  };
}

function normalizeWidget(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = normalizeWidgetType(raw.type);
  const relation = type === 'streak' ? null : normalizeRelation(raw.relation);
  const datasetId = (type === 'streak' || relation)
    ? ''
    : (typeof raw.datasetId === 'string' ? raw.datasetId.trim() : '');
  if (type !== 'streak' && !datasetId && !relation) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : generateId('w'),
    title,
    type,
    datasetId,
    relation,
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

function resolveDatasetEntries(app, dataset, sourcePath = '') {
  if (dataset?.isVirtual && Array.isArray(dataset.resolvedEntries)) {
    return dataset.resolvedEntries;
  }
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
    } else if (effectiveMetric && childDs.type === 'note_time') {
      childDs = { ...childDs, metricKey: effectiveMetric };
    }

    resolvedChildren.push(childDs);
    const childEntries = resolveDatasetEntries(app, childDs, item.filePath);
    const numericPoints = resolveNumericSeries(app, childDs, item.filePath, effectiveMetric);

    const previewAgg = relation.perChildAgg === 'all'
      ? (childDs.type === 'number_time' || childDs.type === 'note_time' ? 'sum' : 'count')
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

  return {
    id: spec?.id || '',
    name: spec?.name || describeRelation(relation, sources),
    type: effectiveType,
    unit: inferRollupUnit(resolvedChildren, explicitUnit),
    metricKey: effectiveMetric || 'score',
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

async function addDataset(app, file, { name, type, unit = '', metricKey = 'score', relation = null }) {
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
  const dataset = {
    id: generateId('ds'),
    name: cleanName,
    type: dsType,
    unit: typeof unit === 'string' ? unit.trim() : '',
    metricKey: typeof metricKey === 'string' && metricKey.trim() ? metricKey.trim() : 'score',
    relation: cleanRelation,
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

async function addWidget(app, file, { title = '', type, datasetId = '', relation = null, unit = '', agg = 'latest', mode = 'latest', target = null, variant = 'line', metricKey = '' }) {
  const wType = normalizeWidgetType(type);
  const cleanRelation = wType === 'streak' ? null : normalizeRelation(relation);
  if (cleanRelation && cleanRelation.mode === 'pick' && !cleanRelation.refs.length) {
    throw new Error('Select at least one child data list.');
  }
  const resolvedDatasetId = (wType === 'streak' || cleanRelation)
    ? ''
    : (typeof datasetId === 'string' ? datasetId.trim() : '');
  if (wType !== 'streak' && !resolvedDatasetId && !cleanRelation) {
    throw new Error('Select a data list to link this widget to.');
  }
  const widget = {
    id: generateId('w'),
    title: typeof title === 'string' ? title.trim() : '',
    type: wType,
    datasetId: resolvedDatasetId,
    relation: cleanRelation,
    unit: typeof unit === 'string' ? unit.trim() : '',
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
  RELATION_CHILD_KINDS,
  RELATION_DATA_FILTERS,
  RELATION_PER_CHILD,
  generateId,
  stripMd,
  normalizeEntry,
  normalizeRelation,
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
  removeDataset,
  addDatasetEntry,
  removeDatasetEntry,
  addWidget,
  removeWidget,
};
