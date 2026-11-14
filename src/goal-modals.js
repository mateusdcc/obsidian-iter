const { Modal, FuzzySuggestModal, Notice } = require('obsidian');
const { toDateKey } = require('./storage');
const {
  DATASET_TYPES,
  WIDGET_TYPES,
  STAT_AGGS,
  BAR_MODES,
  CHART_VARIANTS,
  RELATION_CHILD_KINDS,
  RELATION_DATA_FILTERS,
  RELATION_PER_CHILD,
  parseMetricKeysInput,
  toFiniteNumber,
  datasetMatchesFilter,
  resolveDatasetEntries,
  stripMd,
} = require('./data-model');

function refKey(filePath, datasetId) {
  return `${filePath}\0${datasetId}`;
}

function getMatchingChildDatasets(childDatasets, { childKinds = 'all', dataFilter = 'any', nameMatch = '' } = {}) {
  const needle = String(nameMatch || '').trim().toLowerCase();
  return childDatasets.filter(item => {
    if (childKinds === 'habits' && item.childKind !== 'habit') return false;
    if (childKinds === 'subgoals' && item.childKind !== 'subgoal') return false;
    if (!datasetMatchesFilter(item.dataset, dataFilter)) return false;
    if (needle) {
      const dsName = (item.dataset.name || '').toLowerCase();
      const childName = (item.childTitle || '').toLowerCase();
      if (!dsName.includes(needle) && !childName.includes(needle)) return false;
    }
    return true;
  });
}

function renderChildRefChecklist(container, childDatasets, selectedMap) {
  const wrap = container.createDiv({ cls: 'iter-checklist' });
  if (!childDatasets.length) {
    wrap.createEl('p', {
      text: 'No matching child data lists found under this tree yet.',
      cls: 'iter-section-hint',
    });
    return;
  }

  for (const item of childDatasets) {
    const key = refKey(item.filePath, item.dataset.id);
    const label = wrap.createEl('label', { cls: 'iter-check-item' });
    const checkbox = label.createEl('input', { type: 'checkbox', cls: 'iter-check-box' });
    checkbox.checked = selectedMap.has(key);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedMap.set(key, { filePath: item.filePath, datasetId: item.dataset.id });
      } else {
        selectedMap.delete(key);
      }
    });

    const textWrap = label.createDiv({ cls: 'iter-check-text' });
    textWrap.createSpan({ text: `${item.childTitle} — ${item.dataset.name}`, cls: 'iter-check-title' });
    const typeInfo = item.dataset.unit ? `${item.dataset.type} · ${item.dataset.unit}` : item.dataset.type;
    textWrap.createSpan({ text: typeInfo, cls: 'iter-check-meta' });
  }
}

