const ROOT = 'Iter';
const INDEX_FOLDER = `${ROOT}/_index`;
const WE_PATH = `${INDEX_FOLDER}/We.md`;

const MODULES = [
  { id: 'general', label: 'General' },
  { id: 'gym', label: 'Gym & Body' },
  { id: 'learning', label: 'Learning' },
  { id: 'creative', label: 'Creative' },
  { id: 'health', label: 'Health' },
];

const FREQUENCIES = ['daily', 'weekly', 'monthly'];
const STYLES = ['auto', 'canopy', 'bonsai', 'pine', 'willow'];

function isFolder(entry) {
  return !!entry && Array.isArray(entry.children);
}

function validateName(value, label = 'Name') {
  const name = typeof value === 'string' ? value.trim() : '';
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    name.startsWith('_') ||
    name.startsWith('.') ||
    /[\\/:*?"<>|\x00-\x1f\x7f#^[\]]/.test(name) ||
    /[.]$/.test(name) ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)
  ) {
    throw new Error(`${label} is invalid. Avoid leading "." or "_", path separators, and reserved characters.`);
  }
  return name;
}

async function ensureFolder(vault, path) {
  const existing = vault.getAbstractFileByPath(path);
  if (existing) {
    if (!isFolder(existing)) throw new Error(`A file exists where a folder is required: ${path}`);
    return existing;
  }
  try {
    await vault.createFolder(path);
  } catch (error) {
    if (!isFolder(vault.getAbstractFileByPath(path))) throw error;
  }
  return vault.getAbstractFileByPath(path);
}

async function ensureStructure(vault) {
  await ensureFolder(vault, ROOT);
  await ensureFolder(vault, INDEX_FOLDER);
  if (!vault.getAbstractFileByPath(WE_PATH)) {
    const content = [
      '---',
      'type: iter-index',
      'title: "We"',
      'members: []',
      `created: ${new Date().toISOString()}`,
      '---',
      '',
      '# We',
      '',
      'A shared garden of long-term goals. Each folder inside `Iter/` represents a tree watered through habits and subgoals.',
      '',
    ].join('\n');
    try {
      await vault.create(WE_PATH, content);
    } catch (error) {
      if (!vault.getAbstractFileByPath(WE_PATH)) throw error;
    }
  }
  return vault.getAbstractFileByPath(ROOT);
}

function validTreePath(treePath) {
  if (typeof treePath !== 'string' || !treePath.startsWith(`${ROOT}/`)) {
    throw new Error('Invalid tree path.');
  }
  const rest = treePath.slice(ROOT.length + 1);
  if (!rest || rest.includes('/')) throw new Error('Invalid tree path.');
  validateName(rest, 'Tree name');
  return treePath;
}

function normalizeModule(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return MODULES.some(item => item.id === normalized) ? normalized : 'general';
}

function normalizeFrequency(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return FREQUENCIES.includes(normalized) ? normalized : 'daily';
}

function normalizeStyle(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return STYLES.includes(normalized) ? normalized : 'auto';
}

async function createTree(vault, { name, module = 'general', goal = '', style = 'auto' }) {
  const title = validateName(name, 'Tree name');
  const mod = normalizeModule(module);
  const treeStyle = normalizeStyle(style);
  const cleanGoal = typeof goal === 'string' ? goal.trim() : '';

  await ensureStructure(vault);
  const treeDir = `${ROOT}/${title}`;
  if (vault.getAbstractFileByPath(treeDir)) {
    throw new Error(`A tree named "${title}" already exists.`);
  }

  await ensureFolder(vault, treeDir);
  const indexPath = `${treeDir}/_tree.md`;
  const lines = [
    '---',
    'type: tree',
    `title: ${JSON.stringify(title)}`,
    `module: ${JSON.stringify(mod)}`,
    `goal: ${JSON.stringify(cleanGoal)}`,
    `style: ${JSON.stringify(treeStyle)}`,
    `created: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
  ];
  if (cleanGoal) {
    lines.push('## Goal', cleanGoal, '');
  }
  lines.push('## Notes', '');
  return vault.create(indexPath, lines.join('\n'));
}

async function createSubgoal(vault, { treePath, name, target = '' }) {
  const dir = validTreePath(treePath);
  const title = validateName(name, 'Subgoal name');
  const cleanTarget = typeof target === 'string' ? target.trim() : '';

  await ensureStructure(vault);
  const folder = vault.getAbstractFileByPath(dir);
  if (!isFolder(folder)) throw new Error('Selected tree does not exist.');

  const subgoalsDir = `${dir}/subgoals`;
  await ensureFolder(vault, subgoalsDir);
  const filePath = `${subgoalsDir}/${title}.md`;
  if (vault.getAbstractFileByPath(filePath)) {
    throw new Error(`A subgoal named "${title}" already exists in this tree.`);
  }

  const lines = [
    '---',
    'type: subgoal',
    `title: ${JSON.stringify(title)}`,
    'done: false',
    `target: ${JSON.stringify(cleanTarget)}`,
    `created: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
  ];
  if (cleanTarget) lines.push(`Target: ${cleanTarget}`, '');
  return vault.create(filePath, lines.join('\n'));
}

