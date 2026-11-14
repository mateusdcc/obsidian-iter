const { ItemView, Notice, setIcon } = require('obsidian');
const {
  ROOT,
  toDateKey,
  toggleSubgoal,
  waterHabit,
  updateHabitSchedule,
  formatCadenceLabel,
  isScheduledOnDate,
  computeHabitStreakDetails,
} = require('./storage');
const { listGarden } = require('./catalog');
const { renderSchedulePicker } = require('./schedule-picker');
const {
  DATASET_TYPES,
  readGoalDocument,
  resolveDatasetEntries,
  resolveNumericSeries,
  computeStat,
  computeGoalBar,
  formatDueStatus,
  formatNumber,
  updateGoalMeta,
  addDataset,
  removeDataset,
  addDatasetEntry,
  removeDatasetEntry,
  addWidget,
  removeWidget,
} = require('./data-model');
const { renderChartSvg } = require('./widget-art');
const {
  AddDatasetModal,
  AddWidgetModal,
  NotePickerModal,
  NoteTimeMetaModal,
} = require('./goal-modals');

const GOAL_VIEW = 'iter-goal';

const TYPE_LABELS = Object.fromEntries(DATASET_TYPES.map(t => [t.id, t.label]));

const KIND_LABELS = {
  tree: 'Tree',
  subgoal: 'Subgoal',
  habit: 'Habit',
  goal: 'Goal',
};

const AGG_LABELS = {
  count: 'Count',
  sum: 'Total',
  average: 'Average',
  latest: 'Latest',
  max: 'Max',
  min: 'Min',
};

