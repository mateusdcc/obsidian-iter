var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/storage.js
var require_storage = __commonJS({
  "src/storage.js"(exports2, module2) {
    var ROOT = "Iter";
    var INDEX_FOLDER = `${ROOT}/_index`;
    var WE_PATH = `${INDEX_FOLDER}/We.md`;
    var MODULES = [
      { id: "general", label: "General" },
      { id: "gym", label: "Gym & Body" },
      { id: "learning", label: "Learning" },
      { id: "creative", label: "Creative" },
      { id: "health", label: "Health" }
    ];
    var FREQUENCIES = ["daily", "weekly", "monthly"];
    var STYLES = ["auto", "canopy", "bonsai", "pine", "willow"];
    function isFolder(entry) {
      return !!entry && Array.isArray(entry.children);
    }
    function validateName(value, label = "Name") {
      const name = typeof value === "string" ? value.trim() : "";
      if (!name || name === "." || name === ".." || name.startsWith("_") || name.startsWith(".") || /[\\/:*?"<>|\x00-\x1f\x7f#^[\]]/.test(name) || /[.]$/.test(name) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) {
        throw new Error(`${label} is invalid. Avoid leading "." or "_", path separators, and reserved characters.`);
      }
      return name;
    }
    async function ensureFolder(vault, path) {
      const existing = vault.getAbstractFileByPath(path);
      if (existing) {
        if (!isFolder(existing)) throw new Error(`A file exists where a folder is required: ${path}`);
        return existing;
      }
      try {
        await vault.createFolder(path);
      } catch (error) {
        if (!isFolder(vault.getAbstractFileByPath(path))) throw error;
      }
      return vault.getAbstractFileByPath(path);
    }
    async function ensureStructure2(vault) {
      await ensureFolder(vault, ROOT);
      await ensureFolder(vault, INDEX_FOLDER);
      if (!vault.getAbstractFileByPath(WE_PATH)) {
        const content = [
          "---",
          "type: iter-index",
          'title: "We"',
          "members: []",
          `created: ${(/* @__PURE__ */ new Date()).toISOString()}`,
          "---",
          "",
          "# We",
          "",
          "A shared garden of long-term goals. Each folder inside `Iter/` represents a tree watered through habits and subgoals.",
          ""
        ].join("\n");
        try {
          await vault.create(WE_PATH, content);
        } catch (error) {
          if (!vault.getAbstractFileByPath(WE_PATH)) throw error;
        }
      }
      return vault.getAbstractFileByPath(ROOT);
    }
    function validTreePath(treePath) {
      if (typeof treePath !== "string" || !treePath.startsWith(`${ROOT}/`)) {
        throw new Error("Invalid tree path.");
      }
      const rest = treePath.slice(ROOT.length + 1);
      if (!rest || rest.includes("/")) throw new Error("Invalid tree path.");
      validateName(rest, "Tree name");
      return treePath;
    }
    function normalizeModule(value) {
      const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
      return MODULES.some((item) => item.id === normalized) ? normalized : "general";
    }
    function normalizeFrequency(value) {
      const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
      return FREQUENCIES.includes(normalized) ? normalized : "daily";
    }
    function normalizeStyle(value) {
      const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
      return STYLES.includes(normalized) ? normalized : "auto";
    }
    async function createTree2(vault, { name, module: module3 = "general", goal = "", style = "auto" }) {
      const title = validateName(name, "Tree name");
      const mod = normalizeModule(module3);
      const treeStyle = normalizeStyle(style);
      const cleanGoal = typeof goal === "string" ? goal.trim() : "";
      await ensureStructure2(vault);
      const treeDir = `${ROOT}/${title}`;
      if (vault.getAbstractFileByPath(treeDir)) {
        throw new Error(`A tree named "${title}" already exists.`);
      }
      await ensureFolder(vault, treeDir);
      const indexPath = `${treeDir}/_tree.md`;
      const lines = [
        "---",
        "type: tree",
        `title: ${JSON.stringify(title)}`,
        `module: ${JSON.stringify(mod)}`,
        `goal: ${JSON.stringify(cleanGoal)}`,
        `style: ${JSON.stringify(treeStyle)}`,
        `created: ${(/* @__PURE__ */ new Date()).toISOString()}`,
        "---",
        "",
        `# ${title}`,
        ""
      ];
      if (cleanGoal) {
        lines.push("## Goal", cleanGoal, "");
      }
      lines.push("## Notes", "");
      return vault.create(indexPath, lines.join("\n"));
    }
    async function createSubgoal2(vault, { treePath, name, target = "" }) {
      const dir = validTreePath(treePath);
      const title = validateName(name, "Subgoal name");
      const cleanTarget = typeof target === "string" ? target.trim() : "";
      await ensureStructure2(vault);
      const folder = vault.getAbstractFileByPath(dir);
      if (!isFolder(folder)) throw new Error("Selected tree does not exist.");
      const subgoalsDir = `${dir}/subgoals`;
      await ensureFolder(vault, subgoalsDir);
      const filePath = `${subgoalsDir}/${title}.md`;
      if (vault.getAbstractFileByPath(filePath)) {
        throw new Error(`A subgoal named "${title}" already exists in this tree.`);
      }
      const lines = [
        "---",
        "type: subgoal",
        `title: ${JSON.stringify(title)}`,
        "done: false",
        `target: ${JSON.stringify(cleanTarget)}`,
        `created: ${(/* @__PURE__ */ new Date()).toISOString()}`,
        "---",
        "",
        `# ${title}`,
        ""
      ];
      if (cleanTarget) lines.push(`Target: ${cleanTarget}`, "");
      return vault.create(filePath, lines.join("\n"));
    }
    async function createHabit2(vault, { treePath, name, frequency = "daily", target = "" }) {
      const dir = validTreePath(treePath);
      const title = validateName(name, "Habit name");
      const freq = normalizeFrequency(frequency);
      const cleanTarget = typeof target === "string" ? target.trim() : "";
      await ensureStructure2(vault);
      const folder = vault.getAbstractFileByPath(dir);
      if (!isFolder(folder)) throw new Error("Selected tree does not exist.");
      const habitsDir = `${dir}/habits`;
      await ensureFolder(vault, habitsDir);
      const filePath = `${habitsDir}/${title}.md`;
      if (vault.getAbstractFileByPath(filePath)) {
        throw new Error(`A habit named "${title}" already exists in this tree.`);
      }
      const lines = [
        "---",
        "type: habit",
        `title: ${JSON.stringify(title)}`,
        `frequency: ${JSON.stringify(freq)}`,
        `target: ${JSON.stringify(cleanTarget)}`,
        "last_watered: null",
        "water_log: []",
        `created: ${(/* @__PURE__ */ new Date()).toISOString()}`,
        "---",
        "",
        `# ${title}`,
        "",
        `Cadence: ${freq}`,
        ""
      ];
      if (cleanTarget) lines.push(`Target: ${cleanTarget}`, "");
      return vault.create(filePath, lines.join("\n"));
    }
    function toDateKey(date = /* @__PURE__ */ new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    function parseDateKey(key) {
      if (typeof key !== "string") return null;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
      if (!match) return null;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
      return date;
    }
    function formatUtcDateKey(date) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    function shiftDateKey(key, deltaDays) {
      const parsed = parseDateKey(key);
      if (!parsed) return null;
      parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
      return formatUtcDateKey(parsed);
    }
    function weekStartKey(key) {
      const parsed = parseDateKey(key);
      if (!parsed) return null;
      const mondayOffset = (parsed.getUTCDay() + 6) % 7;
      parsed.setUTCDate(parsed.getUTCDate() - mondayOffset);
      return formatUtcDateKey(parsed);
    }
    function monthKey(key) {
      return parseDateKey(key) ? key.slice(0, 7) : null;
    }
    function shiftMonthKey(ym, deltaMonths) {
      const match = /^(\d{4})-(\d{2})$/.exec(ym ?? "");
      if (!match) return null;
      const totalMonths = Number(match[1]) * 12 + (Number(match[2]) - 1) + deltaMonths;
      const year = Math.floor(totalMonths / 12);
      const month = (totalMonths % 12 + 12) % 12 + 1;
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
    }
    function periodKeyFor(dateKey, frequency) {
      const freq = normalizeFrequency(frequency);
      if (freq === "weekly") return weekStartKey(dateKey);
      if (freq === "monthly") return monthKey(dateKey);
      return parseDateKey(dateKey) ? dateKey : null;
    }
    function previousPeriodKey(periodKey, frequency) {
      const freq = normalizeFrequency(frequency);
      if (freq === "weekly") return shiftDateKey(periodKey, -7);
      if (freq === "monthly") return shiftMonthKey(periodKey, -1);
      return shiftDateKey(periodKey, -1);
    }
    function normalizeWaterLog(raw) {
      if (!Array.isArray(raw)) return [];
      const valid = /* @__PURE__ */ new Set();
      for (const item of raw) {
        const str = typeof item === "string" ? item.trim() : "";
        if (parseDateKey(str)) valid.add(str);
      }
      return Array.from(valid).sort();
    }
    function isWateredInPeriod(lastWatered, waterLog, frequency, now = /* @__PURE__ */ new Date()) {
      const currentPeriod = periodKeyFor(toDateKey(now), frequency);
      if (!currentPeriod) return false;
      const dates = normalizeWaterLog(waterLog);
      if (typeof lastWatered === "string" && parseDateKey(lastWatered)) {
        dates.push(lastWatered.trim());
      }
      return dates.some((key) => periodKeyFor(key, frequency) === currentPeriod);
    }
    function computeHabitStreak(waterLog, frequency, now = /* @__PURE__ */ new Date()) {
      const dates = normalizeWaterLog(waterLog);
      if (!dates.length) return 0;
      const periods = new Set(dates.map((key) => periodKeyFor(key, frequency)).filter(Boolean));
      const current = periodKeyFor(toDateKey(now), frequency);
      const previous = previousPeriodKey(current, frequency);
      let cursor = periods.has(current) ? current : periods.has(previous) ? previous : null;
      let streak = 0;
      while (cursor && periods.has(cursor)) {
        streak += 1;
        cursor = previousPeriodKey(cursor, frequency);
      }
      return streak;
    }
    async function toggleSubgoal(app, file, nextDone) {
      let result = false;
      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        const next = typeof nextDone === "boolean" ? nextDone : !Boolean(frontmatter.done);
        frontmatter.done = next;
        result = next;
      });
      return result;
    }
    async function waterHabit(app, file, now = /* @__PURE__ */ new Date()) {
      const today = toDateKey(now);
      let wateredToday = false;
      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        const log = normalizeWaterLog(frontmatter.water_log);
        if (typeof frontmatter.last_watered === "string" && parseDateKey(frontmatter.last_watered) && !log.includes(frontmatter.last_watered)) {
          log.push(frontmatter.last_watered);
          log.sort();
        }
        const index = log.indexOf(today);
        if (index >= 0) {
          log.splice(index, 1);
          wateredToday = false;
        } else {
          log.push(today);
          log.sort();
          wateredToday = true;
        }
        frontmatter.water_log = log;
        frontmatter.last_watered = log.length ? log[log.length - 1] : null;
      });
      return wateredToday;
    }
    module2.exports = {
      ROOT,
      INDEX_FOLDER,
      WE_PATH,
      MODULES,
      FREQUENCIES,
      STYLES,
      isFolder,
      validateName,
      ensureFolder,
      ensureStructure: ensureStructure2,
      validTreePath,
      normalizeModule,
      normalizeFrequency,
      normalizeStyle,
      createTree: createTree2,
      createSubgoal: createSubgoal2,
      createHabit: createHabit2,
      toDateKey,
      parseDateKey,
      periodKeyFor,
      normalizeWaterLog,
      isWateredInPeriod,
      computeHabitStreak,
      toggleSubgoal,
      waterHabit
    };
  }
});

