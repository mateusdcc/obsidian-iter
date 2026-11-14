const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockApp } = require('./obsidian-mock');
const { createTree, createSubgoal, createHabit, ensureStructure } = require('../src/storage');
const { IterPanelView } = require('../src/panel-view');
const { GardenView } = require('../src/garden-view');
const { CreateTreeModal, CreateSubgoalModal, CreateHabitModal } = require('../src/modals');

function createMockElement(tagName, attrs = {}) {
  const el = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    attributes: new Map(),
    listeners: new Map(),
    className: '',
    textContent: '',
    value: '',
    required: false,
    disabled: false,
    addClass(cls) {
      for (const part of String(cls).split(/\s+/).filter(Boolean)) {
        const cur = new Set(this.className.split(/\s+/).filter(Boolean));
        cur.add(part);
        this.className = Array.from(cur).join(' ');
      }
    },
    empty() {
      this.children = [];
      this.textContent = '';
    },
    setAttribute(key, val) {
      this.attributes.set(key, String(val));
      if (key === 'class') this.className = String(val);
    },
    getAttribute(key) {
      return this.attributes.get(key) ?? null;
    },
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    focus() {},
    createEl(tag, opts = {}) {
      const child = createMockElement(tag);
      if (opts.cls) child.addClass(opts.cls);
      if (opts.text !== undefined) child.textContent = String(opts.text);
      if (opts.type) child.setAttribute('type', opts.type);
      if (opts.value !== undefined) child.value = String(opts.value);
      if (opts.placeholder) child.setAttribute('placeholder', opts.placeholder);
      if (opts.attr) {
        for (const [k, v] of Object.entries(opts.attr)) child.setAttribute(k, v);
      }
      this.children.push(child);
      return child;
    },
    createDiv(opts = {}) {
      return this.createEl('div', opts);
    },
    createSpan(opts = {}) {
      return this.createEl('span', opts);
    },
    findAll(predicate, acc = []) {
      if (predicate(this)) acc.push(this);
      for (const child of this.children) child.findAll(predicate, acc);
      return acc;
    },
  };
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

test('IterPanelView and GardenView render trees, subgoals, habits, and modals cleanly', async () => {
  const prevDocument = global.document;
  global.document = {
    createElementNS(_ns, tag) {
      return createMockElement(tag);
    },
  };

  try {
    const app = createMockApp();
    app.workspace = {
      getActiveFile() { return null; },
      getMostRecentLeaf() { return null; },
      on() { return {}; },
    };

    await ensureStructure(app.vault);
    await createTree(app.vault, { name: 'Gym', module: 'gym', goal: 'Reach 70kg @ 12% bf' });
    await createSubgoal(app.vault, { treePath: 'Iter/Gym', name: 'Bench 80kg', target: '80kg x 5' });
    await createHabit(app.vault, { treePath: 'Iter/Gym', name: 'Go to the Gym', frequency: 'daily' });

    const pluginStub = {
      gardenViewType: 'iter-garden',
      promptCreateTree() {},
      promptCreateSubgoal() {},
      promptCreateHabit() {},
      openGarden() {},
      openFile() {},
      scheduleRefresh() {},
    };

    const panel = new IterPanelView({ app }, pluginStub);
    panel.contentEl = createMockElement('div');
    panel.render();

    const weButtons = panel.contentEl.findAll(el => el.className.includes('iter-we-row'));
    assert.equal(weButtons.length, 1);
    const treeRows = panel.contentEl.findAll(el => el.className.includes('iter-tree-row'));
    assert.equal(treeRows.length, 1);
    const subgoalRows = panel.contentEl.findAll(el => el.className.includes('iter-subgoal-row'));
    assert.equal(subgoalRows.length, 1);
    const habitRows = panel.contentEl.findAll(el => el.className.includes('iter-habit-row'));
    assert.equal(habitRows.length, 1);

    const garden = new GardenView({ app }, pluginStub);
    garden.contentEl = createMockElement('div');
    garden.selectedTreePath = 'Iter/Gym';
    garden.render();

    const svgs = garden.contentEl.findAll(el => el.tagName === 'SVG');
    assert.equal(svgs.length, 2); // pot card + inspector preview
    const inspector = garden.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-inspector'));
    assert.equal(inspector.length, 1);

    // Exercise modals
    for (const modal of [
      new CreateTreeModal(app, { onSubmit: async () => {} }),
      new CreateSubgoalModal(app, { trees: [{ path: 'Iter/Gym', title: 'Gym' }], initialTreePath: 'Iter/Gym', onSubmit: async () => {} }),
      new CreateHabitModal(app, { trees: [{ path: 'Iter/Gym', title: 'Gym' }], initialTreePath: 'Iter/Gym', onSubmit: async () => {} }),
    ]) {
      modal.contentEl = createMockElement('div');
      modal.onOpen();
      assert.ok(modal.contentEl.children.length >= 2);
      modal.onClose();
    }
  } finally {
    global.document = prevDocument;
  }
});
