const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockApp } = require('./obsidian-mock');
const IterPlugin = require('../src/plugin');
const { ROOT, INDEX_FOLDER, WE_PATH } = require('../src/storage');

test('IterPlugin onload ensures Iter structure and registers views and commands', async () => {
  const app = createMockApp();
  const leaves = [];
  const leftLeaf = {
    async setViewState(viewState) {
      this.viewState = viewState;
      leaves.push(this);
    },
  };
  app.workspace = {
    layoutReady: true,
    onLayoutReady() {},
    getLeavesOfType(type) {
      return leaves.filter(leaf => leaf.viewState?.type === type);
    },
    getLeftLeaf() {
      return leftLeaf;
    },
    async revealLeaf() {},
    detachLeavesOfType() {},
  };

  const plugin = new IterPlugin(app, { id: 'iter', name: 'Iter' });
  await plugin.onload();
  // Let microtask from onReady complete
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.ok(app.vault.getAbstractFileByPath(ROOT));
  assert.ok(app.vault.getAbstractFileByPath(INDEX_FOLDER));
  assert.ok(app.vault.getAbstractFileByPath(WE_PATH));

  assert.ok(plugin.views.has('iter-panel'));
  assert.ok(plugin.views.has('iter-garden'));

  const commandNames = plugin.commands.map(c => c.name);
  assert.ok(commandNames.includes('Create tree'));
  assert.ok(commandNames.includes('Create subgoal'));
  assert.ok(commandNames.includes('Create habit'));
  assert.ok(commandNames.includes('Open Iter panel'));
  assert.ok(commandNames.includes('Open We garden'));

  plugin.onunload();
});
