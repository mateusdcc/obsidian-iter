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

const FREQUENCIES = ['daily', 'weekdays', 'weekly', 'monthly'];
const WEEKDAYS = [
  { id: 'mon', tiny: 'M', short: 'Mo', label: 'Mon', full: 'Monday', jsDay: 1 },
  { id: 'tue', tiny: 'T', short: 'Tu', label: 'Tue', full: 'Tuesday', jsDay: 2 },
  { id: 'wed', tiny: 'W', short: 'We', label: 'Wed', full: 'Wednesday', jsDay: 3 },
  { id: 'thu', tiny: 'T', short: 'Th', label: 'Thu', full: 'Thursday', jsDay: 4 },
  { id: 'fri', tiny: 'F', short: 'Fr', label: 'Fri', full: 'Friday', jsDay: 5 },
  { id: 'sat', tiny: 'S', short: 'Sa', label: 'Sat', full: 'Saturday', jsDay: 6 },
  { id: 'sun', tiny: 'S', short: 'Su', label: 'Sun', full: 'Sunday', jsDay: 0 },
];
const DAY_BY_JS_DAY = new Map(WEEKDAYS.map(d => [d.jsDay, d.id]));
const DAY_ORDER = new Map(WEEKDAYS.map((d, i) => [d.id, i]));
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
  if (typeof vault.adapter?.exists === 'function') {
    try {
      if (await vault.adapter.exists(path)) {
        return vault.getAbstractFileByPath(path);
      }
    } catch {
      // Fall through to createFolder
    }
  }
  try {
    await vault.createFolder(path);
  } catch (error) {
    const after = vault.getAbstractFileByPath(path);
    if (after && !isFolder(after)) throw error;
    const msg = String(error?.message || error || '').toLowerCase();
    if (!isFolder(after) && !msg.includes('already exists')) throw error;
  }
  return vault.getAbstractFileByPath(path);
}

async function ensureStructure(vault) {
  await ensureFolder(vault, ROOT);
  await ensureFolder(vault, INDEX_FOLDER);
  if (!vault.getAbstractFileByPath(WE_PATH)) {
    let existsOnDisk = false;
    if (typeof vault.adapter?.exists === 'function') {
      try {
        existsOnDisk = await vault.adapter.exists(WE_PATH);
      } catch {
        existsOnDisk = false;
      }
    }
    if (!existsOnDisk) {
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
        const msg = String(error?.message || error || '').toLowerCase();
        if (!vault.getAbstractFileByPath(WE_PATH) && !msg.includes('already exists')) throw error;
      }
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

function normalizeDays(raw) {
  if (!Array.isArray(raw)) return [];
  const chosen = new Set();
  for (const item of raw) {
    if (typeof item === 'number' && DAY_BY_JS_DAY.has(item)) {
      chosen.add(DAY_BY_JS_DAY.get(item));
      continue;
    }
    const clean = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!clean) continue;
    const match = WEEKDAYS.find(
      d => d.id === clean || d.short.toLowerCase() === clean || d.label.toLowerCase() === clean || d.full.toLowerCase() === clean,
    );
    if (match) chosen.add(match.id);
  }
  return Array.from(chosen).sort((a, b) => DAY_ORDER.get(a) - DAY_ORDER.get(b));
}

function formatCadenceLabel(frequency, days = []) {
  const freq = normalizeFrequency(frequency);
  if (freq === 'weekdays') {
    const clean = normalizeDays(days);
    if (!clean.length) return 'Specific days';
    if (clean.length === 7) return 'Every day';
    if (clean.length === 5 && !clean.includes('sat') && !clean.includes('sun')) return 'Weekdays';
    if (clean.length === 2 && clean.includes('sat') && clean.includes('sun')) return 'Weekends';
    return clean.map(id => WEEKDAYS[DAY_ORDER.get(id)].label).join(', ');
  }
  if (freq === 'weekly') return 'Weekly';
  if (freq === 'monthly') return 'Monthly';
  return 'Daily';
}

function formatCadenceShort(frequency, days = []) {
  const freq = normalizeFrequency(frequency);
  if (freq === 'weekdays') {
    const clean = normalizeDays(days);
    if (!clean.length) return 'Days';
    if (clean.length <= 3) return clean.map(id => WEEKDAYS[DAY_ORDER.get(id)].short).join('·');
    return `${clean.length}d/w`;
  }
  if (freq === 'weekly') return 'W';
  if (freq === 'monthly') return 'M';
  return 'D';
}

function normalizeStyle(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return STYLES.includes(normalized) ? normalized : 'auto';
}

async function createTree(vault, { name, module = 'general', goal = '', style = 'auto', endless = false, due = '' }) {
  const title = validateName(name, 'Tree name');
  const mod = normalizeModule(module);
  const treeStyle = normalizeStyle(style);
  const cleanGoal = typeof goal === 'string' ? goal.trim() : '';
  const isEndless = Boolean(endless);
  const cleanDue = !isEndless && typeof due === 'string' && parseDateKey(due) ? due.trim() : '';

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
    `endless: ${isEndless ? 'true' : 'false'}`,
  ];
  if (cleanDue) {
    lines.push(`due: ${JSON.stringify(cleanDue)}`);
  }
  lines.push(
    `created: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
  );
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

async function createHabit(vault, { treePath, name, frequency = 'daily', days = [], target = '' }) {
  const dir = validTreePath(treePath);
  const title = validateName(name, 'Habit name');
  const freq = normalizeFrequency(frequency);
  const cleanDays = freq === 'weekdays' ? normalizeDays(days) : [];
  if (freq === 'weekdays' && !cleanDays.length) {
    throw new Error('Select at least one day of the week.');
  }
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
    `days: ${JSON.stringify(cleanDays)}`,
    `target: ${JSON.stringify(cleanTarget)}`,
    'last_watered: null',
    'water_log: []',
    'widgets: [{"id":"w_streak","title":"Streak","type":"streak"}]',
    `created: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
    `Cadence: ${formatCadenceLabel(freq, cleanDays)}`,
    '',
  ];
  if (cleanTarget) lines.push(`Target: ${cleanTarget}`, '');
  return vault.create(filePath, lines.join('\n'));
}

