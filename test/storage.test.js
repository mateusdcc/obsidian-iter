const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockApp } = require('./obsidian-mock');
const {
  ROOT,
  INDEX_FOLDER,
  WE_PATH,
  ensureStructure,
  createTree,
  createSubgoal,
  createHabit,
  updateHabitSchedule,
  toggleSubgoal,
  waterHabit,
  isScheduledOnDate,
  isWateredInPeriod,
  computeHabitStreak,
  computeHabitStreakDetails,
  formatCadenceLabel,
  formatCadenceShort,
} = require('../src/storage');

test('ensureStructure creates Iter, _index, and We.md idempotently', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  assert.ok(app.vault.getAbstractFileByPath(ROOT));
  assert.ok(app.vault.getAbstractFileByPath(INDEX_FOLDER));
  assert.ok(app.vault.getAbstractFileByPath(WE_PATH));

  await ensureStructure(app.vault);
  assert.equal(app.vault.getAbstractFileByPath(WE_PATH).name, 'We.md');
});

test('createTree creates folder and _tree.md and rejects invalid or duplicate names', async () => {
  const app = createMockApp();
  const file = await createTree(app.vault, {
    name: '  Gym  ',
    module: 'gym',
    goal: 'Reach 70kg at 12% bf',
    style: 'bonsai',
  });

  assert.equal(file.path, 'Iter/Gym/_tree.md');
  const fm = app.metadataCache.getFileCache(file).frontmatter;
  assert.equal(fm.type, 'tree');
  assert.equal(fm.title, 'Gym');
  assert.equal(fm.module, 'gym');
  assert.equal(fm.goal, 'Reach 70kg at 12% bf');
  assert.equal(fm.style, 'bonsai');

  await assert.rejects(() => createTree(app.vault, { name: 'Gym' }), /already exists/);
  await assert.rejects(() => createTree(app.vault, { name: '_secret' }), /invalid/);
  await assert.rejects(() => createTree(app.vault, { name: 'a/b' }), /invalid/);
});

test('createSubgoal and toggleSubgoal manage subgoal files and done state', async () => {
  const app = createMockApp();
  await createTree(app.vault, { name: 'Gym', module: 'gym' });
  const sub = await createSubgoal(app.vault, {
    treePath: 'Iter/Gym',
    name: 'Bench 80kg',
    target: '80kg x 5',
  });

  assert.equal(sub.path, 'Iter/Gym/subgoals/Bench 80kg.md');
  assert.equal(app.metadataCache.getFileCache(sub).frontmatter.done, false);

  const next = await toggleSubgoal(app, sub);
  assert.equal(next, true);
  assert.equal(app.metadataCache.getFileCache(sub).frontmatter.done, true);

  const toggledBack = await toggleSubgoal(app, sub);
  assert.equal(toggledBack, false);
});

