const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockApp } = require('./obsidian-mock');
const { ensureStructure, createTree, createSubgoal, createHabit, waterHabit, updateHabitSchedule } = require('../src/storage');
const {
  readGoalDocument,
  updateGoalMeta,
  addDataset,
  updateDataset,
  addDatasetEntry,
  updateDatasetEntry,
  removeDatasetEntry,
  addWidget,
  updateWidget,
  removeWidget,
  computeStat,
  computeGoalBar,
  resolveDatasetEntries,
  resolveNumericSeries,
  formatDueStatus,
  discoverChildDatasets,
  resolveVirtualDataset,
  resolveWidgetDataset,
  describeRelation,
} = require('../src/data-model');
const {
  collectCanvasContext,
  evaluatePipeline,
  buildPipelineTemplate,
  buildPipelineFromSimpleConfig,
  autoLayoutPipeline,
} = require('../src/pipeline');
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

test('Reading tree scenario: generic child rollups aggregate counters across habits and auto-include new children', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  const readingTree = await createTree(app.vault, { name: 'Reading', module: 'learning', endless: true });

  const poemsHabit = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read poems', frequency: 'daily' });
  const essaysHabit = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read philosophical essays', frequency: 'weekly' });
  const booksHabit = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read literature book', frequency: 'monthly' });
  const subgoal = await createSubgoal(app.vault, { treePath: 'Iter/Reading', name: 'Reading list notes' });

  const poemsDs = await addDataset(app, poemsHabit, { name: 'Poems read', type: 'number_time', unit: 'poems' });
  await addDatasetEntry(app, poemsHabit, poemsDs.id, { value: 2, date: '2026-11-10' });
  await addDatasetEntry(app, poemsHabit, poemsDs.id, { value: 3, date: '2026-11-12' });

  const essaysDs = await addDataset(app, essaysHabit, { name: 'Essays read', type: 'number_time', unit: 'essays' });
  await addDatasetEntry(app, essaysHabit, essaysDs.id, { value: 1, date: '2026-11-11' });
  await addDatasetEntry(app, essaysHabit, essaysDs.id, { value: 2, date: '2026-11-13' });

  const booksDs = await addDataset(app, booksHabit, { name: 'Books read', type: 'number_time', unit: 'books' });
  await addDatasetEntry(app, booksHabit, booksDs.id, { value: 1, date: '2026-11-14' });

  // Non-numeric list on subgoal should be excluded by dataFilter: 'numeric'
  const textDs = await addDataset(app, subgoal, { name: 'Favorite quotes', type: 'text' });
  await addDatasetEntry(app, subgoal, textDs.id, { value: 'To be is to be perceived' });

  // 1) Widget-level relation on Tree without any local dataset
  const sumWidget = await addWidget(app, readingTree, {
    title: 'Total items read',
    type: 'stat',
    agg: 'sum',
    unit: 'works',
    relation: { mode: 'query', childKinds: 'all', dataFilter: 'numeric', perChildAgg: 'all' },
  });
  assert.equal(sumWidget.datasetId, '');
  assert.equal(sumWidget.relation.dataFilter, 'numeric');

  let treeDoc = readGoalDocument(app, readingTree);
  let virtualWidgetDs = resolveWidgetDataset(app, sumWidget, new Map(), treeDoc);
  assert.equal(virtualWidgetDs.sources.length, 3);
  assert.equal(virtualWidgetDs.unit, 'works');
  let stat = computeStat(app, virtualWidgetDs, 'sum', readingTree.path);
  assert.equal(stat.value, 9);
  assert.equal(stat.count, 5);

  // Mixed child units without explicit unit leaves inferred unit empty
  const autoUnitDs = resolveVirtualDataset(
    app,
    { id: 'u', name: 'Auto', relation: { mode: 'query', childKinds: 'all', dataFilter: 'numeric' } },
    readingTree.path,
    'Iter/Reading',
  );
  assert.equal(autoUnitDs.unit, '');

  // Shared unit across picked children infers that shared unit automatically
  const pageHabit1 = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read poetry pages', frequency: 'daily' });
  const p1 = await addDataset(app, pageHabit1, { name: 'Pages A', type: 'number_time', unit: 'pages' });
  await addDatasetEntry(app, pageHabit1, p1.id, { value: 15, date: '2026-11-10' });
  const pageHabit2 = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read essay pages', frequency: 'daily' });
  const p2 = await addDataset(app, pageHabit2, { name: 'Pages B', type: 'number_time', unit: 'pages' });
  await addDatasetEntry(app, pageHabit2, p2.id, { value: 25, date: '2026-11-11' });

  const pickedPages = resolveVirtualDataset(
    app,
    {
      id: 'picked-pages',
      name: 'Combined pages',
      relation: {
        mode: 'pick',
        dataFilter: 'any',
        perChildAgg: 'sum',
        refs: [
          { filePath: pageHabit1.path, datasetId: p1.id },
          { filePath: pageHabit2.path, datasetId: p2.id },
        ],
      },
    },
    readingTree.path,
    'Iter/Reading',
  );
  assert.equal(pickedPages.unit, 'pages');
  assert.equal(computeStat(app, pickedPages, 'sum', readingTree.path).value, 40);
  const perChildSeries = resolveNumericSeries(app, pickedPages, readingTree.path);
  assert.equal(perChildSeries.length, 2);
  assert.equal(perChildSeries[0].sourceTitle, 'Read poetry pages');
  assert.equal(perChildSeries[0].value, 15);
  assert.equal(perChildSeries[1].sourceTitle, 'Read essay pages');
  assert.equal(perChildSeries[1].value, 25);

  // 2) Named rollup dataset on Tree with nameMatch and automatic inclusion of later children
  const rollupDs = await addDataset(app, readingTree, {
    name: 'Works read rollup',
    type: 'rollup',
    unit: 'reads',
    relation: { mode: 'query', childKinds: 'habits', dataFilter: 'numeric', nameMatch: 'read', perChildAgg: 'all' },
  });
  await assert.rejects(
    () => addDatasetEntry(app, readingTree, rollupDs.id, { value: 1, date: '2026-11-14' }),
    /computed automatically/,
  );

  // Only "Poems read", "Essays read", "Books read" match nameMatch: 'read' (Wait: Habits are Read poetry pages too -> nameMatch matches childTitle OR dataset name!)
  // Test narrower nameMatch filtering exclusively poems vs adding a future child with 'journal read'
  const poemOnly = resolveVirtualDataset(
    app,
    {
      id: 'poems-only',
      name: 'Poems only',
      relation: { mode: 'query', childKinds: 'habits', dataFilter: 'numeric', nameMatch: 'poems', perChildAgg: 'all' },
    },
    readingTree.path,
    'Iter/Reading',
  );
  assert.equal(poemOnly.sources.length, 1);
  assert.equal(computeStat(app, poemOnly, 'sum', readingTree.path).value, 5);

  // Future habit added later automatically joins query rollup
  const futureHabit = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Short stories', frequency: 'weekly' });
  const futureDs = await addDataset(app, futureHabit, { name: 'Stories pages', type: 'number_time', unit: 'pages' });
  await addDatasetEntry(app, futureHabit, futureDs.id, { value: 12, date: '2026-11-15' });

  const discovered = discoverChildDatasets(app, 'Iter/Reading');
  assert.equal(discovered.length, 7);

  treeDoc = readGoalDocument(app, readingTree);
  const updatedVirtual = resolveWidgetDataset(app, sumWidget, new Map(), treeDoc);
  assert.equal(updatedVirtual.sources.length, 6);
  // 2+3 + 1+2 + 1 + 15 + 25 + 12 = 61
  assert.equal(computeStat(app, updatedVirtual, 'sum', readingTree.path).value, 61);
  assert.equal(describeRelation(pickedPages.relation, pickedPages.sources), '2 selected lists · Sum per child');
  assert.equal(describeRelation(updatedVirtual.relation, updatedVirtual.sources), 'Tree children · Numeric');
});

