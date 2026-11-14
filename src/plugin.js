const { Plugin, Menu, Notice, setIcon } = require('obsidian');
const {
  ROOT,
  ensureStructure,
  createTree,
  createSubgoal,
  createHabit,
  waterHabit,
  updateHabitSchedule,
  deleteTree,
  deleteGoalFile,
} = require('./storage');
const { readGoalDocument, addWidget } = require('./data-model');
const { WorkflowEditorModal } = require('./canvas-editor');
const { listGarden, findTreeContext } = require('./catalog');
const {
  CreateTreeModal,
  CreateSubgoalModal,
  CreateHabitModal,
  EditHabitScheduleModal,
  ConfirmDeleteModal,
} = require('./modals');
const {
  findNoteIterConnections,
  LinkNoteToDatasetModal,
  QuickWaterHabitModal,
  QuickLogEntryModal,
  renderIterCodeBlock,
  InsertEmbedModal,
} = require('./workflow-integration');
const { IterPanelView, PANEL_VIEW } = require('./panel-view');
const { GardenView, GARDEN_VIEW } = require('./garden-view');
const { GoalView, GOAL_VIEW } = require('./goal-view');

class IterPlugin extends Plugin {
  async onload() {
    this.alive = true;
    this.refreshTimer = null;
    this.gardenViewType = GARDEN_VIEW;
    this.goalViewType = GOAL_VIEW;

    if (typeof SVGElement !== 'undefined') {
      if (typeof SVGElement.prototype.isShown !== 'function') {
        SVGElement.prototype.isShown = function () {
          return Boolean(this.isConnected);
        };
      }
      if (!('doc' in SVGElement.prototype)) {
        Object.defineProperty(SVGElement.prototype, 'doc', {
          get() {
            return this.ownerDocument;
          },
          configurable: true,
        });
      }
    }

    if (typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.createEl === 'function') {
      const origCreateEl = HTMLElement.prototype.createEl;
      if (!origCreateEl._iterPatched) {
        const patched = function (tag, opts, cb) {
          const el = origCreateEl.call(this, tag, opts, cb);
          if (opts && typeof opts === 'object' && opts.type && el && el.tagName === 'BUTTON') {
            el.type = opts.type;
          }
          return el;
        };
        patched._iterPatched = true;
        HTMLElement.prototype.createEl = patched;
      }
    }

    this.registerView(PANEL_VIEW, leaf => new IterPanelView(leaf, this));
    this.registerView(GARDEN_VIEW, leaf => new GardenView(leaf, this));
    this.registerView(GOAL_VIEW, leaf => new GoalView(leaf, this));

    try {
      await ensureStructure(this.app.vault);
    } catch (error) {
      console.warn('Iter: deferred folder initialization until layout ready:', error);
    }

    this.addRibbonIcon('sprout', 'Open Iter panel', () => {
      void this.activatePanel(true);
    });

    this.addCommand({
      id: 'create-tree',
      name: 'Create tree',
      callback: () => this.promptCreateTree(),
    });

    this.addCommand({
      id: 'create-subgoal',
      name: 'Create subgoal',
      callback: () => this.promptCreateSubgoal(),
    });

    this.addCommand({
      id: 'create-habit',
      name: 'Create habit',
      callback: () => this.promptCreateHabit(),
    });

    this.addCommand({
      id: 'open-iter-panel',
      name: 'Open Iter panel',
      callback: () => {
        void this.activatePanel(true);
      },
    });

    this.addCommand({
      id: 'open-we-garden',
      name: 'Open We garden',
      callback: () => {
        void this.openGarden();
      },
    });

    this.addCommand({
      id: 'open-goal-view',
      name: 'Open goal view',
      checkCallback: checking => {
        const file = this.app.workspace.getActiveFile?.();
        if (!file || !findTreeContext(this.app, file)) return false;
        if (!checking) void this.openGoal(file);
        return true;
      },
    });

    this.addCommand({
      id: 'water-due-habits',
      name: 'Water all due habits for today',
      callback: async () => {
        const garden = listGarden(this.app);
        const due = [];
        for (const tree of garden.trees) {
          for (const habit of tree.habits) {
            if (habit.isDueToday && !habit.wateredInPeriod && !habit.wateredToday) {
              due.push(habit);
            }
          }
        }
        if (!due.length) {
          new Notice('All due habits for today are already watered!');
          return;
        }
        for (const habit of due) {
          await waterHabit(this.app, habit.file);
        }
        new Notice(`Watered ${due.length} due ${due.length === 1 ? 'habit' : 'habits'}!`);
        this.scheduleRefresh();
      },
    });

    this.addCommand({
      id: 'open-canvas-editor',
      name: 'Open Canvas widget editor',
      callback: () => {
        const recent = this.app.workspace.getMostRecentLeaf?.();
        const goalFile = recent?.view?.getViewType?.() === GOAL_VIEW
          ? recent.view.file
          : this.app.workspace.getActiveFile?.();
        if (!goalFile || !findTreeContext(this.app, goalFile)) {
          new Notice('Open an Iter tree, subgoal, or habit first.');
          return;
        }
        const doc = readGoalDocument(this.app, goalFile);
        new WorkflowEditorModal(this.app, {
          doc,
          onSubmit: async cfg => {
            await addWidget(this.app, goalFile, cfg);
            this.scheduleRefresh();
          },
        }).open();
      },
    });

    this.addCommand({
      id: 'water-habit',
      name: 'Water a habit…',
      callback: () => {
        new QuickWaterHabitModal(this.app, () => {
          this.scheduleRefresh();
        }).open();
      },
    });

    this.addCommand({
      id: 'quick-log-entry',
      name: 'Quick-log data entry to a goal or habit…',
      callback: () => {
        new QuickLogEntryModal(this.app, {
          plugin: this,
          onLogged: () => this.scheduleRefresh(),
        }).open();
      },
    });

    this.addCommand({
      id: 'link-current-note',
      name: 'Link current note to a goal or habit…',
      checkCallback: checking => {
        const file = this.app.workspace.getActiveFile?.();
        if (!file || file.extension !== 'md' || file.path.startsWith(`${ROOT}/`)) return false;
        if (!checking) {
          new LinkNoteToDatasetModal(this.app, {
            noteFile: file,
            onLinked: () => {
              this.scheduleRefresh();
              this.updateStatusBar();
            },
          }).open();
        }
        return true;
      },
    });

    this.addCommand({
      id: 'insert-iter-embed',
      name: 'Insert embedded widget or habit tracker into current note',
      editorCallback: editor => {
        new InsertEmbedModal(this.app, {
          onInsert: block => {
            editor.replaceSelection(block);
          },
        }).open();
      },
    });

    if (typeof this.registerMarkdownCodeBlockProcessor === 'function') {
      this.registerMarkdownCodeBlockProcessor('iter', (source, el) => {
        renderIterCodeBlock(this, source, el);
      });
    }

    if (typeof this.addStatusBarItem === 'function') {
      this.statusBarEl = this.addStatusBarItem();
      if (this.statusBarEl) {
        this.statusBarEl.addClass?.('iter-status-bar-item');
        this.statusBarEl.style.display = 'none';
        this.statusBarEl.addEventListener?.('click', event => {
          this.openStatusBarMenu(event);
        });
      }
    }

    if (typeof this.app?.workspace?.on === 'function') {
      this.registerEvent(
        this.app.workspace.on('file-menu', (menu, file) => {
          this.populateFileContextMenu(menu, file);
        }),
      );
      this.registerEvent(
        this.app.workspace.on('editor-menu', (menu, _editor, info) => {
          if (info?.file) this.populateFileContextMenu(menu, info.file);
        }),
      );
      this.registerEvent(
        this.app.workspace.on('active-leaf-change', () => {
          this.updateStatusBar();
        }),
      );
      this.registerEvent(
        this.app.workspace.on('file-open', () => {
          this.updateStatusBar();
        }),
      );
    }

    const onReady = () => {
      if (!this.alive) return;
      void ensureStructure(this.app.vault)
        .then(() => this.activatePanel(false))
        .catch(error => console.error('Iter init:', error));
      this.scheduleRefresh();
    };

    if (this.app.workspace.layoutReady) {
      onReady();
    } else {
      this.app.workspace.onLayoutReady(onReady);
    }
  }

