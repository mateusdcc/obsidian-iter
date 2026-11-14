class ItemView {
  constructor(leaf) {
    this.leaf = leaf;
    this.app = leaf.app;
  }
}

class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
    this.commands = [];
    this.views = new Map();
  }
  registerView(type, factory) { this.views.set(type, factory); }
  registerEvent() {}
  addCommand(cmd) { this.commands.push(cmd); }
  addRibbonIcon() {}
}

class Modal {
  constructor(app) { this.app = app; }
  open() { this.app.lastModal = this; }
  close() {}
}

class Notice {
  constructor(message) { this.message = message; }
}

function setIcon() {}

function parseSimpleYamlFrontmatter(content) {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return {};
  const fm = {};
  const lines = match[1].split('\n');
  let currentMapKey = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const nested = /^  ([^:]+):\s*(.*)$/.exec(line);
    if (nested && currentMapKey) {
      fm[currentMapKey][nested[1].trim()] = parseScalar(nested[2].trim());
      continue;
    }
    const kv = /^([^:]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].trim();
    const raw = kv[2].trim();
    if (!raw) {
      fm[key] = {};
      currentMapKey = key;
    } else {
      currentMapKey = null;
      fm[key] = parseScalar(raw);
    }
  }
  return fm;
}

function parseScalar(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw === '[]') return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try { return JSON.parse(raw); } catch (_) { return []; }
  }
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function createMockApp() {
  const entries = new Map();
  const root = { path: '', name: '', children: [] };
  entries.set('', root);

  const frontmatters = new Map();

  function linkToParent(entry) {
    const idx = entry.path.lastIndexOf('/');
    const parentPath = idx === -1 ? '' : entry.path.slice(0, idx);
    const parent = entries.get(parentPath);
    if (parent && Array.isArray(parent.children) && !parent.children.includes(entry)) {
      parent.children.push(entry);
    }
    entry.parent = parent ?? null;
  }

  const vault = {
    getAbstractFileByPath(path) {
      return entries.get(path) ?? null;
    },
    async createFolder(path) {
      if (entries.has(path)) throw new Error(`Folder already exists: ${path}`);
      const parts = path.split('/');
      let cur = '';
      for (const part of parts) {
        cur = cur ? `${cur}/${part}` : part;
        if (!entries.has(cur)) {
          const folder = { path: cur, name: part, children: [] };
          entries.set(cur, folder);
          linkToParent(folder);
        }
      }
      return entries.get(path);
    },
    async create(path, content) {
      if (entries.has(path)) throw new Error(`File already exists: ${path}`);
      const idx = path.lastIndexOf('/');
      const name = idx === -1 ? path : path.slice(idx + 1);
      const dot = name.lastIndexOf('.');
      const extension = dot === -1 ? '' : name.slice(dot + 1);
      const file = { path, name, extension, content };
      entries.set(path, file);
      linkToParent(file);
      frontmatters.set(path, parseSimpleYamlFrontmatter(content));
      return file;
    },
  };

  const metadataCache = {
    getFileCache(file) {
      if (!file) return null;
      return { frontmatter: frontmatters.get(file.path) ?? {} };
    },
  };

  const fileManager = {
    async processFrontMatter(file, updater) {
      const fm = frontmatters.get(file.path) ?? {};
      updater(fm);
      frontmatters.set(file.path, fm);
    },
  };

  return { vault, metadataCache, fileManager, _frontmatters: frontmatters };
}

module.exports = {
  ItemView,
  Plugin,
  Modal,
  Notice,
  setIcon,
  createMockApp,
};