// src/catalog.js
var require_catalog = __commonJS({
  "src/catalog.js"(exports2, module2) {
    var {
      ROOT,
      WE_PATH,
      isFolder,
      normalizeModule,
      normalizeFrequency,
      normalizeStyle,
      normalizeWaterLog,
      isWateredInPeriod,
      computeHabitStreak,
      toDateKey
    } = require_storage();
    function compareNames(a, b) {
      return a.localeCompare(b, void 0, { sensitivity: "base", numeric: true });
    }
    function getFrontmatter(app, file) {
      if (!file) return null;
      return app.metadataCache.getFileCache(file)?.frontmatter ?? null;
    }
    function readString(fm, key, fallback = "") {
      const val = fm?.[key];
      return typeof val === "string" && val.trim() ? val.trim() : fallback;
    }
    function isHiddenName(name) {
      return !name || name.startsWith("_") || name.startsWith(".");
    }
    function stripExt(file) {
      return file.name.endsWith(".md") ? file.name.slice(0, -3) : file.name;
    }
    function parseTargets(raw) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      return Object.entries(raw).filter(([user, target]) => typeof user === "string" && user.trim() && target !== void 0 && target !== null && String(target).trim()).map(([user, target]) => ({ user: user.trim(), target: String(target).trim() }));
    }
    function readSubgoals(app, treeFolder) {
      const dir = treeFolder.children.find((child) => isFolder(child) && child.name === "subgoals");
      if (!dir) return [];
      return dir.children.filter((child) => !isFolder(child) && child.extension === "md" && !isHiddenName(child.name)).map((file) => {
        const fm = getFrontmatter(app, file);
        return {
          file,
          title: readString(fm, "title", stripExt(file)),
          done: Boolean(fm?.done),
          target: readString(fm, "target", "")
        };
      }).sort((a, b) => Number(a.done) - Number(b.done) || compareNames(a.title, b.title));
    }
    function readHabits(app, treeFolder, now = /* @__PURE__ */ new Date()) {
      const dir = treeFolder.children.find((child) => isFolder(child) && child.name === "habits");
      if (!dir) return [];
      const today = toDateKey(now);
      return dir.children.filter((child) => !isFolder(child) && child.extension === "md" && !isHiddenName(child.name)).map((file) => {
        const fm = getFrontmatter(app, file);
        const frequency = normalizeFrequency(fm?.frequency);
        const waterLog = normalizeWaterLog(fm?.water_log);
        const lastWatered = typeof fm?.last_watered === "string" && fm.last_watered.trim() ? fm.last_watered.trim() : waterLog.length ? waterLog[waterLog.length - 1] : null;
        const wateredInPeriod = isWateredInPeriod(lastWatered, waterLog, frequency, now);
        const wateredToday = waterLog.includes(today) || lastWatered === today;
        const streak = computeHabitStreak(
          lastWatered && !waterLog.includes(lastWatered) ? [...waterLog, lastWatered] : waterLog,
          frequency,
          now
        );
        return {
          file,
          title: readString(fm, "title", stripExt(file)),
          frequency,
          target: readString(fm, "target", ""),
          lastWatered,
          waterLog,
          wateredInPeriod,
          wateredToday,
          streak
        };
      }).sort((a, b) => compareNames(a.title, b.title));
    }
    function readExtraEntries(directory, reservedNames = /* @__PURE__ */ new Set()) {
      if (!isFolder(directory)) return [];
      const folders = [];
      const files = [];
      for (const child of directory.children) {
        if (isHiddenName(child.name) || reservedNames.has(child.name)) continue;
        if (isFolder(child)) {
          folders.push({
            kind: "folder",
            name: child.name,
            path: child.path,
            entry: child,
            children: readExtraEntries(child)
          });
        } else {
          files.push({
            kind: "file",
            name: stripExt(child),
            path: child.path,
            file: child
          });
        }
      }
      folders.sort((a, b) => compareNames(a.name, b.name));
      files.sort((a, b) => compareNames(a.name, b.name));
      return [...folders, ...files];
    }
    function computeTreeStats(subgoals, habits) {
      const subgoalTotal = subgoals.length;
      const subgoalDone = subgoals.filter((item) => item.done).length;
      const habitTotal = habits.length;
      const habitWatered = habits.filter((item) => item.wateredInPeriod).length;
      const totalWaterings = habits.reduce((sum, item) => sum + item.waterLog.length, 0);
      let progress = 0;
      if (subgoalTotal > 0 && habitTotal > 0) {
        const subgoalRatio = subgoalDone / subgoalTotal;
        const periodRatio = habitWatered / habitTotal;
        const consistency = 1 - Math.exp(-totalWaterings / 8);
        progress = 0.5 * subgoalRatio + 0.25 * periodRatio + 0.25 * consistency;
      } else if (subgoalTotal > 0) {
        progress = subgoalDone / subgoalTotal;
      } else if (habitTotal > 0) {
        const periodRatio = habitWatered / habitTotal;
        const consistency = 1 - Math.exp(-totalWaterings / 8);
        progress = 0.45 * periodRatio + 0.55 * consistency;
      }
      const growth = Math.max(0.18, Math.min(1, 0.18 + 0.82 * progress));
      let stageLabel = "Seedling";
      if (growth >= 0.9) stageLabel = "Flourishing";
      else if (growth >= 0.7) stageLabel = "Canopy";
      else if (growth >= 0.48) stageLabel = "Young Tree";
      else if (growth >= 0.28) stageLabel = "Sapling";
      let hydrationState = "calm";
      if (habitTotal > 0) {
        if (habitWatered === habitTotal) hydrationState = "hydrated";
        else if (habitWatered > 0) hydrationState = "partial";
        else hydrationState = "thirsty";
      }
      return {
        subgoalDone,
        subgoalTotal,
        habitWatered,
        habitTotal,
        totalWaterings,
        growth,
        stageLabel,
        hydrationState
      };
    }
    function isTreeFolder(folder) {
      if (!isFolder(folder)) return false;
      return folder.children.some(
        (child) => !isFolder(child) && child.name === "_tree.md" || isFolder(child) && (child.name === "subgoals" || child.name === "habits")
      );
    }
    function listGarden2(app, now = /* @__PURE__ */ new Date()) {
      const indexFile = app.vault.getAbstractFileByPath(WE_PATH);
      const indexFm = !isFolder(indexFile) ? getFrontmatter(app, indexFile) : null;
      const members = Array.isArray(indexFm?.members) ? indexFm.members.filter((m) => typeof m === "string" && m.trim()).map((m) => m.trim()) : [];
      const root = app.vault.getAbstractFileByPath(ROOT);
      if (!isFolder(root)) {
        return { indexFile: isFolder(indexFile) ? null : indexFile, members, trees: [], looseItems: [] };
      }
      const trees = [];
      const looseFolders = [];
      const looseFiles = [];
      for (const entry of root.children) {
        if (isHiddenName(entry.name)) continue;
        if (isFolder(entry) && isTreeFolder(entry)) {
          const treeFile = entry.children.find((child) => !isFolder(child) && child.name === "_tree.md") ?? null;
          const fm = getFrontmatter(app, treeFile);
          const subgoals = readSubgoals(app, entry);
          const habits = readHabits(app, entry, now);
          const extras = readExtraEntries(entry, /* @__PURE__ */ new Set(["subgoals", "habits"]));
          trees.push({
            path: entry.path,
            folder: entry,
            indexFile: treeFile,
            title: readString(fm, "title", entry.name),
            module: normalizeModule(fm?.module),
            goal: readString(fm, "goal", ""),
            style: normalizeStyle(fm?.style),
            targets: parseTargets(fm?.targets),
            subgoals,
            habits,
            extras,
            stats: computeTreeStats(subgoals, habits)
          });
        } else if (isFolder(entry)) {
          looseFolders.push({
            kind: "folder",
            name: entry.name,
            path: entry.path,
            entry,
            children: readExtraEntries(entry)
          });
        } else {
          looseFiles.push({
            kind: "file",
            name: stripExt(entry),
            path: entry.path,
            file: entry
          });
        }
      }
      trees.sort((a, b) => compareNames(a.title, b.title));
      looseFolders.sort((a, b) => compareNames(a.name, b.name));
      looseFiles.sort((a, b) => compareNames(a.name, b.name));
      return {
        indexFile: isFolder(indexFile) ? null : indexFile,
        members,
        trees,
        looseItems: [...looseFolders, ...looseFiles]
      };
    }
    function findTreeContext2(app, file) {
      const path = file?.path;
      if (typeof path !== "string" || !path.startsWith(`${ROOT}/`)) return null;
      const rest = path.slice(ROOT.length + 1);
      const treeName = rest.split("/")[0];
      if (!treeName || isHiddenName(treeName)) return null;
      const treePath = `${ROOT}/${treeName}`;
      const folder = app.vault.getAbstractFileByPath(treePath);
      return isTreeFolder(folder) ? treePath : null;
    }
    module2.exports = {
      compareNames,
      computeTreeStats,
      isTreeFolder,
      listGarden: listGarden2,
      findTreeContext: findTreeContext2
    };
  }
});