test('Generic child rollups also support note_time scores and text collections across subgoals', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  const langTree = await createTree(app.vault, { name: 'Japanese', module: 'learning' });
  const subA1 = await createSubgoal(app.vault, { treePath: 'Iter/Japanese', name: 'Reach N5' });
  const subA2 = await createSubgoal(app.vault, { treePath: 'Iter/Japanese', name: 'Reach N4' });

  const mock1 = await app.vault.create('Mocks/N5 Mock 1.md', '---\nscore: 70\n---\n');
  const mock2 = await app.vault.create('Mocks/N4 Mock 1.md', '---\nscore: 90\n---\n');

  const ds1 = await addDataset(app, subA1, { name: 'N5 Mocks', type: 'note_time', metricKey: 'score' });
  await addDatasetEntry(app, subA1, ds1.id, { path: mock1.path, date: '2026-11-01', score: 70 });

  const ds2 = await addDataset(app, subA2, { name: 'N4 Mocks', type: 'note_time', metricKey: 'score' });
  await addDatasetEntry(app, subA2, ds2.id, { path: mock2.path, date: '2026-11-10', score: 90 });

  const vocabHabit = await createHabit(app.vault, { treePath: 'Iter/Japanese', name: 'Vocab', frequency: 'daily' });
  const wordsDs = await addDataset(app, vocabHabit, { name: 'Words', type: 'text' });
  await addDatasetEntry(app, vocabHabit, wordsDs.id, { value: 'neko' });

  const scoresRollup = resolveVirtualDataset(
    app,
    { id: 'all-mocks', name: 'All Mock Scores', relation: { mode: 'query', childKinds: 'subgoals', dataFilter: 'note' } },
    langTree.path,
    'Iter/Japanese',
  );
  assert.equal(scoresRollup.type, 'note_time');
  assert.equal(scoresRollup.sources.length, 2);
  assert.equal(computeStat(app, scoresRollup, 'average', langTree.path).value, 80);

  const notesSeries = resolveNumericSeries(app, scoresRollup, langTree.path);
  assert.equal(notesSeries.length, 2);
  assert.equal(notesSeries[0].noteFile.path, 'Mocks/N5 Mock 1.md');
  assert.equal(notesSeries[1].sourceFile.path, subA2.path);

  const textRollup = resolveVirtualDataset(
    app,
    { id: 'all-words', name: 'All Words', relation: { mode: 'query', childKinds: 'habits', dataFilter: 'text' } },
    langTree.path,
    'Iter/Japanese',
  );
  assert.equal(textRollup.type, 'text');
  assert.equal(textRollup.resolvedEntries.length, 1);
  assert.equal(textRollup.resolvedEntries[0].label, 'neko');
});