async function createHabit(vault, { treePath, name, frequency = 'daily', target = '' }) {
  const dir = validTreePath(treePath);
  const title = validateName(name, 'Habit name');
  const freq = normalizeFrequency(frequency);
  const cleanTarget = typeof target === 'string' ? target.trim() : '';

  await ensureStructure(vault);
  const folder = vault.getAbstractFileByPath(dir);
  if (!isFolder(folder)) throw new Error('Selected tree does not exist.');

  const habitsDir = `${dir}/habits`;
  await ensureFolder(vault, habitsDir);
  const filePath = `${habitsDir}/${title}.md`;
  if (vault.getAbstractFileByPath(filePath)) {
    throw new Error(`A habit named "${title}" already exists in this tree.`);
  }

  const lines = [
    '---',
    'type: habit',
    `title: ${JSON.stringify(title)}`,
    `frequency: ${JSON.stringify(freq)}`,
    `target: ${JSON.stringify(cleanTarget)}`,
    'last_watered: null',
    'water_log: []',
    `created: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
    `Cadence: ${freq}`,
    '',
  ];
  if (cleanTarget) lines.push(`Target: ${cleanTarget}`, '');
  return vault.create(filePath, lines.join('\n'));
}

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  if (typeof key !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function formatUtcDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateKey(key, deltaDays) {
  const parsed = parseDateKey(key);
  if (!parsed) return null;
  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return formatUtcDateKey(parsed);
}

function weekStartKey(key) {
  const parsed = parseDateKey(key);
  if (!parsed) return null;
  const mondayOffset = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - mondayOffset);
  return formatUtcDateKey(parsed);
}

function monthKey(key) {
  return parseDateKey(key) ? key.slice(0, 7) : null;
}

function shiftMonthKey(ym, deltaMonths) {
  const match = /^(\d{4})-(\d{2})$/.exec(ym ?? '');
  if (!match) return null;
  const totalMonths = Number(match[1]) * 12 + (Number(match[2]) - 1) + deltaMonths;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12 + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function periodKeyFor(dateKey, frequency) {
  const freq = normalizeFrequency(frequency);
  if (freq === 'weekly') return weekStartKey(dateKey);
  if (freq === 'monthly') return monthKey(dateKey);
  return parseDateKey(dateKey) ? dateKey : null;
}

function previousPeriodKey(periodKey, frequency) {
  const freq = normalizeFrequency(frequency);
  if (freq === 'weekly') return shiftDateKey(periodKey, -7);
  if (freq === 'monthly') return shiftMonthKey(periodKey, -1);
  return shiftDateKey(periodKey, -1);
}

function normalizeWaterLog(raw) {
  if (!Array.isArray(raw)) return [];
  const valid = new Set();
  for (const item of raw) {
    const str = typeof item === 'string' ? item.trim() : '';
    if (parseDateKey(str)) valid.add(str);
  }
  return Array.from(valid).sort();
}

function isWateredInPeriod(lastWatered, waterLog, frequency, now = new Date()) {
  const currentPeriod = periodKeyFor(toDateKey(now), frequency);
  if (!currentPeriod) return false;
  const dates = normalizeWaterLog(waterLog);
  if (typeof lastWatered === 'string' && parseDateKey(lastWatered)) {
    dates.push(lastWatered.trim());
  }
  return dates.some(key => periodKeyFor(key, frequency) === currentPeriod);
}

function computeHabitStreak(waterLog, frequency, now = new Date()) {
  const dates = normalizeWaterLog(waterLog);
  if (!dates.length) return 0;
  const periods = new Set(dates.map(key => periodKeyFor(key, frequency)).filter(Boolean));
  const current = periodKeyFor(toDateKey(now), frequency);
  const previous = previousPeriodKey(current, frequency);
  let cursor = periods.has(current) ? current : periods.has(previous) ? previous : null;
  let streak = 0;
  while (cursor && periods.has(cursor)) {
    streak += 1;
    cursor = previousPeriodKey(cursor, frequency);
  }
  return streak;
}

async function toggleSubgoal(app, file, nextDone) {
  let result = false;
  await app.fileManager.processFrontMatter(file, frontmatter => {
    const next = typeof nextDone === 'boolean' ? nextDone : !Boolean(frontmatter.done);
    frontmatter.done = next;
    result = next;
  });
  return result;
}

async function waterHabit(app, file, now = new Date()) {
  const today = toDateKey(now);
  let wateredToday = false;
  await app.fileManager.processFrontMatter(file, frontmatter => {
    const log = normalizeWaterLog(frontmatter.water_log);
    if (typeof frontmatter.last_watered === 'string' && parseDateKey(frontmatter.last_watered) && !log.includes(frontmatter.last_watered)) {
      log.push(frontmatter.last_watered);
      log.sort();
    }
    const index = log.indexOf(today);
    if (index >= 0) {
      log.splice(index, 1);
      wateredToday = false;
    } else {
      log.push(today);
      log.sort();
      wateredToday = true;
    }
    frontmatter.water_log = log;
    frontmatter.last_watered = log.length ? log[log.length - 1] : null;
  });
  return wateredToday;
}

module.exports = {
  ROOT,
  INDEX_FOLDER,
  WE_PATH,
  MODULES,
  FREQUENCIES,
  STYLES,
  isFolder,
  validateName,
  ensureFolder,
  ensureStructure,
  validTreePath,
  normalizeModule,
  normalizeFrequency,
  normalizeStyle,
  createTree,
  createSubgoal,
  createHabit,
  toDateKey,
  parseDateKey,
  periodKeyFor,
  normalizeWaterLog,
  isWateredInPeriod,
  computeHabitStreak,
  toggleSubgoal,
  waterHabit,
};
