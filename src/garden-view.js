const { ItemView, Notice, setIcon } = require('obsidian');
const { MODULES, ROOT, toggleSubgoal, waterHabit } = require('./storage');
const { listGarden } = require('./catalog');
const { renderTreeSvg, renderEmptyPotSvg } = require('./tree-art');

const GARDEN_VIEW = 'iter-garden';

const MODULE_LABELS = Object.fromEntries(MODULES.map(item => [item.id, item.label]));

const HYDRATION_LABELS = {
  hydrated: 'Watered',
  partial: 'Partly watered',
  thirsty: 'Needs water',
  calm: 'No habits yet',
};

class GardenView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.selectedTreePath = null;
    this.renderTimer = null;
  }

  getViewType() {
    return GARDEN_VIEW;
  }

  getDisplayText() {
    return 'We';
  }

  getIcon() {
    return 'sprout';
  }

  async setState(state, result) {
    if (state?.selectedTreePath !== undefined) {
      this.selectedTreePath = state.selectedTreePath;
      this.render();
    }
    await super.setState(state, result);
  }

  getState() {
    return { selectedTreePath: this.selectedTreePath };
  }

  async onOpen() {
    this.contentEl.addClass('iter-garden');
    const schedule = file => {
      if (!file || file.path === ROOT || file.path.startsWith(`${ROOT}/`)) {
        this.scheduleRender();
      }
    };
    for (const event of ['create', 'delete', 'modify']) {
      this.registerEvent(this.app.vault.on(event, schedule));
    }
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (oldPath === this.selectedTreePath) {
        this.selectedTreePath = file.path;
      }
      if (oldPath === ROOT || oldPath.startsWith(`${ROOT}/`)) {
        this.scheduleRender();
      } else {
        schedule(file);
      }
    }));
    this.registerEvent(this.app.metadataCache.on('changed', schedule));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleRender()));
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

  selectTree(treePath) {
    this.selectedTreePath = this.selectedTreePath === treePath ? null : treePath;
    this.render();
  }

  render() {
    const container = this.contentEl;
    container.empty();

    const garden = listGarden(this.app);
    if (this.selectedTreePath && !garden.trees.some(tree => tree.path === this.selectedTreePath)) {
      this.selectedTreePath = null;
    }

    const shell = container.createDiv({ cls: 'iter-garden-shell' });
    this.renderHeader(shell, garden);

    if (!garden.trees.length) {
      this.renderEmptyState(shell);
      return;
    }

    const grid = shell.createDiv({ cls: 'iter-garden-grid' });
    for (const tree of garden.trees) {
      this.renderPotCard(grid, tree);
    }

    const selected = this.selectedTreePath
      ? garden.trees.find(tree => tree.path === this.selectedTreePath)
      : null;
    if (selected) {
      this.renderInspector(shell, selected);
    }
  }

  renderHeader(shell, garden) {
    const header = shell.createDiv({ cls: 'iter-garden-header' });
    const titleGroup = header.createDiv({ cls: 'iter-garden-heading' });
    titleGroup.createEl('h1', { text: 'We', cls: 'iter-garden-title' });

    const totalSubgoals = garden.trees.reduce((sum, t) => sum + t.stats.subgoalTotal, 0);
    const doneSubgoals = garden.trees.reduce((sum, t) => sum + t.stats.subgoalDone, 0);
    const totalHabits = garden.trees.reduce((sum, t) => sum + t.stats.habitTotal, 0);
    const wateredHabits = garden.trees.reduce((sum, t) => sum + t.stats.habitWatered, 0);

    const parts = [];
    if (garden.trees.length) {
      parts.push(`${garden.trees.length} ${garden.trees.length === 1 ? 'tree' : 'trees'}`);
      if (totalSubgoals) parts.push(`${doneSubgoals}/${totalSubgoals} subgoals`);
      if (totalHabits) parts.push(`${wateredHabits}/${totalHabits} watered`);
    } else {
      parts.push('Shared long-term garden');
    }

    titleGroup.createEl('p', { text: parts.join(' · '), cls: 'iter-garden-subtitle' });

    const actions = header.createDiv({ cls: 'iter-garden-actions' });
    if (garden.members.length) {
      const membersWrap = actions.createDiv({ cls: 'iter-members-strip' });
      for (const member of garden.members) {
        membersWrap.createSpan({ text: member, cls: 'iter-member-pill' });
      }
    }

    const newTreeBtn = actions.createEl('button', {
      cls: 'iter-primary-pill',
      type: 'button',
    });
    const plusIcon = newTreeBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(plusIcon, 'plus');
    newTreeBtn.createSpan({ text: 'New tree' });
    newTreeBtn.addEventListener('click', () => this.plugin.promptCreateTree());
  }

  renderEmptyState(shell) {
    const empty = shell.createDiv({ cls: 'iter-garden-empty' });
    const art = empty.createDiv({ cls: 'iter-empty-art' });
    renderEmptyPotSvg(art);
    empty.createEl('h2', { text: 'Your garden is quiet', cls: 'iter-empty-title' });
    empty.createEl('p', {
      text: 'Plant a tree for a long-term goal, break it into subgoals, and water it with daily, weekly, or monthly habits.',
      cls: 'iter-empty-copy',
    });
    const btn = empty.createEl('button', { text: 'Create tree', cls: 'mod-cta', type: 'button' });
    btn.addEventListener('click', () => this.plugin.promptCreateTree());
  }

  renderPotCard(grid, tree) {
    const selected = this.selectedTreePath === tree.path;
    const card = grid.createDiv({
      cls: `iter-pot-card${selected ? ' is-selected' : ''} is-${tree.stats.hydrationState}`,
    });
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-pressed', String(selected));
    card.setAttribute('aria-label', `${tree.title}, ${tree.stats.stageLabel}`);

    card.addEventListener('click', () => this.selectTree(tree.path));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.selectTree(tree.path);
      }
    });

    const stage = card.createDiv({ cls: 'iter-pot-stage' });
    renderTreeSvg(stage, tree);

    const meta = card.createDiv({ cls: 'iter-pot-meta' });
    const nameRow = meta.createDiv({ cls: 'iter-pot-name-row' });
    nameRow.createSpan({ text: tree.title, cls: 'iter-pot-title' });
    nameRow.createSpan({ text: MODULE_LABELS[tree.module] || tree.module, cls: 'iter-module-pill' });

    if (tree.goal) {
      meta.createEl('p', { text: tree.goal, cls: 'iter-pot-goal' });
    }

    const statsParts = [tree.stats.stageLabel];
    if (tree.stats.subgoalTotal > 0) {
      statsParts.push(`${tree.stats.subgoalDone}/${tree.stats.subgoalTotal} subgoals`);
    }
    if (tree.stats.habitTotal > 0) {
      statsParts.push(`${tree.stats.habitWatered}/${tree.stats.habitTotal} watered`);
    }
    meta.createDiv({ text: statsParts.join(' · '), cls: 'iter-pot-stats' });

    if (tree.habits.length > 0) {
      const waterBar = card.createDiv({ cls: 'iter-pot-water-bar' });
      const visibleHabits = tree.habits.slice(0, 3);
      for (const habit of visibleHabits) {
        const chip = waterBar.createEl('button', {
          cls: `iter-water-chip${habit.wateredInPeriod ? ' is-watered' : ''}`,
          type: 'button',
          attr: {
            'aria-pressed': String(habit.wateredToday),
            title: habit.wateredToday ? `Undo today's water: ${habit.title}` : `Water ${habit.title}`,
          },
        });
        const drop = chip.createSpan({ cls: 'iter-chip-icon' });
        setIcon(drop, 'droplet');
        chip.createSpan({ text: habit.title, cls: 'iter-chip-label' });
        chip.addEventListener('click', async event => {
          event.stopPropagation();
          try {
            const watered = await waterHabit(this.app, habit.file);
            new Notice(watered ? `Watered ${habit.title}` : `Unwatered ${habit.title} for today`);
            this.plugin.scheduleRefresh();
          } catch (error) {
            new Notice(error?.message || 'Could not water habit.');
          }
        });
      }
      if (tree.habits.length > 3) {
        waterBar.createSpan({ text: `+${tree.habits.length - 3}`, cls: 'iter-more-habits' });
      }
    }
  }

  renderInspector(shell, tree) {
    const panel = shell.createDiv({ cls: 'iter-inspector' });

    const visual = panel.createDiv({ cls: 'iter-inspector-visual' });
    renderTreeSvg(visual, tree, { large: true });
    const growthPct = Math.round(tree.stats.growth * 100);
    visual.createDiv({
      text: `${tree.stats.stageLabel} · ${growthPct}%`,
      cls: 'iter-inspector-stage',
    });
    visual.createDiv({
      text: HYDRATION_LABELS[tree.stats.hydrationState],
      cls: `iter-hydration-badge is-${tree.stats.hydrationState}`,
    });

    const details = panel.createDiv({ cls: 'iter-inspector-details' });

    const top = details.createDiv({ cls: 'iter-inspector-top' });
    const heading = top.createDiv({ cls: 'iter-inspector-heading' });
    heading.createEl('h2', { text: tree.title, cls: 'iter-inspector-title' });
    heading.createSpan({ text: MODULE_LABELS[tree.module] || tree.module, cls: 'iter-module-pill' });

    const topActions = top.createDiv({ cls: 'iter-inspector-top-actions' });
    if (tree.indexFile) {
      const noteBtn = topActions.createEl('button', { cls: 'iter-ghost-action', type: 'button' });
      const noteIcon = noteBtn.createSpan({ cls: 'iter-btn-icon' });
      setIcon(noteIcon, 'target');
      noteBtn.createSpan({ text: 'Open goal' });
      noteBtn.addEventListener('click', () => void this.plugin.openGoal(tree.indexFile));
    }
    const closeBtn = topActions.createEl('button', {
      cls: 'iter-icon-button',
      type: 'button',
      attr: { 'aria-label': 'Close inspector', title: 'Close' },
    });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', () => {
      this.selectedTreePath = null;
      this.render();
    });

    if (tree.goal) {
      details.createEl('p', { text: tree.goal, cls: 'iter-inspector-goal' });
    }

    if (tree.targets.length > 0) {
      const targetsWrap = details.createDiv({ cls: 'iter-targets-strip' });
      for (const item of tree.targets) {
        const pill = targetsWrap.createDiv({ cls: 'iter-target-pill' });
        pill.createSpan({ text: item.user, cls: 'iter-target-user' });
        pill.createSpan({ text: item.target, cls: 'iter-target-value' });
      }
    }

    const columns = details.createDiv({ cls: 'iter-inspector-columns' });

    // Subgoals column
    const subCol = columns.createDiv({ cls: 'iter-inspector-section' });
    const subHeader = subCol.createDiv({ cls: 'iter-section-header' });
    subHeader.createEl('h3', { text: 'Subgoals' });
    const addSubBtn = subHeader.createEl('button', { cls: 'iter-ghost-action', type: 'button' });
    const subPlus = addSubBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(subPlus, 'plus');
    addSubBtn.createSpan({ text: 'Subgoal' });
    addSubBtn.addEventListener('click', () => this.plugin.promptCreateSubgoal(tree.path));

    if (!tree.subgoals.length) {
      subCol.createEl('p', { text: 'No subgoals yet.', cls: 'iter-section-empty' });
    } else {
      const list = subCol.createDiv({ cls: 'iter-detail-list' });
      for (const sub of tree.subgoals) {
        const row = list.createDiv({ cls: `iter-detail-row${sub.done ? ' is-done' : ''}` });
        const checkBtn = row.createEl('button', {
          cls: `iter-icon-button iter-check-btn${sub.done ? ' is-done' : ''}`,
          type: 'button',
          attr: {
            'aria-pressed': String(sub.done),
            'aria-label': sub.done ? `Mark ${sub.title} incomplete` : `Complete ${sub.title}`,
          },
        });
        setIcon(checkBtn, sub.done ? 'check-circle-2' : 'circle');
        checkBtn.addEventListener('click', async () => {
          try {
            await toggleSubgoal(this.app, sub.file);
            this.plugin.scheduleRefresh();
          } catch (error) {
            new Notice(error?.message || 'Could not update subgoal.');
          }
        });

        const textBtn = row.createEl('button', { cls: 'iter-detail-link', type: 'button' });
        textBtn.createSpan({ text: sub.title, cls: 'iter-detail-title' });
        if (sub.target) textBtn.createSpan({ text: sub.target, cls: 'iter-detail-sub' });
        textBtn.addEventListener('click', () => void this.plugin.openGoal(sub.file));
      }
    }

    // Habits column
    const habCol = columns.createDiv({ cls: 'iter-inspector-section' });
    const habHeader = habCol.createDiv({ cls: 'iter-section-header' });
    habHeader.createEl('h3', { text: 'Habits' });
    const addHabBtn = habHeader.createEl('button', { cls: 'iter-ghost-action', type: 'button' });
    const habPlus = addHabBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(habPlus, 'plus');
    addHabBtn.createSpan({ text: 'Habit' });
    addHabBtn.addEventListener('click', () => this.plugin.promptCreateHabit(tree.path));

    if (!tree.habits.length) {
      habCol.createEl('p', { text: 'No watering habits yet.', cls: 'iter-section-empty' });
    } else {
      const list = habCol.createDiv({ cls: 'iter-detail-list' });
      for (const habit of tree.habits) {
        const row = list.createDiv({ cls: `iter-detail-row${habit.wateredInPeriod ? ' is-watered' : ''}` });

        const textBtn = row.createEl('button', { cls: 'iter-detail-link', type: 'button' });
        textBtn.createSpan({ text: habit.title, cls: 'iter-detail-title' });
        const subMeta = [habit.frequency];
        if (habit.streak > 0) subMeta.push(`${habit.streak} streak`);
        if (habit.target) subMeta.push(habit.target);
        textBtn.createSpan({ text: subMeta.join(' · '), cls: 'iter-detail-sub' });
        textBtn.addEventListener('click', () => void this.plugin.openGoal(habit.file));

        const waterBtn = row.createEl('button', {
          cls: `iter-water-action${habit.wateredInPeriod ? ' is-watered' : ''}`,
          type: 'button',
          attr: { 'aria-pressed': String(habit.wateredToday) },
        });
        const drop = waterBtn.createSpan({ cls: 'iter-btn-icon' });
        setIcon(drop, 'droplet');
        waterBtn.createSpan({ text: habit.wateredToday ? 'Watered' : habit.wateredInPeriod ? 'Done' : 'Water' });
        waterBtn.addEventListener('click', async () => {
          try {
            const watered = await waterHabit(this.app, habit.file);
            new Notice(watered ? `Watered ${habit.title}` : `Unwatered ${habit.title} for today`);
            this.plugin.scheduleRefresh();
          } catch (error) {
            new Notice(error?.message || 'Could not water habit.');
          }
        });
      }
    }
  }
}

module.exports = {
  GardenView,
  GARDEN_VIEW,
};