test('plain note and note_time support multiple frontmatter properties and per-property widgets', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  await createTree(app.vault, { name: 'Philosophy' });
  const habit = await createHabit(app.vault, { treePath: 'Iter/Philosophy', name: 'Read Philosophical Essay' });

  await app.vault.create(
    'Notes/Republic.md',
    '---\nchapters: 4\npages: 110\nauthor: Plato\n---\n# Notes on Republic\n',
  );
  await app.vault.create(
    'Notes/Ethics.md',
    '---\nchapters: 2\n---\n# Nicomachean Ethics\n',
  );

  // Plain 'note' dataset with multiple frontmatter properties
  const refNotesDs = await addDataset(app, habit, {
    name: 'Source Texts',
    type: 'note',
    unit: '',
    metricKeys: ['chapters', 'pages', 'author'],
  });
  assert.deepEqual(refNotesDs.metricKeys, ['chapters', 'pages', 'author']);
  assert.equal(refNotesDs.metricKey, 'chapters');

  await addDatasetEntry(app, habit, refNotesDs.id, { path: 'Notes/Republic.md' });
  await addDatasetEntry(app, habit, refNotesDs.id, {
    path: 'Notes/Ethics.md',
    props: { pages: 45, author: 'Aristotle' },
  });

  // Backwards-compatible metricOverride selects chapters vs pages from one 'note' dataset
  const entriesDefault = resolveDatasetEntries(app, refNotesDs, habit.path);
  assert.equal(entriesDefault.length, 2);
  assert.equal(entriesDefault[0].value, 4);
  assert.equal(entriesDefault[0].fields.pages, 110);
  assert.equal(entriesDefault[0].fields.author, 'Plato');
  assert.deepEqual(
    entriesDefault[0].propsList.map(p => [p.key, p.raw]),
    [['chapters', 4], ['pages', 110], ['author', 'Plato']],
  );
  // Live frontmatter (chapters: 2) merged with inline props fallback (pages: 45, author: Aristotle)
  assert.equal(entriesDefault[1].value, 2);
  assert.equal(entriesDefault[1].fields.pages, 45);
  assert.equal(entriesDefault[1].fields.author, 'Aristotle');

  const entriesPages = resolveDatasetEntries(app, refNotesDs, habit.path, 'pages');
  assert.deepEqual(entriesPages.map(e => e.value), [110, 45]);

  const chaptersWidget = await addWidget(app, habit, {
    title: 'Chapters read',
    type: 'stat',
    datasetId: refNotesDs.id,
    metricKey: 'chapters',
    agg: 'sum',
  });
  const pagesWidget = await addWidget(app, habit, {
    title: 'Pages read',
    type: 'stat',
    datasetId: refNotesDs.id,
    metricKey: 'pages',
    agg: 'sum',
  });
  const doc = readGoalDocument(app, habit);
  const byId = new Map(doc.datasets.map(d => [d.id, d]));
  const dsChapters = resolveWidgetDataset(app, chaptersWidget, byId, doc);
  const dsPages = resolveWidgetDataset(app, pagesWidget, byId, doc);
  assert.equal(computeStat(app, dsChapters, 'sum', habit.path, chaptersWidget.metricKey).value, 6);
  assert.equal(computeStat(app, dsPages, 'sum', habit.path, pagesWidget.metricKey).value, 155);
  const seriesPages = resolveNumericSeries(app, dsPages, habit.path, pagesWidget.metricKey);
  assert.deepEqual(seriesPages.map(p => p.value), [110, 45]);

  // 'note_time' dataset with multiple frontmatter params
  await app.vault.create(
    'Notes/Essay-1.md',
    '---\nchapters: 3\npages: 40\n---\nChapter notes\n',
  );
  await app.vault.create(
    'Notes/Essay-2.md',
    '---\nchapters: 5\npages: 65\n---\nMore notes\n',
  );
  const timedDs = await addDataset(app, habit, {
    name: 'Timed Analyses',
    type: 'note_time',
    metricKeys: 'chapters, pages',
  });
  assert.deepEqual(timedDs.metricKeys, ['chapters', 'pages']);
  await addDatasetEntry(app, habit, timedDs.id, { path: 'Notes/Essay-1.md', date: '2026-06-01' });
  await addDatasetEntry(app, habit, timedDs.id, { path: 'Notes/Essay-2.md', date: '2026-06-08' });

  const chaptersTimedStat = computeStat(app, timedDs, 'sum', habit.path, 'chapters');
  const pagesTimedStat = computeStat(app, timedDs, 'sum', habit.path, 'pages');
  assert.equal(chaptersTimedStat.value, 8);
  assert.equal(pagesTimedStat.value, 105);
});