async function updateHabitSchedule(app, file, { frequency, days = [] }) {
  const freq = normalizeFrequency(frequency);
  const cleanDays = freq === 'weekdays' ? normalizeDays(days) : [];
  if (freq === 'weekdays' && !cleanDays.length) {
    throw new Error('Select at least one day of the week.');
  }
  await app.fileManager.processFrontMatter(file, frontmatter => {
    frontmatter.frequency = freq;
    frontmatter.days = cleanDays;
  });
  if (typeof app.vault?.read === 'function' && typeof app.vault?.modify === 'function') {
    const raw = await app.vault.read(file);
    const nextCadence = `Cadence: ${formatCadenceLabel(freq, cleanDays)}`;
    if (/^Cadence:\s*.*$/m.test(raw)) {
      const updated = raw.replace(/^Cadence:\s*.*$/m, nextCadence);
      if (updated !== raw) await app.vault.modify(file, updated);
    }
  }
  return { frequency: freq, days: cleanDays };
}

async function trashEntry(app, target) {
  if (!target) throw new Error('Entry not found.');
  if (typeof app.fileManager?.trashFile === 'function') {
    await app.fileManager.trashFile(target);
    return;
  }
  if (typeof app.vault?.trash === 'function') {
    await app.vault.trash(target, true);
    return;
  }
  if (typeof app.vault?.delete === 'function') {
    await app.vault.delete(target, true);
    return;
  }
  throw new Error('Vault deletion is unavailable.');
}

async function deleteTree(app, treePath) {
  const dir = validTreePath(treePath);
  const folder = app.vault.getAbstractFileByPath(dir);
  if (!isFolder(folder)) throw new Error('Tree folder not found.');
  await trashEntry(app, folder);
}