function renderRelationConfigPanel(container, {
  childDatasets = [],
  allowModeSwitch = true,
  showKindAndFilter = true,
  initial = {},
} = {}) {
  const state = {
    mode: initial.mode === 'pick' ? 'pick' : 'query',
    childKinds: initial.childKinds || 'all',
    dataFilter: initial.dataFilter || 'numeric',
    nameMatch: initial.nameMatch || '',
    perChildAgg: initial.perChildAgg || 'all',
    unit: initial.unit || '',
  };
  const selectedMap = new Map();
  for (const ref of initial.refs || []) {
    if (ref?.filePath && ref?.datasetId) {
      selectedMap.set(refKey(ref.filePath, ref.datasetId), {
        filePath: ref.filePath,
        datasetId: ref.datasetId,
      });
    }
  }

  const renderInner = () => {
    container.empty();

    if (allowModeSwitch) {
      const modeField = container.createDiv({ cls: 'iter-modal-field' });
      modeField.createEl('label', { text: 'Relation source', cls: 'iter-modal-label' });
      const modeSelect = modeField.createEl('select', { cls: 'iter-modal-select' });
      modeSelect.createEl('option', { value: 'query', text: 'Auto-include matching children (updates as you add more)' });
      modeSelect.createEl('option', { value: 'pick', text: 'Pick specific child lists' });
      modeSelect.value = state.mode;
      modeSelect.addEventListener('change', () => {
        state.mode = modeSelect.value;
        renderInner();
      });
    }

    if (state.mode === 'query') {
      if (showKindAndFilter) {
        const scopeRow = container.createDiv({ cls: 'iter-modal-row' });
        const kindField = scopeRow.createDiv({ cls: 'iter-modal-field' });
        kindField.createEl('label', { text: 'From children', cls: 'iter-modal-label' });
        const kindSelect = kindField.createEl('select', { cls: 'iter-modal-select' });
        for (const item of RELATION_CHILD_KINDS) {
          kindSelect.createEl('option', { value: item.id, text: item.label });
        }
        kindSelect.value = state.childKinds;

        const filterField = scopeRow.createDiv({ cls: 'iter-modal-field' });
        filterField.createEl('label', { text: 'Data kind', cls: 'iter-modal-label' });
        const filterSelect = filterField.createEl('select', { cls: 'iter-modal-select' });
        for (const item of RELATION_DATA_FILTERS) {
          filterSelect.createEl('option', { value: item.id, text: item.label });
        }
        filterSelect.value = state.dataFilter;

        kindSelect.addEventListener('change', () => {
          state.childKinds = kindSelect.value;
          updatePreview();
        });
        filterSelect.addEventListener('change', () => {
          state.dataFilter = filterSelect.value;
          updatePreview();
        });
      }

      const detailRow = container.createDiv({ cls: 'iter-modal-row' });
      const nameField = detailRow.createDiv({ cls: 'iter-modal-field' });
      nameField.createEl('label', { text: 'List or child name contains (optional)', cls: 'iter-modal-label' });
      const nameInput = nameField.createEl('input', {
        type: 'text',
        placeholder: 'e.g. read, score (blank = all matching)',
        cls: 'iter-modal-input',
      });
      nameInput.value = state.nameMatch;

      const perChildField = detailRow.createDiv({ cls: 'iter-modal-field' });
      perChildField.createEl('label', { text: 'Per child', cls: 'iter-modal-label' });
      const perChildSelect = perChildField.createEl('select', { cls: 'iter-modal-select' });
      for (const item of RELATION_PER_CHILD) {
        perChildSelect.createEl('option', { value: item.id, text: item.label });
      }
      perChildSelect.value = state.perChildAgg;
      perChildSelect.addEventListener('change', () => {
        state.perChildAgg = perChildSelect.value;
      });

      const previewEl = container.createEl('p', { cls: 'iter-section-hint' });
      const updatePreview = () => {
        const matches = getMatchingChildDatasets(childDatasets, state);
        if (!matches.length) {
          previewEl.textContent = 'No matching child lists yet — future matching subgoals/habits will join automatically.';
        } else {
          const previewNames = matches.slice(0, 4).map(m => `${m.childTitle} · ${m.dataset.name}`).join(', ');
          const extra = matches.length > 4 ? ` (+${matches.length - 4} more)` : '';
          previewEl.textContent = `Matches ${matches.length} child ${matches.length === 1 ? 'list' : 'lists'}: ${previewNames}${extra}`;
        }
      };
      nameInput.addEventListener('input', () => {
        state.nameMatch = nameInput.value;
        updatePreview();
      });
      updatePreview();
    } else {
      const pickRow = container.createDiv({ cls: 'iter-modal-row' });
      const filterField = pickRow.createDiv({ cls: 'iter-modal-field' });
      filterField.createEl('label', { text: 'Filter child lists', cls: 'iter-modal-label' });
      const filterSelect = filterField.createEl('select', { cls: 'iter-modal-select' });
      for (const item of RELATION_DATA_FILTERS) {
        filterSelect.createEl('option', { value: item.id, text: item.label });
      }
      filterSelect.value = state.dataFilter;

      const perChildField = pickRow.createDiv({ cls: 'iter-modal-field' });
      perChildField.createEl('label', { text: 'Per child', cls: 'iter-modal-label' });
      const perChildSelect = perChildField.createEl('select', { cls: 'iter-modal-select' });
      for (const item of RELATION_PER_CHILD) {
        perChildSelect.createEl('option', { value: item.id, text: item.label });
      }
      perChildSelect.value = state.perChildAgg;
      perChildSelect.addEventListener('change', () => {
        state.perChildAgg = perChildSelect.value;
      });

      const listSlot = container.createDiv();
      const renderList = () => {
        listSlot.empty();
        const filtered = getMatchingChildDatasets(childDatasets, {
          childKinds: 'all',
          dataFilter: state.dataFilter,
          nameMatch: '',
        });
        renderChildRefChecklist(listSlot, filtered, selectedMap);
      };
      filterSelect.addEventListener('change', () => {
        state.dataFilter = filterSelect.value;
        renderList();
      });
      renderList();
    }

    const unitField = container.createDiv({ cls: 'iter-modal-field' });
    unitField.createEl('label', { text: 'Unit override (optional)', cls: 'iter-modal-label' });
    const unitInput = unitField.createEl('input', {
      type: 'text',
      placeholder: 'Auto from children if all share a unit',
      cls: 'iter-modal-input',
    });
    unitInput.value = state.unit;
    unitInput.addEventListener('input', () => {
      state.unit = unitInput.value;
    });
  };

  renderInner();

  return {
    getRelation: () => ({
      mode: state.mode,
      childKinds: state.childKinds,
      dataFilter: state.dataFilter,
      nameMatch: state.nameMatch.trim(),
      perChildAgg: state.perChildAgg,
      refs: state.mode === 'pick' ? [...selectedMap.values()] : [],
    }),
    getUnit: () => state.unit.trim(),
  };
}

