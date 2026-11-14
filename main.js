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
    var FREQUENCIES = ["daily", "weekdays", "weekly", "monthly"];
    var WEEKDAYS = [
      { id: "mon", tiny: "M", short: "Mo", label: "Mon", full: "Monday", jsDay: 1 },
      { id: "tue", tiny: "T", short: "Tu", label: "Tue", full: "Tuesday", jsDay: 2 },
      { id: "wed", tiny: "W", short: "We", label: "Wed", full: "Wednesday", jsDay: 3 },
      { id: "thu", tiny: "T", short: "Th", label: "Thu", full: "Thursday", jsDay: 4 },
      { id: "fri", tiny: "F", short: "Fr", label: "Fri", full: "Friday", jsDay: 5 },
      { id: "sat", tiny: "S", short: "Sa", label: "Sat", full: "Saturday", jsDay: 6 },
      { id: "sun", tiny: "S", short: "Su", label: "Sun", full: "Sunday", jsDay: 0 }
    ];
    var DAY_BY_JS_DAY = new Map(WEEKDAYS.map((d) => [d.jsDay, d.id]));
    var DAY_ORDER = new Map(WEEKDAYS.map((d, i) => [d.id, i]));
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
    function normalizeDays(raw) {
      if (!Array.isArray(raw)) return [];
      const chosen = /* @__PURE__ */ new Set();
      for (const item of raw) {
        if (typeof item === "number" && DAY_BY_JS_DAY.has(item)) {
          chosen.add(DAY_BY_JS_DAY.get(item));
          continue;
        }
        const clean = typeof item === "string" ? item.trim().toLowerCase() : "";
        if (!clean) continue;
        const match = WEEKDAYS.find(
          (d) => d.id === clean || d.short.toLowerCase() === clean || d.label.toLowerCase() === clean || d.full.toLowerCase() === clean
        );
        if (match) chosen.add(match.id);
      }
      return Array.from(chosen).sort((a, b) => DAY_ORDER.get(a) - DAY_ORDER.get(b));
    }
    function formatCadenceLabel(frequency, days = []) {
      const freq = normalizeFrequency(frequency);
      if (freq === "weekdays") {
        const clean = normalizeDays(days);
        if (!clean.length) return "Specific days";
        if (clean.length === 7) return "Every day";
        if (clean.length === 5 && !clean.includes("sat") && !clean.includes("sun")) return "Weekdays";
        if (clean.length === 2 && clean.includes("sat") && clean.includes("sun")) return "Weekends";
        return clean.map((id) => WEEKDAYS[DAY_ORDER.get(id)].label).join(", ");
      }
      if (freq === "weekly") return "Weekly";
      if (freq === "monthly") return "Monthly";
      return "Daily";
    }
    function formatCadenceShort(frequency, days = []) {
      const freq = normalizeFrequency(frequency);
      if (freq === "weekdays") {
        const clean = normalizeDays(days);
        if (!clean.length) return "Days";
        if (clean.length <= 3) return clean.map((id) => WEEKDAYS[DAY_ORDER.get(id)].short).join("\xB7");
        return `${clean.length}d/w`;
      }
      if (freq === "weekly") return "W";
      if (freq === "monthly") return "M";
      return "D";
    }
    function normalizeStyle(value) {
      const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
      return STYLES.includes(normalized) ? normalized : "auto";
    }
    async function createTree2(vault, { name, module: module3 = "general", goal = "", style = "auto", endless = false, due = "" }) {
      const title = validateName(name, "Tree name");
      const mod = normalizeModule(module3);
      const treeStyle = normalizeStyle(style);
      const cleanGoal = typeof goal === "string" ? goal.trim() : "";
      const isEndless = Boolean(endless);
      const cleanDue = !isEndless && typeof due === "string" && parseDateKey(due) ? due.trim() : "";
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
        `endless: ${isEndless ? "true" : "false"}`
      ];
      if (cleanDue) {
        lines.push(`due: ${JSON.stringify(cleanDue)}`);
      }
      lines.push(
        `created: ${(/* @__PURE__ */ new Date()).toISOString()}`,
        "---",
        "",
        `# ${title}`,
        ""
      );
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
    async function createHabit2(vault, { treePath, name, frequency = "daily", days = [], target = "" }) {
      const dir = validTreePath(treePath);
      const title = validateName(name, "Habit name");
      const freq = normalizeFrequency(frequency);
      const cleanDays = freq === "weekdays" ? normalizeDays(days) : [];
      if (freq === "weekdays" && !cleanDays.length) {
        throw new Error("Select at least one day of the week.");
      }
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
        `days: ${JSON.stringify(cleanDays)}`,
        `target: ${JSON.stringify(cleanTarget)}`,
        "last_watered: null",
        "water_log: []",
        'widgets: [{"id":"w_streak","title":"Streak","type":"streak"}]',
        `created: ${(/* @__PURE__ */ new Date()).toISOString()}`,
        "---",
        "",
        `# ${title}`,
        "",
        `Cadence: ${formatCadenceLabel(freq, cleanDays)}`,
        ""
      ];
      if (cleanTarget) lines.push(`Target: ${cleanTarget}`, "");
      return vault.create(filePath, lines.join("\n"));
    }
    async function updateHabitSchedule2(app, file, { frequency, days = [] }) {
      const freq = normalizeFrequency(frequency);
      const cleanDays = freq === "weekdays" ? normalizeDays(days) : [];
      if (freq === "weekdays" && !cleanDays.length) {
        throw new Error("Select at least one day of the week.");
      }
      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter.frequency = freq;
        frontmatter.days = cleanDays;
      });
      return { frequency: freq, days: cleanDays };
    }
    async function trashEntry(app, target) {
      if (!target) throw new Error("Entry not found.");
      if (typeof app.fileManager?.trashFile === "function") {
        await app.fileManager.trashFile(target);
        return;
      }
      if (typeof app.vault?.trash === "function") {
        await app.vault.trash(target, true);
        return;
      }
      if (typeof app.vault?.delete === "function") {
        await app.vault.delete(target, true);
        return;
      }
      throw new Error("Vault deletion is unavailable.");
    }
    async function deleteTree2(app, treePath) {
      const dir = validTreePath(treePath);
      const folder = app.vault.getAbstractFileByPath(dir);
      if (!isFolder(folder)) throw new Error("Tree folder not found.");
      await trashEntry(app, folder);
    }
    async function deleteGoalFile2(app, file) {
      if (!file || isFolder(file)) throw new Error("Goal file not found.");
      if (typeof file.path !== "string" || !file.path.startsWith(`${ROOT}/`) || file.path === WE_PATH || file.path.startsWith(`${INDEX_FOLDER}/`)) {
        throw new Error("Invalid goal file path.");
      }
      await trashEntry(app, file);
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
    function weekdayIdForDateKey(key) {
      const parsed = parseDateKey(key);
      if (!parsed) return null;
      return DAY_BY_JS_DAY.get(parsed.getUTCDay()) ?? null;
    }
    function isScheduledOnDate(frequency, days, dateKey) {
      const freq = normalizeFrequency(frequency);
      if (freq !== "weekdays") return true;
      const cleanDays = normalizeDays(days);
      if (!cleanDays.length) return false;
      const dayId = weekdayIdForDateKey(dateKey);
      return dayId ? cleanDays.includes(dayId) : false;
    }
    function isWateredInPeriod(lastWatered, waterLog, frequency, now = /* @__PURE__ */ new Date(), days = []) {
      const freq = normalizeFrequency(frequency);
      const todayKey = toDateKey(now);
      const dates = normalizeWaterLog(waterLog);
      if (typeof lastWatered === "string" && parseDateKey(lastWatered) && !dates.includes(lastWatered.trim())) {
        dates.push(lastWatered.trim());
      }
      if (freq === "weekdays") {
        if (dates.includes(todayKey)) return true;
        const cleanDays = normalizeDays(days);
        if (!cleanDays.length) return false;
        if (isScheduledOnDate("weekdays", cleanDays, todayKey)) {
          return false;
        }
        let cursor = shiftDateKey(todayKey, -1);
        for (let i = 0; i < 7 && cursor; i += 1) {
          if (isScheduledOnDate("weekdays", cleanDays, cursor)) {
            return dates.includes(cursor);
          }
          cursor = shiftDateKey(cursor, -1);
        }
        return false;
      }
      const currentPeriod = periodKeyFor(todayKey, freq);
      if (!currentPeriod) return false;
      return dates.some((key) => periodKeyFor(key, freq) === currentPeriod);
    }
    function mergeWaterDates(waterLog, lastWatered = null) {
      const valid = new Set(normalizeWaterLog(waterLog));
      if (typeof lastWatered === "string" && parseDateKey(lastWatered)) {
        valid.add(lastWatered.trim());
      }
      return Array.from(valid).sort();
    }
    function computeWeekdaysStreak(dates, days, todayKey) {
      const cleanDays = normalizeDays(days);
      if (!dates.length || !cleanDays.length) return 0;
      const logSet = new Set(dates);
      const daySet = new Set(cleanDays);
      const earliest = dates[0];
      let cursor = todayKey;
      let streak = 0;
      let skippedOpenToday = false;
      for (let steps = 0; steps < 36500 && cursor && cursor >= earliest; steps += 1) {
        const dayId = weekdayIdForDateKey(cursor);
        if (dayId && daySet.has(dayId)) {
          if (logSet.has(cursor)) {
            streak += 1;
            skippedOpenToday = true;
          } else if (cursor === todayKey && !skippedOpenToday) {
            skippedOpenToday = true;
          } else {
            break;
          }
        }
        cursor = shiftDateKey(cursor, -1);
      }
      return streak;
    }
    function computeWeekdaysBestStreak(dates, days, todayKey) {
      const cleanDays = normalizeDays(days);
      if (!dates.length || !cleanDays.length) return 0;
      const logSet = new Set(dates);
      const daySet = new Set(cleanDays);
      const end = dates[dates.length - 1] > todayKey ? dates[dates.length - 1] : todayKey;
      let cursor = dates[0];
      let run = 0;
      let best = 0;
      for (let steps = 0; steps < 36500 && cursor && cursor <= end; steps += 1) {
        const dayId = weekdayIdForDateKey(cursor);
        if (dayId && daySet.has(dayId)) {
          if (logSet.has(cursor)) {
            run += 1;
            if (run > best) best = run;
          } else if (cursor !== todayKey) {
            run = 0;
          }
        }
        cursor = shiftDateKey(cursor, 1);
      }
      return best;
    }
    function computePeriodBestStreak(periodsSet, freq) {
      if (!periodsSet.size) return 0;
      const sorted = Array.from(periodsSet).sort();
      let run = 0;
      let best = 0;
      let prev = null;
      for (const period of sorted) {
        if (prev && previousPeriodKey(period, freq) === prev) {
          run += 1;
        } else {
          run = 1;
        }
        if (run > best) best = run;
        prev = period;
      }
      return best;
    }
    function computeHabitStreak(waterLog, frequency, now = /* @__PURE__ */ new Date(), days = [], lastWatered = null) {
      const freq = normalizeFrequency(frequency);
      const dates = mergeWaterDates(waterLog, lastWatered);
      if (!dates.length) return 0;
      if (freq === "weekdays") {
        return computeWeekdaysStreak(dates, days, toDateKey(now));
      }
      const periods = new Set(dates.map((key) => periodKeyFor(key, freq)).filter(Boolean));
      const current = periodKeyFor(toDateKey(now), freq);
      const previous = previousPeriodKey(current, freq);
      let cursor = periods.has(current) ? current : periods.has(previous) ? previous : null;
      let streak = 0;
      while (cursor && periods.has(cursor)) {
        streak += 1;
        cursor = previousPeriodKey(cursor, freq);
      }
      return streak;
    }
    function shortDayLabel(dateKey) {
      const id = weekdayIdForDateKey(dateKey);
      if (!id) return dateKey;
      return WEEKDAYS[DAY_ORDER.get(id)].short;
    }
    function recentScheduledSlots(dates, freq, days, todayKey, count = 6) {
      const logSet = new Set(dates);
      if (freq === "weekdays") {
        const cleanDays = normalizeDays(days);
        if (!cleanDays.length) return [];
        const daySet = new Set(cleanDays);
        const slots2 = [];
        let cursor2 = todayKey;
        for (let i = 0; i < 60 && slots2.length < count && cursor2; i += 1) {
          const id = weekdayIdForDateKey(cursor2);
          if (id && daySet.has(id)) {
            slots2.unshift({
              key: cursor2,
              label: shortDayLabel(cursor2),
              completed: logSet.has(cursor2),
              isCurrent: cursor2 === todayKey
            });
          }
          cursor2 = shiftDateKey(cursor2, -1);
        }
        return slots2;
      }
      const periods = new Set(dates.map((key) => periodKeyFor(key, freq)).filter(Boolean));
      const slots = [];
      let cursor = periodKeyFor(todayKey, freq);
      for (let i = 0; i < count && cursor; i += 1) {
        let label = cursor;
        if (freq === "daily") label = shortDayLabel(cursor);
        else if (freq === "weekly") label = cursor.slice(5);
        else if (freq === "monthly") label = cursor.slice(5);
        slots.unshift({
          key: cursor,
          label,
          completed: periods.has(cursor),
          isCurrent: i === 0
        });
        cursor = previousPeriodKey(cursor, freq);
      }
      return slots;
    }
    function streakUnit(freq, count) {
      if (freq === "weekly") return count === 1 ? "week" : "weeks";
      if (freq === "monthly") return count === 1 ? "month" : "months";
      if (freq === "weekdays") return count === 1 ? "scheduled day" : "scheduled days";
      return count === 1 ? "day" : "days";
    }
    function computeHabitStreakDetails(waterLog, frequency, now = /* @__PURE__ */ new Date(), days = [], lastWatered = null) {
      const freq = normalizeFrequency(frequency);
      const cleanDays = normalizeDays(days);
      const dates = mergeWaterDates(waterLog, lastWatered);
      const todayKey = toDateKey(now);
      const streak = computeHabitStreak(dates, freq, now, cleanDays, lastWatered);
      let bestStreak = 0;
      if (dates.length) {
        if (freq === "weekdays") {
          bestStreak = computeWeekdaysBestStreak(dates, cleanDays, todayKey);
        } else {
          const periods = new Set(dates.map((key) => periodKeyFor(key, freq)).filter(Boolean));
          bestStreak = computePeriodBestStreak(periods, freq);
        }
      }
      if (streak > bestStreak) bestStreak = streak;
      const wateredToday = dates.includes(todayKey);
      const wateredPeriod = isWateredInPeriod(lastWatered, dates, freq, now, cleanDays);
      const dueToday = isScheduledOnDate(freq, cleanDays, todayKey);
      let statusLabel = "Due today";
      if (wateredToday) statusLabel = "Watered today";
      else if (freq === "weekly" && wateredPeriod) statusLabel = "Done this week";
      else if (freq === "monthly" && wateredPeriod) statusLabel = "Done this month";
      else if (!dueToday) statusLabel = "Rest day";
      else if (freq === "weekly") statusLabel = "Due this week";
      else if (freq === "monthly") statusLabel = "Due this month";
      return {
        streak,
        bestStreak,
        unit: streakUnit(freq, streak),
        cadenceLabel: formatCadenceLabel(freq, cleanDays),
        statusLabel,
        recentSlots: recentScheduledSlots(dates, freq, cleanDays, todayKey, 6)
      };
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
      WEEKDAYS,
      STYLES,
      isFolder,
      validateName,
      ensureFolder,
      ensureStructure: ensureStructure2,
      validTreePath,
      normalizeModule,
      normalizeFrequency,
      normalizeDays,
      normalizeStyle,
      formatCadenceLabel,
      formatCadenceShort,
      createTree: createTree2,
      createSubgoal: createSubgoal2,
      createHabit: createHabit2,
      updateHabitSchedule: updateHabitSchedule2,
      deleteTree: deleteTree2,
      deleteGoalFile: deleteGoalFile2,
      toDateKey,
      parseDateKey,
      periodKeyFor,
      weekdayIdForDateKey,
      isScheduledOnDate,
      normalizeWaterLog,
      mergeWaterDates,
      isWateredInPeriod,
      computeHabitStreak,
      computeHabitStreakDetails,
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
      normalizeDays,
      normalizeStyle,
      formatCadenceLabel,
      formatCadenceShort,
      isScheduledOnDate,
      normalizeWaterLog,
      isWateredInPeriod,
      computeHabitStreak,
      toDateKey,
      parseDateKey
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
        const days = normalizeDays(fm?.days);
        const waterLog = normalizeWaterLog(fm?.water_log);
        const lastWatered = typeof fm?.last_watered === "string" && fm.last_watered.trim() ? fm.last_watered.trim() : waterLog.length ? waterLog[waterLog.length - 1] : null;
        const isDueToday = isScheduledOnDate(frequency, days, today);
        const wateredInPeriod = isWateredInPeriod(lastWatered, waterLog, frequency, now, days);
        const wateredToday = waterLog.includes(today) || lastWatered === today;
        const streak = computeHabitStreak(
          lastWatered && !waterLog.includes(lastWatered) ? [...waterLog, lastWatered] : waterLog,
          frequency,
          now,
          days
        );
        return {
          file,
          title: readString(fm, "title", stripExt(file)),
          frequency,
          days,
          cadenceLabel: formatCadenceLabel(frequency, days),
          cadenceShort: formatCadenceShort(frequency, days),
          isDueToday,
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
      const dueHabits = habits.filter((item) => item.isDueToday);
      const dueTotal = dueHabits.length;
      const dueWatered = dueHabits.filter((item) => item.wateredInPeriod).length;
      const habitTotal = dueTotal > 0 ? dueTotal : habits.length;
      const habitWatered = dueTotal > 0 ? dueWatered : habits.filter((item) => item.wateredInPeriod).length;
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
      if (habits.length > 0) {
        if (dueTotal === 0) {
          hydrationState = habitWatered > 0 ? "hydrated" : "calm";
        } else if (dueWatered === dueTotal) {
          hydrationState = "hydrated";
        } else if (dueWatered > 0) {
          hydrationState = "partial";
        } else {
          hydrationState = "thirsty";
        }
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
            endless: Boolean(fm?.endless),
            due: fm?.endless ? "" : typeof fm?.due === "string" && parseDateKey(fm.due) ? fm.due.trim() : "",
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

// src/schedule-picker.js
var require_schedule_picker = __commonJS({
  "src/schedule-picker.js"(exports2, module2) {
    var { WEEKDAYS, normalizeFrequency, normalizeDays, formatCadenceLabel } = require_storage();
    var CADENCE_OPTIONS = [
      { id: "daily", label: "Daily" },
      { id: "weekdays", label: "Specific days" },
      { id: "weekly", label: "Weekly" },
      { id: "monthly", label: "Monthly" }
    ];
    function renderSchedulePicker(container, { frequency = "daily", days = [], onChange } = {}) {
      let currentFreq = normalizeFrequency(frequency);
      let currentDays = new Set(normalizeDays(days));
      const root = container.createDiv({ cls: "iter-schedule-picker" });
      const cadenceRow = root.createDiv({ cls: "iter-cadence-pills", attr: { role: "radiogroup", "aria-label": "Habit repetitivity" } });
      const weekdayWrap = root.createDiv({ cls: "iter-weekday-wrap" });
      const weekdayGrid = weekdayWrap.createDiv({ cls: "iter-weekday-grid", attr: { role: "group", "aria-label": "Days of the week" } });
      const summaryEl = weekdayWrap.createDiv({ cls: "iter-schedule-summary" });
      const cadenceButtons = /* @__PURE__ */ new Map();
      const dayButtons = /* @__PURE__ */ new Map();
      const snapshot = () => ({
        frequency: currentFreq,
        days: currentFreq === "weekdays" ? normalizeDays(Array.from(currentDays)) : []
      });
      const syncUi = () => {
        for (const [id, btn] of cadenceButtons) {
          const active = id === currentFreq;
          btn.toggleClass?.("is-active", active);
          if (!btn.toggleClass) {
            btn.className = `iter-cadence-pill${active ? " is-active" : ""}`;
          }
          btn.setAttribute("aria-checked", String(active));
        }
        const showDays = currentFreq === "weekdays";
        weekdayWrap.style.display = showDays ? "" : "none";
        const orderedDays = normalizeDays(Array.from(currentDays));
        for (const [id, btn] of dayButtons) {
          const selected = currentDays.has(id);
          btn.toggleClass?.("is-selected", selected);
          if (!btn.toggleClass) {
            btn.className = `iter-weekday-pill${selected ? " is-selected" : ""}`;
          }
          btn.setAttribute("aria-pressed", String(selected));
        }
        if (showDays) {
          summaryEl.textContent = orderedDays.length ? `Water on ${formatCadenceLabel("weekdays", orderedDays)}` : "Select one or more days of the week";
          summaryEl.toggleClass?.("is-empty", orderedDays.length === 0);
        }
      };
      for (const option of CADENCE_OPTIONS) {
        const btn = cadenceRow.createEl("button", {
          text: option.label,
          type: "button",
          cls: "iter-cadence-pill",
          attr: { role: "radio" }
        });
        cadenceButtons.set(option.id, btn);
        btn.addEventListener("click", () => {
          if (currentFreq === option.id) return;
          currentFreq = option.id;
          syncUi();
          onChange?.(snapshot());
        });
      }
      for (const day of WEEKDAYS) {
        const btn = weekdayGrid.createEl("button", {
          text: day.label,
          type: "button",
          cls: "iter-weekday-pill",
          attr: { title: day.full, "aria-label": day.full }
        });
        dayButtons.set(day.id, btn);
        btn.addEventListener("click", () => {
          if (currentDays.has(day.id)) currentDays.delete(day.id);
          else currentDays.add(day.id);
          syncUi();
          onChange?.(snapshot());
        });
      }
      syncUi();
      return {
        getValue: snapshot,
        setValue(nextFreq, nextDays = []) {
          currentFreq = normalizeFrequency(nextFreq);
          currentDays = new Set(normalizeDays(nextDays));
          syncUi();
        }
      };
    }
    module2.exports = {
      CADENCE_OPTIONS,
      renderSchedulePicker
    };
  }
});

// src/modals.js
var require_modals = __commonJS({
  "src/modals.js"(exports2, module2) {
    var { Modal, Notice: Notice2 } = require("obsidian");
    var { MODULES, STYLES } = require_storage();
    var { renderSchedulePicker } = require_schedule_picker();
    var STYLE_LABELS = {
      auto: "Auto (from module)",
      canopy: "Canopy",
      bonsai: "Bonsai",
      pine: "Pine",
      willow: "Willow"
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
        let endless = false;
        const completionField = form.createDiv({ cls: "iter-modal-field" });
        completionField.createEl("span", { text: "Expected completion", cls: "iter-modal-label" });
        const horizonPills = completionField.createDiv({ cls: "iter-cadence-pills" });
        const targetBtn = horizonPills.createEl("button", {
          text: "Target date",
          type: "button",
          cls: "iter-cadence-pill is-active"
        });
        const endlessBtn = horizonPills.createEl("button", {
          text: "Never-ending",
          type: "button",
          cls: "iter-cadence-pill"
        });
        const dueWrap = completionField.createDiv({ cls: "iter-tree-due-slot" });
        const dueInput = dueWrap.createEl("input", {
          type: "date",
          cls: "iter-modal-input"
        });
        const endlessHint = completionField.createDiv({
          text: "Grows continuously through subgoals and habits without an end date.",
          cls: "iter-schedule-summary"
        });
        const syncHorizon = () => {
          targetBtn.toggleClass("is-active", !endless);
          endlessBtn.toggleClass("is-active", endless);
          targetBtn.setAttribute("aria-pressed", String(!endless));
          endlessBtn.setAttribute("aria-pressed", String(endless));
          dueWrap.style.display = endless ? "none" : "";
          endlessHint.style.display = endless ? "" : "none";
        };
        targetBtn.addEventListener("click", () => {
          endless = false;
          syncHorizon();
        });
        endlessBtn.addEventListener("click", () => {
          endless = true;
          dueInput.value = "";
          syncHorizon();
        });
        syncHorizon();
        this.addActions(
          form,
          () => ({
            name: nameInput.value,
            module: moduleSelect.value,
            style: styleSelect.value,
            goal: goalInput.value,
            endless,
            due: endless ? "" : dueInput.value
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
        const treeSelect = this.addField(form, "Tree", (parent) => {
          const select = parent.createEl("select", { cls: "iter-modal-select" });
          for (const tree of this.trees) {
            const option = select.createEl("option", { value: tree.path, text: tree.title });
            if (tree.path === this.initialTreePath) option.selected = true;
          }
          return select;
        });
        const nameInput = this.addField(form, "Habit", (parent) => {
          const input = parent.createEl("input", { type: "text", placeholder: "e.g. Go to the Gym", cls: "iter-modal-input" });
          input.required = true;
          return input;
        });
        const scheduleField = form.createDiv({ cls: "iter-modal-field" });
        scheduleField.createEl("span", { text: "Repetitivity", cls: "iter-modal-label" });
        const picker = renderSchedulePicker(scheduleField, { frequency: "daily", days: [] });
        const targetInput = this.addField(
          form,
          "Daily/period target (optional)",
          (parent) => parent.createEl("input", { type: "text", placeholder: "e.g. 3000 kcal / 10 new words", cls: "iter-modal-input" })
        );
        this.addActions(
          form,
          () => {
            const schedule = picker.getValue();
            return {
              treePath: treeSelect.value,
              frequency: schedule.frequency,
              days: schedule.days,
              name: nameInput.value,
              target: targetInput.value
            };
          },
          nameInput
        );
        nameInput.focus();
      }
    };
    var EditHabitScheduleModal2 = class extends BaseIterModal {
      constructor(app, { title, frequency, days, onSubmit }) {
        super(app, `Repetitivity \xB7 ${title}`, "Save schedule", onSubmit);
        this.frequency = frequency;
        this.days = days;
      }
      onOpen() {
        const form = this.buildForm(this.contentEl);
        const scheduleField = form.createDiv({ cls: "iter-modal-field" });
        scheduleField.createEl("span", { text: "Watering schedule", cls: "iter-modal-label" });
        const picker = renderSchedulePicker(scheduleField, {
          frequency: this.frequency,
          days: this.days
        });
        this.addActions(form, () => picker.getValue());
      }
    };
    var ConfirmDeleteModal2 = class extends Modal {
      constructor(app, { title, message, confirmLabel = "Delete", onConfirm }) {
        super(app);
        this.modalTitle = title;
        this.message = message;
        this.confirmLabel = confirmLabel;
        this.onConfirm = onConfirm;
        this.submitting = false;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("iter-modal");
        contentEl.createEl("h2", { text: this.modalTitle, cls: "iter-modal-title" });
        contentEl.createEl("p", { text: this.message, cls: "iter-modal-message" });
        const actions = contentEl.createDiv({ cls: "iter-modal-actions" });
        const cancel = actions.createEl("button", { text: "Cancel", type: "button", cls: "iter-btn-ghost" });
        cancel.addEventListener("click", () => this.close());
        const confirm = actions.createEl("button", {
          text: this.confirmLabel,
          type: "button",
          cls: "mod-warning"
        });
        confirm.addEventListener("click", async () => {
          if (this.submitting) return;
          this.submitting = true;
          confirm.disabled = true;
          try {
            await this.onConfirm();
            this.close();
          } catch (error) {
            new Notice2(error instanceof Error ? error.message : String(error));
          } finally {
            this.submitting = false;
            confirm.disabled = false;
          }
        });
        confirm.focus();
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = {
      CreateTreeModal: CreateTreeModal2,
      CreateSubgoalModal: CreateSubgoalModal2,
      CreateHabitModal: CreateHabitModal2,
      EditHabitScheduleModal: EditHabitScheduleModal2,
      ConfirmDeleteModal: ConfirmDeleteModal2
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
        if (!file) return false;
        const recent = this.app.workspace.getMostRecentLeaf?.();
        if (this.plugin?.goalViewType && recent?.view?.getViewType?.() === this.plugin.goalViewType && recent?.view?.file?.path === file.path) {
          return true;
        }
        const active = this.app.workspace.getActiveFile?.();
        return Boolean(active && active.path === file.path);
      }
      isGardenActive() {
        const recent = this.app.workspace.getMostRecentLeaf?.();
        return Boolean(this.plugin?.gardenViewType && recent?.view?.getViewType?.() === this.plugin.gardenViewType);
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
      showTreeMenu(event, tree, { allowDelete = true } = {}) {
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
            (item) => item.setTitle("Open goal view").setIcon("layout-dashboard").onClick(() => void this.plugin.openGoal(tree.indexFile))
          );
          menu.addItem(
            (item) => item.setTitle("Open markdown").setIcon("file-text").onClick(() => void this.plugin.openFile(tree.indexFile))
          );
        }
        if (allowDelete) {
          menu.addSeparator();
          menu.addItem((item) => {
            item.setTitle("Delete").setIcon("trash").onClick(() => this.plugin.promptDeleteTree(tree));
            item.setWarning?.(true);
          });
        }
        menu.showAtMouseEvent(event);
      }
      showGoalItemMenu(event, file, extraActions = [], onDelete = null) {
        const menu = new Menu();
        menu.addItem(
          (item) => item.setTitle("Open goal view").setIcon("layout-dashboard").onClick(() => void this.plugin.openGoal(file))
        );
        menu.addItem(
          (item) => item.setTitle("Open markdown").setIcon("file-text").onClick(() => void this.plugin.openFile(file))
        );
        if (extraActions.length) {
          menu.addSeparator();
          for (const action of extraActions) {
            menu.addItem((item) => item.setTitle(action.label).setIcon(action.icon).onClick(action.run));
          }
        }
        if (onDelete) {
          menu.addSeparator();
          menu.addItem((item) => {
            item.setTitle("Delete").setIcon("trash").onClick(onDelete);
            item.setWarning?.(true);
          });
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
          if (tree.indexFile) void this.plugin.openGoal(tree.indexFile);
          else void this.plugin.openGarden(tree.path);
        });
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.showTreeMenu(event, tree, { allowDelete: true });
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
          (event) => this.showTreeMenu(event, tree, { allowDelete: false }),
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
        titleBtn.addEventListener("click", () => void this.plugin.openGoal(subgoal.file));
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.showGoalItemMenu(
            event,
            subgoal.file,
            [
              {
                label: subgoal.done ? "Mark incomplete" : "Mark done",
                icon: subgoal.done ? "circle" : "check-circle-2",
                run: async () => {
                  await toggleSubgoal(this.app, subgoal.file);
                  this.plugin.scheduleRefresh();
                }
              }
            ],
            () => this.plugin.promptDeleteGoalItem("goal", subgoal)
          );
        });
      }
      renderHabit(parent, habit) {
        const resting = !habit.isDueToday && !habit.wateredToday;
        const row = parent.createDiv({
          cls: `iter-row iter-habit-row${habit.wateredInPeriod ? " is-watered" : ""}${resting ? " is-rest" : ""}`
        });
        const waterBtn = iconButton(
          row,
          "droplet",
          habit.wateredToday ? `Undo today's watering for "${habit.title}"` : resting ? `Rest day (${habit.cadenceLabel}) \u2014 click to water "${habit.title}" anyway` : `Water "${habit.title}"`,
          async () => {
            try {
              const watered = await waterHabit(this.app, habit.file);
              new Notice2(watered ? `Watered ${habit.title}` : `Unwatered ${habit.title} for today`);
              this.plugin.scheduleRefresh();
            } catch (error) {
              new Notice2(error?.message || "Could not water habit.");
            }
          },
          `iter-water-btn${habit.wateredInPeriod ? " is-watered" : ""}${resting ? " is-rest" : ""}`
        );
        waterBtn.setAttribute("aria-pressed", String(habit.wateredToday));
        const titleBtn = row.createEl("button", { cls: "iter-row-title", type: "button" });
        titleBtn.setAttribute(
          "title",
          habit.target ? `${habit.title} (${habit.cadenceLabel}) \xB7 ${habit.target}` : `${habit.title} (${habit.cadenceLabel})`
        );
        if (this.isActiveFile(habit.file)) titleBtn.setAttribute("aria-current", "page");
        titleBtn.createSpan({ text: habit.title, cls: "iter-row-name" });
        titleBtn.addEventListener("click", () => void this.plugin.openGoal(habit.file));
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.showGoalItemMenu(
            event,
            habit.file,
            [
              {
                label: habit.wateredToday ? "Undo today's watering" : "Water now",
                icon: "droplet",
                run: async () => {
                  await waterHabit(this.app, habit.file);
                  this.plugin.scheduleRefresh();
                }
              },
              {
                label: "Edit repetitivity",
                icon: "calendar-days",
                run: () => this.plugin.promptEditHabitSchedule(habit)
              }
            ],
            () => this.plugin.promptDeleteGoalItem("habit", habit)
          );
        });
        row.createSpan({
          text: habit.cadenceShort,
          cls: "iter-cadence-badge",
          attr: { title: `${habit.cadenceLabel} habit` }
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
            const resting = !habit.isDueToday && !habit.wateredToday;
            const chip = waterBar.createEl("button", {
              cls: `iter-water-chip${habit.wateredInPeriod ? " is-watered" : ""}${resting ? " is-rest" : ""}`,
              type: "button",
              attr: {
                "aria-pressed": String(habit.wateredToday),
                title: habit.wateredToday ? `Undo today's water: ${habit.title}` : resting ? `Rest day (${habit.cadenceLabel}) \u2014 click to water ${habit.title}` : `Water ${habit.title} (${habit.cadenceLabel})`
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
        if (tree.endless) {
          heading.createSpan({
            text: "Never-ending",
            cls: "iter-kind-pill is-endless",
            attr: { title: "Grows continuously without an expected completion date" }
          });
        }
        const topActions = top.createDiv({ cls: "iter-inspector-top-actions" });
        if (tree.indexFile) {
          const noteBtn = topActions.createEl("button", { cls: "iter-ghost-action", type: "button" });
          const noteIcon = noteBtn.createSpan({ cls: "iter-btn-icon" });
          setIcon(noteIcon, "target");
          noteBtn.createSpan({ text: "Open goal" });
          noteBtn.addEventListener("click", () => void this.plugin.openGoal(tree.indexFile));
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
            textBtn.addEventListener("click", () => void this.plugin.openGoal(sub.file));
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
            const resting = !habit.isDueToday && !habit.wateredToday;
            const row = list.createDiv({ cls: `iter-detail-row${habit.wateredInPeriod ? " is-watered" : ""}` });
            const textBtn = row.createEl("button", { cls: "iter-detail-link", type: "button" });
            textBtn.createSpan({ text: habit.title, cls: "iter-detail-title" });
            const subMeta = [habit.cadenceLabel];
            if (habit.streak > 0) subMeta.push(`${habit.streak} streak`);
            if (habit.target) subMeta.push(habit.target);
            textBtn.createSpan({ text: subMeta.join(" \xB7 "), cls: "iter-detail-sub" });
            textBtn.addEventListener("click", () => void this.plugin.openGoal(habit.file));
            const waterBtn = row.createEl("button", {
              cls: `iter-water-action${habit.wateredInPeriod ? " is-watered" : ""}${resting ? " is-rest" : ""}`,
              type: "button",
              attr: { "aria-pressed": String(habit.wateredToday) }
            });
            const drop = waterBtn.createSpan({ cls: "iter-btn-icon" });
            setIcon(drop, "droplet");
            waterBtn.createSpan({
              text: habit.wateredToday ? "Watered" : habit.wateredInPeriod ? "Done" : resting ? "Rest day" : "Water"
            });
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

// src/data-model.js
var require_data_model = __commonJS({
  "src/data-model.js"(exports2, module2) {
    var { ROOT, parseDateKey, toDateKey, normalizeFrequency, normalizeDays, mergeWaterDates } = require_storage();
    var DATASET_TYPES = [
      { id: "number_time", label: "Number & Time" },
      { id: "text", label: "Text List" },
      { id: "note", label: "Notes" },
      { id: "note_time", label: "Notes & Time" }
    ];
    var WIDGET_TYPES = [
      { id: "stat", label: "Metric Stat" },
      { id: "goal_bar", label: "Goal Comparison Bar" },
      { id: "chart", label: "Time Graph" },
      { id: "note_navigator", label: "Note Navigator" },
      { id: "streak", label: "Habit Streak" }
    ];
    var STAT_AGGS = [
      { id: "count", label: "Count" },
      { id: "sum", label: "Sum" },
      { id: "average", label: "Average" },
      { id: "latest", label: "Latest" },
      { id: "max", label: "Max" },
      { id: "min", label: "Min" }
    ];
    var BAR_MODES = [
      { id: "latest", label: "Latest entry" },
      { id: "max", label: "Best / Max" },
      { id: "sum", label: "Total sum" },
      { id: "count", label: "Entry count" }
    ];
    var CHART_VARIANTS = [
      { id: "line", label: "Line" },
      { id: "bar", label: "Bar" }
    ];
    function generateId(prefix = "id") {
      return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    }
    function stripMd(name) {
      return typeof name === "string" && name.endsWith(".md") ? name.slice(0, -3) : String(name || "");
    }
    function normalizeDatasetType(type) {
      return DATASET_TYPES.some((item) => item.id === type) ? type : "number_time";
    }
    function normalizeWidgetType(type) {
      return WIDGET_TYPES.some((item) => item.id === type) ? type : "stat";
    }
    function normalizeStatAgg(agg) {
      return STAT_AGGS.some((item) => item.id === agg) ? agg : "latest";
    }
    function normalizeBarMode(mode) {
      return BAR_MODES.some((item) => item.id === mode) ? mode : "latest";
    }
    function normalizeChartVariant(variant) {
      return CHART_VARIANTS.some((item) => item.id === variant) ? variant : "line";
    }
    function toFiniteNumber(raw) {
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      if (typeof raw === "string" && raw.trim() !== "") {
        const n = Number(raw.trim());
        if (Number.isFinite(n)) return n;
      }
      return null;
    }
    function normalizeEntry(type, raw) {
      if (raw === null || raw === void 0) return null;
      if (type === "number_time") {
        if (typeof raw !== "object") return null;
        const value = toFiniteNumber(raw.value);
        const date = typeof raw.date === "string" && parseDateKey(raw.date) ? raw.date.trim() : toDateKey();
        if (value === null) return null;
        return { value, date };
      }
      if (type === "text") {
        const value = typeof raw === "string" ? raw.trim() : typeof raw?.value === "string" ? raw.value.trim() : "";
        if (!value) return null;
        const date = typeof raw?.date === "string" && parseDateKey(raw.date) ? raw.date.trim() : null;
        return date ? { value, date } : { value };
      }
      if (type === "note") {
        const path = typeof raw === "string" ? raw.trim() : typeof raw?.path === "string" ? raw.path.trim() : "";
        if (!path) return null;
        return { path };
      }
      if (type === "note_time") {
        if (typeof raw !== "object") return null;
        const path = typeof raw.path === "string" ? raw.path.trim() : "";
        if (!path) return null;
        const date = typeof raw.date === "string" && parseDateKey(raw.date) ? raw.date.trim() : toDateKey();
        const value = toFiniteNumber(raw.value);
        return value !== null ? { path, date, value } : { path, date };
      }
      return null;
    }
    function normalizeDataset(raw) {
      if (!raw || typeof raw !== "object") return null;
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!name) return null;
      const type = normalizeDatasetType(raw.type);
      const entries = Array.isArray(raw.entries) ? raw.entries.map((item) => normalizeEntry(type, item)).filter(Boolean) : [];
      return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : generateId("ds"),
        name,
        type,
        unit: typeof raw.unit === "string" ? raw.unit.trim() : "",
        metricKey: typeof raw.metricKey === "string" && raw.metricKey.trim() ? raw.metricKey.trim() : "score",
        entries
      };
    }
    function normalizeWidget(raw) {
      if (!raw || typeof raw !== "object") return null;
      const type = normalizeWidgetType(raw.type);
      const datasetId = typeof raw.datasetId === "string" ? raw.datasetId.trim() : "";
      if (type !== "streak" && !datasetId) return null;
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : generateId("w"),
        title,
        type,
        datasetId,
        agg: normalizeStatAgg(raw.agg),
        mode: normalizeBarMode(raw.mode),
        target: toFiniteNumber(raw.target),
        variant: normalizeChartVariant(raw.variant),
        metricKey: typeof raw.metricKey === "string" && raw.metricKey.trim() ? raw.metricKey.trim() : ""
      };
    }
    function resolveGoalKind(file, fm) {
      if (file?.name === "_tree.md") return "tree";
      if (file?.path?.includes("/subgoals/")) return "subgoal";
      if (file?.path?.includes("/habits/")) return "habit";
      const type = typeof fm?.type === "string" ? fm.type.trim() : "";
      if (type === "tree" || type === "subgoal" || type === "habit") return type;
      return "goal";
    }
    function resolveParentTreePath(filePath) {
      if (typeof filePath !== "string" || !filePath.startsWith(`${ROOT}/`)) return null;
      const rest = filePath.slice(ROOT.length + 1);
      const treeName = rest.split("/")[0];
      if (!treeName || treeName.startsWith("_")) return null;
      return `${ROOT}/${treeName}`;
    }
    function readGoalDocument(app, file) {
      const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const kind = resolveGoalKind(file, fm);
      const treePath = resolveParentTreePath(file?.path);
      const parentTreeFile = treePath ? app.vault.getAbstractFileByPath(`${treePath}/_tree.md`) : null;
      const title = typeof fm.title === "string" && fm.title.trim() ? fm.title.trim() : stripMd(file.name);
      const description = typeof fm.description === "string" && fm.description.trim() ? fm.description.trim() : typeof fm.goal === "string" ? fm.goal.trim() : "";
      const due = typeof fm.due === "string" && parseDateKey(fm.due) ? fm.due.trim() : "";
      const target = typeof fm.target === "string" ? fm.target.trim() : "";
      const datasets = Array.isArray(fm.datasets) ? fm.datasets.map(normalizeDataset).filter(Boolean) : [];
      const widgets = Array.isArray(fm.widgets) ? fm.widgets.map(normalizeWidget).filter(Boolean) : [];
      return {
        file,
        kind,
        treePath,
        parentTreeFile: parentTreeFile && parentTreeFile.path !== file.path ? parentTreeFile : null,
        title,
        description,
        due,
        endless: kind === "tree" && Boolean(fm.endless),
        target,
        done: Boolean(fm.done),
        frequency: normalizeFrequency(fm.frequency),
        days: normalizeDays(fm.days),
        waterLog: mergeWaterDates(fm.water_log),
        lastWatered: typeof fm.last_watered === "string" && fm.last_watered.trim() ? fm.last_watered.trim() : null,
        module: typeof fm.module === "string" ? fm.module : "general",
        datasets,
        widgets
      };
    }
    function resolveNoteFile(app, pathOrLink, sourcePath = "") {
      if (!pathOrLink) return null;
      const direct = app.vault.getAbstractFileByPath(pathOrLink);
      if (direct && !Array.isArray(direct.children)) return direct;
      return app.metadataCache.getFirstLinkpathDest?.(pathOrLink, sourcePath) ?? null;
    }
    function resolveDatasetEntries(app, dataset, sourcePath = "") {
      return dataset.entries.map((entry, index) => {
        if (dataset.type === "number_time") {
          return { index, date: entry.date, value: entry.value, noteFile: null, label: `${entry.value}${dataset.unit ? ` ${dataset.unit}` : ""}` };
        }
        if (dataset.type === "text") {
          return { index, date: entry.date ?? null, value: null, noteFile: null, label: entry.value };
        }
        if (dataset.type === "note") {
          const noteFile = resolveNoteFile(app, entry.path, sourcePath);
          const name = noteFile ? stripMd(noteFile.name) : stripMd(entry.path.split("/").pop());
          return { index, date: null, value: null, noteFile, path: noteFile?.path ?? entry.path, label: name };
        }
        if (dataset.type === "note_time") {
          const noteFile = resolveNoteFile(app, entry.path, sourcePath);
          const fm = noteFile ? app.metadataCache.getFileCache(noteFile)?.frontmatter : null;
          const key = dataset.metricKey || "score";
          const fmVal = toFiniteNumber(fm?.[key]);
          const value = fmVal !== null ? fmVal : toFiniteNumber(entry.value);
          const name = noteFile ? stripMd(noteFile.name) : stripMd(entry.path.split("/").pop());
          return { index, date: entry.date, value, noteFile, path: noteFile?.path ?? entry.path, label: name };
        }
        return { index, date: null, value: null, noteFile: null, label: "" };
      });
    }
    function resolveNumericSeries(app, dataset, sourcePath = "", metricOverride = "") {
      const effectiveDataset = metricOverride ? { ...dataset, metricKey: metricOverride } : dataset;
      const resolved = resolveDatasetEntries(app, effectiveDataset, sourcePath);
      const timed = resolved.filter((item) => item.value !== null && Number.isFinite(item.value));
      if (dataset.type === "number_time" || dataset.type === "note_time") {
        timed.sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.index - b.index);
      }
      return timed;
    }
    function formatNumber(num) {
      if (!Number.isFinite(num)) return "\u2014";
      const rounded = Math.round(num * 100) / 100;
      return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toLocaleString(void 0, { maximumFractionDigits: 2 });
    }
    function computeStat(app, dataset, agg, sourcePath = "", metricOverride = "") {
      const normalizedAgg = normalizeStatAgg(agg);
      if (normalizedAgg === "count") {
        return {
          value: dataset.entries.length,
          display: formatNumber(dataset.entries.length),
          unit: "",
          count: dataset.entries.length
        };
      }
      const points = resolveNumericSeries(app, dataset, sourcePath, metricOverride);
      if (!points.length) {
        return { value: null, display: "\u2014", unit: dataset.unit, count: 0 };
      }
      let value = null;
      if (normalizedAgg === "sum") value = points.reduce((acc, p) => acc + p.value, 0);
      else if (normalizedAgg === "average") value = points.reduce((acc, p) => acc + p.value, 0) / points.length;
      else if (normalizedAgg === "latest") value = points[points.length - 1].value;
      else if (normalizedAgg === "max") value = Math.max(...points.map((p) => p.value));
      else if (normalizedAgg === "min") value = Math.min(...points.map((p) => p.value));
      return {
        value,
        display: formatNumber(value),
        unit: dataset.unit,
        count: points.length
      };
    }
    function computeGoalBar(app, dataset, mode, target, sourcePath = "", metricOverride = "") {
      const normalizedMode = normalizeBarMode(mode);
      const stat = computeStat(app, dataset, normalizedMode, sourcePath, metricOverride);
      const current = stat.value ?? 0;
      const numericTarget = toFiniteNumber(target);
      const ratio = numericTarget && numericTarget > 0 ? current / numericTarget : 0;
      const rawPercent = numericTarget && numericTarget > 0 ? Math.round(ratio * 100) : 0;
      const fillPercent = Math.max(0, Math.min(100, rawPercent));
      const unit = normalizedMode === "count" ? "" : dataset.unit;
      return {
        current: stat.value,
        currentDisplay: stat.value === null ? "\u2014" : formatNumber(stat.value),
        target: numericTarget,
        targetDisplay: numericTarget === null ? "\u2014" : formatNumber(numericTarget),
        rawPercent,
        fillPercent,
        unit
      };
    }
    function formatDueStatus(due, now = /* @__PURE__ */ new Date()) {
      const parsedDue = parseDateKey(due);
      if (!parsedDue) return null;
      const todayStr = toDateKey(now);
      const parsedToday = parseDateKey(todayStr);
      const diffDays = Math.round((parsedDue.getTime() - parsedToday.getTime()) / 864e5);
      const formatted = parsedDue.toLocaleDateString(void 0, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
      if (diffDays < 0) return { formatted, badge: `${Math.abs(diffDays)}d overdue`, tone: "overdue" };
      if (diffDays === 0) return { formatted, badge: "Due today", tone: "today" };
      if (diffDays <= 7) return { formatted, badge: `${diffDays}d left`, tone: "soon" };
      return { formatted, badge: `${diffDays}d left`, tone: "calm" };
    }
    async function updateGoalMeta(app, file, { description, due, endless }) {
      await app.fileManager.processFrontMatter(file, (fm) => {
        if (description !== void 0) {
          const clean = String(description).trim();
          fm.description = clean;
          if (file.name === "_tree.md") fm.goal = clean;
        }
        if (endless !== void 0 && file.name === "_tree.md") {
          fm.endless = Boolean(endless);
          if (fm.endless) fm.due = "";
        }
        if (due !== void 0 && !(file.name === "_tree.md" && fm.endless)) {
          const cleanDue = String(due).trim();
          fm.due = parseDateKey(cleanDue) ? cleanDue : "";
        }
      });
    }
    async function addDataset(app, file, { name, type, unit = "", metricKey = "score" }) {
      const cleanName = typeof name === "string" ? name.trim() : "";
      if (!cleanName) throw new Error("Dataset name is required.");
      const dataset = {
        id: generateId("ds"),
        name: cleanName,
        type: normalizeDatasetType(type),
        unit: typeof unit === "string" ? unit.trim() : "",
        metricKey: typeof metricKey === "string" && metricKey.trim() ? metricKey.trim() : "score",
        entries: []
      };
      await app.fileManager.processFrontMatter(file, (fm) => {
        const existing = Array.isArray(fm.datasets) ? fm.datasets : [];
        fm.datasets = [...existing, dataset];
      });
      return dataset;
    }
    async function removeDataset(app, file, datasetId) {
      await app.fileManager.processFrontMatter(file, (fm) => {
        fm.datasets = Array.isArray(fm.datasets) ? fm.datasets.filter((item) => item?.id !== datasetId) : [];
        if (Array.isArray(fm.widgets)) {
          fm.widgets = fm.widgets.filter((w) => w?.datasetId !== datasetId);
        }
      });
    }
    async function addDatasetEntry(app, file, datasetId, rawEntry) {
      let added = null;
      await app.fileManager.processFrontMatter(file, (fm) => {
        if (!Array.isArray(fm.datasets)) throw new Error("No datasets found on this goal.");
        const ds = fm.datasets.find((item) => item?.id === datasetId);
        if (!ds) throw new Error("Dataset not found.");
        const entry = normalizeEntry(normalizeDatasetType(ds.type), rawEntry);
        if (!entry) throw new Error("Invalid entry value.");
        if (!Array.isArray(ds.entries)) ds.entries = [];
        ds.entries.push(entry);
        added = entry;
      });
      return added;
    }
    async function removeDatasetEntry(app, file, datasetId, entryIndex) {
      await app.fileManager.processFrontMatter(file, (fm) => {
        if (!Array.isArray(fm.datasets)) return;
        const ds = fm.datasets.find((item) => item?.id === datasetId);
        if (!ds || !Array.isArray(ds.entries)) return;
        if (entryIndex >= 0 && entryIndex < ds.entries.length) {
          ds.entries.splice(entryIndex, 1);
        }
      });
    }
    async function addWidget(app, file, { title = "", type, datasetId = "", agg = "latest", mode = "latest", target = null, variant = "line", metricKey = "" }) {
      const wType = normalizeWidgetType(type);
      const resolvedDatasetId = wType === "streak" ? "" : typeof datasetId === "string" ? datasetId.trim() : "";
      if (wType !== "streak" && !resolvedDatasetId) {
        throw new Error("Select a data list to link this widget to.");
      }
      const widget = {
        id: generateId("w"),
        title: typeof title === "string" ? title.trim() : "",
        type: wType,
        datasetId: resolvedDatasetId,
        agg: normalizeStatAgg(agg),
        mode: normalizeBarMode(mode),
        target: toFiniteNumber(target),
        variant: normalizeChartVariant(variant),
        metricKey: typeof metricKey === "string" ? metricKey.trim() : ""
      };
      await app.fileManager.processFrontMatter(file, (fm) => {
        const existing = Array.isArray(fm.widgets) ? fm.widgets : [];
        fm.widgets = [...existing, widget];
      });
      return widget;
    }
    async function removeWidget(app, file, widgetId) {
      await app.fileManager.processFrontMatter(file, (fm) => {
        fm.widgets = Array.isArray(fm.widgets) ? fm.widgets.filter((item) => item?.id !== widgetId) : [];
      });
    }
    module2.exports = {
      DATASET_TYPES,
      WIDGET_TYPES,
      STAT_AGGS,
      BAR_MODES,
      CHART_VARIANTS,
      generateId,
      stripMd,
      normalizeEntry,
      readGoalDocument,
      resolveDatasetEntries,
      resolveNumericSeries,
      formatNumber,
      computeStat,
      computeGoalBar,
      formatDueStatus,
      updateGoalMeta,
      addDataset,
      removeDataset,
      addDatasetEntry,
      removeDatasetEntry,
      addWidget,
      removeWidget
    };
  }
});

// src/widget-art.js
var require_widget_art = __commonJS({
  "src/widget-art.js"(exports2, module2) {
    var SVG_NS = "http://www.w3.org/2000/svg";
    function svgEl(tag, attrs = {}) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (value !== void 0 && value !== null) node.setAttribute(key, String(value));
      }
      return node;
    }
    function round(num) {
      return Math.round(num * 10) / 10;
    }
    function computeChartGeometry(points, options = {}) {
      const width = options.width ?? 420;
      const height = options.height ?? 140;
      const pad = options.pad ?? { top: 14, right: 14, bottom: 24, left: 38 };
      const plotW = Math.max(40, width - pad.left - pad.right);
      const plotH = Math.max(30, height - pad.top - pad.bottom);
      if (!points.length) {
        return { width, height, pad, plotW, plotH, minVal: 0, maxVal: 0, coords: [] };
      }
      const values = points.map((p) => p.value);
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);
      if (options.variant === "bar") {
        minVal = Math.min(0, minVal);
      }
      if (minVal === maxVal) {
        const delta = minVal === 0 ? 1 : Math.abs(minVal) * 0.2;
        minVal = Math.max(0, minVal - delta);
        maxVal = maxVal + delta;
      }
      const span = maxVal - minVal || 1;
      const count = points.length;
      const coords = points.map((point, index) => {
        const xRatio = count === 1 ? 0.5 : index / (count - 1);
        const x = options.variant === "bar" ? pad.left + (index + 0.5) / count * plotW : pad.left + xRatio * plotW;
        const yRatio = (point.value - minVal) / span;
        const y = pad.top + plotH - yRatio * plotH;
        return {
          ...point,
          x: round(x),
          y: round(y)
        };
      });
      return { width, height, pad, plotW, plotH, minVal, maxVal, coords };
    }
    function formatAxisVal(val) {
      if (!Number.isFinite(val)) return "";
      if (Math.abs(val) >= 1e3) return `${Math.round(val / 100) / 10}k`;
      return Number.isInteger(val) ? String(val) : String(Math.round(val * 10) / 10);
    }
    function renderChartSvg(container, points, { variant = "line", unit = "", onPointClick } = {}) {
      const geo = computeChartGeometry(points, { variant });
      const { width, height, pad, plotW, plotH, minVal, maxVal, coords } = geo;
      const svg = svgEl("svg", {
        viewBox: `0 0 ${width} ${height}`,
        class: `iter-chart-svg is-${variant}`,
        role: "img",
        "aria-label": `Progress ${variant} chart`
      });
      const baselineY = pad.top + plotH;
      for (const ratio of [0, 0.5, 1]) {
        const y = round(pad.top + plotH * (1 - ratio));
        svg.appendChild(svgEl("line", {
          x1: pad.left,
          y1: y,
          x2: pad.left + plotW,
          y2: y,
          class: ratio === 0 ? "iter-chart-axis" : "iter-chart-grid"
        }));
      }
      const minLabel = svgEl("text", { x: pad.left - 6, y: baselineY + 3, class: "iter-chart-label is-y" });
      minLabel.textContent = formatAxisVal(minVal);
      svg.appendChild(minLabel);
      const maxLabel = svgEl("text", { x: pad.left - 6, y: pad.top + 4, class: "iter-chart-label is-y" });
      maxLabel.textContent = formatAxisVal(maxVal);
      svg.appendChild(maxLabel);
      if (!coords.length) return svg;
      if (variant === "bar") {
        const slotW = plotW / coords.length;
        const barW = Math.min(28, Math.max(6, slotW * 0.58));
        for (const pt of coords) {
          const barH = Math.max(3, baselineY - pt.y);
          const rect = svgEl("rect", {
            x: round(pt.x - barW / 2),
            y: round(baselineY - barH),
            width: round(barW),
            height: round(barH),
            rx: Math.min(4, round(barW / 3)),
            class: `iter-chart-bar${pt.noteFile ? " is-clickable" : ""}`
          });
          const tip = svgEl("title");
          tip.textContent = `${pt.date || ""}: ${pt.value}${unit ? ` ${unit}` : ""}${pt.noteFile ? ` (${pt.label})` : ""}`;
          rect.appendChild(tip);
          if (pt.noteFile && onPointClick) {
            rect.addEventListener("click", () => onPointClick(pt));
          }
          svg.appendChild(rect);
        }
      } else {
        if (coords.length > 1) {
          const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
          const areaPoints = `${coords[0].x},${baselineY} ${linePoints} ${coords[coords.length - 1].x},${baselineY}`;
          svg.appendChild(svgEl("polygon", { points: areaPoints, class: "iter-chart-area" }));
          svg.appendChild(svgEl("polyline", { points: linePoints, class: "iter-chart-line" }));
        }
        for (const pt of coords) {
          const circle = svgEl("circle", {
            cx: pt.x,
            cy: pt.y,
            r: coords.length === 1 ? 4.5 : 3.5,
            class: `iter-chart-dot${pt.noteFile ? " is-clickable" : ""}`
          });
          const tip = svgEl("title");
          tip.textContent = `${pt.date || ""}: ${pt.value}${unit ? ` ${unit}` : ""}${pt.noteFile ? ` (${pt.label})` : ""}`;
          circle.appendChild(tip);
          if (pt.noteFile && onPointClick) {
            circle.addEventListener("click", () => onPointClick(pt));
          }
          svg.appendChild(circle);
        }
      }
      const firstDate = coords[0]?.date;
      const lastDate = coords[coords.length - 1]?.date;
      if (firstDate) {
        const leftText = svgEl("text", { x: pad.left, y: height - 5, class: "iter-chart-label is-x-start" });
        leftText.textContent = firstDate;
        svg.appendChild(leftText);
      }
      if (lastDate && lastDate !== firstDate) {
        const rightText = svgEl("text", { x: pad.left + plotW, y: height - 5, class: "iter-chart-label is-x-end" });
        rightText.textContent = lastDate;
        svg.appendChild(rightText);
      }
      container.appendChild(svg);
      return svg;
    }
    module2.exports = {
      computeChartGeometry,
      renderChartSvg
    };
  }
});

// src/goal-modals.js
var require_goal_modals = __commonJS({
  "src/goal-modals.js"(exports2, module2) {
    var { Modal, FuzzySuggestModal, Notice: Notice2 } = require("obsidian");
    var { toDateKey } = require_storage();
    var {
      DATASET_TYPES,
      WIDGET_TYPES,
      STAT_AGGS,
      BAR_MODES,
      CHART_VARIANTS,
      stripMd
    } = require_data_model();
    var AddDatasetModal = class extends Modal {
      constructor(app, { onSubmit }) {
        super(app);
        this.onSubmit = onSubmit;
        this.submitting = false;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("iter-modal");
        contentEl.createEl("h2", { text: "Add data list", cls: "iter-modal-title" });
        const form = contentEl.createEl("form", { cls: "iter-modal-form" });
        const nameField = form.createDiv({ cls: "iter-modal-field" });
        nameField.createEl("label", { text: "Name", cls: "iter-modal-label" });
        const nameInput = nameField.createEl("input", {
          type: "text",
          placeholder: "e.g. Benching PRs, Words learnt, Mock Exams Done",
          cls: "iter-modal-input"
        });
        nameInput.required = true;
        const typeField = form.createDiv({ cls: "iter-modal-field" });
        typeField.createEl("label", { text: "Data type", cls: "iter-modal-label" });
        const typeSelect = typeField.createEl("select", { cls: "iter-modal-select" });
        for (const item of DATASET_TYPES) {
          typeSelect.createEl("option", { value: item.id, text: item.label });
        }
        const extraField = form.createDiv({ cls: "iter-modal-field" });
        const extraLabel = extraField.createEl("label", { text: "Unit (optional)", cls: "iter-modal-label" });
        const extraInput = extraField.createEl("input", {
          type: "text",
          placeholder: "e.g. kg, words, reps",
          cls: "iter-modal-input"
        });
        const syncExtra = () => {
          const t = typeSelect.value;
          if (t === "number_time") {
            extraField.style.display = "";
            extraLabel.textContent = "Unit (optional)";
            extraInput.placeholder = "e.g. kg, words, kcal";
          } else if (t === "note_time") {
            extraField.style.display = "";
            extraLabel.textContent = "Frontmatter metric property (optional)";
            extraInput.placeholder = "score (reads score from linked notes)";
          } else {
            extraField.style.display = "none";
          }
        };
        typeSelect.addEventListener("change", syncExtra);
        syncExtra();
        const actions = form.createDiv({ cls: "iter-modal-actions" });
        const cancel = actions.createEl("button", { text: "Cancel", type: "button", cls: "iter-btn-ghost" });
        cancel.addEventListener("click", () => this.close());
        const submit = actions.createEl("button", { text: "Add data list", type: "submit", cls: "mod-cta" });
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (this.submitting) return;
          this.submitting = true;
          submit.disabled = true;
          try {
            const type = typeSelect.value;
            await this.onSubmit({
              name: nameInput.value,
              type,
              unit: type === "number_time" ? extraInput.value : "",
              metricKey: type === "note_time" ? extraInput.value.trim() || "score" : "score"
            });
            this.close();
          } catch (error) {
            new Notice2(error instanceof Error ? error.message : String(error));
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
    };
    var AddWidgetModal = class extends Modal {
      constructor(app, { datasets = [], goalKind = "goal", onSubmit }) {
        super(app);
        this.datasets = datasets;
        this.goalKind = goalKind;
        this.onSubmit = onSubmit;
        this.submitting = false;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("iter-modal");
        contentEl.createEl("h2", { text: "Add widget", cls: "iter-modal-title" });
        const form = contentEl.createEl("form", { cls: "iter-modal-form" });
        const row = form.createDiv({ cls: "iter-modal-row" });
        const availableTypes = WIDGET_TYPES.filter(
          (item) => item.id === "streak" ? this.goalKind === "habit" : this.datasets.length > 0
        );
        const typeField = row.createDiv({ cls: "iter-modal-field" });
        typeField.createEl("label", { text: "Widget type", cls: "iter-modal-label" });
        const typeSelect = typeField.createEl("select", { cls: "iter-modal-select" });
        for (const item of availableTypes) {
          typeSelect.createEl("option", { value: item.id, text: item.label });
        }
        if (availableTypes.length) typeSelect.value = availableTypes[0].id;
        const dsField = row.createDiv({ cls: "iter-modal-field" });
        dsField.createEl("label", { text: "Linked data", cls: "iter-modal-label" });
        const dsSelect = dsField.createEl("select", { cls: "iter-modal-select" });
        for (const ds of this.datasets) {
          dsSelect.createEl("option", { value: ds.id, text: ds.name });
        }
        if (this.datasets.length) dsSelect.value = this.datasets[0].id;
        const titleField = form.createDiv({ cls: "iter-modal-field" });
        titleField.createEl("label", { text: "Widget title (optional)", cls: "iter-modal-label" });
        const titleInput = titleField.createEl("input", {
          type: "text",
          placeholder: "Auto-named from data if left blank",
          cls: "iter-modal-input"
        });
        const dynamicSlot = form.createDiv({ cls: "iter-modal-dynamic" });
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
          dsField.style.display = wType === "streak" ? "none" : "";
          titleInput.placeholder = wType === "streak" ? "Streak" : "Auto-named from data if left blank";
          if (wType === "streak") {
            dynamicSlot.createEl("p", {
              text: "Tracks consecutive scheduled completions from this habit's watering log.",
              cls: "iter-section-hint"
            });
          } else if (wType === "stat") {
            const field = dynamicSlot.createDiv({ cls: "iter-modal-field" });
            field.createEl("label", { text: "Calculation", cls: "iter-modal-label" });
            aggSelect = field.createEl("select", { cls: "iter-modal-select" });
            for (const item of STAT_AGGS) {
              aggSelect.createEl("option", { value: item.id, text: item.label });
            }
          } else if (wType === "goal_bar") {
            const barRow = dynamicSlot.createDiv({ cls: "iter-modal-row" });
            const modeField = barRow.createDiv({ cls: "iter-modal-field" });
            modeField.createEl("label", { text: "Compare value", cls: "iter-modal-label" });
            modeSelect = modeField.createEl("select", { cls: "iter-modal-select" });
            for (const item of BAR_MODES) {
              modeSelect.createEl("option", { value: item.id, text: item.label });
            }
            const tField = barRow.createDiv({ cls: "iter-modal-field" });
            tField.createEl("label", { text: "Goal target number", cls: "iter-modal-label" });
            targetInput = tField.createEl("input", {
              type: "number",
              step: "any",
              placeholder: "e.g. 100",
              cls: "iter-modal-input"
            });
            targetInput.required = true;
          } else if (wType === "chart") {
            const field = dynamicSlot.createDiv({ cls: "iter-modal-field" });
            field.createEl("label", { text: "Graph style", cls: "iter-modal-label" });
            variantSelect = field.createEl("select", { cls: "iter-modal-select" });
            for (const item of CHART_VARIANTS) {
              variantSelect.createEl("option", { value: item.id, text: item.label });
            }
          } else if (wType === "note_navigator") {
            const currentDs = this.datasets.find((d) => d.id === dsSelect.value);
            if (currentDs && currentDs.type !== "note" && currentDs.type !== "note_time") {
              const noteDs = this.datasets.find((d) => d.type === "note" || d.type === "note_time");
              if (noteDs) dsSelect.value = noteDs.id;
            }
          }
        };
        typeSelect.addEventListener("change", rebuildOptions);
        rebuildOptions();
        const actions = form.createDiv({ cls: "iter-modal-actions" });
        const cancel = actions.createEl("button", { text: "Cancel", type: "button", cls: "iter-btn-ghost" });
        cancel.addEventListener("click", () => this.close());
        const submit = actions.createEl("button", { text: "Add widget", type: "submit", cls: "mod-cta" });
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (this.submitting) return;
          this.submitting = true;
          submit.disabled = true;
          try {
            await this.onSubmit({
              type: typeSelect.value,
              datasetId: typeSelect.value === "streak" ? "" : dsSelect.value,
              title: titleInput.value,
              agg: aggSelect?.value ?? "latest",
              mode: modeSelect?.value ?? "latest",
              target: targetInput?.value ?? null,
              variant: variantSelect?.value ?? "line"
            });
            this.close();
          } catch (error) {
            new Notice2(error instanceof Error ? error.message : String(error));
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
    };
    var NotePickerModal = class extends FuzzySuggestModal {
      constructor(app, onChoose) {
        super(app);
        this.onChoose = onChoose;
        this.setPlaceholder("Search Obsidian notes\u2026");
      }
      getItems() {
        const files = this.app.vault.getMarkdownFiles();
        return [...files].sort((a, b) => (b.stat?.mtime ?? 0) - (a.stat?.mtime ?? 0));
      }
      getItemText(file) {
        return file.path.endsWith(".md") ? file.path.slice(0, -3) : file.path;
      }
      onChooseItem(file) {
        void this.onChoose(file);
      }
    };
    var NoteTimeMetaModal = class extends Modal {
      constructor(app, { noteFile, metricKey = "score", onSubmit }) {
        super(app);
        this.noteFile = noteFile;
        this.metricKey = metricKey;
        this.onSubmit = onSubmit;
        this.submitting = false;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("iter-modal");
        contentEl.createEl("h2", { text: `Add "${stripMd(this.noteFile.name)}"`, cls: "iter-modal-title" });
        const form = contentEl.createEl("form", { cls: "iter-modal-form" });
        const row = form.createDiv({ cls: "iter-modal-row" });
        const dateField = row.createDiv({ cls: "iter-modal-field" });
        dateField.createEl("label", { text: "Date", cls: "iter-modal-label" });
        const dateInput = dateField.createEl("input", { type: "date", cls: "iter-modal-input" });
        dateInput.value = toDateKey();
        dateInput.required = true;
        const scoreField = row.createDiv({ cls: "iter-modal-field" });
        scoreField.createEl("label", { text: `${this.metricKey} (optional)`, cls: "iter-modal-label" });
        const scoreInput = scoreField.createEl("input", {
          type: "number",
          step: "any",
          placeholder: `Reads "${this.metricKey}" frontmatter if blank`,
          cls: "iter-modal-input"
        });
        const actions = form.createDiv({ cls: "iter-modal-actions" });
        const cancel = actions.createEl("button", { text: "Cancel", type: "button", cls: "iter-btn-ghost" });
        cancel.addEventListener("click", () => this.close());
        const submit = actions.createEl("button", { text: "Add note", type: "submit", cls: "mod-cta" });
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (this.submitting) return;
          this.submitting = true;
          submit.disabled = true;
          try {
            await this.onSubmit({
              path: this.noteFile.path,
              date: dateInput.value,
              value: scoreInput.value === "" ? null : Number(scoreInput.value)
            });
            this.close();
          } catch (error) {
            new Notice2(error instanceof Error ? error.message : String(error));
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
    };
    module2.exports = {
      AddDatasetModal,
      AddWidgetModal,
      NotePickerModal,
      NoteTimeMetaModal
    };
  }
});

// src/goal-view.js
var require_goal_view = __commonJS({
  "src/goal-view.js"(exports2, module2) {
    var { ItemView, Notice: Notice2, setIcon } = require("obsidian");
    var {
      ROOT,
      toDateKey,
      toggleSubgoal,
      waterHabit,
      updateHabitSchedule: updateHabitSchedule2,
      formatCadenceLabel,
      isScheduledOnDate,
      computeHabitStreakDetails
    } = require_storage();
    var { listGarden: listGarden2 } = require_catalog();
    var { renderSchedulePicker } = require_schedule_picker();
    var {
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
      removeWidget
    } = require_data_model();
    var { renderChartSvg } = require_widget_art();
    var {
      AddDatasetModal,
      AddWidgetModal,
      NotePickerModal,
      NoteTimeMetaModal
    } = require_goal_modals();
    var GOAL_VIEW2 = "iter-goal";
    var TYPE_LABELS = Object.fromEntries(DATASET_TYPES.map((t) => [t.id, t.label]));
    var KIND_LABELS = {
      tree: "Tree",
      subgoal: "Subgoal",
      habit: "Habit",
      goal: "Goal"
    };
    var AGG_LABELS = {
      count: "Count",
      sum: "Total",
      average: "Average",
      latest: "Latest",
      max: "Max",
      min: "Min"
    };
    var GoalView2 = class extends ItemView {
      constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.file = null;
        this.filePath = null;
        this.openAddForDataset = null;
        this.renderTimer = null;
      }
      getViewType() {
        return GOAL_VIEW2;
      }
      getDisplayText() {
        if (!this.file) return "Goal";
        const doc = readGoalDocument(this.app, this.file);
        return doc.title || "Goal";
      }
      getIcon() {
        if (!this.file) return "target";
        const doc = readGoalDocument(this.app, this.file);
        if (doc.kind === "tree") return "trees";
        if (doc.kind === "habit") return "droplet";
        return "target";
      }
      getState() {
        return { file: this.file?.path ?? this.filePath ?? null };
      }
      async setState(state, result) {
        const nextPath = typeof state?.file === "string" ? state.file : null;
        this.filePath = nextPath;
        const abstract = nextPath ? this.app.vault.getAbstractFileByPath(nextPath) : null;
        this.file = abstract && !Array.isArray(abstract.children) ? abstract : null;
        this.openAddForDataset = null;
        this.render();
        this.leaf?.updateHeader?.();
        await super.setState(state, result);
      }
      async onOpen() {
        this.contentEl.addClass("iter-goal-view");
        const shouldRefresh = (changedFile) => {
          if (!this.file) return false;
          if (!changedFile) return true;
          if (changedFile.path === this.file.path) return true;
          if (changedFile.path.startsWith(`${ROOT}/`)) return true;
          const doc = readGoalDocument(this.app, this.file);
          return doc.datasets.some(
            (ds) => (ds.type === "note" || ds.type === "note_time") && ds.entries.some((e) => e.path === changedFile.path)
          );
        };
        for (const event of ["modify", "delete"]) {
          this.registerEvent(this.app.vault.on(event, (file) => {
            if (event === "delete" && file?.path && (file.path === this.filePath || this.filePath?.startsWith(`${file.path}/`))) {
              this.file = null;
              this.render();
              return;
            }
            if (shouldRefresh(file)) this.scheduleRender();
          }));
        }
        this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
          if (oldPath === this.filePath) {
            this.file = file;
            this.filePath = file.path;
            this.leaf?.updateHeader?.();
            this.scheduleRender();
          } else if (shouldRefresh(file)) {
            this.scheduleRender();
          }
        }));
        this.registerEvent(this.app.metadataCache.on("changed", (file) => {
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
          const active = typeof document !== "undefined" ? document.activeElement : null;
          if (active && this.contentEl.contains?.(active) && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
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
          const missing = container.createDiv({ cls: "iter-goal-missing" });
          missing.createEl("p", { text: "Goal note not found." });
          const backBtn = missing.createEl("button", { text: "Open We garden", cls: "iter-primary-pill", type: "button" });
          backBtn.addEventListener("click", () => void this.plugin.openGarden());
          return;
        }
        const doc = readGoalDocument(this.app, this.file);
        const shell = container.createDiv({ cls: "iter-goal-shell" });
        this.renderHeader(shell, doc);
        this.renderOverview(shell, doc);
        if (doc.kind === "habit") {
          this.renderHabitSchedule(shell, doc);
        }
        this.renderWidgetsSection(shell, doc);
        this.renderDatasetsSection(shell, doc);
        if (doc.kind === "tree" && doc.treePath) {
          this.renderTreeChildrenSection(shell, doc);
        }
      }
      renderHeader(shell, doc) {
        const topBar = shell.createDiv({ cls: "iter-goal-topbar" });
        const crumbs = topBar.createDiv({ cls: "iter-breadcrumbs" });
        const weBtn = crumbs.createEl("button", { text: "We", cls: "iter-crumb-btn", type: "button" });
        weBtn.addEventListener("click", () => void this.plugin.openGarden(doc.treePath));
        if (doc.parentTreeFile) {
          crumbs.createSpan({ text: "/", cls: "iter-crumb-sep" });
          const treeName = doc.treePath ? doc.treePath.split("/").pop() : "Tree";
          const parentBtn = crumbs.createEl("button", { text: treeName, cls: "iter-crumb-btn", type: "button" });
          parentBtn.addEventListener("click", () => void this.plugin.openGoal(doc.parentTreeFile));
        }
        crumbs.createSpan({ text: KIND_LABELS[doc.kind] || "Goal", cls: "iter-kind-pill" });
        if (doc.kind === "tree" && doc.endless) {
          crumbs.createSpan({
            text: "Never-ending",
            cls: "iter-kind-pill is-endless",
            attr: { title: "Grows continuously without an expected completion date" }
          });
        }
        const actions = topBar.createDiv({ cls: "iter-goal-top-actions" });
        if (doc.kind === "subgoal") {
          const doneBtn = actions.createEl("button", {
            cls: `iter-primary-pill${doc.done ? " is-done" : ""}`,
            type: "button"
          });
          const icon = doneBtn.createSpan({ cls: "iter-btn-icon" });
          setIcon(icon, doc.done ? "check-circle-2" : "circle");
          doneBtn.createSpan({ text: doc.done ? "Done" : "Mark done" });
          doneBtn.addEventListener("click", async () => {
            await toggleSubgoal(this.app, this.file);
            this.render();
            this.plugin.scheduleRefresh();
          });
        } else if (doc.kind === "habit") {
          const garden = listGarden2(this.app);
          const tree = garden.trees.find((t) => t.path === doc.treePath);
          const habit = tree?.habits?.find((h) => h.file.path === this.file.path);
          const watered = habit?.wateredInPeriod ?? false;
          const wateredToday = habit?.wateredToday ?? false;
          const dueToday = isScheduledOnDate(doc.frequency, doc.days, toDateKey());
          const cadenceLabel = formatCadenceLabel(doc.frequency, doc.days);
          const waterBtn = actions.createEl("button", {
            cls: `iter-water-action${watered ? " is-watered" : ""}${!dueToday && !wateredToday ? " is-rest" : ""}`,
            type: "button"
          });
          const drop = waterBtn.createSpan({ cls: "iter-btn-icon" });
          setIcon(drop, "droplet");
          waterBtn.createSpan({
            text: wateredToday ? "Watered today" : watered ? `Done (${cadenceLabel})` : !dueToday ? `Rest day (${cadenceLabel})` : `Water (${cadenceLabel})`
          });
          waterBtn.addEventListener("click", async () => {
            const res = await waterHabit(this.app, this.file);
            new Notice2(res ? `Watered ${doc.title}` : `Unwatered ${doc.title} for today`);
            this.render();
            this.plugin.scheduleRefresh();
          });
        }
        const mdBtn = actions.createEl("button", {
          cls: "iter-ghost-action",
          type: "button",
          attr: { title: "Open underlying Markdown file" }
        });
        const mdIcon = mdBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(mdIcon, "file-text");
        mdBtn.createSpan({ text: "Markdown" });
        mdBtn.addEventListener("click", () => void this.plugin.openFile(this.file));
        shell.createEl("h1", { text: doc.title, cls: "iter-goal-title" });
      }
      renderOverview(shell, doc) {
        const isEndlessTree = doc.kind === "tree" && doc.endless;
        const overview = shell.createDiv({
          cls: `iter-goal-overview${isEndlessTree ? " is-single" : ""}`
        });
        const descWrap = overview.createDiv({ cls: "iter-goal-desc-wrap" });
        descWrap.createEl("label", { text: "Description", cls: "iter-micro-label" });
        const descInput = descWrap.createEl("textarea", {
          cls: "iter-goal-desc-input",
          placeholder: isEndlessTree ? "Describe this ongoing tree and what you want to keep building here\u2026" : "Describe this goal, why it matters, and what success looks like\u2026"
        });
        descInput.rows = 2;
        descInput.value = doc.description;
        let savedDesc = doc.description;
        descInput.addEventListener("blur", async () => {
          const next = descInput.value.trim();
          if (next === savedDesc) return;
          savedDesc = next;
          await updateGoalMeta(this.app, this.file, { description: next });
          this.plugin.scheduleRefresh();
        });
        if (isEndlessTree) return;
        const dueWrap = overview.createDiv({ cls: "iter-goal-due-wrap" });
        dueWrap.createEl("label", { text: "Expected completion", cls: "iter-micro-label" });
        const dueRow = dueWrap.createDiv({ cls: "iter-due-row" });
        const dueInput = dueRow.createEl("input", { type: "date", cls: "iter-due-input" });
        dueInput.value = doc.due;
        const status = formatDueStatus(doc.due);
        if (status) {
          dueRow.createSpan({
            text: status.badge,
            cls: `iter-due-badge is-${status.tone}`
          });
        } else {
          dueRow.createSpan({ text: "No target date", cls: "iter-due-empty" });
        }
        dueInput.addEventListener("change", async () => {
          await updateGoalMeta(this.app, this.file, { due: dueInput.value });
          this.render();
          this.plugin.scheduleRefresh();
        });
      }
      renderHabitSchedule(shell, doc) {
        const box = shell.createDiv({ cls: "iter-goal-schedule" });
        const top = box.createDiv({ cls: "iter-schedule-head" });
        top.createEl("span", { text: "Repetitivity", cls: "iter-micro-label" });
        const currentLabel = top.createSpan({
          text: formatCadenceLabel(doc.frequency, doc.days),
          cls: "iter-schedule-current"
        });
        renderSchedulePicker(box, {
          frequency: doc.frequency,
          days: doc.days,
          onChange: async (next) => {
            if (next.frequency === "weekdays" && !next.days.length) {
              currentLabel.textContent = "Pick days below";
              return;
            }
            await updateHabitSchedule2(this.app, this.file, next);
            currentLabel.textContent = formatCadenceLabel(next.frequency, next.days);
            this.plugin.scheduleRefresh();
          }
        });
      }
      renderWidgetsSection(shell, doc) {
        const section = shell.createDiv({ cls: "iter-goal-section" });
        const header = section.createDiv({ cls: "iter-section-bar" });
        header.createEl("h2", { text: "Widgets", cls: "iter-section-heading" });
        const addBtn = header.createEl("button", { cls: "iter-ghost-action", type: "button" });
        const plus = addBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(plus, "plus");
        addBtn.createSpan({ text: "Add widget" });
        addBtn.addEventListener("click", () => {
          if (doc.kind !== "habit" && !doc.datasets.length) {
            new Notice2("Add a data list first, then link a widget to it.");
            return;
          }
          new AddWidgetModal(this.app, {
            datasets: doc.datasets,
            goalKind: doc.kind,
            onSubmit: async (config) => {
              await addWidget(this.app, this.file, config);
              this.render();
            }
          }).open();
        });
        if (!doc.widgets.length) {
          section.createEl("p", {
            text: doc.kind === "habit" ? "No widgets yet. Add a streak widget or link custom data below." : doc.datasets.length ? "No widgets yet. Link a progress bar, metric, graph, or note navigator to your data." : "Add custom data below, then pin widgets here to visualize your progress.",
            cls: "iter-section-hint"
          });
          return;
        }
        const grid = section.createDiv({ cls: "iter-widget-grid" });
        const datasetById = new Map(doc.datasets.map((d) => [d.id, d]));
        for (const widget of doc.widgets) {
          const ds = widget.datasetId ? datasetById.get(widget.datasetId) : null;
          this.renderWidgetCard(grid, widget, ds, doc);
        }
      }
      renderWidgetCard(grid, widget, dataset, doc) {
        const wide = widget.type === "chart" || widget.type === "goal_bar" || widget.type === "note_navigator";
        const card = grid.createDiv({
          cls: `iter-widget-card type-${widget.type}${wide ? " is-wide" : ""}`
        });
        const top = card.createDiv({ cls: "iter-widget-top" });
        const defaultTitle = widget.type === "streak" ? "Streak" : !dataset ? "Missing dataset" : widget.type === "stat" ? `${dataset.name} \xB7 ${AGG_LABELS[widget.agg] || widget.agg}` : dataset.name;
        top.createSpan({ text: widget.title || defaultTitle, cls: "iter-widget-title" });
        const removeBtn = top.createEl("button", {
          cls: "iter-icon-button iter-widget-remove",
          type: "button",
          attr: { "aria-label": "Remove widget", title: "Remove widget" }
        });
        setIcon(removeBtn, "x");
        removeBtn.addEventListener("click", async () => {
          await removeWidget(this.app, this.file, widget.id);
          this.render();
        });
        if (widget.type === "streak") {
          const details = computeHabitStreakDetails(
            doc.waterLog,
            doc.frequency,
            /* @__PURE__ */ new Date(),
            doc.days,
            doc.lastWatered
          );
          const valRow = card.createDiv({ cls: "iter-streak-main" });
          valRow.createSpan({ text: String(details.streak), cls: "iter-streak-number" });
          valRow.createSpan({ text: details.unit, cls: "iter-streak-unit" });
          card.createDiv({
            text: `${details.statusLabel} \xB7 Best: ${details.bestStreak} \xB7 ${details.cadenceLabel}`,
            cls: "iter-streak-meta"
          });
          const slotsRow = card.createDiv({ cls: "iter-streak-slots" });
          for (const slot of details.recentSlots) {
            slotsRow.createSpan({
              text: slot.label,
              cls: `iter-streak-slot${slot.completed ? " is-done" : ""}${slot.isCurrent ? " is-current" : ""}`,
              attr: {
                title: `${slot.key} (${slot.completed ? "Completed" : slot.isCurrent ? "Pending" : "Missed"})`,
                "aria-label": `${slot.key}: ${slot.completed ? "completed" : "not completed"}`
              }
            });
          }
          return;
        }
        if (!dataset) {
          card.createEl("p", { text: "Linked data list was removed.", cls: "iter-widget-empty" });
          return;
        }
        if (widget.type === "stat") {
          const res = computeStat(this.app, dataset, widget.agg, this.file.path, widget.metricKey);
          const valRow = card.createDiv({ cls: "iter-stat-value-row" });
          valRow.createSpan({ text: res.display, cls: "iter-stat-number" });
          if (res.unit && widget.agg !== "count") {
            valRow.createSpan({ text: res.unit, cls: "iter-stat-unit" });
          }
          const subLabel = widget.agg === "count" ? `${res.count} ${res.count === 1 ? "entry" : "entries"}` : `${AGG_LABELS[widget.agg] || widget.agg} \xB7 ${res.count} ${res.count === 1 ? "point" : "points"}`;
          card.createDiv({ text: subLabel, cls: "iter-stat-sub" });
          return;
        }
        if (widget.type === "goal_bar") {
          const bar = computeGoalBar(this.app, dataset, widget.mode, widget.target, this.file.path, widget.metricKey);
          const headerRow = card.createDiv({ cls: "iter-bar-meta" });
          const unitSuffix = bar.unit ? ` ${bar.unit}` : "";
          headerRow.createSpan({
            text: `${bar.currentDisplay}${unitSuffix} / ${bar.targetDisplay}${unitSuffix}`,
            cls: "iter-bar-numbers"
          });
          headerRow.createSpan({ text: `${bar.rawPercent}%`, cls: "iter-bar-percent" });
          const track = card.createDiv({ cls: "iter-bar-track" });
          const fill = track.createDiv({ cls: "iter-bar-fill" });
          fill.style.width = `${bar.fillPercent}%`;
          return;
        }
        if (widget.type === "chart") {
          const points = resolveNumericSeries(this.app, dataset, this.file.path, widget.metricKey);
          if (!points.length) {
            card.createEl("p", {
              text: dataset.type === "note_time" ? `Add notes with a "${dataset.metricKey || "score"}" property (or inline value) to plot.` : "Add numeric entries to plot progress over time.",
              cls: "iter-widget-empty"
            });
            return;
          }
          const latest = points[points.length - 1];
          const delta = points.length > 1 ? latest.value - points[0].value : null;
          const summary = card.createDiv({ cls: "iter-chart-summary" });
          summary.createSpan({
            text: `Latest: ${formatNumber(latest.value)}${dataset.unit ? ` ${dataset.unit}` : ""}`
          });
          if (delta !== null) {
            const sign = delta > 0 ? "+" : "";
            summary.createSpan({
              text: `${sign}${formatNumber(delta)} overall`,
              cls: delta >= 0 ? "iter-delta-up" : "iter-delta-down"
            });
          }
          const host = card.createDiv({ cls: "iter-chart-host" });
          renderChartSvg(host, points, {
            variant: widget.variant,
            unit: dataset.unit,
            onPointClick: (pt) => {
              if (pt.noteFile) void this.plugin.openFile(pt.noteFile);
            }
          });
          return;
        }
        if (widget.type === "note_navigator") {
          const entries = resolveDatasetEntries(this.app, dataset, this.file.path);
          if (!entries.length) {
            card.createEl("p", { text: "No linked notes yet.", cls: "iter-widget-empty" });
            return;
          }
          const navList = card.createDiv({ cls: "iter-note-nav-list" });
          const ordered = dataset.type === "note_time" ? [...entries].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.index - a.index) : entries;
          for (const entry of ordered) {
            const itemBtn = navList.createEl("button", { cls: "iter-note-nav-item", type: "button" });
            const icon = itemBtn.createSpan({ cls: "iter-note-nav-icon" });
            setIcon(icon, "file-text");
            const main = itemBtn.createSpan({ cls: "iter-note-nav-main" });
            main.createSpan({ text: entry.label, cls: "iter-note-nav-title" });
            if (entry.path) {
              const folder = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "Vault root";
              main.createSpan({ text: folder, cls: "iter-note-nav-path" });
            }
            if (entry.value !== null) {
              itemBtn.createSpan({ text: formatNumber(entry.value), cls: "iter-note-score-pill" });
            }
            if (entry.date) {
              itemBtn.createSpan({ text: entry.date, cls: "iter-note-date-pill" });
            }
            itemBtn.addEventListener("click", () => {
              if (entry.noteFile) void this.plugin.openFile(entry.noteFile);
              else new Notice2(`Note not found: ${entry.path}`);
            });
          }
        }
      }
      renderDatasetsSection(shell, doc) {
        const section = shell.createDiv({ cls: "iter-goal-section" });
        const header = section.createDiv({ cls: "iter-section-bar" });
        header.createEl("h2", { text: "Data", cls: "iter-section-heading" });
        const addBtn = header.createEl("button", { cls: "iter-ghost-action", type: "button" });
        const plus = addBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(plus, "plus");
        addBtn.createSpan({ text: "Add data" });
        addBtn.addEventListener("click", () => {
          new AddDatasetModal(this.app, {
            onSubmit: async (config) => {
              const created = await addDataset(this.app, this.file, config);
              if (created.type === "number_time" || created.type === "text") {
                this.openAddForDataset = created.id;
              }
              this.render();
            }
          }).open();
        });
        if (!doc.datasets.length) {
          section.createEl("p", {
            text: 'Create custom data lists like "Benching PRs" (number & date), "Words learnt" (text), or "Mock Exams Done" (notes & date).',
            cls: "iter-section-hint"
          });
          return;
        }
        const list = section.createDiv({ cls: "iter-dataset-grid" });
        for (const dataset of doc.datasets) {
          this.renderDatasetCard(list, dataset);
        }
      }
      triggerDatasetAdd(dataset) {
        if (dataset.type === "note") {
          new NotePickerModal(this.app, async (noteFile) => {
            await addDatasetEntry(this.app, this.file, dataset.id, { path: noteFile.path });
            this.render();
          }).open();
          return;
        }
        if (dataset.type === "note_time") {
          new NotePickerModal(this.app, (noteFile) => {
            new NoteTimeMetaModal(this.app, {
              noteFile,
              metricKey: dataset.metricKey || "score",
              onSubmit: async (entry) => {
                await addDatasetEntry(this.app, this.file, dataset.id, entry);
                this.render();
              }
            }).open();
          }).open();
          return;
        }
        this.openAddForDataset = this.openAddForDataset === dataset.id ? null : dataset.id;
        this.render();
      }
      renderDatasetCard(container, dataset) {
        const card = container.createDiv({ cls: "iter-dataset-card" });
        const top = card.createDiv({ cls: "iter-dataset-top" });
        const left = top.createDiv({ cls: "iter-dataset-title-wrap" });
        left.createSpan({ text: dataset.name, cls: "iter-dataset-title" });
        left.createSpan({ text: TYPE_LABELS[dataset.type] || dataset.type, cls: "iter-module-pill" });
        left.createSpan({ text: String(dataset.entries.length), cls: "iter-dataset-count" });
        const right = top.createDiv({ cls: "iter-dataset-actions" });
        const addEntryBtn = right.createEl("button", {
          cls: "iter-icon-button iter-dataset-add-btn",
          type: "button",
          attr: { "aria-label": `Add entry to ${dataset.name}`, title: `Add to ${dataset.name}` }
        });
        setIcon(addEntryBtn, "plus");
        addEntryBtn.addEventListener("click", () => this.triggerDatasetAdd(dataset));
        const removeDsBtn = right.createEl("button", {
          cls: "iter-icon-button iter-dataset-remove-btn",
          type: "button",
          attr: { "aria-label": `Delete ${dataset.name}`, title: `Delete ${dataset.name}` }
        });
        setIcon(removeDsBtn, "trash-2");
        removeDsBtn.addEventListener("click", async () => {
          await removeDataset(this.app, this.file, dataset.id);
          if (this.openAddForDataset === dataset.id) this.openAddForDataset = null;
          this.render();
        });
        if (this.openAddForDataset === dataset.id && (dataset.type === "number_time" || dataset.type === "text")) {
          const form = card.createEl("form", { cls: "iter-inline-entry-form" });
          let primaryInput = null;
          let dateInput = null;
          if (dataset.type === "number_time") {
            primaryInput = form.createEl("input", {
              type: "number",
              step: "any",
              placeholder: dataset.unit ? `Value (${dataset.unit})` : "Value",
              cls: "iter-inline-input is-number"
            });
            primaryInput.required = true;
            dateInput = form.createEl("input", { type: "date", cls: "iter-inline-input is-date" });
            dateInput.value = toDateKey();
            dateInput.required = true;
          } else {
            primaryInput = form.createEl("input", {
              type: "text",
              placeholder: "Add item\u2026",
              cls: "iter-inline-input is-text"
            });
            primaryInput.required = true;
          }
          const saveBtn = form.createEl("button", { text: "Add", type: "submit", cls: "iter-primary-pill" });
          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            saveBtn.disabled = true;
            try {
              if (dataset.type === "number_time") {
                await addDatasetEntry(this.app, this.file, dataset.id, {
                  value: Number(primaryInput.value),
                  date: dateInput.value
                });
              } else {
                await addDatasetEntry(this.app, this.file, dataset.id, {
                  value: primaryInput.value
                });
              }
              this.openAddForDataset = null;
              this.render();
            } catch (error) {
              new Notice2(error instanceof Error ? error.message : String(error));
              saveBtn.disabled = false;
            }
          });
          setTimeout(() => primaryInput?.focus(), 0);
        }
        const resolved = resolveDatasetEntries(this.app, dataset, this.file.path);
        if (!resolved.length) {
          card.createEl("p", { text: "No entries yet. Click + to add one.", cls: "iter-dataset-empty" });
          return;
        }
        const displayOrder = dataset.type === "number_time" || dataset.type === "note_time" ? [...resolved].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.index - a.index) : [...resolved].reverse();
        const rowsEl = card.createDiv({ cls: "iter-entry-list" });
        for (const item of displayOrder) {
          const row = rowsEl.createDiv({ cls: "iter-entry-row" });
          if (dataset.type === "note" || dataset.type === "note_time") {
            const linkBtn = row.createEl("button", { cls: "iter-entry-note-btn", type: "button" });
            const icon = linkBtn.createSpan({ cls: "iter-btn-icon" });
            setIcon(icon, "file-text");
            linkBtn.createSpan({ text: item.label, cls: "iter-entry-main" });
            linkBtn.addEventListener("click", () => {
              if (item.noteFile) void this.plugin.openFile(item.noteFile);
              else new Notice2(`Note not found: ${item.path}`);
            });
            if (item.value !== null) {
              row.createSpan({ text: formatNumber(item.value), cls: "iter-note-score-pill" });
            }
          } else {
            row.createSpan({ text: item.label, cls: "iter-entry-main" });
          }
          if (item.date) {
            row.createSpan({ text: item.date, cls: "iter-entry-date" });
          }
          const delBtn = row.createEl("button", {
            cls: "iter-icon-button iter-entry-del",
            type: "button",
            attr: { "aria-label": "Remove entry", title: "Remove entry" }
          });
          setIcon(delBtn, "x");
          delBtn.addEventListener("click", async () => {
            await removeDatasetEntry(this.app, this.file, dataset.id, item.index);
            this.render();
          });
        }
      }
      renderTreeChildrenSection(shell, doc) {
        const garden = listGarden2(this.app);
        const tree = garden.trees.find((t) => t.path === doc.treePath);
        if (!tree) return;
        const section = shell.createDiv({ cls: "iter-goal-section" });
        const header = section.createDiv({ cls: "iter-section-bar" });
        header.createEl("h2", { text: "Subgoals & Habits", cls: "iter-section-heading" });
        const actions = header.createDiv({ cls: "iter-goal-top-actions" });
        const addSubBtn = actions.createEl("button", { cls: "iter-ghost-action", type: "button" });
        const p1 = addSubBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(p1, "plus");
        addSubBtn.createSpan({ text: "Subgoal" });
        addSubBtn.addEventListener("click", () => this.plugin.promptCreateSubgoal(tree.path));
        const addHabBtn = actions.createEl("button", { cls: "iter-ghost-action", type: "button" });
        const p2 = addHabBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(p2, "plus");
        addHabBtn.createSpan({ text: "Habit" });
        addHabBtn.addEventListener("click", () => this.plugin.promptCreateHabit(tree.path));
        if (!tree.subgoals.length && !tree.habits.length) {
          section.createEl("p", { text: "No subgoals or habits under this tree yet.", cls: "iter-section-hint" });
          return;
        }
        const chipGrid = section.createDiv({ cls: "iter-tree-links-grid" });
        for (const sub of tree.subgoals) {
          const btn = chipGrid.createEl("button", {
            cls: `iter-tree-link-card${sub.done ? " is-done" : ""}`,
            type: "button"
          });
          const icon = btn.createSpan({ cls: "iter-btn-icon" });
          setIcon(icon, sub.done ? "check-circle-2" : "target");
          btn.createSpan({ text: sub.title, cls: "iter-tree-link-name" });
          btn.createSpan({ text: "Subgoal", cls: "iter-tree-link-kind" });
          btn.addEventListener("click", () => void this.plugin.openGoal(sub.file));
        }
        for (const habit of tree.habits) {
          const btn = chipGrid.createEl("button", {
            cls: `iter-tree-link-card${habit.wateredInPeriod ? " is-watered" : ""}`,
            type: "button"
          });
          const icon = btn.createSpan({ cls: "iter-btn-icon" });
          setIcon(icon, "droplet");
          btn.createSpan({ text: habit.title, cls: "iter-tree-link-name" });
          btn.createSpan({ text: habit.cadenceLabel, cls: "iter-tree-link-kind" });
          btn.addEventListener("click", () => void this.plugin.openGoal(habit.file));
        }
      }
    };
    module2.exports = {
      GoalView: GoalView2,
      GOAL_VIEW: GOAL_VIEW2
    };
  }
});

// src/plugin.js
var { Plugin, Notice } = require("obsidian");
var {
  ensureStructure,
  createTree,
  createSubgoal,
  createHabit,
  updateHabitSchedule,
  deleteTree,
  deleteGoalFile
} = require_storage();
var { listGarden, findTreeContext } = require_catalog();
var {
  CreateTreeModal,
  CreateSubgoalModal,
  CreateHabitModal,
  EditHabitScheduleModal,
  ConfirmDeleteModal
} = require_modals();
var { IterPanelView, PANEL_VIEW } = require_panel_view();
var { GardenView, GARDEN_VIEW } = require_garden_view();
var { GoalView, GOAL_VIEW } = require_goal_view();
var IterPlugin = class extends Plugin {
  async onload() {
    this.alive = true;
    this.refreshTimer = null;
    this.gardenViewType = GARDEN_VIEW;
    this.goalViewType = GOAL_VIEW;
    await ensureStructure(this.app.vault);
    this.registerView(PANEL_VIEW, (leaf) => new IterPanelView(leaf, this));
    this.registerView(GARDEN_VIEW, (leaf) => new GardenView(leaf, this));
    this.registerView(GOAL_VIEW, (leaf) => new GoalView(leaf, this));
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
    this.addCommand({
      id: "open-goal-view",
      name: "Open goal view",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile?.();
        if (!file || !findTreeContext(this.app, file)) return false;
        if (!checking) void this.openGoal(file);
        return true;
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
  async openGoal(file) {
    if (!file) return;
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(GOAL_VIEW).find((item) => item.view?.file?.path === file.path);
    if (existing) {
      await workspace.revealLeaf(existing);
      return existing;
    }
    const active = workspace.getMostRecentLeaf?.();
    const leaf = active?.view?.getViewType?.() === GARDEN_VIEW ? workspace.getLeaf("tab") : workspace.getLeaf(false);
    await leaf.setViewState({ type: GOAL_VIEW, state: { file: file.path }, active: true });
    await workspace.revealLeaf(leaf);
    return leaf;
  }
  async openFile(file) {
    if (!file) return;
    const { workspace } = this.app;
    const active = workspace.getMostRecentLeaf?.();
    const activeType = active?.view?.getViewType?.();
    const leaf = activeType === GARDEN_VIEW || activeType === GOAL_VIEW ? workspace.getLeaf("tab") : workspace.getLeaf(false);
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
    if (activeLeaf?.view?.getViewType?.() === GOAL_VIEW && activeLeaf.view.file) {
      const goalTree = findTreeContext(this.app, activeLeaf.view.file);
      if (goalTree && trees.some((t) => t.path === goalTree)) return goalTree;
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
          await this.openGoal(file);
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
  promptEditHabitSchedule(habit) {
    new EditHabitScheduleModal(this.app, {
      title: habit.title,
      frequency: habit.frequency,
      days: habit.days,
      onSubmit: async (schedule) => {
        await updateHabitSchedule(this.app, habit.file, schedule);
        new Notice(`Updated repetitivity for "${habit.title}"`);
        this.scheduleRefresh();
      }
    }).open();
  }
  closeGoalLeavesMatching(targetPath, isFolderTarget = false) {
    if (!targetPath || !this.app.workspace?.getLeavesOfType) return;
    const matches = (leafPath) => leafPath === targetPath || isFolderTarget && typeof leafPath === "string" && leafPath.startsWith(`${targetPath}/`);
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
    if (tree.subgoals?.length) parts.push(tree.subgoals.length === 1 ? "1 goal" : `${tree.subgoals.length} goals`);
    if (tree.habits?.length) parts.push(tree.habits.length === 1 ? "1 habit" : `${tree.habits.length} habits`);
    const detail = parts.length ? ` (including ${parts.join(" and ")})` : "";
    new ConfirmDeleteModal(this.app, {
      title: `Delete "${tree.title}"?`,
      message: `Move tree "${tree.title}"${detail} to Obsidian's trash?`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await deleteTree(this.app, tree.path);
        this.closeGoalLeavesMatching(tree.path, true);
        new Notice(`Deleted "${tree.title}"`);
        this.scheduleRefresh();
      }
    }).open();
  }
  promptDeleteGoalItem(kind, item) {
    if (!item?.file) return;
    new ConfirmDeleteModal(this.app, {
      title: `Delete ${kind}?`,
      message: `Move "${item.title}" to Obsidian's trash?`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        await deleteGoalFile(this.app, item.file);
        this.closeGoalLeavesMatching(item.file.path, false);
        new Notice(`Deleted "${item.title}"`);
        this.scheduleRefresh();
      }
    }).open();
  }
};
module.exports = IterPlugin;
