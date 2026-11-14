const { Plugin, Notice } = require('obsidian');
const { ensureStructure, createTree, createSubgoal, createHabit } = require('./storage');
const { listGarden, findTreeContext } = require('./catalog');
const { CreateTreeModal, CreateSubgoalModal, CreateHabitModal } = require('./modals');
const { IterPanelView, PANEL_VIEW } = require('./panel-view');
const { GardenView, GARDEN_VIEW } = require('./garden-view');

class IterPlugin extends Plugin {
  async onload() {
    this.alive = true;
    this.refreshTimer = null;
    this.gardenViewType = GARDEN_VIEW;

    await ensureStructure(this.app.vault);

    this.registerView(PANEL_VIEW, leaf => new IterPanelView(leaf, this));
    this.registerView(GARDEN_VIEW, leaf => new GardenView(leaf, this));

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
    }, 80);
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

  async openFile(file) {
    if (!file) return;
    const { workspace } = this.app;
    const active = workspace.getMostRecentLeaf?.();
    const leaf = active?.view?.getViewType?.() === GARDEN_VIEW
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
          await this.openFile(file);
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
}

module.exports = IterPlugin;