class GoalView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.file = null;
    this.filePath = null;
    this.openAddForDataset = null;
    this.renderTimer = null;
  }

  getViewType() {
    return GOAL_VIEW;
  }

  getDisplayText() {
    if (!this.file) return 'Goal';
    const doc = readGoalDocument(this.app, this.file);
    return doc.title || 'Goal';
  }

  getIcon() {
    if (!this.file) return 'target';
    const doc = readGoalDocument(this.app, this.file);
    if (doc.kind === 'tree') return 'trees';
    if (doc.kind === 'habit') return 'droplet';
    return 'target';
  }

  getState() {
    return { file: this.file?.path ?? this.filePath ?? null };
  }

  async setState(state, result) {
    const nextPath = typeof state?.file === 'string' ? state.file : null;
    this.filePath = nextPath;
    const abstract = nextPath ? this.app.vault.getAbstractFileByPath(nextPath) : null;
    this.file = abstract && !Array.isArray(abstract.children) ? abstract : null;
    this.openAddForDataset = null;
    this.render();
    this.leaf?.updateHeader?.();
    await super.setState(state, result);
  }

  async onOpen() {
    this.contentEl.addClass('iter-goal-view');

    const shouldRefresh = changedFile => {
      if (!this.file) return false;
      if (!changedFile) return true;
      if (changedFile.path === this.file.path) return true;
      if (changedFile.path.startsWith(`${ROOT}/`)) return true;
      const doc = readGoalDocument(this.app, this.file);
      return doc.datasets.some(ds =>
        (ds.type === 'note' || ds.type === 'note_time') &&
        ds.entries.some(e => e.path === changedFile.path),
      );
    };

    for (const event of ['modify', 'delete']) {
      this.registerEvent(this.app.vault.on(event, file => {
        if (
          event === 'delete' &&
          file?.path &&
          (file.path === this.filePath || this.filePath?.startsWith(`${file.path}/`))
        ) {
          this.file = null;
          this.render();
          return;
        }
        if (shouldRefresh(file)) this.scheduleRender();
      }));
    }

    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (oldPath === this.filePath) {
        this.file = file;
        this.filePath = file.path;
        this.leaf?.updateHeader?.();
        this.scheduleRender();
      } else if (shouldRefresh(file)) {
        this.scheduleRender();
      }
    }));

    this.registerEvent(this.app.metadataCache.on('changed', file => {
      if (shouldRefresh(file)) this.scheduleRender();
    }));

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
      // Avoid blowing away focus while user is actively typing in description or quick-add
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (active && this.contentEl.contains?.(active) && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
        return;
      }
      this.render();
      this.leaf?.updateHeader?.();
    }, 90);
  }

  render() {
    const container = this.contentEl;
    container.empty();

    if (!this.file) {
      const missing = container.createDiv({ cls: 'iter-goal-missing' });
      missing.createEl('p', { text: 'Goal note not found.' });
      const backBtn = missing.createEl('button', { text: 'Open We garden', cls: 'iter-primary-pill', type: 'button' });
      backBtn.addEventListener('click', () => void this.plugin.openGarden());
      return;
    }

    const doc = readGoalDocument(this.app, this.file);
    const shell = container.createDiv({ cls: 'iter-goal-shell' });

    this.renderHeader(shell, doc);
    this.renderOverview(shell, doc);
    if (doc.kind === 'habit') {
      this.renderHabitSchedule(shell, doc);
    }
    this.renderWidgetsSection(shell, doc);
    this.renderDatasetsSection(shell, doc);

    if (doc.kind === 'tree' && doc.treePath) {
      this.renderTreeChildrenSection(shell, doc);
    }
  }

  renderHeader(shell, doc) {
    const topBar = shell.createDiv({ cls: 'iter-goal-topbar' });
    const crumbs = topBar.createDiv({ cls: 'iter-breadcrumbs' });

    const weBtn = crumbs.createEl('button', { text: 'We', cls: 'iter-crumb-btn', type: 'button' });
    weBtn.addEventListener('click', () => void this.plugin.openGarden(doc.treePath));

    if (doc.parentTreeFile) {
      crumbs.createSpan({ text: '/', cls: 'iter-crumb-sep' });
      const treeName = doc.treePath ? doc.treePath.split('/').pop() : 'Tree';
      const parentBtn = crumbs.createEl('button', { text: treeName, cls: 'iter-crumb-btn', type: 'button' });
      parentBtn.addEventListener('click', () => void this.plugin.openGoal(doc.parentTreeFile));
    }

    crumbs.createSpan({ text: KIND_LABELS[doc.kind] || 'Goal', cls: 'iter-kind-pill' });

    const actions = topBar.createDiv({ cls: 'iter-goal-top-actions' });

    if (doc.kind === 'subgoal') {
      const doneBtn = actions.createEl('button', {
        cls: `iter-primary-pill${doc.done ? ' is-done' : ''}`,
        type: 'button',
      });
      const icon = doneBtn.createSpan({ cls: 'iter-btn-icon' });
      setIcon(icon, doc.done ? 'check-circle-2' : 'circle');
      doneBtn.createSpan({ text: doc.done ? 'Done' : 'Mark done' });
      doneBtn.addEventListener('click', async () => {
        await toggleSubgoal(this.app, this.file);
        this.render();
        this.plugin.scheduleRefresh();
      });
    } else if (doc.kind === 'habit') {
      const garden = listGarden(this.app);
      const tree = garden.trees.find(t => t.path === doc.treePath);
      const habit = tree?.habits?.find(h => h.file.path === this.file.path);
      const watered = habit?.wateredInPeriod ?? false;
      const wateredToday = habit?.wateredToday ?? false;
      const dueToday = isScheduledOnDate(doc.frequency, doc.days, toDateKey());
      const cadenceLabel = formatCadenceLabel(doc.frequency, doc.days);

      const waterBtn = actions.createEl('button', {
        cls: `iter-water-action${watered ? ' is-watered' : ''}${!dueToday && !wateredToday ? ' is-rest' : ''}`,
        type: 'button',
      });
      const drop = waterBtn.createSpan({ cls: 'iter-btn-icon' });
      setIcon(drop, 'droplet');
      waterBtn.createSpan({
        text: wateredToday
          ? 'Watered today'
          : watered
            ? `Done (${cadenceLabel})`
            : !dueToday
              ? `Rest day (${cadenceLabel})`
              : `Water (${cadenceLabel})`,
      });
      waterBtn.addEventListener('click', async () => {
        const res = await waterHabit(this.app, this.file);
        new Notice(res ? `Watered ${doc.title}` : `Unwatered ${doc.title} for today`);
        this.render();
        this.plugin.scheduleRefresh();
      });
    }

    const mdBtn = actions.createEl('button', {
      cls: 'iter-ghost-action',
      type: 'button',
      attr: { title: 'Open underlying Markdown file' },
    });
    const mdIcon = mdBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(mdIcon, 'file-text');
    mdBtn.createSpan({ text: 'Markdown' });
    mdBtn.addEventListener('click', () => void this.plugin.openFile(this.file));

    shell.createEl('h1', { text: doc.title, cls: 'iter-goal-title' });
  }

  renderOverview(shell, doc) {
    const overview = shell.createDiv({ cls: 'iter-goal-overview' });

    const descWrap = overview.createDiv({ cls: 'iter-goal-desc-wrap' });
    descWrap.createEl('label', { text: 'Description', cls: 'iter-micro-label' });
    const descInput = descWrap.createEl('textarea', {
      cls: 'iter-goal-desc-input',
      placeholder: 'Describe this goal, why it matters, and what success looks like…',
    });
    descInput.rows = 2;
    descInput.value = doc.description;
    let savedDesc = doc.description;
    descInput.addEventListener('blur', async () => {
      const next = descInput.value.trim();
      if (next === savedDesc) return;
      savedDesc = next;
      await updateGoalMeta(this.app, this.file, { description: next });
      this.plugin.scheduleRefresh();
    });

    const dueWrap = overview.createDiv({ cls: 'iter-goal-due-wrap' });
    dueWrap.createEl('label', { text: 'Expected completion', cls: 'iter-micro-label' });
    const dueRow = dueWrap.createDiv({ cls: 'iter-due-row' });
    const dueInput = dueRow.createEl('input', { type: 'date', cls: 'iter-due-input' });
    dueInput.value = doc.due;

    const status = formatDueStatus(doc.due);
    if (status) {
      dueRow.createSpan({
        text: status.badge,
        cls: `iter-due-badge is-${status.tone}`,
      });
    } else {
      dueRow.createSpan({ text: 'No target date', cls: 'iter-due-empty' });
    }

    dueInput.addEventListener('change', async () => {
      await updateGoalMeta(this.app, this.file, { due: dueInput.value });
      this.render();
      this.plugin.scheduleRefresh();
    });
  }

  renderHabitSchedule(shell, doc) {
    const box = shell.createDiv({ cls: 'iter-goal-schedule' });
    const top = box.createDiv({ cls: 'iter-schedule-head' });
    top.createEl('span', { text: 'Repetitivity', cls: 'iter-micro-label' });
    const currentLabel = top.createSpan({
      text: formatCadenceLabel(doc.frequency, doc.days),
      cls: 'iter-schedule-current',
    });

    renderSchedulePicker(box, {
      frequency: doc.frequency,
      days: doc.days,
      onChange: async next => {
        if (next.frequency === 'weekdays' && !next.days.length) {
          currentLabel.textContent = 'Pick days below';
          return;
        }
        await updateHabitSchedule(this.app, this.file, next);
        currentLabel.textContent = formatCadenceLabel(next.frequency, next.days);
        this.plugin.scheduleRefresh();
      },
    });
  }

  renderWidgetsSection(shell, doc) {
    const section = shell.createDiv({ cls: 'iter-goal-section' });
    const header = section.createDiv({ cls: 'iter-section-bar' });
    header.createEl('h2', { text: 'Widgets', cls: 'iter-section-heading' });

    const addBtn = header.createEl('button', { cls: 'iter-ghost-action', type: 'button' });
    const plus = addBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(plus, 'plus');
    addBtn.createSpan({ text: 'Add widget' });
    addBtn.addEventListener('click', () => {
      if (doc.kind !== 'habit' && !doc.datasets.length) {
        new Notice('Add a data list first, then link a widget to it.');
        return;
      }
      new AddWidgetModal(this.app, {
        datasets: doc.datasets,
        goalKind: doc.kind,
        onSubmit: async config => {
          await addWidget(this.app, this.file, config);
          this.render();
        },
      }).open();
    });

    if (!doc.widgets.length) {
      section.createEl('p', {
        text: doc.kind === 'habit'
          ? 'No widgets yet. Add a streak widget or link custom data below.'
          : doc.datasets.length
            ? 'No widgets yet. Link a progress bar, metric, graph, or note navigator to your data.'
            : 'Add custom data below, then pin widgets here to visualize your progress.',
        cls: 'iter-section-hint',
      });
      return;
    }

    const grid = section.createDiv({ cls: 'iter-widget-grid' });
    const datasetById = new Map(doc.datasets.map(d => [d.id, d]));
    for (const widget of doc.widgets) {
      const ds = widget.datasetId ? datasetById.get(widget.datasetId) : null;
      this.renderWidgetCard(grid, widget, ds, doc);
    }
  }

  renderWidgetCard(grid, widget, dataset, doc) {
    const wide = widget.type === 'chart' || widget.type === 'goal_bar' || widget.type === 'note_navigator';
    const card = grid.createDiv({
      cls: `iter-widget-card type-${widget.type}${wide ? ' is-wide' : ''}`,
    });

    const top = card.createDiv({ cls: 'iter-widget-top' });
    const defaultTitle = widget.type === 'streak'
      ? 'Streak'
      : !dataset
        ? 'Missing dataset'
        : widget.type === 'stat'
          ? `${dataset.name} · ${AGG_LABELS[widget.agg] || widget.agg}`
          : dataset.name;
    top.createSpan({ text: widget.title || defaultTitle, cls: 'iter-widget-title' });

    const removeBtn = top.createEl('button', {
      cls: 'iter-icon-button iter-widget-remove',
      type: 'button',
      attr: { 'aria-label': 'Remove widget', title: 'Remove widget' },
    });
    setIcon(removeBtn, 'x');
    removeBtn.addEventListener('click', async () => {
      await removeWidget(this.app, this.file, widget.id);
      this.render();
    });

    if (widget.type === 'streak') {
      const details = computeHabitStreakDetails(
        doc.waterLog,
        doc.frequency,
        new Date(),
        doc.days,
        doc.lastWatered,
      );
      const valRow = card.createDiv({ cls: 'iter-streak-main' });
      valRow.createSpan({ text: String(details.streak), cls: 'iter-streak-number' });
      valRow.createSpan({ text: details.unit, cls: 'iter-streak-unit' });

      card.createDiv({
        text: `${details.statusLabel} · Best: ${details.bestStreak} · ${details.cadenceLabel}`,
        cls: 'iter-streak-meta',
      });

      const slotsRow = card.createDiv({ cls: 'iter-streak-slots' });
      for (const slot of details.recentSlots) {
        slotsRow.createSpan({
          text: slot.label,
          cls: `iter-streak-slot${slot.completed ? ' is-done' : ''}${slot.isCurrent ? ' is-current' : ''}`,
          attr: {
            title: `${slot.key} (${slot.completed ? 'Completed' : slot.isCurrent ? 'Pending' : 'Missed'})`,
            'aria-label': `${slot.key}: ${slot.completed ? 'completed' : 'not completed'}`,
          },
        });
      }
      return;
    }

    if (!dataset) {
      card.createEl('p', { text: 'Linked data list was removed.', cls: 'iter-widget-empty' });
      return;
    }

    if (widget.type === 'stat') {
      const res = computeStat(this.app, dataset, widget.agg, this.file.path, widget.metricKey);
      const valRow = card.createDiv({ cls: 'iter-stat-value-row' });
      valRow.createSpan({ text: res.display, cls: 'iter-stat-number' });
      if (res.unit && widget.agg !== 'count') {
        valRow.createSpan({ text: res.unit, cls: 'iter-stat-unit' });
      }
      const subLabel = widget.agg === 'count'
        ? `${res.count} ${res.count === 1 ? 'entry' : 'entries'}`
        : `${AGG_LABELS[widget.agg] || widget.agg} · ${res.count} ${res.count === 1 ? 'point' : 'points'}`;
      card.createDiv({ text: subLabel, cls: 'iter-stat-sub' });
      return;
    }

    if (widget.type === 'goal_bar') {
      const bar = computeGoalBar(this.app, dataset, widget.mode, widget.target, this.file.path, widget.metricKey);
      const headerRow = card.createDiv({ cls: 'iter-bar-meta' });
      const unitSuffix = bar.unit ? ` ${bar.unit}` : '';
      headerRow.createSpan({
        text: `${bar.currentDisplay}${unitSuffix} / ${bar.targetDisplay}${unitSuffix}`,
        cls: 'iter-bar-numbers',
      });
      headerRow.createSpan({ text: `${bar.rawPercent}%`, cls: 'iter-bar-percent' });

      const track = card.createDiv({ cls: 'iter-bar-track' });
      const fill = track.createDiv({ cls: 'iter-bar-fill' });
      fill.style.width = `${bar.fillPercent}%`;
      return;
    }

    if (widget.type === 'chart') {
      const points = resolveNumericSeries(this.app, dataset, this.file.path, widget.metricKey);
      if (!points.length) {
        card.createEl('p', {
          text: dataset.type === 'note_time'
            ? `Add notes with a "${dataset.metricKey || 'score'}" property (or inline value) to plot.`
            : 'Add numeric entries to plot progress over time.',
          cls: 'iter-widget-empty',
        });
        return;
      }
      const latest = points[points.length - 1];
      const delta = points.length > 1 ? latest.value - points[0].value : null;
      const summary = card.createDiv({ cls: 'iter-chart-summary' });
      summary.createSpan({
        text: `Latest: ${formatNumber(latest.value)}${dataset.unit ? ` ${dataset.unit}` : ''}`,
      });
      if (delta !== null) {
        const sign = delta > 0 ? '+' : '';
        summary.createSpan({
          text: `${sign}${formatNumber(delta)} overall`,
          cls: delta >= 0 ? 'iter-delta-up' : 'iter-delta-down',
        });
      }
      const host = card.createDiv({ cls: 'iter-chart-host' });
      renderChartSvg(host, points, {
        variant: widget.variant,
        unit: dataset.unit,
        onPointClick: pt => {
          if (pt.noteFile) void this.plugin.openFile(pt.noteFile);
        },
      });
      return;
    }

    if (widget.type === 'note_navigator') {
      const entries = resolveDatasetEntries(this.app, dataset, this.file.path);
      if (!entries.length) {
        card.createEl('p', { text: 'No linked notes yet.', cls: 'iter-widget-empty' });
        return;
      }
      const navList = card.createDiv({ cls: 'iter-note-nav-list' });
      const ordered = dataset.type === 'note_time'
        ? [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.index - a.index)
        : entries;
      for (const entry of ordered) {
        const itemBtn = navList.createEl('button', { cls: 'iter-note-nav-item', type: 'button' });
        const icon = itemBtn.createSpan({ cls: 'iter-note-nav-icon' });
        setIcon(icon, 'file-text');
        const main = itemBtn.createSpan({ cls: 'iter-note-nav-main' });
        main.createSpan({ text: entry.label, cls: 'iter-note-nav-title' });
        if (entry.path) {
          const folder = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : 'Vault root';
          main.createSpan({ text: folder, cls: 'iter-note-nav-path' });
        }
        if (entry.value !== null) {
          itemBtn.createSpan({ text: formatNumber(entry.value), cls: 'iter-note-score-pill' });
        }
        if (entry.date) {
          itemBtn.createSpan({ text: entry.date, cls: 'iter-note-date-pill' });
        }
        itemBtn.addEventListener('click', () => {
          if (entry.noteFile) void this.plugin.openFile(entry.noteFile);
          else new Notice(`Note not found: ${entry.path}`);
        });
      }
    }
  }

  renderDatasetsSection(shell, doc) {
    const section = shell.createDiv({ cls: 'iter-goal-section' });
    const header = section.createDiv({ cls: 'iter-section-bar' });
    header.createEl('h2', { text: 'Data', cls: 'iter-section-heading' });

    const addBtn = header.createEl('button', { cls: 'iter-ghost-action', type: 'button' });
    const plus = addBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(plus, 'plus');
    addBtn.createSpan({ text: 'Add data' });
    addBtn.addEventListener('click', () => {
      new AddDatasetModal(this.app, {
        onSubmit: async config => {
          const created = await addDataset(this.app, this.file, config);
          if (created.type === 'number_time' || created.type === 'text') {
            this.openAddForDataset = created.id;
          }
          this.render();
        },
      }).open();
    });

    if (!doc.datasets.length) {
      section.createEl('p', {
        text: 'Create custom data lists like "Benching PRs" (number & date), "Words learnt" (text), or "Mock Exams Done" (notes & date).',
        cls: 'iter-section-hint',
      });
      return;
    }

    const list = section.createDiv({ cls: 'iter-dataset-grid' });
    for (const dataset of doc.datasets) {
      this.renderDatasetCard(list, dataset);
    }
  }

  triggerDatasetAdd(dataset) {
    if (dataset.type === 'note') {
      new NotePickerModal(this.app, async noteFile => {
        await addDatasetEntry(this.app, this.file, dataset.id, { path: noteFile.path });
        this.render();
      }).open();
      return;
    }

    if (dataset.type === 'note_time') {
      new NotePickerModal(this.app, noteFile => {
        new NoteTimeMetaModal(this.app, {
          noteFile,
          metricKey: dataset.metricKey || 'score',
          onSubmit: async entry => {
            await addDatasetEntry(this.app, this.file, dataset.id, entry);
            this.render();
          },
        }).open();
      }).open();
      return;
    }

    this.openAddForDataset = this.openAddForDataset === dataset.id ? null : dataset.id;
    this.render();
  }

  renderDatasetCard(container, dataset) {
    const card = container.createDiv({ cls: 'iter-dataset-card' });

    const top = card.createDiv({ cls: 'iter-dataset-top' });
    const left = top.createDiv({ cls: 'iter-dataset-title-wrap' });
    left.createSpan({ text: dataset.name, cls: 'iter-dataset-title' });
    left.createSpan({ text: TYPE_LABELS[dataset.type] || dataset.type, cls: 'iter-module-pill' });
    left.createSpan({ text: String(dataset.entries.length), cls: 'iter-dataset-count' });

    const right = top.createDiv({ cls: 'iter-dataset-actions' });
    const addEntryBtn = right.createEl('button', {
      cls: 'iter-icon-button iter-dataset-add-btn',
      type: 'button',
      attr: { 'aria-label': `Add entry to ${dataset.name}`, title: `Add to ${dataset.name}` },
    });
    setIcon(addEntryBtn, 'plus');
    addEntryBtn.addEventListener('click', () => this.triggerDatasetAdd(dataset));

    const removeDsBtn = right.createEl('button', {
      cls: 'iter-icon-button iter-dataset-remove-btn',
      type: 'button',
      attr: { 'aria-label': `Delete ${dataset.name}`, title: `Delete ${dataset.name}` },
    });
    setIcon(removeDsBtn, 'trash-2');
    removeDsBtn.addEventListener('click', async () => {
      await removeDataset(this.app, this.file, dataset.id);
      if (this.openAddForDataset === dataset.id) this.openAddForDataset = null;
      this.render();
    });

    // Inline quick-add bar for number_time and text
    if (this.openAddForDataset === dataset.id && (dataset.type === 'number_time' || dataset.type === 'text')) {
      const form = card.createEl('form', { cls: 'iter-inline-entry-form' });
      let primaryInput = null;
      let dateInput = null;

      if (dataset.type === 'number_time') {
        primaryInput = form.createEl('input', {
          type: 'number',
          step: 'any',
          placeholder: dataset.unit ? `Value (${dataset.unit})` : 'Value',
          cls: 'iter-inline-input is-number',
        });
        primaryInput.required = true;
        dateInput = form.createEl('input', { type: 'date', cls: 'iter-inline-input is-date' });
        dateInput.value = toDateKey();
        dateInput.required = true;
      } else {
        primaryInput = form.createEl('input', {
          type: 'text',
          placeholder: 'Add item…',
          cls: 'iter-inline-input is-text',
        });
        primaryInput.required = true;
      }

      const saveBtn = form.createEl('button', { text: 'Add', type: 'submit', cls: 'iter-primary-pill' });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        saveBtn.disabled = true;
        try {
          if (dataset.type === 'number_time') {
            await addDatasetEntry(this.app, this.file, dataset.id, {
              value: Number(primaryInput.value),
              date: dateInput.value,
            });
          } else {
            await addDatasetEntry(this.app, this.file, dataset.id, {
              value: primaryInput.value,
            });
          }
          this.openAddForDataset = null;
          this.render();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : String(error));
          saveBtn.disabled = false;
        }
      });

      setTimeout(() => primaryInput?.focus(), 0);
    }

    const resolved = resolveDatasetEntries(this.app, dataset, this.file.path);
    if (!resolved.length) {
      card.createEl('p', { text: 'No entries yet. Click + to add one.', cls: 'iter-dataset-empty' });
      return;
    }

    const displayOrder = dataset.type === 'number_time' || dataset.type === 'note_time'
      ? [...resolved].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.index - a.index)
      : [...resolved].reverse();

    const rowsEl = card.createDiv({ cls: 'iter-entry-list' });
    for (const item of displayOrder) {
      const row = rowsEl.createDiv({ cls: 'iter-entry-row' });

      if (dataset.type === 'note' || dataset.type === 'note_time') {
        const linkBtn = row.createEl('button', { cls: 'iter-entry-note-btn', type: 'button' });
        const icon = linkBtn.createSpan({ cls: 'iter-btn-icon' });
        setIcon(icon, 'file-text');
        linkBtn.createSpan({ text: item.label, cls: 'iter-entry-main' });
        linkBtn.addEventListener('click', () => {
          if (item.noteFile) void this.plugin.openFile(item.noteFile);
          else new Notice(`Note not found: ${item.path}`);
        });
        if (item.value !== null) {
          row.createSpan({ text: formatNumber(item.value), cls: 'iter-note-score-pill' });
        }
      } else {
        row.createSpan({ text: item.label, cls: 'iter-entry-main' });
      }

      if (item.date) {
        row.createSpan({ text: item.date, cls: 'iter-entry-date' });
      }

      const delBtn = row.createEl('button', {
        cls: 'iter-icon-button iter-entry-del',
        type: 'button',
        attr: { 'aria-label': 'Remove entry', title: 'Remove entry' },
      });
      setIcon(delBtn, 'x');
      delBtn.addEventListener('click', async () => {
        await removeDatasetEntry(this.app, this.file, dataset.id, item.index);
        this.render();
      });
    }
  }

  renderTreeChildrenSection(shell, doc) {
    const garden = listGarden(this.app);
    const tree = garden.trees.find(t => t.path === doc.treePath);
    if (!tree) return;

    const section = shell.createDiv({ cls: 'iter-goal-section' });
    const header = section.createDiv({ cls: 'iter-section-bar' });
    header.createEl('h2', { text: 'Subgoals & Habits', cls: 'iter-section-heading' });
    const actions = header.createDiv({ cls: 'iter-goal-top-actions' });

    const addSubBtn = actions.createEl('button', { cls: 'iter-ghost-action', type: 'button' });
    const p1 = addSubBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(p1, 'plus');
    addSubBtn.createSpan({ text: 'Subgoal' });
    addSubBtn.addEventListener('click', () => this.plugin.promptCreateSubgoal(tree.path));

    const addHabBtn = actions.createEl('button', { cls: 'iter-ghost-action', type: 'button' });
    const p2 = addHabBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(p2, 'plus');
    addHabBtn.createSpan({ text: 'Habit' });
    addHabBtn.addEventListener('click', () => this.plugin.promptCreateHabit(tree.path));

    if (!tree.subgoals.length && !tree.habits.length) {
      section.createEl('p', { text: 'No subgoals or habits under this tree yet.', cls: 'iter-section-hint' });
      return;
    }

    const chipGrid = section.createDiv({ cls: 'iter-tree-links-grid' });
    for (const sub of tree.subgoals) {
      const btn = chipGrid.createEl('button', {
        cls: `iter-tree-link-card${sub.done ? ' is-done' : ''}`,
        type: 'button',
      });
      const icon = btn.createSpan({ cls: 'iter-btn-icon' });
      setIcon(icon, sub.done ? 'check-circle-2' : 'target');
      btn.createSpan({ text: sub.title, cls: 'iter-tree-link-name' });
      btn.createSpan({ text: 'Subgoal', cls: 'iter-tree-link-kind' });
      btn.addEventListener('click', () => void this.plugin.openGoal(sub.file));
    }

    for (const habit of tree.habits) {
      const btn = chipGrid.createEl('button', {
        cls: `iter-tree-link-card${habit.wateredInPeriod ? ' is-watered' : ''}`,
        type: 'button',
      });
      const icon = btn.createSpan({ cls: 'iter-btn-icon' });
      setIcon(icon, 'droplet');
      btn.createSpan({ text: habit.title, cls: 'iter-tree-link-name' });
      btn.createSpan({ text: habit.cadenceLabel, cls: 'iter-tree-link-kind' });
      btn.addEventListener('click', () => void this.plugin.openGoal(habit.file));
    }
  }
}

module.exports = {
  GoalView,
  GOAL_VIEW,
};