// src/modals.js
var require_modals = __commonJS({
  "src/modals.js"(exports2, module2) {
    var { Modal, Notice: Notice2 } = require("obsidian");
    var { MODULES, FREQUENCIES, STYLES } = require_storage();
    var STYLE_LABELS = {
      auto: "Auto (from module)",
      canopy: "Canopy",
      bonsai: "Bonsai",
      pine: "Pine",
      willow: "Willow"
    };
    var FREQUENCY_LABELS = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly"
    };
    var BaseIterModal = class extends Modal {
      constructor(app, title, submitLabel, onSubmit) {
        super(app);
        this.modalTitle = title;
        this.submitLabel = submitLabel;
        this.onSubmit = onSubmit;
        this.submitting = false;
      }
      buildForm(contentEl) {
        contentEl.empty();
        contentEl.addClass("iter-modal");
        contentEl.createEl("h2", { text: this.modalTitle, cls: "iter-modal-title" });
        return contentEl.createEl("form", { cls: "iter-modal-form" });
      }
      addField(form, labelText, buildInput) {
        const field = form.createDiv({ cls: "iter-modal-field" });
        const label = field.createEl("label", { text: labelText, cls: "iter-modal-label" });
        const input = buildInput(field);
        const id = `iter-field-${Math.random().toString(36).slice(2, 9)}`;
        input.id = id;
        label.setAttribute("for", id);
        return input;
      }
      addActions(form, collectValues, focusOnError) {
        const actions = form.createDiv({ cls: "iter-modal-actions" });
        const cancel = actions.createEl("button", { text: "Cancel", type: "button", cls: "iter-btn-ghost" });
        cancel.addEventListener("click", () => this.close());
        const submit = actions.createEl("button", { text: this.submitLabel, type: "submit", cls: "mod-cta" });
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (this.submitting) return;
          this.submitting = true;
          submit.disabled = true;
          try {
            await this.onSubmit(collectValues());
            this.close();
          } catch (error) {
            new Notice2(error instanceof Error ? error.message : String(error));
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
    };
    var CreateTreeModal2 = class extends BaseIterModal {
      constructor(app, { onSubmit }) {
        super(app, "Create tree", "Plant tree", onSubmit);
      }
      onOpen() {
        const form = this.buildForm(this.contentEl);
        const nameInput = this.addField(form, "Tree name", (parent) => {
          const input = parent.createEl("input", { type: "text", placeholder: "Gym, Learn Japanese\u2026", cls: "iter-modal-input" });
          input.required = true;
          return input;
        });
        const row = form.createDiv({ cls: "iter-modal-row" });
        const moduleSelect = this.addField(row, "Module", (parent) => {
          const select = parent.createEl("select", { cls: "iter-modal-select" });
          for (const mod of MODULES) {
            select.createEl("option", { value: mod.id, text: mod.label });
          }
          return select;
        });
        const styleSelect = this.addField(row, "Tree form", (parent) => {
          const select = parent.createEl("select", { cls: "iter-modal-select" });
          for (const style of STYLES) {
            select.createEl("option", { value: style, text: STYLE_LABELS[style] || style });
          }
          return select;
        });
        const goalInput = this.addField(
          form,
          "Long-term goal (optional)",
          (parent) => parent.createEl("input", { type: "text", placeholder: "e.g. Reach 70kg at 12% body fat", cls: "iter-modal-input" })
        );
        this.addActions(
          form,
          () => ({
            name: nameInput.value,
            module: moduleSelect.value,
            style: styleSelect.value,
            goal: goalInput.value
          }),
          nameInput
        );
        nameInput.focus();
      }
    };
    var CreateSubgoalModal2 = class extends BaseIterModal {
      constructor(app, { trees, initialTreePath, onSubmit }) {
        super(app, "Create subgoal", "Create subgoal", onSubmit);
        this.trees = trees;
        this.initialTreePath = initialTreePath;
      }
      onOpen() {
        const form = this.buildForm(this.contentEl);
        const treeSelect = this.addField(form, "Tree", (parent) => {
          const select = parent.createEl("select", { cls: "iter-modal-select" });
          for (const tree of this.trees) {
            const option = select.createEl("option", { value: tree.path, text: tree.title });
            if (tree.path === this.initialTreePath) option.selected = true;
          }
          return select;
        });
        const nameInput = this.addField(form, "Subgoal", (parent) => {
          const input = parent.createEl("input", { type: "text", placeholder: "e.g. Bench 80kg", cls: "iter-modal-input" });
          input.required = true;
          return input;
        });
        const targetInput = this.addField(
          form,
          "Milestone target (optional)",
          (parent) => parent.createEl("input", { type: "text", placeholder: "e.g. 80kg x 5 reps", cls: "iter-modal-input" })
        );
        this.addActions(
          form,
          () => ({
            treePath: treeSelect.value,
            name: nameInput.value,
            target: targetInput.value
          }),
          nameInput
        );
        nameInput.focus();
      }
    };
    var CreateHabitModal2 = class extends BaseIterModal {
      constructor(app, { trees, initialTreePath, onSubmit }) {
        super(app, "Create habit", "Create habit", onSubmit);
        this.trees = trees;
        this.initialTreePath = initialTreePath;
      }
      onOpen() {
        const form = this.buildForm(this.contentEl);
        const row = form.createDiv({ cls: "iter-modal-row" });
        const treeSelect = this.addField(row, "Tree", (parent) => {
          const select = parent.createEl("select", { cls: "iter-modal-select" });
          for (const tree of this.trees) {
            const option = select.createEl("option", { value: tree.path, text: tree.title });
            if (tree.path === this.initialTreePath) option.selected = true;
          }
          return select;
        });
        const freqSelect = this.addField(row, "Watering cadence", (parent) => {
          const select = parent.createEl("select", { cls: "iter-modal-select" });
          for (const freq of FREQUENCIES) {
            select.createEl("option", { value: freq, text: FREQUENCY_LABELS[freq] || freq });
          }
          return select;
        });
        const nameInput = this.addField(form, "Habit", (parent) => {
          const input = parent.createEl("input", { type: "text", placeholder: "e.g. Go to the Gym", cls: "iter-modal-input" });
          input.required = true;
          return input;
        });
        const targetInput = this.addField(
          form,
          "Daily/period target (optional)",
          (parent) => parent.createEl("input", { type: "text", placeholder: "e.g. 3000 kcal / 10 new words", cls: "iter-modal-input" })
        );
        this.addActions(
          form,
          () => ({
            treePath: treeSelect.value,
            frequency: freqSelect.value,
            name: nameInput.value,
            target: targetInput.value
          }),
          nameInput
        );
        nameInput.focus();
      }
    };
    module2.exports = {
      CreateTreeModal: CreateTreeModal2,
      CreateSubgoalModal: CreateSubgoalModal2,
      CreateHabitModal: CreateHabitModal2
    };
  }
});

// src/panel-view.js
var require_panel_view = __commonJS({
  "src/panel-view.js"(exports2, module2) {
    var { ItemView, Menu, Notice: Notice2, setIcon } = require("obsidian");
    var { ROOT, toggleSubgoal, waterHabit } = require_storage();
    var { listGarden: listGarden2 } = require_catalog();
    var PANEL_VIEW2 = "iter-panel";
    var MODULE_ICONS = {
      gym: "dumbbell",
      learning: "book-open",
      creative: "sparkles",
      health: "heart",
      general: "trees"
    };
    var CADENCE_SHORT = {
      daily: "D",
      weekly: "W",
      monthly: "M"
    };
    function iconButton(parent, icon, label, callback, extraClass = "") {
      const button = parent.createEl("button", {
        cls: `iter-icon-button ${extraClass}`.trim(),
        type: "button"
      });
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      setIcon(button, icon);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        void callback(event);
      });
      return button;
    }
    var IterPanelView2 = class extends ItemView {
      constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.expansion = /* @__PURE__ */ new Map();
        this.renderTimer = null;
      }
      getViewType() {
        return PANEL_VIEW2;
      }
      getDisplayText() {
        return "Iter";
      }
      getIcon() {
        return "sprout";
      }
      async onOpen() {
        this.contentEl.addClass("iter-panel");
        const schedule = (file) => {
          if (!file || file.path === ROOT || file.path.startsWith(`${ROOT}/`)) {
            this.scheduleRender();
          }
        };
        for (const event of ["create", "delete", "modify"]) {
          this.registerEvent(this.app.vault.on(event, schedule));
        }
        this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
          if (oldPath === ROOT || oldPath.startsWith(`${ROOT}/`)) {
            this.scheduleRender();
          } else {
            schedule(file);
          }
        }));
        this.registerEvent(this.app.metadataCache.on("changed", schedule));
        this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRender()));
        this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleRender()));
        this.registerEvent(this.app.workspace.on("file-open", () => this.scheduleRender()));
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
        const active = this.app.workspace.getActiveFile?.();
        return Boolean(file && active && active.path === file.path);
      }
      isGardenActive() {
        const recent = this.app.workspace.getMostRecentLeaf?.();
        return recent?.view?.getViewType?.() === this.plugin.gardenViewType;
      }
      render() {
        const container = this.contentEl;
        container.empty();
        const garden = listGarden2(this.app);
        const toolbar = container.createDiv({ cls: "iter-toolbar" });
        toolbar.createEl("span", { text: "Iter", cls: "iter-toolbar-title" });
        const toolbarActions = toolbar.createDiv({ cls: "iter-toolbar-actions" });
        iconButton(toolbarActions, "plus", "Create tree", () => this.plugin.promptCreateTree());
        const weRow = container.createEl("button", {
          cls: `iter-we-row${this.isGardenActive() ? " is-active" : ""}`,
          type: "button"
        });
        weRow.setAttribute("aria-label", "Open We garden dashboard");
        if (this.isGardenActive()) weRow.setAttribute("aria-current", "page");
        const weIcon = weRow.createSpan({ cls: "iter-we-icon" });
        setIcon(weIcon, "sprout");
        weRow.createSpan({ text: "We", cls: "iter-we-label" });
        const countText = garden.trees.length === 1 ? "1 tree" : `${garden.trees.length} trees`;
        weRow.createSpan({ text: countText, cls: "iter-we-meta" });
        weRow.addEventListener("click", () => {
          void this.plugin.openGarden();
        });
        const body = container.createDiv({ cls: "iter-panel-list" });
        if (!garden.trees.length && !garden.looseItems.length) {
          const empty = body.createDiv({ cls: "iter-panel-empty" });
          empty.createEl("p", { text: "Your Iter folder is ready." });
          const plantBtn = empty.createEl("button", { text: "Plant first tree", type: "button", cls: "iter-ghost-action" });
          plantBtn.addEventListener("click", () => this.plugin.promptCreateTree());
          return;
        }
        for (const tree of garden.trees) {
          this.renderTree(body, tree);
        }
        if (garden.looseItems.length) {
          const misc = body.createDiv({ cls: "iter-misc-section" });
          for (const item of garden.looseItems) {
            this.renderExtraEntry(misc, item);
          }
        }
      }
      renderToggle(row, key, label, defaultExpanded = true) {
        const expanded = this.expansion.get(key) ?? defaultExpanded;
        const toggle = iconButton(
          row,
          expanded ? "chevron-down" : "chevron-right",
          `${expanded ? "Collapse" : "Expand"} ${label}`,
          () => {
            this.expansion.set(key, !expanded);
            this.render();
          },
          "iter-toggle"
        );
        toggle.setAttribute("aria-expanded", String(expanded));
        return expanded;
      }
      showTreeMenu(event, tree) {
        const menu = new Menu();
        menu.addItem(
          (item) => item.setTitle("Create subgoal").setIcon("target").onClick(() => this.plugin.promptCreateSubgoal(tree.path))
        );
        menu.addItem(
          (item) => item.setTitle("Create habit").setIcon("droplet").onClick(() => this.plugin.promptCreateHabit(tree.path))
        );
        menu.addSeparator();
        menu.addItem(
          (item) => item.setTitle("Focus in We garden").setIcon("sprout").onClick(() => void this.plugin.openGarden(tree.path))
        );
        if (tree.indexFile) {
          menu.addItem(
            (item) => item.setTitle("Open tree note").setIcon("file-text").onClick(() => void this.plugin.openFile(tree.indexFile))
          );
        }
        menu.showAtMouseEvent(event);
      }
      renderTree(parent, tree) {
        const section = parent.createDiv({ cls: "iter-tree-node" });
        const row = section.createDiv({ cls: "iter-row iter-tree-row" });
        const expanded = this.renderToggle(row, tree.path, tree.title, true);
        const titleBtn = row.createEl("button", { cls: "iter-row-title", type: "button" });
        titleBtn.setAttribute("title", tree.goal ? `${tree.title} \u2014 ${tree.goal}` : tree.title);
        if (this.isActiveFile(tree.indexFile)) titleBtn.setAttribute("aria-current", "page");
        const iconEl = titleBtn.createSpan({ cls: "iter-row-icon" });
        setIcon(iconEl, MODULE_ICONS[tree.module] || "trees");
        titleBtn.createSpan({ text: tree.title, cls: "iter-row-name" });
        titleBtn.addEventListener("click", () => {
          if (tree.indexFile) void this.plugin.openFile(tree.indexFile);
          else void this.plugin.openGarden(tree.path);
        });
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          this.showTreeMenu(event, tree);
        });
        if (tree.stats.habitTotal > 0) {
          const dot = row.createSpan({
            cls: `iter-hydration-dot is-${tree.stats.hydrationState}`,
            attr: {
              title: `${tree.stats.habitWatered}/${tree.stats.habitTotal} habits watered`
            }
          });
          dot.setAttribute("aria-hidden", "true");
        }
        iconButton(
          row,
          "plus",
          `Add to ${tree.title}`,
          (event) => this.showTreeMenu(event, tree),
          "iter-row-action"
        );
        if (!expanded) return;
        const childrenEl = section.createDiv({ cls: "iter-tree-children" });
        const hasItems = tree.subgoals.length > 0 || tree.habits.length > 0 || tree.extras.length > 0;
        if (!hasItems) {
          childrenEl.createDiv({ cls: "iter-tree-empty", text: "No subgoals or habits yet" });
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
        const row = parent.createDiv({ cls: `iter-row iter-subgoal-row${subgoal.done ? " is-done" : ""}` });
        const toggleBtn = iconButton(
          row,
          subgoal.done ? "check-circle-2" : "circle",
          subgoal.done ? `Mark "${subgoal.title}" incomplete` : `Complete "${subgoal.title}"`,
          async () => {
            try {
              await toggleSubgoal(this.app, subgoal.file);
              this.plugin.scheduleRefresh();
            } catch (error) {
              new Notice2(error?.message || "Could not update subgoal.");
            }
          },
          `iter-check-btn${subgoal.done ? " is-done" : ""}`
        );
        toggleBtn.setAttribute("aria-pressed", String(subgoal.done));
        const titleBtn = row.createEl("button", { cls: "iter-row-title", type: "button" });
        titleBtn.setAttribute("title", subgoal.target ? `${subgoal.title} \xB7 ${subgoal.target}` : subgoal.title);
        if (this.isActiveFile(subgoal.file)) titleBtn.setAttribute("aria-current", "page");
        titleBtn.createSpan({ text: subgoal.title, cls: "iter-row-name" });
        titleBtn.addEventListener("click", () => void this.plugin.openFile(subgoal.file));
      }
      renderHabit(parent, habit) {
        const row = parent.createDiv({
          cls: `iter-row iter-habit-row${habit.wateredInPeriod ? " is-watered" : ""}`
        });
        const waterBtn = iconButton(
          row,
          "droplet",
          habit.wateredToday ? `Undo today's watering for "${habit.title}"` : `Water "${habit.title}"`,
          async () => {
            try {
              const watered = await waterHabit(this.app, habit.file);
              new Notice2(watered ? `Watered ${habit.title}` : `Unwatered ${habit.title} for today`);
              this.plugin.scheduleRefresh();
            } catch (error) {
              new Notice2(error?.message || "Could not water habit.");
            }
          },
          `iter-water-btn${habit.wateredInPeriod ? " is-watered" : ""}`
        );
        waterBtn.setAttribute("aria-pressed", String(habit.wateredToday));
        const titleBtn = row.createEl("button", { cls: "iter-row-title", type: "button" });
        titleBtn.setAttribute("title", habit.target ? `${habit.title} (${habit.frequency}) \xB7 ${habit.target}` : `${habit.title} (${habit.frequency})`);
        if (this.isActiveFile(habit.file)) titleBtn.setAttribute("aria-current", "page");
        titleBtn.createSpan({ text: habit.title, cls: "iter-row-name" });
        titleBtn.addEventListener("click", () => void this.plugin.openFile(habit.file));
        row.createSpan({
          text: CADENCE_SHORT[habit.frequency] || "D",
          cls: "iter-cadence-badge",
          attr: { title: `${habit.frequency} habit` }
        });
      }
      renderExtraEntry(parent, entry) {
        if (entry.kind === "folder") {
          const section = parent.createDiv({ cls: "iter-extra-folder" });
          const row2 = section.createDiv({ cls: "iter-row iter-folder-row" });
          const expanded = this.renderToggle(row2, entry.path, entry.name, false);
          const label = row2.createSpan({ cls: "iter-row-title iter-static-label" });
          const iconEl2 = label.createSpan({ cls: "iter-row-icon" });
          setIcon(iconEl2, "folder");
          label.createSpan({ text: entry.name, cls: "iter-row-name" });
          if (!expanded) return;
          const children = section.createDiv({ cls: "iter-tree-children" });
          for (const child of entry.children) {
            this.renderExtraEntry(children, child);
          }
          return;
        }
        const row = parent.createDiv({ cls: "iter-row iter-file-row" });
        row.createSpan({ cls: "iter-toggle-spacer" });
        const titleBtn = row.createEl("button", { cls: "iter-row-title", type: "button" });
        if (this.isActiveFile(entry.file)) titleBtn.setAttribute("aria-current", "page");
        const iconEl = titleBtn.createSpan({ cls: "iter-row-icon" });
        setIcon(iconEl, "file-text");
        titleBtn.createSpan({ text: entry.name, cls: "iter-row-name" });
        titleBtn.addEventListener("click", () => void this.plugin.openFile(entry.file));
      }
    };
    module2.exports = {
      IterPanelView: IterPanelView2,
      PANEL_VIEW: PANEL_VIEW2
    };
  }
});