test('createHabit and waterHabit handle daily, weekly, and monthly watering and streaks', async () => {
  const app = createMockApp();
  await createTree(app.vault, { name: 'Learn Japanese', module: 'learning' });

  const dailyHabit = await createHabit(app.vault, {
    treePath: 'Iter/Learn Japanese',
    name: 'Memorize 10 words',
    frequency: 'daily',
    target: '10 words',
  });

  assert.equal(dailyHabit.path, 'Iter/Learn Japanese/habits/Memorize 10 words.md');

  const nov13 = new Date(2026, 10, 13, 10, 0, 0);
  const watered = await waterHabit(app, dailyHabit, nov13);
  assert.equal(watered, true);
  let fm = app.metadataCache.getFileCache(dailyHabit).frontmatter;
  assert.equal(fm.last_watered, '2026-11-13');
  assert.deepEqual(fm.water_log, ['2026-11-13']);

  // Calling again same day toggles off
  const unwatered = await waterHabit(app, dailyHabit, nov13);
  assert.equal(unwatered, false);
  fm = app.metadataCache.getFileCache(dailyHabit).frontmatter;
  assert.equal(fm.last_watered, null);
  assert.deepEqual(fm.water_log, []);

  // Weekly boundary check: Monday Nov 9 vs Sunday Nov 15 (same week) vs Monday Nov 16 (next week)
  assert.equal(
    isWateredInPeriod('2026-11-09', ['2026-11-09'], 'weekly', new Date(2026, 10, 15, 12, 0, 0)),
    true,
  );
  assert.equal(
    isWateredInPeriod('2026-11-09', ['2026-11-09'], 'weekly', new Date(2026, 10, 16, 12, 0, 0)),
    false,
  );

  // Monthly boundary check
  assert.equal(
    isWateredInPeriod('2026-11-02', ['2026-11-02'], 'monthly', new Date(2026, 10, 30, 12, 0, 0)),
    true,
  );
  assert.equal(
    isWateredInPeriod('2026-10-31', ['2026-10-31'], 'monthly', new Date(2026, 10, 1, 12, 0, 0)),
    false,
  );

  // Streak calculation
  assert.equal(
    computeHabitStreak(['2026-11-11', '2026-11-12', '2026-11-13'], 'daily', nov13),
    3,
  );
  assert.equal(
    computeHabitStreak(['2026-11-11', '2026-11-12'], 'daily', nov13),
    2,
  );
  assert.equal(
    computeHabitStreak(['2026-11-02', '2026-11-13'], 'weekly', nov13),
    2,
  );
  assert.equal(
    computeHabitStreak(['2026-09-10', '2026-10-15', '2026-11-13'], 'monthly', nov13),
    3,
  );
});

test('weekday-specific habits validate days, update repetitivity, compute streaks, and respect rest days', async () => {
  const app = createMockApp();
  await createTree(app.vault, { name: 'Gym', module: 'gym' });

  await assert.rejects(
    () => createHabit(app.vault, { treePath: 'Iter/Gym', name: 'Leg Day', frequency: 'weekdays', days: [] }),
    /Select at least one day/,
  );

  const habit = await createHabit(app.vault, {
    treePath: 'Iter/Gym',
    name: 'Leg Day',
    frequency: 'weekdays',
    days: ['thu', 'Wednesday'],
  });
  let fm = app.metadataCache.getFileCache(habit).frontmatter;
  assert.equal(fm.frequency, 'weekdays');
  assert.deepEqual(fm.days, ['wed', 'thu']);
  assert.equal(formatCadenceLabel(fm.frequency, fm.days), 'Wed, Thu');
  assert.equal(formatCadenceShort(fm.frequency, fm.days), 'We·Th');

  // Nov 11 (Wed), Nov 12 (Thu), Nov 13 (Fri - rest day)
  assert.equal(isScheduledOnDate('weekdays', ['wed', 'thu'], '2026-11-11'), true);
  assert.equal(isScheduledOnDate('weekdays', ['wed', 'thu'], '2026-11-12'), true);
  assert.equal(isScheduledOnDate('weekdays', ['wed', 'thu'], '2026-11-13'), false);

  const log = ['2026-11-04', '2026-11-05', '2026-11-11', '2026-11-12'];
  const fri = new Date(2026, 10, 13, 12, 0, 0);
  const wedBefore = new Date(2026, 10, 18, 9, 0, 0);
  const thuMissedWed = new Date(2026, 10, 19, 9, 0, 0);

  assert.equal(computeHabitStreak(log, 'weekdays', fri, ['wed', 'thu']), 4);
  assert.equal(computeHabitStreak(log, 'weekdays', wedBefore, ['wed', 'thu']), 4);
  assert.equal(computeHabitStreak(log, 'weekdays', thuMissedWed, ['wed', 'thu']), 0);

  // Rest day inherits completion of latest scheduled day (Thu Nov 12)
  assert.equal(isWateredInPeriod('2026-11-12', log, 'weekdays', fri, ['wed', 'thu']), true);
  assert.equal(isWateredInPeriod('2026-11-12', log, 'weekdays', wedBefore, ['wed', 'thu']), false);

  // Edit repetitivity to Mon, Wed, Fri then back to weekly
  await updateHabitSchedule(app, habit, { frequency: 'weekdays', days: ['fri', 'mon', 'wed'] });
  fm = app.metadataCache.getFileCache(habit).frontmatter;
  assert.equal(fm.frequency, 'weekdays');
  assert.deepEqual(fm.days, ['mon', 'wed', 'fri']);

  await updateHabitSchedule(app, habit, { frequency: 'weekly', days: [] });
  fm = app.metadataCache.getFileCache(habit).frontmatter;
  assert.equal(fm.frequency, 'weekly');
  assert.deepEqual(fm.days, []);
});

