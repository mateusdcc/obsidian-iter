const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockApp } = require('./obsidian-mock');
const {
  ensureStructure,
  createTree,
  createSubgoal,
  createHabit,
  toggleSubgoal,
  waterHabit,
} = require('../src/storage');
const { listGarden, findTreeContext } = require('../src/catalog');

test('listGarden hides _index, aggregates trees/subgoals/habits, and surfaces extra files', async () => {
  const app = createMockApp();
  await ensureStructure(app.vault);

  const treeFile = await createTree(app.vault, {
    name: 'Gym',
    module: 'gym',
    goal: '70kg @ 12% bf',
  });
  const sub1 = await createSubgoal(app.vault, { treePath: 'Iter/Gym', name: 'Bench 80kg' });
  await createSubgoal(app.vault, { treePath: 'Iter/Gym', name: 'Squat 120kg' });
  const habit1 = await createHabit(app.vault, {
    treePath: 'Iter/Gym',
    name: 'Go to the Gym',
    frequency: 'daily',
  });

  // Add a custom note inside tree and a loose file in Iter/
  await app.vault.create('Iter/Gym/Workout Split.md', '# Split\n');
  await app.vault.create('Iter/Manifesto.md', '# Manifesto\n');

  const now = new Date(2026, 10, 13, 12, 0, 0);
  await toggleSubgoal(app, sub1);
  await waterHabit(app, habit1, now);

  const garden = listGarden(app, now);
  assert.equal(garden.indexFile.path, 'Iter/_index/We.md');
  assert.equal(garden.trees.length, 1);

  const gym = garden.trees[0];
  assert.equal(gym.title, 'Gym');
  assert.equal(gym.subgoals.length, 2);
  assert.equal(gym.habits.length, 1);
  assert.equal(gym.extras.length, 1);
  assert.equal(gym.extras[0].name, 'Workout Split');

  assert.equal(gym.stats.subgoalDone, 1);
  assert.equal(gym.stats.subgoalTotal, 2);
  assert.equal(gym.stats.habitWatered, 1);
  assert.equal(gym.stats.habitTotal, 1);
  assert.equal(gym.stats.hydrationState, 'hydrated');
  assert.ok(gym.stats.growth > 0.4);

  // _index must not appear as a tree or loose item
  assert.equal(garden.looseItems.length, 1);
  assert.equal(garden.looseItems[0].name, 'Manifesto');

  // findTreeContext resolves tree folder from any file inside the tree
  assert.equal(findTreeContext(app, treeFile), 'Iter/Gym');
  assert.equal(findTreeContext(app, sub1), 'Iter/Gym');
  assert.equal(findTreeContext(app, habit1), 'Iter/Gym');
  assert.equal(findTreeContext(app, garden.indexFile), null);
});