// src/tree-art.js
var require_tree_art = __commonJS({
  "src/tree-art.js"(exports2, module2) {
    var SVG_NS = "http://www.w3.org/2000/svg";
    function hashString(input) {
      let hash = 2166136261;
      const text = String(input || "iter");
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }
    function createRng(seedValue) {
      let state = seedValue || 1;
      return () => {
        state = Math.imul(1664525, state) + 1013904223 >>> 0;
        return state / 4294967296;
      };
    }
    function resolveStyle(tree) {
      if (tree?.style && tree.style !== "auto") return tree.style;
      switch (tree?.module) {
        case "gym":
          return "bonsai";
        case "learning":
          return "pine";
        case "creative":
          return "willow";
        default:
          return "canopy";
      }
    }
    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    function round(num) {
      return Math.round(num * 10) / 10;
    }
    function buildCanopyGeometry(growth, rand) {
      const lean = (rand() - 0.5) * 14;
      const baseY = 128;
      const height = 28 + growth * 58;
      const topY = baseY - height;
      const topX = 80 + lean * 0.45;
      const midX = 80 - lean * 0.35;
      const midY = baseY - height * 0.5;
      const trunks = [
        { d: `M 80 ${baseY} Q ${round(midX)} ${round(midY)} ${round(topX)} ${round(topY)}`, width: round(2.2 + growth * 2.4) }
      ];
      const branches = [];
      const canopies = [];
      const blossoms = [];
      if (growth < 0.25) {
        canopies.push(
          { kind: "ellipse", cx: round(topX - 8), cy: round(topY - 2), rx: 8, ry: 4.5, rotate: -26, tone: "a" },
          { kind: "ellipse", cx: round(topX + 8), cy: round(topY - 4), rx: 7.5, ry: 4, rotate: 24, tone: "b" }
        );
        return { trunks, branches, canopies, blossoms };
      }
      const leftBranchX = topX - (14 + growth * 14);
      const leftBranchY = topY + height * 0.28;
      const rightBranchX = topX + (14 + growth * 14);
      const rightBranchY = topY + height * 0.22;
      branches.push(
        { d: `M ${round((midX + topX) / 2)} ${round(baseY - height * 0.52)} Q ${round(topX - 10)} ${round(leftBranchY + 8)} ${round(leftBranchX)} ${round(leftBranchY)}`, width: round(1.5 + growth * 1.1) },
        { d: `M ${round((midX + topX) / 2)} ${round(baseY - height * 0.58)} Q ${round(topX + 10)} ${round(rightBranchY + 8)} ${round(rightBranchX)} ${round(rightBranchY)}`, width: round(1.5 + growth * 1.1) }
      );
      const scale = 0.65 + growth * 0.52;
      canopies.push(
        { kind: "ellipse", cx: round(leftBranchX), cy: round(leftBranchY - 4), rx: round(18 * scale), ry: round(13 * scale), rotate: -8, tone: "b" },
        { kind: "ellipse", cx: round(rightBranchX), cy: round(rightBranchY - 5), rx: round(19 * scale), ry: round(14 * scale), rotate: 8, tone: "b" },
        { kind: "ellipse", cx: round(topX), cy: round(topY - 8), rx: round(24 * scale), ry: round(18 * scale), rotate: 0, tone: "a" }
      );
      if (growth >= 0.55) {
        canopies.push(
          { kind: "ellipse", cx: round(topX - 11), cy: round(topY - 14), rx: round(15 * scale), ry: round(11 * scale), rotate: -5, tone: "c" },
          { kind: "ellipse", cx: round(topX + 10), cy: round(topY - 12), rx: round(14 * scale), ry: round(11 * scale), rotate: 6, tone: "a" }
        );
      }
      if (growth >= 0.85) {
        blossoms.push(
          { cx: round(topX - 12), cy: round(topY - 10), r: 2.3 },
          { cx: round(topX + 8), cy: round(topY - 17), r: 2.1 },
          { cx: round(rightBranchX + 4), cy: round(rightBranchY - 7), r: 2 }
        );
      }
      return { trunks, branches, canopies, blossoms };
    }
    function buildBonsaiGeometry(growth, rand) {
      const dir = rand() > 0.5 ? 1 : -1;
      const baseY = 128;
      const height = 28 + growth * 50;
      const bendX = 80 - dir * (16 + growth * 12);
      const apexX = 80 + dir * (12 + growth * 14);
      const apexY = baseY - height;
      const trunks = [
        { d: `M 80 ${baseY} C ${round(80 - dir * 24)} ${round(baseY - height * 0.35)}, ${round(bendX)} ${round(baseY - height * 0.72)}, ${round(apexX)} ${round(apexY)}`, width: round(2.8 + growth * 2.6) }
      ];
      const branches = [];
      const canopies = [];
      const blossoms = [];
      if (growth < 0.25) {
        canopies.push(
          { kind: "ellipse", cx: round(apexX), cy: round(apexY - 4), rx: 11, ry: 5, rotate: dir * 6, tone: "a" }
        );
        return { trunks, branches, canopies, blossoms };
      }
      const sideX = 80 - dir * (22 + growth * 14);
      const sideY = baseY - height * 0.54;
      branches.push(
        { d: `M ${round(80 - dir * 10)} ${round(baseY - height * 0.45)} Q ${round(sideX + dir * 8)} ${round(sideY + 6)} ${round(sideX)} ${round(sideY)}`, width: round(1.8 + growth) }
      );
      const padScale = 0.7 + growth * 0.48;
      canopies.push(
        { kind: "ellipse", cx: round(sideX), cy: round(sideY - 4), rx: round(19 * padScale), ry: round(8 * padScale), rotate: -dir * 4, tone: "b" },
        { kind: "ellipse", cx: round(apexX), cy: round(apexY - 5), rx: round(24 * padScale), ry: round(9.5 * padScale), rotate: dir * 3, tone: "a" }
      );
      if (growth >= 0.58) {
        const upperX = apexX - dir * 16;
        const upperY = apexY + 12;
        branches.push(
          { d: `M ${round(apexX - dir * 4)} ${round(apexY + 16)} Q ${round(upperX + dir * 6)} ${round(upperY + 4)} ${round(upperX)} ${round(upperY)}`, width: 1.6 }
        );
        canopies.push(
          { kind: "ellipse", cx: round(upperX), cy: round(upperY - 4), rx: round(15 * padScale), ry: round(7 * padScale), rotate: 0, tone: "c" }
        );
      }
      if (growth >= 0.85) {
        blossoms.push(
          { cx: round(apexX - 8), cy: round(apexY - 8), r: 2.2 },
          { cx: round(apexX + 9), cy: round(apexY - 5), r: 2 },
          { cx: round(sideX), cy: round(sideY - 6), r: 2 }
        );
      }
      return { trunks, branches, canopies, blossoms };
    }
    function buildPineGeometry(growth, rand) {
      const sway = (rand() - 0.5) * 6;
      const baseY = 128;
      const height = 32 + growth * 60;
      const topY = baseY - height;
      const topX = 80 + sway;
      const trunks = [
        { d: `M 80 ${baseY} Q ${round(80 - sway * 0.5)} ${round(baseY - height * 0.5)} ${round(topX)} ${round(topY + 8)}`, width: round(2.2 + growth * 2) }
      ];
      const branches = [];
      const canopies = [];
      const blossoms = [];
      const tierCount = growth < 0.25 ? 1 : growth < 0.5 ? 2 : growth < 0.8 ? 3 : 4;
      for (let i = 0; i < tierCount; i += 1) {
        const t = (i + 1) / (tierCount + 0.35);
        const tierY = baseY - height * (0.28 + t * 0.68);
        const halfWidth = (10 + growth * 20) * (1 - i * 0.2);
        const tierHeight = 14 + growth * 10;
        const peakY = tierY - tierHeight;
        const cx = 80 + sway * t;
        const d = [
          `M ${round(cx)} ${round(peakY)}`,
          `Q ${round(cx + halfWidth * 0.55)} ${round(tierY - tierHeight * 0.25)} ${round(cx + halfWidth)} ${round(tierY)}`,
          `Q ${round(cx)} ${round(tierY + 4)} ${round(cx - halfWidth)} ${round(tierY)}`,
          `Q ${round(cx - halfWidth * 0.55)} ${round(tierY - tierHeight * 0.25)} ${round(cx)} ${round(peakY)} Z`
        ].join(" ");
        canopies.push({ kind: "path", d, tone: i % 2 === 0 ? "a" : "b" });
      }
      if (growth >= 0.85) {
        blossoms.push(
          { cx: round(topX), cy: round(topY - 2), r: 2.2 },
          { cx: round(topX - 9), cy: round(topY + 18), r: 1.9 },
          { cx: round(topX + 10), cy: round(topY + 26), r: 1.9 }
        );
      }
      return { trunks, branches, canopies, blossoms };
    }
    function buildWillowGeometry(growth, rand) {
      const lean = (rand() - 0.5) * 10;
      const baseY = 128;
      const height = 28 + growth * 54;
      const topY = baseY - height;
      const topX = 80 + lean * 0.4;
      const trunks = [
        { d: `M 80 ${baseY} Q ${round(80 - lean * 0.4)} ${round(baseY - height * 0.48)} ${round(topX)} ${round(topY + 6)}`, width: round(2.2 + growth * 2.2) }
      ];
      const branches = [];
      const canopies = [];
      const blossoms = [];
      const frondCount = growth < 0.25 ? 2 : growth < 0.55 ? 4 : 6;
      const span = 14 + growth * 22;
      for (let i = 0; i < frondCount; i += 1) {
        const ratio = frondCount === 1 ? 0.5 : i / (frondCount - 1);
        const offset = (ratio - 0.5) * 2 * span;
        const endX = topX + offset;
        const drop = 16 + growth * 24 - Math.abs(offset) * 0.22;
        const endY = topY + 6 + drop;
        const ctrlX = topX + offset * 0.72;
        const ctrlY = topY - 4;
        branches.push({
          d: `M ${round(topX)} ${round(topY + 6)} Q ${round(ctrlX)} ${round(ctrlY)} ${round(endX)} ${round(endY)}`,
          width: 1.4,
          soft: true
        });
        canopies.push({
          kind: "ellipse",
          cx: round(endX),
          cy: round(endY - 4),
          rx: 3.8,
          ry: 7.5,
          rotate: round(offset * 0.35),
          tone: i % 2 === 0 ? "a" : "b"
        });
      }
      canopies.unshift({
        kind: "ellipse",
        cx: round(topX),
        cy: round(topY - 2),
        rx: round(12 + growth * 12),
        ry: round(7 + growth * 5),
        rotate: 0,
        tone: "c"
      });
      if (growth >= 0.85) {
        blossoms.push(
          { cx: round(topX - 8), cy: round(topY - 3), r: 2.1 },
          { cx: round(topX + 9), cy: round(topY + 1), r: 2 }
        );
      }
      return { trunks, branches, canopies, blossoms };
    }
    function computeTreeGeometry(tree) {
      const growth = clamp(tree?.stats?.growth ?? 0.2, 0.15, 1);
      const style = resolveStyle(tree);
      const rand = createRng(hashString(`${tree?.title || "Iter"}:${style}`));
      let shapes;
      if (style === "bonsai") shapes = buildBonsaiGeometry(growth, rand);
      else if (style === "pine") shapes = buildPineGeometry(growth, rand);
      else if (style === "willow") shapes = buildWillowGeometry(growth, rand);
      else shapes = buildCanopyGeometry(growth, rand);
      return {
        style,
        growth,
        hydrationState: tree?.stats?.hydrationState ?? "calm",
        ...shapes
      };
    }
    function svgEl(tag, attrs = {}) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (value !== void 0 && value !== null) node.setAttribute(key, String(value));
      }
      return node;
    }
    function appendPot(svg, hydrationState) {
      svg.appendChild(svgEl("ellipse", {
        cx: 80,
        cy: 164,
        rx: 28,
        ry: 3.5,
        class: "iter-svg-shadow"
      }));
      svg.appendChild(svgEl("path", {
        d: "M 55 135 L 105 135 L 98 159 Q 97 162 93 162 L 67 162 Q 63 162 62 159 Z",
        class: "iter-svg-pot"
      }));
      svg.appendChild(svgEl("rect", {
        x: 51,
        y: 129,
        width: 58,
        height: 6,
        rx: 3,
        class: "iter-svg-rim"
      }));
      svg.appendChild(svgEl("path", {
        d: "M 56 129 Q 80 125 104 129",
        class: "iter-svg-soil"
      }));
      if (hydrationState === "hydrated" || hydrationState === "partial") {
        const dewGroup = svgEl("g", {
          class: hydrationState === "hydrated" ? "iter-svg-dew is-hydrated" : "iter-svg-dew is-partial"
        });
        dewGroup.appendChild(svgEl("path", {
          d: "M 116 142 C 116 142 120 147.5 120 150 A 4 4 0 1 1 112 150 C 112 147.5 116 142 116 142 Z"
        }));
        svg.appendChild(dewGroup);
      }
    }
    function renderTreeSvg(container, tree, options = {}) {
      const geo = computeTreeGeometry(tree);
      const svg = svgEl("svg", {
        viewBox: "0 0 160 176",
        class: `iter-tree-svg is-${geo.hydrationState} style-${geo.style}${options.large ? " is-large" : ""}`,
        role: "img",
        "aria-label": `${tree?.title || "Tree"} (${tree?.stats?.stageLabel || "Seedling"})`
      });
      const treeGroup = svgEl("g", { class: "iter-svg-plant" });
      const canopyGroup = svgEl("g", { class: "iter-svg-canopy" });
      for (const trunk of geo.trunks) {
        treeGroup.appendChild(svgEl("path", {
          d: trunk.d,
          "stroke-width": trunk.width,
          class: "iter-svg-trunk"
        }));
      }
      for (const branch of geo.branches) {
        treeGroup.appendChild(svgEl("path", {
          d: branch.d,
          "stroke-width": branch.width,
          class: branch.soft ? "iter-svg-branch is-soft" : "iter-svg-branch"
        }));
      }
      for (const shape of geo.canopies) {
        if (shape.kind === "path") {
          canopyGroup.appendChild(svgEl("path", {
            d: shape.d,
            class: `iter-svg-foliage tone-${shape.tone}`
          }));
        } else {
          const transform = shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : null;
          canopyGroup.appendChild(svgEl("ellipse", {
            cx: shape.cx,
            cy: shape.cy,
            rx: shape.rx,
            ry: shape.ry,
            transform,
            class: `iter-svg-foliage tone-${shape.tone}`
          }));
        }
      }
      for (const blossom of geo.blossoms) {
        canopyGroup.appendChild(svgEl("circle", {
          cx: blossom.cx,
          cy: blossom.cy,
          r: blossom.r,
          class: "iter-svg-blossom"
        }));
      }
      treeGroup.appendChild(canopyGroup);
      svg.appendChild(treeGroup);
      appendPot(svg, geo.hydrationState);
      container.appendChild(svg);
      return svg;
    }
    function renderEmptyPotSvg(container) {
      const svg = svgEl("svg", {
        viewBox: "0 0 160 176",
        class: "iter-tree-svg is-empty-pot",
        "aria-hidden": "true"
      });
      svg.appendChild(svgEl("path", {
        d: "M 80 128 Q 78 112 72 106",
        "stroke-width": 2,
        class: "iter-svg-trunk"
      }));
      svg.appendChild(svgEl("ellipse", {
        cx: 72,
        cy: 103,
        rx: 6,
        ry: 3.2,
        transform: "rotate(-25 72 103)",
        class: "iter-svg-foliage tone-a"
      }));
      appendPot(svg, "calm");
      container.appendChild(svg);
      return svg;
    }
    module2.exports = {
      resolveStyle,
      computeTreeGeometry,
      renderTreeSvg,
      renderEmptyPotSvg
    };
  }
});