class AddDatasetModal extends Modal {
  constructor(app, { goalKind = 'goal', treePath = null, childDatasets = [], initialDataset = null, onSubmit }) {
    super(app);
    this.goalKind = goalKind;
    this.treePath = treePath;
    this.childDatasets = childDatasets;
    this.initialDataset = initialDataset;
    this.onSubmit = onSubmit;
    this.submitting = false;
  }

  onOpen() {
    const isEdit = Boolean(this.initialDataset);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');
    contentEl.createEl('h2', { text: isEdit ? 'Edit data list' : 'Add data list', cls: 'iter-modal-title' });

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });

    const nameField = form.createDiv({ cls: 'iter-modal-field' });
    nameField.createEl('label', { text: 'Name', cls: 'iter-modal-label' });
    const nameInput = nameField.createEl('input', {
      type: 'text',
      placeholder: 'e.g. Benching PRs, Words learnt, Mock Exams Done',
      cls: 'iter-modal-input',
    });
    nameInput.required = true;
    if (this.initialDataset?.name) nameInput.value = this.initialDataset.name;

    const availableTypes = this.goalKind === 'tree' && this.treePath
      ? DATASET_TYPES
      : DATASET_TYPES.filter(item => item.id !== 'rollup');

    const typeField = form.createDiv({ cls: 'iter-modal-field' });
    typeField.createEl('label', { text: 'Data type', cls: 'iter-modal-label' });
    const typeSelect = typeField.createEl('select', { cls: 'iter-modal-select' });
    for (const item of availableTypes) {
      typeSelect.createEl('option', { value: item.id, text: item.label });
    }
    if (this.initialDataset?.type) {
      typeSelect.value = this.initialDataset.type;
      if (this.initialDataset.entries?.length > 0) {
        typeSelect.disabled = true;
      }
    } else if (availableTypes.length) {
      typeSelect.value = availableTypes[0].id;
    }

    const extraField = form.createDiv({ cls: 'iter-modal-field' });
    const extraLabel = extraField.createEl('label', { text: 'Unit (optional)', cls: 'iter-modal-label' });
    const extraInput = extraField.createEl('input', {
      type: 'text',
      placeholder: 'e.g. kg, words, reps',
      cls: 'iter-modal-input',
    });
    if (this.initialDataset) {
      if (this.initialDataset.type === 'number_time') {
        extraInput.value = this.initialDataset.unit || '';
      } else if (this.initialDataset.type === 'note' || this.initialDataset.type === 'note_time') {
        extraInput.value = Array.isArray(this.initialDataset.metricKeys) && this.initialDataset.metricKeys.length
          ? this.initialDataset.metricKeys.join(', ')
          : (this.initialDataset.metricKey || '');
      }
    }

    const rollupSlot = form.createDiv({ cls: 'iter-modal-dynamic' });
    let rollupControls = null;

    const syncExtra = () => {
      const t = typeSelect.value;
      if (t === 'rollup') {
        extraField.style.display = 'none';
        rollupSlot.style.display = '';
        if (!rollupControls) {
          rollupControls = renderRelationConfigPanel(rollupSlot, {
            childDatasets: this.childDatasets,
            allowModeSwitch: true,
            showKindAndFilter: true,
            initial: this.initialDataset?.relation
              ? { ...this.initialDataset.relation, unit: this.initialDataset.unit || '' }
              : { mode: 'query', childKinds: 'all', dataFilter: 'numeric', perChildAgg: 'all' },
          });
        }
        return;
      }

      rollupSlot.empty();
      rollupSlot.style.display = 'none';
      rollupControls = null;

      if (t === 'number_time') {
        extraField.style.display = '';
        extraLabel.textContent = 'Unit (optional)';
        extraInput.placeholder = 'e.g. kg, words, kcal';
      } else if (t === 'note_time') {
        extraField.style.display = '';
        extraLabel.textContent = 'Frontmatter properties (optional, comma-separated)';
        extraInput.placeholder = 'score (or multiple: chapters, pages)';
      } else if (t === 'note') {
        extraField.style.display = '';
        extraLabel.textContent = 'Frontmatter properties (optional, comma-separated)';
        extraInput.placeholder = 'e.g. chapters, pages, author (leave blank for plain notes)';
      } else {
        extraField.style.display = 'none';
      }
    };
    typeSelect.addEventListener('change', syncExtra);
    syncExtra();

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', {
      text: isEdit ? 'Save changes' : 'Add data list',
      type: 'submit',
      cls: 'mod-cta',
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        const type = typeSelect.value;
        let relation = null;
        if (type === 'rollup' && rollupControls) {
          relation = rollupControls.getRelation();
          if (relation.mode === 'pick' && !relation.refs.length) {
            throw new Error('Select at least one child data list.');
          }
        }
        const parsedKeys = parseMetricKeysInput(extraInput.value);
        const metricKeys = type === 'note_time'
          ? (parsedKeys.length ? parsedKeys : ['score'])
          : type === 'note'
            ? parsedKeys
            : [];
        await this.onSubmit({
          name: nameInput.value,
          type,
          unit: type === 'rollup'
            ? (rollupControls?.getUnit() ?? '')
            : (type === 'number_time' ? extraInput.value : ''),
          metricKey: metricKeys[0] || '',
          metricKeys,
          relation,
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

const TREE_WIDGET_PRESETS = [
  {
    value: '__rel:all:numeric',
    label: 'All children · Numeric (auto-includes new)',
    initial: { mode: 'query', childKinds: 'all', dataFilter: 'numeric', perChildAgg: 'all' },
  },
  {
    value: '__rel:habits:numeric',
    label: 'Habits · Numeric (auto-includes new)',
    initial: { mode: 'query', childKinds: 'habits', dataFilter: 'numeric', perChildAgg: 'all' },
  },
  {
    value: '__rel:subgoals:numeric',
    label: 'Subgoals · Numeric (auto-includes new)',
    initial: { mode: 'query', childKinds: 'subgoals', dataFilter: 'numeric', perChildAgg: 'all' },
  },
  {
    value: '__rel:all:note',
    label: 'All children · Notes (auto-includes new)',
    initial: { mode: 'query', childKinds: 'all', dataFilter: 'note', perChildAgg: 'all' },
  },
  {
    value: '__rel:all:text',
    label: 'All children · Text entries (auto-includes new)',
    initial: { mode: 'query', childKinds: 'all', dataFilter: 'text', perChildAgg: 'all' },
  },
  {
    value: '__rel:pick',
    label: 'Pick specific child lists…',
    initial: { mode: 'pick', childKinds: 'all', dataFilter: 'any', perChildAgg: 'all', refs: [] },
  },
];

class AddWidgetModal extends Modal {
  constructor(app, { datasets = [], childDatasets = [], goalKind = 'goal', treePath = null, initialWidget = null, onSubmit, onOpenCanvas = null }) {
    super(app);
    this.datasets = datasets;
    this.childDatasets = childDatasets;
    this.goalKind = goalKind;
    this.treePath = treePath;
    this.initialWidget = initialWidget;
    this.onSubmit = onSubmit;
    this.onOpenCanvas = onOpenCanvas;
    this.submitting = false;
  }

  onOpen() {
    const isEdit = Boolean(this.initialWidget);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');

    const headBar = contentEl.createDiv({ cls: 'iter-modal-headbar' });
    headBar.createEl('h2', { text: isEdit ? 'Edit widget' : 'Add widget', cls: 'iter-modal-title' });

    const isTree = this.goalKind === 'tree' && Boolean(this.treePath);
    const canUseDataWidgets = this.datasets.length > 0 || isTree;

    let canvasSwitchBtn = null;
    if (this.onOpenCanvas) {
      canvasSwitchBtn = headBar.createEl('button', {
        text: 'Advanced Canvas →',
        type: 'button',
        cls: 'iter-btn-ghost iter-canvas-switch-btn',
      });
    }

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });
    const row = form.createDiv({ cls: 'iter-modal-row' });

    const availableTypes = WIDGET_TYPES.filter(item =>
      item.id === 'streak' ? this.goalKind === 'habit' : canUseDataWidgets,
    );

    const typeField = row.createDiv({ cls: 'iter-modal-field' });
    typeField.createEl('label', { text: 'Widget type', cls: 'iter-modal-label' });
    const typeSelect = typeField.createEl('select', { cls: 'iter-modal-select' });
    for (const item of availableTypes) {
      typeSelect.createEl('option', { value: item.id, text: item.label });
    }
    if (this.initialWidget?.type && availableTypes.some(t => t.id === this.initialWidget.type)) {
      typeSelect.value = this.initialWidget.type;
    } else if (availableTypes.length) {
      typeSelect.value = availableTypes[0].id;
    }

    const dsField = row.createDiv({ cls: 'iter-modal-field' });
    dsField.createEl('label', { text: 'Linked data', cls: 'iter-modal-label' });
    const dsSelect = dsField.createEl('select', { cls: 'iter-modal-select' });
    for (const ds of this.datasets) {
      dsSelect.createEl('option', { value: ds.id, text: ds.name });
    }
    if (isTree) {
      for (const preset of TREE_WIDGET_PRESETS) {
        dsSelect.createEl('option', { value: preset.value, text: preset.label });
      }
      this.childDatasets.forEach((item, idx) => {
        dsSelect.createEl('option', {
          value: `__child:${idx}`,
          text: `Child: ${item.childTitle} — ${item.dataset.name}`,
        });
      });
    }
    if (this.initialWidget) {
      if (this.initialWidget.datasetId && this.datasets.some(d => d.id === this.initialWidget.datasetId)) {
        dsSelect.value = this.initialWidget.datasetId;
      } else if (this.initialWidget.relation && isTree) {
        const rel = this.initialWidget.relation;
        if (rel.mode === 'pick') {
          const singleRef = rel.refs?.length === 1 ? rel.refs[0] : null;
          const childIdx = singleRef
            ? this.childDatasets.findIndex(c => c.dataset.id === singleRef.datasetId && (!singleRef.filePath || c.filePath === singleRef.filePath))
            : -1;
          dsSelect.value = childIdx >= 0 ? `__child:${childIdx}` : '__rel:pick';
        } else {
          const matchedPreset = TREE_WIDGET_PRESETS.find(
            p => p.initial.mode === 'query'
              && p.initial.childKinds === rel.childKinds
              && p.initial.dataFilter === rel.dataFilter,
          );
          dsSelect.value = matchedPreset ? matchedPreset.value : TREE_WIDGET_PRESETS[0].value;
        }
      }
    } else if (this.datasets.length) {
      dsSelect.value = this.datasets[0].id;
    } else if (isTree) {
      dsSelect.value = TREE_WIDGET_PRESETS[0].value;
    }

    const relationSlot = form.createDiv({ cls: 'iter-modal-dynamic' });

    const titleField = form.createDiv({ cls: 'iter-modal-field' });
    titleField.createEl('label', { text: 'Widget title (optional)', cls: 'iter-modal-label' });
    const titleInput = titleField.createEl('input', {
      type: 'text',
      placeholder: 'Auto-named from data if left blank',
      cls: 'iter-modal-input',
    });
    if (this.initialWidget?.title) titleInput.value = this.initialWidget.title;

    const metricSlot = form.createDiv({ cls: 'iter-modal-dynamic' });
    const dynamicSlot = form.createDiv({ cls: 'iter-modal-dynamic' });

    let aggSelect = null;
    let aggTouched = false;
    let modeSelect = null;
    let targetInput = null;
    let variantSelect = null;
    let relControls = null;
    let metricInput = null;

    const isRollupSumDefault = () => {
      const val = dsSelect.value || '';
      if (val.startsWith('__rel:') && val.endsWith(':numeric')) return true;
      const localDs = this.datasets.find(d => d.id === val);
      return localDs?.type === 'rollup' && localDs?.relation?.dataFilter === 'numeric';
    };

    const getSourceKeysInfo = () => {
      const val = dsSelect.value || '';
      const keys = [];
      const seen = new Set();
      const pushKey = k => {
        if (typeof k === 'string' && k.trim() && !seen.has(k.trim().toLowerCase())) {
          seen.add(k.trim().toLowerCase());
          keys.push(k.trim());
        }
      };
      const inspectDs = (ds, sourcePath = '') => {
        for (const k of ds.metricKeys || []) pushKey(k);
        if ((ds.type === 'note' || ds.type === 'note_time') && this.app) {
          for (const entry of resolveDatasetEntries(this.app, ds, sourcePath)) {
            for (const p of entry.propsList || []) pushKey(p.key);
          }
        }
      };
      const localDs = this.datasets.find(d => d.id === val);
      if (localDs) {
        inspectDs(localDs);
        if (localDs.type === 'rollup') {
          for (const ch of this.childDatasets) {
            inspectDs(ch.dataset, ch.filePath);
          }
        }
        return {
          keys,
          preferDefault: localDs.type === 'note' || localDs.type === 'note_time',
          show: keys.length > 0 || localDs.type === 'note' || localDs.type === 'note_time' || localDs.type === 'rollup',
        };
      }
      if (val.startsWith('__child:')) {
        const idx = Number(val.slice('__child:'.length));
        const childItem = this.childDatasets[idx];
        if (childItem) {
          inspectDs(childItem.dataset, childItem.filePath);
          return {
            keys,
            preferDefault: childItem.dataset.type === 'note' || childItem.dataset.type === 'note_time',
            show: keys.length > 0 || childItem.dataset.type === 'note' || childItem.dataset.type === 'note_time',
          };
        }
      }
      if (val.startsWith('__rel:')) {
        for (const ch of this.childDatasets) {
          inspectDs(ch.dataset, ch.filePath);
        }
        return { keys, preferDefault: false, show: true };
      }
      return { keys: [], preferDefault: false, show: false };
    };

    const rebuildMetricSlot = () => {
      metricSlot.empty();
      metricInput = null;
      const wType = typeSelect.value;
      if (wType === 'streak' || wType === 'note_navigator') {
        metricSlot.style.display = 'none';
        return;
      }
      const info = getSourceKeysInfo();
      if (!info.show) {
        metricSlot.style.display = 'none';
        return;
      }
      metricSlot.style.display = '';
      const field = metricSlot.createDiv({ cls: 'iter-modal-field' });
      field.createEl('label', { text: 'Frontmatter property filter (optional)', cls: 'iter-modal-label' });
      metricInput = field.createEl('input', {
        type: 'text',
        placeholder: info.keys.length ? `e.g. ${info.keys.slice(0, 3).join(', ')} (blank = auto)` : 'e.g. pages, chapters, score',
        cls: 'iter-modal-input',
      });
      if (this.initialWidget?.metricKey !== undefined && this.initialWidget.metricKey !== '') {
        metricInput.value = this.initialWidget.metricKey;
      } else if (info.preferDefault && info.keys.length) {
        metricInput.value = info.keys[0];
      }
      if (info.keys.length) {
        const chips = field.createDiv({ cls: 'iter-chip-suggestions' });
        for (const k of info.keys.slice(0, 6)) {
          const btn = chips.createEl('button', { text: k, type: 'button', cls: 'iter-suggest-chip' });
          btn.addEventListener('click', () => {
            metricInput.value = k;
          });
        }
      }
    };

    const rebuildRelationSlot = () => {
      relationSlot.empty();
      relControls = null;
      const wType = typeSelect.value;
      const val = dsSelect.value || '';
      if (wType === 'streak' || !val.startsWith('__rel:')) {
        relationSlot.style.display = 'none';
        return;
      }
      const preset = TREE_WIDGET_PRESETS.find(p => p.value === val);
      if (!preset) {
        relationSlot.style.display = 'none';
        return;
      }
      relationSlot.style.display = '';
      const initialRel = this.initialWidget?.relation
        ? { ...preset.initial, ...this.initialWidget.relation, unit: this.initialWidget.unit || '' }
        : preset.initial;
      relControls = renderRelationConfigPanel(relationSlot, {
        childDatasets: this.childDatasets,
        allowModeSwitch: false,
        showKindAndFilter: false,
        initial: initialRel,
      });
    };

    const rebuildOptions = () => {
      dynamicSlot.empty();
      aggSelect = null;
      aggTouched = false;
      modeSelect = null;
      targetInput = null;
      variantSelect = null;

      const wType = typeSelect.value;
      dsField.style.display = wType === 'streak' ? 'none' : '';
      titleInput.placeholder = wType === 'streak' ? 'Streak' : 'Auto-named from data if left blank';
      if (wType === 'streak') {
        dynamicSlot.createEl('p', {
          text: 'Tracks consecutive scheduled completions from this habit\'s watering log.',
          cls: 'iter-section-hint',
        });
      } else if (wType === 'stat') {
        const field = dynamicSlot.createDiv({ cls: 'iter-modal-field' });
        field.createEl('label', { text: 'Calculation', cls: 'iter-modal-label' });
        aggSelect = field.createEl('select', { cls: 'iter-modal-select' });
        for (const item of STAT_AGGS) {
          aggSelect.createEl('option', { value: item.id, text: item.label });
        }
        aggSelect.value = this.initialWidget?.agg || (isRollupSumDefault() ? 'sum' : 'latest');
        aggSelect.addEventListener('change', () => {
          aggTouched = true;
        });
      } else if (wType === 'goal_bar') {
        const barRow = dynamicSlot.createDiv({ cls: 'iter-modal-row' });
        const modeField = barRow.createDiv({ cls: 'iter-modal-field' });
        modeField.createEl('label', { text: 'Compare value', cls: 'iter-modal-label' });
        modeSelect = modeField.createEl('select', { cls: 'iter-modal-select' });
        for (const item of BAR_MODES) {
          modeSelect.createEl('option', { value: item.id, text: item.label });
        }
        modeSelect.value = this.initialWidget?.mode || BAR_MODES[0].id;

        const tField = barRow.createDiv({ cls: 'iter-modal-field' });
        tField.createEl('label', { text: 'Goal target number', cls: 'iter-modal-label' });
        targetInput = tField.createEl('input', {
          type: 'number',
          step: 'any',
          placeholder: 'e.g. 100',
          cls: 'iter-modal-input',
        });
        targetInput.required = true;
        if (this.initialWidget?.target !== null && this.initialWidget?.target !== undefined) {
          targetInput.value = String(this.initialWidget.target);
        }
      } else if (wType === 'chart') {
        const field = dynamicSlot.createDiv({ cls: 'iter-modal-field' });
        field.createEl('label', { text: 'Graph style', cls: 'iter-modal-label' });
        variantSelect = field.createEl('select', { cls: 'iter-modal-select' });
        for (const item of CHART_VARIANTS) {
          variantSelect.createEl('option', { value: item.id, text: item.label });
        }
        variantSelect.value = this.initialWidget?.variant || CHART_VARIANTS[0].id;
      } else if (wType === 'note_navigator') {
        const currentVal = dsSelect.value || '';
        const currentDs = this.datasets.find(d => d.id === currentVal);
        const currentIsNote = currentDs
          ? (currentDs.type === 'note' || currentDs.type === 'note_time' || (currentDs.type === 'rollup' && currentDs.relation?.dataFilter === 'note'))
          : (currentVal === '__rel:all:note' || currentVal === '__rel:pick'
            || (currentVal.startsWith('__child:') && (() => {
              const childItem = this.childDatasets[Number(currentVal.slice('__child:'.length))];
              return childItem && (childItem.dataset.type === 'note' || childItem.dataset.type === 'note_time');
            })()));
        if (!currentIsNote) {
          const noteDs = this.datasets.find(
            d => d.type === 'note' || d.type === 'note_time' || (d.type === 'rollup' && d.relation?.dataFilter === 'note'),
          );
          if (noteDs) dsSelect.value = noteDs.id;
          else if (isTree) dsSelect.value = '__rel:all:note';
        }
      }

      rebuildRelationSlot();
      rebuildMetricSlot();
    };

    const collectDraftConfig = ({ validatePick = true } = {}) => {
      const wType = typeSelect.value;
      const sourceVal = dsSelect.value || '';
      let datasetId = '';
      let relation = null;
      let unit = '';

      if (wType !== 'streak') {
        if (sourceVal.startsWith('__rel:')) {
          if (relControls) {
            relation = relControls.getRelation();
            unit = relControls.getUnit();
          } else {
            const preset = TREE_WIDGET_PRESETS.find(p => p.value === sourceVal);
            relation = preset ? { ...preset.initial } : null;
          }
          if (validatePick && relation?.mode === 'pick' && !relation.refs?.length) {
            throw new Error('Select at least one child data list.');
          }
        } else if (sourceVal.startsWith('__child:')) {
          const idx = Number(sourceVal.slice('__child:'.length));
          const childItem = this.childDatasets[idx];
          if (!childItem) {
            if (validatePick) throw new Error('Selected child data list no longer exists.');
          } else {
            relation = {
              mode: 'pick',
              dataFilter: 'any',
              perChildAgg: 'all',
              refs: [{ filePath: childItem.filePath, datasetId: childItem.dataset.id }],
            };
          }
        } else {
          datasetId = sourceVal;
        }
      }

      return {
        type: wType,
        datasetId,
        relation,
        unit,
        metricKey: metricInput?.value?.trim() || '',
        title: titleInput.value,
        agg: aggSelect?.value ?? 'latest',
        mode: modeSelect?.value ?? 'latest',
        target: targetInput?.value ?? null,
        variant: variantSelect?.value ?? 'line',
      };
    };

    if (canvasSwitchBtn) {
      canvasSwitchBtn.addEventListener('click', () => {
        const draft = collectDraftConfig({ validatePick: false });
        this.close();
        this.onOpenCanvas(draft);
      });
    }

    dsSelect.addEventListener('change', () => {
      rebuildRelationSlot();
      rebuildMetricSlot();
      if (aggSelect && !aggTouched) {
        aggSelect.value = isRollupSumDefault() ? 'sum' : 'latest';
      }
    });
    typeSelect.addEventListener('change', rebuildOptions);
    rebuildOptions();

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', {
      text: isEdit ? 'Save changes' : 'Add widget',
      type: 'submit',
      cls: 'mod-cta',
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        await this.onSubmit(collectDraftConfig({ validatePick: true }));
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
  constructor(app, { noteFile = null, path = '', showDate = true, metricKey = 'score', metricKeys = null, initialEntry = null, syncToNote = false, onSubmit }) {
    super(app);
    this.noteFile = noteFile;
    this.notePath = noteFile?.path || path || initialEntry?.path || '';
    this.showDate = Boolean(showDate);
    const resolvedKeys = Array.isArray(metricKeys)
      ? metricKeys.filter(k => typeof k === 'string' && k.trim()).map(k => k.trim())
      : (typeof metricKey === 'string' && metricKey.trim() ? [metricKey.trim()] : []);
    this.metricKeys = resolvedKeys;
    this.initialEntry = initialEntry;
    this.syncToNote = Boolean(syncToNote && noteFile);
    this.onSubmit = onSubmit;
    this.submitting = false;
  }

  onOpen() {
    const isEdit = Boolean(this.initialEntry);
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');
    const noteTitle = this.noteFile ? stripMd(this.noteFile.name) : stripMd(this.notePath.split('/').pop());
    contentEl.createEl('h2', {
      text: `${isEdit ? 'Edit' : 'Add'} "${noteTitle}"`,
      cls: 'iter-modal-title',
    });

    const fm = (this.noteFile && this.app.metadataCache?.getFileCache?.(this.noteFile)?.frontmatter) ?? null;
    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });
    let dateInput = null;

    if (this.showDate) {
      const dateField = form.createDiv({ cls: 'iter-modal-field' });
      dateField.createEl('label', { text: 'Date', cls: 'iter-modal-label' });
      dateInput = dateField.createEl('input', { type: 'date', cls: 'iter-modal-input' });
      dateInput.value = this.initialEntry?.date || toDateKey();
      dateInput.required = true;
    }

    const propInputs = new Map();
    if (this.metricKeys.length) {
      const grid = form.createDiv({ cls: this.metricKeys.length > 1 ? 'iter-modal-row' : 'iter-modal-dynamic' });
      for (const key of this.metricKeys) {
        const field = grid.createDiv({ cls: 'iter-modal-field' });
        field.createEl('label', { text: `${key} (optional)`, cls: 'iter-modal-label' });
        const fmExisting = fm?.[key];
        const placeholder = fmExisting !== undefined && fmExisting !== null && fmExisting !== ''
          ? `Frontmatter: ${fmExisting} (blank = sync)`
          : `Reads "${key}" frontmatter if blank`;
        const input = field.createEl('input', {
          type: 'text',
          placeholder,
          cls: 'iter-modal-input',
        });
        const initProp = this.initialEntry?.props?.[key]
          ?? (key === this.metricKeys[0] && this.initialEntry?.value !== undefined && this.initialEntry?.value !== null
            ? this.initialEntry.value
            : undefined);
        if (initProp !== undefined && initProp !== null) {
          input.value = String(initProp);
        }
        propInputs.set(key, input);
      }
    }

    let syncToggleBtn = null;
    if (this.metricKeys.length && this.noteFile) {
      syncToggleBtn = form.createEl('button', {
        text: this.syncToNote
          ? '✓ Syncing entered values into note YAML frontmatter'
          : 'Write entered values to note YAML frontmatter (optional)',
        type: 'button',
        cls: `iter-btn-ghost iter-sync-fm-btn${this.syncToNote ? ' is-active' : ''}`,
      });
      syncToggleBtn.addEventListener('click', () => {
        this.syncToNote = !this.syncToNote;
        syncToggleBtn.toggleClass('is-active', this.syncToNote);
        syncToggleBtn.textContent = this.syncToNote
          ? '✓ Syncing entered values into note YAML frontmatter'
          : 'Write entered values to note YAML frontmatter (optional)';
      });
    }

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', {
      text: isEdit ? 'Save changes' : 'Add note',
      type: 'submit',
      cls: 'mod-cta',
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        const props = {};
        let hasProps = false;
        for (const [key, input] of propInputs.entries()) {
          const raw = typeof input.value === 'string' ? input.value.trim() : '';
          if (!raw) continue;
          const num = toFiniteNumber(raw);
          props[key] = num !== null ? num : raw;
          hasProps = true;
        }
        if (this.syncToNote && hasProps && this.noteFile && typeof this.app?.fileManager?.processFrontMatter === 'function') {
          await this.app.fileManager.processFrontMatter(this.noteFile, noteFm => {
            for (const [k, v] of Object.entries(props)) {
              noteFm[k] = v;
            }
          });
        }
        const primaryKey = this.metricKeys[0] || '';
        const primaryVal = primaryKey && props[primaryKey] !== undefined
          ? toFiniteNumber(props[primaryKey])
          : null;

        const payload = { path: this.notePath };
        if (this.showDate && dateInput) payload.date = dateInput.value;
        if (primaryVal !== null) payload.value = primaryVal;
        if (hasProps) payload.props = props;

        await this.onSubmit(payload);
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : String(error));
      } finally {
        this.submitting = false;
        submit.disabled = false;
      }
    });

    const firstProp = propInputs.values().next().value;
    (firstProp || dateInput)?.focus?.();
  }

  onClose() {
    this.contentEl.empty();
  }
}