  onunload() {
    this.alive = false;
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.app.workspace.detachLeavesOfType(PANEL_VIEW);
    this.app.workspace.detachLeavesOfType(GARDEN_VIEW);
    this.app.workspace.detachLeavesOfType(GOAL_VIEW);
  }

  scheduleRefresh() {
    if (!this.alive) return;
    if (this.refreshTimer !== null) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      for (const leaf of this.app.workspace.getLeavesOfType(PANEL_VIEW)) {
        leaf.view?.render?.();
      }
      for (const leaf of this.app.workspace.getLeavesOfType(GARDEN_VIEW)) {
        leaf.view?.render?.();
      }
      for (const leaf of this.app.workspace.getLeavesOfType(GOAL_VIEW)) {
        leaf.view?.scheduleRender?.();
      }
      this.updateStatusBar();
    }, 80);
  }

  populateFileContextMenu(menu, file) {
    if (!menu || !file || file.extension !== 'md') return;

    if (file.path.startsWith(`${ROOT}/`) && findTreeContext(this.app, file)) {
      menu.addItem(item => {
        item
          .setTitle('Iter: Open Goal View')
          .setIcon('sprout')
          .onClick(() => {
            void this.openGoal(file);
          });
      });
      return;
    }

    if (file.path.startsWith(`${ROOT}/`)) return;

    const connections = findNoteIterConnections(this.app, file);
    for (const conn of connections) {
      menu.addItem(item => {
        item
          .setTitle(`Iter: Open "${conn.goalTitle}" (${conn.dataset.name})`)
          .setIcon('sprout')
          .onClick(() => {
            void this.openGoal(conn.goalFile);
          });
      });
      if (conn.goalKind === 'habit') {
        menu.addItem(item => {
          item
            .setTitle(`Iter: Water "${conn.goalTitle}"`)
            .setIcon('droplet')
            .onClick(async () => {
              await waterHabit(this.app, conn.goalFile);
              new Notice(`Watered "${conn.goalTitle}"!`);
              this.scheduleRefresh();
            });
        });
      }
    }

    menu.addItem(item => {
      item
        .setTitle('Iter: Link note to goal or habit…')
        .setIcon('link')
        .onClick(() => {
          new LinkNoteToDatasetModal(this.app, {
            noteFile: file,
            onLinked: () => {
              this.scheduleRefresh();
              this.updateStatusBar();
            },
          }).open();
        });
    });
  }

  updateStatusBar() {
    if (!this.statusBarEl) return;
    const activeFile = this.app.workspace?.getActiveFile?.();
    if (!activeFile || activeFile.extension !== 'md' || activeFile.path.startsWith(`${ROOT}/`)) {
      this.statusBarEl.style.display = 'none';
      this.statusBarEl.empty?.();
      return;
    }

    const connections = findNoteIterConnections(this.app, activeFile);
    if (!connections.length) {
      this.statusBarEl.style.display = 'none';
      this.statusBarEl.empty?.();
      return;
    }

    this.statusBarEl.empty?.();
    this.statusBarEl.style.display = '';
    const iconSpan = this.statusBarEl.createSpan({ cls: 'iter-status-bar-icon' });
    setIcon(iconSpan, 'sprout');
    const first = connections[0];
    const label = connections.length === 1
      ? `${first.goalTitle} · ${first.dataset.name}`
      : `${first.goalTitle} (+${connections.length - 1} more)`;
    this.statusBarEl.createSpan({ text: label, cls: 'iter-status-bar-text' });
  }

  openStatusBarMenu(event) {
    const activeFile = this.app.workspace?.getActiveFile?.();
    if (!activeFile) return;
    const menu = new Menu();
    this.populateFileContextMenu(menu, activeFile);
    menu.showAtMouseEvent(event);
  }

  async activatePanel(reveal = true) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(PANEL_VIEW)[0];
    const created = !leaf;
    if (!leaf) {
      leaf = workspace.getLeftLeaf(false);
      if (!leaf) {
        if (reveal) new Notice('Could not open the Iter panel.');
        return null;
      }
      await leaf.setViewState({ type: PANEL_VIEW, active: true });
    }
    if ((reveal || created) && this.alive) {
      await workspace.revealLeaf(leaf);
    }
    return leaf;
  }

  async openGarden(selectedTreePath = null) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(GARDEN_VIEW)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(false);
      if (!leaf) {
        new Notice('Could not open the We garden.');
        return null;
      }
      await leaf.setViewState({
        type: GARDEN_VIEW,
        state: selectedTreePath ? { selectedTreePath } : {},
        active: true,
      });
    } else if (selectedTreePath) {
      await leaf.setViewState({
        type: GARDEN_VIEW,
        state: { selectedTreePath },
        active: true,
      });
    }
    await workspace.revealLeaf(leaf);
    this.scheduleRefresh();
    return leaf;
  }

  async openGoal(file) {
    if (!file) return;
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(GOAL_VIEW).find(item => item.view?.file?.path === file.path);
    if (existing) {
      await workspace.revealLeaf(existing);
      return existing;
    }
    const active = workspace.getMostRecentLeaf?.();
    const leaf = active?.view?.getViewType?.() === GARDEN_VIEW
      ? workspace.getLeaf('tab')
      : workspace.getLeaf(false);
    await leaf.setViewState({ type: GOAL_VIEW, state: { file: file.path }, active: true });
    await workspace.revealLeaf(leaf);
    return leaf;
  }

  async openFile(file) {
    if (!file) return;
    const { workspace } = this.app;
    const active = workspace.getMostRecentLeaf?.();
    const activeType = active?.view?.getViewType?.();
    const leaf = activeType === GARDEN_VIEW || activeType === GOAL_VIEW
      ? workspace.getLeaf('tab')
      : workspace.getLeaf(false);
    await leaf.openFile(file);
    await workspace.revealLeaf(leaf);
  }

  resolveInitialTreePath(trees, preferredTreePath) {
    if (preferredTreePath && trees.some(t => t.path === preferredTreePath)) {
      return preferredTreePath;
    }
    const activeLeaf = this.app.workspace.getMostRecentLeaf?.();
    if (activeLeaf?.view?.getViewType?.() === GARDEN_VIEW && activeLeaf.view.selectedTreePath) {
      const match = trees.find(t => t.path === activeLeaf.view.selectedTreePath);
      if (match) return match.path;
    }
    if (activeLeaf?.view?.getViewType?.() === GOAL_VIEW && activeLeaf.view.file) {
      const goalTree = findTreeContext(this.app, activeLeaf.view.file);
      if (goalTree && trees.some(t => t.path === goalTree)) return goalTree;
    }
    const activeFile = this.app.workspace.getActiveFile?.();
    const contextTree = findTreeContext(this.app, activeFile);
    if (contextTree && trees.some(t => t.path === contextTree)) {
      return contextTree;
    }
    return trees[0]?.path ?? null;
  }

  promptCreateTree() {
    new CreateTreeModal(this.app, {
      onSubmit: async values => {
        const file = await createTree(this.app.vault, values);
        const treePath = file.parent?.path ?? null;
        new Notice(`Planted "${values.name.trim()}"`);
        const activeView = this.app.workspace.getMostRecentLeaf?.()?.view;
        if (activeView?.getViewType?.() === GARDEN_VIEW && treePath) {
          activeView.selectedTreePath = treePath;
        } else {
          await this.openGoal(file);
        }
        this.scheduleRefresh();
      },
    }).open();
  }

  promptCreateSubgoal(preferredTreePath = null) {
    const { trees } = listGarden(this.app);
    if (!trees.length) {
      new Notice('Create a tree first using "Iter: Create tree".');
      return;
    }
    const initialTreePath = this.resolveInitialTreePath(trees, preferredTreePath);
    new CreateSubgoalModal(this.app, {
      trees,
      initialTreePath,
      onSubmit: async values => {
        await createSubgoal(this.app.vault, values);
        new Notice(`Added subgoal "${values.name.trim()}"`);
        this.scheduleRefresh();
      },
    }).open();
  }

  promptCreateHabit(preferredTreePath = null) {
    const { trees } = listGarden(this.app);
    if (!trees.length) {
      new Notice('Create a tree first using "Iter: Create tree".');
      return;
    }
    const initialTreePath = this.resolveInitialTreePath(trees, preferredTreePath);
    new CreateHabitModal(this.app, {
      trees,
      initialTreePath,
      onSubmit: async values => {
        await createHabit(this.app.vault, values);
        new Notice(`Added habit "${values.name.trim()}"`);
        this.scheduleRefresh();
      },
    }).open();
  }

  promptEditHabitSchedule(habit) {
    new EditHabitScheduleModal(this.app, {
      title: habit.title,
      frequency: habit.frequency,
      days: habit.days,
      onSubmit: async schedule => {
        await updateHabitSchedule(this.app, habit.file, schedule);
        new Notice(`Updated repetitivity for "${habit.title}"`);
        this.scheduleRefresh();
      },
    }).open();
  }

  closeGoalLeavesMatching(targetPath, isFolderTarget = false) {
    if (!targetPath || !this.app.workspace?.getLeavesOfType) return;
    const matches = leafPath =>
      leafPath === targetPath || (isFolderTarget && typeof leafPath === 'string' && leafPath.startsWith(`${targetPath}/`));
    for (const leaf of [...this.app.workspace.getLeavesOfType(GOAL_VIEW)]) {
      const leafPath = leaf.view?.filePath ?? leaf.view?.file?.path ?? leaf.getViewState?.()?.state?.file;
      if (matches(leafPath)) {
        leaf.detach?.();
      }
    }
  }

  promptDeleteTree(tree) {
    if (!tree?.path) return;
    const parts = [];
    if (tree.subgoals?.length) parts.push(tree.subgoals.length === 1 ? '1 goal' : `${tree.subgoals.length} goals`);
    if (tree.habits?.length) parts.push(tree.habits.length === 1 ? '1 habit' : `${tree.habits.length} habits`);
    const detail = parts.length ? ` (including ${parts.join(' and ')})` : '';

    new ConfirmDeleteModal(this.app, {
      title: `Delete "${tree.title}"?`,
      message: `Move tree "${tree.title}"${detail} to Obsidian's trash?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await deleteTree(this.app, tree.path);
        this.closeGoalLeavesMatching(tree.path, true);
        new Notice(`Deleted "${tree.title}"`);
        this.scheduleRefresh();
      },
    }).open();
  }

  promptDeleteGoalItem(kind, item) {
    if (!item?.file) return;
    new ConfirmDeleteModal(this.app, {
      title: `Delete ${kind}?`,
      message: `Move "${item.title}" to Obsidian's trash?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await deleteGoalFile(this.app, item.file);
        this.closeGoalLeavesMatching(item.file.path, false);
        new Notice(`Deleted "${item.title}"`);
        this.scheduleRefresh();
      },
    }).open();
  }
}

module.exports = IterPlugin;
