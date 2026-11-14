const {
  ROOT,
  WE_PATH,
  isFolder,
  normalizeModule,
  normalizeFrequency,
  normalizeDays,
  normalizeStyle,
  formatCadenceLabel,
  formatCadenceShort,
  isScheduledOnDate,
  normalizeWaterLog,
  isWateredInPeriod,
  computeHabitStreak,
  toDateKey,
} = require('./storage');

function compareNames(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

function getFrontmatter(app, file) {
  if (!file) return null;
  return app.metadataCache.getFileCache(file)?.frontmatter ?? null;
}

function readString(fm, key, fallback = '') {
  const val = fm?.[key];
  return typeof val === 'string' && val.trim() ? val.trim() : fallback;
}

function isHiddenName(name) {
  return !name || name.startsWith('_') || name.startsWith('.');
}

function stripExt(file) {
  return file.name.endsWith('.md') ? file.name.slice(0, -3) : file.name;
}

function parseTargets(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .filter(([user, target]) => typeof user === 'string' && user.trim() && target !== undefined && target !== null && String(target).trim())
    .map(([user, target]) => ({ user: user.trim(), target: String(target).trim() }));
}

function readSubgoals(app, treeFolder) {
  const dir = treeFolder.children.find(child => isFolder(child) && child.name === 'subgoals');
  if (!dir) return [];
  return dir.children
    .filter(child => !isFolder(child) && child.extension === 'md' && !isHiddenName(child.name))
    .map(file => {
      const fm = getFrontmatter(app, file);
      return {
        file,
        title: readString(fm, 'title', stripExt(file)),
        done: Boolean(fm?.done),
        target: readString(fm, 'target', ''),
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || compareNames(a.title, b.title));
}

function readHabits(app, treeFolder, now = new Date()) {
  const dir = treeFolder.children.find(child => isFolder(child) && child.name === 'habits');
  if (!dir) return [];
  const today = toDateKey(now);
  return dir.children
    .filter(child => !isFolder(child) && child.extension === 'md' && !isHiddenName(child.name))
    .map(file => {
      const fm = getFrontmatter(app, file);
      const frequency = normalizeFrequency(fm?.frequency);
      const days = normalizeDays(fm?.days);
      const waterLog = normalizeWaterLog(fm?.water_log);
      const lastWatered = typeof fm?.last_watered === 'string' && fm.last_watered.trim()
        ? fm.last_watered.trim()
        : (waterLog.length ? waterLog[waterLog.length - 1] : null);
      const isDueToday = isScheduledOnDate(frequency, days, today);
      const wateredInPeriod = isWateredInPeriod(lastWatered, waterLog, frequency, now, days);
      const wateredToday = waterLog.includes(today) || lastWatered === today;
      const streak = computeHabitStreak(
        lastWatered && !waterLog.includes(lastWatered) ? [...waterLog, lastWatered] : waterLog,
        frequency,
        now,
        days,
      );
      return {
        file,
        title: readString(fm, 'title', stripExt(file)),
        frequency,
        days,
        cadenceLabel: formatCadenceLabel(frequency, days),
        cadenceShort: formatCadenceShort(frequency, days),
        isDueToday,
        target: readString(fm, 'target', ''),
        lastWatered,
        waterLog,
        wateredInPeriod,
        wateredToday,
        streak,
      };
    })
    .sort((a, b) => compareNames(a.title, b.title));
}

function readExtraEntries(directory, reservedNames = new Set()) {
  if (!isFolder(directory)) return [];
  const folders = [];
  const files = [];
  for (const child of directory.children) {
    if (isHiddenName(child.name) || reservedNames.has(child.name)) continue;
    if (isFolder(child)) {
      folders.push({
        kind: 'folder',
        name: child.name,
        path: child.path,
        entry: child,
        children: readExtraEntries(child),
      });
    } else {
      files.push({
        kind: 'file',
        name: stripExt(child),
        path: child.path,
        file: child,
      });
    }
  }
  folders.sort((a, b) => compareNames(a.name, b.name));
  files.sort((a, b) => compareNames(a.name, b.name));
  return [...folders, ...files];
}

function computeTreeStats(subgoals, habits) {
  const subgoalTotal = subgoals.length;
  const subgoalDone = subgoals.filter(item => item.done).length;
  const dueHabits = habits.filter(item => item.isDueToday);
  const dueTotal = dueHabits.length;
  const dueWatered = dueHabits.filter(item => item.wateredInPeriod).length;
  const habitTotal = dueTotal > 0 ? dueTotal : habits.length;
  const habitWatered = dueTotal > 0 ? dueWatered : habits.filter(item => item.wateredInPeriod).length;
  const totalWaterings = habits.reduce((sum, item) => sum + item.waterLog.length, 0);

  let progress = 0;
  if (subgoalTotal > 0 && habitTotal > 0) {
    const subgoalRatio = subgoalDone / subgoalTotal;
    const periodRatio = habitWatered / habitTotal;
    const consistency = 1 - Math.exp(-totalWaterings / 8);
    progress = 0.5 * subgoalRatio + 0.25 * periodRatio + 0.25 * consistency;
  } else if (subgoalTotal > 0) {
    progress = subgoalDone / subgoalTotal;
  } else if (habitTotal > 0) {
    const periodRatio = habitWatered / habitTotal;
    const consistency = 1 - Math.exp(-totalWaterings / 8);
    progress = 0.45 * periodRatio + 0.55 * consistency;
  }

  const growth = Math.max(0.18, Math.min(1, 0.18 + 0.82 * progress));
  let stageLabel = 'Seedling';
  if (growth >= 0.9) stageLabel = 'Flourishing';
  else if (growth >= 0.7) stageLabel = 'Canopy';
  else if (growth >= 0.48) stageLabel = 'Young Tree';
  else if (growth >= 0.28) stageLabel = 'Sapling';

  let hydrationState = 'calm';
  if (habits.length > 0) {
    if (dueTotal === 0) {
      hydrationState = habitWatered > 0 ? 'hydrated' : 'calm';
    } else if (dueWatered === dueTotal) {
      hydrationState = 'hydrated';
    } else if (dueWatered > 0) {
      hydrationState = 'partial';
    } else {
      hydrationState = 'thirsty';
    }
  }

  return {
    subgoalDone,
    subgoalTotal,
    habitWatered,
    habitTotal,
    totalWaterings,
    growth,
    stageLabel,
    hydrationState,
  };
}

function isTreeFolder(folder) {
  if (!isFolder(folder)) return false;
  return folder.children.some(
    child =>
      (!isFolder(child) && child.name === '_tree.md') ||
      (isFolder(child) && (child.name === 'subgoals' || child.name === 'habits')),
  );
}

function listGarden(app, now = new Date()) {
  const indexFile = app.vault.getAbstractFileByPath(WE_PATH);
  const indexFm = !isFolder(indexFile) ? getFrontmatter(app, indexFile) : null;
  const members = Array.isArray(indexFm?.members)
    ? indexFm.members.filter(m => typeof m === 'string' && m.trim()).map(m => m.trim())
    : [];

  const root = app.vault.getAbstractFileByPath(ROOT);
  if (!isFolder(root)) {
    return { indexFile: isFolder(indexFile) ? null : indexFile, members, trees: [], looseItems: [] };
  }

  const trees = [];
  const looseFolders = [];
  const looseFiles = [];

  for (const entry of root.children) {
    if (isHiddenName(entry.name)) continue;
    if (isFolder(entry) && isTreeFolder(entry)) {
      const treeFile = entry.children.find(child => !isFolder(child) && child.name === '_tree.md') ?? null;
      const fm = getFrontmatter(app, treeFile);
      const subgoals = readSubgoals(app, entry);
      const habits = readHabits(app, entry, now);
      const extras = readExtraEntries(entry, new Set(['subgoals', 'habits']));
      trees.push({
        path: entry.path,
        folder: entry,
        indexFile: treeFile,
        title: readString(fm, 'title', entry.name),
        module: normalizeModule(fm?.module),
        goal: readString(fm, 'goal', ''),
        style: normalizeStyle(fm?.style),
        targets: parseTargets(fm?.targets),
        subgoals,
        habits,
        extras,
        stats: computeTreeStats(subgoals, habits),
      });
    } else if (isFolder(entry)) {
      looseFolders.push({
        kind: 'folder',
        name: entry.name,
        path: entry.path,
        entry,
        children: readExtraEntries(entry),
      });
    } else {
      looseFiles.push({
        kind: 'file',
        name: stripExt(entry),
        path: entry.path,
        file: entry,
      });
    }
  }

  trees.sort((a, b) => compareNames(a.title, b.title));
  looseFolders.sort((a, b) => compareNames(a.name, b.name));
  looseFiles.sort((a, b) => compareNames(a.name, b.name));

  return {
    indexFile: isFolder(indexFile) ? null : indexFile,
    members,
    trees,
    looseItems: [...looseFolders, ...looseFiles],
  };
}

function findTreeContext(app, file) {
  const path = file?.path;
  if (typeof path !== 'string' || !path.startsWith(`${ROOT}/`)) return null;
  const rest = path.slice(ROOT.length + 1);
  const treeName = rest.split('/')[0];
  if (!treeName || isHiddenName(treeName)) return null;
  const treePath = `${ROOT}/${treeName}`;
  const folder = app.vault.getAbstractFileByPath(treePath);
  return isTreeFolder(folder) ? treePath : null;
}

module.exports = {
  compareNames,
  computeTreeStats,
  isTreeFolder,
  listGarden,
  findTreeContext,
};
