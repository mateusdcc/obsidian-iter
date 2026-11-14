const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockApp, Menu } = require('./obsidian-mock');
const IterPlugin = require('../src/plugin');
const { createTree, createSubgoal, createHabit, ensureStructure } = require('../src/storage');
const { IterPanelView } = require('../src/panel-view');
const { GardenView } = require('../src/garden-view');
const { GoalView } = require('../src/goal-view');
const { CreateTreeModal, CreateSubgoalModal, CreateHabitModal, EditHabitScheduleModal } = require('../src/modals');
const { AddDatasetModal, AddWidgetModal, NoteTimeMetaModal } = require('../src/goal-modals');
const { renderSchedulePicker } = require('../src/schedule-picker');
const { addDataset, addDatasetEntry, addWidget, updateGoalMeta } = require('../src/data-model');

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
    style: {},
    addClass(cls) {
      for (const part of String(cls).split(/\s+/).filter(Boolean)) {
        const cur = new Set(this.className.split(/\s+/).filter(Boolean));
        cur.add(part);
        this.className = Array.from(cur).join(' ');
      }
    },
    toggleClass(cls, force) {
      const cur = new Set(this.className.split(/\s+/).filter(Boolean));
      const enable = typeof force === 'boolean' ? force : !cur.has(cls);
      if (enable) cur.add(cls);
      else cur.delete(cls);
      this.className = Array.from(cur).join(' ');
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
      goalViewType: 'iter-goal',
      promptCreateTree() {},
      promptCreateSubgoal() {},
      promptCreateHabit() {},
      openGarden() {},
      openGoal() {},
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

    // Exercise GoalView with datasets and all 4 widget types
    const subFile = app.vault.getAbstractFileByPath('Iter/Gym/subgoals/Bench 80kg.md');
    const noteFile = await app.vault.create('Notes/Form Check.md', '---\nscore: 90\n---\n# Form');
    await updateGoalMeta(app, subFile, { description: 'Clean bench press', due: '2026-12-31' });
    const ds1 = await addDataset(app, subFile, { name: 'Benching PRs', type: 'number_time', unit: 'kg' });
    await addDatasetEntry(app, subFile, ds1.id, { value: 70, date: '2026-10-01' });
    await addDatasetEntry(app, subFile, ds1.id, { value: 75, date: '2026-11-13' });
    const ds2 = await addDataset(app, subFile, { name: 'Form Notes', type: 'note' });
    await addDatasetEntry(app, subFile, ds2.id, { path: noteFile.path });
    await addWidget(app, subFile, { title: 'Latest PR', type: 'stat', datasetId: ds1.id, agg: 'latest' });
    await addWidget(app, subFile, { title: 'Goal Bar', type: 'goal_bar', datasetId: ds1.id, mode: 'latest', target: 80 });
    await addWidget(app, subFile, { title: 'PR Trend', type: 'chart', datasetId: ds1.id, variant: 'bar' });
    await addWidget(app, subFile, { title: 'Notes', type: 'note_navigator', datasetId: ds2.id });

    const goalView = new GoalView({ app, updateHeader() {} }, pluginStub);
    goalView.contentEl = createMockElement('div');
    await goalView.setState({ file: subFile.path }, {});

    const widgetCards = goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-widget-card'));
    assert.equal(widgetCards.length, 4);
    const datasetCards = goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-dataset-card'));
    assert.equal(datasetCards.length, 2);
    const charts = goalView.contentEl.findAll(el => el.className.includes('iter-chart-svg'));
    assert.equal(charts.length, 1);

    // Habit GoalView renders inline repetitivity picker
    const habitFile = app.vault.getAbstractFileByPath('Iter/Gym/habits/Go to the Gym.md');
    await goalView.setState({ file: habitFile.path }, {});
    const scheduleBox = goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-goal-schedule'));
    assert.equal(scheduleBox.length, 1);

    // Schedule picker switches cadence and toggles Wed + Thu
    const pickerHost = createMockElement('div');
    let latestSchedule = null;
    const picker = renderSchedulePicker(pickerHost, {
      frequency: 'daily',
      days: [],
      onChange: val => { latestSchedule = val; },
    });
    const specificBtn = pickerHost.findAll(el => el.textContent === 'Specific days')[0];
    for (const fn of specificBtn.listeners.get('click') || []) fn();
    const wedBtn = pickerHost.findAll(el => el.textContent === 'Wed')[0];
    const thuBtn = pickerHost.findAll(el => el.textContent === 'Thu')[0];
    for (const fn of wedBtn.listeners.get('click') || []) fn();
    for (const fn of thuBtn.listeners.get('click') || []) fn();
    assert.deepEqual(picker.getValue(), { frequency: 'weekdays', days: ['wed', 'thu'] });
    assert.deepEqual(latestSchedule, { frequency: 'weekdays', days: ['wed', 'thu'] });

    // Exercise modals
    for (const modal of [
      new CreateTreeModal(app, { onSubmit: async () => {} }),
      new CreateSubgoalModal(app, { trees: [{ path: 'Iter/Gym', title: 'Gym' }], initialTreePath: 'Iter/Gym', onSubmit: async () => {} }),
      new CreateHabitModal(app, { trees: [{ path: 'Iter/Gym', title: 'Gym' }], initialTreePath: 'Iter/Gym', onSubmit: async () => {} }),
      new EditHabitScheduleModal(app, { title: 'Go to the Gym', frequency: 'weekdays', days: ['wed', 'thu'], onSubmit: async () => {} }),
      new AddDatasetModal(app, { onSubmit: async () => {} }),
      new AddWidgetModal(app, { datasets: [ds1, ds2], onSubmit: async () => {} }),
      new AddWidgetModal(app, { datasets: [], goalKind: 'habit', onSubmit: async () => {} }),
      new NoteTimeMetaModal(app, { noteFile, onSubmit: async () => {} }),
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

test('Habit GoalView renders streak widget with recent scheduled slots and AddWidgetModal offers streak for habits', async () => {
  const prevDocument = global.document;
  global.document = {
    createElement: tag => createMockElement(tag),
  };

  try {
    const app = createMockApp();
    await ensureStructure(app.vault);
    await createTree(app.vault, { name: 'Gym', module: 'gym' });
    const habit = await createHabit(app.vault, {
      treePath: 'Iter/Gym',
      name: 'Leg Day',
      frequency: 'weekdays',
      days: ['wed', 'thu'],
    });

    const view = new GoalView(
      { containerEl: createMockElement('div') },
      { openFile: async () => {}, registerView: () => {} },
    );
    view.app = app;
    view.contentEl = createMockElement('div');
    await view.setState({ file: habit.path }, {});

    const streakCards = view.contentEl.findAll(el =>
      el.className.split(/\s+/).includes('iter-widget-card') &&
      el.className.split(/\s+/).includes('type-streak'),
    );
    assert.equal(streakCards.length, 1);
    const slots = streakCards[0].findAll(el => el.className.split(/\s+/).includes('iter-streak-slot'));
    assert.equal(slots.length, 6);

    const modal = new AddWidgetModal(app, { datasets: [], goalKind: 'habit', onSubmit: async () => {} });
    modal.contentEl = createMockElement('div');
    modal.onOpen();
    const fields = modal.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-modal-field'));
    const selects = modal.contentEl.findAll(el => el.tagName === 'SELECT');
    const typeOptions = selects[0].children.map(opt => opt.value);
    assert.deepEqual(typeOptions, ['streak']);
    assert.equal(fields[1].style.display, 'none');
    modal.onClose();
  } finally {
    global.document = prevDocument;
  }
});

test('IterPanelView right-click menu exposes Delete for trees, subgoals, and habits', async () => {
  const prevDocument = global.document;
  global.document = {
    createElement: tag => createMockElement(tag),
  };

  try {
    const app = createMockApp();
    let detachedLeaf = false;
    const leaves = [
      {
        view: { filePath: 'Iter/Gym/_tree.md' },
        detach() {
          detachedLeaf = true;
        },
      },
    ];
    app.workspace = {
      getActiveFile() { return null; },
      getMostRecentLeaf() { return null; },
      getLeavesOfType(type) { return type === 'iter-goal' ? leaves : []; },
      on() { return {}; },
    };

    await ensureStructure(app.vault);
    await createTree(app.vault, { name: 'Gym', module: 'gym' });
    const subFile = await createSubgoal(app.vault, { treePath: 'Iter/Gym', name: 'Bench 80kg' });
    const habitFile = await createHabit(app.vault, { treePath: 'Iter/Gym', name: 'Go to the Gym' });

    const plugin = new IterPlugin(app, { id: 'iter', name: 'Iter' });
    plugin.alive = true;
    plugin.scheduleRefresh = () => {};
    const panel = new IterPanelView({ app }, plugin);
    panel.contentEl = createMockElement('div');
    panel.render();

    const dispatchContextMenu = row => {
      Menu.lastMenu = null;
      const event = {
        preventDefault() {},
        stopPropagation() {},
      };
      for (const fn of row.listeners.get('contextmenu') || []) fn(event);
      return Menu.lastMenu;
    };

    const confirmActiveDeleteModal = async () => {
      const modal = app.lastModal;
      assert.ok(modal);
      modal.contentEl = createMockElement('div');
      modal.onOpen();
      const delBtn = modal.contentEl.findAll(
        el => el.tagName === 'BUTTON' && el.textContent === 'Delete' && el.className.includes('mod-warning'),
      )[0];
      assert.ok(delBtn);
      for (const fn of delBtn.listeners.get('click') || []) await fn();
    };

    // Clicking '+' on the tree row does not show Delete
    const addBtn = panel.contentEl.findAll(
      el => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Add to Gym',
    )[0];
    Menu.lastMenu = null;
    for (const fn of addBtn.listeners.get('click') || []) fn({ stopPropagation() {} });
    assert.ok(Menu.lastMenu);
    assert.equal(Menu.lastMenu.items.some(item => item.title === 'Delete'), false);

    // 1. Delete habit via right-click
    const habitRow = panel.contentEl.findAll(el => el.className.includes('iter-habit-row'))[0];
    const habitMenu = dispatchContextMenu(habitRow);
    const habitDel = habitMenu.items.find(item => item.title === 'Delete');
    assert.ok(habitDel && habitDel.warning === true && habitDel.icon === 'trash');

    // Cancel first -> keeps habit
    app.lastModal = null;
    habitDel.callback();
    app.lastModal.contentEl = createMockElement('div');
    app.lastModal.onOpen();
    const cancelBtn = app.lastModal.contentEl.findAll(
      el => el.tagName === 'BUTTON' && el.textContent === 'Cancel',
    )[0];
    for (const fn of cancelBtn.listeners.get('click') || []) fn();
    assert.ok(app.vault.getAbstractFileByPath(habitFile.path));

    // Confirm -> removes habit
    habitDel.callback();
    await confirmActiveDeleteModal();
    assert.equal(app.vault.getAbstractFileByPath(habitFile.path), null);
    panel.render();
    assert.equal(panel.contentEl.findAll(el => el.className.includes('iter-habit-row')).length, 0);

    // 2. Delete subgoal (goal) via right-click
    const subRow = panel.contentEl.findAll(el => el.className.includes('iter-subgoal-row'))[0];
    const subMenu = dispatchContextMenu(subRow);
    const subDel = subMenu.items.find(item => item.title === 'Delete');
    assert.ok(subDel && subDel.warning === true && subDel.icon === 'trash');
    subDel.callback();
    await confirmActiveDeleteModal();
    assert.equal(app.vault.getAbstractFileByPath(subFile.path), null);
    panel.render();
    assert.equal(panel.contentEl.findAll(el => el.className.includes('iter-subgoal-row')).length, 0);

    // 3. Delete tree via right-click (and detaches open GoalView leaf)
    const treeRow = panel.contentEl.findAll(el => el.className.includes('iter-tree-row'))[0];
    const treeMenu = dispatchContextMenu(treeRow);
    const treeDel = treeMenu.items.find(item => item.title === 'Delete');
    assert.ok(treeDel && treeDel.warning === true && treeDel.icon === 'trash');
    treeDel.callback();
    await confirmActiveDeleteModal();
    assert.equal(app.vault.getAbstractFileByPath('Iter/Gym'), null);
    assert.equal(detachedLeaf, true);
    panel.render();
    assert.equal(panel.contentEl.findAll(el => el.className.includes('iter-tree-row')).length, 0);
  } finally {
    Menu.lastMenu = null;
    global.document = prevDocument;
  }
});

test('CreateTreeModal, GoalView, and GardenView support endless vs target-date trees', async () => {
  const prevDocument = global.document;
  global.document = {
    createElement: tag => createMockElement(tag),
    createElementNS: (_ns, tag) => createMockElement(tag),
  };

  try {
    const app = createMockApp();
    await ensureStructure(app.vault);

    // CreateTreeModal toggles Expected completion visibility between Target date and Never-ending
    let submitted = null;
    const modal = new CreateTreeModal(app, {
      onSubmit: async values => {
        submitted = values;
      },
    });
    modal.contentEl = createMockElement('div');
    modal.onOpen();

    const nameInput = modal.contentEl.findAll(el => el.tagName === 'INPUT' && el.getAttribute('type') === 'text')[0];
    const dateInput = modal.contentEl.findAll(el => el.tagName === 'INPUT' && el.getAttribute('type') === 'date')[0];
    const dueSlot = modal.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-tree-due-slot'))[0];
    const targetBtn = modal.contentEl.findAll(el => el.tagName === 'BUTTON' && el.textContent === 'Target date')[0];
    const endlessBtn = modal.contentEl.findAll(el => el.tagName === 'BUTTON' && el.textContent === 'Never-ending')[0];

    assert.equal(dueSlot.style.display, '');
    nameInput.value = 'Gym';
    dateInput.value = '2026-12-31';

    for (const fn of endlessBtn.listeners.get('click') || []) fn();
    assert.equal(dueSlot.style.display, 'none');
    assert.equal(dateInput.value, '');

    // Switching back shows date slot; switching to Never-ending submits endless: true, due: ''
    for (const fn of targetBtn.listeners.get('click') || []) fn();
    assert.equal(dueSlot.style.display, '');
    for (const fn of endlessBtn.listeners.get('click') || []) fn();
    assert.equal(dueSlot.style.display, 'none');

    const form = modal.contentEl.findAll(el => el.tagName === 'FORM')[0];
    for (const fn of form.listeners.get('submit') || []) {
      await fn({ preventDefault() {} });
    }
    assert.equal(submitted.name, 'Gym');
    assert.equal(submitted.endless, true);
    assert.equal(submitted.due, '');

    // GoalView omits Expected completion field on Never-ending trees, keeps it on Target date trees
    const gymTree = await createTree(app.vault, submitted);
    const codeTree = await createTree(app.vault, {
      name: 'Learn How to Code',
      module: 'learning',
      endless: false,
      due: '2027-06-01',
    });

    const goalView = new GoalView(
      { containerEl: createMockElement('div'), updateHeader() {} },
      { openGarden() {}, promptCreateSubgoal() {}, promptCreateHabit() {}, scheduleRefresh() {} },
    );
    goalView.app = app;
    goalView.contentEl = createMockElement('div');

    await goalView.setState({ file: gymTree.path }, {});
    assert.equal(goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-goal-due-wrap')).length, 0);
    assert.equal(goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-goal-overview') && el.className.split(/\s+/).includes('is-single')).length, 1);
    assert.equal(goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('is-endless')).length, 1);

    await goalView.setState({ file: codeTree.path }, {});
    assert.equal(goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-goal-due-wrap')).length, 1);
    assert.equal(goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('is-endless')).length, 0);

    // GardenView inspector indicates Never-ending on endless trees
    const garden = new GardenView(
      { containerEl: createMockElement('div') },
      { openGoal() {}, promptCreateTree() {}, promptCreateSubgoal() {}, promptCreateHabit() {}, scheduleRefresh() {} },
    );
    garden.app = app;
    garden.contentEl = createMockElement('div');
    garden.selectedTreePath = 'Iter/Gym';
    garden.render();
    assert.equal(garden.contentEl.findAll(el => el.className.split(/\s+/).includes('is-endless')).length, 1);
  } finally {
    global.document = prevDocument;
  }
});
