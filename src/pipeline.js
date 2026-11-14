const {
  ROOT,
  isFolder,
  toDateKey,
  parseDateKey,
  periodKeyFor,
  mergeWaterDates,
} = require('./storage');
const {
  generateId,
  stripMd,
  toFiniteNumber,
  formatNumber,
  readGoalDocument,
  discoverHabits,
  discoverChildDatasets,
  datasetMatchesFilter,
  resolveDatasetEntries,
} = require('./data-model');

const PIPELINE_NODE_TYPES = [
  {
    type: 'source',
    category: 'source',
    label: 'Data Source',
    shortDesc: 'Load entries from tree children or this goal',
    hasIn: false,
    hasOut: true,
    defaultConfig: {
      scope: 'tree_children',
      childKinds: 'all',
      datasetFilter: 'any',
      datasetId: '',
      nameMatch: '',
    },
  },
  {
    type: 'water_source',
    category: 'source',
    label: 'Watering Log',
    shortDesc: 'Load habit completion dates (value = 1)',
    hasIn: false,
    hasOut: true,
    defaultConfig: {
      scope: 'tree_habits',
      nameMatch: '',
    },
  },
  {
    type: 'filter',
    category: 'filter',
    label: 'Filter',
    shortDesc: 'Keep items matching custom rules or properties',
    hasIn: true,
    hasOut: true,
    defaultConfig: {
      match: 'all',
      rules: [{ field: 'datasetName', op: 'contains', value: '' }],
    },
  },
  {
    type: 'extract',
    category: 'transform',
    label: 'Pick Field',
    shortDesc: 'Extract a frontmatter property or metric as the value',
    hasIn: true,
    hasOut: true,
    defaultConfig: {
      field: 'pages',
      fallbackToValue: true,
      dropMissing: true,
      unit: '',
    },
  },
  {
    type: 'math',
    category: 'transform',
    label: 'Math',
    shortDesc: 'Transform each numeric value (+, -, ×, ÷, round)',
    hasIn: true,
    hasOut: true,
    defaultConfig: {
      op: 'multiply',
      operand: 1,
      unit: '',
    },
  },
  {
    type: 'group',
    category: 'transform',
    label: 'Group & Summarize',
    shortDesc: 'Aggregate values by child, list, period, or property',
    hasIn: true,
    hasOut: true,
    defaultConfig: {
      by: 'sourceTitle',
      propKey: '',
      agg: 'sum',
    },
  },
  {
    type: 'sort',
    category: 'transform',
    label: 'Sort & Limit',
    shortDesc: 'Order items and optionally cap count',
    hasIn: true,
    hasOut: true,
    defaultConfig: {
      by: 'date_asc',
      limit: 0,
    },
  },
  {
    type: 'merge',
    category: 'transform',
    label: 'Merge',
    shortDesc: 'Combine multiple parallel branches',
    hasIn: true,
    hasOut: true,
    defaultConfig: {
      dedupe: 'none',
    },
  },
  {
    type: 'output',
    category: 'output',
    label: 'Widget Output',
    shortDesc: 'Render final result as Stat, Bar, Graph, or Note List',
    hasIn: true,
    hasOut: false,
    defaultConfig: {
      displayType: 'stat',
      agg: 'sum',
      mode: 'sum',
      target: 100,
      variant: 'bar',
      unit: '',
    },
  },
];

const NODE_DEF_MAP = Object.fromEntries(PIPELINE_NODE_TYPES.map(d => [d.type, d]));

const FILTER_FIELD_PRESETS = [
  { id: 'appearDate', label: 'Habit appear date (YYYY-MM-DD)' },
  { id: 'dueToday', label: 'Habit due today (true / false)' },
  { id: 'pendingToday', label: 'Habit needs water today (true / false)' },
  { id: 'daysUntil', label: 'Days until habit appears (0 = today)' },
  { id: 'status', label: 'Habit status (due / watered / upcoming)' },
  { id: 'cadence', label: 'Habit cadence (Daily, Wed · Thu, ...)' },
  { id: 'streak', label: 'Habit streak (days)' },
  { id: 'treeTitle', label: 'Tree name' },
  { id: 'datasetName', label: 'Data list name' },
  { id: 'sourceTitle', label: 'Habit / Subgoal name' },
  { id: 'title', label: 'Entry / Note title' },
  { id: 'sourceKind', label: 'Child kind (habit / subgoal)' },
  { id: 'datasetType', label: 'List type (number_time / note / ...)' },
  { id: 'unit', label: 'Unit' },
  { id: 'date', label: 'Date (YYYY-MM-DD)' },
  { id: 'value', label: 'Current numeric value' },
  { id: 'path', label: 'Note path' },
];

const FILTER_OPS = [
  { id: 'is_today', label: 'is today' },
  { id: 'is_true', label: 'is true' },
  { id: 'is_false', label: 'is false' },
  { id: 'contains', label: 'contains' },
  { id: 'not_contains', label: 'does not contain' },
  { id: 'equals', label: 'equals' },
  { id: 'not_equals', label: 'not equal' },
  { id: 'gt', label: '>' },
  { id: 'gte', label: '>=' },
  { id: 'lt', label: '<' },
  { id: 'lte', label: '<=' },
  { id: 'exists', label: 'exists (non-empty)' },
  { id: 'is_number', label: 'is numeric' },
  { id: 'this_month', label: 'in this month' },
  { id: 'this_week', label: 'in this week' },
  { id: 'this_year', label: 'in this year' },
  { id: 'within_days', label: 'in last N days' },
  { id: 'regex', label: 'matches regex' },
];

const OPS_WITHOUT_VALUE = new Set([
  'is_today',
  'is_true',
  'is_false',
  'exists',
  'is_number',
  'this_month',
  'this_week',
  'this_year',
]);

const MATH_OPS = [
  { id: 'multiply', label: 'Multiply (×)' },
  { id: 'divide', label: 'Divide (÷)' },
  { id: 'add', label: 'Add (+)' },
  { id: 'subtract', label: 'Subtract (−)' },
  { id: 'round', label: 'Round (decimals)' },
  { id: 'abs', label: 'Absolute value' },
  { id: 'clamp_min', label: 'Minimum floor' },
  { id: 'clamp_max', label: 'Maximum cap' },
  { id: 'cumulative', label: 'Running total (cumulative)' },
  { id: 'moving_avg', label: 'Moving average (window N)' },
  { id: 'pct_of_target', label: '% of target (÷ N × 100)' },
];