async function deleteGoalFile(app, file) {
  if (!file || isFolder(file)) throw new Error('Goal file not found.');
  if (
    typeof file.path !== 'string' ||
    !file.path.startsWith(`${ROOT}/`) ||
    file.path === WE_PATH ||
    file.path.startsWith(`${INDEX_FOLDER}/`)
  ) {
    throw new Error('Invalid goal file path.');
  }
  await trashEntry(app, file);
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

function weekdayIdForDateKey(key) {
  const parsed = parseDateKey(key);
  if (!parsed) return null;
  return DAY_BY_JS_DAY.get(parsed.getUTCDay()) ?? null;
}

function isScheduledOnDate(frequency, days, dateKey) {
  const freq = normalizeFrequency(frequency);
  if (freq !== 'weekdays') return true;
  const cleanDays = normalizeDays(days);
  if (!cleanDays.length) return false;
  const dayId = weekdayIdForDateKey(dateKey);
  return dayId ? cleanDays.includes(dayId) : false;
}

function isWateredInPeriod(lastWatered, waterLog, frequency, now = new Date(), days = []) {
  const freq = normalizeFrequency(frequency);
  const todayKey = toDateKey(now);
  const dates = normalizeWaterLog(waterLog);
  if (typeof lastWatered === 'string' && parseDateKey(lastWatered) && !dates.includes(lastWatered.trim())) {
    dates.push(lastWatered.trim());
  }
  if (freq === 'weekdays') {
    if (dates.includes(todayKey)) return true;
    const cleanDays = normalizeDays(days);
    if (!cleanDays.length) return false;
    if (isScheduledOnDate('weekdays', cleanDays, todayKey)) {
      return false;
    }
    // Rest day: check whether the most recent scheduled day was completed
    let cursor = shiftDateKey(todayKey, -1);
    for (let i = 0; i < 7 && cursor; i += 1) {
      if (isScheduledOnDate('weekdays', cleanDays, cursor)) {
        return dates.includes(cursor);
      }
      cursor = shiftDateKey(cursor, -1);
    }
    return false;
  }
  const currentPeriod = periodKeyFor(todayKey, freq);
  if (!currentPeriod) return false;
  return dates.some(key => periodKeyFor(key, freq) === currentPeriod);
}

function mergeWaterDates(waterLog, lastWatered = null) {
  const valid = new Set(normalizeWaterLog(waterLog));
  if (typeof lastWatered === 'string' && parseDateKey(lastWatered)) {
    valid.add(lastWatered.trim());
  }
  return Array.from(valid).sort();
}

function computeWeekdaysStreak(dates, days, todayKey) {
  const cleanDays = normalizeDays(days);
  if (!dates.length || !cleanDays.length) return 0;
  const logSet = new Set(dates);
  const daySet = new Set(cleanDays);
  const earliest = dates[0];
  let cursor = todayKey;
  let streak = 0;
  let skippedOpenToday = false;

  for (let steps = 0; steps < 36500 && cursor && cursor >= earliest; steps += 1) {
    const dayId = weekdayIdForDateKey(cursor);
    if (dayId && daySet.has(dayId)) {
      if (logSet.has(cursor)) {
        streak += 1;
        skippedOpenToday = true;
      } else if (cursor === todayKey && !skippedOpenToday) {
        skippedOpenToday = true;
      } else {
        break;
      }
    }
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

function computeWeekdaysBestStreak(dates, days, todayKey) {
  const cleanDays = normalizeDays(days);
  if (!dates.length || !cleanDays.length) return 0;
  const logSet = new Set(dates);
  const daySet = new Set(cleanDays);
  const end = dates[dates.length - 1] > todayKey ? dates[dates.length - 1] : todayKey;
  let cursor = dates[0];
  let run = 0;
  let best = 0;

  for (let steps = 0; steps < 36500 && cursor && cursor <= end; steps += 1) {
    const dayId = weekdayIdForDateKey(cursor);
    if (dayId && daySet.has(dayId)) {
      if (logSet.has(cursor)) {
        run += 1;
        if (run > best) best = run;
      } else if (cursor !== todayKey) {
        run = 0;
      }
    }
    cursor = shiftDateKey(cursor, 1);
  }
  return best;
}

function computePeriodBestStreak(periodsSet, freq) {
  if (!periodsSet.size) return 0;
  const sorted = Array.from(periodsSet).sort();
  let run = 0;
  let best = 0;
  let prev = null;
  for (const period of sorted) {
    if (prev && previousPeriodKey(period, freq) === prev) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = period;
  }
  return best;
}

function computeHabitStreak(waterLog, frequency, now = new Date(), days = [], lastWatered = null) {
  const freq = normalizeFrequency(frequency);
  const dates = mergeWaterDates(waterLog, lastWatered);
  if (!dates.length) return 0;
  if (freq === 'weekdays') {
    return computeWeekdaysStreak(dates, days, toDateKey(now));
  }
  const periods = new Set(dates.map(key => periodKeyFor(key, freq)).filter(Boolean));
  const current = periodKeyFor(toDateKey(now), freq);
  const previous = previousPeriodKey(current, freq);
  let cursor = periods.has(current) ? current : periods.has(previous) ? previous : null;
  let streak = 0;
  while (cursor && periods.has(cursor)) {
    streak += 1;
    cursor = previousPeriodKey(cursor, freq);
  }
  return streak;
}

function shortDayLabel(dateKey) {
  const id = weekdayIdForDateKey(dateKey);
  if (!id) return dateKey;
  return WEEKDAYS[DAY_ORDER.get(id)].short;
}

function recentScheduledSlots(dates, freq, days, todayKey, count = 6) {
  const logSet = new Set(dates);
  if (freq === 'weekdays') {
    const cleanDays = normalizeDays(days);
    if (!cleanDays.length) return [];
    const daySet = new Set(cleanDays);
    const slots = [];
    let cursor = todayKey;
    for (let i = 0; i < 60 && slots.length < count && cursor; i += 1) {
      const id = weekdayIdForDateKey(cursor);
      if (id && daySet.has(id)) {
        slots.unshift({
          key: cursor,
          label: shortDayLabel(cursor),
          completed: logSet.has(cursor),
          isCurrent: cursor === todayKey,
        });
      }
      cursor = shiftDateKey(cursor, -1);
    }
    return slots;
  }

  const periods = new Set(dates.map(key => periodKeyFor(key, freq)).filter(Boolean));
  const slots = [];
  let cursor = periodKeyFor(todayKey, freq);
  for (let i = 0; i < count && cursor; i += 1) {
    let label = cursor;
    if (freq === 'daily') label = shortDayLabel(cursor);
    else if (freq === 'weekly') label = cursor.slice(5);
    else if (freq === 'monthly') label = cursor.slice(5);
    slots.unshift({
      key: cursor,
      label,
      completed: periods.has(cursor),
      isCurrent: i === 0,
    });
    cursor = previousPeriodKey(cursor, freq);
  }
  return slots;
}

function streakUnit(freq, count) {
  if (freq === 'weekly') return count === 1 ? 'week' : 'weeks';
  if (freq === 'monthly') return count === 1 ? 'month' : 'months';
  if (freq === 'weekdays') return count === 1 ? 'scheduled day' : 'scheduled days';
  return count === 1 ? 'day' : 'days';
}

function computeHabitStreakDetails(waterLog, frequency, now = new Date(), days = [], lastWatered = null) {
  const freq = normalizeFrequency(frequency);
  const cleanDays = normalizeDays(days);
  const dates = mergeWaterDates(waterLog, lastWatered);
  const todayKey = toDateKey(now);
  const streak = computeHabitStreak(dates, freq, now, cleanDays, lastWatered);

  let bestStreak = 0;
  if (dates.length) {
    if (freq === 'weekdays') {
      bestStreak = computeWeekdaysBestStreak(dates, cleanDays, todayKey);
    } else {
      const periods = new Set(dates.map(key => periodKeyFor(key, freq)).filter(Boolean));
      bestStreak = computePeriodBestStreak(periods, freq);
    }
  }
  if (streak > bestStreak) bestStreak = streak;

  const wateredToday = dates.includes(todayKey);
  const wateredPeriod = isWateredInPeriod(lastWatered, dates, freq, now, cleanDays);
  const dueToday = isScheduledOnDate(freq, cleanDays, todayKey);

  let statusLabel = 'Due today';
  if (wateredToday) statusLabel = 'Watered today';
  else if (freq === 'weekly' && wateredPeriod) statusLabel = 'Done this week';
  else if (freq === 'monthly' && wateredPeriod) statusLabel = 'Done this month';
  else if (!dueToday) statusLabel = 'Rest day';
  else if (freq === 'weekly') statusLabel = 'Due this week';
  else if (freq === 'monthly') statusLabel = 'Due this month';

  return {
    streak,
    bestStreak,
    unit: streakUnit(freq, streak),
    cadenceLabel: formatCadenceLabel(freq, cleanDays),
    statusLabel,
    recentSlots: recentScheduledSlots(dates, freq, cleanDays, todayKey, 6),
  };
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
  WEEKDAYS,
  STYLES,
  isFolder,
  validateName,
  ensureFolder,
  ensureStructure,
  validTreePath,
  normalizeModule,
  normalizeFrequency,
  normalizeDays,
  normalizeStyle,
  formatCadenceLabel,
  formatCadenceShort,
  createTree,
  createSubgoal,
  createHabit,
  updateHabitSchedule,
  deleteTree,
  deleteGoalFile,
  toDateKey,
  parseDateKey,
  periodKeyFor,
  weekdayIdForDateKey,
  isScheduledOnDate,
  normalizeWaterLog,
  mergeWaterDates,
  isWateredInPeriod,
  computeHabitStreak,
  computeHabitStreakDetails,
  toggleSubgoal,
  waterHabit,
};