// src/garden-view.js
var require_garden_view = __commonJS({
  "src/garden-view.js"(exports2, module2) {
    var { ItemView, Notice: Notice2, setIcon } = require("obsidian");
    var { MODULES, ROOT, toggleSubgoal, waterHabit } = require_storage();
    var { listGarden: listGarden2 } = require_catalog();
    var { renderTreeSvg, renderEmptyPotSvg } = require_tree_art();
    var GARDEN_VIEW2 = "iter-garden";
    var MODULE_LABELS = Object.fromEntries(MODULES.map((item) => [item.id, item.label]));
    var HYDRATION_LABELS = {
      hydrated: "Watered",
      partial: "Partly watered",
      thirsty: "Needs water",
      calm: "No habits yet"
    };
    var GardenView2 = class extends ItemView {
      constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.selectedTreePath = null;
        this.renderTimer = null;
      }
      getViewType() {
        return GARDEN_VIEW2;
      }
      getDisplayText() {
        return "We";
      }
      getIcon() {
        return "sprout";
      }
      async setState(state, result) {
        if (state?.selectedTreePath !== void 0) {
          this.selectedTreePath = state.selectedTreePath;
          this.render();
        }
        await super.setState(state, result);
      }
      getState() {
        return { selectedTreePath: this.selectedTreePath };
      }
      async onOpen() {
        this.contentEl.addClass("iter-garden");
        const schedule = (file) => {
          if (!file || file.path === ROOT || file.path.startsWith(`${ROOT}/`)) {
            this.scheduleRender();
          }
        };
        for (const event of ["create", "delete", "modify"]) {
          this.registerEvent(this.app.vault.on(event, schedule));
        }
        this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
          if (oldPath === this.selectedTreePath) {
            this.selectedTreePath = file.path;
          }
          if (oldPath === ROOT || oldPath.startsWith(`${ROOT}/`)) {
            this.scheduleRender();
          } else {
            schedule(file);
          }
        }));
        this.registerEvent(this.app.metadataCache.on("changed", schedule));
        this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRender()));
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
        const garden = listGarden2(this.app);
        if (this.selectedTreePath && !garden.trees.some((tree) => tree.path === this.selectedTreePath)) {
          this.selectedTreePath = null;
        }
        const shell = container.createDiv({ cls: "iter-garden-shell" });
        this.renderHeader(shell, garden);
        if (!garden.trees.length) {
          this.renderEmptyState(shell);
          return;
        }
        const grid = shell.createDiv({ cls: "iter-garden-grid" });
        for (const tree of garden.trees) {
          this.renderPotCard(grid, tree);
        }
        const selected = this.selectedTreePath ? garden.trees.find((tree) => tree.path === this.selectedTreePath) : null;
        if (selected) {
          this.renderInspector(shell, selected);
        }
      }
      renderHeader(shell, garden) {
        const header = shell.createDiv({ cls: "iter-garden-header" });
        const titleGroup = header.createDiv({ cls: "iter-garden-heading" });
        titleGroup.createEl("h1", { text: "We", cls: "iter-garden-title" });
        const totalSubgoals = garden.trees.reduce((sum, t) => sum + t.stats.subgoalTotal, 0);
        const doneSubgoals = garden.trees.reduce((sum, t) => sum + t.stats.subgoalDone, 0);
        const totalHabits = garden.trees.reduce((sum, t) => sum + t.stats.habitTotal, 0);
        const wateredHabits = garden.trees.reduce((sum, t) => sum + t.stats.habitWatered, 0);
        const parts = [];
        if (garden.trees.length) {
          parts.push(`${garden.trees.length} ${garden.trees.length === 1 ? "tree" : "trees"}`);
          if (totalSubgoals) parts.push(`${doneSubgoals}/${totalSubgoals} subgoals`);
          if (totalHabits) parts.push(`${wateredHabits}/${totalHabits} watered`);
        } else {
          parts.push("Shared long-term garden");
        }
        titleGroup.createEl("p", { text: parts.join(" \xB7 "), cls: "iter-garden-subtitle" });
        const actions = header.createDiv({ cls: "iter-garden-actions" });
        if (garden.members.length) {
          const membersWrap = actions.createDiv({ cls: "iter-members-strip" });
          for (const member of garden.members) {
            membersWrap.createSpan({ text: member, cls: "iter-member-pill" });
          }
        }
        const newTreeBtn = actions.createEl("button", {
          cls: "iter-primary-pill",
          type: "button"
        });
        const plusIcon = newTreeBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(plusIcon, "plus");
        newTreeBtn.createSpan({ text: "New tree" });
        newTreeBtn.addEventListener("click", () => this.plugin.promptCreateTree());
      }
      renderEmptyState(shell) {
        const empty = shell.createDiv({ cls: "iter-garden-empty" });
        const art = empty.createDiv({ cls: "iter-empty-art" });
        renderEmptyPotSvg(art);
        empty.createEl("h2", { text: "Your garden is quiet", cls: "iter-empty-title" });
        empty.createEl("p", {
          text: "Plant a tree for a long-term goal, break it into subgoals, and water it with daily, weekly, or monthly habits.",
          cls: "iter-empty-copy"
        });
        const btn = empty.createEl("button", { text: "Create tree", cls: "mod-cta", type: "button" });
        btn.addEventListener("click", () => this.plugin.promptCreateTree());
      }
      renderPotCard(grid, tree) {
        const selected = this.selectedTreePath === tree.path;
        const card = grid.createDiv({
          cls: `iter-pot-card${selected ? " is-selected" : ""} is-${tree.stats.hydrationState}`
        });
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
        card.setAttribute("aria-pressed", String(selected));
        card.setAttribute("aria-label", `${tree.title}, ${tree.stats.stageLabel}`);
        card.addEventListener("click", () => this.selectTree(tree.path));
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.selectTree(tree.path);
          }
        });
        const stage = card.createDiv({ cls: "iter-pot-stage" });
        renderTreeSvg(stage, tree);
        const meta = card.createDiv({ cls: "iter-pot-meta" });
        const nameRow = meta.createDiv({ cls: "iter-pot-name-row" });
        nameRow.createSpan({ text: tree.title, cls: "iter-pot-title" });
        nameRow.createSpan({ text: MODULE_LABELS[tree.module] || tree.module, cls: "iter-module-pill" });
        if (tree.goal) {
          meta.createEl("p", { text: tree.goal, cls: "iter-pot-goal" });
        }
        const statsParts = [tree.stats.stageLabel];
        if (tree.stats.subgoalTotal > 0) {
          statsParts.push(`${tree.stats.subgoalDone}/${tree.stats.subgoalTotal} subgoals`);
        }
        if (tree.stats.habitTotal > 0) {
          statsParts.push(`${tree.stats.habitWatered}/${tree.stats.habitTotal} watered`);
        }
        meta.createDiv({ text: statsParts.join(" \xB7 "), cls: "iter-pot-stats" });
        if (tree.habits.length > 0) {
          const waterBar = card.createDiv({ cls: "iter-pot-water-bar" });
          const visibleHabits = tree.habits.slice(0, 3);
          for (const habit of visibleHabits) {
            const chip = waterBar.createEl("button", {
              cls: `iter-water-chip${habit.wateredInPeriod ? " is-watered" : ""}`,
              type: "button",
              attr: {
                "aria-pressed": String(habit.wateredToday),
                title: habit.wateredToday ? `Undo today's water: ${habit.title}` : `Water ${habit.title}`
              }
            });
            const drop = chip.createSpan({ cls: "iter-chip-icon" });
            setIcon(drop, "droplet");
            chip.createSpan({ text: habit.title, cls: "iter-chip-label" });
            chip.addEventListener("click", async (event) => {
              event.stopPropagation();
              try {
                const watered = await waterHabit(this.app, habit.file);
                new Notice2(watered ? `Watered ${habit.title}` : `Unwatered ${habit.title} for today`);
                this.plugin.scheduleRefresh();
              } catch (error) {
                new Notice2(error?.message || "Could not water habit.");
              }
            });
          }
          if (tree.habits.length > 3) {
            waterBar.createSpan({ text: `+${tree.habits.length - 3}`, cls: "iter-more-habits" });
          }
        }
      }
      renderInspector(shell, tree) {
        const panel = shell.createDiv({ cls: "iter-inspector" });
        const visual = panel.createDiv({ cls: "iter-inspector-visual" });
        renderTreeSvg(visual, tree, { large: true });
        const growthPct = Math.round(tree.stats.growth * 100);
        visual.createDiv({
          text: `${tree.stats.stageLabel} \xB7 ${growthPct}%`,
          cls: "iter-inspector-stage"
        });
        visual.createDiv({
          text: HYDRATION_LABELS[tree.stats.hydrationState],
          cls: `iter-hydration-badge is-${tree.stats.hydrationState}`
        });
        const details = panel.createDiv({ cls: "iter-inspector-details" });
        const top = details.createDiv({ cls: "iter-inspector-top" });
        const heading = top.createDiv({ cls: "iter-inspector-heading" });
        heading.createEl("h2", { text: tree.title, cls: "iter-inspector-title" });
        heading.createSpan({ text: MODULE_LABELS[tree.module] || tree.module, cls: "iter-module-pill" });
        const topActions = top.createDiv({ cls: "iter-inspector-top-actions" });
        if (tree.indexFile) {
          const noteBtn = topActions.createEl("button", { cls: "iter-ghost-action", type: "button" });
          const noteIcon = noteBtn.createSpan({ cls: "iter-btn-icon" });
          setIcon(noteIcon, "file-text");
          noteBtn.createSpan({ text: "Open note" });
          noteBtn.addEventListener("click", () => void this.plugin.openFile(tree.indexFile));
        }
        const closeBtn = topActions.createEl("button", {
          cls: "iter-icon-button",
          type: "button",
          attr: { "aria-label": "Close inspector", title: "Close" }
        });
        setIcon(closeBtn, "x");
        closeBtn.addEventListener("click", () => {
          this.selectedTreePath = null;
          this.render();
        });
        if (tree.goal) {
          details.createEl("p", { text: tree.goal, cls: "iter-inspector-goal" });
        }
        if (tree.targets.length > 0) {
          const targetsWrap = details.createDiv({ cls: "iter-targets-strip" });
          for (const item of tree.targets) {
            const pill = targetsWrap.createDiv({ cls: "iter-target-pill" });
            pill.createSpan({ text: item.user, cls: "iter-target-user" });
            pill.createSpan({ text: item.target, cls: "iter-target-value" });
          }
        }
        const columns = details.createDiv({ cls: "iter-inspector-columns" });
        const subCol = columns.createDiv({ cls: "iter-inspector-section" });
        const subHeader = subCol.createDiv({ cls: "iter-section-header" });
        subHeader.createEl("h3", { text: "Subgoals" });
        const addSubBtn = subHeader.createEl("button", { cls: "iter-ghost-action", type: "button" });
        const subPlus = addSubBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(subPlus, "plus");
        addSubBtn.createSpan({ text: "Subgoal" });
        addSubBtn.addEventListener("click", () => this.plugin.promptCreateSubgoal(tree.path));
        if (!tree.subgoals.length) {
          subCol.createEl("p", { text: "No subgoals yet.", cls: "iter-section-empty" });
        } else {
          const list = subCol.createDiv({ cls: "iter-detail-list" });
          for (const sub of tree.subgoals) {
            const row = list.createDiv({ cls: `iter-detail-row${sub.done ? " is-done" : ""}` });
            const checkBtn = row.createEl("button", {
              cls: `iter-icon-button iter-check-btn${sub.done ? " is-done" : ""}`,
              type: "button",
              attr: {
                "aria-pressed": String(sub.done),
                "aria-label": sub.done ? `Mark ${sub.title} incomplete` : `Complete ${sub.title}`
              }
            });
            setIcon(checkBtn, sub.done ? "check-circle-2" : "circle");
            checkBtn.addEventListener("click", async () => {
              try {
                await toggleSubgoal(this.app, sub.file);
                this.plugin.scheduleRefresh();
              } catch (error) {
                new Notice2(error?.message || "Could not update subgoal.");
              }
            });
            const textBtn = row.createEl("button", { cls: "iter-detail-link", type: "button" });
            textBtn.createSpan({ text: sub.title, cls: "iter-detail-title" });
            if (sub.target) textBtn.createSpan({ text: sub.target, cls: "iter-detail-sub" });
            textBtn.addEventListener("click", () => void this.plugin.openFile(sub.file));
          }
        }
        const habCol = columns.createDiv({ cls: "iter-inspector-section" });
        const habHeader = habCol.createDiv({ cls: "iter-section-header" });
        habHeader.createEl("h3", { text: "Habits" });
        const addHabBtn = habHeader.createEl("button", { cls: "iter-ghost-action", type: "button" });
        const habPlus = addHabBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(habPlus, "plus");
        addHabBtn.createSpan({ text: "Habit" });
        addHabBtn.addEventListener("click", () => this.plugin.promptCreateHabit(tree.path));
        if (!tree.habits.length) {
          habCol.createEl("p", { text: "No watering habits yet.", cls: "iter-section-empty" });
        } else {
          const list = habCol.createDiv({ cls: "iter-detail-list" });
          for (const habit of tree.habits) {
            const row = list.createDiv({ cls: `iter-detail-row${habit.wateredInPeriod ? " is-watered" : ""}` });
            const textBtn = row.createEl("button", { cls: "iter-detail-link", type: "button" });
            textBtn.createSpan({ text: habit.title, cls: "iter-detail-title" });
            const subMeta = [habit.frequency];
            if (habit.streak > 0) subMeta.push(`${habit.streak} streak`);
            if (habit.target) subMeta.push(habit.target);
            textBtn.createSpan({ text: subMeta.join(" \xB7 "), cls: "iter-detail-sub" });
            textBtn.addEventListener("click", () => void this.plugin.openFile(habit.file));
            const waterBtn = row.createEl("button", {
              cls: `iter-water-action${habit.wateredInPeriod ? " is-watered" : ""}`,
              type: "button",
              attr: { "aria-pressed": String(habit.wateredToday) }
            });
            const drop = waterBtn.createSpan({ cls: "iter-btn-icon" });
            setIcon(drop, "droplet");
            waterBtn.createSpan({ text: habit.wateredToday ? "Watered" : habit.wateredInPeriod ? "Done" : "Water" });
            waterBtn.addEventListener("click", async () => {
              try {
                const watered = await waterHabit(this.app, habit.file);
                new Notice2(watered ? `Watered ${habit.title}` : `Unwatered ${habit.title} for today`);
                this.plugin.scheduleRefresh();
              } catch (error) {
                new Notice2(error?.message || "Could not water habit.");
              }
            });
          }
        }
      }
    };
    module2.exports = {
      GardenView: GardenView2,
      GARDEN_VIEW: GARDEN_VIEW2
    };
  }
});