const GROUP_BYS = [
  { id: 'sourceTitle', label: 'Child (Habit / Subgoal)' },
  { id: 'datasetName', label: 'Data list name' },
  { id: 'day', label: 'Day (YYYY-MM-DD)' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month (YYYY-MM)' },
  { id: 'prop', label: 'Frontmatter property' },
];

const SORT_BYS = [
  { id: 'date_asc', label: 'Date (oldest first)' },
  { id: 'date_desc', label: 'Date (newest first)' },
  { id: 'value_desc', label: 'Value (highest first)' },
  { id: 'value_asc', label: 'Value (lowest first)' },
  { id: 'label_asc', label: 'Title (A → Z)' },
];

function getNodeDef(type) {
  return NODE_DEF_MAP[type] || null;
}

function createNode(type, partial = {}) {
  const def = getNodeDef(type) || NODE_DEF_MAP.source;
  return {
    id: typeof partial.id === 'string' && partial.id.trim() ? partial.id.trim() : generateId('n'),
    type: def.type,
    label: typeof partial.label === 'string' && partial.label.trim() ? partial.label.trim() : def.label,
    x: Number.isFinite(Number(partial.x)) ? Number(partial.x) : 80,
    y: Number.isFinite(Number(partial.y)) ? Number(partial.y) : 80,
    config: {
      ...JSON.parse(JSON.stringify(def.defaultConfig)),
      ...(partial.config && typeof partial.config === 'object' ? JSON.parse(JSON.stringify(partial.config)) : {}),
    },
  };
}

function normalizePipeline(raw, doc = null) {
  const defaultScope = (doc?.kind === 'tree' || doc?.kind === 'garden') ? 'tree_children' : 'this_goal';
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes) || !raw.nodes.length) {
    const s = createNode('source', { id: 'n_src', x: 56, y: 120, config: { scope: defaultScope } });
    const o = createNode('output', { id: 'n_out', x: 356, y: 120 });
    return {
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [s, o],
      edges: [{ id: 'e_1', from: s.id, to: o.id }],
    };
  }

  const seenIds = new Set();
  const nodes = [];
  for (const rawNode of raw.nodes) {
    if (!rawNode || typeof rawNode !== 'object') continue;
    const def = getNodeDef(rawNode.type);
    if (!def) continue;
    const node = createNode(def.type, rawNode);
    if (seenIds.has(node.id)) continue;
    seenIds.add(node.id);
    if (node.type === 'filter') {
      node.config.match = node.config.match === 'any' ? 'any' : 'all';
      node.config.rules = Array.isArray(node.config.rules)
        ? node.config.rules
            .filter(r => r && typeof r === 'object')
            .map(r => ({
              field: typeof r.field === 'string' ? r.field.trim() : 'datasetName',
              op: FILTER_OPS.some(o => o.id === r.op) ? r.op : 'contains',
              value: r.value !== undefined && r.value !== null ? String(r.value) : '',
            }))
        : [];
    }
    nodes.push(node);
  }

  const edgeKeys = new Set();
  const edges = [];
  for (const rawEdge of Array.isArray(raw.edges) ? raw.edges : []) {
    if (!rawEdge || typeof rawEdge !== 'object') continue;
    const from = typeof rawEdge.from === 'string' ? rawEdge.from.trim() : '';
    const to = typeof rawEdge.to === 'string' ? rawEdge.to.trim() : '';
    if (!from || !to || from === to || !seenIds.has(from) || !seenIds.has(to)) continue;
    const fromNode = nodes.find(n => n.id === from);
    const toNode = nodes.find(n => n.id === to);
    if (!getNodeDef(fromNode?.type)?.hasOut || !getNodeDef(toNode?.type)?.hasIn) continue;
    const key = `${from}->${to}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({
      id: typeof rawEdge.id === 'string' && rawEdge.id.trim() ? rawEdge.id.trim() : generateId('e'),
      from,
      to,
    });
  }

  return {
    version: 1,
    zoom: Number.isFinite(Number(raw.zoom)) ? Math.max(0.45, Math.min(1.6, Number(raw.zoom))) : 1,
    panX: Number.isFinite(Number(raw.panX)) ? Number(raw.panX) : 0,
    panY: Number.isFinite(Number(raw.panY)) ? Number(raw.panY) : 0,
    nodes,
    edges,
  };
}

function autoLayoutPipeline(pipeline) {
  const nodes = pipeline.nodes.map(n => ({ ...n, config: { ...n.config } }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const incoming = new Map(nodes.map(n => [n.id, []]));
  const outgoing = new Map(nodes.map(n => [n.id, []]));

  for (const edge of pipeline.edges) {
    if (incoming.has(edge.to) && outgoing.has(edge.from)) {
      incoming.get(edge.to).push(edge.from);
      outgoing.get(edge.from).push(edge.to);
    }
  }

  const depth = new Map();
  const queue = [];
  for (const node of nodes) {
    if (!incoming.get(node.id).length) {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  }
  const visited = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const d = depth.get(id) ?? 0;
    for (const nextId of outgoing.get(id) || []) {
      const nextDepth = Math.max(depth.get(nextId) ?? 0, d + 1);
      depth.set(nextId, nextDepth);
      queue.push(nextId);
    }
  }

  for (const node of nodes) {
    if (!depth.has(node.id)) {
      depth.set(node.id, node.type === 'output' ? 2 : 0);
    }
  }

  const columns = new Map();
  for (const node of nodes) {
    const col = depth.get(node.id) ?? 0;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col).push(node);
  }

  const sortedCols = [...columns.keys()].sort((a, b) => a - b);
  for (const col of sortedCols) {
    const list = columns.get(col);
    list.sort((a, b) => a.y - b.y);
    list.forEach((node, rowIdx) => {
      const target = byId.get(node.id);
      target.x = 56 + col * 268;
      target.y = 64 + rowIdx * 136;
    });
  }

  return {
    ...pipeline,
    panX: 0,
    panY: 0,
    nodes,
  };
}

function collectCanvasContext(app, doc) {
  const isTreeOrGarden = doc?.kind === 'tree' || doc?.kind === 'garden';
  const localDatasets = Array.isArray(doc?.datasets) ? doc.datasets : [];
  const childDatasets = isTreeOrGarden && doc?.treePath
    ? discoverChildDatasets(app, doc.treePath)
    : [];
  const habitsInScope = (isTreeOrGarden && doc?.treePath)
    ? discoverHabits(app, doc.treePath)
    : (doc?.kind === 'habit' && doc?.file?.path ? discoverHabits(app, doc.file.path) : []);

  const fieldSet = new Set();
  const datasetNameSet = new Set();
  const childTitleSet = new Set();

  if (habitsInScope.length > 0) {
    for (const hKey of ['appearDate', 'dueToday', 'pendingToday', 'daysUntil', 'status', 'cadence', 'streak', 'treeTitle']) {
      fieldSet.add(hKey);
    }
    for (const h of habitsInScope) {
      if (h.label) childTitleSet.add(h.label);
    }
  }

  const inspectDatasets = (list, filePath) => {
    for (const ds of list) {
      if (!ds) continue;
      if (ds.name) datasetNameSet.add(ds.name);
      for (const k of ds.metricKeys || []) {
        if (k) fieldSet.add(k);
      }
      if (ds.type === 'note' || ds.type === 'note_time') {
        const entries = resolveDatasetEntries(app, ds, filePath);
        for (const entry of entries) {
          for (const fk of Object.keys(entry.fields || {})) {
            if (fk && fk !== 'title' && fk !== 'type' && fk !== 'tags') fieldSet.add(fk);
          }
        }
      }
    }
  };

  inspectDatasets(localDatasets, doc?.file?.path || '');
  for (const item of childDatasets) {
    if (item.childTitle) childTitleSet.add(item.childTitle);
    inspectDatasets([item.dataset], item.filePath);
  }

  return {
    localDatasets,
    childDatasets,
    habitsInScope,
    fieldNames: [...fieldSet].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    datasetNames: [...datasetNameSet].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    childTitles: [...childTitleSet].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
  };
}

function lookupFieldValue(fields, key) {
  if (!fields || typeof fields !== 'object' || !key) return undefined;
  if (Object.prototype.hasOwnProperty.call(fields, key)) return fields[key];
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(fields)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function readItemField(item, field) {
  if (!field) return undefined;
  if (field === 'datasetName') return item.datasetName;
  if (field === 'sourceTitle') return item.sourceTitle;
  if (field === 'sourceKind') return item.sourceKind;
  if (field === 'datasetType') return item.datasetType;
  if (field === 'title' || field === 'label') return item.label;
  if (field === 'unit') return item.unit;
  if (field === 'date') return item.date;
  if (field === 'appearDate') return item.schedule?.appearDate ?? lookupFieldValue(item.fields, 'appearDate') ?? item.date;
  if (field === 'nextAppearDate') return item.schedule?.nextAppearDate ?? lookupFieldValue(item.fields, 'nextAppearDate');
  if (field === 'dueToday') return item.schedule?.dueToday ?? lookupFieldValue(item.fields, 'dueToday');
  if (field === 'pendingToday') return item.schedule?.pendingToday ?? lookupFieldValue(item.fields, 'pendingToday');
  if (field === 'daysUntil') return item.schedule?.daysUntil ?? lookupFieldValue(item.fields, 'daysUntil');
  if (field === 'status') return item.schedule?.status ?? lookupFieldValue(item.fields, 'status');
  if (field === 'cadence') return item.schedule?.cadenceLabel ?? lookupFieldValue(item.fields, 'cadence');
  if (field === 'streak') return item.schedule?.streak ?? lookupFieldValue(item.fields, 'streak');
  if (field === 'treeTitle' || field === 'tree') return item.treeTitle ?? lookupFieldValue(item.fields, 'treeTitle');
  if (field === 'value') return item.value;
  if (field === 'path') return item.path;
  if (field.startsWith('prop:')) {
    const k = field.slice(5).trim();
    return lookupFieldValue(item.fields, k);
  }
  return lookupFieldValue(item.fields, field);
}

function ruleMatchesItem(item, rule, now = new Date()) {
  const rawField = typeof rule.field === 'string' ? rule.field.trim() : '';
  if (!rawField) return true;
  const val = readItemField(item, rawField);
  const op = rule.op || 'contains';
  const targetStr = rule.value !== undefined && rule.value !== null ? String(rule.value).trim() : '';

  if (op === 'is_today') {
    if (val === true) return true;
    if (val === false) return false;
    const rawDate = typeof val === 'string' && val.trim() ? val.trim() : (item.date || '');
    return Boolean(rawDate && rawDate === toDateKey(now));
  }
  if (op === 'is_true') {
    return val === true || String(val).trim().toLowerCase() === 'true' || val === 1;
  }
  if (op === 'is_false') {
    return val === false || String(val).trim().toLowerCase() === 'false' || val === 0 || val === null || val === undefined;
  }
  if (op === 'exists') {
    return val !== undefined && val !== null && String(val).trim() !== '';
  }
  if (op === 'is_number') {
    return toFiniteNumber(val) !== null;
  }
  if (op === 'this_month') {
    const itemMonth = periodKeyFor(typeof val === 'string' ? val : item.date, 'monthly');
    const curMonth = periodKeyFor(toDateKey(now), 'monthly');
    return Boolean(itemMonth && itemMonth === curMonth);
  }
  if (op === 'this_week') {
    const itemWeek = periodKeyFor(typeof val === 'string' ? val : item.date, 'weekly');
    const curWeek = periodKeyFor(toDateKey(now), 'weekly');
    return Boolean(itemWeek && itemWeek === curWeek);
  }
  if (op === 'this_year') {
    const rawDate = typeof val === 'string' ? val : (item.date || '');
    const curYear = toDateKey(now).slice(0, 4);
    return Boolean(rawDate && rawDate.slice(0, 4) === curYear);
  }
  if (op === 'within_days') {
    const days = toFiniteNumber(targetStr);
    const parsedItem = parseDateKey(typeof val === 'string' ? val : item.date);
    const parsedToday = parseDateKey(toDateKey(now));
    if (days === null || !parsedItem || !parsedToday) return false;
    const diff = Math.round((parsedToday.getTime() - parsedItem.getTime()) / 86400000);
    return diff >= 0 && diff <= days;
  }
  if (op === 'regex') {
    if (!targetStr) return true;
    try {
      const re = new RegExp(targetStr, 'i');
      return re.test(val !== undefined && val !== null ? String(val) : '');
    } catch {
      return false;
    }
  }

  const valNum = toFiniteNumber(val);
  const targetNum = toFiniteNumber(targetStr);
  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
    if (valNum === null || targetNum === null) return false;
    if (op === 'gt') return valNum > targetNum;
    if (op === 'gte') return valNum >= targetNum;
    if (op === 'lt') return valNum < targetNum;
    return valNum <= targetNum;
  }

  if (op === 'equals' || op === 'not_equals') {
    let isEqual = false;
    if (valNum !== null && targetNum !== null) {
      isEqual = valNum === targetNum;
    } else if (val !== undefined && val !== null) {
      isEqual = String(val).trim().toLowerCase() === targetStr.toLowerCase();
    } else {
      isEqual = targetStr === '';
    }
    return op === 'equals' ? isEqual : !isEqual;
  }

  const hay = val !== undefined && val !== null ? String(val).toLowerCase() : '';
  const needle = targetStr.toLowerCase();
  if (!needle) return true;
  if (op === 'not_contains') return !hay.includes(needle);
  return hay.includes(needle);
}

function collectSourceDatasetItems(app, ds, ownerFile, ownerTitle, ownerKind, out) {
  const entries = resolveDatasetEntries(app, ds, ownerFile?.path || '');
  for (const entry of entries) {
    out.push({
      id: `${ownerFile?.path || ''}::${ds.id}::${entry.index}`,
      index: out.length,
      label: entry.label || ownerTitle,
      date: entry.date || null,
      value: entry.value !== undefined ? entry.value : null,
      unit: ds.unit || '',
      noteFile: entry.noteFile || null,
      path: entry.path || '',
      sourceFile: entry.sourceFile || ownerFile || null,
      sourceTitle: entry.sourceTitle || ownerTitle || '',
      sourceKind: entry.childKind || ownerKind || 'goal',
      datasetId: ds.id,
      datasetName: entry.datasetName || ds.name,
      datasetType: ds.type,
      fields: entry.fields || {},
      propsList: entry.propsList || [],
    });
  }
}

function evalSourceNode(app, node, doc, now = new Date(), autoIncludeHabits = false) {
  const cfg = node.config || {};
  const isTreeOrGarden = doc?.kind === 'tree' || doc?.kind === 'garden';
  const scope = cfg.scope || (isTreeOrGarden ? 'tree_children' : 'this_goal');
  const childKinds = cfg.childKinds || 'all';
  const dsFilter = cfg.datasetFilter || 'any';
  const nameNeedle = typeof cfg.nameMatch === 'string' ? cfg.nameMatch.trim().toLowerCase() : '';
  const targetDsId = typeof cfg.datasetId === 'string' ? cfg.datasetId.trim() : '';

  const items = [];
  const isExplicitHabitFilter =
    dsFilter === 'habits' ||
    dsFilter === 'habits_today' ||
    dsFilter === 'habits_pending' ||
    dsFilter === 'habits_all';

  if (isExplicitHabitFilter || (!targetDsId && dsFilter === 'any' && autoIncludeHabits && childKinds !== 'subgoals')) {
    const habitScopePath = scope === 'this_goal' && doc?.kind === 'habit' && doc.file?.path
      ? doc.file.path
      : (doc?.treePath || ROOT);
    const habitItems = discoverHabits(app, habitScopePath, now);
    for (const h of habitItems) {
      if (dsFilter === 'habits_today' && !h.schedule.dueToday) continue;
      if (dsFilter === 'habits_pending' && !h.schedule.pendingToday) continue;
      if (nameNeedle) {
        const hitName = h.label.toLowerCase().includes(nameNeedle);
        const hitTree = (h.treeTitle || '').toLowerCase().includes(nameNeedle);
        const hitCadence = (h.schedule.cadenceLabel || '').toLowerCase().includes(nameNeedle);
        if (!hitName && !hitTree && !hitCadence) continue;
      }
      items.push({
        ...h,
        id: `habit::${h.path}`,
        index: items.length,
      });
    }
    if (isExplicitHabitFilter) {
      return items;
    }
  }

  if ((scope === 'this_goal' || scope === 'both') && doc) {
    for (const ds of doc.datasets || []) {
      if (targetDsId && ds.id !== targetDsId) continue;
      if (!targetDsId && !datasetMatchesFilter(ds, dsFilter)) continue;
      if (nameNeedle) {
        const dMatch = (ds.name || '').toLowerCase().includes(nameNeedle);
        const tMatch = (doc.title || '').toLowerCase().includes(nameNeedle);
        if (!dMatch && !tMatch) continue;
      }
      collectSourceDatasetItems(app, ds, doc.file, doc.title, doc.kind, items);
    }
  }

  if ((scope === 'tree_children' || scope === 'both') && doc?.treePath) {
    const discovered = discoverChildDatasets(app, doc.treePath);
    for (const child of discovered) {
      if (targetDsId && child.dataset.id !== targetDsId) continue;
      if (childKinds === 'habits' && child.childKind !== 'habit') continue;
      if (childKinds === 'subgoals' && child.childKind !== 'subgoal') continue;
      if (!targetDsId && !datasetMatchesFilter(child.dataset, dsFilter)) continue;
      if (nameNeedle) {
        const dMatch = (child.dataset.name || '').toLowerCase().includes(nameNeedle);
        const cMatch = (child.childTitle || '').toLowerCase().includes(nameNeedle);
        if (!dMatch && !cMatch) continue;
      }
      collectSourceDatasetItems(app, child.dataset, child.file, child.childTitle, child.childKind, items);
    }
  }

  return items;
}

function collectMarkdownFilesRecursive(folder, acc = []) {
  if (!isFolder(folder)) return acc;
  for (const child of folder.children) {
    if (!child?.name || child.name.startsWith('.') || child.name.startsWith('_')) continue;
    if (isFolder(child)) collectMarkdownFilesRecursive(child, acc);
    else if (child.extension === 'md') acc.push(child);
  }
  return acc;
}

function evalWaterSourceNode(app, node, doc) {
  const cfg = node.config || {};
  const scope = cfg.scope || (doc?.kind === 'habit' ? 'this_habit' : 'tree_habits');
  const needle = typeof cfg.nameMatch === 'string' ? cfg.nameMatch.trim().toLowerCase() : '';
  const files = [];

  if (scope === 'this_habit' && doc?.kind === 'habit' && doc.file) {
    files.push(doc.file);
  } else if (doc?.treePath) {
    const folder = app.vault.getAbstractFileByPath(doc.treePath);
    for (const f of collectMarkdownFilesRecursive(folder, [])) {
      if (f.path.includes('/habits/')) files.push(f);
    }
  }

  const items = [];
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const title = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : stripMd(file.name);
    if (needle && !title.toLowerCase().includes(needle)) continue;
    const dates = mergeWaterDates(fm.water_log, fm.last_watered);
    for (const date of dates) {
      items.push({
        id: `water::${file.path}::${date}`,
        index: items.length,
        label: title,
        date,
        value: 1,
        unit: 'waterings',
        noteFile: null,
        path: '',
        sourceFile: file,
        sourceTitle: title,
        sourceKind: 'habit',
        datasetId: '__water_log',
        datasetName: 'Watering log',
        datasetType: 'water_log',
        fields: { date, value: 1, sourceTitle: title, sourceKind: 'habit' },
        propsList: [],
      });
    }
  }
  return items;
}

function evalExtractNode(items, cfg) {
  const field = typeof cfg.field === 'string' ? cfg.field.trim() : '';
  const fallback = Boolean(cfg.fallbackToValue);
  const dropMissing = cfg.dropMissing !== false;
  const unitOverride = typeof cfg.unit === 'string' ? cfg.unit.trim() : '';
  const out = [];

  for (const item of items) {
    let extracted = null;
    if (field === '1' || field === '__count_1') {
      extracted = 1;
    } else if (!field || field === 'value') {
      extracted = toFiniteNumber(item.value);
    } else {
      const raw = readItemField(item, field);
      extracted = toFiniteNumber(raw);
      if (extracted === null && fallback) {
        extracted = toFiniteNumber(item.value);
      }
    }

    if (extracted === null && dropMissing) continue;
    out.push({
      ...item,
      index: out.length,
      value: extracted,
      unit: unitOverride || item.unit,
    });
  }
  return out;
}

function evalMathNode(items, cfg) {
  const op = cfg.op || 'multiply';
  const operand = toFiniteNumber(cfg.operand);
  const n = operand === null ? 1 : operand;
  const unitOverride = typeof cfg.unit === 'string' ? cfg.unit.trim() : '';
  const out = [];
  let runningSum = 0;
  const windowVals = [];
  const winSize = Math.max(2, Math.round(n || 3));

  for (const item of items) {
    const v = toFiniteNumber(item.value);
    if (v === null) {
      out.push({ ...item, index: out.length });
      continue;
    }
    let next = v;
    if (op === 'multiply') next = v * n;
    else if (op === 'divide') next = n !== 0 ? v / n : v;
    else if (op === 'add') next = v + n;
    else if (op === 'subtract') next = v - n;
    else if (op === 'round') {
      const factor = 10 ** Math.max(0, Math.min(4, Math.round(n)));
      next = Math.round(v * factor) / factor;
    } else if (op === 'abs') next = Math.abs(v);
    else if (op === 'clamp_min') next = Math.max(n, v);
    else if (op === 'clamp_max') next = Math.min(n, v);
    else if (op === 'cumulative') {
      runningSum += v;
      next = runningSum;
    } else if (op === 'moving_avg') {
      windowVals.push(v);
      if (windowVals.length > winSize) windowVals.shift();
      const sum = windowVals.reduce((a, b) => a + b, 0);
      next = Math.round((sum / windowVals.length) * 100) / 100;
    } else if (op === 'pct_of_target') {
      const denom = n !== 0 ? n : 100;
      next = Math.round((v / denom) * 1000) / 10;
    }

    const defaultUnit = op === 'pct_of_target' && !unitOverride ? '%' : (unitOverride || item.unit);
    out.push({
      ...item,
      index: out.length,
      value: next,
      unit: defaultUnit,
    });
  }
  return out;
}

function aggregateNumericList(items, agg) {
  if (agg === 'count') return items.length;
  const nums = items
    .map(i => toFiniteNumber(i.value))
    .filter(v => v !== null);
  if (!nums.length) return null;
  if (agg === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (agg === 'average') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (agg === 'max') return Math.max(...nums);
  if (agg === 'min') return Math.min(...nums);
  if (agg === 'latest') {
    const dated = items
      .filter(i => toFiniteNumber(i.value) !== null)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.index - b.index);
    return dated.length ? toFiniteNumber(dated[dated.length - 1].value) : nums[nums.length - 1];
  }
  return nums.reduce((a, b) => a + b, 0);
}

function evalGroupNode(items, cfg) {
  const by = cfg.by || 'sourceTitle';
  const agg = cfg.agg || 'sum';
  const propKey = typeof cfg.propKey === 'string' ? cfg.propKey.trim() : '';

  const groups = new Map();
  for (const item of items) {
    let key = '';
    if (by === 'sourceTitle') key = item.sourceTitle || item.label || 'Unknown';
    else if (by === 'datasetName') key = item.datasetName || 'List';
    else if (by === 'day') key = parseDateKey(item.date) ? item.date : 'Undated';
    else if (by === 'week') key = periodKeyFor(item.date, 'weekly') || 'Undated';
    else if (by === 'month') key = periodKeyFor(item.date, 'monthly') || 'Undated';
    else if (by === 'prop') {
      const v = propKey ? readItemField(item, propKey) : '';
      key = v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : '(none)';
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const out = [];
  for (const [key, list] of groups.entries()) {
    const value = aggregateNumericList(list, agg);
    if (value === null) continue;
    const units = new Set(list.map(i => i.unit).filter(Boolean));
    const unit = agg === 'count' ? '' : (units.size === 1 ? [...units][0] : '');
    const latestDate = list
      .map(i => i.date || '')
      .filter(Boolean)
      .sort()
      .pop() || (by === 'day' && parseDateKey(key) ? key : null);

    out.push({
      id: `grp::${key}`,
      index: out.length,
      label: key,
      date: latestDate,
      value,
      unit,
      noteFile: null,
      path: '',
      sourceFile: list[0]?.sourceFile || null,
      sourceTitle: key,
      sourceKind: 'group',
      datasetName: list[0]?.datasetName || '',
      datasetType: 'group',
      fields: { group: key, count: list.length, value },
      propsList: [],
    });
  }

  if (by === 'day' || by === 'week' || by === 'month') {
    out.sort((a, b) => a.label.localeCompare(b.label));
  }
  return out;
}

function evalSortNode(items, cfg) {
  const by = cfg.by || 'date_asc';
  const limit = Number(cfg.limit) || 0;
  const sorted = [...items];

  if (by === 'date_asc') {
    sorted.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.index - b.index);
  } else if (by === 'date_desc') {
    sorted.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.index - a.index);
  } else if (by === 'value_desc') {
    sorted.sort((a, b) => (toFiniteNumber(b.value) ?? -Infinity) - (toFiniteNumber(a.value) ?? -Infinity));
  } else if (by === 'value_asc') {
    sorted.sort((a, b) => (toFiniteNumber(a.value) ?? Infinity) - (toFiniteNumber(b.value) ?? Infinity));
  } else if (by === 'label_asc') {
    sorted.sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }));
  }

  const sliced = limit > 0 ? sorted.slice(0, Math.round(limit)) : sorted;
  return sliced.map((item, idx) => ({ ...item, index: idx }));
}

function evalMergeNode(branches, cfg) {
  const dedupe = cfg.dedupe || 'none';
  const combined = [];
  const seen = new Set();

  for (const list of branches) {
    for (const item of list) {
      if (dedupe === 'path' && item.path) {
        if (seen.has(item.path)) continue;
        seen.add(item.path);
      } else if (dedupe === 'id' && item.id) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
      }
      combined.push({ ...item, index: combined.length });
    }
  }
  return combined;
}

function inferItemsUnit(items, explicitUnit = '') {
  if (typeof explicitUnit === 'string' && explicitUnit.trim()) return explicitUnit.trim();
  const units = new Set(items.map(i => (typeof i.unit === 'string' ? i.unit.trim() : '')).filter(Boolean));
  return units.size === 1 ? [...units][0] : '';
}

function buildOutputPayload(items, cfg = {}) {
  const displayType = ['stat', 'goal_bar', 'chart', 'note_navigator'].includes(cfg.displayType)
    ? cfg.displayType
    : 'stat';
  const agg = cfg.agg || 'sum';
  const mode = cfg.mode || 'sum';
  const unit = inferItemsUnit(items, cfg.unit || '');

  const numericPoints = items
    .map((item, idx) => ({ ...item, index: idx, value: toFiniteNumber(item.value) }))
    .filter(item => item.value !== null && Number.isFinite(item.value));

  const effectiveStatAgg = displayType === 'goal_bar' ? mode : agg;
  let statValue = null;
  if (effectiveStatAgg === 'count') {
    statValue = items.length;
  } else {
    statValue = aggregateNumericList(numericPoints, effectiveStatAgg);
  }

  const effectiveUnit = effectiveStatAgg === 'count' ? '' : unit;
  const statCount = effectiveStatAgg === 'count' ? items.length : numericPoints.length;
  const stat = {
    value: statValue,
    display: statValue === null ? '—' : formatNumber(statValue),
    unit: effectiveUnit,
    count: statCount,
  };

  const targetNum = toFiniteNumber(cfg.target);
  const isAllHabitSchedule = items.length > 0 && items.every(i => i.datasetType === 'habit_schedule');
  let barCurrent = statValue;
  let barTarget = targetNum;
  if (isAllHabitSchedule && (barTarget === null || barTarget <= 0)) {
    barTarget = items.length;
    barCurrent = items.filter(i => Boolean(i.schedule?.wateredToday || i.schedule?.wateredInPeriod)).length;
  }
  const current = barCurrent ?? 0;
  const ratio = barTarget && barTarget > 0 ? current / barTarget : 0;
  const rawPercent = barTarget && barTarget > 0 ? Math.round(ratio * 100) : 0;
  const bar = {
    current: barCurrent,
    currentDisplay: barCurrent === null ? '—' : formatNumber(barCurrent),
    target: barTarget,
    targetDisplay: barTarget === null ? '—' : formatNumber(barTarget),
    rawPercent,
    fillPercent: Math.max(0, Math.min(100, rawPercent)),
    unit: isAllHabitSchedule ? (unit || 'habits') : (mode === 'count' ? '' : unit),
  };

  const chartPoints = numericPoints.some(p => Boolean(p.date))
    ? [...numericPoints].sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.index - b.index)
    : numericPoints;

  return {
    displayType,
    agg,
    mode,
    target: barTarget,
    variant: cfg.variant === 'bar' ? 'bar' : 'line',
    unit,
    stat,
    bar,
    points: chartPoints,
    entries: items,
  };
}

const HABIT_SCHEDULE_FIELDS = new Set([
  'appeardate',
  'nextappeardate',
  'duetoday',
  'pendingtoday',
  'wateredtoday',
  'daysuntil',
  'status',
  'cadence',
  'streak',
  'appearlabel',
]);

function pipelineReferencesHabitFields(pipeline) {
  for (const node of pipeline.nodes || []) {
    if (node.type === 'filter') {
      for (const r of node.config?.rules || []) {
        const f = String(r.field || '').trim().toLowerCase();
        if (HABIT_SCHEDULE_FIELDS.has(f)) return true;
      }
    } else if (node.type === 'extract') {
      const f = String(node.config?.field || '').trim().toLowerCase();
      if (HABIT_SCHEDULE_FIELDS.has(f)) return true;
    } else if (node.type === 'group') {
      const f = String(node.config?.propKey || '').trim().toLowerCase();
      if (HABIT_SCHEDULE_FIELDS.has(f)) return true;
    }
  }
  return false;
}

function evaluatePipeline(app, rawPipeline, doc, now = new Date()) {
  const pipeline = normalizePipeline(rawPipeline, doc);
  const autoIncludeHabits = pipelineReferencesHabitFields(pipeline);
  const byId = new Map(pipeline.nodes.map(n => [n.id, n]));
  const inEdges = new Map(pipeline.nodes.map(n => [n.id, []]));
  const outEdges = new Map(pipeline.nodes.map(n => [n.id, []]));

  for (const edge of pipeline.edges) {
    if (inEdges.has(edge.to) && outEdges.has(edge.from)) {
      inEdges.get(edge.to).push(edge.from);
      outEdges.get(edge.from).push(edge.to);
    }
  }

  // Kahn's topological sort; disconnected/cycle nodes still degrade safely without throwing
  const inDegree = new Map(pipeline.nodes.map(n => [n.id, inEdges.get(n.id).length]));
  const queue = pipeline.nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
  const order = [];
  const seen = new Set();

  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const nextId of outEdges.get(id) || []) {
      const deg = (inDegree.get(nextId) ?? 1) - 1;
      inDegree.set(nextId, deg);
      if (deg <= 0) queue.push(nextId);
    }
  }
  for (const node of pipeline.nodes) {
    if (!seen.has(node.id)) order.push(node.id);
  }

  const nodeResults = new Map();
  let lastOutputPayload = null;
  let lastItems = [];

  for (const id of order) {
    const node = byId.get(id);
    if (!node) continue;
    const parentIds = inEdges.get(id) || [];
    const branches = parentIds.map(pid => nodeResults.get(pid)?.items || []);
    const flatIn = branches.flat().map((item, idx) => ({ ...item, index: idx }));

    let outItems = [];
    if (node.type === 'source') {
      outItems = evalSourceNode(app, node, doc, now, autoIncludeHabits);
    } else if (node.type === 'water_source') {
      outItems = evalWaterSourceNode(app, node, doc);
    } else if (node.type === 'filter') {
      const rules = Array.isArray(node.config?.rules) ? node.config.rules : [];
      const matchAny = node.config?.match === 'any';
      outItems = flatIn
        .filter(item => {
          if (!rules.length) return true;
          return matchAny
            ? rules.some(rule => ruleMatchesItem(item, rule, now))
            : rules.every(rule => ruleMatchesItem(item, rule, now));
        })
        .map((item, idx) => ({ ...item, index: idx }));
    } else if (node.type === 'extract') {
      outItems = evalExtractNode(flatIn, node.config || {});
    } else if (node.type === 'math') {
      outItems = evalMathNode(flatIn, node.config || {});
    } else if (node.type === 'group') {
      outItems = evalGroupNode(flatIn, node.config || {});
    } else if (node.type === 'sort') {
      outItems = evalSortNode(flatIn, node.config || {});
    } else if (node.type === 'merge') {
      outItems = evalMergeNode(branches, node.config || {});
    } else if (node.type === 'output') {
      outItems = flatIn;
      lastOutputPayload = buildOutputPayload(outItems, node.config || {});
    }

    lastItems = outItems;
    nodeResults.set(id, {
      items: outItems,
      count: outItems.length,
    });
  }

  if (!lastOutputPayload) {
    lastOutputPayload = buildOutputPayload(lastItems, { displayType: 'stat', agg: 'sum' });
  }

  return {
    pipeline,
    nodeResults,
    output: lastOutputPayload,
  };
}

function formatPipelineNodeSummary(node) {
  const cfg = node.config || {};
  if (node.type === 'source') {
    const scopeMap = { tree_children: 'Tree children', this_goal: 'This goal', both: 'Goal + children' };
    const parts = [scopeMap[cfg.scope] || 'Data'];
    if (cfg.nameMatch) parts.push(`"${cfg.nameMatch}"`);
    else if (cfg.datasetFilter && cfg.datasetFilter !== 'any') parts.push(cfg.datasetFilter);
    return parts.join(' · ');
  }
  if (node.type === 'water_source') {
    return cfg.nameMatch ? `Habit logs "${cfg.nameMatch}"` : 'Habit watering dates';
  }
  if (node.type === 'filter') {
    const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
    if (!rules.length) return 'Pass all items';
    const r = rules[0];
    const base = `${r.field} ${r.op}${OPS_WITHOUT_VALUE.has(r.op) ? '' : ` "${r.value || '…'}"`}`;
    return rules.length > 1 ? `${base} (+${rules.length - 1})` : base;
  }
  if (node.type === 'extract') {
    const field = cfg.field === '1' || cfg.field === '__count_1' ? 'count (1)' : (cfg.field || 'value');
    return cfg.unit ? `${field} (${cfg.unit})` : `Field: ${field}`;
  }
  if (node.type === 'math') {
    if (cfg.op === 'abs') return 'abs(value)';
    if (cfg.op === 'cumulative') return 'Running total';
    if (cfg.op === 'moving_avg') return `Moving avg (${cfg.operand || 3})`;
    if (cfg.op === 'pct_of_target') return `% of ${cfg.operand || 100}`;
    return `${cfg.op} ${cfg.operand ?? 1}`;
  }
  if (node.type === 'group') {
    return `By ${cfg.by === 'prop' ? (cfg.propKey || 'prop') : cfg.by} · ${cfg.agg || 'sum'}`;
  }
  if (node.type === 'sort') {
    return cfg.limit > 0 ? `${cfg.by} · top ${cfg.limit}` : cfg.by;
  }
  if (node.type === 'merge') {
    return cfg.dedupe === 'path' ? 'Combine · unique notes' : 'Combine inputs';
  }
  if (node.type === 'output') {
    if (cfg.displayType === 'goal_bar') return `Progress bar / ${cfg.target ?? '?'}`;
    if (cfg.displayType === 'chart') return `${cfg.variant === 'bar' ? 'Bar' : 'Line'} graph`;
    if (cfg.displayType === 'note_navigator') return 'Note navigator';
    return `Stat · ${cfg.agg || 'sum'}${cfg.unit ? ` (${cfg.unit})` : ''}`;
  }
  return '';
}

function buildPipelineTemplate(templateId, doc, context = null) {
  const isTree = doc?.kind === 'tree' || doc?.kind === 'garden';
  const defaultScope = isTree ? 'tree_children' : 'this_goal';
  const fields = context?.fieldNames || [];
  const preferredField = fields.find(k => k.toLowerCase().includes('page'))
    || fields.find(k => k.toLowerCase().includes('chapter'))
    || fields[0]
    || 'pages';

  if (templateId === 'habits_today') {
    const src = createNode('source', {
      id: 'n_src',
      label: 'Habits Schedule',
      config: { scope: defaultScope, childKinds: 'habits', datasetFilter: 'habits' },
    });
    const flt = createNode('filter', {
      id: 'n_flt',
      label: 'Appears Today',
      config: {
        match: 'all',
        rules: [{ field: 'appearDate', op: 'is_today', value: '' }],
      },
    });
    const out = createNode('output', {
      id: 'n_out',
      label: 'Habits for Today',
      config: { displayType: 'note_navigator', unit: 'habits' },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [src, flt, out],
      edges: [
        { id: 'e_1', from: src.id, to: flt.id },
        { id: 'e_2', from: flt.id, to: out.id },
      ],
    });
  }

  if (templateId === 'filter_field') {
    const src = createNode('source', {
      id: 'n_src',
      config: { scope: defaultScope, datasetFilter: 'any' },
    });
    const flt = createNode('filter', {
      id: 'n_flt',
      config: {
        match: 'any',
        rules: [
          { field: 'datasetName', op: 'contains', value: preferredField },
          { field: preferredField, op: 'is_number', value: '' },
        ],
      },
    });
    const ext = createNode('extract', {
      id: 'n_ext',
      config: { field: preferredField, fallbackToValue: true, dropMissing: true, unit: preferredField },
    });
    const out = createNode('output', {
      id: 'n_out',
      config: { displayType: 'stat', agg: 'sum', unit: preferredField },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [src, flt, ext, out],
      edges: [
        { id: 'e_1', from: src.id, to: flt.id },
        { id: 'e_2', from: flt.id, to: ext.id },
        { id: 'e_3', from: ext.id, to: out.id },
      ],
    });
  }

  if (templateId === 'compare_children') {
    const src = createNode('source', {
      id: 'n_src',
      config: { scope: defaultScope, childKinds: 'all', datasetFilter: 'numeric' },
    });
    const grp = createNode('group', {
      id: 'n_grp',
      config: { by: isTree ? 'sourceTitle' : 'month', agg: 'sum' },
    });
    const out = createNode('output', {
      id: 'n_out',
      config: { displayType: 'chart', variant: 'bar' },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [src, grp, out],
      edges: [
        { id: 'e_1', from: src.id, to: grp.id },
        { id: 'e_2', from: grp.id, to: out.id },
      ],
    });
  }

  if (templateId === 'merge_branches') {
    const srcA = createNode('source', {
      id: 'n_src_a',
      label: 'Branch A',
      config: { scope: defaultScope, datasetFilter: 'numeric' },
    });
    const srcB = createNode('source', {
      id: 'n_src_b',
      label: 'Branch B (Notes)',
      config: { scope: defaultScope, datasetFilter: 'note' },
    });
    const extB = createNode('extract', {
      id: 'n_ext_b',
      config: { field: preferredField, fallbackToValue: false, dropMissing: true, unit: preferredField },
    });
    const mrg = createNode('merge', { id: 'n_mrg', config: { dedupe: 'none' } });
    const out = createNode('output', {
      id: 'n_out',
      config: { displayType: 'stat', agg: 'sum' },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [srcA, srcB, extB, mrg, out],
      edges: [
        { id: 'e_1', from: srcA.id, to: mrg.id },
        { id: 'e_2', from: srcB.id, to: extB.id },
        { id: 'e_3', from: extB.id, to: mrg.id },
        { id: 'e_4', from: mrg.id, to: out.id },
      ],
    });
  }

  if (templateId === 'filtered_notes') {
    const src = createNode('source', {
      id: 'n_src',
      config: { scope: defaultScope, datasetFilter: 'note' },
    });
    const flt = createNode('filter', {
      id: 'n_flt',
      config: {
        match: 'all',
        rules: [{ field: 'date', op: 'this_month', value: '' }],
      },
    });
    const out = createNode('output', {
      id: 'n_out',
      config: { displayType: 'note_navigator' },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [src, flt, out],
      edges: [
        { id: 'e_1', from: src.id, to: flt.id },
        { id: 'e_2', from: flt.id, to: out.id },
      ],
    });
  }

  if (templateId === 'count_items') {
    const src = createNode('source', {
      id: 'n_src',
      config: { scope: defaultScope, datasetFilter: 'any' },
    });
    const flt = createNode('filter', {
      id: 'n_flt',
      config: {
        match: 'all',
        rules: context?.datasetNames?.[0]
          ? [{ field: 'datasetName', op: 'contains', value: context.datasetNames[0] }]
          : [],
      },
    });
    const out = createNode('output', {
      id: 'n_out',
      config: { displayType: 'stat', agg: 'count', unit: 'entries' },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [src, flt, out],
      edges: [
        { id: 'e_1', from: src.id, to: flt.id },
        { id: 'e_2', from: flt.id, to: out.id },
      ],
    });
  }

  if (templateId === 'goal_progress') {
    const src = createNode('source', {
      id: 'n_src',
      config: { scope: defaultScope, datasetFilter: 'any' },
    });
    const ext = createNode('extract', {
      id: 'n_ext',
      config: { field: preferredField, fallbackToValue: true, dropMissing: true, unit: preferredField },
    });
    const out = createNode('output', {
      id: 'n_out',
      config: { displayType: 'goal_bar', mode: 'sum', target: 100, unit: preferredField },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [src, ext, out],
      edges: [
        { id: 'e_1', from: src.id, to: ext.id },
        { id: 'e_2', from: ext.id, to: out.id },
      ],
    });
  }

  if (templateId === 'habit_waterings') {
    const w = createNode('water_source', {
      id: 'n_wat',
      config: { scope: doc?.kind === 'habit' ? 'this_habit' : 'tree_habits', nameMatch: '' },
    });
    const grp = createNode('group', {
      id: 'n_grp',
      config: { by: isTree ? 'sourceTitle' : 'month', agg: 'sum' },
    });
    const out = createNode('output', {
      id: 'n_out',
      config: { displayType: 'chart', variant: 'bar', unit: 'waterings' },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [w, grp, out],
      edges: [
        { id: 'e_1', from: w.id, to: grp.id },
        { id: 'e_2', from: grp.id, to: out.id },
      ],
    });
  }

  if (templateId === 'cumulative_chart') {
    const src = createNode('source', {
      id: 'n_src',
      config: { scope: defaultScope, datasetFilter: 'any' },
    });
    const flt = createNode('filter', {
      id: 'n_flt',
      config: {
        match: 'any',
        rules: [
          { field: 'datasetName', op: 'contains', value: preferredField },
          { field: preferredField, op: 'is_number', value: '' },
        ],
      },
    });
    const ext = createNode('extract', {
      id: 'n_ext',
      config: { field: preferredField, fallbackToValue: true, dropMissing: true, unit: preferredField },
    });
    const srt = createNode('sort', {
      id: 'n_srt',
      config: { by: 'date_asc', limit: 0 },
    });
    const mth = createNode('math', {
      id: 'n_mth',
      config: { op: 'cumulative', operand: 1, unit: preferredField },
    });
    const out = createNode('output', {
      id: 'n_out',
      config: { displayType: 'chart', variant: 'line', unit: preferredField },
    });
    return autoLayoutPipeline({
      version: 1,
      zoom: 1,
      panX: 0,
      panY: 0,
      nodes: [src, flt, ext, srt, mth, out],
      edges: [
        { id: 'e_1', from: src.id, to: flt.id },
        { id: 'e_2', from: flt.id, to: ext.id },
        { id: 'e_3', from: ext.id, to: srt.id },
        { id: 'e_4', from: srt.id, to: mth.id },
        { id: 'e_5', from: mth.id, to: out.id },
      ],
    });
  }

  return normalizePipeline(null, doc);
}

function buildPipelineFromSimpleConfig(config = {}, doc = null) {
  const isTreeOrGarden = doc?.kind === 'tree' || doc?.kind === 'garden';
  const scope = config.relation ? 'tree_children' : (isTreeOrGarden && !config.datasetId ? 'tree_children' : 'this_goal');
  const pickedRefDsId = config.relation?.mode === 'pick' && config.relation.refs?.length === 1
    ? config.relation.refs[0].datasetId
    : '';
  const rawDataFilter = config.relation?.dataFilter || 'any';
  const isHabitsTodayFilter = rawDataFilter === 'habits_today' || rawDataFilter === 'habits_pending';
  const srcConfig = {
    scope,
    childKinds: config.relation?.childKinds || (rawDataFilter.startsWith('habits') ? 'habits' : 'all'),
    datasetFilter: isHabitsTodayFilter ? 'habits' : (rawDataFilter === 'habits_all' ? 'habits' : rawDataFilter),
    datasetId: config.datasetId || pickedRefDsId || '',
    nameMatch: config.relation?.nameMatch || '',
  };

  const nodes = [createNode('source', { id: 'n_src', config: srcConfig })];
  const edges = [];
  let tail = nodes[0];

  if (isHabitsTodayFilter) {
    const flt = createNode('filter', {
      id: 'n_flt',
      label: rawDataFilter === 'habits_pending' ? 'Needs Water Today' : 'Appears Today',
      config: {
        match: 'all',
        rules: [
          rawDataFilter === 'habits_pending'
            ? { field: 'pendingToday', op: 'is_true', value: '' }
            : { field: 'appearDate', op: 'is_today', value: '' },
        ],
      },
    });
    nodes.push(flt);
    edges.push({ id: generateId('e'), from: tail.id, to: flt.id });
    tail = flt;
  }

  if (config.metricKey) {
    const ext = createNode('extract', {
      id: 'n_ext',
      config: {
        field: config.metricKey,
        fallbackToValue: false,
        dropMissing: true,
        unit: config.unit || '',
      },
    });
    nodes.push(ext);
    edges.push({ id: generateId('e'), from: tail.id, to: ext.id });
    tail = ext;
  }

  if (config.relation?.perChildAgg && config.relation.perChildAgg !== 'all') {
    const grp = createNode('group', {
      id: 'n_grp',
      config: { by: 'sourceTitle', agg: config.relation.perChildAgg },
    });
    nodes.push(grp);
    edges.push({ id: generateId('e'), from: tail.id, to: grp.id });
    tail = grp;
  }

  const outType = ['stat', 'goal_bar', 'chart', 'note_navigator'].includes(config.type) ? config.type : 'stat';
  const out = createNode('output', {
    id: 'n_out',
    config: {
      displayType: outType,
      agg: config.agg || 'sum',
      mode: config.mode || 'sum',
      target: config.target ?? 100,
      variant: config.variant || 'line',
      unit: config.unit || '',
    },
  });
  nodes.push(out);
  edges.push({ id: generateId('e'), from: tail.id, to: out.id });

  return autoLayoutPipeline({
    version: 1,
    zoom: 1,
    panX: 0,
    panY: 0,
    nodes,
    edges,
  });
}

module.exports = {
  PIPELINE_NODE_TYPES,
  FILTER_FIELD_PRESETS,
  FILTER_OPS,
  OPS_WITHOUT_VALUE,
  MATH_OPS,
  GROUP_BYS,
  SORT_BYS,
  getNodeDef,
  createNode,
  normalizePipeline,
  autoLayoutPipeline,
  collectCanvasContext,
  evaluatePipeline,
  formatPipelineNodeSummary,
  buildPipelineTemplate,
  buildPipelineFromSimpleConfig,
};
