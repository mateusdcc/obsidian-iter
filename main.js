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
    var {
      ROOT,
      isFolder,
      parseDateKey,
      toDateKey,
      normalizeFrequency,
      normalizeDays,
      mergeWaterDates
    } = require_storage();
    var DATASET_TYPES = [
      { id: "number_time", label: "Number & Time" },
      { id: "text", label: "Text List" },
      { id: "note", label: "Notes" },
      { id: "note_time", label: "Notes & Time" },
      { id: "rollup", label: "Child Rollup (from children)" }
    ];
    var RELATION_CHILD_KINDS = [
      { id: "all", label: "All subgoals & habits" },
      { id: "habits", label: "Habits only" },
      { id: "subgoals", label: "Subgoals only" }
    ];
    var RELATION_DATA_FILTERS = [
      { id: "numeric", label: "Numeric (numbers & scored notes)" },
      { id: "note", label: "Notes" },
      { id: "text", label: "Text lists" },
      { id: "any", label: "All data types" }
    ];
    var RELATION_PER_CHILD = [
      { id: "all", label: "All entries combined" },
      { id: "sum", label: "Sum per child" },
      { id: "latest", label: "Latest entry per child" },
      { id: "average", label: "Average per child" },
      { id: "max", label: "Max per child" },
      { id: "min", label: "Min per child" },
      { id: "count", label: "Entry count per child" }
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
      if (type === "pipeline") return "pipeline";
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
    function parseMetricKeysInput(raw) {
      const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
      const seen = /* @__PURE__ */ new Set();
      const keys = [];
      for (const item of list) {
        if (typeof item !== "string") continue;
        const clean = item.trim();
        if (!clean || seen.has(clean)) continue;
        seen.add(clean);
        keys.push(clean);
      }
      return keys;
    }
    function normalizeMetricKeys(rawKeys, rawSingle, type) {
      if (rawKeys !== void 0) {
        const parsed = parseMetricKeysInput(rawKeys);
        if (parsed.length) return parsed;
        if (typeof rawSingle === "string" && rawSingle.trim()) return parseMetricKeysInput(rawSingle);
        return [];
      }
      if (rawSingle !== void 0) {
        return parseMetricKeysInput(rawSingle);
      }
      return type === "note_time" ? ["score"] : [];
    }
    function normalizeEntryProps(rawProps) {
      if (!rawProps || typeof rawProps !== "object" || Array.isArray(rawProps)) return null;
      const out = {};
      let hasAny = false;
      for (const [rawKey, rawVal] of Object.entries(rawProps)) {
        const key = String(rawKey || "").trim();
        if (!key || rawVal === null || rawVal === void 0 || rawVal === "") continue;
        const num = toFiniteNumber(rawVal);
        if (num !== null) {
          out[key] = num;
          hasAny = true;
        } else if (typeof rawVal === "string") {
          const str = rawVal.trim();
          if (str) {
            out[key] = str;
            hasAny = true;
          }
        } else if (typeof rawVal === "boolean") {
          out[key] = rawVal;
          hasAny = true;
        }
      }
      return hasAny ? out : null;
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
        const props = typeof raw === "object" ? normalizeEntryProps(raw.props) : null;
        return props ? { path, props } : { path };
      }
      if (type === "note_time") {
        if (typeof raw !== "object") return null;
        const path = typeof raw.path === "string" ? raw.path.trim() : "";
        if (!path) return null;
        const date = typeof raw.date === "string" && parseDateKey(raw.date) ? raw.date.trim() : toDateKey();
        const value = toFiniteNumber(raw.value);
        const props = normalizeEntryProps(raw.props);
        const entry = { path, date };
        if (value !== null) entry.value = value;
        if (props) entry.props = props;
        return entry;
      }
      return null;
    }
    function normalizeChildKinds(raw) {
      return RELATION_CHILD_KINDS.some((item) => item.id === raw) ? raw : "all";
    }
    function normalizeDataFilter(raw) {
      return RELATION_DATA_FILTERS.some((item) => item.id === raw) ? raw : "numeric";
    }
    function normalizePerChildAgg(raw) {
      return RELATION_PER_CHILD.some((item) => item.id === raw) ? raw : "all";
    }
    function normalizeRelationRefs(raw) {
      if (!Array.isArray(raw)) return [];
      return raw.map((ref) => {
        if (!ref || typeof ref !== "object") return null;
        const filePath = typeof ref.filePath === "string" ? ref.filePath.trim() : "";
        const datasetId = typeof ref.datasetId === "string" ? ref.datasetId.trim() : "";
        if (!datasetId) return null;
        return { filePath, datasetId };
      }).filter(Boolean);
    }
    function normalizeRelation(raw) {
      if (!raw || typeof raw !== "object") return null;
      const mode = raw.mode === "pick" ? "pick" : "query";
      return {
        scope: "tree_children",
        treePath: typeof raw.treePath === "string" ? raw.treePath.trim() : "",
        mode,
        childKinds: normalizeChildKinds(raw.childKinds),
        dataFilter: normalizeDataFilter(raw.dataFilter),
        nameMatch: typeof raw.nameMatch === "string" ? raw.nameMatch.trim() : "",
        perChildAgg: normalizePerChildAgg(raw.perChildAgg),
        refs: mode === "pick" ? normalizeRelationRefs(raw.refs) : []
      };
    }
    function normalizeDataset(raw) {
      if (!raw || typeof raw !== "object") return null;
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!name) return null;
      const type = normalizeDatasetType(raw.type);
      const relation = type === "rollup" ? normalizeRelation(raw.relation) || normalizeRelation({ mode: "query" }) : null;
      const metricKeys = normalizeMetricKeys(raw.metricKeys, raw.metricKey, type);
      const entries = type === "rollup" ? [] : Array.isArray(raw.entries) ? raw.entries.map((item) => normalizeEntry(type, item)).filter(Boolean) : [];
      return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : generateId("ds"),
        name,
        type,
        unit: typeof raw.unit === "string" ? raw.unit.trim() : "",
        metricKey: metricKeys[0] || "",
        metricKeys,
        relation,
        entries
      };
    }
    function normalizePipelineRef(raw) {
      if (!raw || typeof raw !== "object") return null;
      const nodes = Array.isArray(raw.nodes) ? raw.nodes.filter((n) => n && typeof n === "object") : [];
      const edges = Array.isArray(raw.edges) ? raw.edges.filter((e) => e && typeof e === "object") : [];
      if (!nodes.length) return null;
      return {
        version: 1,
        zoom: Number.isFinite(Number(raw.zoom)) ? Number(raw.zoom) : 1,
        panX: Number.isFinite(Number(raw.panX)) ? Number(raw.panX) : 0,
        panY: Number.isFinite(Number(raw.panY)) ? Number(raw.panY) : 0,
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges))
      };
    }
    function normalizeWidget(raw) {
      if (!raw || typeof raw !== "object") return null;
      const type = normalizeWidgetType(raw.type);
      const pipeline = type === "pipeline" ? normalizePipelineRef(raw.pipeline) : null;
      if (type === "pipeline" && !pipeline) return null;
      const relation = type === "streak" || type === "pipeline" ? null : normalizeRelation(raw.relation);
      const datasetId = type === "streak" || type === "pipeline" || relation ? "" : typeof raw.datasetId === "string" ? raw.datasetId.trim() : "";
      if (type !== "streak" && type !== "pipeline" && !datasetId && !relation) return null;
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : generateId("w"),
        title,
        type,
        datasetId,
        relation,
        pipeline,
        unit: typeof raw.unit === "string" ? raw.unit.trim() : "",
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
    var IGNORED_FM_KEYS = /* @__PURE__ */ new Set(["position", "datasets", "widgets", "water_log", "days"]);
    function extractNoteScalarFields(fm) {
      const fields = {};
      if (!fm || typeof fm !== "object") return fields;
      for (const [key, val] of Object.entries(fm)) {
        if (!key || IGNORED_FM_KEYS.has(key) || val === null || val === void 0) continue;
        if (typeof val === "number" && Number.isFinite(val)) {
          fields[key] = val;
        } else if (typeof val === "string" && val.trim() !== "") {
          fields[key] = val.trim();
        } else if (typeof val === "boolean") {
          fields[key] = val;
        }
      }
      return fields;
    }
    function resolveNoteEntryFields(app, entry, dataset, sourcePath = "", metricOverride = "") {
      const noteFile = resolveNoteFile(app, entry.path, sourcePath);
      const fm = noteFile ? app.metadataCache.getFileCache(noteFile)?.frontmatter : null;
      const fields = extractNoteScalarFields(fm);
      if (entry.props && typeof entry.props === "object") {
        for (const [k, v] of Object.entries(entry.props)) {
          if (fields[k] === void 0 && v !== void 0 && v !== null && v !== "") {
            fields[k] = v;
          }
        }
      }
      const primaryKey = dataset.metricKey || dataset.metricKeys?.[0] || (dataset.type === "note_time" ? "score" : "");
      if (dataset.type === "note_time" && entry.value !== void 0 && entry.value !== null && primaryKey && fields[primaryKey] === void 0) {
        fields[primaryKey] = entry.value;
      }
      const declaredKeys = Array.isArray(dataset.metricKeys) && dataset.metricKeys.length ? dataset.metricKeys : primaryKey ? [primaryKey] : [];
      const propsList = [];
      for (const k of declaredKeys) {
        const rawVal = fields[k];
        if (rawVal === void 0 || rawVal === null || rawVal === "") continue;
        const num = toFiniteNumber(rawVal);
        propsList.push({
          key: k,
          raw: rawVal,
          num
        });
      }
      const activeKey = metricOverride || primaryKey;
      let value = activeKey ? toFiniteNumber(fields[activeKey]) : null;
      if (value === null && dataset.type === "note_time" && (!activeKey || activeKey === primaryKey)) {
        value = toFiniteNumber(entry.value);
      }
      const date = dataset.type === "note_time" ? entry.date : typeof fields.date === "string" && parseDateKey(fields.date) ? fields.date.trim() : null;
      return {
        noteFile,
        path: noteFile?.path ?? entry.path,
        label: noteFile ? stripMd(noteFile.name) : stripMd(entry.path.split("/").pop()),
        date,
        value,
        fields,
        propsList
      };
    }
    function resolveDatasetEntries(app, dataset, sourcePath = "", metricOverride = "") {
      if (dataset?.isVirtual && Array.isArray(dataset.resolvedEntries)) {
        if (!metricOverride || metricOverride === dataset.metricKey) {
          return dataset.resolvedEntries;
        }
        return dataset.resolvedEntries.map((item) => {
          const nextVal = item.fields ? toFiniteNumber(item.fields[metricOverride]) : item.value;
          return { ...item, value: nextVal };
        });
      }
      return dataset.entries.map((entry, index) => {
        if (dataset.type === "number_time") {
          return {
            index,
            date: entry.date,
            value: entry.value,
            noteFile: null,
            label: `${entry.value}${dataset.unit ? ` ${dataset.unit}` : ""}`,
            fields: { value: entry.value, date: entry.date, ...dataset.unit ? { unit: dataset.unit } : {} },
            propsList: []
          };
        }
        if (dataset.type === "text") {
          return {
            index,
            date: entry.date ?? null,
            value: null,
            noteFile: null,
            label: entry.value,
            fields: { value: entry.value, ...entry.date ? { date: entry.date } : {} },
            propsList: []
          };
        }
        if (dataset.type === "note" || dataset.type === "note_time") {
          const resolved = resolveNoteEntryFields(app, entry, dataset, sourcePath, metricOverride);
          return {
            index,
            ...resolved
          };
        }
        return { index, date: null, value: null, noteFile: null, label: "", fields: {}, propsList: [] };
      });
    }
    function resolveNumericSeries(app, dataset, sourcePath = "", metricOverride = "") {
      const effectiveDataset = metricOverride ? { ...dataset, metricKey: metricOverride } : dataset;
      const resolved = resolveDatasetEntries(app, effectiveDataset, sourcePath, metricOverride);
      const timed = resolved.filter((item) => item.value !== null && Number.isFinite(item.value));
      if (timed.some((item) => Boolean(item.date))) {
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
        const entries = resolveDatasetEntries(app, dataset, sourcePath, metricOverride);
        return {
          value: entries.length,
          display: formatNumber(entries.length),
          unit: "",
          count: entries.length
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
    function collectTreeMarkdownFiles(folder, acc = []) {
      if (!isFolder(folder)) return acc;
      for (const child of folder.children) {
        if (!child?.name || child.name.startsWith(".") || child.name.startsWith("_")) continue;
        if (isFolder(child)) {
          collectTreeMarkdownFiles(child, acc);
        } else if (child.extension === "md") {
          acc.push(child);
        }
      }
      return acc;
    }
    function discoverChildDatasets(app, treePath) {
      if (!treePath || typeof treePath !== "string") return [];
      const folder = app.vault.getAbstractFileByPath(treePath);
      if (!isFolder(folder)) return [];
      const files = collectTreeMarkdownFiles(folder, []).filter((f) => f.name !== "_tree.md");
      const results = [];
      for (const file of files) {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter;
        if (!fm || !Array.isArray(fm.datasets)) continue;
        const childKind = resolveGoalKind(file, fm);
        const childTitle = typeof fm.title === "string" && fm.title.trim() ? fm.title.trim() : stripMd(file.name);
        for (const rawDs of fm.datasets) {
          const ds = normalizeDataset(rawDs);
          if (!ds) continue;
          results.push({
            file,
            filePath: file.path,
            childKind,
            childTitle,
            dataset: ds
          });
        }
      }
      results.sort(
        (a, b) => a.childTitle.localeCompare(b.childTitle, void 0, { sensitivity: "base", numeric: true }) || a.dataset.name.localeCompare(b.dataset.name, void 0, { sensitivity: "base", numeric: true })
      );
      return results;
    }
    function datasetMatchesFilter(ds, dataFilter) {
      if (!ds) return false;
      if (dataFilter === "any") return true;
      if (dataFilter === "numeric") {
        if (ds.type === "number_time" || ds.type === "note_time") return true;
        if (ds.type === "note" && Array.isArray(ds.metricKeys) && ds.metricKeys.length > 0) return true;
        if (ds.type === "rollup") {
          const df = ds.relation?.dataFilter || "numeric";
          return df === "numeric" || df === "any";
        }
        return false;
      }
      if (dataFilter === "note") {
        if (ds.type === "note" || ds.type === "note_time") return true;
        if (ds.type === "rollup") {
          const df = ds.relation?.dataFilter || "numeric";
          return df === "note" || df === "any";
        }
        return false;
      }
      if (dataFilter === "text") {
        if (ds.type === "text") return true;
        if (ds.type === "rollup") {
          const df = ds.relation?.dataFilter || "numeric";
          return df === "text" || df === "any";
        }
        return false;
      }
      return true;
    }
    function inferRollupUnit(datasets, explicitUnit = "") {
      const cleanExplicit = typeof explicitUnit === "string" ? explicitUnit.trim() : "";
      if (cleanExplicit) return cleanExplicit;
      const units = new Set(
        datasets.map((ds) => typeof ds?.unit === "string" ? ds.unit.trim() : "").filter(Boolean)
      );
      return units.size === 1 ? Array.from(units)[0] : "";
    }
    function resolvePickedRefs(app, refs, childItems, ownerFilePath, excludedDatasetId) {
      const byKey = /* @__PURE__ */ new Map();
      const byDsId = /* @__PURE__ */ new Map();
      for (const item of childItems) {
        byKey.set(`${item.filePath}::${item.dataset.id}`, item);
        if (!byDsId.has(item.dataset.id)) byDsId.set(item.dataset.id, item);
      }
      const matched = [];
      const seen = /* @__PURE__ */ new Set();
      for (const ref of refs) {
        let item = byKey.get(`${ref.filePath}::${ref.datasetId}`) || byDsId.get(ref.datasetId) || null;
        if (!item && ref.filePath) {
          const directFile = app.vault.getAbstractFileByPath(ref.filePath);
          if (directFile && !isFolder(directFile)) {
            const fm = app.metadataCache.getFileCache(directFile)?.frontmatter ?? {};
            const rawDs = Array.isArray(fm.datasets) ? fm.datasets.find((d) => d?.id === ref.datasetId) : null;
            const ds = normalizeDataset(rawDs);
            if (ds) {
              item = {
                file: directFile,
                filePath: directFile.path,
                childKind: resolveGoalKind(directFile, fm),
                childTitle: typeof fm.title === "string" && fm.title.trim() ? fm.title.trim() : stripMd(directFile.name),
                dataset: ds
              };
            }
          }
        }
        if (!item) continue;
        if (item.filePath === ownerFilePath && item.dataset.id === excludedDatasetId) continue;
        const key = `${item.filePath}::${item.dataset.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matched.push(item);
      }
      return matched;
    }
    function resolveVirtualDataset(app, spec, ownerFilePath = "", defaultTreePath = "", metricOverride = "", visited = /* @__PURE__ */ new Set()) {
      const relation = normalizeRelation(spec?.relation);
      const explicitUnit = typeof spec?.unit === "string" ? spec.unit.trim() : "";
      const effectiveMetric = (metricOverride || spec?.metricKey || "").trim();
      const emptyResult = {
        id: spec?.id || "",
        name: spec?.name || "Child Rollup",
        type: "number_time",
        unit: explicitUnit,
        metricKey: effectiveMetric || "score",
        isVirtual: true,
        relation,
        sources: [],
        resolvedEntries: [],
        entries: []
      };
      if (!relation) return emptyResult;
      const targetTreePath = relation.treePath || defaultTreePath || resolveParentTreePath(ownerFilePath) || "";
      const childItems = targetTreePath ? discoverChildDatasets(app, targetTreePath) : [];
      let matched = [];
      if (relation.mode === "pick") {
        matched = resolvePickedRefs(app, relation.refs, childItems, ownerFilePath, spec?.id);
      } else {
        const queryLower = relation.nameMatch.toLowerCase();
        matched = childItems.filter((item) => {
          if (item.filePath === ownerFilePath && item.dataset.id === spec?.id) return false;
          if (relation.childKinds === "habits" && item.childKind !== "habit") return false;
          if (relation.childKinds === "subgoals" && item.childKind !== "subgoal") return false;
          if (!datasetMatchesFilter(item.dataset, relation.dataFilter)) return false;
          if (queryLower) {
            const matchName = item.dataset.name.toLowerCase().includes(queryLower);
            const matchChild = item.childTitle.toLowerCase().includes(queryLower);
            if (!matchName && !matchChild) return false;
          }
          return true;
        });
      }
      const resolvedChildren = [];
      const sources = [];
      const resolvedEntries = [];
      for (const item of matched) {
        const visitKey = `${item.filePath}::${item.dataset.id}`;
        if (visited.has(visitKey) || visited.size >= 4) continue;
        const nextVisited = new Set(visited);
        nextVisited.add(visitKey);
        let childDs = item.dataset;
        if (childDs.type === "rollup") {
          childDs = resolveVirtualDataset(app, childDs, item.filePath, targetTreePath, effectiveMetric, nextVisited);
        } else if (effectiveMetric && (childDs.type === "note_time" || childDs.type === "note")) {
          childDs = { ...childDs, metricKey: effectiveMetric };
        }
        resolvedChildren.push(childDs);
        const childEntries = resolveDatasetEntries(app, childDs, item.filePath, effectiveMetric);
        const numericPoints = resolveNumericSeries(app, childDs, item.filePath, effectiveMetric);
        const isNumericChild = childDs.type === "number_time" || childDs.type === "note_time" || childDs.type === "note" && Boolean(childDs.metricKeys?.length || effectiveMetric);
        const previewAgg = relation.perChildAgg === "all" ? isNumericChild ? "sum" : "count" : relation.perChildAgg;
        const summaryStat = computeStat(app, childDs, previewAgg, item.filePath, effectiveMetric);
        sources.push({
          file: item.file,
          filePath: item.filePath,
          childKind: item.childKind,
          childTitle: item.childTitle,
          datasetId: item.dataset.id,
          datasetName: item.dataset.name,
          datasetType: childDs.type,
          unit: childDs.unit,
          entryCount: childEntries.length,
          stat: summaryStat
        });
        if (relation.perChildAgg === "all") {
          for (const entry of childEntries) {
            if (relation.dataFilter === "numeric" && (entry.value === null || !Number.isFinite(entry.value))) {
              continue;
            }
            resolvedEntries.push({
              ...entry,
              index: resolvedEntries.length,
              sourceFile: entry.sourceFile || item.file,
              sourceTitle: entry.sourceTitle || item.childTitle,
              datasetName: entry.datasetName || item.dataset.name
            });
          }
        } else if (summaryStat.value !== null && Number.isFinite(summaryStat.value)) {
          const latestDate = numericPoints.length ? numericPoints[numericPoints.length - 1].date || "" : "";
          resolvedEntries.push({
            index: resolvedEntries.length,
            date: latestDate,
            value: summaryStat.value,
            noteFile: null,
            label: `${item.childTitle}: ${formatNumber(summaryStat.value)}${childDs.unit ? ` ${childDs.unit}` : ""}`,
            sourceFile: item.file,
            sourceTitle: item.childTitle,
            datasetName: item.dataset.name
          });
        }
      }
      let effectiveType = "number_time";
      if (relation.perChildAgg !== "all") {
        effectiveType = "number_time";
      } else if (relation.dataFilter === "text" || resolvedChildren.length && resolvedChildren.every((d) => d.type === "text")) {
        effectiveType = "text";
      } else if (resolvedEntries.some((e) => e.path)) {
        effectiveType = resolvedEntries.some((e) => e.date || e.value !== null && Number.isFinite(e.value)) ? "note_time" : "note";
      }
      const metricKeys = [];
      const seenKeys = /* @__PURE__ */ new Set();
      for (const childDs of resolvedChildren) {
        for (const k of childDs.metricKeys || []) {
          if (k && !seenKeys.has(k)) {
            seenKeys.add(k);
            metricKeys.push(k);
          }
        }
      }
      return {
        id: spec?.id || "",
        name: spec?.name || describeRelation(relation, sources),
        type: effectiveType,
        unit: inferRollupUnit(resolvedChildren, explicitUnit),
        metricKey: effectiveMetric || metricKeys[0] || "",
        metricKeys,
        isVirtual: true,
        relation,
        sources,
        resolvedEntries,
        entries: resolvedEntries
      };
    }
    function resolveWidgetDataset(app, widget, datasetById, doc) {
      if (widget.relation) {
        return resolveVirtualDataset(
          app,
          {
            id: widget.id,
            name: widget.title || "",
            unit: widget.unit || "",
            metricKey: widget.metricKey || "",
            relation: widget.relation
          },
          doc.file?.path || "",
          doc.treePath || "",
          widget.metricKey || ""
        );
      }
      const ds = widget.datasetId ? datasetById.get(widget.datasetId) : null;
      if (!ds) return null;
      if (ds.type === "rollup") {
        return resolveVirtualDataset(
          app,
          ds,
          doc.file?.path || "",
          doc.treePath || "",
          widget.metricKey || ds.metricKey || "",
          /* @__PURE__ */ new Set([`${doc.file?.path || ""}::${ds.id}`])
        );
      }
      return ds;
    }
    function describeRelation(relation, sources = null) {
      if (!relation) return "Child rollup";
      if (relation.mode === "pick") {
        const count = Array.isArray(sources) ? sources.length : relation.refs.length;
        const base = `${count} selected ${count === 1 ? "list" : "lists"}`;
        if (relation.perChildAgg !== "all") {
          const aggLabel = RELATION_PER_CHILD.find((p) => p.id === relation.perChildAgg)?.label || relation.perChildAgg;
          return `${base} \xB7 ${aggLabel}`;
        }
        return base;
      }
      const kindLabel = relation.childKinds === "habits" ? "Habits" : relation.childKinds === "subgoals" ? "Subgoals" : "Tree children";
      const filterMap = {
        numeric: "Numeric",
        note: "Notes",
        text: "Text",
        any: "All data"
      };
      const parts = [kindLabel, relation.nameMatch ? `"${relation.nameMatch}"` : filterMap[relation.dataFilter] || "Data"];
      if (relation.perChildAgg !== "all") {
        const aggLabel = RELATION_PER_CHILD.find((p) => p.id === relation.perChildAgg)?.label || relation.perChildAgg;
        parts.push(aggLabel);
      }
      return parts.join(" \xB7 ");
    }
    async function addDataset(app, file, { name, type, unit = "", metricKey, metricKeys, relation = null }) {
      const cleanName = typeof name === "string" ? name.trim() : "";
      if (!cleanName) throw new Error("Dataset name is required.");
      const dsType = normalizeDatasetType(type);
      let cleanRelation = null;
      if (dsType === "rollup") {
        cleanRelation = normalizeRelation(relation) || normalizeRelation({ mode: "query" });
        if (cleanRelation.mode === "pick" && !cleanRelation.refs.length) {
          throw new Error("Select at least one child data list.");
        }
      }
      const cleanKeys = normalizeMetricKeys(metricKeys, metricKey, dsType);
      const dataset = {
        id: generateId("ds"),
        name: cleanName,
        type: dsType,
        unit: typeof unit === "string" ? unit.trim() : "",
        metricKey: cleanKeys[0] || "",
        metricKeys: cleanKeys,
        relation: cleanRelation,
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
        const dsType = normalizeDatasetType(ds.type);
        if (dsType === "rollup") {
          throw new Error("Child rollup lists are computed automatically from child data.");
        }
        const entry = normalizeEntry(dsType, rawEntry);
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
    function buildWidgetPayload(raw, existingId = "") {
      const wType = normalizeWidgetType(raw.type);
      const cleanPipeline = wType === "pipeline" ? normalizePipelineRef(raw.pipeline) : null;
      if (wType === "pipeline" && !cleanPipeline) {
        throw new Error("Add at least one node before saving this flow widget.");
      }
      const cleanRelation = wType === "streak" || wType === "pipeline" ? null : normalizeRelation(raw.relation);
      if (cleanRelation && cleanRelation.mode === "pick" && !cleanRelation.refs.length) {
        throw new Error("Select at least one child data list.");
      }
      const resolvedDatasetId = wType === "streak" || wType === "pipeline" || cleanRelation ? "" : typeof raw.datasetId === "string" ? raw.datasetId.trim() : "";
      if (wType !== "streak" && wType !== "pipeline" && !resolvedDatasetId && !cleanRelation) {
        throw new Error("Select a data list to link this widget to.");
      }
      return {
        id: existingId || generateId("w"),
        title: typeof raw.title === "string" ? raw.title.trim() : "",
        type: wType,
        datasetId: resolvedDatasetId,
        relation: cleanRelation,
        pipeline: cleanPipeline,
        unit: typeof raw.unit === "string" ? raw.unit.trim() : "",
        agg: normalizeStatAgg(raw.agg),
        mode: normalizeBarMode(raw.mode),
        target: toFiniteNumber(raw.target),
        variant: normalizeChartVariant(raw.variant),
        metricKey: typeof raw.metricKey === "string" ? raw.metricKey.trim() : ""
      };
    }
    async function addWidget(app, file, config) {
      const widget = buildWidgetPayload(config);
      await app.fileManager.processFrontMatter(file, (fm) => {
        const existing = Array.isArray(fm.widgets) ? fm.widgets : [];
        fm.widgets = [...existing, widget];
      });
      return widget;
    }
    async function updateWidget(app, file, widgetId, config) {
      const widget = buildWidgetPayload(config, widgetId);
      await app.fileManager.processFrontMatter(file, (fm) => {
        const existing = Array.isArray(fm.widgets) ? fm.widgets : [];
        const idx = existing.findIndex((item) => item?.id === widgetId);
        if (idx === -1) {
          fm.widgets = [...existing, widget];
        } else {
          fm.widgets = existing.map((item, i) => i === idx ? widget : item);
        }
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
      RELATION_CHILD_KINDS,
      RELATION_DATA_FILTERS,
      RELATION_PER_CHILD,
      generateId,
      stripMd,
      toFiniteNumber,
      parseMetricKeysInput,
      normalizeMetricKeys,
      normalizeEntryProps,
      extractNoteScalarFields,
      normalizeEntry,
      normalizeRelation,
      normalizePipelineRef,
      readGoalDocument,
      discoverChildDatasets,
      datasetMatchesFilter,
      resolveDatasetEntries,
      resolveNumericSeries,
      resolveVirtualDataset,
      resolveWidgetDataset,
      describeRelation,
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
      updateWidget,
      removeWidget
    };
  }
});

// src/pipeline.js
var require_pipeline = __commonJS({
  "src/pipeline.js"(exports2, module2) {
    var {
      ROOT,
      isFolder,
      toDateKey,
      parseDateKey,
      periodKeyFor,
      mergeWaterDates
    } = require_storage();
    var {
      generateId,
      stripMd,
      toFiniteNumber,
      formatNumber,
      readGoalDocument,
      discoverChildDatasets,
      datasetMatchesFilter,
      resolveDatasetEntries
    } = require_data_model();
    var PIPELINE_NODE_TYPES = [
      {
        type: "source",
        category: "source",
        label: "Data Source",
        shortDesc: "Load entries from tree children or this goal",
        hasIn: false,
        hasOut: true,
        defaultConfig: {
          scope: "tree_children",
          childKinds: "all",
          datasetFilter: "any",
          datasetId: "",
          nameMatch: ""
        }
      },
      {
        type: "water_source",
        category: "source",
        label: "Watering Log",
        shortDesc: "Load habit completion dates (value = 1)",
        hasIn: false,
        hasOut: true,
        defaultConfig: {
          scope: "tree_habits",
          nameMatch: ""
        }
      },
      {
        type: "filter",
        category: "filter",
        label: "Filter",
        shortDesc: "Keep items matching custom rules or properties",
        hasIn: true,
        hasOut: true,
        defaultConfig: {
          match: "all",
          rules: [{ field: "datasetName", op: "contains", value: "" }]
        }
      },
      {
        type: "extract",
        category: "transform",
        label: "Pick Field",
        shortDesc: "Extract a frontmatter property or metric as the value",
        hasIn: true,
        hasOut: true,
        defaultConfig: {
          field: "pages",
          fallbackToValue: true,
          dropMissing: true,
          unit: ""
        }
      },
      {
        type: "math",
        category: "transform",
        label: "Math",
        shortDesc: "Transform each numeric value (+, -, \xD7, \xF7, round)",
        hasIn: true,
        hasOut: true,
        defaultConfig: {
          op: "multiply",
          operand: 1,
          unit: ""
        }
      },
      {
        type: "group",
        category: "transform",
        label: "Group & Summarize",
        shortDesc: "Aggregate values by child, list, period, or property",
        hasIn: true,
        hasOut: true,
        defaultConfig: {
          by: "sourceTitle",
          propKey: "",
          agg: "sum"
        }
      },
      {
        type: "sort",
        category: "transform",
        label: "Sort & Limit",
        shortDesc: "Order items and optionally cap count",
        hasIn: true,
        hasOut: true,
        defaultConfig: {
          by: "date_asc",
          limit: 0
        }
      },
      {
        type: "merge",
        category: "transform",
        label: "Merge",
        shortDesc: "Combine multiple parallel branches",
        hasIn: true,
        hasOut: true,
        defaultConfig: {
          dedupe: "none"
        }
      },
      {
        type: "output",
        category: "output",
        label: "Widget Output",
        shortDesc: "Render final result as Stat, Bar, Graph, or Note List",
        hasIn: true,
        hasOut: false,
        defaultConfig: {
          displayType: "stat",
          agg: "sum",
          mode: "sum",
          target: 100,
          variant: "bar",
          unit: ""
        }
      }
    ];
    var NODE_DEF_MAP = Object.fromEntries(PIPELINE_NODE_TYPES.map((d) => [d.type, d]));
    var FILTER_FIELD_PRESETS = [
      { id: "datasetName", label: "Data list name" },
      { id: "sourceTitle", label: "Habit / Subgoal name" },
      { id: "title", label: "Entry / Note title" },
      { id: "sourceKind", label: "Child kind (habit / subgoal)" },
      { id: "datasetType", label: "List type (number_time / note / ...)" },
      { id: "unit", label: "Unit" },
      { id: "date", label: "Date (YYYY-MM-DD)" },
      { id: "value", label: "Current numeric value" },
      { id: "path", label: "Note path" }
    ];
    var FILTER_OPS = [
      { id: "contains", label: "contains" },
      { id: "not_contains", label: "does not contain" },
      { id: "equals", label: "equals" },
      { id: "not_equals", label: "not equal" },
      { id: "gt", label: ">" },
      { id: "gte", label: ">=" },
      { id: "lt", label: "<" },
      { id: "lte", label: "<=" },
      { id: "exists", label: "exists (non-empty)" },
      { id: "is_number", label: "is numeric" },
      { id: "this_month", label: "in this month" },
      { id: "this_week", label: "in this week" },
      { id: "within_days", label: "in last N days" }
    ];
    var OPS_WITHOUT_VALUE = /* @__PURE__ */ new Set(["exists", "is_number", "this_month", "this_week"]);
    var MATH_OPS = [
      { id: "multiply", label: "Multiply (\xD7)" },
      { id: "divide", label: "Divide (\xF7)" },
      { id: "add", label: "Add (+)" },
      { id: "subtract", label: "Subtract (\u2212)" },
      { id: "round", label: "Round (decimals)" },
      { id: "abs", label: "Absolute value" },
      { id: "clamp_min", label: "Minimum floor" },
      { id: "clamp_max", label: "Maximum cap" }
    ];
    var GROUP_BYS = [
      { id: "sourceTitle", label: "Child (Habit / Subgoal)" },
      { id: "datasetName", label: "Data list name" },
      { id: "day", label: "Day (YYYY-MM-DD)" },
      { id: "week", label: "Week" },
      { id: "month", label: "Month (YYYY-MM)" },
      { id: "prop", label: "Frontmatter property" }
    ];
    var SORT_BYS = [
      { id: "date_asc", label: "Date (oldest first)" },
      { id: "date_desc", label: "Date (newest first)" },
      { id: "value_desc", label: "Value (highest first)" },
      { id: "value_asc", label: "Value (lowest first)" },
      { id: "label_asc", label: "Title (A \u2192 Z)" }
    ];
    function getNodeDef(type) {
      return NODE_DEF_MAP[type] || null;
    }
    function createNode(type, partial = {}) {
      const def = getNodeDef(type) || NODE_DEF_MAP.source;
      return {
        id: typeof partial.id === "string" && partial.id.trim() ? partial.id.trim() : generateId("n"),
        type: def.type,
        label: typeof partial.label === "string" && partial.label.trim() ? partial.label.trim() : def.label,
        x: Number.isFinite(Number(partial.x)) ? Number(partial.x) : 80,
        y: Number.isFinite(Number(partial.y)) ? Number(partial.y) : 80,
        config: {
          ...JSON.parse(JSON.stringify(def.defaultConfig)),
          ...partial.config && typeof partial.config === "object" ? JSON.parse(JSON.stringify(partial.config)) : {}
        }
      };
    }
    function normalizePipeline(raw, doc = null) {
      const defaultScope = doc?.kind === "tree" ? "tree_children" : "this_goal";
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.nodes) || !raw.nodes.length) {
        const s = createNode("source", { id: "n_src", x: 56, y: 120, config: { scope: defaultScope } });
        const o = createNode("output", { id: "n_out", x: 356, y: 120 });
        return {
          version: 1,
          zoom: 1,
          panX: 0,
          panY: 0,
          nodes: [s, o],
          edges: [{ id: "e_1", from: s.id, to: o.id }]
        };
      }
      const seenIds = /* @__PURE__ */ new Set();
      const nodes = [];
      for (const rawNode of raw.nodes) {
        if (!rawNode || typeof rawNode !== "object") continue;
        const def = getNodeDef(rawNode.type);
        if (!def) continue;
        const node = createNode(def.type, rawNode);
        if (seenIds.has(node.id)) continue;
        seenIds.add(node.id);
        if (node.type === "filter") {
          node.config.match = node.config.match === "any" ? "any" : "all";
          node.config.rules = Array.isArray(node.config.rules) ? node.config.rules.filter((r) => r && typeof r === "object").map((r) => ({
            field: typeof r.field === "string" ? r.field.trim() : "datasetName",
            op: FILTER_OPS.some((o) => o.id === r.op) ? r.op : "contains",
            value: r.value !== void 0 && r.value !== null ? String(r.value) : ""
          })) : [];
        }
        nodes.push(node);
      }
      const edgeKeys = /* @__PURE__ */ new Set();
      const edges = [];
      for (const rawEdge of Array.isArray(raw.edges) ? raw.edges : []) {
        if (!rawEdge || typeof rawEdge !== "object") continue;
        const from = typeof rawEdge.from === "string" ? rawEdge.from.trim() : "";
        const to = typeof rawEdge.to === "string" ? rawEdge.to.trim() : "";
        if (!from || !to || from === to || !seenIds.has(from) || !seenIds.has(to)) continue;
        const fromNode = nodes.find((n) => n.id === from);
        const toNode = nodes.find((n) => n.id === to);
        if (!getNodeDef(fromNode?.type)?.hasOut || !getNodeDef(toNode?.type)?.hasIn) continue;
        const key = `${from}->${to}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        edges.push({
          id: typeof rawEdge.id === "string" && rawEdge.id.trim() ? rawEdge.id.trim() : generateId("e"),
          from,
          to
        });
      }
      return {
        version: 1,
        zoom: Number.isFinite(Number(raw.zoom)) ? Math.max(0.45, Math.min(1.6, Number(raw.zoom))) : 1,
        panX: Number.isFinite(Number(raw.panX)) ? Number(raw.panX) : 0,
        panY: Number.isFinite(Number(raw.panY)) ? Number(raw.panY) : 0,
        nodes,
        edges
      };
    }
    function autoLayoutPipeline(pipeline) {
      const nodes = pipeline.nodes.map((n) => ({ ...n, config: { ...n.config } }));
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const incoming = new Map(nodes.map((n) => [n.id, []]));
      const outgoing = new Map(nodes.map((n) => [n.id, []]));
      for (const edge of pipeline.edges) {
        if (incoming.has(edge.to) && outgoing.has(edge.from)) {
          incoming.get(edge.to).push(edge.from);
          outgoing.get(edge.from).push(edge.to);
        }
      }
      const depth = /* @__PURE__ */ new Map();
      const queue = [];
      for (const node of nodes) {
        if (!incoming.get(node.id).length) {
          depth.set(node.id, 0);
          queue.push(node.id);
        }
      }
      const visited = /* @__PURE__ */ new Set();
      while (queue.length) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        const d = depth.get(id) ?? 0;
        for (const nextId of outgoing.get(id) || []) {
          const nextDepth = Math.max(depth.get(nextId) ?? 0, d + 1);
          depth.set(nextId, nextDepth);
          queue.push(nextId);
        }
      }
      for (const node of nodes) {
        if (!depth.has(node.id)) {
          depth.set(node.id, node.type === "output" ? 2 : 0);
        }
      }
      const columns = /* @__PURE__ */ new Map();
      for (const node of nodes) {
        const col = depth.get(node.id) ?? 0;
        if (!columns.has(col)) columns.set(col, []);
        columns.get(col).push(node);
      }
      const sortedCols = [...columns.keys()].sort((a, b) => a - b);
      for (const col of sortedCols) {
        const list = columns.get(col);
        list.sort((a, b) => a.y - b.y);
        list.forEach((node, rowIdx) => {
          const target = byId.get(node.id);
          target.x = 56 + col * 268;
          target.y = 64 + rowIdx * 136;
        });
      }
      return {
        ...pipeline,
        panX: 0,
        panY: 0,
        nodes
      };
    }
    function collectCanvasContext(app, doc) {
      const localDatasets = Array.isArray(doc?.datasets) ? doc.datasets : [];
      const childDatasets = doc?.kind === "tree" && doc?.treePath ? discoverChildDatasets(app, doc.treePath) : [];
      const fieldSet = /* @__PURE__ */ new Set();
      const datasetNameSet = /* @__PURE__ */ new Set();
      const childTitleSet = /* @__PURE__ */ new Set();
      const inspectDatasets = (list, filePath) => {
        for (const ds of list) {
          if (!ds) continue;
          if (ds.name) datasetNameSet.add(ds.name);
          for (const k of ds.metricKeys || []) {
            if (k) fieldSet.add(k);
          }
          if (ds.type === "note" || ds.type === "note_time") {
            const entries = resolveDatasetEntries(app, ds, filePath);
            for (const entry of entries) {
              for (const fk of Object.keys(entry.fields || {})) {
                if (fk && fk !== "title" && fk !== "type" && fk !== "tags") fieldSet.add(fk);
              }
            }
          }
        }
      };
      inspectDatasets(localDatasets, doc?.file?.path || "");
      for (const item of childDatasets) {
        if (item.childTitle) childTitleSet.add(item.childTitle);
        inspectDatasets([item.dataset], item.filePath);
      }
      return {
        localDatasets,
        childDatasets,
        fieldNames: [...fieldSet].sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" })),
        datasetNames: [...datasetNameSet].sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" })),
        childTitles: [...childTitleSet].sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" }))
      };
    }
    function readItemField(item, field) {
      if (!field) return void 0;
      if (field === "datasetName") return item.datasetName;
      if (field === "sourceTitle") return item.sourceTitle;
      if (field === "sourceKind") return item.sourceKind;
      if (field === "datasetType") return item.datasetType;
      if (field === "title" || field === "label") return item.label;
      if (field === "unit") return item.unit;
      if (field === "date") return item.date;
      if (field === "value") return item.value;
      if (field === "path") return item.path;
      if (field.startsWith("prop:")) {
        const k = field.slice(5).trim();
        return item.fields?.[k];
      }
      return item.fields?.[field];
    }
    function ruleMatchesItem(item, rule, now = /* @__PURE__ */ new Date()) {
      const rawField = typeof rule.field === "string" ? rule.field.trim() : "";
      if (!rawField) return true;
      const val = readItemField(item, rawField);
      const op = rule.op || "contains";
      const targetStr = rule.value !== void 0 && rule.value !== null ? String(rule.value).trim() : "";
      if (op === "exists") {
        return val !== void 0 && val !== null && String(val).trim() !== "";
      }
      if (op === "is_number") {
        return toFiniteNumber(val) !== null;
      }
      if (op === "this_month") {
        const itemMonth = periodKeyFor(typeof val === "string" ? val : item.date, "monthly");
        const curMonth = periodKeyFor(toDateKey(now), "monthly");
        return Boolean(itemMonth && itemMonth === curMonth);
      }
      if (op === "this_week") {
        const itemWeek = periodKeyFor(typeof val === "string" ? val : item.date, "weekly");
        const curWeek = periodKeyFor(toDateKey(now), "weekly");
        return Boolean(itemWeek && itemWeek === curWeek);
      }
      if (op === "within_days") {
        const days = toFiniteNumber(targetStr);
        const parsedItem = parseDateKey(typeof val === "string" ? val : item.date);
        const parsedToday = parseDateKey(toDateKey(now));
        if (days === null || !parsedItem || !parsedToday) return false;
        const diff = Math.round((parsedToday.getTime() - parsedItem.getTime()) / 864e5);
        return diff >= 0 && diff <= days;
      }
      const valNum = toFiniteNumber(val);
      const targetNum = toFiniteNumber(targetStr);
      if (op === "gt" || op === "gte" || op === "lt" || op === "lte") {
        if (valNum === null || targetNum === null) return false;
        if (op === "gt") return valNum > targetNum;
        if (op === "gte") return valNum >= targetNum;
        if (op === "lt") return valNum < targetNum;
        return valNum <= targetNum;
      }
      if (op === "equals" || op === "not_equals") {
        let isEqual = false;
        if (valNum !== null && targetNum !== null) {
          isEqual = valNum === targetNum;
        } else if (val !== void 0 && val !== null) {
          isEqual = String(val).trim().toLowerCase() === targetStr.toLowerCase();
        } else {
          isEqual = targetStr === "";
        }
        return op === "equals" ? isEqual : !isEqual;
      }
      const hay = val !== void 0 && val !== null ? String(val).toLowerCase() : "";
      const needle = targetStr.toLowerCase();
      if (!needle) return true;
      if (op === "not_contains") return !hay.includes(needle);
      return hay.includes(needle);
    }
    function collectSourceDatasetItems(app, ds, ownerFile, ownerTitle, ownerKind, out) {
      const entries = resolveDatasetEntries(app, ds, ownerFile?.path || "");
      for (const entry of entries) {
        out.push({
          id: `${ownerFile?.path || ""}::${ds.id}::${entry.index}`,
          index: out.length,
          label: entry.label || ownerTitle,
          date: entry.date || null,
          value: entry.value !== void 0 ? entry.value : null,
          unit: ds.unit || "",
          noteFile: entry.noteFile || null,
          path: entry.path || "",
          sourceFile: entry.sourceFile || ownerFile || null,
          sourceTitle: entry.sourceTitle || ownerTitle || "",
          sourceKind: entry.childKind || ownerKind || "goal",
          datasetId: ds.id,
          datasetName: entry.datasetName || ds.name,
          datasetType: ds.type,
          fields: entry.fields || {},
          propsList: entry.propsList || []
        });
      }
    }
    function evalSourceNode(app, node, doc) {
      const cfg = node.config || {};
      const scope = cfg.scope || (doc?.kind === "tree" ? "tree_children" : "this_goal");
      const childKinds = cfg.childKinds || "all";
      const dsFilter = cfg.datasetFilter || "any";
      const nameNeedle = typeof cfg.nameMatch === "string" ? cfg.nameMatch.trim().toLowerCase() : "";
      const targetDsId = typeof cfg.datasetId === "string" ? cfg.datasetId.trim() : "";
      const items = [];
      if ((scope === "this_goal" || scope === "both") && doc) {
        for (const ds of doc.datasets || []) {
          if (targetDsId && ds.id !== targetDsId) continue;
          if (!targetDsId && !datasetMatchesFilter(ds, dsFilter)) continue;
          if (nameNeedle) {
            const dMatch = (ds.name || "").toLowerCase().includes(nameNeedle);
            const tMatch = (doc.title || "").toLowerCase().includes(nameNeedle);
            if (!dMatch && !tMatch) continue;
          }
          collectSourceDatasetItems(app, ds, doc.file, doc.title, doc.kind, items);
        }
      }
      if ((scope === "tree_children" || scope === "both") && doc?.treePath) {
        const discovered = discoverChildDatasets(app, doc.treePath);
        for (const child of discovered) {
          if (targetDsId && child.dataset.id !== targetDsId) continue;
          if (childKinds === "habits" && child.childKind !== "habit") continue;
          if (childKinds === "subgoals" && child.childKind !== "subgoal") continue;
          if (!targetDsId && !datasetMatchesFilter(child.dataset, dsFilter)) continue;
          if (nameNeedle) {
            const dMatch = (child.dataset.name || "").toLowerCase().includes(nameNeedle);
            const cMatch = (child.childTitle || "").toLowerCase().includes(nameNeedle);
            if (!dMatch && !cMatch) continue;
          }
          collectSourceDatasetItems(app, child.dataset, child.file, child.childTitle, child.childKind, items);
        }
      }
      return items;
    }
    function collectMarkdownFilesRecursive(folder, acc = []) {
      if (!isFolder(folder)) return acc;
      for (const child of folder.children) {
        if (!child?.name || child.name.startsWith(".") || child.name.startsWith("_")) continue;
        if (isFolder(child)) collectMarkdownFilesRecursive(child, acc);
        else if (child.extension === "md") acc.push(child);
      }
      return acc;
    }
    function evalWaterSourceNode(app, node, doc) {
      const cfg = node.config || {};
      const scope = cfg.scope || (doc?.kind === "habit" ? "this_habit" : "tree_habits");
      const needle = typeof cfg.nameMatch === "string" ? cfg.nameMatch.trim().toLowerCase() : "";
      const files = [];
      if (scope === "this_habit" && doc?.kind === "habit" && doc.file) {
        files.push(doc.file);
      } else if (doc?.treePath) {
        const folder = app.vault.getAbstractFileByPath(doc.treePath);
        for (const f of collectMarkdownFilesRecursive(folder, [])) {
          if (f.path.includes("/habits/")) files.push(f);
        }
      }
      const items = [];
      for (const file of files) {
        const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const title = typeof fm.title === "string" && fm.title.trim() ? fm.title.trim() : stripMd(file.name);
        if (needle && !title.toLowerCase().includes(needle)) continue;
        const dates = mergeWaterDates(fm.water_log, fm.last_watered);
        for (const date of dates) {
          items.push({
            id: `water::${file.path}::${date}`,
            index: items.length,
            label: title,
            date,
            value: 1,
            unit: "waterings",
            noteFile: null,
            path: "",
            sourceFile: file,
            sourceTitle: title,
            sourceKind: "habit",
            datasetId: "__water_log",
            datasetName: "Watering log",
            datasetType: "water_log",
            fields: { date, value: 1, sourceTitle: title, sourceKind: "habit" },
            propsList: []
          });
        }
      }
      return items;
    }
    function evalExtractNode(items, cfg) {
      const field = typeof cfg.field === "string" ? cfg.field.trim() : "";
      const fallback = Boolean(cfg.fallbackToValue);
      const dropMissing = cfg.dropMissing !== false;
      const unitOverride = typeof cfg.unit === "string" ? cfg.unit.trim() : "";
      const out = [];
      for (const item of items) {
        let extracted = null;
        if (field === "1" || field === "__count_1") {
          extracted = 1;
        } else if (!field || field === "value") {
          extracted = toFiniteNumber(item.value);
        } else {
          const raw = readItemField(item, field);
          extracted = toFiniteNumber(raw);
          if (extracted === null && fallback) {
            extracted = toFiniteNumber(item.value);
          }
        }
        if (extracted === null && dropMissing) continue;
        out.push({
          ...item,
          index: out.length,
          value: extracted,
          unit: unitOverride || item.unit
        });
      }
      return out;
    }
    function evalMathNode(items, cfg) {
      const op = cfg.op || "multiply";
      const operand = toFiniteNumber(cfg.operand);
      const n = operand === null ? 1 : operand;
      const unitOverride = typeof cfg.unit === "string" ? cfg.unit.trim() : "";
      const out = [];
      for (const item of items) {
        const v = toFiniteNumber(item.value);
        if (v === null) {
          out.push({ ...item, index: out.length });
          continue;
        }
        let next = v;
        if (op === "multiply") next = v * n;
        else if (op === "divide") next = n !== 0 ? v / n : v;
        else if (op === "add") next = v + n;
        else if (op === "subtract") next = v - n;
        else if (op === "round") {
          const factor = 10 ** Math.max(0, Math.min(4, Math.round(n)));
          next = Math.round(v * factor) / factor;
        } else if (op === "abs") next = Math.abs(v);
        else if (op === "clamp_min") next = Math.max(n, v);
        else if (op === "clamp_max") next = Math.min(n, v);
        out.push({
          ...item,
          index: out.length,
          value: next,
          unit: unitOverride || item.unit
        });
      }
      return out;
    }
    function aggregateNumericList(items, agg) {
      if (agg === "count") return items.length;
      const nums = items.map((i) => toFiniteNumber(i.value)).filter((v) => v !== null);
      if (!nums.length) return null;
      if (agg === "sum") return nums.reduce((a, b) => a + b, 0);
      if (agg === "average") return nums.reduce((a, b) => a + b, 0) / nums.length;
      if (agg === "max") return Math.max(...nums);
      if (agg === "min") return Math.min(...nums);
      if (agg === "latest") {
        const dated = items.filter((i) => toFiniteNumber(i.value) !== null).sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.index - b.index);
        return dated.length ? toFiniteNumber(dated[dated.length - 1].value) : nums[nums.length - 1];
      }
      return nums.reduce((a, b) => a + b, 0);
    }
    function evalGroupNode(items, cfg) {
      const by = cfg.by || "sourceTitle";
      const agg = cfg.agg || "sum";
      const propKey = typeof cfg.propKey === "string" ? cfg.propKey.trim() : "";
      const groups = /* @__PURE__ */ new Map();
      for (const item of items) {
        let key = "";
        if (by === "sourceTitle") key = item.sourceTitle || item.label || "Unknown";
        else if (by === "datasetName") key = item.datasetName || "List";
        else if (by === "day") key = parseDateKey(item.date) ? item.date : "Undated";
        else if (by === "week") key = periodKeyFor(item.date, "weekly") || "Undated";
        else if (by === "month") key = periodKeyFor(item.date, "monthly") || "Undated";
        else if (by === "prop") {
          const v = propKey ? readItemField(item, propKey) : "";
          key = v !== void 0 && v !== null && String(v).trim() !== "" ? String(v).trim() : "(none)";
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      }
      const out = [];
      for (const [key, list] of groups.entries()) {
        const value = aggregateNumericList(list, agg);
        if (value === null) continue;
        const units = new Set(list.map((i) => i.unit).filter(Boolean));
        const unit = agg === "count" ? "" : units.size === 1 ? [...units][0] : "";
        const latestDate = list.map((i) => i.date || "").filter(Boolean).sort().pop() || (by === "day" && parseDateKey(key) ? key : null);
        out.push({
          id: `grp::${key}`,
          index: out.length,
          label: key,
          date: latestDate,
          value,
          unit,
          noteFile: null,
          path: "",
          sourceFile: list[0]?.sourceFile || null,
          sourceTitle: key,
          sourceKind: "group",
          datasetName: list[0]?.datasetName || "",
          datasetType: "group",
          fields: { group: key, count: list.length, value },
          propsList: []
        });
      }
      if (by === "day" || by === "week" || by === "month") {
        out.sort((a, b) => a.label.localeCompare(b.label));
      }
      return out;
    }
    function evalSortNode(items, cfg) {
      const by = cfg.by || "date_asc";
      const limit = Number(cfg.limit) || 0;
      const sorted = [...items];
      if (by === "date_asc") {
        sorted.sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.index - b.index);
      } else if (by === "date_desc") {
        sorted.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.index - a.index);
      } else if (by === "value_desc") {
        sorted.sort((a, b) => (toFiniteNumber(b.value) ?? -Infinity) - (toFiniteNumber(a.value) ?? -Infinity));
      } else if (by === "value_asc") {
        sorted.sort((a, b) => (toFiniteNumber(a.value) ?? Infinity) - (toFiniteNumber(b.value) ?? Infinity));
      } else if (by === "label_asc") {
        sorted.sort((a, b) => (a.label || "").localeCompare(b.label || "", void 0, { sensitivity: "base" }));
      }
      const sliced = limit > 0 ? sorted.slice(0, Math.round(limit)) : sorted;
      return sliced.map((item, idx) => ({ ...item, index: idx }));
    }
    function evalMergeNode(branches, cfg) {
      const dedupe = cfg.dedupe || "none";
      const combined = [];
      const seen = /* @__PURE__ */ new Set();
      for (const list of branches) {
        for (const item of list) {
          if (dedupe === "path" && item.path) {
            if (seen.has(item.path)) continue;
            seen.add(item.path);
          } else if (dedupe === "id" && item.id) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
          }
          combined.push({ ...item, index: combined.length });
        }
      }
      return combined;
    }
    function inferItemsUnit(items, explicitUnit = "") {
      if (typeof explicitUnit === "string" && explicitUnit.trim()) return explicitUnit.trim();
      const units = new Set(items.map((i) => typeof i.unit === "string" ? i.unit.trim() : "").filter(Boolean));
      return units.size === 1 ? [...units][0] : "";
    }
    function buildOutputPayload(items, cfg = {}) {
      const displayType = ["stat", "goal_bar", "chart", "note_navigator"].includes(cfg.displayType) ? cfg.displayType : "stat";
      const agg = cfg.agg || "sum";
      const mode = cfg.mode || "sum";
      const unit = inferItemsUnit(items, cfg.unit || "");
      const numericPoints = items.map((item, idx) => ({ ...item, index: idx, value: toFiniteNumber(item.value) })).filter((item) => item.value !== null && Number.isFinite(item.value));
      const effectiveStatAgg = displayType === "goal_bar" ? mode : agg;
      let statValue = null;
      if (effectiveStatAgg === "count") {
        statValue = items.length;
      } else {
        statValue = aggregateNumericList(numericPoints, effectiveStatAgg);
      }
      const effectiveUnit = effectiveStatAgg === "count" ? "" : unit;
      const statCount = effectiveStatAgg === "count" ? items.length : numericPoints.length;
      const stat = {
        value: statValue,
        display: statValue === null ? "\u2014" : formatNumber(statValue),
        unit: effectiveUnit,
        count: statCount
      };
      const targetNum = toFiniteNumber(cfg.target);
      const current = statValue ?? 0;
      const ratio = targetNum && targetNum > 0 ? current / targetNum : 0;
      const rawPercent = targetNum && targetNum > 0 ? Math.round(ratio * 100) : 0;
      const bar = {
        current: statValue,
        currentDisplay: statValue === null ? "\u2014" : formatNumber(statValue),
        target: targetNum,
        targetDisplay: targetNum === null ? "\u2014" : formatNumber(targetNum),
        rawPercent,
        fillPercent: Math.max(0, Math.min(100, rawPercent)),
        unit: mode === "count" ? "" : unit
      };
      const chartPoints = numericPoints.some((p) => Boolean(p.date)) ? [...numericPoints].sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.index - b.index) : numericPoints;
      return {
        displayType,
        agg,
        mode,
        target: targetNum,
        variant: cfg.variant === "bar" ? "bar" : "line",
        unit,
        stat,
        bar,
        points: chartPoints,
        entries: items
      };
    }
    function evaluatePipeline(app, rawPipeline, doc, now = /* @__PURE__ */ new Date()) {
      const pipeline = normalizePipeline(rawPipeline, doc);
      const byId = new Map(pipeline.nodes.map((n) => [n.id, n]));
      const inEdges = new Map(pipeline.nodes.map((n) => [n.id, []]));
      const outEdges = new Map(pipeline.nodes.map((n) => [n.id, []]));
      for (const edge of pipeline.edges) {
        if (inEdges.has(edge.to) && outEdges.has(edge.from)) {
          inEdges.get(edge.to).push(edge.from);
          outEdges.get(edge.from).push(edge.to);
        }
      }
      const inDegree = new Map(pipeline.nodes.map((n) => [n.id, inEdges.get(n.id).length]));
      const queue = pipeline.nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
      const order = [];
      const seen = /* @__PURE__ */ new Set();
      while (queue.length) {
        const id = queue.shift();
        if (seen.has(id)) continue;
        seen.add(id);
        order.push(id);
        for (const nextId of outEdges.get(id) || []) {
          const deg = (inDegree.get(nextId) ?? 1) - 1;
          inDegree.set(nextId, deg);
          if (deg <= 0) queue.push(nextId);
        }
      }
      for (const node of pipeline.nodes) {
        if (!seen.has(node.id)) order.push(node.id);
      }
      const nodeResults = /* @__PURE__ */ new Map();
      let lastOutputPayload = null;
      let lastItems = [];
      for (const id of order) {
        const node = byId.get(id);
        if (!node) continue;
        const parentIds = inEdges.get(id) || [];
        const branches = parentIds.map((pid) => nodeResults.get(pid)?.items || []);
        const flatIn = branches.flat().map((item, idx) => ({ ...item, index: idx }));
        let outItems = [];
        if (node.type === "source") {
          outItems = evalSourceNode(app, node, doc);
        } else if (node.type === "water_source") {
          outItems = evalWaterSourceNode(app, node, doc);
        } else if (node.type === "filter") {
          const rules = Array.isArray(node.config?.rules) ? node.config.rules : [];
          const matchAny = node.config?.match === "any";
          outItems = flatIn.filter((item) => {
            if (!rules.length) return true;
            return matchAny ? rules.some((rule) => ruleMatchesItem(item, rule, now)) : rules.every((rule) => ruleMatchesItem(item, rule, now));
          }).map((item, idx) => ({ ...item, index: idx }));
        } else if (node.type === "extract") {
          outItems = evalExtractNode(flatIn, node.config || {});
        } else if (node.type === "math") {
          outItems = evalMathNode(flatIn, node.config || {});
        } else if (node.type === "group") {
          outItems = evalGroupNode(flatIn, node.config || {});
        } else if (node.type === "sort") {
          outItems = evalSortNode(flatIn, node.config || {});
        } else if (node.type === "merge") {
          outItems = evalMergeNode(branches, node.config || {});
        } else if (node.type === "output") {
          outItems = flatIn;
          lastOutputPayload = buildOutputPayload(outItems, node.config || {});
        }
        lastItems = outItems;
        nodeResults.set(id, {
          items: outItems,
          count: outItems.length
        });
      }
      if (!lastOutputPayload) {
        lastOutputPayload = buildOutputPayload(lastItems, { displayType: "stat", agg: "sum" });
      }
      return {
        pipeline,
        nodeResults,
        output: lastOutputPayload
      };
    }
    function formatPipelineNodeSummary(node) {
      const cfg = node.config || {};
      if (node.type === "source") {
        const scopeMap = { tree_children: "Tree children", this_goal: "This goal", both: "Goal + children" };
        const parts = [scopeMap[cfg.scope] || "Data"];
        if (cfg.nameMatch) parts.push(`"${cfg.nameMatch}"`);
        else if (cfg.datasetFilter && cfg.datasetFilter !== "any") parts.push(cfg.datasetFilter);
        return parts.join(" \xB7 ");
      }
      if (node.type === "water_source") {
        return cfg.nameMatch ? `Habit logs "${cfg.nameMatch}"` : "Habit watering dates";
      }
      if (node.type === "filter") {
        const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
        if (!rules.length) return "Pass all items";
        const r = rules[0];
        const base = `${r.field} ${r.op}${OPS_WITHOUT_VALUE.has(r.op) ? "" : ` "${r.value || "\u2026"}"`}`;
        return rules.length > 1 ? `${base} (+${rules.length - 1})` : base;
      }
      if (node.type === "extract") {
        const field = cfg.field === "1" || cfg.field === "__count_1" ? "count (1)" : cfg.field || "value";
        return cfg.unit ? `${field} (${cfg.unit})` : `Field: ${field}`;
      }
      if (node.type === "math") {
        if (cfg.op === "abs") return "abs(value)";
        return `${cfg.op} ${cfg.operand ?? 1}`;
      }
      if (node.type === "group") {
        return `By ${cfg.by === "prop" ? cfg.propKey || "prop" : cfg.by} \xB7 ${cfg.agg || "sum"}`;
      }
      if (node.type === "sort") {
        return cfg.limit > 0 ? `${cfg.by} \xB7 top ${cfg.limit}` : cfg.by;
      }
      if (node.type === "merge") {
        return cfg.dedupe === "path" ? "Combine \xB7 unique notes" : "Combine inputs";
      }
      if (node.type === "output") {
        if (cfg.displayType === "goal_bar") return `Progress bar / ${cfg.target ?? "?"}`;
        if (cfg.displayType === "chart") return `${cfg.variant === "bar" ? "Bar" : "Line"} graph`;
        if (cfg.displayType === "note_navigator") return "Note navigator";
        return `Stat \xB7 ${cfg.agg || "sum"}${cfg.unit ? ` (${cfg.unit})` : ""}`;
      }
      return "";
    }
    function buildPipelineTemplate(templateId, doc, context = null) {
      const isTree = doc?.kind === "tree";
      const defaultScope = isTree ? "tree_children" : "this_goal";
      const fields = context?.fieldNames || [];
      const preferredField = fields.find((k) => k.toLowerCase().includes("page")) || fields.find((k) => k.toLowerCase().includes("chapter")) || fields[0] || "pages";
      if (templateId === "filter_field") {
        const src = createNode("source", {
          id: "n_src",
          config: { scope: defaultScope, datasetFilter: "any" }
        });
        const flt = createNode("filter", {
          id: "n_flt",
          config: {
            match: "any",
            rules: [
              { field: "datasetName", op: "contains", value: preferredField },
              { field: preferredField, op: "is_number", value: "" }
            ]
          }
        });
        const ext = createNode("extract", {
          id: "n_ext",
          config: { field: preferredField, fallbackToValue: true, dropMissing: true, unit: preferredField }
        });
        const out = createNode("output", {
          id: "n_out",
          config: { displayType: "stat", agg: "sum", unit: preferredField }
        });
        return autoLayoutPipeline({
          version: 1,
          zoom: 1,
          panX: 0,
          panY: 0,
          nodes: [src, flt, ext, out],
          edges: [
            { id: "e_1", from: src.id, to: flt.id },
            { id: "e_2", from: flt.id, to: ext.id },
            { id: "e_3", from: ext.id, to: out.id }
          ]
        });
      }
      if (templateId === "compare_children") {
        const src = createNode("source", {
          id: "n_src",
          config: { scope: defaultScope, childKinds: "all", datasetFilter: "numeric" }
        });
        const grp = createNode("group", {
          id: "n_grp",
          config: { by: isTree ? "sourceTitle" : "month", agg: "sum" }
        });
        const out = createNode("output", {
          id: "n_out",
          config: { displayType: "chart", variant: "bar" }
        });
        return autoLayoutPipeline({
          version: 1,
          zoom: 1,
          panX: 0,
          panY: 0,
          nodes: [src, grp, out],
          edges: [
            { id: "e_1", from: src.id, to: grp.id },
            { id: "e_2", from: grp.id, to: out.id }
          ]
        });
      }
      if (templateId === "merge_branches") {
        const srcA = createNode("source", {
          id: "n_src_a",
          label: "Branch A",
          config: { scope: defaultScope, datasetFilter: "numeric" }
        });
        const srcB = createNode("source", {
          id: "n_src_b",
          label: "Branch B (Notes)",
          config: { scope: defaultScope, datasetFilter: "note" }
        });
        const extB = createNode("extract", {
          id: "n_ext_b",
          config: { field: preferredField, fallbackToValue: false, dropMissing: true, unit: preferredField }
        });
        const mrg = createNode("merge", { id: "n_mrg", config: { dedupe: "none" } });
        const out = createNode("output", {
          id: "n_out",
          config: { displayType: "stat", agg: "sum" }
        });
        return autoLayoutPipeline({
          version: 1,
          zoom: 1,
          panX: 0,
          panY: 0,
          nodes: [srcA, srcB, extB, mrg, out],
          edges: [
            { id: "e_1", from: srcA.id, to: mrg.id },
            { id: "e_2", from: srcB.id, to: extB.id },
            { id: "e_3", from: extB.id, to: mrg.id },
            { id: "e_4", from: mrg.id, to: out.id }
          ]
        });
      }
      if (templateId === "filtered_notes") {
        const src = createNode("source", {
          id: "n_src",
          config: { scope: defaultScope, datasetFilter: "note" }
        });
        const flt = createNode("filter", {
          id: "n_flt",
          config: {
            match: "all",
            rules: [{ field: "date", op: "this_month", value: "" }]
          }
        });
        const out = createNode("output", {
          id: "n_out",
          config: { displayType: "note_navigator" }
        });
        return autoLayoutPipeline({
          version: 1,
          zoom: 1,
          panX: 0,
          panY: 0,
          nodes: [src, flt, out],
          edges: [
            { id: "e_1", from: src.id, to: flt.id },
            { id: "e_2", from: flt.id, to: out.id }
          ]
        });
      }
      return normalizePipeline(null, doc);
    }
    function buildPipelineFromSimpleConfig(config = {}, doc = null) {
      const scope = config.relation ? "tree_children" : doc?.kind === "tree" && !config.datasetId ? "tree_children" : "this_goal";
      const pickedRefDsId = config.relation?.mode === "pick" && config.relation.refs?.length === 1 ? config.relation.refs[0].datasetId : "";
      const srcConfig = {
        scope,
        childKinds: config.relation?.childKinds || "all",
        datasetFilter: config.relation?.dataFilter || "any",
        datasetId: config.datasetId || pickedRefDsId || "",
        nameMatch: config.relation?.nameMatch || ""
      };
      const nodes = [createNode("source", { id: "n_src", config: srcConfig })];
      const edges = [];
      let tail = nodes[0];
      if (config.metricKey) {
        const ext = createNode("extract", {
          id: "n_ext",
          config: {
            field: config.metricKey,
            fallbackToValue: false,
            dropMissing: true,
            unit: config.unit || ""
          }
        });
        nodes.push(ext);
        edges.push({ id: generateId("e"), from: tail.id, to: ext.id });
        tail = ext;
      }
      if (config.relation?.perChildAgg && config.relation.perChildAgg !== "all") {
        const grp = createNode("group", {
          id: "n_grp",
          config: { by: "sourceTitle", agg: config.relation.perChildAgg }
        });
        nodes.push(grp);
        edges.push({ id: generateId("e"), from: tail.id, to: grp.id });
        tail = grp;
      }
      const outType = ["stat", "goal_bar", "chart", "note_navigator"].includes(config.type) ? config.type : "stat";
      const out = createNode("output", {
        id: "n_out",
        config: {
          displayType: outType,
          agg: config.agg || "sum",
          mode: config.mode || "sum",
          target: config.target ?? 100,
          variant: config.variant || "line",
          unit: config.unit || ""
        }
      });
      nodes.push(out);
      edges.push({ id: generateId("e"), from: tail.id, to: out.id });
      return autoLayoutPipeline({
        version: 1,
        zoom: 1,
        panX: 0,
        panY: 0,
        nodes,
        edges
      });
    }
    module2.exports = {
      PIPELINE_NODE_TYPES,
      FILTER_FIELD_PRESETS,
      FILTER_OPS,
      OPS_WITHOUT_VALUE,
      MATH_OPS,
      GROUP_BYS,
      SORT_BYS,
      getNodeDef,
      createNode,
      normalizePipeline,
      autoLayoutPipeline,
      collectCanvasContext,
      evaluatePipeline,
      formatPipelineNodeSummary,
      buildPipelineTemplate,
      buildPipelineFromSimpleConfig
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
          const detail = pt.noteFile ? pt.label : pt.sourceTitle;
          const clickable = Boolean((pt.noteFile || pt.sourceFile) && onPointClick);
          const rect = svgEl("rect", {
            x: round(pt.x - barW / 2),
            y: round(baselineY - barH),
            width: round(barW),
            height: round(barH),
            rx: Math.min(4, round(barW / 3)),
            class: `iter-chart-bar${clickable ? " is-clickable" : ""}`
          });
          const tip = svgEl("title");
          tip.textContent = `${pt.date ? `${pt.date}: ` : ""}${pt.value}${unit ? ` ${unit}` : ""}${detail ? ` \xB7 ${detail}` : ""}`;
          rect.appendChild(tip);
          if (clickable) {
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
          const detail = pt.noteFile ? pt.label : pt.sourceTitle;
          const clickable = Boolean((pt.noteFile || pt.sourceFile) && onPointClick);
          const circle = svgEl("circle", {
            cx: pt.x,
            cy: pt.y,
            r: coords.length === 1 ? 4.5 : 3.5,
            class: `iter-chart-dot${clickable ? " is-clickable" : ""}`
          });
          const tip = svgEl("title");
          tip.textContent = `${pt.date ? `${pt.date}: ` : ""}${pt.value}${unit ? ` ${unit}` : ""}${detail ? ` \xB7 ${detail}` : ""}`;
          circle.appendChild(tip);
          if (clickable) {
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

// src/canvas-editor.js
var require_canvas_editor = __commonJS({
  "src/canvas-editor.js"(exports2, module2) {
    var { Modal, Notice: Notice2, setIcon } = require("obsidian");
    var { formatNumber, STAT_AGGS, BAR_MODES, CHART_VARIANTS } = require_data_model();
    var { renderChartSvg } = require_widget_art();
    var {
      PIPELINE_NODE_TYPES,
      FILTER_FIELD_PRESETS,
      FILTER_OPS,
      OPS_WITHOUT_VALUE,
      MATH_OPS,
      GROUP_BYS,
      SORT_BYS,
      getNodeDef,
      createNode,
      normalizePipeline,
      autoLayoutPipeline,
      collectCanvasContext,
      evaluatePipeline,
      formatPipelineNodeSummary,
      buildPipelineTemplate
    } = require_pipeline();
    var NODE_WIDTH = 218;
    var PORT_OFFSET_Y = 44;
    var CANVAS_W = 2400;
    var CANVAS_H = 1600;
    var SVG_NS = "http://www.w3.org/2000/svg";
    function renderWidgetDisplayBody(card, payload, { onOpenFile, onOpenGoal, onMissingNote } = {}) {
      const displayType = payload.displayType || "stat";
      const unit = payload.unit || "";
      if (displayType === "stat") {
        const res = payload.stat || { display: "\u2014", unit: "", count: 0 };
        const valRow = card.createDiv({ cls: "iter-stat-value-row" });
        valRow.createSpan({ text: res.display, cls: "iter-stat-number" });
        if (res.unit && payload.agg !== "count") {
          valRow.createSpan({ text: res.unit, cls: "iter-stat-unit" });
        }
        const labelMap = {
          count: "entries",
          sum: "Total",
          average: "Average",
          latest: "Latest",
          max: "Max",
          min: "Min"
        };
        const subLabel = payload.agg === "count" ? `${res.count} ${res.count === 1 ? "entry" : "entries"}` : `${labelMap[payload.agg] || payload.agg || "Result"} \xB7 ${res.count} ${res.count === 1 ? "point" : "points"}`;
        card.createDiv({ text: subLabel, cls: "iter-stat-sub" });
        return;
      }
      if (displayType === "goal_bar") {
        const bar = payload.bar || {
          currentDisplay: "\u2014",
          targetDisplay: "\u2014",
          rawPercent: 0,
          fillPercent: 0,
          unit: ""
        };
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
      if (displayType === "chart") {
        const points = payload.points || [];
        if (!points.length) {
          card.createEl("p", {
            text: payload.emptyText || "No numeric items matched this flow yet.",
            cls: "iter-widget-empty"
          });
          return;
        }
        const latest = points[points.length - 1];
        const delta = points.length > 1 ? latest.value - points[0].value : null;
        const summary = card.createDiv({ cls: "iter-chart-summary" });
        summary.createSpan({
          text: `Latest: ${formatNumber(latest.value)}${unit ? ` ${unit}` : ""}`
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
          variant: payload.variant || "line",
          unit,
          onPointClick: (pt) => {
            if (pt.noteFile && onOpenFile) onOpenFile(pt.noteFile);
            else if (pt.sourceFile && onOpenGoal) onOpenGoal(pt.sourceFile);
          }
        });
        return;
      }
      if (displayType === "note_navigator") {
        const entries = payload.entries || [];
        if (!entries.length) {
          card.createEl("p", { text: "No matching notes yet.", cls: "iter-widget-empty" });
          return;
        }
        const navList = card.createDiv({ cls: "iter-note-nav-list" });
        for (const entry of entries) {
          const itemBtn = navList.createEl("button", { cls: "iter-note-nav-item", type: "button" });
          const icon = itemBtn.createSpan({ cls: "iter-note-nav-icon" });
          setIcon(icon, entry.noteFile ? "file-text" : "target");
          const main = itemBtn.createSpan({ cls: "iter-note-nav-main" });
          main.createSpan({ text: entry.label, cls: "iter-note-nav-title" });
          if (entry.path) {
            const folder = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "Vault root";
            const origin = entry.sourceTitle ? `${entry.sourceTitle} \xB7 ${folder}` : folder;
            main.createSpan({ text: origin, cls: "iter-note-nav-path" });
          }
          if (Array.isArray(entry.propsList) && entry.propsList.length > 0) {
            for (const p of entry.propsList) {
              const valStr = p.num !== null ? formatNumber(p.num) : String(p.raw);
              itemBtn.createSpan({ text: `${p.key}: ${valStr}`, cls: "iter-note-score-pill" });
            }
          } else if (entry.value !== null && entry.value !== void 0) {
            itemBtn.createSpan({ text: formatNumber(entry.value), cls: "iter-note-score-pill" });
          }
          if (entry.date) {
            itemBtn.createSpan({ text: entry.date, cls: "iter-note-date-pill" });
          }
          itemBtn.addEventListener("click", () => {
            if (entry.noteFile && onOpenFile) onOpenFile(entry.noteFile);
            else if (entry.sourceFile && onOpenGoal) onOpenGoal(entry.sourceFile);
            else if (onMissingNote && entry.path) onMissingNote(entry.path);
          });
        }
      }
    }
    function bezierPath(x1, y1, x2, y2) {
      const dx = Math.max(48, Math.abs(x2 - x1) * 0.48);
      return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    }
    function renderSuggestionChips(container, items, onPick) {
      const clean = items.filter(Boolean).slice(0, 8);
      if (!clean.length) return;
      const wrap = container.createDiv({ cls: "iter-chip-suggestions" });
      for (const label of clean) {
        const chip = wrap.createEl("button", { text: label, type: "button", cls: "iter-suggest-chip" });
        chip.addEventListener("click", () => onPick(label));
      }
    }
    var WorkflowEditorModal = class extends Modal {
      constructor(app, { doc, initialTitle = "", initialPipeline = null, onSubmit }) {
        super(app);
        this.doc = doc;
        this.title = initialTitle || "";
        this.onSubmit = onSubmit;
        this.context = collectCanvasContext(app, doc);
        this.pipeline = normalizePipeline(initialPipeline, doc);
        this.selectedNodeId = this.pipeline.nodes.find((n) => n.type === "filter" || n.type === "extract")?.id || this.pipeline.nodes[0]?.id || null;
        this.selectedEdgeId = null;
        this.pendingFromNodeId = null;
        this.dragState = null;
        this.submitting = false;
        this.viewportEl = null;
        this.worldEl = null;
        this.svgEl = null;
        this.inspectorEl = null;
        this.previewEl = null;
        this.statusEl = null;
        this.nodeEls = /* @__PURE__ */ new Map();
        this.boundMove = null;
        this.boundUp = null;
        this.boundKey = null;
      }
      onOpen() {
        this.modalEl?.addClass?.("iter-flow-modal");
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("iter-flow-shell");
        const toolbar = contentEl.createDiv({ cls: "iter-flow-toolbar" });
        const titleGroup = toolbar.createDiv({ cls: "iter-flow-title-group" });
        const titleInput = titleGroup.createEl("input", {
          type: "text",
          placeholder: "Widget title (e.g. Pages Read Across Tree)",
          cls: "iter-flow-title-input"
        });
        titleInput.value = this.title;
        titleInput.addEventListener("input", () => {
          this.title = titleInput.value;
        });
        const palette = toolbar.createDiv({ cls: "iter-flow-palette" });
        for (const def of PIPELINE_NODE_TYPES) {
          const btn = palette.createEl("button", {
            type: "button",
            cls: `iter-flow-add-btn cat-${def.category}`,
            attr: { title: def.shortDesc }
          });
          btn.createSpan({ text: `+ ${def.label}` });
          btn.addEventListener("click", () => this.addNodeFromPalette(def.type));
        }
        const toolsRight = toolbar.createDiv({ cls: "iter-flow-tools-right" });
        const tplSelect = toolsRight.createEl("select", { cls: "iter-flow-tpl-select" });
        tplSelect.createEl("option", { value: "", text: "Load template\u2026" });
        tplSelect.createEl("option", { value: "filter_field", text: "Filter by property (e.g. pages)" });
        tplSelect.createEl("option", { value: "compare_children", text: "Compare children (Bar Chart)" });
        tplSelect.createEl("option", { value: "merge_branches", text: "Merge two branches" });
        tplSelect.createEl("option", { value: "filtered_notes", text: "Filtered Note Navigator" });
        tplSelect.createEl("option", { value: "blank", text: "Minimal (Source \u2192 Output)" });
        tplSelect.value = "";
        tplSelect.addEventListener("change", () => {
          const id = tplSelect.value;
          if (!id) return;
          this.pipeline = buildPipelineTemplate(id, this.doc, this.context);
          this.selectedNodeId = this.pipeline.nodes[1]?.id || this.pipeline.nodes[0]?.id || null;
          this.selectedEdgeId = null;
          this.pendingFromNodeId = null;
          tplSelect.value = "";
          this.refreshAll();
        });
        const layoutBtn = toolsRight.createEl("button", {
          text: "Auto-layout",
          type: "button",
          cls: "iter-btn-ghost"
        });
        layoutBtn.addEventListener("click", () => {
          this.pipeline = autoLayoutPipeline(this.pipeline);
          this.refreshCanvas();
        });
        const cancelBtn = toolsRight.createEl("button", {
          text: "Cancel",
          type: "button",
          cls: "iter-btn-ghost"
        });
        cancelBtn.addEventListener("click", () => this.close());
        const saveBtn = toolsRight.createEl("button", {
          text: "Save widget",
          type: "button",
          cls: "mod-cta"
        });
        saveBtn.addEventListener("click", async () => {
          if (this.submitting) return;
          this.submitting = true;
          saveBtn.disabled = true;
          try {
            if (!this.pipeline.nodes.length) {
              throw new Error("Add at least one node before saving.");
            }
            await this.onSubmit({
              type: "pipeline",
              title: this.title,
              pipeline: normalizePipeline(this.pipeline, this.doc)
            });
            this.close();
          } catch (err) {
            new Notice2(err instanceof Error ? err.message : String(err));
          } finally {
            this.submitting = false;
            saveBtn.disabled = false;
          }
        });
        const body = contentEl.createDiv({ cls: "iter-flow-body" });
        const canvasCol = body.createDiv({ cls: "iter-flow-canvas-col" });
        const statusBar = canvasCol.createDiv({ cls: "iter-flow-canvas-bar" });
        this.statusEl = statusBar.createSpan({ cls: "iter-flow-status-pill" });
        const zoomRow = statusBar.createDiv({ cls: "iter-flow-zoom-row" });
        const zoomOut = zoomRow.createEl("button", { text: "\u2212", type: "button", cls: "iter-btn-ghost" });
        const zoomReset = zoomRow.createEl("button", { text: "Reset view", type: "button", cls: "iter-btn-ghost" });
        const zoomIn = zoomRow.createEl("button", { text: "+", type: "button", cls: "iter-btn-ghost" });
        zoomOut.addEventListener("click", () => this.setZoom(this.pipeline.zoom - 0.12));
        zoomIn.addEventListener("click", () => this.setZoom(this.pipeline.zoom + 0.12));
        zoomReset.addEventListener("click", () => {
          this.pipeline.zoom = 1;
          this.pipeline.panX = 0;
          this.pipeline.panY = 0;
          this.applyWorldTransform();
        });
        this.viewportEl = canvasCol.createDiv({ cls: "iter-flow-viewport" });
        this.worldEl = this.viewportEl.createDiv({ cls: "iter-flow-world" });
        if (typeof document !== "undefined" && typeof document.createElementNS === "function") {
          const svg = document.createElementNS(SVG_NS, "svg");
          svg.setAttribute("class", "iter-flow-wires");
          svg.setAttribute("viewBox", `0 0 ${CANVAS_W} ${CANVAS_H}`);
          svg.setAttribute("width", String(CANVAS_W));
          svg.setAttribute("height", String(CANVAS_H));
          this.worldEl.appendChild(svg);
          this.svgEl = svg;
        }
        this.viewportEl.addEventListener("mousedown", (event) => {
          if (event.target !== this.viewportEl && event.target !== this.worldEl && event.target !== this.svgEl) return;
          this.selectedEdgeId = null;
          this.pendingFromNodeId = null;
          this.dragState = {
            kind: "pan",
            startX: event.clientX,
            startY: event.clientY,
            originPanX: this.pipeline.panX,
            originPanY: this.pipeline.panY
          };
          this.refreshInspector();
          this.renderWires(evaluatePipeline(this.app, this.pipeline, this.doc));
        });
        const sideCol = body.createDiv({ cls: "iter-flow-side" });
        this.inspectorEl = sideCol.createDiv({ cls: "iter-flow-inspector" });
        this.previewEl = sideCol.createDiv({ cls: "iter-flow-preview" });
        this.attachGlobalListeners();
        this.refreshAll();
      }
      attachGlobalListeners() {
        if (typeof window === "undefined" || !window?.addEventListener) return;
        this.boundMove = (event) => this.handlePointerMove(event);
        this.boundUp = (event) => this.handlePointerUp(event);
        this.boundKey = (event) => this.handleKeyDown(event);
        window.addEventListener("mousemove", this.boundMove);
        window.addEventListener("mouseup", this.boundUp);
        window.addEventListener("keydown", this.boundKey);
      }
      onClose() {
        if (typeof window !== "undefined" && window?.removeEventListener) {
          if (this.boundMove) window.removeEventListener("mousemove", this.boundMove);
          if (this.boundUp) window.removeEventListener("mouseup", this.boundUp);
          if (this.boundKey) window.removeEventListener("keydown", this.boundKey);
        }
        this.modalEl?.removeClass?.("iter-flow-modal");
        this.contentEl.empty();
      }
      setZoom(next) {
        this.pipeline.zoom = Math.max(0.45, Math.min(1.6, Math.round(next * 100) / 100));
        this.applyWorldTransform();
      }
      applyWorldTransform() {
        if (!this.worldEl) return;
        const { panX, panY, zoom } = this.pipeline;
        this.worldEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      }
      handlePointerMove(event) {
        if (!this.dragState) return;
        const zoom = this.pipeline.zoom || 1;
        if (this.dragState.kind === "pan") {
          this.pipeline.panX = this.dragState.originPanX + (event.clientX - this.dragState.startX);
          this.pipeline.panY = this.dragState.originPanY + (event.clientY - this.dragState.startY);
          this.applyWorldTransform();
          return;
        }
        if (this.dragState.kind === "node") {
          const node = this.pipeline.nodes.find((n) => n.id === this.dragState.nodeId);
          if (!node) return;
          const dx = (event.clientX - this.dragState.startX) / zoom;
          const dy = (event.clientY - this.dragState.startY) / zoom;
          node.x = Math.max(16, Math.min(CANVAS_W - NODE_WIDTH - 24, Math.round(this.dragState.originX + dx)));
          node.y = Math.max(16, Math.min(CANVAS_H - 120, Math.round(this.dragState.originY + dy)));
          const card = this.nodeEls.get(node.id);
          if (card) {
            card.style.left = `${node.x}px`;
            card.style.top = `${node.y}px`;
          }
          this.renderWires();
          return;
        }
        if (this.dragState.kind === "wire") {
          const moved = Math.hypot(event.clientX - this.dragState.startX, event.clientY - this.dragState.startY);
          if (moved > 5) this.dragState.dragged = true;
          const rect = this.viewportEl?.getBoundingClientRect?.();
          if (rect) {
            this.dragState.cursorX = (event.clientX - rect.left - this.pipeline.panX) / zoom;
            this.dragState.cursorY = (event.clientY - rect.top - this.pipeline.panY) / zoom;
            this.renderWires();
          }
        }
      }
      handlePointerUp() {
        if (!this.dragState) return;
        const prev = this.dragState;
        this.dragState = null;
        if (prev.kind === "wire" && prev.dragged) {
          this.renderWires();
        }
      }
      handleKeyDown(event) {
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        const tag = event.target?.tagName?.toUpperCase?.() || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (this.selectedEdgeId) {
          this.removeEdge(this.selectedEdgeId);
          event.preventDefault();
        } else if (this.selectedNodeId && this.pipeline.nodes.length > 1) {
          this.removeNode(this.selectedNodeId);
          event.preventDefault();
        }
      }
      addNodeFromPalette(type) {
        const def = getNodeDef(type);
        if (!def) return;
        const anchor = this.pipeline.nodes.find((n) => n.id === this.selectedNodeId) || null;
        const isSource = !def.hasIn;
        const count = this.pipeline.nodes.length;
        const x = anchor && !isSource ? Math.min(CANVAS_W - 260, anchor.x + 264) : 64 + count % 3 * 40;
        const y = anchor && !isSource ? anchor.y : 64 + count * 48;
        const initialConfig = type === "source" ? { scope: this.doc?.kind === "tree" ? "tree_children" : "this_goal" } : type === "water_source" ? { scope: this.doc?.kind === "habit" ? "this_habit" : "tree_habits" } : {};
        const node = createNode(type, { x, y, config: initialConfig });
        this.pipeline.nodes.push(node);
        if (anchor && getNodeDef(anchor.type)?.hasOut && def.hasIn) {
          this.connectNodes(anchor.id, node.id);
        }
        this.selectedNodeId = node.id;
        this.selectedEdgeId = null;
        this.pendingFromNodeId = null;
        this.refreshAll();
      }
      connectNodes(fromId, toId) {
        if (!fromId || !toId || fromId === toId) return;
        const exists = this.pipeline.edges.some((e) => e.from === fromId && e.to === toId);
        if (exists) return;
        const fromDef = getNodeDef(this.pipeline.nodes.find((n) => n.id === fromId)?.type);
        const toDef = getNodeDef(this.pipeline.nodes.find((n) => n.id === toId)?.type);
        if (!fromDef?.hasOut || !toDef?.hasIn) return;
        this.pipeline.edges.push({ id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`, from: fromId, to: toId });
      }
      removeEdge(edgeId) {
        this.pipeline.edges = this.pipeline.edges.filter((e) => e.id !== edgeId);
        if (this.selectedEdgeId === edgeId) this.selectedEdgeId = null;
        this.refreshAll();
      }
      removeNode(nodeId) {
        if (this.pipeline.nodes.length <= 1) {
          new Notice2("Keep at least one node in the flow.");
          return;
        }
        this.pipeline.nodes = this.pipeline.nodes.filter((n) => n.id !== nodeId);
        this.pipeline.edges = this.pipeline.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
        if (this.selectedNodeId === nodeId) {
          this.selectedNodeId = this.pipeline.nodes[this.pipeline.nodes.length - 1]?.id || null;
        }
        if (this.pendingFromNodeId === nodeId) this.pendingFromNodeId = null;
        this.refreshAll();
      }
      refreshAll() {
        const evalResult = evaluatePipeline(this.app, this.pipeline, this.doc);
        this.refreshCanvas(evalResult);
        this.refreshInspector(evalResult);
        this.refreshPreview(evalResult);
      }
      refreshCanvas(evalResult = evaluatePipeline(this.app, this.pipeline, this.doc)) {
        if (!this.worldEl) return;
        this.applyWorldTransform();
        if (this.statusEl) {
          const out = evalResult.output;
          let summary = "";
          if (out.displayType === "stat") {
            summary = `Live: ${out.entries.length} items \u2192 ${out.stat.display}${out.stat.unit ? ` ${out.stat.unit}` : ""}`;
          } else if (out.displayType === "goal_bar") {
            summary = `Live: ${out.bar.currentDisplay} / ${out.bar.targetDisplay} (${out.bar.rawPercent}%)`;
          } else if (out.displayType === "chart") {
            summary = `Live: ${out.points.length} plotted points`;
          } else {
            summary = `Live: ${out.entries.length} matching notes`;
          }
          this.statusEl.textContent = summary;
        }
        for (const card of this.nodeEls.values()) {
          card.remove?.();
          const idx = this.worldEl.children?.indexOf?.(card);
          if (idx !== void 0 && idx >= 0) this.worldEl.children.splice(idx, 1);
        }
        this.nodeEls.clear();
        for (const node of this.pipeline.nodes) {
          this.renderNodeCard(node, evalResult);
        }
        this.renderWires(evalResult);
      }
      renderNodeCard(node, evalResult) {
        const def = getNodeDef(node.type);
        if (!def) return;
        const isSelected = this.selectedNodeId === node.id && !this.selectedEdgeId;
        const isPendingFrom = this.pendingFromNodeId === node.id;
        const count = evalResult.nodeResults.get(node.id)?.count ?? 0;
        const card = this.worldEl.createDiv({
          cls: `iter-flow-node cat-${def.category}${isSelected ? " is-selected" : ""}${isPendingFrom ? " is-connecting" : ""}`
        });
        card.style.left = `${node.x}px`;
        card.style.top = `${node.y}px`;
        this.nodeEls.set(node.id, card);
        const head = card.createDiv({ cls: "iter-flow-node-head" });
        head.createSpan({ cls: `iter-flow-cat-dot cat-${def.category}` });
        head.createSpan({ text: node.label || def.label, cls: "iter-flow-node-title" });
        head.createSpan({ text: String(count), cls: "iter-flow-count-pill" });
        const body = card.createDiv({ cls: "iter-flow-node-body" });
        body.createSpan({ text: formatPipelineNodeSummary(node), cls: "iter-flow-node-summary" });
        card.addEventListener("mousedown", (event) => {
          if (event.target?.className?.includes?.("iter-flow-port")) return;
          this.selectedNodeId = node.id;
          this.selectedEdgeId = null;
          this.dragState = {
            kind: "node",
            nodeId: node.id,
            startX: event.clientX,
            startY: event.clientY,
            originX: node.x,
            originY: node.y
          };
          for (const [id, el] of this.nodeEls.entries()) {
            el.toggleClass?.("is-selected", id === node.id);
          }
          this.refreshInspector(evaluatePipeline(this.app, this.pipeline, this.doc));
        });
        if (def.hasIn) {
          const inPort = card.createEl("button", {
            type: "button",
            cls: "iter-flow-port is-in",
            attr: { title: "Input port (click or drop wire here)", "aria-label": "Input port" }
          });
          inPort.addEventListener("mouseup", (event) => {
            if (this.dragState?.kind === "wire" && this.dragState.fromNodeId !== node.id) {
              event.stopPropagation?.();
              this.connectNodes(this.dragState.fromNodeId, node.id);
              this.dragState = null;
              this.pendingFromNodeId = null;
              this.refreshAll();
            }
          });
          inPort.addEventListener("click", (event) => {
            event.stopPropagation?.();
            if (this.pendingFromNodeId && this.pendingFromNodeId !== node.id) {
              this.connectNodes(this.pendingFromNodeId, node.id);
              this.pendingFromNodeId = null;
              this.refreshAll();
            }
          });
        }
        if (def.hasOut) {
          const outPort = card.createEl("button", {
            type: "button",
            cls: `iter-flow-port is-out${isPendingFrom ? " is-armed" : ""}`,
            attr: { title: "Output port (drag or click, then click target input)", "aria-label": "Output port" }
          });
          outPort.addEventListener("mousedown", (event) => {
            event.stopPropagation?.();
            this.dragState = {
              kind: "wire",
              fromNodeId: node.id,
              startX: event.clientX,
              startY: event.clientY,
              cursorX: node.x + NODE_WIDTH + 30,
              cursorY: node.y + PORT_OFFSET_Y,
              dragged: false
            };
          });
          outPort.addEventListener("click", (event) => {
            event.stopPropagation?.();
            this.pendingFromNodeId = this.pendingFromNodeId === node.id ? null : node.id;
            this.refreshCanvas();
          });
        }
      }
      renderWires(evalResult = null) {
        if (!this.svgEl) return;
        if (typeof this.svgEl.empty === "function") {
          this.svgEl.empty();
        } else {
          while (this.svgEl.firstChild) {
            this.svgEl.removeChild(this.svgEl.firstChild);
          }
        }
        const byId = new Map(this.pipeline.nodes.map((n) => [n.id, n]));
        for (const edge of this.pipeline.edges) {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) continue;
          const x1 = from.x + NODE_WIDTH;
          const y1 = from.y + PORT_OFFSET_Y;
          const x2 = to.x;
          const y2 = to.y + PORT_OFFSET_Y;
          const d = bezierPath(x1, y1, x2, y2);
          const selected = this.selectedEdgeId === edge.id;
          const activeCount = evalResult?.nodeResults?.get(from.id)?.count ?? 0;
          const visible = document.createElementNS(SVG_NS, "path");
          visible.setAttribute("d", d);
          visible.setAttribute("class", `iter-wire-path${selected ? " is-selected" : ""}${activeCount > 0 ? " is-active" : ""}`);
          this.svgEl.appendChild(visible);
          const hit = document.createElementNS(SVG_NS, "path");
          hit.setAttribute("d", d);
          hit.setAttribute("class", "iter-wire-hit");
          hit.addEventListener("click", (event) => {
            event.stopPropagation?.();
            this.selectedEdgeId = edge.id;
            this.refreshAll();
          });
          this.svgEl.appendChild(hit);
        }
        if (this.dragState?.kind === "wire" && this.dragState.dragged) {
          const from = byId.get(this.dragState.fromNodeId);
          if (from) {
            const temp = document.createElementNS(SVG_NS, "path");
            temp.setAttribute(
              "d",
              bezierPath(from.x + NODE_WIDTH, from.y + PORT_OFFSET_Y, this.dragState.cursorX, this.dragState.cursorY)
            );
            temp.setAttribute("class", "iter-wire-temp");
            this.svgEl.appendChild(temp);
          }
        }
      }
      refreshInspector(evalResult = evaluatePipeline(this.app, this.pipeline, this.doc)) {
        const host = this.inspectorEl;
        if (!host) return;
        host.empty();
        if (this.selectedEdgeId) {
          const edge = this.pipeline.edges.find((e) => e.id === this.selectedEdgeId);
          if (edge) {
            const fromNode = this.pipeline.nodes.find((n) => n.id === edge.from);
            const toNode = this.pipeline.nodes.find((n) => n.id === edge.to);
            host.createEl("h3", { text: "Connection", cls: "iter-flow-ins-title" });
            host.createEl("p", {
              text: `${fromNode?.label || edge.from} \u2192 ${toNode?.label || edge.to}`,
              cls: "iter-section-hint"
            });
            const delEdgeBtn = host.createEl("button", {
              text: "Disconnect wire",
              type: "button",
              cls: "iter-btn-ghost mod-warning"
            });
            delEdgeBtn.addEventListener("click", () => this.removeEdge(edge.id));
            return;
          }
        }
        const node = this.pipeline.nodes.find((n) => n.id === this.selectedNodeId);
        if (!node) {
          host.createEl("p", {
            text: "Select a node on the canvas to configure its options, or drag from \u25CF to \u25CF to wire nodes.",
            cls: "iter-section-hint"
          });
          return;
        }
        const def = getNodeDef(node.type);
        const header = host.createDiv({ cls: "iter-flow-ins-head" });
        header.createEl("h3", { text: def?.label || node.type, cls: "iter-flow-ins-title" });
        if (this.pipeline.nodes.length > 1) {
          const delBtn = header.createEl("button", {
            type: "button",
            cls: "iter-icon-button",
            attr: { "aria-label": "Delete node", title: "Delete node" }
          });
          setIcon(delBtn, "trash-2");
          delBtn.addEventListener("click", () => this.removeNode(node.id));
        }
        const labelField = host.createDiv({ cls: "iter-modal-field" });
        labelField.createEl("label", { text: "Node label", cls: "iter-modal-label" });
        const labelInput = labelField.createEl("input", { type: "text", cls: "iter-modal-input" });
        labelInput.value = node.label || "";
        labelInput.addEventListener("input", () => {
          node.label = labelInput.value;
          const cardEl = this.nodeEls.get(node.id);
          const titleEl = cardEl?.findAll?.((e) => e.className?.includes?.("iter-flow-node-title"))?.[0];
          if (titleEl) titleEl.textContent = node.label || def?.label || "";
        });
        const onCfgChange = (structural = false) => {
          const nextEval = evaluatePipeline(this.app, this.pipeline, this.doc);
          if (structural) this.refreshInspector(nextEval);
          this.refreshCanvas(nextEval);
          this.refreshPreview(nextEval);
          if (!structural) this.renderSamplePeek(peekSlot, node, nextEval);
        };
        const formBody = host.createDiv({ cls: "iter-flow-ins-form" });
        this.renderNodeConfigFields(formBody, node, onCfgChange);
        const peekSlot = host.createDiv({ cls: "iter-flow-peek" });
        this.renderSamplePeek(peekSlot, node, evalResult);
      }
      renderNodeConfigFields(container, node, onChange) {
        const cfg = node.config;
        if (node.type === "source") {
          const scopeField = container.createDiv({ cls: "iter-modal-field" });
          scopeField.createEl("label", { text: "Scope", cls: "iter-modal-label" });
          const scopeSel = scopeField.createEl("select", { cls: "iter-modal-select" });
          scopeSel.createEl("option", { value: "tree_children", text: "Tree children (subgoals & habits)" });
          scopeSel.createEl("option", { value: "this_goal", text: "This goal only" });
          scopeSel.createEl("option", { value: "both", text: "This goal + tree children" });
          scopeSel.value = cfg.scope || "tree_children";
          scopeSel.addEventListener("change", () => {
            cfg.scope = scopeSel.value;
            onChange(true);
          });
          if (cfg.scope !== "this_goal") {
            const kindField = container.createDiv({ cls: "iter-modal-field" });
            kindField.createEl("label", { text: "Children", cls: "iter-modal-label" });
            const kindSel = kindField.createEl("select", { cls: "iter-modal-select" });
            kindSel.createEl("option", { value: "all", text: "All subgoals & habits" });
            kindSel.createEl("option", { value: "habits", text: "Habits only" });
            kindSel.createEl("option", { value: "subgoals", text: "Subgoals only" });
            kindSel.value = cfg.childKinds || "all";
            kindSel.addEventListener("change", () => {
              cfg.childKinds = kindSel.value;
              onChange(false);
            });
          }
          const typeField = container.createDiv({ cls: "iter-modal-field" });
          typeField.createEl("label", { text: "Data kinds", cls: "iter-modal-label" });
          const typeSel = typeField.createEl("select", { cls: "iter-modal-select" });
          typeSel.createEl("option", { value: "any", text: "All data types" });
          typeSel.createEl("option", { value: "numeric", text: "Numeric (counters & numeric notes)" });
          typeSel.createEl("option", { value: "note", text: "Notes (plain & timed notes)" });
          typeSel.createEl("option", { value: "text", text: "Text lists" });
          typeSel.value = cfg.datasetFilter || "any";
          typeSel.addEventListener("change", () => {
            cfg.datasetFilter = typeSel.value;
            onChange(false);
          });
          const listField = container.createDiv({ cls: "iter-modal-field" });
          listField.createEl("label", { text: "Specific data list (optional)", cls: "iter-modal-label" });
          const listSel = listField.createEl("select", { cls: "iter-modal-select" });
          listSel.createEl("option", { value: "", text: "All matching data lists" });
          for (const ds of this.context.localDatasets) {
            if (ds.type === "rollup") continue;
            listSel.createEl("option", { value: ds.id, text: `This goal \u2014 ${ds.name}` });
          }
          for (const ch of this.context.childDatasets) {
            if (ch.dataset.type === "rollup") continue;
            listSel.createEl("option", { value: ch.dataset.id, text: `${ch.childTitle} \u2014 ${ch.dataset.name}` });
          }
          listSel.value = cfg.datasetId || "";
          listSel.addEventListener("change", () => {
            cfg.datasetId = listSel.value;
            onChange(false);
          });
          const matchField = container.createDiv({ cls: "iter-modal-field" });
          matchField.createEl("label", { text: "Name contains (optional)", cls: "iter-modal-label" });
          const matchInput = matchField.createEl("input", {
            type: "text",
            placeholder: "e.g. Read, Essays, Pages",
            cls: "iter-modal-input"
          });
          matchInput.value = cfg.nameMatch || "";
          matchInput.addEventListener("input", () => {
            cfg.nameMatch = matchInput.value;
            onChange(false);
          });
          renderSuggestionChips(matchField, [...this.context.childTitles, ...this.context.datasetNames], (chip) => {
            matchInput.value = chip;
            cfg.nameMatch = chip;
            onChange(false);
          });
          return;
        }
        if (node.type === "water_source") {
          const scopeField = container.createDiv({ cls: "iter-modal-field" });
          scopeField.createEl("label", { text: "Scope", cls: "iter-modal-label" });
          const scopeSel = scopeField.createEl("select", { cls: "iter-modal-select" });
          scopeSel.createEl("option", { value: "tree_habits", text: "All habits in tree" });
          scopeSel.createEl("option", { value: "this_habit", text: "This habit only" });
          scopeSel.value = cfg.scope || "tree_habits";
          scopeSel.addEventListener("change", () => {
            cfg.scope = scopeSel.value;
            onChange(false);
          });
          const nameField = container.createDiv({ cls: "iter-modal-field" });
          nameField.createEl("label", { text: "Habit name contains (optional)", cls: "iter-modal-label" });
          const nameInput = nameField.createEl("input", { type: "text", cls: "iter-modal-input" });
          nameInput.value = cfg.nameMatch || "";
          nameInput.addEventListener("input", () => {
            cfg.nameMatch = nameInput.value;
            onChange(false);
          });
          return;
        }
        if (node.type === "filter") {
          const matchField = container.createDiv({ cls: "iter-modal-field" });
          matchField.createEl("label", { text: "Match conditions", cls: "iter-modal-label" });
          const matchSel = matchField.createEl("select", { cls: "iter-modal-select" });
          matchSel.createEl("option", { value: "all", text: "All rules match (AND)" });
          matchSel.createEl("option", { value: "any", text: "Any rule matches (OR)" });
          matchSel.value = cfg.match || "all";
          matchSel.addEventListener("change", () => {
            cfg.match = matchSel.value;
            onChange(false);
          });
          const rules = Array.isArray(cfg.rules) ? cfg.rules : cfg.rules = [];
          const rulesWrap = container.createDiv({ cls: "iter-rule-list" });
          const suggestedFields = [
            ...this.context.fieldNames,
            ...FILTER_FIELD_PRESETS.slice(0, 4).map((p) => p.id)
          ];
          rules.forEach((rule, idx) => {
            const card = rulesWrap.createDiv({ cls: "iter-rule-card" });
            const topRow = card.createDiv({ cls: "iter-rule-row" });
            const fieldIn = topRow.createEl("input", {
              type: "text",
              placeholder: "Field or property (e.g. pages, datasetName)",
              cls: "iter-modal-input"
            });
            fieldIn.value = rule.field || "";
            fieldIn.addEventListener("input", () => {
              rule.field = fieldIn.value;
              onChange(false);
            });
            const delRule = topRow.createEl("button", {
              type: "button",
              cls: "iter-icon-button",
              attr: { "aria-label": "Remove rule" }
            });
            setIcon(delRule, "x");
            delRule.addEventListener("click", () => {
              rules.splice(idx, 1);
              onChange(true);
            });
            renderSuggestionChips(card, suggestedFields, (chip) => {
              fieldIn.value = chip;
              rule.field = chip;
              onChange(false);
            });
            const opRow = card.createDiv({ cls: "iter-modal-row" });
            const opSel = opRow.createEl("select", { cls: "iter-modal-select" });
            for (const item of FILTER_OPS) {
              opSel.createEl("option", { value: item.id, text: item.label });
            }
            opSel.value = rule.op || "contains";
            const valIn = opRow.createEl("input", {
              type: "text",
              placeholder: "Value\u2026",
              cls: "iter-modal-input"
            });
            valIn.value = rule.value || "";
            valIn.style.display = OPS_WITHOUT_VALUE.has(opSel.value) ? "none" : "";
            opSel.addEventListener("change", () => {
              rule.op = opSel.value;
              valIn.style.display = OPS_WITHOUT_VALUE.has(opSel.value) ? "none" : "";
              onChange(false);
            });
            valIn.addEventListener("input", () => {
              rule.value = valIn.value;
              onChange(false);
            });
          });
          const addRuleBtn = container.createEl("button", {
            text: "+ Add filter rule",
            type: "button",
            cls: "iter-btn-ghost"
          });
          addRuleBtn.addEventListener("click", () => {
            rules.push({
              field: this.context.fieldNames[0] || "datasetName",
              op: "contains",
              value: ""
            });
            onChange(true);
          });
          return;
        }
        if (node.type === "extract") {
          const fField = container.createDiv({ cls: "iter-modal-field" });
          fField.createEl("label", { text: "Property / field to read", cls: "iter-modal-label" });
          const fInput = fField.createEl("input", {
            type: "text",
            placeholder: "e.g. pages, chapters, score, value, 1",
            cls: "iter-modal-input"
          });
          fInput.value = cfg.field || "";
          fInput.addEventListener("input", () => {
            cfg.field = fInput.value;
            onChange(false);
          });
          renderSuggestionChips(fField, [...this.context.fieldNames, "value", "1"], (chip) => {
            fInput.value = chip;
            cfg.field = chip;
            onChange(false);
          });
          const fbWrap = container.createEl("label", { cls: "iter-check-item" });
          const fbBox = fbWrap.createEl("input", { type: "checkbox", cls: "iter-check-box" });
          fbBox.checked = Boolean(cfg.fallbackToValue);
          fbWrap.createSpan({ text: "Keep item number when property is absent", cls: "iter-check-title" });
          fbBox.addEventListener("change", () => {
            cfg.fallbackToValue = fbBox.checked;
            onChange(false);
          });
          const dropWrap = container.createEl("label", { cls: "iter-check-item" });
          const dropBox = dropWrap.createEl("input", { type: "checkbox", cls: "iter-check-box" });
          dropBox.checked = cfg.dropMissing !== false;
          dropWrap.createSpan({ text: "Skip items without a numeric value", cls: "iter-check-title" });
          dropBox.addEventListener("change", () => {
            cfg.dropMissing = dropBox.checked;
            onChange(false);
          });
          const unitField = container.createDiv({ cls: "iter-modal-field" });
          unitField.createEl("label", { text: "Unit label (optional)", cls: "iter-modal-label" });
          const unitIn = unitField.createEl("input", { type: "text", placeholder: "e.g. pages, chapters", cls: "iter-modal-input" });
          unitIn.value = cfg.unit || "";
          unitIn.addEventListener("input", () => {
            cfg.unit = unitIn.value;
            onChange(false);
          });
          return;
        }
        if (node.type === "math") {
          const row = container.createDiv({ cls: "iter-modal-row" });
          const opF = row.createDiv({ cls: "iter-modal-field" });
          opF.createEl("label", { text: "Operation", cls: "iter-modal-label" });
          const opSel = opF.createEl("select", { cls: "iter-modal-select" });
          for (const item of MATH_OPS) opSel.createEl("option", { value: item.id, text: item.label });
          opSel.value = cfg.op || "multiply";
          opSel.addEventListener("change", () => {
            cfg.op = opSel.value;
            onChange(false);
          });
          const valF = row.createDiv({ cls: "iter-modal-field" });
          valF.createEl("label", { text: "Number", cls: "iter-modal-label" });
          const valIn = valF.createEl("input", { type: "number", step: "any", cls: "iter-modal-input" });
          valIn.value = String(cfg.operand ?? 1);
          valIn.addEventListener("input", () => {
            cfg.operand = Number(valIn.value);
            onChange(false);
          });
          const unitF = container.createDiv({ cls: "iter-modal-field" });
          unitF.createEl("label", { text: "New unit (optional)", cls: "iter-modal-label" });
          const unitIn = unitF.createEl("input", { type: "text", cls: "iter-modal-input" });
          unitIn.value = cfg.unit || "";
          unitIn.addEventListener("input", () => {
            cfg.unit = unitIn.value;
            onChange(false);
          });
          return;
        }
        if (node.type === "group") {
          const row = container.createDiv({ cls: "iter-modal-row" });
          const byF = row.createDiv({ cls: "iter-modal-field" });
          byF.createEl("label", { text: "Group by", cls: "iter-modal-label" });
          const bySel = byF.createEl("select", { cls: "iter-modal-select" });
          for (const item of GROUP_BYS) bySel.createEl("option", { value: item.id, text: item.label });
          bySel.value = cfg.by || "sourceTitle";
          const aggF = row.createDiv({ cls: "iter-modal-field" });
          aggF.createEl("label", { text: "Calculation", cls: "iter-modal-label" });
          const aggSel = aggF.createEl("select", { cls: "iter-modal-select" });
          for (const item of STAT_AGGS) aggSel.createEl("option", { value: item.id, text: item.label });
          aggSel.value = cfg.agg || "sum";
          const propF = container.createDiv({ cls: "iter-modal-field" });
          propF.createEl("label", { text: "Property key", cls: "iter-modal-label" });
          const propIn = propF.createEl("input", { type: "text", placeholder: "e.g. author, theme", cls: "iter-modal-input" });
          propIn.value = cfg.propKey || "";
          propF.style.display = bySel.value === "prop" ? "" : "none";
          bySel.addEventListener("change", () => {
            cfg.by = bySel.value;
            propF.style.display = bySel.value === "prop" ? "" : "none";
            onChange(false);
          });
          aggSel.addEventListener("change", () => {
            cfg.agg = aggSel.value;
            onChange(false);
          });
          propIn.addEventListener("input", () => {
            cfg.propKey = propIn.value;
            onChange(false);
          });
          return;
        }
        if (node.type === "sort") {
          const row = container.createDiv({ cls: "iter-modal-row" });
          const byF = row.createDiv({ cls: "iter-modal-field" });
          byF.createEl("label", { text: "Order", cls: "iter-modal-label" });
          const bySel = byF.createEl("select", { cls: "iter-modal-select" });
          for (const item of SORT_BYS) bySel.createEl("option", { value: item.id, text: item.label });
          bySel.value = cfg.by || "date_asc";
          bySel.addEventListener("change", () => {
            cfg.by = bySel.value;
            onChange(false);
          });
          const limF = row.createDiv({ cls: "iter-modal-field" });
          limF.createEl("label", { text: "Limit (0 = all)", cls: "iter-modal-label" });
          const limIn = limF.createEl("input", { type: "number", min: "0", step: "1", cls: "iter-modal-input" });
          limIn.value = String(cfg.limit ?? 0);
          limIn.addEventListener("input", () => {
            cfg.limit = Number(limIn.value) || 0;
            onChange(false);
          });
          return;
        }
        if (node.type === "merge") {
          const f = container.createDiv({ cls: "iter-modal-field" });
          f.createEl("label", { text: "Duplicates", cls: "iter-modal-label" });
          const sel = f.createEl("select", { cls: "iter-modal-select" });
          sel.createEl("option", { value: "none", text: "Keep all items from every branch" });
          sel.createEl("option", { value: "path", text: "Deduplicate notes by path" });
          sel.createEl("option", { value: "id", text: "Deduplicate identical entries" });
          sel.value = cfg.dedupe || "none";
          sel.addEventListener("change", () => {
            cfg.dedupe = sel.value;
            onChange(false);
          });
          return;
        }
        if (node.type === "output") {
          const dispF = container.createDiv({ cls: "iter-modal-field" });
          dispF.createEl("label", { text: "Widget visualization", cls: "iter-modal-label" });
          const dispSel = dispF.createEl("select", { cls: "iter-modal-select" });
          dispSel.createEl("option", { value: "stat", text: "Metric Stat" });
          dispSel.createEl("option", { value: "goal_bar", text: "Goal Progress Bar" });
          dispSel.createEl("option", { value: "chart", text: "Time / Bar Graph" });
          dispSel.createEl("option", { value: "note_navigator", text: "Note Navigator" });
          dispSel.value = cfg.displayType || "stat";
          dispSel.addEventListener("change", () => {
            cfg.displayType = dispSel.value;
            onChange(true);
          });
          if (cfg.displayType === "stat" || !cfg.displayType) {
            const aggF = container.createDiv({ cls: "iter-modal-field" });
            aggF.createEl("label", { text: "Calculation", cls: "iter-modal-label" });
            const aggSel = aggF.createEl("select", { cls: "iter-modal-select" });
            for (const item of STAT_AGGS) aggSel.createEl("option", { value: item.id, text: item.label });
            aggSel.value = cfg.agg || "sum";
            aggSel.addEventListener("change", () => {
              cfg.agg = aggSel.value;
              onChange(false);
            });
          } else if (cfg.displayType === "goal_bar") {
            const row = container.createDiv({ cls: "iter-modal-row" });
            const modeF = row.createDiv({ cls: "iter-modal-field" });
            modeF.createEl("label", { text: "Compare value", cls: "iter-modal-label" });
            const modeSel = modeF.createEl("select", { cls: "iter-modal-select" });
            for (const item of BAR_MODES) modeSel.createEl("option", { value: item.id, text: item.label });
            modeSel.value = cfg.mode || "sum";
            modeSel.addEventListener("change", () => {
              cfg.mode = modeSel.value;
              onChange(false);
            });
            const tF = row.createDiv({ cls: "iter-modal-field" });
            tF.createEl("label", { text: "Target", cls: "iter-modal-label" });
            const tIn = tF.createEl("input", { type: "number", step: "any", cls: "iter-modal-input" });
            tIn.value = String(cfg.target ?? 100);
            tIn.addEventListener("input", () => {
              cfg.target = Number(tIn.value);
              onChange(false);
            });
          } else if (cfg.displayType === "chart") {
            const varF = container.createDiv({ cls: "iter-modal-field" });
            varF.createEl("label", { text: "Graph style", cls: "iter-modal-label" });
            const varSel = varF.createEl("select", { cls: "iter-modal-select" });
            for (const item of CHART_VARIANTS) varSel.createEl("option", { value: item.id, text: item.label });
            varSel.value = cfg.variant || "bar";
            varSel.addEventListener("change", () => {
              cfg.variant = varSel.value;
              onChange(false);
            });
          }
          const unitF = container.createDiv({ cls: "iter-modal-field" });
          unitF.createEl("label", { text: "Unit override (optional)", cls: "iter-modal-label" });
          const unitIn = unitF.createEl("input", { type: "text", placeholder: "Auto from items if blank", cls: "iter-modal-input" });
          unitIn.value = cfg.unit || "";
          unitIn.addEventListener("input", () => {
            cfg.unit = unitIn.value;
            onChange(false);
          });
        }
      }
      renderSamplePeek(container, node, evalResult) {
        container.empty();
        const res = evalResult.nodeResults.get(node.id);
        const items = res?.items || [];
        container.createEl("div", {
          text: `Node output (${items.length} ${items.length === 1 ? "item" : "items"})`,
          cls: "iter-micro-label"
        });
        if (!items.length) {
          container.createEl("p", { text: "No items passing through this node yet.", cls: "iter-section-hint" });
          return;
        }
        const list = container.createDiv({ cls: "iter-flow-peek-list" });
        for (const item of items.slice(0, 4)) {
          const row = list.createDiv({ cls: "iter-flow-peek-row" });
          const namePart = item.sourceTitle && item.sourceTitle !== item.label ? `${item.sourceTitle} \xB7 ${item.label}` : item.label;
          row.createSpan({ text: namePart, cls: "iter-flow-peek-label" });
          if (item.value !== null && item.value !== void 0) {
            row.createSpan({
              text: `${formatNumber(item.value)}${item.unit ? ` ${item.unit}` : ""}`,
              cls: "iter-note-score-pill"
            });
          }
        }
        if (items.length > 4) {
          container.createEl("span", { text: `+${items.length - 4} more\u2026`, cls: "iter-dataset-count" });
        }
      }
      refreshPreview(evalResult = evaluatePipeline(this.app, this.pipeline, this.doc)) {
        const host = this.previewEl;
        if (!host) return;
        host.empty();
        host.createEl("div", { text: "Live widget preview", cls: "iter-micro-label" });
        const card = host.createDiv({ cls: `iter-widget-card type-${evalResult.output.displayType}` });
        const top = card.createDiv({ cls: "iter-widget-top" });
        top.createSpan({ text: this.title.trim() || "Custom Flow Widget", cls: "iter-widget-title" });
        renderWidgetDisplayBody(card, evalResult.output);
      }
    };
    module2.exports = {
      WorkflowEditorModal,
      renderWidgetDisplayBody,
      NODE_WIDTH,
      PORT_OFFSET_Y
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
      RELATION_CHILD_KINDS,
      RELATION_DATA_FILTERS,
      RELATION_PER_CHILD,
      parseMetricKeysInput,
      toFiniteNumber,
      datasetMatchesFilter,
      stripMd
    } = require_data_model();
    function refKey(filePath, datasetId) {
      return `${filePath}\0${datasetId}`;
    }
    function getMatchingChildDatasets(childDatasets, { childKinds = "all", dataFilter = "any", nameMatch = "" } = {}) {
      const needle = String(nameMatch || "").trim().toLowerCase();
      return childDatasets.filter((item) => {
        if (childKinds === "habits" && item.childKind !== "habit") return false;
        if (childKinds === "subgoals" && item.childKind !== "subgoal") return false;
        if (!datasetMatchesFilter(item.dataset, dataFilter)) return false;
        if (needle) {
          const dsName = (item.dataset.name || "").toLowerCase();
          const childName = (item.childTitle || "").toLowerCase();
          if (!dsName.includes(needle) && !childName.includes(needle)) return false;
        }
        return true;
      });
    }
    function renderChildRefChecklist(container, childDatasets, selectedMap) {
      const wrap = container.createDiv({ cls: "iter-checklist" });
      if (!childDatasets.length) {
        wrap.createEl("p", {
          text: "No matching child data lists found under this tree yet.",
          cls: "iter-section-hint"
        });
        return;
      }
      for (const item of childDatasets) {
        const key = refKey(item.filePath, item.dataset.id);
        const label = wrap.createEl("label", { cls: "iter-check-item" });
        const checkbox = label.createEl("input", { type: "checkbox", cls: "iter-check-box" });
        checkbox.checked = selectedMap.has(key);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            selectedMap.set(key, { filePath: item.filePath, datasetId: item.dataset.id });
          } else {
            selectedMap.delete(key);
          }
        });
        const textWrap = label.createDiv({ cls: "iter-check-text" });
        textWrap.createSpan({ text: `${item.childTitle} \u2014 ${item.dataset.name}`, cls: "iter-check-title" });
        const typeInfo = item.dataset.unit ? `${item.dataset.type} \xB7 ${item.dataset.unit}` : item.dataset.type;
        textWrap.createSpan({ text: typeInfo, cls: "iter-check-meta" });
      }
    }
    function renderRelationConfigPanel(container, {
      childDatasets = [],
      allowModeSwitch = true,
      showKindAndFilter = true,
      initial = {}
    } = {}) {
      const state = {
        mode: initial.mode === "pick" ? "pick" : "query",
        childKinds: initial.childKinds || "all",
        dataFilter: initial.dataFilter || "numeric",
        nameMatch: initial.nameMatch || "",
        perChildAgg: initial.perChildAgg || "all",
        unit: initial.unit || ""
      };
      const selectedMap = /* @__PURE__ */ new Map();
      for (const ref of initial.refs || []) {
        if (ref?.filePath && ref?.datasetId) {
          selectedMap.set(refKey(ref.filePath, ref.datasetId), {
            filePath: ref.filePath,
            datasetId: ref.datasetId
          });
        }
      }
      const renderInner = () => {
        container.empty();
        if (allowModeSwitch) {
          const modeField = container.createDiv({ cls: "iter-modal-field" });
          modeField.createEl("label", { text: "Relation source", cls: "iter-modal-label" });
          const modeSelect = modeField.createEl("select", { cls: "iter-modal-select" });
          modeSelect.createEl("option", { value: "query", text: "Auto-include matching children (updates as you add more)" });
          modeSelect.createEl("option", { value: "pick", text: "Pick specific child lists" });
          modeSelect.value = state.mode;
          modeSelect.addEventListener("change", () => {
            state.mode = modeSelect.value;
            renderInner();
          });
        }
        if (state.mode === "query") {
          if (showKindAndFilter) {
            const scopeRow = container.createDiv({ cls: "iter-modal-row" });
            const kindField = scopeRow.createDiv({ cls: "iter-modal-field" });
            kindField.createEl("label", { text: "From children", cls: "iter-modal-label" });
            const kindSelect = kindField.createEl("select", { cls: "iter-modal-select" });
            for (const item of RELATION_CHILD_KINDS) {
              kindSelect.createEl("option", { value: item.id, text: item.label });
            }
            kindSelect.value = state.childKinds;
            const filterField = scopeRow.createDiv({ cls: "iter-modal-field" });
            filterField.createEl("label", { text: "Data kind", cls: "iter-modal-label" });
            const filterSelect = filterField.createEl("select", { cls: "iter-modal-select" });
            for (const item of RELATION_DATA_FILTERS) {
              filterSelect.createEl("option", { value: item.id, text: item.label });
            }
            filterSelect.value = state.dataFilter;
            kindSelect.addEventListener("change", () => {
              state.childKinds = kindSelect.value;
              updatePreview();
            });
            filterSelect.addEventListener("change", () => {
              state.dataFilter = filterSelect.value;
              updatePreview();
            });
          }
          const detailRow = container.createDiv({ cls: "iter-modal-row" });
          const nameField = detailRow.createDiv({ cls: "iter-modal-field" });
          nameField.createEl("label", { text: "List or child name contains (optional)", cls: "iter-modal-label" });
          const nameInput = nameField.createEl("input", {
            type: "text",
            placeholder: "e.g. read, score (blank = all matching)",
            cls: "iter-modal-input"
          });
          nameInput.value = state.nameMatch;
          const perChildField = detailRow.createDiv({ cls: "iter-modal-field" });
          perChildField.createEl("label", { text: "Per child", cls: "iter-modal-label" });
          const perChildSelect = perChildField.createEl("select", { cls: "iter-modal-select" });
          for (const item of RELATION_PER_CHILD) {
            perChildSelect.createEl("option", { value: item.id, text: item.label });
          }
          perChildSelect.value = state.perChildAgg;
          perChildSelect.addEventListener("change", () => {
            state.perChildAgg = perChildSelect.value;
          });
          const previewEl = container.createEl("p", { cls: "iter-section-hint" });
          const updatePreview = () => {
            const matches = getMatchingChildDatasets(childDatasets, state);
            if (!matches.length) {
              previewEl.textContent = "No matching child lists yet \u2014 future matching subgoals/habits will join automatically.";
            } else {
              const previewNames = matches.slice(0, 4).map((m) => `${m.childTitle} \xB7 ${m.dataset.name}`).join(", ");
              const extra = matches.length > 4 ? ` (+${matches.length - 4} more)` : "";
              previewEl.textContent = `Matches ${matches.length} child ${matches.length === 1 ? "list" : "lists"}: ${previewNames}${extra}`;
            }
          };
          nameInput.addEventListener("input", () => {
            state.nameMatch = nameInput.value;
            updatePreview();
          });
          updatePreview();
        } else {
          const pickRow = container.createDiv({ cls: "iter-modal-row" });
          const filterField = pickRow.createDiv({ cls: "iter-modal-field" });
          filterField.createEl("label", { text: "Filter child lists", cls: "iter-modal-label" });
          const filterSelect = filterField.createEl("select", { cls: "iter-modal-select" });
          for (const item of RELATION_DATA_FILTERS) {
            filterSelect.createEl("option", { value: item.id, text: item.label });
          }
          filterSelect.value = state.dataFilter;
          const perChildField = pickRow.createDiv({ cls: "iter-modal-field" });
          perChildField.createEl("label", { text: "Per child", cls: "iter-modal-label" });
          const perChildSelect = perChildField.createEl("select", { cls: "iter-modal-select" });
          for (const item of RELATION_PER_CHILD) {
            perChildSelect.createEl("option", { value: item.id, text: item.label });
          }
          perChildSelect.value = state.perChildAgg;
          perChildSelect.addEventListener("change", () => {
            state.perChildAgg = perChildSelect.value;
          });
          const listSlot = container.createDiv();
          const renderList = () => {
            listSlot.empty();
            const filtered = getMatchingChildDatasets(childDatasets, {
              childKinds: "all",
              dataFilter: state.dataFilter,
              nameMatch: ""
            });
            renderChildRefChecklist(listSlot, filtered, selectedMap);
          };
          filterSelect.addEventListener("change", () => {
            state.dataFilter = filterSelect.value;
            renderList();
          });
          renderList();
        }
        const unitField = container.createDiv({ cls: "iter-modal-field" });
        unitField.createEl("label", { text: "Unit override (optional)", cls: "iter-modal-label" });
        const unitInput = unitField.createEl("input", {
          type: "text",
          placeholder: "Auto from children if all share a unit",
          cls: "iter-modal-input"
        });
        unitInput.value = state.unit;
        unitInput.addEventListener("input", () => {
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
          refs: state.mode === "pick" ? [...selectedMap.values()] : []
        }),
        getUnit: () => state.unit.trim()
      };
    }
    var AddDatasetModal = class extends Modal {
      constructor(app, { goalKind = "goal", treePath = null, childDatasets = [], onSubmit }) {
        super(app);
        this.goalKind = goalKind;
        this.treePath = treePath;
        this.childDatasets = childDatasets;
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
        const availableTypes = this.goalKind === "tree" && this.treePath ? DATASET_TYPES : DATASET_TYPES.filter((item) => item.id !== "rollup");
        const typeField = form.createDiv({ cls: "iter-modal-field" });
        typeField.createEl("label", { text: "Data type", cls: "iter-modal-label" });
        const typeSelect = typeField.createEl("select", { cls: "iter-modal-select" });
        for (const item of availableTypes) {
          typeSelect.createEl("option", { value: item.id, text: item.label });
        }
        if (availableTypes.length) typeSelect.value = availableTypes[0].id;
        const extraField = form.createDiv({ cls: "iter-modal-field" });
        const extraLabel = extraField.createEl("label", { text: "Unit (optional)", cls: "iter-modal-label" });
        const extraInput = extraField.createEl("input", {
          type: "text",
          placeholder: "e.g. kg, words, reps",
          cls: "iter-modal-input"
        });
        const rollupSlot = form.createDiv({ cls: "iter-modal-dynamic" });
        let rollupControls = null;
        const syncExtra = () => {
          const t = typeSelect.value;
          if (t === "rollup") {
            extraField.style.display = "none";
            rollupSlot.style.display = "";
            if (!rollupControls) {
              rollupControls = renderRelationConfigPanel(rollupSlot, {
                childDatasets: this.childDatasets,
                allowModeSwitch: true,
                showKindAndFilter: true,
                initial: { mode: "query", childKinds: "all", dataFilter: "numeric", perChildAgg: "all" }
              });
            }
            return;
          }
          rollupSlot.empty();
          rollupSlot.style.display = "none";
          rollupControls = null;
          if (t === "number_time") {
            extraField.style.display = "";
            extraLabel.textContent = "Unit (optional)";
            extraInput.placeholder = "e.g. kg, words, kcal";
          } else if (t === "note_time") {
            extraField.style.display = "";
            extraLabel.textContent = "Frontmatter properties (optional, comma-separated)";
            extraInput.placeholder = "score (or multiple: chapters, pages)";
          } else if (t === "note") {
            extraField.style.display = "";
            extraLabel.textContent = "Frontmatter properties (optional, comma-separated)";
            extraInput.placeholder = "e.g. chapters, pages, author (leave blank for plain notes)";
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
            let relation = null;
            if (type === "rollup" && rollupControls) {
              relation = rollupControls.getRelation();
              if (relation.mode === "pick" && !relation.refs.length) {
                throw new Error("Select at least one child data list.");
              }
            }
            const parsedKeys = parseMetricKeysInput(extraInput.value);
            const metricKeys = type === "note_time" ? parsedKeys.length ? parsedKeys : ["score"] : type === "note" ? parsedKeys : [];
            await this.onSubmit({
              name: nameInput.value,
              type,
              unit: type === "rollup" ? rollupControls?.getUnit() ?? "" : type === "number_time" ? extraInput.value : "",
              metricKey: metricKeys[0] || "",
              metricKeys,
              relation
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
    var TREE_WIDGET_PRESETS = [
      {
        value: "__rel:all:numeric",
        label: "All children \xB7 Numeric (auto-includes new)",
        initial: { mode: "query", childKinds: "all", dataFilter: "numeric", perChildAgg: "all" }
      },
      {
        value: "__rel:habits:numeric",
        label: "Habits \xB7 Numeric (auto-includes new)",
        initial: { mode: "query", childKinds: "habits", dataFilter: "numeric", perChildAgg: "all" }
      },
      {
        value: "__rel:subgoals:numeric",
        label: "Subgoals \xB7 Numeric (auto-includes new)",
        initial: { mode: "query", childKinds: "subgoals", dataFilter: "numeric", perChildAgg: "all" }
      },
      {
        value: "__rel:all:note",
        label: "All children \xB7 Notes (auto-includes new)",
        initial: { mode: "query", childKinds: "all", dataFilter: "note", perChildAgg: "all" }
      },
      {
        value: "__rel:all:text",
        label: "All children \xB7 Text entries (auto-includes new)",
        initial: { mode: "query", childKinds: "all", dataFilter: "text", perChildAgg: "all" }
      },
      {
        value: "__rel:pick",
        label: "Pick specific child lists\u2026",
        initial: { mode: "pick", childKinds: "all", dataFilter: "any", perChildAgg: "all", refs: [] }
      }
    ];
    var AddWidgetModal = class extends Modal {
      constructor(app, { datasets = [], childDatasets = [], goalKind = "goal", treePath = null, onSubmit, onOpenCanvas = null }) {
        super(app);
        this.datasets = datasets;
        this.childDatasets = childDatasets;
        this.goalKind = goalKind;
        this.treePath = treePath;
        this.onSubmit = onSubmit;
        this.onOpenCanvas = onOpenCanvas;
        this.submitting = false;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("iter-modal");
        const headBar = contentEl.createDiv({ cls: "iter-modal-headbar" });
        headBar.createEl("h2", { text: "Add widget", cls: "iter-modal-title" });
        const isTree = this.goalKind === "tree" && Boolean(this.treePath);
        const canUseDataWidgets = this.datasets.length > 0 || isTree;
        let canvasSwitchBtn = null;
        if (this.onOpenCanvas) {
          canvasSwitchBtn = headBar.createEl("button", {
            text: "Advanced Canvas \u2192",
            type: "button",
            cls: "iter-btn-ghost iter-canvas-switch-btn"
          });
        }
        const form = contentEl.createEl("form", { cls: "iter-modal-form" });
        const row = form.createDiv({ cls: "iter-modal-row" });
        const availableTypes = WIDGET_TYPES.filter(
          (item) => item.id === "streak" ? this.goalKind === "habit" : canUseDataWidgets
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
        if (isTree) {
          for (const preset of TREE_WIDGET_PRESETS) {
            dsSelect.createEl("option", { value: preset.value, text: preset.label });
          }
          this.childDatasets.forEach((item, idx) => {
            dsSelect.createEl("option", {
              value: `__child:${idx}`,
              text: `Child: ${item.childTitle} \u2014 ${item.dataset.name}`
            });
          });
        }
        if (this.datasets.length) dsSelect.value = this.datasets[0].id;
        else if (isTree) dsSelect.value = TREE_WIDGET_PRESETS[0].value;
        const relationSlot = form.createDiv({ cls: "iter-modal-dynamic" });
        const titleField = form.createDiv({ cls: "iter-modal-field" });
        titleField.createEl("label", { text: "Widget title (optional)", cls: "iter-modal-label" });
        const titleInput = titleField.createEl("input", {
          type: "text",
          placeholder: "Auto-named from data if left blank",
          cls: "iter-modal-input"
        });
        const metricSlot = form.createDiv({ cls: "iter-modal-dynamic" });
        const dynamicSlot = form.createDiv({ cls: "iter-modal-dynamic" });
        let aggSelect = null;
        let aggTouched = false;
        let modeSelect = null;
        let targetInput = null;
        let variantSelect = null;
        let relControls = null;
        let metricInput = null;
        const isRollupSumDefault = () => {
          const val = dsSelect.value || "";
          if (val.startsWith("__rel:") && val.endsWith(":numeric")) return true;
          const localDs = this.datasets.find((d) => d.id === val);
          return localDs?.type === "rollup" && localDs?.relation?.dataFilter === "numeric";
        };
        const getSourceKeysInfo = () => {
          const val = dsSelect.value || "";
          const keys = [];
          const seen = /* @__PURE__ */ new Set();
          const pushKey = (k) => {
            if (typeof k === "string" && k.trim() && !seen.has(k.trim())) {
              seen.add(k.trim());
              keys.push(k.trim());
            }
          };
          const localDs = this.datasets.find((d) => d.id === val);
          if (localDs) {
            for (const k of localDs.metricKeys || []) pushKey(k);
            if (localDs.type === "rollup") {
              for (const ch of this.childDatasets) {
                for (const k of ch.dataset.metricKeys || []) pushKey(k);
              }
            }
            return {
              keys,
              preferDefault: localDs.type === "note" || localDs.type === "note_time",
              show: keys.length > 0 || localDs.type === "note" || localDs.type === "note_time" || localDs.type === "rollup"
            };
          }
          if (val.startsWith("__child:")) {
            const idx = Number(val.slice("__child:".length));
            const childItem = this.childDatasets[idx];
            if (childItem) {
              for (const k of childItem.dataset.metricKeys || []) pushKey(k);
              return {
                keys,
                preferDefault: childItem.dataset.type === "note" || childItem.dataset.type === "note_time",
                show: keys.length > 0 || childItem.dataset.type === "note" || childItem.dataset.type === "note_time"
              };
            }
          }
          if (val.startsWith("__rel:")) {
            for (const ch of this.childDatasets) {
              for (const k of ch.dataset.metricKeys || []) pushKey(k);
            }
            return { keys, preferDefault: false, show: true };
          }
          return { keys: [], preferDefault: false, show: false };
        };
        const rebuildMetricSlot = () => {
          metricSlot.empty();
          metricInput = null;
          const wType = typeSelect.value;
          if (wType === "streak" || wType === "note_navigator") {
            metricSlot.style.display = "none";
            return;
          }
          const info = getSourceKeysInfo();
          if (!info.show) {
            metricSlot.style.display = "none";
            return;
          }
          metricSlot.style.display = "";
          const field = metricSlot.createDiv({ cls: "iter-modal-field" });
          field.createEl("label", { text: "Frontmatter property filter (optional)", cls: "iter-modal-label" });
          metricInput = field.createEl("input", {
            type: "text",
            placeholder: info.keys.length ? `e.g. ${info.keys.slice(0, 3).join(", ")} (blank = auto)` : "e.g. pages, chapters, score",
            cls: "iter-modal-input"
          });
          if (info.preferDefault && info.keys.length) {
            metricInput.value = info.keys[0];
          }
          if (info.keys.length) {
            const chips = field.createDiv({ cls: "iter-chip-suggestions" });
            for (const k of info.keys.slice(0, 6)) {
              const btn = chips.createEl("button", { text: k, type: "button", cls: "iter-suggest-chip" });
              btn.addEventListener("click", () => {
                metricInput.value = k;
              });
            }
          }
        };
        const rebuildRelationSlot = () => {
          relationSlot.empty();
          relControls = null;
          const wType = typeSelect.value;
          const val = dsSelect.value || "";
          if (wType === "streak" || !val.startsWith("__rel:")) {
            relationSlot.style.display = "none";
            return;
          }
          const preset = TREE_WIDGET_PRESETS.find((p) => p.value === val);
          if (!preset) {
            relationSlot.style.display = "none";
            return;
          }
          relationSlot.style.display = "";
          relControls = renderRelationConfigPanel(relationSlot, {
            childDatasets: this.childDatasets,
            allowModeSwitch: false,
            showKindAndFilter: false,
            initial: preset.initial
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
            aggSelect.value = isRollupSumDefault() ? "sum" : "latest";
            aggSelect.addEventListener("change", () => {
              aggTouched = true;
            });
          } else if (wType === "goal_bar") {
            const barRow = dynamicSlot.createDiv({ cls: "iter-modal-row" });
            const modeField = barRow.createDiv({ cls: "iter-modal-field" });
            modeField.createEl("label", { text: "Compare value", cls: "iter-modal-label" });
            modeSelect = modeField.createEl("select", { cls: "iter-modal-select" });
            for (const item of BAR_MODES) {
              modeSelect.createEl("option", { value: item.id, text: item.label });
            }
            modeSelect.value = BAR_MODES[0].id;
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
            variantSelect.value = CHART_VARIANTS[0].id;
          } else if (wType === "note_navigator") {
            const currentVal = dsSelect.value || "";
            const currentDs = this.datasets.find((d) => d.id === currentVal);
            const currentIsNote = currentDs ? currentDs.type === "note" || currentDs.type === "note_time" || currentDs.type === "rollup" && currentDs.relation?.dataFilter === "note" : currentVal === "__rel:all:note" || currentVal === "__rel:pick" || currentVal.startsWith("__child:") && (() => {
              const childItem = this.childDatasets[Number(currentVal.slice("__child:".length))];
              return childItem && (childItem.dataset.type === "note" || childItem.dataset.type === "note_time");
            })();
            if (!currentIsNote) {
              const noteDs = this.datasets.find(
                (d) => d.type === "note" || d.type === "note_time" || d.type === "rollup" && d.relation?.dataFilter === "note"
              );
              if (noteDs) dsSelect.value = noteDs.id;
              else if (isTree) dsSelect.value = "__rel:all:note";
            }
          }
          rebuildRelationSlot();
          rebuildMetricSlot();
        };
        const collectDraftConfig = ({ validatePick = true } = {}) => {
          const wType = typeSelect.value;
          const sourceVal = dsSelect.value || "";
          let datasetId = "";
          let relation = null;
          let unit = "";
          if (wType !== "streak") {
            if (sourceVal.startsWith("__rel:")) {
              if (relControls) {
                relation = relControls.getRelation();
                unit = relControls.getUnit();
              } else {
                const preset = TREE_WIDGET_PRESETS.find((p) => p.value === sourceVal);
                relation = preset ? { ...preset.initial } : null;
              }
              if (validatePick && relation?.mode === "pick" && !relation.refs?.length) {
                throw new Error("Select at least one child data list.");
              }
            } else if (sourceVal.startsWith("__child:")) {
              const idx = Number(sourceVal.slice("__child:".length));
              const childItem = this.childDatasets[idx];
              if (!childItem) {
                if (validatePick) throw new Error("Selected child data list no longer exists.");
              } else {
                relation = {
                  mode: "pick",
                  dataFilter: "any",
                  perChildAgg: "all",
                  refs: [{ filePath: childItem.filePath, datasetId: childItem.dataset.id }]
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
            metricKey: metricInput?.value?.trim() || "",
            title: titleInput.value,
            agg: aggSelect?.value ?? "latest",
            mode: modeSelect?.value ?? "latest",
            target: targetInput?.value ?? null,
            variant: variantSelect?.value ?? "line"
          };
        };
        if (canvasSwitchBtn) {
          canvasSwitchBtn.addEventListener("click", () => {
            const draft = collectDraftConfig({ validatePick: false });
            this.close();
            this.onOpenCanvas(draft);
          });
        }
        dsSelect.addEventListener("change", () => {
          rebuildRelationSlot();
          rebuildMetricSlot();
          if (aggSelect && !aggTouched) {
            aggSelect.value = isRollupSumDefault() ? "sum" : "latest";
          }
        });
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
            await this.onSubmit(collectDraftConfig({ validatePick: true }));
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
      constructor(app, { noteFile, showDate = true, metricKey = "score", metricKeys = null, onSubmit }) {
        super(app);
        this.noteFile = noteFile;
        this.showDate = Boolean(showDate);
        const resolvedKeys = Array.isArray(metricKeys) ? metricKeys.filter((k) => typeof k === "string" && k.trim()).map((k) => k.trim()) : typeof metricKey === "string" && metricKey.trim() ? [metricKey.trim()] : [];
        this.metricKeys = resolvedKeys;
        this.onSubmit = onSubmit;
        this.submitting = false;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("iter-modal");
        contentEl.createEl("h2", { text: `Add "${stripMd(this.noteFile.name)}"`, cls: "iter-modal-title" });
        const fm = this.app.metadataCache?.getFileCache?.(this.noteFile)?.frontmatter ?? null;
        const form = contentEl.createEl("form", { cls: "iter-modal-form" });
        let dateInput = null;
        if (this.showDate) {
          const dateField = form.createDiv({ cls: "iter-modal-field" });
          dateField.createEl("label", { text: "Date", cls: "iter-modal-label" });
          dateInput = dateField.createEl("input", { type: "date", cls: "iter-modal-input" });
          dateInput.value = toDateKey();
          dateInput.required = true;
        }
        const propInputs = /* @__PURE__ */ new Map();
        if (this.metricKeys.length) {
          const grid = form.createDiv({ cls: this.metricKeys.length > 1 ? "iter-modal-row" : "iter-modal-dynamic" });
          for (const key of this.metricKeys) {
            const field = grid.createDiv({ cls: "iter-modal-field" });
            field.createEl("label", { text: `${key} (optional)`, cls: "iter-modal-label" });
            const fmExisting = fm?.[key];
            const placeholder = fmExisting !== void 0 && fmExisting !== null && fmExisting !== "" ? `Frontmatter: ${fmExisting} (blank = sync)` : `Reads "${key}" frontmatter if blank`;
            const input = field.createEl("input", {
              type: "text",
              placeholder,
              cls: "iter-modal-input"
            });
            propInputs.set(key, input);
          }
        }
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
            const props = {};
            let hasProps = false;
            for (const [key, input] of propInputs.entries()) {
              const raw = typeof input.value === "string" ? input.value.trim() : "";
              if (!raw) continue;
              const num = toFiniteNumber(raw);
              props[key] = num !== null ? num : raw;
              hasProps = true;
            }
            const primaryKey = this.metricKeys[0] || "";
            const primaryVal = primaryKey && props[primaryKey] !== void 0 ? toFiniteNumber(props[primaryKey]) : null;
            const payload = { path: this.noteFile.path };
            if (this.showDate && dateInput) payload.date = dateInput.value;
            if (primaryVal !== null) payload.value = primaryVal;
            if (hasProps) payload.props = props;
            await this.onSubmit(payload);
            this.close();
          } catch (error) {
            new Notice2(error instanceof Error ? error.message : String(error));
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
      updateWidget,
      removeWidget,
      discoverChildDatasets,
      resolveVirtualDataset,
      resolveWidgetDataset,
      describeRelation
    } = require_data_model();
    var { evaluatePipeline, buildPipelineFromSimpleConfig } = require_pipeline();
    var { WorkflowEditorModal, renderWidgetDisplayBody } = require_canvas_editor();
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
        const headerActions = header.createDiv({ cls: "iter-goal-top-actions" });
        const openCanvasEditor = (draftConfig = null) => {
          const initialPipeline = draftConfig ? buildPipelineFromSimpleConfig(draftConfig, doc) : null;
          new WorkflowEditorModal(this.app, {
            doc,
            initialTitle: draftConfig?.title || "",
            initialPipeline,
            onSubmit: async (cfg) => {
              await addWidget(this.app, this.file, cfg);
              this.render();
            }
          }).open();
        };
        const canvasBtn = headerActions.createEl("button", { cls: "iter-ghost-action iter-canvas-open-btn", type: "button" });
        const canvasIcon = canvasBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(canvasIcon, "sliders-horizontal");
        canvasBtn.createSpan({ text: "Canvas editor" });
        canvasBtn.addEventListener("click", () => openCanvasEditor());
        const addBtn = headerActions.createEl("button", { cls: "iter-ghost-action", type: "button" });
        const plus = addBtn.createSpan({ cls: "iter-btn-icon" });
        setIcon(plus, "plus");
        addBtn.createSpan({ text: "Add widget" });
        addBtn.addEventListener("click", () => {
          const isTree = doc.kind === "tree" && Boolean(doc.treePath);
          if (doc.kind !== "habit" && !isTree && !doc.datasets.length) {
            new Notice2("Add a data list first, or use the Canvas editor.");
            return;
          }
          const childDatasets = isTree ? discoverChildDatasets(this.app, doc.treePath) : [];
          new AddWidgetModal(this.app, {
            datasets: doc.datasets,
            childDatasets,
            goalKind: doc.kind,
            treePath: doc.treePath,
            onOpenCanvas: (draft) => openCanvasEditor(draft),
            onSubmit: async (config) => {
              await addWidget(this.app, this.file, config);
              this.render();
            }
          }).open();
        });
        if (!doc.widgets.length) {
          section.createEl("p", {
            text: doc.kind === "habit" ? "No widgets yet. Add a streak widget or link custom data below." : doc.kind === "tree" ? "No widgets yet. Summarize or graph data from this tree or its subgoals & habits, or open Canvas editor." : doc.datasets.length ? "No widgets yet. Link a progress bar, metric, graph, or note navigator to your data." : "Add custom data below, then pin widgets here to visualize your progress.",
            cls: "iter-section-hint"
          });
          return;
        }
        const grid = section.createDiv({ cls: "iter-widget-grid" });
        const datasetById = new Map(doc.datasets.map((d) => [d.id, d]));
        for (const widget of doc.widgets) {
          const ds = resolveWidgetDataset(this.app, widget, datasetById, doc);
          this.renderWidgetCard(grid, widget, ds, doc);
        }
      }
      renderWidgetCard(grid, widget, dataset, doc) {
        const callbacks = {
          onOpenFile: (file) => void this.plugin.openFile(file),
          onOpenGoal: (file) => void this.plugin.openGoal(file),
          onMissingNote: (path) => new Notice2(`Note not found: ${path}`)
        };
        if (widget.type === "pipeline") {
          const evalRes = evaluatePipeline(this.app, widget.pipeline, doc);
          const out = evalRes.output;
          const wide2 = out.displayType === "chart" || out.displayType === "goal_bar" || out.displayType === "note_navigator";
          const card2 = grid.createDiv({
            cls: `iter-widget-card type-${out.displayType} is-pipeline${wide2 ? " is-wide" : ""}`
          });
          const top2 = card2.createDiv({ cls: "iter-widget-top" });
          top2.createSpan({ text: widget.title || "Custom Flow", cls: "iter-widget-title" });
          const actions = top2.createDiv({ cls: "iter-widget-top-actions" });
          const editBtn = actions.createEl("button", {
            cls: "iter-icon-button iter-widget-edit",
            type: "button",
            attr: { "aria-label": "Edit flow in canvas", title: "Edit flow in canvas" }
          });
          setIcon(editBtn, "sliders-horizontal");
          editBtn.addEventListener("click", () => {
            new WorkflowEditorModal(this.app, {
              doc,
              initialTitle: widget.title,
              initialPipeline: widget.pipeline,
              onSubmit: async (updated) => {
                await updateWidget(this.app, this.file, widget.id, updated);
                this.render();
              }
            }).open();
          });
          const removeBtn2 = actions.createEl("button", {
            cls: "iter-icon-button iter-widget-remove",
            type: "button",
            attr: { "aria-label": "Remove widget", title: "Remove widget" }
          });
          setIcon(removeBtn2, "x");
          removeBtn2.addEventListener("click", async () => {
            await removeWidget(this.app, this.file, widget.id);
            this.render();
          });
          renderWidgetDisplayBody(card2, out, callbacks);
          return;
        }
        const wide = widget.type === "chart" || widget.type === "goal_bar" || widget.type === "note_navigator";
        const card = grid.createDiv({
          cls: `iter-widget-card type-${widget.type}${wide ? " is-wide" : ""}`
        });
        const top = card.createDiv({ cls: "iter-widget-top" });
        const rawBaseTitle = !dataset ? "Missing dataset" : dataset.name || (widget.relation ? describeRelation(widget.relation, dataset.sources) : "Widget");
        const baseTitle = dataset && widget.metricKey && widget.metricKey !== dataset.metricKey ? `${rawBaseTitle} (${widget.metricKey})` : rawBaseTitle;
        const defaultTitle = widget.type === "streak" ? "Streak" : !dataset ? "Missing dataset" : widget.type === "stat" ? `${baseTitle} \xB7 ${AGG_LABELS[widget.agg] || widget.agg}` : baseTitle;
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
          const sourceNote = dataset.isVirtual && Array.isArray(dataset.sources) ? ` \xB7 ${dataset.sources.length} ${dataset.sources.length === 1 ? "child list" : "child lists"}` : "";
          const subLabel = widget.agg === "count" ? `${res.count} ${res.count === 1 ? "entry" : "entries"}${sourceNote}` : `${AGG_LABELS[widget.agg] || widget.agg} \xB7 ${res.count} ${res.count === 1 ? "point" : "points"}${sourceNote}`;
          card.createDiv({ text: subLabel, cls: "iter-stat-sub" });
          return;
        }
        if (widget.type === "goal_bar") {
          const bar = computeGoalBar(this.app, dataset, widget.mode, widget.target, this.file.path, widget.metricKey);
          renderWidgetDisplayBody(card, { displayType: "goal_bar", bar, unit: bar.unit }, callbacks);
          return;
        }
        if (widget.type === "chart") {
          const points = resolveNumericSeries(this.app, dataset, this.file.path, widget.metricKey);
          const emptyText = dataset.isVirtual ? "No matching numeric entries in child data lists yet." : dataset.type === "note_time" || dataset.type === "note" ? `Add notes with a "${widget.metricKey || dataset.metricKey || "score"}" frontmatter property to plot.` : "Add numeric entries to plot progress over time.";
          renderWidgetDisplayBody(
            card,
            { displayType: "chart", points, variant: widget.variant, unit: dataset.unit, emptyText },
            callbacks
          );
          return;
        }
        if (widget.type === "note_navigator") {
          const entries = resolveDatasetEntries(this.app, dataset, this.file.path, widget.metricKey);
          const ordered = dataset.type === "note_time" ? [...entries].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.index - a.index) : entries;
          renderWidgetDisplayBody(card, { displayType: "note_navigator", entries: ordered }, callbacks);
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
          const isTree = doc.kind === "tree" && Boolean(doc.treePath);
          const childDatasets = isTree ? discoverChildDatasets(this.app, doc.treePath) : [];
          new AddDatasetModal(this.app, {
            goalKind: doc.kind,
            treePath: doc.treePath,
            childDatasets,
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
            text: doc.kind === "tree" ? "Create custom data lists or a Child Rollup to aggregate numbers and notes from subgoals & habits." : 'Create custom data lists like "Benching PRs" (number & date), "Words learnt" (text), or "Mock Exams Done" (notes & date).',
            cls: "iter-section-hint"
          });
          return;
        }
        const list = section.createDiv({ cls: "iter-dataset-grid" });
        for (const dataset of doc.datasets) {
          this.renderDatasetCard(list, dataset, doc);
        }
      }
      triggerDatasetAdd(dataset) {
        if (dataset.type === "rollup") return;
        if (dataset.type === "note") {
          const keys = Array.isArray(dataset.metricKeys) ? dataset.metricKeys : [];
          new NotePickerModal(this.app, async (noteFile) => {
            if (keys.length > 0) {
              new NoteTimeMetaModal(this.app, {
                noteFile,
                showDate: false,
                metricKeys: keys,
                onSubmit: async (entry) => {
                  await addDatasetEntry(this.app, this.file, dataset.id, entry);
                  this.render();
                }
              }).open();
            } else {
              await addDatasetEntry(this.app, this.file, dataset.id, { path: noteFile.path });
              this.render();
            }
          }).open();
          return;
        }
        if (dataset.type === "note_time") {
          const keys = Array.isArray(dataset.metricKeys) && dataset.metricKeys.length ? dataset.metricKeys : [dataset.metricKey || "score"];
          new NotePickerModal(this.app, (noteFile) => {
            new NoteTimeMetaModal(this.app, {
              noteFile,
              showDate: true,
              metricKeys: keys,
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
      renderDatasetCard(container, dataset, doc = null) {
        const isRollup = dataset.type === "rollup";
        const virtual = isRollup ? resolveVirtualDataset(this.app, dataset, this.file.path, doc?.treePath || "") : null;
        const sources = virtual?.sources || [];
        const card = container.createDiv({ cls: "iter-dataset-card" });
        const top = card.createDiv({ cls: "iter-dataset-top" });
        const left = top.createDiv({ cls: "iter-dataset-title-wrap" });
        left.createSpan({ text: dataset.name, cls: "iter-dataset-title" });
        left.createSpan({ text: TYPE_LABELS[dataset.type] || dataset.type, cls: "iter-module-pill" });
        left.createSpan({
          text: String(isRollup ? virtual.resolvedEntries.length : dataset.entries.length),
          cls: "iter-dataset-count"
        });
        const right = top.createDiv({ cls: "iter-dataset-actions" });
        if (!isRollup) {
          const addEntryBtn = right.createEl("button", {
            cls: "iter-icon-button iter-dataset-add-btn",
            type: "button",
            attr: { "aria-label": `Add entry to ${dataset.name}`, title: `Add to ${dataset.name}` }
          });
          setIcon(addEntryBtn, "plus");
          addEntryBtn.addEventListener("click", () => this.triggerDatasetAdd(dataset));
        }
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
        if (isRollup) {
          const summaryRow = card.createDiv({ cls: "iter-rollup-badge" });
          const summaryText = describeRelation(dataset.relation, sources);
          summaryRow.createSpan({
            text: virtual?.unit ? `${summaryText} \xB7 unit: ${virtual.unit}` : summaryText
          });
          if (!sources.length) {
            card.createEl("p", { text: "No matching child data lists yet.", cls: "iter-dataset-empty" });
            return;
          }
          const sourceList = card.createDiv({ cls: "iter-rollup-sources" });
          for (const src of sources) {
            const rowBtn = sourceList.createEl("button", { cls: "iter-rollup-source-row", type: "button" });
            const mainWrap = rowBtn.createDiv({ cls: "iter-rollup-source-main" });
            const icon = mainWrap.createSpan({ cls: "iter-btn-icon" });
            setIcon(icon, src.childKind === "habit" ? "droplet" : "target");
            mainWrap.createSpan({
              text: `${src.childTitle} \u2014 ${src.datasetName}`,
              cls: "iter-rollup-source-title"
            });
            const metaWrap = rowBtn.createDiv({ cls: "iter-rollup-source-meta" });
            if (src.stat && src.stat.count > 0 && src.stat.value !== null) {
              metaWrap.createSpan({
                text: `${src.stat.display}${src.unit ? ` ${src.unit}` : ""}`,
                cls: "iter-note-score-pill"
              });
            }
            metaWrap.createSpan({
              text: `${src.entryCount} ${src.entryCount === 1 ? "entry" : "entries"}`,
              cls: "iter-dataset-count"
            });
            rowBtn.addEventListener("click", () => {
              if (src.file) void this.plugin.openGoal(src.file);
            });
          }
          return;
        }
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
            if (Array.isArray(item.propsList) && item.propsList.length > 0) {
              const pills = row.createDiv({ cls: "iter-prop-pills" });
              for (const p of item.propsList) {
                const valText = p.num !== null ? formatNumber(p.num) : String(p.raw);
                const labelText = item.propsList.length > 1 || dataset.type === "note" || p.num === null ? `${p.key}: ${valText}` : valText;
                pills.createSpan({ text: labelText, cls: "iter-note-score-pill" });
              }
            } else if (item.value !== null) {
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
