const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockApp } = require('./obsidian-mock');
const { ensureStructure, createTree, createSubgoal, createHabit, waterHabit } = require('../src/storage');
const {
  readGoalDocument,
  updateGoalMeta,
  addDataset,
  addDatasetEntry,
  removeDatasetEntry,
  addWidget,
  removeWidget,
  computeStat,
  computeGoalBar,
  resolveNumericSeries,
  formatDueStatus,
} = require('../src/data-model');
const { computeChartGeometry } = require('../src/widget-art');

test('Benching PRs scenario: number_time dataset, goal bar, and PR chart', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  await createTree(app.vault, { name: 'Gym', module: 'gym' });
  const sub = await createSubgoal(app.vault, { treePath: 'Iter/Gym', name: 'Bench 100kg' });

  await updateGoalMeta(app, sub, {
    description: 'Reach 100kg flat bench press',
    due: '2026-12-31',
  });

  const ds = await addDataset(app, sub, { name: 'Benching PRs', type: 'number_time', unit: 'kg' });
  await addDatasetEntry(app, sub, ds.id, { value: 75, date: '2026-10-01' });
  await addDatasetEntry(app, sub, ds.id, { value: 85, date: '2026-11-13' });

  await addWidget(app, sub, {
    title: 'Latest vs Goal',
    type: 'goal_bar',
    datasetId: ds.id,
    mode: 'latest',
    target: 100,
  });

  const doc = readGoalDocument(app, sub);
  assert.equal(doc.description, 'Reach 100kg flat bench press');
  assert.equal(doc.due, '2026-12-31');
  assert.equal(doc.datasets.length, 1);

  const bar = computeGoalBar(app, doc.datasets[0], 'latest', 100, sub.path);
  assert.equal(bar.current, 85);
  assert.equal(bar.rawPercent, 85);
  assert.equal(bar.unit, 'kg');

  const series = resolveNumericSeries(app, doc.datasets[0], sub.path);
  const chartGeo = computeChartGeometry(series, { variant: 'bar' });
  assert.equal(chartGeo.coords.length, 2);
  assert.equal(chartGeo.coords[1].value, 85);
});

test('Daily Japanese lesson scenario: words list, notes list, and words/time sum + graph', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  await createTree(app.vault, { name: 'Learn Japanese', module: 'learning' });
  const habit = await createHabit(app.vault, {
    treePath: 'Iter/Learn Japanese',
    name: 'Do daily lesson',
    frequency: 'daily',
  });

  const vocabNote = await app.vault.create('Notes/Japanese Particles.md', '# Particles\n');

  const wordsDs = await addDataset(app, habit, { name: 'Words learnt', type: 'text' });
  await addDatasetEntry(app, habit, wordsDs.id, { value: '食べる' });
  await addDatasetEntry(app, habit, wordsDs.id, { value: '本' });

  const notesDs = await addDataset(app, habit, { name: 'My notes on Japanese', type: 'note' });
  await addDatasetEntry(app, habit, notesDs.id, { path: vocabNote.path });

  const countsDs = await addDataset(app, habit, { name: 'Words per day', type: 'number_time', unit: 'words' });
  await addDatasetEntry(app, habit, countsDs.id, { value: 10, date: '2026-11-11' });
  await addDatasetEntry(app, habit, countsDs.id, { value: 15, date: '2026-11-12' });
  await addDatasetEntry(app, habit, countsDs.id, { value: 12, date: '2026-11-13' });

  const doc = readGoalDocument(app, habit);
  const sumStat = computeStat(app, doc.datasets[2], 'sum', habit.path);
  assert.equal(sumStat.value, 37);
  assert.equal(sumStat.unit, 'words');

  const countWords = computeStat(app, doc.datasets[0], 'count', habit.path);
  assert.equal(countWords.value, 2);
});