test('computeHabitStreak and computeHabitStreakDetails handle all repetitivities accurately', () => {
  // Weekdays: bonus waterings on unscheduled days never count and never bridge missed scheduled days
  const wedThuBonus = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-12'];
  const friNov13 = new Date(2026, 10, 13, 12, 0, 0);
  const wedThuDetails = computeHabitStreakDetails(wedThuBonus, 'weekdays', friNov13, ['wed', 'thu']);
  assert.equal(wedThuDetails.streak, 4);
  assert.equal(wedThuDetails.bestStreak, 4);
  assert.equal(wedThuDetails.recentSlots.length, 6);
  assert.ok(wedThuDetails.recentSlots.every(slot => !slot.key.endsWith('-06') && !slot.key.endsWith('-09')));
  assert.ok(wedThuDetails.recentSlots.every(slot => {
    const [y, m, d] = slot.key.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return dow === 3 || dow === 4;
  }));

  // Only off-day waterings yield 0 scheduled streak
  assert.equal(computeHabitStreak(['2026-11-06', '2026-11-09'], 'weekdays', friNov13, ['wed', 'thu']), 0);

  // Missed Wed Nov 11 resets current streak to 1 (Thu Nov 12), while bestStreak remains 2 (Nov 4+5)
  const missedWedLog = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-12'];
  const brokenWedDetails = computeHabitStreakDetails(missedWedLog, 'weekdays', friNov13, ['wed', 'thu']);
  assert.equal(brokenWedDetails.streak, 1);
  assert.equal(brokenWedDetails.bestStreak, 2);

  // Weekly: multiple waterings in the same week count once; skipping a week breaks streak
  const weeklyLog = ['2026-11-02', '2026-11-04', '2026-11-07', '2026-11-13'];
  assert.equal(computeHabitStreak(weeklyLog, 'weekly', friNov13), 2);
  assert.equal(computeHabitStreak(weeklyLog, 'weekly', new Date(2026, 10, 16, 12, 0, 0)), 2);
  const brokenWeekly = computeHabitStreakDetails(weeklyLog, 'weekly', new Date(2026, 10, 23, 12, 0, 0));
  assert.equal(brokenWeekly.streak, 0);
  assert.equal(brokenWeekly.bestStreak, 2);
  assert.equal(brokenWeekly.recentSlots.length, 6);

  // Monthly: multiple waterings in the same month count once; consecutive & historical best
  const monthlyLog = ['2026-06-01', '2026-07-12', '2026-08-19', '2026-09-02', '2026-11-02', '2026-11-13'];
  const monthlyDetails = computeHabitStreakDetails(monthlyLog, 'monthly', friNov13);
  assert.equal(monthlyDetails.streak, 1);
  assert.equal(monthlyDetails.bestStreak, 4);
  assert.equal(computeHabitStreak(monthlyLog, 'monthly', new Date(2026, 11, 5, 12, 0, 0)), 1);
  assert.equal(computeHabitStreak(['2026-10-05', '2026-11-13'], 'monthly', new Date(2026, 11, 5, 12, 0, 0)), 2);

  // Daily: historical best > current and merges lastWatered fallback
  const dailyDetails = computeHabitStreakDetails(
    ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-12'],
    'daily',
    friNov13,
    [],
    '2026-11-13',
  );
  assert.equal(dailyDetails.streak, 2);
  assert.equal(dailyDetails.bestStreak, 3);
  assert.equal(dailyDetails.recentSlots.length, 6);
});
