const { Modal, FuzzySuggestModal, Notice } = require('obsidian');
const { toDateKey } = require('./storage');
const {
  DATASET_TYPES,
  WIDGET_TYPES,
  STAT_AGGS,
  BAR_MODES,
  CHART_VARIANTS,
  stripMd,
} = require('./data-model');

class AddDatasetModal extends Modal {
  constructor(app, { onSubmit }) {
    super(app);
    this.onSubmit = onSubmit;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');
    contentEl.createEl('h2', { text: 'Add data list', cls: 'iter-modal-title' });

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });

    const nameField = form.createDiv({ cls: 'iter-modal-field' });
    nameField.createEl('label', { text: 'Name', cls: 'iter-modal-label' });
    const nameInput = nameField.createEl('input', {
      type: 'text',
      placeholder: 'e.g. Benching PRs, Words learnt, Mock Exams Done',
      cls: 'iter-modal-input',
    });
    nameInput.required = true;

    const typeField = form.createDiv({ cls: 'iter-modal-field' });
    typeField.createEl('label', { text: 'Data type', cls: 'iter-modal-label' });
    const typeSelect = typeField.createEl('select', { cls: 'iter-modal-select' });
    for (const item of DATASET_TYPES) {
      typeSelect.createEl('option', { value: item.id, text: item.label });
    }

    const extraField = form.createDiv({ cls: 'iter-modal-field' });
    const extraLabel = extraField.createEl('label', { text: 'Unit (optional)', cls: 'iter-modal-label' });
    const extraInput = extraField.createEl('input', {
      type: 'text',
      placeholder: 'e.g. kg, words, reps',
      cls: 'iter-modal-input',
    });

    const syncExtra = () => {
      const t = typeSelect.value;
      if (t === 'number_time') {
        extraField.style.display = '';
        extraLabel.textContent = 'Unit (optional)';
        extraInput.placeholder = 'e.g. kg, words, kcal';
      } else if (t === 'note_time') {
        extraField.style.display = '';
        extraLabel.textContent = 'Frontmatter metric property (optional)';
        extraInput.placeholder = 'score (reads score from linked notes)';
      } else {
        extraField.style.display = 'none';
      }
    };
    typeSelect.addEventListener('change', syncExtra);
    syncExtra();

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', { text: 'Add data list', type: 'submit', cls: 'mod-cta' });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        const type = typeSelect.value;
        await this.onSubmit({
          name: nameInput.value,
          type,
          unit: type === 'number_time' ? extraInput.value : '',
          metricKey: type === 'note_time' ? (extraInput.value.trim() || 'score') : 'score',
        });
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : String(error));
        nameInput.focus();
      } finally {
        this.submitting = false;
        submit.disabled = false;
      }
    });

    nameInput.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}

