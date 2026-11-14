const { Modal, FuzzySuggestModal, Notice, setIcon } = require('obsidian');
const {
  ROOT,
  WE_PATH,
  toDateKey,
  waterHabit,
  toggleSubgoal,
  formatCadenceLabel,
  computeHabitStreak,
  computeHabitScheduleMeta,
} = require('./storage');

function stripMd(name) {
  return String(name || '').replace(/\.md$/i, '');
}

function sanitizeName(raw) {
  return String(raw || '')
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();
}
const { listGarden } = require('./catalog');
const {
  readGoalDocument,
  resolveDatasetEntries,
  discoverVaultFolders,
  addDataset,
  addDatasetEntry,
  computeStat,
  computeGoalBar,
  formatNumber,
  resolveWidgetDataset,
  discoverHabits,
} = require('./data-model');
const { NoteTimeMetaModal } = require('./goal-modals');

async function ensureFolderChain(vault, folderPath) {
  const clean = String(folderPath || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!clean) return;
  const parts = clean.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur = cur ? `${cur}/${part}` : part;
    if (!vault.getAbstractFileByPath(cur)) {
      try {
        await vault.createFolder(cur);
      } catch (err) {
        if (!vault.getAbstractFileByPath(cur) && !/already exists/i.test(String(err?.message ?? err))) {
          throw err;
        }
      }
    }
  }
}

function inferDatasetDefaultFolder(app, dataset, goalFile = null, doc = null) {
  if (dataset?.autoQuery?.folder) {
    const first = String(dataset.autoQuery.folder)
      .split(',')
      .map(s => s.trim().replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)[0];
    if (first) return first;
  }

  if (app && dataset) {
    const entries = resolveDatasetEntries(app, dataset, goalFile?.path || '');
    const counts = new Map();
    for (const item of entries) {
      const p = item?.path || '';
      const slash = p.lastIndexOf('/');
      if (slash > 0) {
        const dir = p.slice(0, slash);
        if (!dir.startsWith(`${ROOT}/`)) {
          counts.set(dir, (counts.get(dir) || 0) + 1);
        }
      }
    }
    let bestDir = '';
    let bestCount = 0;
    for (const [dir, c] of counts.entries()) {
      if (c > bestCount) {
        bestDir = dir;
        bestCount = c;
      }
    }
    if (bestDir) return bestDir;
  }

  const fallbackName = sanitizeName(doc?.title || (goalFile ? stripMd(goalFile.name) : '') || 'Notes') || 'Notes';
  return `Notes/${fallbackName}`;
}