class EditEntryModal extends Modal {
  constructor(app, { dataset, entry, onSubmit }) {
    super(app);
    this.dataset = dataset;
    this.entry = entry;
    this.onSubmit = onSubmit;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');
    contentEl.createEl('h2', { text: `Edit entry in "${this.dataset.name}"`, cls: 'iter-modal-title' });

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });
    const isNumber = this.dataset.type === 'number_time';

    const valField = form.createDiv({ cls: 'iter-modal-field' });
    valField.createEl('label', {
      text: isNumber ? (this.dataset.unit ? `Value (${this.dataset.unit})` : 'Value') : 'Text',
      cls: 'iter-modal-label',
    });
    const valInput = valField.createEl('input', {
      type: isNumber ? 'number' : 'text',
      step: isNumber ? 'any' : undefined,
      cls: 'iter-modal-input',
    });
    valInput.required = true;
    valInput.value = String(this.entry?.value ?? this.entry?.label ?? '');

    let dateInput = null;
    if (isNumber || this.entry?.date) {
      const dateField = form.createDiv({ cls: 'iter-modal-field' });
      dateField.createEl('label', { text: 'Date', cls: 'iter-modal-label' });
      dateInput = dateField.createEl('input', { type: 'date', cls: 'iter-modal-input' });
      dateInput.value = this.entry?.date || toDateKey();
      if (isNumber) dateInput.required = true;
    }

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', { text: 'Save changes', type: 'submit', cls: 'mod-cta' });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        const payload = isNumber
          ? { value: Number(valInput.value), date: dateInput?.value || toDateKey() }
          : (dateInput?.value ? { value: valInput.value, date: dateInput.value } : { value: valInput.value });
        await this.onSubmit(payload);
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : String(error));
      } finally {
        this.submitting = false;
        submit.disabled = false;
      }
    });

    valInput.focus();
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
  EditEntryModal,
};
