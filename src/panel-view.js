const { ItemView, Menu, Notice, setIcon } = require('obsidian');
const { ROOT, toggleSubgoal, waterHabit } = require('./storage');
const { listGarden } = require('./catalog');

const PANEL_VIEW = 'iter-panel';

const MODULE_ICONS = {
  gym: 'dumbbell',
  learning: 'book-open',
  creative: 'sparkles',
  health: 'heart',
  general: 'trees',
};

const CADENCE_SHORT = {
  daily: 'D',
  weekly: 'W',
  monthly: 'M',
};

function iconButton(parent, icon, label, callback, extraClass = '') {
  const button = parent.createEl('button', {
    cls: `iter-icon-button ${extraClass}`.trim(),
    type: 'button',
  });
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  setIcon(button, icon);
  button.addEventListener('click', event => {
    event.stopPropagation();
    void callback(event);
  });
  return button;
}

class IterPanelView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.expansion = new Map();
    this.renderTimer = null;
  }

  getViewType() {
    return PANEL_VIEW;
  }

  getDisplayText() {
    return 'Iter';
  }

  getIcon() {
    return 'sprout';
  }

  async onOpen() {
    this.contentEl.addClass('iter-panel');
    const schedule = file => {
      if (!file || file.path === ROOT || file.path.startsWith(`${ROOT}/`)) {
        this.scheduleRender();
      }
    };
    for (const event of ['create', 'delete', 'modify']) {
      this.registerEvent(this.app.vault.on(event, schedule));
    }
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (oldPath === ROOT || oldPath.startsWith(`${ROOT}/`)) {
        this.scheduleRender();
      } else {
        schedule(file);
      }
    }));
    this.registerEvent(this.app.metadataCache.on('changed', schedule));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleRender()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.scheduleRender()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.scheduleRender()));
    this.render();
  }

  async onClose() {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  scheduleRender() {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.render();
    }, 90);
  }

  isActiveFile(file) {
    if (!file) return false;
    const recent = this.app.workspace.getMostRecentLeaf?.();
    if (recent?.view?.getViewType?.() === this.plugin.goalViewType && recent.view.file?.path === file.path) {
      return true;
    }
    const active = this.app.workspace.getActiveFile?.();
    return Boolean(active && active.path === file.path);
  }

  isGardenActive() {
    const recent = this.app.workspace.getMostRecentLeaf?.();
    return recent?.view?.getViewType?.() === this.plugin.gardenViewType;
  }

  render() {
    const container = this.contentEl;
    container.empty();

    const garden = listGarden(this.app);

    const toolbar = container.createDiv({ cls: 'iter-toolbar' });
    toolbar.createEl('span', { text: 'Iter', cls: 'iter-toolbar-title' });
    const toolbarActions = toolbar.createDiv({ cls: 'iter-toolbar-actions' });
    iconButton(toolbarActions, 'plus', 'Create tree', () => this.plugin.promptCreateTree());

    const weRow = container.createEl('button', {
      cls: `iter-we-row${this.isGardenActive() ? ' is-active' : ''}`,
      type: 'button',
    });
    weRow.setAttribute('aria-label', 'Open We garden dashboard');
    if (this.isGardenActive()) weRow.setAttribute('aria-current', 'page');

    const weIcon = weRow.createSpan({ cls: 'iter-we-icon' });
    setIcon(weIcon, 'sprout');
    weRow.createSpan({ text: 'We', cls: 'iter-we-label' });
    const countText = garden.trees.length === 1 ? '1 tree' : `${garden.trees.length} trees`;
    weRow.createSpan({ text: countText, cls: 'iter-we-meta' });
    weRow.addEventListener('click', () => {
      void this.plugin.openGarden();
    });

    const body = container.createDiv({ cls: 'iter-panel-list' });
    if (!garden.trees.length && !garden.looseItems.length) {
      const empty = body.createDiv({ cls: 'iter-panel-empty' });
      empty.createEl('p', { text: 'Your Iter folder is ready.' });
      const plantBtn = empty.createEl('button', { text: 'Plant first tree', type: 'button', cls: 'iter-ghost-action' });
      plantBtn.addEventListener('click', () => this.plugin.promptCreateTree());
      return;
    }

    for (const tree of garden.trees) {
      this.renderTree(body, tree);
    }

    if (garden.looseItems.length) {
      const misc = body.createDiv({ cls: 'iter-misc-section' });
      for (const item of garden.looseItems) {
        this.renderExtraEntry(misc, item);
      }
    }
  }

  renderToggle(row, key, label, defaultExpanded = true) {
    const expanded = this.expansion.get(key) ?? defaultExpanded;
    const toggle = iconButton(
      row,
      expanded ? 'chevron-down' : 'chevron-right',
      `${expanded ? 'Collapse' : 'Expand'} ${label}`,
      () => {
        this.expansion.set(key, !expanded);
        this.render();
      },
      'iter-toggle',
    );
    toggle.setAttribute('aria-expanded', String(expanded));
    return expanded;
  }

  showTreeMenu(event, tree) {
    const menu = new Menu();
    menu.addItem(item =>
      item.setTitle('Create subgoal').setIcon('target').onClick(() => this.plugin.promptCreateSubgoal(tree.path)),
    );
    menu.addItem(item =>
      item.setTitle('Create habit').setIcon('droplet').onClick(() => this.plugin.promptCreateHabit(tree.path)),
    );
    menu.addSeparator();
    menu.addItem(item =>
      item.setTitle('Focus in We garden').setIcon('sprout').onClick(() => void this.plugin.openGarden(tree.path)),
    );
    if (tree.indexFile) {
      menu.addItem(item =>
        item.setTitle('Open goal view').setIcon('layout-dashboard').onClick(() => void this.plugin.openGoal(tree.indexFile)),
      );
      menu.addItem(item =>
        item.setTitle('Open markdown').setIcon('file-text').onClick(() => void this.plugin.openFile(tree.indexFile)),
      );
    }
    menu.showAtMouseEvent(event);
  }

  showGoalItemMenu(event, file, extraLabel, extraIcon, extraAction) {
    const menu = new Menu();
    menu.addItem(item =>
      item.setTitle('Open goal view').setIcon('layout-dashboard').onClick(() => void this.plugin.openGoal(file)),
    );
    menu.addItem(item =>
      item.setTitle('Open markdown').setIcon('file-text').onClick(() => void this.plugin.openFile(file)),
    );
    if (extraAction) {
      menu.addSeparator();
      menu.addItem(item => item.setTitle(extraLabel).setIcon(extraIcon).onClick(extraAction));
    }
    menu.showAtMouseEvent(event);
  }

  renderTree(parent, tree) {
    const section = parent.createDiv({ cls: 'iter-tree-node' });
    const row = section.createDiv({ cls: 'iter-row iter-tree-row' });

    const expanded = this.renderToggle(row, tree.path, tree.title, true);

    const titleBtn = row.createEl('button', { cls: 'iter-row-title', type: 'button' });
    titleBtn.setAttribute('title', tree.goal ? `${tree.title} — ${tree.goal}` : tree.title);
    if (this.isActiveFile(tree.indexFile)) titleBtn.setAttribute('aria-current', 'page');

    const iconEl = titleBtn.createSpan({ cls: 'iter-row-icon' });
    setIcon(iconEl, MODULE_ICONS[tree.module] || 'trees');
    titleBtn.createSpan({ text: tree.title, cls: 'iter-row-name' });

    titleBtn.addEventListener('click', () => {
      if (tree.indexFile) void this.plugin.openGoal(tree.indexFile);
      else void this.plugin.openGarden(tree.path);
    });
    row.addEventListener('contextmenu', event => {
      event.preventDefault();
      this.showTreeMenu(event, tree);
    });

    if (tree.stats.habitTotal > 0) {
      const dot = row.createSpan({
        cls: `iter-hydration-dot is-${tree.stats.hydrationState}`,
        attr: {
          title: `${tree.stats.habitWatered}/${tree.stats.habitTotal} habits watered`,
        },
      });
      dot.setAttribute('aria-hidden', 'true');
    }

    iconButton(
      row,
      'plus',
      `Add to ${tree.title}`,
      event => this.showTreeMenu(event, tree),
      'iter-row-action',
    );

    if (!expanded) return;

    const childrenEl = section.createDiv({ cls: 'iter-tree-children' });
    const hasItems = tree.subgoals.length > 0 || tree.habits.length > 0 || tree.extras.length > 0;
    if (!hasItems) {
      childrenEl.createDiv({ cls: 'iter-tree-empty', text: 'No subgoals or habits yet' });
      return;
    }

    for (const subgoal of tree.subgoals) {
      this.renderSubgoal(childrenEl, subgoal);
    }
    for (const habit of tree.habits) {
      this.renderHabit(childrenEl, habit);
    }
    for (const extra of tree.extras) {
      this.renderExtraEntry(childrenEl, extra);
    }
  }

  renderSubgoal(parent, subgoal) {
    const row = parent.createDiv({ cls: `iter-row iter-subgoal-row${subgoal.done ? ' is-done' : ''}` });
    const toggleBtn = iconButton(
      row,
      subgoal.done ? 'check-circle-2' : 'circle',
      subgoal.done ? `Mark "${subgoal.title}" incomplete` : `Complete "${subgoal.title}"`,
      async () => {
        try {
          await toggleSubgoal(this.app, subgoal.file);
          this.plugin.scheduleRefresh();
        } catch (error) {
          new Notice(error?.message || 'Could not update subgoal.');
        }
      },
      `iter-check-btn${subgoal.done ? ' is-done' : ''}`,
    );
    toggleBtn.setAttribute('aria-pressed', String(subgoal.done));

    const titleBtn = row.createEl('button', { cls: 'iter-row-title', type: 'button' });
    titleBtn.setAttribute('title', subgoal.target ? `${subgoal.title} · ${subgoal.target}` : subgoal.title);
    if (this.isActiveFile(subgoal.file)) titleBtn.setAttribute('aria-current', 'page');
    titleBtn.createSpan({ text: subgoal.title, cls: 'iter-row-name' });
    titleBtn.addEventListener('click', () => void this.plugin.openGoal(subgoal.file));
    row.addEventListener('contextmenu', event => {
      event.preventDefault();
      this.showGoalItemMenu(
        event,
        subgoal.file,
        subgoal.done ? 'Mark incomplete' : 'Mark done',
        subgoal.done ? 'circle' : 'check-circle-2',
        async () => {
          await toggleSubgoal(this.app, subgoal.file);
          this.plugin.scheduleRefresh();
        },
      );
    });
  }

  renderHabit(parent, habit) {
    const row = parent.createDiv({
      cls: `iter-row iter-habit-row${habit.wateredInPeriod ? ' is-watered' : ''}`,
    });

    const waterBtn = iconButton(
      row,
      'droplet',
      habit.wateredToday ? `Undo today's watering for "${habit.title}"` : `Water "${habit.title}"`,
      async () => {
        try {
          const watered = await waterHabit(this.app, habit.file);
          new Notice(watered ? `Watered ${habit.title}` : `Unwatered ${habit.title} for today`);
          this.plugin.scheduleRefresh();
        } catch (error) {
          new Notice(error?.message || 'Could not water habit.');
        }
      },
      `iter-water-btn${habit.wateredInPeriod ? ' is-watered' : ''}`,
    );
    waterBtn.setAttribute('aria-pressed', String(habit.wateredToday));

    const titleBtn = row.createEl('button', { cls: 'iter-row-title', type: 'button' });
    titleBtn.setAttribute('title', habit.target ? `${habit.title} (${habit.frequency}) · ${habit.target}` : `${habit.title} (${habit.frequency})`);
    if (this.isActiveFile(habit.file)) titleBtn.setAttribute('aria-current', 'page');
    titleBtn.createSpan({ text: habit.title, cls: 'iter-row-name' });
    titleBtn.addEventListener('click', () => void this.plugin.openGoal(habit.file));
    row.addEventListener('contextmenu', event => {
      event.preventDefault();
      this.showGoalItemMenu(
        event,
        habit.file,
        habit.wateredToday ? "Undo today's watering" : 'Water now',
        'droplet',
        async () => {
          await waterHabit(this.app, habit.file);
          this.plugin.scheduleRefresh();
        },
      );
    });

    row.createSpan({
      text: CADENCE_SHORT[habit.frequency] || 'D',
      cls: 'iter-cadence-badge',
      attr: { title: `${habit.frequency} habit` },
    });
  }

  renderExtraEntry(parent, entry) {
    if (entry.kind === 'folder') {
      const section = parent.createDiv({ cls: 'iter-extra-folder' });
      const row = section.createDiv({ cls: 'iter-row iter-folder-row' });
      const expanded = this.renderToggle(row, entry.path, entry.name, false);
      const label = row.createSpan({ cls: 'iter-row-title iter-static-label' });
      const iconEl = label.createSpan({ cls: 'iter-row-icon' });
      setIcon(iconEl, 'folder');
      label.createSpan({ text: entry.name, cls: 'iter-row-name' });
      if (!expanded) return;
      const children = section.createDiv({ cls: 'iter-tree-children' });
      for (const child of entry.children) {
        this.renderExtraEntry(children, child);
      }
      return;
    }

    const row = parent.createDiv({ cls: 'iter-row iter-file-row' });
    row.createSpan({ cls: 'iter-toggle-spacer' });
    const titleBtn = row.createEl('button', { cls: 'iter-row-title', type: 'button' });
    if (this.isActiveFile(entry.file)) titleBtn.setAttribute('aria-current', 'page');
    const iconEl = titleBtn.createSpan({ cls: 'iter-row-icon' });
    setIcon(iconEl, 'file-text');
    titleBtn.createSpan({ text: entry.name, cls: 'iter-row-name' });
    titleBtn.addEventListener('click', () => void this.plugin.openFile(entry.file));
  }
}

module.exports = {
  IterPanelView,
  PANEL_VIEW,
};
