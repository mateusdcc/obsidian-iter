const { Modal, Notice } = require('obsidian');
const { MODULES, FREQUENCIES, STYLES } = require('./storage');

const STYLE_LABELS = {
  auto: 'Auto (from module)',
  canopy: 'Canopy',
  bonsai: 'Bonsai',
  pine: 'Pine',
  willow: 'Willow',
};

const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

class BaseIterModal extends Modal {
  constructor(app, title, submitLabel, onSubmit) {
    super(app);
    this.modalTitle = title;
    this.submitLabel = submitLabel;
    this.onSubmit = onSubmit;
    this.submitting = false;
  }

  buildForm(contentEl) {
    contentEl.empty();
    contentEl.addClass('iter-modal');
    contentEl.createEl('h2', { text: this.modalTitle, cls: 'iter-modal-title' });
    return contentEl.createEl('form', { cls: 'iter-modal-form' });
  }

  addField(form, labelText, buildInput) {
    const field = form.createDiv({ cls: 'iter-modal-field' });
    const label = field.createEl('label', { text: labelText, cls: 'iter-modal-label' });
    const input = buildInput(field);
    const id = `iter-field-${Math.random().toString(36).slice(2, 9)}`;
    input.id = id;
    label.setAttribute('for', id);
    return input;
  }

  addActions(form, collectValues, focusOnError) {
    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', { text: this.submitLabel, type: 'submit', cls: 'mod-cta' });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        await this.onSubmit(collectValues());
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : String(error));
        focusOnError?.focus();
      } finally {
        this.submitting = false;
        submit.disabled = false;
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class CreateTreeModal extends BaseIterModal {
  constructor(app, { onSubmit }) {
    super(app, 'Create tree', 'Plant tree', onSubmit);
  }

  onOpen() {
    const form = this.buildForm(this.contentEl);
    const nameInput = this.addField(form, 'Tree name', parent => {
      const input = parent.createEl('input', { type: 'text', placeholder: 'Gym, Learn Japanese…', cls: 'iter-modal-input' });
      input.required = true;
      return input;
    });

    const row = form.createDiv({ cls: 'iter-modal-row' });
    const moduleSelect = this.addField(row, 'Module', parent => {
      const select = parent.createEl('select', { cls: 'iter-modal-select' });
      for (const mod of MODULES) {
        select.createEl('option', { value: mod.id, text: mod.label });
      }
      return select;
    });

    const styleSelect = this.addField(row, 'Tree form', parent => {
      const select = parent.createEl('select', { cls: 'iter-modal-select' });
      for (const style of STYLES) {
        select.createEl('option', { value: style, text: STYLE_LABELS[style] || style });
      }
      return select;
    });

    const goalInput = this.addField(form, 'Long-term goal (optional)', parent =>
      parent.createEl('input', { type: 'text', placeholder: 'e.g. Reach 70kg at 12% body fat', cls: 'iter-modal-input' }),
    );

    this.addActions(
      form,
      () => ({
        name: nameInput.value,
        module: moduleSelect.value,
        style: styleSelect.value,
        goal: goalInput.value,
      }),
      nameInput,
    );

    nameInput.focus();
  }
}

class CreateSubgoalModal extends BaseIterModal {
  constructor(app, { trees, initialTreePath, onSubmit }) {
    super(app, 'Create subgoal', 'Create subgoal', onSubmit);
    this.trees = trees;
    this.initialTreePath = initialTreePath;
  }

  onOpen() {
    const form = this.buildForm(this.contentEl);
    const treeSelect = this.addField(form, 'Tree', parent => {
      const select = parent.createEl('select', { cls: 'iter-modal-select' });
      for (const tree of this.trees) {
        const option = select.createEl('option', { value: tree.path, text: tree.title });
        if (tree.path === this.initialTreePath) option.selected = true;
      }
      return select;
    });

    const nameInput = this.addField(form, 'Subgoal', parent => {
      const input = parent.createEl('input', { type: 'text', placeholder: 'e.g. Bench 80kg', cls: 'iter-modal-input' });
      input.required = true;
      return input;
    });

    const targetInput = this.addField(form, 'Milestone target (optional)', parent =>
      parent.createEl('input', { type: 'text', placeholder: 'e.g. 80kg x 5 reps', cls: 'iter-modal-input' }),
    );

    this.addActions(
      form,
      () => ({
        treePath: treeSelect.value,
        name: nameInput.value,
        target: targetInput.value,
      }),
      nameInput,
    );

    nameInput.focus();
  }
}

class CreateHabitModal extends BaseIterModal {
  constructor(app, { trees, initialTreePath, onSubmit }) {
    super(app, 'Create habit', 'Create habit', onSubmit);
    this.trees = trees;
    this.initialTreePath = initialTreePath;
  }

  onOpen() {
    const form = this.buildForm(this.contentEl);
    const row = form.createDiv({ cls: 'iter-modal-row' });

    const treeSelect = this.addField(row, 'Tree', parent => {
      const select = parent.createEl('select', { cls: 'iter-modal-select' });
      for (const tree of this.trees) {
        const option = select.createEl('option', { value: tree.path, text: tree.title });
        if (tree.path === this.initialTreePath) option.selected = true;
      }
      return select;
    });

    const freqSelect = this.addField(row, 'Watering cadence', parent => {
      const select = parent.createEl('select', { cls: 'iter-modal-select' });
      for (const freq of FREQUENCIES) {
        select.createEl('option', { value: freq, text: FREQUENCY_LABELS[freq] || freq });
      }
      return select;
    });

    const nameInput = this.addField(form, 'Habit', parent => {
      const input = parent.createEl('input', { type: 'text', placeholder: 'e.g. Go to the Gym', cls: 'iter-modal-input' });
      input.required = true;
      return input;
    });

    const targetInput = this.addField(form, 'Daily/period target (optional)', parent =>
      parent.createEl('input', { type: 'text', placeholder: 'e.g. 3000 kcal / 10 new words', cls: 'iter-modal-input' }),
    );

    this.addActions(
      form,
      () => ({
        treePath: treeSelect.value,
        frequency: freqSelect.value,
        name: nameInput.value,
        target: targetInput.value,
      }),
      nameInput,
    );

    nameInput.focus();
  }
}

module.exports = {
  CreateTreeModal,
  CreateSubgoalModal,
  CreateHabitModal,
};
