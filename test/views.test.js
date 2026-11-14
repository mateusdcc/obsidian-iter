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
const { WorkflowEditorModal } = require('../src/canvas-editor');
const { renderSchedulePicker } = require('../src/schedule-picker');
const {
  readGoalDocument,
  addDataset,
  addDatasetEntry,
  addWidget,
  updateGoalMeta,
  discoverChildDatasets,
} = require('../src/data-model');

function createMockElement(tagName, attrs = {}) {
  const el = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    attributes: new Map(),
    listeners: new Map(),
    className: '',
    textContent: '',
    value: '',
    checked: false,
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
    removeClass(cls) {
      const cur = new Set(this.className.split(/\s+/).filter(Boolean));
      for (const part of String(cls).split(/\s+/).filter(Boolean)) cur.delete(part);
      this.className = Array.from(cur).join(' ');
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

test('GoalView, AddWidgetModal, and AddDatasetModal support tree child rollups and clickable sources', async () => {
  const prevDocument = global.document;
  global.document = {
    createElement: tag => createMockElement(tag),
    createElementNS: (_ns, tag) => createMockElement(tag),
  };

  const fire = async (el, eventName) => {
    for (const fn of el.listeners.get(eventName) || []) {
      await fn({ preventDefault() {} });
    }
  };

  try {
    const app = createMockApp();
    await ensureStructure(app.vault);
    const readingTree = await createTree(app.vault, { name: 'Reading', module: 'learning', endless: true });
    const poemsHabit = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read poems', frequency: 'daily' });
    const essaysHabit = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read essays', frequency: 'weekly' });
    const subgoal = await createSubgoal(app.vault, { treePath: 'Iter/Reading', name: 'Classic list' });

    const poemsDs = await addDataset(app, poemsHabit, { name: 'Poems read', type: 'number_time', unit: 'poems' });
    await addDatasetEntry(app, poemsHabit, poemsDs.id, { value: 2, date: '2026-11-10' });
    await addDatasetEntry(app, poemsHabit, poemsDs.id, { value: 3, date: '2026-11-12' });

    const essaysDs = await addDataset(app, essaysHabit, { name: 'Essays read', type: 'number_time', unit: 'essays' });
    await addDatasetEntry(app, essaysHabit, essaysDs.id, { value: 4, date: '2026-11-13' });

    const childDatasets = discoverChildDatasets(app, 'Iter/Reading');
    assert.equal(childDatasets.length, 2);

    // 1) AddWidgetModal on a Tree with 0 local datasets allows relational widgets & defaults stat agg to sum
    let submittedWidget = null;
    const widgetModal = new AddWidgetModal(app, {
      datasets: [],
      childDatasets,
      goalKind: 'tree',
      treePath: 'Iter/Reading',
      onSubmit: async cfg => {
        submittedWidget = cfg;
      },
    });
    widgetModal.contentEl = createMockElement('div');
    widgetModal.onOpen();

    const wSelects = widgetModal.contentEl.findAll(el => el.tagName === 'SELECT');
    const wTypeSelect = wSelects[0];
    const wDsSelect = wSelects[1];
    assert.ok(wTypeSelect.children.some(opt => opt.value === 'stat'));
    assert.ok(!wTypeSelect.children.some(opt => opt.value === 'streak'));
    assert.equal(wDsSelect.value, '__rel:all:numeric');

    const wForm = widgetModal.contentEl.findAll(el => el.tagName === 'FORM')[0];
    await fire(wForm, 'submit');

    assert.ok(submittedWidget);
    assert.equal(submittedWidget.type, 'stat');
    assert.equal(submittedWidget.datasetId, '');
    assert.equal(submittedWidget.agg, 'sum');
    assert.equal(submittedWidget.relation.mode, 'query');
    assert.equal(submittedWidget.relation.dataFilter, 'numeric');

    // 2) AddDatasetModal on a Tree exposes 'rollup' and supports picking specific children
    let submittedDataset = null;
    const dsModal = new AddDatasetModal(app, {
      goalKind: 'tree',
      treePath: 'Iter/Reading',
      childDatasets,
      onSubmit: async cfg => {
        submittedDataset = cfg;
      },
    });
    dsModal.contentEl = createMockElement('div');
    dsModal.onOpen();

    const dsNameInput = dsModal.contentEl.findAll(el => el.tagName === 'INPUT' && el.getAttribute('type') !== 'checkbox')[0];
    const dsTypeSelect = dsModal.contentEl.findAll(el => el.tagName === 'SELECT')[0];
    assert.ok(dsTypeSelect.children.some(opt => opt.value === 'rollup'));
    dsNameInput.value = 'Selected reading';
    dsTypeSelect.value = 'rollup';
    await fire(dsTypeSelect, 'change');

    // Switch relation source to 'pick'
    const allDsSelects = dsModal.contentEl.findAll(el => el.tagName === 'SELECT');
    const relModeSelect = allDsSelects[1];
    relModeSelect.value = 'pick';
    await fire(relModeSelect, 'change');

    const checkboxes = dsModal.contentEl.findAll(el => el.tagName === 'INPUT' && el.getAttribute('type') === 'checkbox');
    assert.equal(checkboxes.length, 2);
    checkboxes[0].checked = true;
    await fire(checkboxes[0], 'change');

    const dsForm = dsModal.contentEl.findAll(el => el.tagName === 'FORM')[0];
    await fire(dsForm, 'submit');

    assert.ok(submittedDataset);
    assert.equal(submittedDataset.type, 'rollup');
    assert.equal(submittedDataset.relation.mode, 'pick');
    assert.equal(submittedDataset.relation.refs.length, 1);

    // 3) Persist tree rollup widget + rollup dataset and verify GoalView rendering & source links
    await addWidget(app, readingTree, { ...submittedWidget, title: 'Total pieces read' });
    await addDataset(app, readingTree, {
      name: 'Reading rollup',
      type: 'rollup',
      relation: { mode: 'query', childKinds: 'habits', dataFilter: 'numeric', perChildAgg: 'all' },
    });

    const openedGoals = [];
    const goalView = new GoalView(
      { containerEl: createMockElement('div'), updateHeader() {} },
      {
        openGoal: file => openedGoals.push(file.path),
        openFile() {},
        openGarden() {},
        promptCreateSubgoal() {},
        promptCreateHabit() {},
        scheduleRefresh() {},
      },
    );
    goalView.app = app;
    goalView.contentEl = createMockElement('div');
    await goalView.setState({ file: readingTree.path }, {});

    const statNumbers = goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-stat-number'));
    assert.equal(statNumbers.length, 1);
    assert.equal(statNumbers[0].textContent, '9');

    // Rollup dataset card omits inline '+' add button and renders clickable child breakdown rows
    assert.equal(goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-dataset-add-btn')).length, 0);
    const sourceRows = goalView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-rollup-source-row'));
    assert.equal(sourceRows.length, 2);
    await fire(sourceRows[0], 'click');
    assert.equal(openedGoals.length, 1);
    assert.ok(openedGoals[0].startsWith('Iter/Reading/'));
    assert.ok(subgoal);
  } finally {
    global.document = prevDocument;
  }
});

test('multi-property frontmatter modals, Advanced Canvas switch, WorkflowEditorModal, and GoalView flow widgets work end-to-end', async () => {
  const prevDocument = global.document;
  global.document = {
    createElementNS(_ns, tag) {
      return createMockElement(tag);
    },
  };

  const fire = async (el, eventName) => {
    for (const fn of el.listeners.get(eventName) || []) {
      await fn({
        target: el,
        clientX: 120,
        clientY: 120,
        preventDefault() {},
        stopPropagation() {},
      });
    }
  };

  try {
    const app = createMockApp();
    await ensureStructure(app.vault);
    const readingTree = await createTree(app.vault, { name: 'Reading', endless: true });
    const essayHabit = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read Philosophical Essay' });
    const bookHabit = await createHabit(app.vault, { treePath: 'Iter/Reading', name: 'Read Literature Book', frequency: 'monthly' });

    const noteOne = await app.vault.create(
      'Notes/Descartes.md',
      '---\nchapters: 4\npages: 55\n---\nMeditations\n',
    );
    await app.vault.create(
      'Notes/Kant.md',
      '---\nchapters: 2\npages: 80\n---\nCritique\n',
    );

    const bookPages = await addDataset(app, bookHabit, { name: 'Pages read', type: 'number_time', unit: 'pages' });
    await addDatasetEntry(app, bookHabit, bookPages.id, { value: 210, date: '2026-11-05' });

    // a) AddDatasetModal supports multiple Frontmatter properties on BOTH 'note' and 'note_time'
    let createdNoteDs = null;
    const noteDsModal = new AddDatasetModal(app, {
      goalKind: 'habit',
      onSubmit: async cfg => { createdNoteDs = cfg; },
    });
    noteDsModal.contentEl = createMockElement('div');
    noteDsModal.onOpen();

    const noteTypeSelect = noteDsModal.contentEl.findAll(el => el.tagName === 'SELECT')[0];
    noteTypeSelect.value = 'note';
    await fire(noteTypeSelect, 'change');

    const noteInputs = noteDsModal.contentEl.findAll(el => el.tagName === 'INPUT');
    const noteExtraInput = noteInputs.find(
      i => (i.placeholder || i.getAttribute('placeholder') || '').includes('chapters, pages'),
    );
    assert.ok(noteExtraInput);
    noteInputs[0].value = 'Reading Notes';
    noteExtraInput.value = 'chapters, pages';
    await fire(noteDsModal.contentEl.findAll(el => el.tagName === 'FORM')[0], 'submit');

    assert.ok(createdNoteDs);
    assert.equal(createdNoteDs.type, 'note');
    assert.deepEqual(createdNoteDs.metricKeys, ['chapters', 'pages']);
    assert.equal(createdNoteDs.metricKey, 'chapters');

    let createdNoteTimeDs = null;
    const ntDsModal = new AddDatasetModal(app, {
      goalKind: 'habit',
      onSubmit: async cfg => { createdNoteTimeDs = cfg; },
    });
    ntDsModal.contentEl = createMockElement('div');
    ntDsModal.onOpen();
    ntDsModal.contentEl.findAll(el => el.tagName === 'SELECT')[0].value = 'note_time';
    await fire(ntDsModal.contentEl.findAll(el => el.tagName === 'SELECT')[0], 'change');
    const ntInputs = ntDsModal.contentEl.findAll(el => el.tagName === 'INPUT');
    ntInputs[0].value = 'Timed Essays';
    ntInputs.find(i => (i.placeholder || i.getAttribute('placeholder') || '').includes('chapters, pages')).value = 'chapters, pages';
    await fire(ntDsModal.contentEl.findAll(el => el.tagName === 'FORM')[0], 'submit');
    assert.deepEqual(createdNoteTimeDs.metricKeys, ['chapters', 'pages']);

    // b) NoteTimeMetaModal with showDate: false + multi-property hints omits Date input & submits props
    let metaResult = null;
    const metaModal = new NoteTimeMetaModal(app, {
      noteFile: noteOne,
      showDate: false,
      metricKeys: ['chapters', 'pages'],
      onSubmit: async res => { metaResult = res; },
    });
    metaModal.contentEl = createMockElement('div');
    metaModal.onOpen();
    assert.equal(metaModal.contentEl.findAll(el => el.getAttribute('type') === 'date').length, 0);
    const propInputs = metaModal.contentEl.findAll(el => el.tagName === 'INPUT');
    assert.equal(propInputs.length, 2);
    assert.ok(propInputs[0].getAttribute('placeholder').includes('Frontmatter: 4'));
    assert.ok(propInputs[1].getAttribute('placeholder').includes('Frontmatter: 55'));
    propInputs[1].value = '60';
    await fire(metaModal.contentEl.findAll(el => el.tagName === 'FORM')[0], 'submit');
    assert.equal(metaResult.path, 'Notes/Descartes.md');
    assert.equal(metaResult.date, undefined);
    assert.deepEqual(metaResult.props, { pages: 60 });

    // Persist multi-property note & note_time lists on habit
    const savedNotesDs = await addDataset(app, essayHabit, createdNoteDs);
    await addDatasetEntry(app, essayHabit, savedNotesDs.id, { path: 'Notes/Descartes.md' });
    await addDatasetEntry(app, essayHabit, savedNotesDs.id, { path: 'Notes/Kant.md' });

    const savedTimedDs = await addDataset(app, essayHabit, createdNoteTimeDs);
    await addDatasetEntry(app, essayHabit, savedTimedDs.id, { path: 'Notes/Descartes.md', date: '2026-11-01' });
    await addDatasetEntry(app, essayHabit, savedTimedDs.id, { path: 'Notes/Kant.md', date: '2026-11-04' });

    // c) AddWidgetModal exposes Frontmatter property chips and Advanced Canvas switch
    const essayDoc = await readGoalDocument(app, essayHabit);
    let switchedDraft = null;
    let closeCount = 0;
    const addWModal = new AddWidgetModal(app, {
      doc: essayDoc,
      datasets: essayDoc.datasets,
      goalKind: 'habit',
      onOpenCanvas: draft => { switchedDraft = draft; },
      onSubmit: async () => {},
    });
    addWModal.close = () => { closeCount += 1; };
    addWModal.contentEl = createMockElement('div');
    addWModal.onOpen();

    const chips = addWModal.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-suggest-chip'));
    assert.ok(chips.some(c => c.textContent === 'pages'));
    const pagesChip = chips.find(c => c.textContent === 'pages');
    await fire(pagesChip, 'click');
    const propFilterInput = addWModal.contentEl.findAll(
      el => el.tagName === 'INPUT' && (el.getAttribute('placeholder') || '').includes('(blank = auto)'),
    )[0];
    assert.ok(propFilterInput);
    assert.equal(propFilterInput.value, 'pages');

    const switchBtn = addWModal.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-canvas-switch-btn'))[0];
    await fire(switchBtn, 'click');
    assert.equal(closeCount, 1);
    assert.ok(switchedDraft);
    assert.equal(switchedDraft.metricKey, 'pages');

    // d) WorkflowEditorModal renders nodes, wires, palette add, port wiring, templates, and saves pipeline widget
    const treeDoc = await readGoalDocument(app, readingTree);
    let savedFlowWidget = null;
    const flowModal = new WorkflowEditorModal(app, {
      doc: treeDoc,
      initialTitle: 'Page Reads',
      onSubmit: async payload => { savedFlowWidget = payload; },
    });
    flowModal.contentEl = createMockElement('div');
    flowModal.onOpen();

    // Load 'filter_field' template (prefers 'pages' field)
    const tplSelect = flowModal.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-flow-tpl-select'))[0];
    tplSelect.value = 'filter_field';
    await fire(tplSelect, 'change');
    assert.equal(flowModal.pipeline.nodes.length, 4);
    assert.equal(flowModal.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-flow-node')).length, 4);
    assert.ok(flowModal.svgEl.children.some(ch => ch.getAttribute('class')?.includes('iter-wire-path')));
    // Default Reading Tree has Notes(Descartes pages=55, Kant pages=80) in BOTH note & note_time plus bookPages(210) -> check live count > 0 & preview
    assert.ok(flowModal.statusEl.textContent.includes('Live:'));
    assert.ok(flowModal.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-stat-number')).length > 0);

    // Palette '+ Math' button adds a Math node
    const mathBtn = flowModal.contentEl.findAll(
      el => el.className.split(/\s+/).includes('iter-flow-add-btn') && el.findAll(s => s.textContent === '+ Math').length > 0,
    )[0];
    await fire(mathBtn, 'click');
    assert.equal(flowModal.pipeline.nodes.length, 5);

    // Click output port of Math -> input port of Widget Output adds edge
    const edgesBeforeWire = flowModal.pipeline.edges.length;
    const outPorts = flowModal.contentEl.findAll(el => el.className.split(/\s+/).includes('is-out'));
    await fire(outPorts[outPorts.length - 1], 'click');
    const inPorts = flowModal.contentEl.findAll(el => el.className.split(/\s+/).includes('is-in'));
    // Output node is index 3 in template -> last input or find output node's inPort
    const outCard = flowModal.nodeEls.get('n_out');
    const outInPort = outCard.findAll(el => el.className.split(/\s+/).includes('is-in'))[0];
    await fire(outInPort, 'click');
    assert.equal(flowModal.pipeline.edges.length, edgesBeforeWire + 1);

    // Save widget via Save widget button
    const saveBtn = flowModal.contentEl.findAll(el => el.tagName === 'BUTTON' && el.textContent === 'Save widget')[0];
    await fire(saveBtn, 'click');
    assert.ok(savedFlowWidget);
    assert.equal(savedFlowWidget.type, 'pipeline');
    assert.equal(savedFlowWidget.title, 'Page Reads');

    // e) Persist pipeline widget on Reading tree and multi-property note_navigator on habit; render in GoalView
    const treeWidget = await addWidget(app, readingTree, savedFlowWidget);
    await addWidget(app, essayHabit, {
      title: 'Pages per Note',
      type: 'note_navigator',
      datasetId: savedNotesDs.id,
      metricKey: 'pages',
    });

    const habitLeaf = { app, setViewState: async () => {} };
    const habitView = new GoalView(habitLeaf, { openGoalFile: async () => {}, openGarden: async () => {} });
    habitView.contentEl = createMockElement('div');
    await habitView.setState({ file: essayHabit.path });
    const propPills = habitView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-prop-pills'));
    assert.ok(propPills.length >= 2);
    const navScorePills = habitView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-note-score-pill'));
    assert.ok(navScorePills.some(p => p.textContent === 'chapters: 4'));
    assert.ok(navScorePills.some(p => p.textContent === 'pages: 55'));

    const treeLeaf = { app, setViewState: async () => {} };
    const treeView = new GoalView(treeLeaf, { openGoalFile: async () => {}, openGarden: async () => {} });
    treeView.contentEl = createMockElement('div');
    await treeView.setState({ file: readingTree.path });
    assert.ok(treeView.contentEl.findAll(el => el.textContent === 'Canvas editor').length >= 1);
    assert.ok(treeView.contentEl.findAll(el => el.textContent === 'Page Reads').length >= 1);

    // Clicking 'Edit flow' on pipeline widget opens WorkflowEditorModal preloaded with that pipeline
    const editFlowBtn = treeView.contentEl.findAll(el => el.className.split(/\s+/).includes('iter-widget-edit'))[0];
    assert.ok(editFlowBtn);
    await fire(editFlowBtn, 'click');
    assert.ok(app.lastModal instanceof WorkflowEditorModal);
    assert.equal(app.lastModal.title, treeWidget.title);
    app.lastModal.contentEl = createMockElement('div');
    app.lastModal.onOpen();
    assert.equal(app.lastModal.pipeline.nodes.length, 5);
  } finally {
    global.document = prevDocument;
  }
});