// src/plugin.js
var { Plugin, Notice } = require("obsidian");
var { ensureStructure, createTree, createSubgoal, createHabit } = require_storage();
var { listGarden, findTreeContext } = require_catalog();
var { CreateTreeModal, CreateSubgoalModal, CreateHabitModal } = require_modals();
var { IterPanelView, PANEL_VIEW } = require_panel_view();
var { GardenView, GARDEN_VIEW } = require_garden_view();
var IterPlugin = class extends Plugin {
  async onload() {
    this.alive = true;
    this.refreshTimer = null;
    this.gardenViewType = GARDEN_VIEW;
    await ensureStructure(this.app.vault);
    this.registerView(PANEL_VIEW, (leaf) => new IterPanelView(leaf, this));
    this.registerView(GARDEN_VIEW, (leaf) => new GardenView(leaf, this));
    this.addRibbonIcon("sprout", "Open Iter panel", () => {
      void this.activatePanel(true);
    });
    this.addCommand({
      id: "create-tree",
      name: "Create tree",
      callback: () => this.promptCreateTree()
    });
    this.addCommand({
      id: "create-subgoal",
      name: "Create subgoal",
      callback: () => this.promptCreateSubgoal()
    });
    this.addCommand({
      id: "create-habit",
      name: "Create habit",
      callback: () => this.promptCreateHabit()
    });
    this.addCommand({
      id: "open-iter-panel",
      name: "Open Iter panel",
      callback: () => {
        void this.activatePanel(true);
      }
    });
    this.addCommand({
      id: "open-we-garden",
      name: "Open We garden",
      callback: () => {
        void this.openGarden();
      }
    });
    const onReady = () => {
      if (!this.alive) return;
      void ensureStructure(this.app.vault).then(() => this.activatePanel(false)).catch((error) => console.error("Iter init:", error));
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
        if (reveal) new Notice("Could not open the Iter panel.");
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
        new Notice("Could not open the We garden.");
        return null;
      }
      await leaf.setViewState({
        type: GARDEN_VIEW,
        state: selectedTreePath ? { selectedTreePath } : {},
        active: true
      });
    } else if (selectedTreePath) {
      await leaf.setViewState({
        type: GARDEN_VIEW,
        state: { selectedTreePath },
        active: true
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
    const leaf = active?.view?.getViewType?.() === GARDEN_VIEW ? workspace.getLeaf("tab") : workspace.getLeaf(false);
    await leaf.openFile(file);
    await workspace.revealLeaf(leaf);
  }
  resolveInitialTreePath(trees, preferredTreePath) {
    if (preferredTreePath && trees.some((t) => t.path === preferredTreePath)) {
      return preferredTreePath;
    }
    const activeLeaf = this.app.workspace.getMostRecentLeaf?.();
    if (activeLeaf?.view?.getViewType?.() === GARDEN_VIEW && activeLeaf.view.selectedTreePath) {
      const match = trees.find((t) => t.path === activeLeaf.view.selectedTreePath);
      if (match) return match.path;
    }
    const activeFile = this.app.workspace.getActiveFile?.();
    const contextTree = findTreeContext(this.app, activeFile);
    if (contextTree && trees.some((t) => t.path === contextTree)) {
      return contextTree;
    }
    return trees[0]?.path ?? null;
  }
  promptCreateTree() {
    new CreateTreeModal(this.app, {
      onSubmit: async (values) => {
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
      }
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
      onSubmit: async (values) => {
        await createSubgoal(this.app.vault, values);
        new Notice(`Added subgoal "${values.name.trim()}"`);
        this.scheduleRefresh();
      }
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
      onSubmit: async (values) => {
        await createHabit(this.app.vault, values);
        new Notice(`Added habit "${values.name.trim()}"`);
        this.scheduleRefresh();
      }
    }).open();
  }
};
module.exports = IterPlugin;