class AddWidgetModal extends Modal {
  constructor(app, { datasets, onSubmit }) {
    super(app);
    this.datasets = datasets;
    this.onSubmit = onSubmit;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');
    contentEl.createEl('h2', { text: 'Add widget', cls: 'iter-modal-title' });

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });
    const row = form.createDiv({ cls: 'iter-modal-row' });

    const typeField = row.createDiv({ cls: 'iter-modal-field' });
    typeField.createEl('label', { text: 'Widget type', cls: 'iter-modal-label' });
    const typeSelect = typeField.createEl('select', { cls: 'iter-modal-select' });
    for (const item of WIDGET_TYPES) {
      typeSelect.createEl('option', { value: item.id, text: item.label });
    }

    const dsField = row.createDiv({ cls: 'iter-modal-field' });
    dsField.createEl('label', { text: 'Linked data', cls: 'iter-modal-label' });
    const dsSelect = dsField.createEl('select', { cls: 'iter-modal-select' });
    for (const ds of this.datasets) {
      dsSelect.createEl('option', { value: ds.id, text: ds.name });
    }

    const titleField = form.createDiv({ cls: 'iter-modal-field' });
    titleField.createEl('label', { text: 'Widget title (optional)', cls: 'iter-modal-label' });
    const titleInput = titleField.createEl('input', {
      type: 'text',
      placeholder: 'Auto-named from data if left blank',
      cls: 'iter-modal-input',
    });

    const dynamicSlot = form.createDiv({ cls: 'iter-modal-dynamic' });

    let aggSelect = null;
    let modeSelect = null;
    let targetInput = null;
    let variantSelect = null;

    const rebuildOptions = () => {
      dynamicSlot.empty();
      aggSelect = null;
      modeSelect = null;
      targetInput = null;
      variantSelect = null;

      const wType = typeSelect.value;
      if (wType === 'stat') {
        const field = dynamicSlot.createDiv({ cls: 'iter-modal-field' });
        field.createEl('label', { text: 'Calculation', cls: 'iter-modal-label' });
        aggSelect = field.createEl('select', { cls: 'iter-modal-select' });
        for (const item of STAT_AGGS) {
          aggSelect.createEl('option', { value: item.id, text: item.label });
        }
      } else if (wType === 'goal_bar') {
        const barRow = dynamicSlot.createDiv({ cls: 'iter-modal-row' });
        const modeField = barRow.createDiv({ cls: 'iter-modal-field' });
        modeField.createEl('label', { text: 'Compare value', cls: 'iter-modal-label' });
        modeSelect = modeField.createEl('select', { cls: 'iter-modal-select' });
        for (const item of BAR_MODES) {
          modeSelect.createEl('option', { value: item.id, text: item.label });
        }

        const tField = barRow.createDiv({ cls: 'iter-modal-field' });
        tField.createEl('label', { text: 'Goal target number', cls: 'iter-modal-label' });
        targetInput = tField.createEl('input', {
          type: 'number',
          step: 'any',
          placeholder: 'e.g. 100',
          cls: 'iter-modal-input',
        });
        targetInput.required = true;
      } else if (wType === 'chart') {
        const field = dynamicSlot.createDiv({ cls: 'iter-modal-field' });
        field.createEl('label', { text: 'Graph style', cls: 'iter-modal-label' });
        variantSelect = field.createEl('select', { cls: 'iter-modal-select' });
        for (const item of CHART_VARIANTS) {
          variantSelect.createEl('option', { value: item.id, text: item.label });
        }
      } else if (wType === 'note_navigator') {
        // Auto-select first note dataset if currently pointing at a non-note dataset
        const currentDs = this.datasets.find(d => d.id === dsSelect.value);
        if (currentDs && currentDs.type !== 'note' && currentDs.type !== 'note_time') {
          const noteDs = this.datasets.find(d => d.type === 'note' || d.type === 'note_time');
          if (noteDs) dsSelect.value = noteDs.id;
        }
      }
    };

    typeSelect.addEventListener('change', rebuildOptions);
    rebuildOptions();

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', { text: 'Add widget', type: 'submit', cls: 'mod-cta' });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        await this.onSubmit({
          type: typeSelect.value,
          datasetId: dsSelect.value,
          title: titleInput.value,
          agg: aggSelect?.value ?? 'latest',
          mode: modeSelect?.value ?? 'latest',
          target: targetInput?.value ?? null,
          variant: variantSelect?.value ?? 'line',
        });
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : String(error));
      } finally {
        this.submitting = false;
        submit.disabled = false;
      }
    });

    titleInput.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}

class NotePickerModal extends FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder('Search Obsidian notes…');
  }

  getItems() {
    const files = this.app.vault.getMarkdownFiles();
    return [...files].sort((a, b) => (b.stat?.mtime ?? 0) - (a.stat?.mtime ?? 0));
  }

  getItemText(file) {
    return file.path.endsWith('.md') ? file.path.slice(0, -3) : file.path;
  }

  onChooseItem(file) {
    void this.onChoose(file);
  }
}

class NoteTimeMetaModal extends Modal {
  constructor(app, { noteFile, metricKey = 'score', onSubmit }) {
    super(app);
    this.noteFile = noteFile;
    this.metricKey = metricKey;
    this.onSubmit = onSubmit;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');
    contentEl.createEl('h2', { text: `Add "${stripMd(this.noteFile.name)}"`, cls: 'iter-modal-title' });

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });
    const row = form.createDiv({ cls: 'iter-modal-row' });

    const dateField = row.createDiv({ cls: 'iter-modal-field' });
    dateField.createEl('label', { text: 'Date', cls: 'iter-modal-label' });
    const dateInput = dateField.createEl('input', { type: 'date', cls: 'iter-modal-input' });
    dateInput.value = toDateKey();
    dateInput.required = true;

    const scoreField = row.createDiv({ cls: 'iter-modal-field' });
    scoreField.createEl('label', { text: `${this.metricKey} (optional)`, cls: 'iter-modal-label' });
    const scoreInput = scoreField.createEl('input', {
      type: 'number',
      step: 'any',
      placeholder: `Reads "${this.metricKey}" frontmatter if blank`,
      cls: 'iter-modal-input',
    });

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', { text: 'Add note', type: 'submit', cls: 'mod-cta' });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        await this.onSubmit({
          path: this.noteFile.path,
          date: dateInput.value,
          value: scoreInput.value === '' ? null : Number(scoreInput.value),
        });
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : String(error));
      } finally {
        this.submitting = false;
        submit.disabled = false;
      }
    });

    scoreInput.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  AddDatasetModal,
  AddWidgetModal,
  NotePickerModal,
  NoteTimeMetaModal,
};