test('pipeline evaluates heterogeneous Reading tree Page Reads, watering logs, math/group/sort/merge, templates, and cycles safely', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);
  const treeFile = await createTree(app.vault, { name: 'Reading', endless: true });
  const hEssays = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read Philosophical Essays' });
  const hBook = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read Literature Book', frequency: 'monthly' });
  const hPoems = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read Poems' });

  await waterHabit(app, hPoems, new Date('2026-10-01T12:00:00'));
  await waterHabit(app, hPoems, new Date('2026-10-02T12:00:00'));

  await app.vault.create('Notes/Montaigne.md', '---\nchapters: 3\npages: 45\ntopic: skeptic\n---\n');
  await app.vault.create('Notes/Seneca.md', '---\nchapters: 2\npages: 60\ntopic: stoic\n---\n');

  const essayNotes = await addDataset(app, hEssays, {
    name: 'Chapter Analyses',
    type: 'note_time',
    metricKeys: ['chapters', 'pages'],
  });
  await addDatasetEntry(app, hEssays, essayNotes.id, { path: 'Notes/Montaigne.md', date: '2026-10-05' });
  await addDatasetEntry(app, hEssays, essayNotes.id, { path: 'Notes/Seneca.md', date: '2026-09-20' });

  const bookPages = await addDataset(app, hBook, { name: 'Pages read', type: 'number_time', unit: 'pages' });
  await addDatasetEntry(app, hBook, bookPages.id, { value: 180, date: '2026-10-10' });
  await addDatasetEntry(app, hBook, bookPages.id, { value: 60, date: '2026-10-12' });

  const booksCount = await addDataset(app, hBook, { name: 'Books read', type: 'number_time', unit: 'books' });
  await addDatasetEntry(app, hBook, booksCount.id, { value: 2, date: '2026-10-12' });

  const poemsRead = await addDataset(app, hPoems, { name: 'Poems read', type: 'number_time', unit: 'poems' });
  await addDatasetEntry(app, hPoems, poemsRead.id, { value: 15, date: '2026-10-03' });

  const treeDoc = await readGoalDocument(app, treeFile);
  const ctx = collectCanvasContext(app, treeDoc);
  assert.ok(ctx.fieldNames.includes('pages'));
  assert.ok(ctx.fieldNames.includes('chapters'));
  assert.ok(ctx.fieldNames.includes('topic'));
  assert.ok(ctx.datasetNames.includes('Pages read'));
  assert.equal(ctx.childTitles.length, 3);

  // Page Reads flow: include datasets named like "page" OR entries with numeric "pages" frontmatter -> 45+60+180+60 = 345
  const pageReadsFlow = {
    nodes: [
      { id: 'src', type: 'source', config: { scope: 'tree_children', datasetFilter: 'any' } },
      {
        id: 'flt',
        type: 'filter',
        config: {
          match: 'any',
          rules: [
            { field: 'datasetName', op: 'contains', value: 'page' },
            { field: 'pages', op: 'is_number', value: '' },
          ],
        },
      },
      { id: 'ext', type: 'extract', config: { field: 'pages', fallbackToValue: true, dropMissing: true, unit: 'pages' } },
      { id: 'out', type: 'output', config: { displayType: 'stat', agg: 'sum', unit: 'pages' } },
    ],
    edges: [
      { id: 'e1', from: 'src', to: 'flt' },
      { id: 'e2', from: 'flt', to: 'ext' },
      { id: 'e3', from: 'ext', to: 'out' },
    ],
  };

  const res = evaluatePipeline(app, pageReadsFlow, treeDoc, new Date('2026-10-15T12:00:00'));
  assert.equal(res.nodeResults.get('src').count, 6);
  assert.equal(res.nodeResults.get('flt').count, 4);
  assert.equal(res.output.stat.value, 345);
  assert.equal(res.output.stat.unit, 'pages');

  // Group by habit + chart output + math + sort limit
  const groupedFlow = {
    nodes: [
      ...pageReadsFlow.nodes.slice(0, 3),
      { id: 'mth', type: 'math', config: { op: 'divide', operand: 2, unit: 'pages/2' } },
      { id: 'grp', type: 'group', config: { by: 'sourceTitle', agg: 'sum' } },
      { id: 'srt', type: 'sort', config: { by: 'value_desc', limit: 2 } },
      { id: 'out', type: 'output', config: { displayType: 'chart', variant: 'bar' } },
    ],
    edges: [
      { id: 'e1', from: 'src', to: 'flt' },
      { id: 'e2', from: 'flt', to: 'ext' },
      { id: 'e3', from: 'ext', to: 'mth' },
      { id: 'e4', from: 'mth', to: 'grp' },
      { id: 'e5', from: 'grp', to: 'srt' },
      { id: 'e6', from: 'srt', to: 'out' },
    ],
  };
  const groupedRes = evaluatePipeline(app, groupedFlow, treeDoc, new Date('2026-10-15T12:00:00'));
  assert.equal(groupedRes.output.displayType, 'chart');
  assert.equal(groupedRes.output.variant, 'bar');
  assert.deepEqual(
    groupedRes.output.points.map(p => [p.label, p.value]),
    [
      ['Read Philosophical Essays', 52.5],
      ['Read Literature Book', 120],
    ],
  );

  // this_month + within_days filters + note_navigator + merge dedupe by path
  const filteredNotesRes = evaluatePipeline(
    app,
    {
      nodes: [
        { id: 's1', type: 'source', config: { scope: 'tree_children', datasetFilter: 'note' } },
        { id: 's2', type: 'source', config: { scope: 'tree_children', datasetFilter: 'note' } },
        { id: 'm', type: 'merge', config: { dedupe: 'path' } },
        {
          id: 'f',
          type: 'filter',
          config: {
            match: 'all',
            rules: [
              { field: 'date', op: 'this_month', value: '' },
              { field: 'date', op: 'within_days', value: '12' },
            ],
          },
        },
        { id: 'o', type: 'output', config: { displayType: 'note_navigator' } },
      ],
      edges: [
        { id: 'e1', from: 's1', to: 'm' },
        { id: 'e2', from: 's2', to: 'm' },
        { id: 'e3', from: 'm', to: 'f' },
        { id: 'e4', from: 'f', to: 'o' },
      ],
    },
    treeDoc,
    new Date('2026-10-15T12:00:00'),
  );
  assert.equal(filteredNotesRes.nodeResults.get('m').count, 2);
  assert.deepEqual(filteredNotesRes.output.entries.map(e => e.path), ['Notes/Montaigne.md']);

  // Watering log source node + cycle safety
  const waterRes = evaluatePipeline(
    app,
    {
      nodes: [
        { id: 'w', type: 'water_source', config: { scope: 'tree_habits', nameMatch: 'Poems' } },
        { id: 'o', type: 'output', config: { displayType: 'stat', agg: 'sum' } },
      ],
      edges: [
        { id: 'e1', from: 'w', to: 'o' },
        { id: 'e_cycle', from: 'o', to: 'w' },
      ],
    },
    treeDoc,
  );
  assert.equal(waterRes.output.stat.value, 2);

  // Templates & simple-to-canvas converter + persistence via addWidget / updateWidget
  const tpl = buildPipelineTemplate('filter_field', treeDoc, ctx);
  assert.equal(tpl.nodes[2].config.field, 'pages');
  const fromSimple = buildPipelineFromSimpleConfig(
    {
      type: 'stat',
      metricKey: 'pages',
      unit: 'pg',
      relation: { mode: 'query', childKinds: 'all', dataFilter: 'any', nameMatch: '' },
    },
    treeDoc,
  );
  assert.ok(fromSimple.nodes.some(n => n.type === 'extract' && n.config.field === 'pages'));
  const laidOut = autoLayoutPipeline(fromSimple);
  assert.ok(laidOut.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)));

  const savedWidget = await addWidget(app, treeFile, {
    title: 'Total Pages Read',
    type: 'pipeline',
    pipeline: pageReadsFlow,
  });
  assert.equal(savedWidget.type, 'pipeline');
  assert.equal(savedWidget.pipeline.nodes.length, 4);

  const updated = await updateWidget(app, treeFile, savedWidget.id, {
    title: 'Pages Breakdown',
    type: 'pipeline',
    pipeline: groupedFlow,
  });
  assert.equal(updated.title, 'Pages Breakdown');
  const reloadedTree = await readGoalDocument(app, treeFile);
  assert.equal(reloadedTree.widgets.length, 1);
  assert.equal(reloadedTree.widgets[0].title, 'Pages Breakdown');
  assert.equal(reloadedTree.widgets[0].pipeline.nodes.length, 7);

  // Simple rollup with metricOverride: 'pages' includes 'Pages read' (number_time) + 'pages' frontmatter, skips 'Poems read' & 'Books read'
  const simplePagesRollup = resolveVirtualDataset(
    app,
    {
      id: 'v_pages',
      name: 'Simple Pages',
      relation: { mode: 'query', childKinds: 'all', dataFilter: 'numeric', perChildAgg: 'all' },
    },
    treeFile.path,
    'Iter/Reading',
    'pages',
  );
  assert.equal(computeStat(app, simplePagesRollup, 'sum', treeFile.path, 'pages').value, 345);

  // updateDataset updates name, unit, and metricKeys in place while preserving entries
  const updatedEssayDs = await updateDataset(app, hEssays, essayNotes.id, {
    name: 'Essay Chapter Analyses',
    metricKeys: 'chapters, pages, topic',
  });
  assert.equal(updatedEssayDs.name, 'Essay Chapter Analyses');
  assert.deepEqual(updatedEssayDs.metricKeys, ['chapters', 'pages', 'topic']);
  assert.equal(updatedEssayDs.entries.length, 2);

  // updateDatasetEntry edits an existing entry in place
  const editedEntry = await updateDatasetEntry(app, hEssays, essayNotes.id, 0, {
    path: 'Notes/Eros-Ch1.md',
    date: '2026-04-03',
    props: { chapters: 2, pages: 25, topic: 'melancholy' },
  });
  assert.equal(editedEntry.props.chapters, 2);
  assert.equal(editedEntry.props.pages, 25);

  // updateHabitSchedule updates both frontmatter and the Markdown body Cadence line
  await updateHabitSchedule(app, hEssays, { frequency: 'weekdays', days: [1, 3, 5] });
  const habitMd = await app.vault.read(hEssays);
  assert.ok(habitMd.includes('Cadence: Mon, Wed, Fri'), 'Markdown body Cadence line should stay synced');
});