function extractAutoQueryDefaults(autoQuery) {
  const fmPairs = {};
  const tags = [];
  if (!autoQuery || typeof autoQuery !== 'object') return { fmPairs, tags };

  if (typeof autoQuery.where === 'string' && autoQuery.where.trim()) {
    const clauses = autoQuery.where.split(/\s*(?:,|&&|\band\b)\s*/i).filter(Boolean);
    for (const clause of clauses) {
      const m = clause.match(/^([a-zA-Z0-9_.-]+)\s*(?:=|:)\s*(.+)$/);
      if (m) {
        const key = m[1].trim();
        const rawVal = m[2].trim().replace(/^["']|["']$/g, '');
        if (key && rawVal) {
          const num = Number(rawVal);
          fmPairs[key] = Number.isFinite(num) && rawVal !== '' ? num : rawVal;
        }
      }
    }
  }

  if (typeof autoQuery.tag === 'string' && autoQuery.tag.trim()) {
    for (const rawTag of autoQuery.tag.split(',')) {
      const clean = rawTag.trim().replace(/^#+/, '');
      if (clean && !tags.includes(clean)) tags.push(clean);
    }
  }

  return { fmPairs, tags };
}

function serializeFrontmatterValue(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  const str = String(val ?? '');
  if (/^[a-zA-Z0-9_-]+$/.test(str) && !/^(true|false|null)$/i.test(str)) {
    return str;
  }
  return JSON.stringify(str);
}

async function createDatasetNote(app, {
  goalFile,
  dataset,
  title,
  folder = '',
  date = '',
  props = {},
  waterHabitNow = false,
}) {
  const cleanTitle = sanitizeName(title);
  if (!cleanTitle) {
    throw new Error('Enter a valid note title.');
  }

  const cleanFolder = String(folder || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (cleanFolder) {
    await ensureFolderChain(app.vault, cleanFolder);
  }

  const filePath = cleanFolder ? `${cleanFolder}/${cleanTitle}.md` : `${cleanTitle}.md`;
  let noteFile = app.vault.getAbstractFileByPath(filePath);

  const effectiveDate = date || toDateKey();
  const { fmPairs, tags } = extractAutoQueryDefaults(dataset?.autoQuery);
  const mergedFm = { ...fmPairs };
  if (dataset?.type === 'note_time' || date) {
    mergedFm.date = effectiveDate;
  }
  if (props && typeof props === 'object') {
    for (const [k, v] of Object.entries(props)) {
      if (v !== undefined && v !== null && v !== '') {
        mergedFm[k] = v;
      }
    }
  }

  if (!noteFile) {
    const fmLines = ['---'];
    for (const [k, v] of Object.entries(mergedFm)) {
      fmLines.push(`${k}: ${serializeFrontmatterValue(v)}`);
    }
    if (tags.length > 0) {
      fmLines.push('tags:');
      for (const t of tags) {
        fmLines.push(`  - ${t}`);
      }
    }
    fmLines.push('---', '', `# ${cleanTitle}`, '', '');
    noteFile = await app.vault.create(filePath, fmLines.join('\n'));
  } else if (typeof app?.fileManager?.processFrontMatter === 'function') {
    await app.fileManager.processFrontMatter(noteFile, fm => {
      for (const [k, v] of Object.entries(mergedFm)) {
        fm[k] = v;
      }
    });
  }

  if (goalFile && dataset?.id) {
    const primaryKey = dataset.metricKey || dataset.metricKeys?.[0] || '';
    const primaryNum = primaryKey && props?.[primaryKey] !== undefined ? Number(props[primaryKey]) : NaN;
    const entryPayload = { path: noteFile.path };
    if (dataset.type === 'note_time') {
      entryPayload.date = effectiveDate;
    }
    if (Number.isFinite(primaryNum)) {
      entryPayload.value = primaryNum;
    }
    if (props && Object.keys(props).length > 0) {
      entryPayload.props = props;
    }
    await addDatasetEntry(app, goalFile, dataset.id, entryPayload);
  }

  if (waterHabitNow && goalFile) {
    await waterHabit(app, goalFile);
  }

  return noteFile;
}

class CreateDatasetNoteModal extends Modal {
  constructor(app, { goalFile, doc = null, dataset, onCreated = null }) {
    super(app);
    this.goalFile = goalFile;
    this.goalDoc = doc || (goalFile ? readGoalDocument(app, goalFile) : null);
    this.dataset = dataset;
    this.onCreated = onCreated;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');

    contentEl.createEl('h2', {
      text: `Create note in "${this.dataset?.name || 'Data list'}"`,
      cls: 'iter-modal-title',
    });

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });

    const titleField = form.createDiv({ cls: 'iter-modal-field' });
    titleField.createEl('label', { text: 'Note title', cls: 'iter-modal-label' });
    const titleInput = titleField.createEl('input', {
      type: 'text',
      placeholder: 'e.g. Le Cygne, Chapter 2, Mock Exam 2',
      cls: 'iter-modal-input iter-new-note-title-input',
    });
    titleInput.required = true;

    const folderField = form.createDiv({ cls: 'iter-modal-field' });
    folderField.createEl('label', { text: 'Folder in vault', cls: 'iter-modal-label' });
    const folderInput = folderField.createEl('input', {
      type: 'text',
      placeholder: 'e.g. Books/As Flores do Mal',
      cls: 'iter-modal-input iter-new-note-folder-input',
    });
    folderInput.value = inferDatasetDefaultFolder(this.app, this.dataset, this.goalFile, this.goalDoc);

    const vaultFolders = discoverVaultFolders(this.app);
    if (vaultFolders.length > 0) {
      const chips = folderField.createDiv({ cls: 'iter-chip-suggestions' });
      for (const dir of vaultFolders.slice(0, 8)) {
        const chip = chips.createEl('button', {
          text: dir,
          type: 'button',
          cls: 'iter-suggest-chip iter-folder-chip',
        });
        chip.addEventListener('click', () => {
          folderInput.value = dir;
        });
      }
    }

    let dateInput = null;
    if (this.dataset?.type === 'note_time') {
      const dateField = form.createDiv({ cls: 'iter-modal-field' });
      dateField.createEl('label', { text: 'Date', cls: 'iter-modal-label' });
      dateInput = dateField.createEl('input', {
        type: 'date',
        cls: 'iter-modal-input iter-new-note-date-input',
      });
      dateInput.value = toDateKey();
      dateInput.required = true;
    }

    const keys = Array.isArray(this.dataset?.metricKeys) && this.dataset.metricKeys.length
      ? this.dataset.metricKeys
      : (this.dataset?.metricKey ? [this.dataset.metricKey] : []);

    const propInputs = new Map();
    if (keys.length > 0) {
      const grid = form.createDiv({ cls: keys.length > 1 ? 'iter-modal-row' : 'iter-modal-dynamic' });
      for (const key of keys) {
        const f = grid.createDiv({ cls: 'iter-modal-field' });
        f.createEl('label', { text: `${key} (frontmatter, optional)`, cls: 'iter-modal-label' });
        const inp = f.createEl('input', {
          type: 'text',
          placeholder: `Written to "${key}" in note YAML`,
          cls: 'iter-modal-input iter-new-note-prop-input',
        });
        propInputs.set(key, inp);
      }
    }

    let waterNow = this.goalDoc?.kind === 'habit';
    if (this.goalDoc?.kind === 'habit') {
      const waterBtn = form.createEl('button', {
        type: 'button',
        cls: `iter-suggest-chip iter-water-on-create-toggle${waterNow ? ' is-active' : ''}`,
        text: `✓ Also water "${this.goalDoc.title}" for today`,
      });
      waterBtn.addEventListener('click', () => {
        waterNow = !waterNow;
        waterBtn.textContent = waterNow
          ? `✓ Also water "${this.goalDoc.title}" for today`
          : `Also water "${this.goalDoc.title}" for today`;
        waterBtn.toggleClass?.('is-active', waterNow);
      });
    }

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', {
      text: 'Create & open note',
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
        for (const [k, inp] of propInputs.entries()) {
          const raw = String(inp.value || '').trim();
          if (!raw) continue;
          const num = Number(raw);
          props[k] = Number.isFinite(num) ? num : raw;
        }
        const createdFile = await createDatasetNote(this.app, {
          goalFile: this.goalFile,
          dataset: this.dataset,
          title: titleInput.value,
          folder: folderInput.value,
          date: dateInput ? dateInput.value : '',
          props,
          waterHabitNow: waterNow,
        });
        if (this.onCreated) {
          await this.onCreated(createdFile);
        }
        this.close();
      } catch (err) {
        new Notice(err instanceof Error ? err.message : String(err));
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

function discoverAllGoalTargets(app) {
  const garden = listGarden(app);
  const targets = [];
  for (const tree of garden.trees) {
    if (tree.file) {
      const doc = readGoalDocument(app, tree.file);
      if (doc) {
        targets.push({
          file: tree.file,
          doc,
          treeTitle: tree.title,
          goalTitle: tree.title,
          kind: 'tree',
          label: `${tree.title} (Tree)`,
        });
      }
    }
    for (const sub of tree.subgoals || []) {
      if (sub.file) {
        const doc = readGoalDocument(app, sub.file);
        if (doc) {
          targets.push({
            file: sub.file,
            doc,
            treeTitle: tree.title,
            goalTitle: sub.title,
            kind: 'subgoal',
            label: `${tree.title} → ${sub.title} (Subgoal)`,
          });
        }
      }
    }
    for (const hab of tree.habits || []) {
      if (hab.file) {
        const doc = readGoalDocument(app, hab.file);
        if (doc) {
          targets.push({
            file: hab.file,
            doc,
            treeTitle: tree.title,
            goalTitle: hab.title,
            kind: 'habit',
            label: `${tree.title} → ${hab.title} (Habit)`,
          });
        }
      }
    }
  }
  return targets;
}

function findNoteIterConnections(app, noteFile) {
  if (!app || !noteFile?.path || noteFile.path.startsWith(`${ROOT}/`)) return [];
  const targets = discoverAllGoalTargets(app);
  const connections = [];

  for (const target of targets) {
    for (const ds of target.doc.datasets || []) {
      if (ds.type !== 'note' && ds.type !== 'note_time') continue;
      const entries = resolveDatasetEntries(app, ds, target.file.path);
      const matched = entries.find(e => e.path === noteFile.path || e.noteFile?.path === noteFile.path);
      if (matched) {
        connections.push({
          goalFile: target.file,
          doc: target.doc,
          treeTitle: target.treeTitle,
          goalTitle: target.goalTitle,
          goalKind: target.kind,
          dataset: ds,
          entry: matched,
        });
      }
    }
  }
  return connections;
}

class LinkNoteToDatasetModal extends Modal {
  constructor(app, { noteFile, onLinked = null }) {
    super(app);
    this.noteFile = noteFile;
    this.onLinked = onLinked;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');

    const noteTitle = this.noteFile ? stripMd(this.noteFile.name) : 'Note';
    contentEl.createEl('h2', {
      text: `Link "${noteTitle}" to Iter`,
      cls: 'iter-modal-title',
    });

    const targets = discoverAllGoalTargets(this.app);
    const options = [];
    for (const t of targets) {
      for (const ds of t.doc.datasets || []) {
        if (ds.type === 'note' || ds.type === 'note_time') {
          options.push({
            id: `${t.file.path}::${ds.id}`,
            target: t,
            dataset: ds,
            label: `${t.treeTitle}${t.kind !== 'tree' ? ` → ${t.goalTitle}` : ''} · ${ds.name} (${ds.type === 'note_time' ? 'Notes & Time' : 'Notes'})`,
          });
        }
      }
    }

    if (!options.length && !targets.length) {
      contentEl.createEl('p', {
        text: 'Create a Tree, Subgoal, or Habit in Iter first.',
        cls: 'iter-section-hint',
      });
      return;
    }

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });

    const selectField = form.createDiv({ cls: 'iter-modal-field' });
    selectField.createEl('label', { text: 'Destination data list', cls: 'iter-modal-label' });
    const select = selectField.createEl('select', { cls: 'iter-modal-select iter-link-note-select' });

    for (const opt of options) {
      select.createEl('option', { value: opt.id, text: opt.label });
    }
    for (const t of targets) {
      select.createEl('option', {
        value: `__new::${t.file.path}`,
        text: `+ Create new "Notes & Time" list on ${t.treeTitle}${t.kind !== 'tree' ? ` → ${t.goalTitle}` : ''}`,
      });
    }

    const dynamicSlot = form.createDiv({ cls: 'iter-modal-dynamic' });
    let getSubmission = null;

    const rebuildDynamic = () => {
      dynamicSlot.empty();
      const val = select.value || '';
      let target = null;
      let dataset = null;
      let newDsNameInput = null;
      let newDsKeysInput = null;

      if (val.startsWith('__new::')) {
        const path = val.slice('__new::'.length);
        target = targets.find(t => t.file.path === path) || null;
        const row = dynamicSlot.createDiv({ cls: 'iter-modal-row' });
        const nf = row.createDiv({ cls: 'iter-modal-field' });
        nf.createEl('label', { text: 'New data list name', cls: 'iter-micro-label' });
        newDsNameInput = nf.createEl('input', {
          type: 'text',
          value: 'Notes & Analyses',
          cls: 'iter-modal-input',
        });
        const kf = row.createDiv({ cls: 'iter-modal-field' });
        kf.createEl('label', { text: 'Frontmatter keys (optional)', cls: 'iter-micro-label' });
        newDsKeysInput = kf.createEl('input', {
          type: 'text',
          placeholder: 'e.g. pages, score',
          cls: 'iter-modal-input',
        });
      } else {
        const picked = options.find(o => o.id === val) || options[0];
        target = picked?.target || null;
        dataset = picked?.dataset || null;
      }

      const isTimed = !dataset || dataset.type === 'note_time';
      let dateInput = null;
      if (isTimed) {
        const df = dynamicSlot.createDiv({ cls: 'iter-modal-field' });
        df.createEl('label', { text: 'Date', cls: 'iter-modal-label' });
        dateInput = df.createEl('input', { type: 'date', cls: 'iter-modal-input' });
        const fm = this.app.metadataCache?.getFileCache?.(this.noteFile)?.frontmatter;
        dateInput.value = (typeof fm?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fm.date.trim()))
          ? fm.date.trim()
          : toDateKey();
      }

      const keys = dataset
        ? (Array.isArray(dataset.metricKeys) && dataset.metricKeys.length
          ? dataset.metricKeys
          : (dataset.metricKey ? [dataset.metricKey] : []))
        : [];
      const propInputs = new Map();
      if (keys.length > 0) {
        const fm = this.app.metadataCache?.getFileCache?.(this.noteFile)?.frontmatter || {};
        const grid = dynamicSlot.createDiv({ cls: keys.length > 1 ? 'iter-modal-row' : 'iter-modal-dynamic' });
        for (const k of keys) {
          const f = grid.createDiv({ cls: 'iter-modal-field' });
          f.createEl('label', { text: `${k} (frontmatter)`, cls: 'iter-modal-label' });
          const inp = f.createEl('input', {
            type: 'text',
            placeholder: fm[k] !== undefined ? `Current: ${fm[k]}` : `Value for ${k}`,
            cls: 'iter-modal-input',
          });
          if (fm[k] !== undefined && fm[k] !== null) {
            inp.value = String(fm[k]);
          }
          propInputs.set(k, inp);
        }
      }

      let waterNow = target?.kind === 'habit';
      if (target?.kind === 'habit') {
        const waterBtn = dynamicSlot.createEl('button', {
          type: 'button',
          cls: `iter-suggest-chip${waterNow ? ' is-active' : ''}`,
          text: `✓ Also water "${target.goalTitle}" for today`,
        });
        waterBtn.addEventListener('click', () => {
          waterNow = !waterNow;
          waterBtn.textContent = waterNow
            ? `✓ Also water "${target.goalTitle}" for today`
            : `Also water "${target.goalTitle}" for today`;
          waterBtn.toggleClass?.('is-active', waterNow);
        });
      }

      getSubmission = async () => {
        if (!target) throw new Error('Select a destination.');
        let activeDs = dataset;
        if (!activeDs) {
          const dsName = String(newDsNameInput?.value || 'Notes').trim() || 'Notes';
          const metricKeys = String(newDsKeysInput?.value || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          activeDs = await addDataset(this.app, target.file, {
            name: dsName,
            type: 'note_time',
            metricKeys: metricKeys.length ? metricKeys : ['score'],
          });
        }

        const props = {};
        for (const [k, inp] of propInputs.entries()) {
          const raw = String(inp.value || '').trim();
          if (!raw) continue;
          const num = Number(raw);
          props[k] = Number.isFinite(num) ? num : raw;
        }

        if (Object.keys(props).length > 0 && typeof this.app?.fileManager?.processFrontMatter === 'function') {
          await this.app.fileManager.processFrontMatter(this.noteFile, fm => {
            for (const [k, v] of Object.entries(props)) {
              fm[k] = v;
            }
            if (dateInput?.value && !fm.date) {
              fm.date = dateInput.value;
            }
          });
        }

        const primaryKey = activeDs.metricKey || activeDs.metricKeys?.[0] || '';
        const primaryVal = primaryKey && props[primaryKey] !== undefined ? Number(props[primaryKey]) : NaN;
        const payload = { path: this.noteFile.path };
        if (activeDs.type === 'note_time' && dateInput) {
          payload.date = dateInput.value || toDateKey();
        }
        if (Number.isFinite(primaryVal)) {
          payload.value = primaryVal;
        }
        if (Object.keys(props).length > 0) {
          payload.props = props;
        }

        await addDatasetEntry(this.app, target.file, activeDs.id, payload);
        if (waterNow && target.kind === 'habit') {
          await waterHabit(this.app, target.file);
        }
        return { target, dataset: activeDs };
      };
    };

    select.addEventListener('change', rebuildDynamic);
    rebuildDynamic();

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', {
      text: 'Link note',
      type: 'submit',
      cls: 'mod-cta',
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting || !getSubmission) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        const res = await getSubmission();
        new Notice(`Linked "${noteTitle}" to ${res.target.goalTitle} · ${res.dataset.name}`);
        if (this.onLinked) await this.onLinked(res);
        this.close();
      } catch (err) {
        new Notice(err instanceof Error ? err.message : String(err));
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

class QuickWaterHabitModal extends FuzzySuggestModal {
  constructor(app, onWatered = null) {
    super(app);
    this.onWatered = onWatered;
    this.setPlaceholder('Choose a habit to water…');
  }

  getItems() {
    const habits = discoverHabits(this.app, 'Iter');
    return [...habits].sort((a, b) => {
      const aPending = a.schedule.dueToday && !a.schedule.wateredToday ? 0 : 1;
      const bPending = b.schedule.dueToday && !b.schedule.wateredToday ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return a.label.localeCompare(b.label);
    });
  }

  getItemText(item) {
    const status = item.schedule.wateredToday
      ? '✓ Watered today'
      : item.schedule.dueToday
        ? '💧 Due today'
        : `Next: ${item.schedule.appearLabel}`;
    const streak = item.schedule.streak > 0 ? ` · ${item.schedule.streak}d streak` : '';
    return `${item.label} — ${item.treeTitle} (${status} · ${item.schedule.cadenceLabel}${streak})`;
  }

  onChooseItem(item) {
    void (async () => {
      const res = await waterHabit(this.app, item.file);
      const newStreak = res?.streak ?? 0;
      new Notice(`Watered "${item.label}"${newStreak > 0 ? ` (${newStreak} streak!)` : ''}`);
      if (this.onWatered) await this.onWatered(item);
    })();
  }
}

class QuickLogEntryModal extends Modal {
  constructor(app, { plugin, onLogged = null }) {
    super(app);
    this.plugin = plugin;
    this.onLogged = onLogged;
    this.submitting = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');
    contentEl.createEl('h2', { text: 'Quick-log to Iter data list', cls: 'iter-modal-title' });

    const targets = discoverAllGoalTargets(this.app);
    const items = [];
    for (const t of targets) {
      for (const ds of t.doc.datasets || []) {
        if (ds.type === 'rollup') continue;
        items.push({
          id: `${t.file.path}::${ds.id}`,
          target: t,
          dataset: ds,
          label: `${t.treeTitle}${t.kind !== 'tree' ? ` → ${t.goalTitle}` : ''} · ${ds.name} (${ds.type})`,
        });
      }
    }

    if (!items.length) {
      contentEl.createEl('p', {
        text: 'No data lists found yet. Open a Tree, Subgoal, or Habit to add a data list first.',
        cls: 'iter-section-hint',
      });
      return;
    }

    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });
    const selectField = form.createDiv({ cls: 'iter-modal-field' });
    selectField.createEl('label', { text: 'Data list', cls: 'iter-modal-label' });
    const select = selectField.createEl('select', { cls: 'iter-modal-select iter-quick-log-select' });
    for (const item of items) {
      select.createEl('option', { value: item.id, text: item.label });
    }

    const slot = form.createDiv({ cls: 'iter-modal-dynamic' });
    let handleSubmit = null;

    const rebuildSlot = () => {
      slot.empty();
      const picked = items.find(i => i.id === select.value) || items[0];
      if (!picked) return;
      const { target, dataset } = picked;

      if (dataset.type === 'number_time') {
        const row = slot.createDiv({ cls: 'iter-modal-row' });
        const vf = row.createDiv({ cls: 'iter-modal-field' });
        vf.createEl('label', { text: dataset.unit ? `Value (${dataset.unit})` : 'Value', cls: 'iter-modal-label' });
        const valInput = vf.createEl('input', { type: 'number', step: 'any', cls: 'iter-modal-input iter-quick-log-val' });
        valInput.required = true;
        const df = row.createDiv({ cls: 'iter-modal-field' });
        df.createEl('label', { text: 'Date', cls: 'iter-modal-label' });
        const dateInput = df.createEl('input', { type: 'date', cls: 'iter-modal-input' });
        dateInput.value = toDateKey();
        dateInput.required = true;

        handleSubmit = async () => {
          await addDatasetEntry(this.app, target.file, dataset.id, {
            value: Number(valInput.value),
            date: dateInput.value,
          });
          new Notice(`Logged ${valInput.value}${dataset.unit ? ` ${dataset.unit}` : ''} to ${dataset.name}`);
        };
      } else if (dataset.type === 'text') {
        const tf = slot.createDiv({ cls: 'iter-modal-field' });
        tf.createEl('label', { text: 'Entry text', cls: 'iter-modal-label' });
        const textInput = tf.createEl('input', { type: 'text', placeholder: 'Add item…', cls: 'iter-modal-input iter-quick-log-val' });
        textInput.required = true;

        handleSubmit = async () => {
          await addDatasetEntry(this.app, target.file, dataset.id, { value: textInput.value });
          new Notice(`Added "${textInput.value}" to ${dataset.name}`);
        };
      } else {
        // note or note_time: offer creating a new note right here!
        const hint = slot.createDiv({ cls: 'iter-section-hint' });
        hint.textContent = 'Create a new note in this list (or link your active note):';
        const tf = slot.createDiv({ cls: 'iter-modal-field' });
        tf.createEl('label', { text: 'New note title', cls: 'iter-modal-label' });
        const titleInput = tf.createEl('input', {
          type: 'text',
          placeholder: 'e.g. Chapter 3, Poem analysis…',
          cls: 'iter-modal-input iter-quick-log-val',
        });
        titleInput.required = true;

        const ff = slot.createDiv({ cls: 'iter-modal-field' });
        ff.createEl('label', { text: 'Folder', cls: 'iter-modal-label' });
        const folderInput = ff.createEl('input', {
          type: 'text',
          cls: 'iter-modal-input',
        });
        folderInput.value = inferDatasetDefaultFolder(this.app, dataset, target.file, target.doc);

        handleSubmit = async () => {
          const noteFile = await createDatasetNote(this.app, {
            goalFile: target.file,
            dataset,
            title: titleInput.value,
            folder: folderInput.value,
            date: toDateKey(),
            waterHabitNow: target.kind === 'habit',
          });
          if (this.plugin?.openFile) {
            await this.plugin.openFile(noteFile);
          }
        };
      }
    };

    select.addEventListener('change', rebuildSlot);
    rebuildSlot();

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', { text: 'Save', type: 'submit', cls: 'mod-cta' });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (this.submitting || !handleSubmit) return;
      this.submitting = true;
      submit.disabled = true;
      try {
        await handleSubmit();
        this.plugin?.scheduleRefresh?.();
        if (this.onLogged) await this.onLogged();
        this.close();
      } catch (err) {
        new Notice(err instanceof Error ? err.message : String(err));
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

function parseIterBlockConfig(source) {
  const cfg = {};
  const lines = String(source || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const kv = /^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) {
      cfg[kv[1].trim().toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return cfg;
}

function renderIterCodeBlock(plugin, source, container) {
  container.empty();
  const app = plugin.app;
  const cfg = parseIterBlockConfig(source);
  const goalQuery = cfg.goal || cfg.target || cfg.habit || cfg.tree || cfg.subgoal || '';
  const viewMode = (cfg.view || cfg.mode || (goalQuery ? 'goal' : 'today')).toLowerCase();

  const card = container.createDiv({ cls: 'iter-embed-card' });

  if (viewMode === 'today' || viewMode === 'habits-today' || viewMode === 'habits_today') {
    const scopePath = cfg.tree ? `Iter/${cfg.tree.replace(/^Iter\//, '')}` : 'Iter';
    const dueHabits = discoverHabits(app, scopePath).filter(h => h.schedule.dueToday);
    const wateredCount = dueHabits.filter(h => h.schedule.wateredToday || h.schedule.wateredInPeriod).length;

    const head = card.createDiv({ cls: 'iter-embed-head' });
    const titleWrap = head.createDiv({ cls: 'iter-embed-title-wrap' });
    const iconSpan = titleWrap.createSpan({ cls: 'iter-btn-icon' });
    setIcon(iconSpan, 'sprout');
    titleWrap.createSpan({
      text: cfg.title || 'Habits for Today',
      cls: 'iter-embed-title',
    });
    titleWrap.createSpan({
      text: `${wateredCount}/${dueHabits.length} watered`,
      cls: 'iter-module-pill',
    });

    const openGardenBtn = head.createEl('button', {
      text: 'Open Garden',
      type: 'button',
      cls: 'iter-ghost-action iter-embed-open-btn',
    });
    openGardenBtn.addEventListener('click', () => {
      void plugin.openGarden();
    });

    if (!dueHabits.length) {
      card.createEl('p', {
        text: 'No habits scheduled for today.',
        cls: 'iter-dataset-empty',
      });
      return;
    }

    const list = card.createDiv({ cls: 'iter-note-nav-list' });
    for (const h of dueHabits) {
      const row = list.createDiv({ cls: 'iter-note-nav-row is-habit-entry' });
      const mainBtn = row.createEl('button', {
        cls: 'iter-note-nav-item is-habit-entry',
        type: 'button',
      });
      const ic = mainBtn.createSpan({ cls: 'iter-btn-icon' });
      setIcon(ic, 'droplet');
      const textCol = mainBtn.createDiv({ cls: 'iter-habit-entry-text' });
      textCol.createSpan({ text: h.label, cls: 'iter-note-nav-title' });
      textCol.createSpan({
        text: `${h.treeTitle} · ${h.schedule.cadenceLabel}${h.schedule.streak > 0 ? ` · ${h.schedule.streak}d streak` : ''}`,
        cls: 'iter-habit-entry-sub',
      });
      mainBtn.addEventListener('click', () => {
        if (h.file) void plugin.openGoal(h.file);
      });

      const isDone = Boolean(h.schedule.wateredToday || h.schedule.wateredInPeriod);
      const waterBtn = row.createEl('button', {
        type: 'button',
        cls: `iter-habit-water-inline-btn${isDone ? ' is-watered' : ''}`,
      });
      const wIcon = waterBtn.createSpan({ cls: 'iter-btn-icon' });
      setIcon(wIcon, isDone ? 'check' : 'droplet');
      waterBtn.createSpan({ text: isDone ? 'Watered' : 'Water' });
      waterBtn.addEventListener('click', async event => {
        event.stopPropagation();
        if (!h.file) return;
        await waterHabit(app, h.file);
        plugin.scheduleRefresh?.();
        renderIterCodeBlock(plugin, source, container);
      });
    }
    return;
  }

  // Goal / Tree / Subgoal / Habit embed
  const targets = discoverAllGoalTargets(app);
  const qLower = goalQuery.toLowerCase();
  const matchedTarget = targets.find(
    t =>
      t.file.path.toLowerCase() === qLower ||
      t.file.path.toLowerCase() === `${qLower}.md` ||
      t.goalTitle.toLowerCase() === qLower ||
      `${t.treeTitle}/${t.goalTitle}`.toLowerCase() === qLower,
  );

  if (!matchedTarget) {
    card.createEl('p', {
      text: `Iter goal/habit not found: "${goalQuery}"`,
      cls: 'iter-dataset-empty',
    });
    return;
  }

  const { file, doc, treeTitle, goalTitle, kind } = matchedTarget;
  const head = card.createDiv({ cls: 'iter-embed-head' });
  const titleWrap = head.createDiv({ cls: 'iter-embed-title-wrap' });
  const iconSpan = titleWrap.createSpan({ cls: 'iter-btn-icon' });
  setIcon(iconSpan, kind === 'habit' ? 'droplet' : kind === 'subgoal' ? 'target' : 'trees');
  titleWrap.createSpan({
    text: cfg.title || (kind === 'tree' ? treeTitle : `${treeTitle} · ${goalTitle}`),
    cls: 'iter-embed-title',
  });
  titleWrap.createSpan({ text: kind, cls: 'iter-module-pill' });

  const actions = head.createDiv({ cls: 'iter-embed-actions' });
  if (kind === 'habit') {
    const sched = computeHabitScheduleMeta(doc.frequency, doc.days, doc.lastWatered, doc.waterLog);
    const isWatered = Boolean(sched.wateredToday || sched.wateredInPeriod);
    const wBtn = actions.createEl('button', {
      type: 'button',
      cls: `iter-habit-water-inline-btn${isWatered ? ' is-watered' : ''}`,
    });
    const wIc = wBtn.createSpan({ cls: 'iter-btn-icon' });
    setIcon(wIc, isWatered ? 'check' : 'droplet');
    wBtn.createSpan({ text: isWatered ? 'Watered' : 'Water' });
    wBtn.addEventListener('click', async () => {
      await waterHabit(app, file);
      plugin.scheduleRefresh?.();
      renderIterCodeBlock(plugin, source, container);
    });
  } else if (kind === 'subgoal') {
    const doneBtn = actions.createEl('button', {
      type: 'button',
      cls: 'iter-ghost-action',
      text: doc.done ? '✓ Completed' : 'Mark done',
    });
    doneBtn.addEventListener('click', async () => {
      await toggleSubgoal(app, file);
      plugin.scheduleRefresh?.();
      renderIterCodeBlock(plugin, source, container);
    });
  }

  const openBtn = actions.createEl('button', {
    text: 'Open in Iter',
    type: 'button',
    cls: 'iter-ghost-action iter-embed-open-btn',
  });
  openBtn.addEventListener('click', () => {
    void plugin.openGoal(file);
  });

  // Optional specific dataset filter
  const dsFilter = (cfg.dataset || '').toLowerCase();
  const datasetsToShow = dsFilter
    ? (doc.datasets || []).filter(d => d.name.toLowerCase() === dsFilter || d.id.toLowerCase() === dsFilter)
    : (doc.datasets || []);

  if (doc.widgets?.length && !dsFilter) {
    const byId = new Map((doc.datasets || []).map(d => [d.id, d]));
    const statsRow = card.createDiv({ cls: 'iter-embed-stats-row' });
    for (const w of doc.widgets.slice(0, 4)) {
      if (w.type === 'streak' && kind === 'habit') {
        const streak = computeHabitStreak(doc.waterLog, doc.frequency, new Date(), doc.days);
        const pill = statsRow.createDiv({ cls: 'iter-embed-stat-pill' });
        pill.createSpan({ text: w.title || 'Streak', cls: 'iter-embed-stat-label' });
        pill.createSpan({ text: `${streak}`, cls: 'iter-embed-stat-val' });
        continue;
      }
      const wDs = resolveWidgetDataset(app, w, byId, doc);
      if (!wDs) continue;
      if (w.type === 'stat') {
        const st = computeStat(app, wDs, w.agg, file.path, w.metricKey || '');
        const pill = statsRow.createDiv({ cls: 'iter-embed-stat-pill' });
        pill.createSpan({ text: w.title || wDs.name, cls: 'iter-embed-stat-label' });
        pill.createSpan({
          text: `${st.display}${w.unit || wDs.unit ? ` ${w.unit || wDs.unit}` : ''}`,
          cls: 'iter-embed-stat-val',
        });
      } else if (w.type === 'goal_bar') {
        const bar = computeGoalBar(app, wDs, w.mode, w.target, file.path, w.metricKey || '');
        const pill = statsRow.createDiv({ cls: 'iter-embed-stat-pill' });
        pill.createSpan({ text: w.title || wDs.name, cls: 'iter-embed-stat-label' });
        pill.createSpan({ text: `${bar.rawPercent}%`, cls: 'iter-embed-stat-val' });
      }
    }
  }

  for (const ds of datasetsToShow.slice(0, 3)) {
    if (ds.type === 'rollup') continue;
    const entries = resolveDatasetEntries(app, ds, file.path);
    const dsBox = card.createDiv({ cls: 'iter-embed-ds-box' });
    const dsBar = dsBox.createDiv({ cls: 'iter-embed-ds-bar' });
    dsBar.createSpan({ text: `${ds.name} (${entries.length})`, cls: 'iter-embed-ds-title' });

    if (ds.type === 'note' || ds.type === 'note_time') {
      const newNoteBtn = dsBar.createEl('button', {
        text: '+ New Note',
        type: 'button',
        cls: 'iter-ghost-action iter-embed-new-note-btn',
      });
      newNoteBtn.addEventListener('click', () => {
        new CreateDatasetNoteModal(app, {
          goalFile: file,
          doc,
          dataset: ds,
          onCreated: async createdFile => {
            plugin.scheduleRefresh?.();
            renderIterCodeBlock(plugin, source, container);
            await plugin.openFile(createdFile);
          },
        }).open();
      });
    }

    const previewEntries = entries.slice(-5).reverse();
    if (previewEntries.length > 0) {
      const list = dsBox.createDiv({ cls: 'iter-entry-list' });
      for (const item of previewEntries) {
        const row = list.createDiv({ cls: 'iter-entry-row' });
        if (ds.type === 'note' || ds.type === 'note_time') {
          const btn = row.createEl('button', { cls: 'iter-entry-note-btn', type: 'button' });
          const ic = btn.createSpan({ cls: 'iter-btn-icon' });
          setIcon(ic, 'file-text');
          btn.createSpan({ text: item.label, cls: 'iter-entry-main' });
          btn.addEventListener('click', () => {
            if (item.noteFile) void plugin.openFile(item.noteFile);
          });
        } else {
          row.createSpan({ text: item.label, cls: 'iter-entry-main' });
        }
        if (item.value !== null && item.value !== undefined && (ds.type === 'note' || ds.type === 'note_time')) {
          row.createSpan({ text: formatNumber(item.value), cls: 'iter-note-score-pill' });
        }
        if (item.date) {
          row.createSpan({ text: item.date, cls: 'iter-entry-date' });
        }
      }
    }
  }
}

class InsertEmbedModal extends Modal {
  constructor(app, { onInsert }) {
    super(app);
    this.onInsert = onInsert;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-modal');
    contentEl.createEl('h2', { text: 'Insert Iter embed into note', cls: 'iter-modal-title' });

    const targets = discoverAllGoalTargets(this.app);
    const form = contentEl.createEl('form', { cls: 'iter-modal-form' });
    const field = form.createDiv({ cls: 'iter-modal-field' });
    field.createEl('label', { text: 'What to embed', cls: 'iter-modal-label' });
    const select = field.createEl('select', { cls: 'iter-modal-select iter-insert-embed-select' });

    select.createEl('option', {
      value: 'view: today',
      text: 'Habits for Today (interactive Daily Note tracker)',
    });

    for (const t of targets) {
      select.createEl('option', {
        value: `goal: ${t.goalTitle}`,
        text: `${t.label} — Overview & widgets`,
      });
      for (const ds of t.doc.datasets || []) {
        if (ds.type === 'rollup') continue;
        select.createEl('option', {
          value: `goal: ${t.goalTitle}\ndataset: ${ds.name}`,
          text: `${t.label} → Data list: ${ds.name}`,
        });
      }
    }

    const actions = form.createDiv({ cls: 'iter-modal-actions' });
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button', cls: 'iter-btn-ghost' });
    cancel.addEventListener('click', () => this.close());
    const submit = actions.createEl('button', { text: 'Insert codeblock', type: 'submit', cls: 'mod-cta' });

    form.addEventListener('submit', event => {
      event.preventDefault();
      const block = `\`\`\`iter\n${select.value}\n\`\`\`\n`;
      if (this.onInsert) this.onInsert(block);
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  inferDatasetDefaultFolder,
  createDatasetNote,
  CreateDatasetNoteModal,
  discoverAllGoalTargets,
  findNoteIterConnections,
  LinkNoteToDatasetModal,
  QuickWaterHabitModal,
  QuickLogEntryModal,
  parseIterBlockConfig,
  renderIterCodeBlock,
  InsertEmbedModal,
};