test('Reach A1 mock exams scenario: note_time reads frontmatter scores for count, average, latest, and chart', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  await createTree(app.vault, { name: 'Learn Japanese', module: 'learning' });
  const goal = await createSubgoal(app.vault, { treePath: 'Iter/Learn Japanese', name: 'Reach A1' });

  const exam1 = await app.vault.create('Notes/Mock 1.md', '---\nscore: 60\n---\n# Mock 1');
  const exam2 = await app.vault.create('Notes/Mock 2.md', '---\nscore: 75\n---\n# Mock 2');
  const exam3 = await app.vault.create('Notes/Mock 3.md', '# Mock 3'); // score supplied inline

  const mocksDs = await addDataset(app, goal, {
    name: 'Mock Exams Done',
    type: 'note_time',
    metricKey: 'score',
  });
  await addDatasetEntry(app, goal, mocksDs.id, { path: exam1.path, date: '2026-11-01' });
  await addDatasetEntry(app, goal, mocksDs.id, { path: exam2.path, date: '2026-11-07' });
  await addDatasetEntry(app, goal, mocksDs.id, { path: exam3.path, date: '2026-11-13', value: 90 });

  const w1 = await addWidget(app, goal, { title: 'Exams', type: 'stat', datasetId: mocksDs.id, agg: 'count' });
  const w2 = await addWidget(app, goal, { title: 'Avg', type: 'stat', datasetId: mocksDs.id, agg: 'average' });
  const w3 = await addWidget(app, goal, { title: 'Latest', type: 'stat', datasetId: mocksDs.id, agg: 'latest' });

  let doc = readGoalDocument(app, goal);
  const ds = doc.datasets[0];

  assert.equal(computeStat(app, ds, 'count', goal.path).value, 3);
  assert.equal(computeStat(app, ds, 'average', goal.path).value, 75);
  assert.equal(computeStat(app, ds, 'latest', goal.path).value, 90);

  const series = resolveNumericSeries(app, ds, goal.path);
  assert.deepEqual(series.map(p => p.value), [60, 75, 90]);

  await removeDatasetEntry(app, goal, ds.id, 0);
  await removeWidget(app, goal, w1.id);
  doc = readGoalDocument(app, goal);
  assert.equal(doc.datasets[0].entries.length, 2);
  assert.equal(doc.widgets.length, 2);
  assert.ok(w2.id && w3.id);

  const due = formatDueStatus('2026-11-20', new Date(2026, 10, 13, 12, 0, 0));
  assert.equal(due.badge, '7d left');
  assert.equal(due.tone, 'soon');
});

test('Habit streak widget works without datasets and createHabit seeds default streak widget', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  await createTree(app.vault, { name: 'Gym', module: 'gym' });
  const habit = await createHabit(app.vault, {
    treePath: 'Iter/Gym',
    name: 'Morning Run',
    frequency: 'weekdays',
    days: ['mon', 'wed', 'fri'],
  });

  let doc = readGoalDocument(app, habit);
  assert.equal(doc.datasets.length, 0);
  assert.equal(doc.widgets.length, 1);
  assert.equal(doc.widgets[0].type, 'streak');
  assert.equal(doc.widgets[0].id, 'w_streak');

  await removeWidget(app, habit, 'w_streak');
  doc = readGoalDocument(app, habit);
  assert.equal(doc.widgets.length, 0);

  const added = await addWidget(app, habit, { type: 'streak', title: 'Run Streak' });
  assert.equal(added.type, 'streak');
  assert.equal(added.datasetId, '');

  await assert.rejects(
    () => addWidget(app, habit, { type: 'stat', datasetId: '' }),
    /Select a data list/,
  );

  await waterHabit(app, habit, new Date(2026, 10, 13, 10, 0, 0));
  doc = readGoalDocument(app, habit);
  assert.equal(doc.widgets.length, 1);
  assert.equal(doc.widgets[0].title, 'Run Streak');
  assert.deepEqual(doc.waterLog, ['2026-11-13']);
  assert.equal(doc.lastWatered, '2026-11-13');
});

test('readGoalDocument and updateGoalMeta distinguish endless trees from target-date trees', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  const gymTree = await createTree(app.vault, { name: 'Gym', module: 'gym', endless: true });
  const codeTree = await createTree(app.vault, { name: 'Coding', module: 'learning', due: '2027-01-15' });

  let gymDoc = readGoalDocument(app, gymTree);
  assert.equal(gymDoc.endless, true);
  assert.equal(gymDoc.due, '');

  // Attempting to set due while endless keeps due empty
  await updateGoalMeta(app, gymTree, { due: '2027-05-01' });
  gymDoc = readGoalDocument(app, gymTree);
  assert.equal(gymDoc.due, '');

  const codeDoc = readGoalDocument(app, codeTree);
  assert.equal(codeDoc.endless, false);
  assert.equal(codeDoc.due, '2027-01-15');
});
