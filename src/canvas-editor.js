const { Modal, Notice, setIcon } = require('obsidian');
const { formatNumber, STAT_AGGS, BAR_MODES, CHART_VARIANTS } = require('./data-model');
const { renderChartSvg } = require('./widget-art');
const {
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
} = require('./pipeline');

const NODE_WIDTH = 218;
const PORT_OFFSET_Y = 44;
const CANVAS_W = 2400;
const CANVAS_H = 1600;
const SVG_NS = 'http://www.w3.org/2000/svg';

function renderWidgetDisplayBody(card, payload, { onOpenFile, onOpenGoal, onMissingNote } = {}) {
  const displayType = payload.displayType || 'stat';
  const unit = payload.unit || '';

  if (displayType === 'stat') {
    const res = payload.stat || { display: '—', unit: '', count: 0 };
    const valRow = card.createDiv({ cls: 'iter-stat-value-row' });
    valRow.createSpan({ text: res.display, cls: 'iter-stat-number' });
    if (res.unit && payload.agg !== 'count') {
      valRow.createSpan({ text: res.unit, cls: 'iter-stat-unit' });
    }
    const labelMap = {
      count: 'entries',
      sum: 'Total',
      average: 'Average',
      latest: 'Latest',
      max: 'Max',
      min: 'Min',
    };
    const subLabel = payload.agg === 'count'
      ? `${res.count} ${res.count === 1 ? 'entry' : 'entries'}`
      : `${labelMap[payload.agg] || payload.agg || 'Result'} · ${res.count} ${res.count === 1 ? 'point' : 'points'}`;
    card.createDiv({ text: subLabel, cls: 'iter-stat-sub' });
    return;
  }

  if (displayType === 'goal_bar') {
    const bar = payload.bar || {
      currentDisplay: '—',
      targetDisplay: '—',
      rawPercent: 0,
      fillPercent: 0,
      unit: '',
    };
    const headerRow = card.createDiv({ cls: 'iter-bar-meta' });
    const unitSuffix = bar.unit ? ` ${bar.unit}` : '';
    headerRow.createSpan({
      text: `${bar.currentDisplay}${unitSuffix} / ${bar.targetDisplay}${unitSuffix}`,
      cls: 'iter-bar-numbers',
    });
    headerRow.createSpan({ text: `${bar.rawPercent}%`, cls: 'iter-bar-percent' });

    const track = card.createDiv({ cls: 'iter-bar-track' });
    const fill = track.createDiv({ cls: 'iter-bar-fill' });
    fill.style.width = `${bar.fillPercent}%`;
    return;
  }

  if (displayType === 'chart') {
    const points = payload.points || [];
    if (!points.length) {
      card.createEl('p', {
        text: payload.emptyText || 'No numeric items matched this flow yet.',
        cls: 'iter-widget-empty',
      });
      return;
    }
    const latest = points[points.length - 1];
    const delta = points.length > 1 ? latest.value - points[0].value : null;
    const summary = card.createDiv({ cls: 'iter-chart-summary' });
    summary.createSpan({
      text: `Latest: ${formatNumber(latest.value)}${unit ? ` ${unit}` : ''}`,
    });
    if (delta !== null) {
      const sign = delta > 0 ? '+' : '';
      summary.createSpan({
        text: `${sign}${formatNumber(delta)} overall`,
        cls: delta >= 0 ? 'iter-delta-up' : 'iter-delta-down',
      });
    }
    const host = card.createDiv({ cls: 'iter-chart-host' });
    renderChartSvg(host, points, {
      variant: payload.variant || 'line',
      unit,
      onPointClick: pt => {
        if (pt.noteFile && onOpenFile) onOpenFile(pt.noteFile);
        else if (pt.sourceFile && onOpenGoal) onOpenGoal(pt.sourceFile);
      },
    });
    return;
  }

  if (displayType === 'note_navigator') {
    const entries = payload.entries || [];
    if (!entries.length) {
      card.createEl('p', { text: 'No matching notes yet.', cls: 'iter-widget-empty' });
      return;
    }
    const navList = card.createDiv({ cls: 'iter-note-nav-list' });
    for (const entry of entries) {
      const itemBtn = navList.createEl('button', { cls: 'iter-note-nav-item', type: 'button' });
      const icon = itemBtn.createSpan({ cls: 'iter-note-nav-icon' });
      setIcon(icon, entry.noteFile ? 'file-text' : 'target');
      const main = itemBtn.createSpan({ cls: 'iter-note-nav-main' });
      main.createSpan({ text: entry.label, cls: 'iter-note-nav-title' });
      if (entry.path) {
        const folder = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : 'Vault root';
        const origin = entry.sourceTitle ? `${entry.sourceTitle} · ${folder}` : folder;
        main.createSpan({ text: origin, cls: 'iter-note-nav-path' });
      }
      if (Array.isArray(entry.propsList) && entry.propsList.length > 0) {
        for (const p of entry.propsList) {
          const valStr = p.num !== null ? formatNumber(p.num) : String(p.raw);
          itemBtn.createSpan({ text: `${p.key}: ${valStr}`, cls: 'iter-note-score-pill' });
        }
      } else if (entry.value !== null && entry.value !== undefined) {
        itemBtn.createSpan({ text: formatNumber(entry.value), cls: 'iter-note-score-pill' });
      }
      if (entry.date) {
        itemBtn.createSpan({ text: entry.date, cls: 'iter-note-date-pill' });
      }
      itemBtn.addEventListener('click', () => {
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
  const wrap = container.createDiv({ cls: 'iter-chip-suggestions' });
  for (const label of clean) {
    const chip = wrap.createEl('button', { text: label, type: 'button', cls: 'iter-suggest-chip' });
    chip.addEventListener('click', () => onPick(label));
  }
}

class WorkflowEditorModal extends Modal {
  constructor(app, { doc, initialTitle = '', initialPipeline = null, onSubmit }) {
    super(app);
    this.doc = doc;
    this.title = initialTitle || '';
    this.onSubmit = onSubmit;
    this.context = collectCanvasContext(app, doc);
    this.pipeline = normalizePipeline(initialPipeline, doc);
    this.selectedNodeId = this.pipeline.nodes.find(n => n.type === 'filter' || n.type === 'extract')?.id
      || this.pipeline.nodes[0]?.id
      || null;
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
    this.nodeEls = new Map();
    this.boundMove = null;
    this.boundUp = null;
    this.boundKey = null;
  }

  onOpen() {
    this.modalEl?.addClass?.('iter-flow-modal');
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('iter-flow-shell');

    // Top bar: title, add-node palette, template selector, layout, save/cancel
    const toolbar = contentEl.createDiv({ cls: 'iter-flow-toolbar' });

    const titleGroup = toolbar.createDiv({ cls: 'iter-flow-title-group' });
    const titleInput = titleGroup.createEl('input', {
      type: 'text',
      placeholder: 'Widget title (e.g. Pages Read Across Tree)',
      cls: 'iter-flow-title-input',
    });
    titleInput.value = this.title;
    titleInput.addEventListener('input', () => {
      this.title = titleInput.value;
    });

    const palette = toolbar.createDiv({ cls: 'iter-flow-palette' });
    for (const def of PIPELINE_NODE_TYPES) {
      const btn = palette.createEl('button', {
        type: 'button',
        cls: `iter-flow-add-btn cat-${def.category}`,
        attr: { title: def.shortDesc },
      });
      btn.createSpan({ text: `+ ${def.label}` });
      btn.addEventListener('click', () => this.addNodeFromPalette(def.type));
    }

    const toolsRight = toolbar.createDiv({ cls: 'iter-flow-tools-right' });

    const tplSelect = toolsRight.createEl('select', { cls: 'iter-flow-tpl-select' });
    tplSelect.createEl('option', { value: '', text: 'Load template…' });
    tplSelect.createEl('option', { value: 'filter_field', text: 'Filter by property (e.g. pages)' });
    tplSelect.createEl('option', { value: 'compare_children', text: 'Compare children (Bar Chart)' });
    tplSelect.createEl('option', { value: 'merge_branches', text: 'Merge two branches' });
    tplSelect.createEl('option', { value: 'filtered_notes', text: 'Filtered Note Navigator' });
    tplSelect.createEl('option', { value: 'blank', text: 'Minimal (Source → Output)' });
    tplSelect.value = '';
    tplSelect.addEventListener('change', () => {
      const id = tplSelect.value;
      if (!id) return;
      this.pipeline = buildPipelineTemplate(id, this.doc, this.context);
      this.selectedNodeId = this.pipeline.nodes[1]?.id || this.pipeline.nodes[0]?.id || null;
      this.selectedEdgeId = null;
      this.pendingFromNodeId = null;
      tplSelect.value = '';
      this.refreshAll();
    });

    const layoutBtn = toolsRight.createEl('button', {
      text: 'Auto-layout',
      type: 'button',
      cls: 'iter-btn-ghost',
    });
    layoutBtn.addEventListener('click', () => {
      this.pipeline = autoLayoutPipeline(this.pipeline);
      this.refreshCanvas();
    });

    const cancelBtn = toolsRight.createEl('button', {
      text: 'Cancel',
      type: 'button',
      cls: 'iter-btn-ghost',
    });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = toolsRight.createEl('button', {
      text: 'Save widget',
      type: 'button',
      cls: 'mod-cta',
    });
    saveBtn.addEventListener('click', async () => {
      if (this.submitting) return;
      this.submitting = true;
      saveBtn.disabled = true;
      try {
        if (!this.pipeline.nodes.length) {
          throw new Error('Add at least one node before saving.');
        }
        await this.onSubmit({
          type: 'pipeline',
          title: this.title,
          pipeline: normalizePipeline(this.pipeline, this.doc),
        });
        this.close();
      } catch (err) {
        new Notice(err instanceof Error ? err.message : String(err));
      } finally {
        this.submitting = false;
        saveBtn.disabled = false;
      }
    });

    // Main split: canvas on left, inspector + live widget preview on right
    const body = contentEl.createDiv({ cls: 'iter-flow-body' });

    const canvasCol = body.createDiv({ cls: 'iter-flow-canvas-col' });
    const statusBar = canvasCol.createDiv({ cls: 'iter-flow-canvas-bar' });
    this.statusEl = statusBar.createSpan({ cls: 'iter-flow-status-pill' });

    const zoomRow = statusBar.createDiv({ cls: 'iter-flow-zoom-row' });
    const zoomOut = zoomRow.createEl('button', { text: '−', type: 'button', cls: 'iter-btn-ghost' });
    const zoomReset = zoomRow.createEl('button', { text: 'Reset view', type: 'button', cls: 'iter-btn-ghost' });
    const zoomIn = zoomRow.createEl('button', { text: '+', type: 'button', cls: 'iter-btn-ghost' });
    zoomOut.addEventListener('click', () => this.setZoom(this.pipeline.zoom - 0.12));
    zoomIn.addEventListener('click', () => this.setZoom(this.pipeline.zoom + 0.12));
    zoomReset.addEventListener('click', () => {
      this.pipeline.zoom = 1;
      this.pipeline.panX = 0;
      this.pipeline.panY = 0;
      this.applyWorldTransform();
    });

    this.viewportEl = canvasCol.createDiv({ cls: 'iter-flow-viewport' });
    this.worldEl = this.viewportEl.createDiv({ cls: 'iter-flow-world' });

    if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'iter-flow-wires');
      svg.setAttribute('viewBox', `0 0 ${CANVAS_W} ${CANVAS_H}`);
      svg.setAttribute('width', String(CANVAS_W));
      svg.setAttribute('height', String(CANVAS_H));
      this.worldEl.appendChild(svg);
      this.svgEl = svg;
    }

    this.viewportEl.addEventListener('mousedown', event => {
      if (event.target !== this.viewportEl && event.target !== this.worldEl && event.target !== this.svgEl) return;
      this.selectedEdgeId = null;
      this.pendingFromNodeId = null;
      this.dragState = {
        kind: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        originPanX: this.pipeline.panX,
        originPanY: this.pipeline.panY,
      };
      this.refreshInspector();
      this.renderWires(evaluatePipeline(this.app, this.pipeline, this.doc));
    });

    const sideCol = body.createDiv({ cls: 'iter-flow-side' });
    this.inspectorEl = sideCol.createDiv({ cls: 'iter-flow-inspector' });
    this.previewEl = sideCol.createDiv({ cls: 'iter-flow-preview' });

    this.attachGlobalListeners();
    this.refreshAll();
  }

  attachGlobalListeners() {
    if (typeof window === 'undefined' || !window?.addEventListener) return;
    this.boundMove = event => this.handlePointerMove(event);
    this.boundUp = event => this.handlePointerUp(event);
    this.boundKey = event => this.handleKeyDown(event);
    window.addEventListener('mousemove', this.boundMove);
    window.addEventListener('mouseup', this.boundUp);
    window.addEventListener('keydown', this.boundKey);
  }

  onClose() {
    if (typeof window !== 'undefined' && window?.removeEventListener) {
      if (this.boundMove) window.removeEventListener('mousemove', this.boundMove);
      if (this.boundUp) window.removeEventListener('mouseup', this.boundUp);
      if (this.boundKey) window.removeEventListener('keydown', this.boundKey);
    }
    this.modalEl?.removeClass?.('iter-flow-modal');
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
    if (this.dragState.kind === 'pan') {
      this.pipeline.panX = this.dragState.originPanX + (event.clientX - this.dragState.startX);
      this.pipeline.panY = this.dragState.originPanY + (event.clientY - this.dragState.startY);
      this.applyWorldTransform();
      return;
    }

    if (this.dragState.kind === 'node') {
      const node = this.pipeline.nodes.find(n => n.id === this.dragState.nodeId);
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

    if (this.dragState.kind === 'wire') {
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
    if (prev.kind === 'wire' && prev.dragged) {
      this.renderWires();
    }
  }

  handleKeyDown(event) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    const tag = event.target?.tagName?.toUpperCase?.() || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
    const anchor = this.pipeline.nodes.find(n => n.id === this.selectedNodeId) || null;
    const isSource = !def.hasIn;
    const count = this.pipeline.nodes.length;
    const x = anchor && !isSource ? Math.min(CANVAS_W - 260, anchor.x + 264) : 64 + (count % 3) * 40;
    const y = anchor && !isSource ? anchor.y : 64 + count * 48;

    const initialConfig = type === 'source'
      ? { scope: this.doc?.kind === 'tree' ? 'tree_children' : 'this_goal' }
      : type === 'water_source'
        ? { scope: this.doc?.kind === 'habit' ? 'this_habit' : 'tree_habits' }
        : {};
    const node = createNode(type, { x, y, config: initialConfig });
    this.pipeline.nodes.push(node);

    // Auto-wire from selected upstream node if compatible (n8n-like speed)
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
    const exists = this.pipeline.edges.some(e => e.from === fromId && e.to === toId);
    if (exists) return;
    const fromDef = getNodeDef(this.pipeline.nodes.find(n => n.id === fromId)?.type);
    const toDef = getNodeDef(this.pipeline.nodes.find(n => n.id === toId)?.type);
    if (!fromDef?.hasOut || !toDef?.hasIn) return;
    this.pipeline.edges.push({ id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`, from: fromId, to: toId });
  }

  removeEdge(edgeId) {
    this.pipeline.edges = this.pipeline.edges.filter(e => e.id !== edgeId);
    if (this.selectedEdgeId === edgeId) this.selectedEdgeId = null;
    this.refreshAll();
  }

  removeNode(nodeId) {
    if (this.pipeline.nodes.length <= 1) {
      new Notice('Keep at least one node in the flow.');
      return;
    }
    this.pipeline.nodes = this.pipeline.nodes.filter(n => n.id !== nodeId);
    this.pipeline.edges = this.pipeline.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
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

    // Update top status bar
    if (this.statusEl) {
      const out = evalResult.output;
      let summary = '';
      if (out.displayType === 'stat') {
        summary = `Live: ${out.entries.length} items → ${out.stat.display}${out.stat.unit ? ` ${out.stat.unit}` : ''}`;
      } else if (out.displayType === 'goal_bar') {
        summary = `Live: ${out.bar.currentDisplay} / ${out.bar.targetDisplay} (${out.bar.rawPercent}%)`;
      } else if (out.displayType === 'chart') {
        summary = `Live: ${out.points.length} plotted points`;
      } else {
        summary = `Live: ${out.entries.length} matching notes`;
      }
      this.statusEl.textContent = summary;
    }

    // Remove existing node DOM cards while keeping SVG wire layer intact
    for (const card of this.nodeEls.values()) {
      card.remove?.();
      const idx = this.worldEl.children?.indexOf?.(card);
      if (idx !== undefined && idx >= 0) this.worldEl.children.splice(idx, 1);
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
      cls: `iter-flow-node cat-${def.category}${isSelected ? ' is-selected' : ''}${isPendingFrom ? ' is-connecting' : ''}`,
    });
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    this.nodeEls.set(node.id, card);

    const head = card.createDiv({ cls: 'iter-flow-node-head' });
    head.createSpan({ cls: `iter-flow-cat-dot cat-${def.category}` });
    head.createSpan({ text: node.label || def.label, cls: 'iter-flow-node-title' });
    head.createSpan({ text: String(count), cls: 'iter-flow-count-pill' });

    const body = card.createDiv({ cls: 'iter-flow-node-body' });
    body.createSpan({ text: formatPipelineNodeSummary(node), cls: 'iter-flow-node-summary' });

    card.addEventListener('mousedown', event => {
      if (event.target?.className?.includes?.('iter-flow-port')) return;
      this.selectedNodeId = node.id;
      this.selectedEdgeId = null;
      this.dragState = {
        kind: 'node',
        nodeId: node.id,
        startX: event.clientX,
        startY: event.clientY,
        originX: node.x,
        originY: node.y,
      };
      for (const [id, el] of this.nodeEls.entries()) {
        el.toggleClass?.('is-selected', id === node.id);
      }
      this.refreshInspector(evaluatePipeline(this.app, this.pipeline, this.doc));
    });

    if (def.hasIn) {
      const inPort = card.createEl('button', {
        type: 'button',
        cls: 'iter-flow-port is-in',
        attr: { title: 'Input port (click or drop wire here)', 'aria-label': 'Input port' },
      });
      inPort.addEventListener('mouseup', event => {
        if (this.dragState?.kind === 'wire' && this.dragState.fromNodeId !== node.id) {
          event.stopPropagation?.();
          this.connectNodes(this.dragState.fromNodeId, node.id);
          this.dragState = null;
          this.pendingFromNodeId = null;
          this.refreshAll();
        }
      });
      inPort.addEventListener('click', event => {
        event.stopPropagation?.();
        if (this.pendingFromNodeId && this.pendingFromNodeId !== node.id) {
          this.connectNodes(this.pendingFromNodeId, node.id);
          this.pendingFromNodeId = null;
          this.refreshAll();
        }
      });
    }

    if (def.hasOut) {
      const outPort = card.createEl('button', {
        type: 'button',
        cls: `iter-flow-port is-out${isPendingFrom ? ' is-armed' : ''}`,
        attr: { title: 'Output port (drag or click, then click target input)', 'aria-label': 'Output port' },
      });
      outPort.addEventListener('mousedown', event => {
        event.stopPropagation?.();
        this.dragState = {
          kind: 'wire',
          fromNodeId: node.id,
          startX: event.clientX,
          startY: event.clientY,
          cursorX: node.x + NODE_WIDTH + 30,
          cursorY: node.y + PORT_OFFSET_Y,
          dragged: false,
        };
      });
      outPort.addEventListener('click', event => {
        event.stopPropagation?.();
        this.pendingFromNodeId = this.pendingFromNodeId === node.id ? null : node.id;
        this.refreshCanvas();
      });
    }
  }

  renderWires(evalResult = null) {
    if (!this.svgEl) return;
    if (typeof this.svgEl.empty === 'function') {
      this.svgEl.empty();
    } else {
      while (this.svgEl.firstChild) {
        this.svgEl.removeChild(this.svgEl.firstChild);
      }
    }

    const byId = new Map(this.pipeline.nodes.map(n => [n.id, n]));
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

      const visible = document.createElementNS(SVG_NS, 'path');
      visible.setAttribute('d', d);
      visible.setAttribute('class', `iter-wire-path${selected ? ' is-selected' : ''}${activeCount > 0 ? ' is-active' : ''}`);
      this.svgEl.appendChild(visible);

      const hit = document.createElementNS(SVG_NS, 'path');
      hit.setAttribute('d', d);
      hit.setAttribute('class', 'iter-wire-hit');
      hit.addEventListener('click', event => {
        event.stopPropagation?.();
        this.selectedEdgeId = edge.id;
        this.refreshAll();
      });
      this.svgEl.appendChild(hit);
    }

    if (this.dragState?.kind === 'wire' && this.dragState.dragged) {
      const from = byId.get(this.dragState.fromNodeId);
      if (from) {
        const temp = document.createElementNS(SVG_NS, 'path');
        temp.setAttribute(
          'd',
          bezierPath(from.x + NODE_WIDTH, from.y + PORT_OFFSET_Y, this.dragState.cursorX, this.dragState.cursorY),
        );
        temp.setAttribute('class', 'iter-wire-temp');
        this.svgEl.appendChild(temp);
      }
    }
  }

  refreshInspector(evalResult = evaluatePipeline(this.app, this.pipeline, this.doc)) {
    const host = this.inspectorEl;
    if (!host) return;
    host.empty();

    if (this.selectedEdgeId) {
      const edge = this.pipeline.edges.find(e => e.id === this.selectedEdgeId);
      if (edge) {
        const fromNode = this.pipeline.nodes.find(n => n.id === edge.from);
        const toNode = this.pipeline.nodes.find(n => n.id === edge.to);
        host.createEl('h3', { text: 'Connection', cls: 'iter-flow-ins-title' });
        host.createEl('p', {
          text: `${fromNode?.label || edge.from} → ${toNode?.label || edge.to}`,
          cls: 'iter-section-hint',
        });
        const delEdgeBtn = host.createEl('button', {
          text: 'Disconnect wire',
          type: 'button',
          cls: 'iter-btn-ghost mod-warning',
        });
        delEdgeBtn.addEventListener('click', () => this.removeEdge(edge.id));
        return;
      }
    }

    const node = this.pipeline.nodes.find(n => n.id === this.selectedNodeId);
    if (!node) {
      host.createEl('p', {
        text: 'Select a node on the canvas to configure its options, or drag from ● to ● to wire nodes.',
        cls: 'iter-section-hint',
      });
      return;
    }

    const def = getNodeDef(node.type);
    const header = host.createDiv({ cls: 'iter-flow-ins-head' });
    header.createEl('h3', { text: def?.label || node.type, cls: 'iter-flow-ins-title' });
    if (this.pipeline.nodes.length > 1) {
      const delBtn = header.createEl('button', {
        type: 'button',
        cls: 'iter-icon-button',
        attr: { 'aria-label': 'Delete node', title: 'Delete node' },
      });
      setIcon(delBtn, 'trash-2');
      delBtn.addEventListener('click', () => this.removeNode(node.id));
    }

    const labelField = host.createDiv({ cls: 'iter-modal-field' });
    labelField.createEl('label', { text: 'Node label', cls: 'iter-modal-label' });
    const labelInput = labelField.createEl('input', { type: 'text', cls: 'iter-modal-input' });
    labelInput.value = node.label || '';
    labelInput.addEventListener('input', () => {
      node.label = labelInput.value;
      const cardEl = this.nodeEls.get(node.id);
      const titleEl = cardEl?.findAll?.(e => e.className?.includes?.('iter-flow-node-title'))?.[0];
      if (titleEl) titleEl.textContent = node.label || def?.label || '';
    });

    const onCfgChange = (structural = false) => {
      const nextEval = evaluatePipeline(this.app, this.pipeline, this.doc);
      if (structural) this.refreshInspector(nextEval);
      this.refreshCanvas(nextEval);
      this.refreshPreview(nextEval);
      if (!structural) this.renderSamplePeek(peekSlot, node, nextEval);
    };

    const formBody = host.createDiv({ cls: 'iter-flow-ins-form' });
    this.renderNodeConfigFields(formBody, node, onCfgChange);

    const peekSlot = host.createDiv({ cls: 'iter-flow-peek' });
    this.renderSamplePeek(peekSlot, node, evalResult);
  }

  renderNodeConfigFields(container, node, onChange) {
    const cfg = node.config;

    if (node.type === 'source') {
      const scopeField = container.createDiv({ cls: 'iter-modal-field' });
      scopeField.createEl('label', { text: 'Scope', cls: 'iter-modal-label' });
      const scopeSel = scopeField.createEl('select', { cls: 'iter-modal-select' });
      scopeSel.createEl('option', { value: 'tree_children', text: 'Tree children (subgoals & habits)' });
      scopeSel.createEl('option', { value: 'this_goal', text: 'This goal only' });
      scopeSel.createEl('option', { value: 'both', text: 'This goal + tree children' });
      scopeSel.value = cfg.scope || 'tree_children';
      scopeSel.addEventListener('change', () => {
        cfg.scope = scopeSel.value;
        onChange(true);
      });

      if (cfg.scope !== 'this_goal') {
        const kindField = container.createDiv({ cls: 'iter-modal-field' });
        kindField.createEl('label', { text: 'Children', cls: 'iter-modal-label' });
        const kindSel = kindField.createEl('select', { cls: 'iter-modal-select' });
        kindSel.createEl('option', { value: 'all', text: 'All subgoals & habits' });
        kindSel.createEl('option', { value: 'habits', text: 'Habits only' });
        kindSel.createEl('option', { value: 'subgoals', text: 'Subgoals only' });
        kindSel.value = cfg.childKinds || 'all';
        kindSel.addEventListener('change', () => {
          cfg.childKinds = kindSel.value;
          onChange(false);
        });
      }

      const typeField = container.createDiv({ cls: 'iter-modal-field' });
      typeField.createEl('label', { text: 'Data kinds', cls: 'iter-modal-label' });
      const typeSel = typeField.createEl('select', { cls: 'iter-modal-select' });
      typeSel.createEl('option', { value: 'any', text: 'All data types' });
      typeSel.createEl('option', { value: 'numeric', text: 'Numeric (counters & numeric notes)' });
      typeSel.createEl('option', { value: 'note', text: 'Notes (plain & timed notes)' });
      typeSel.createEl('option', { value: 'text', text: 'Text lists' });
      typeSel.value = cfg.datasetFilter || 'any';
      typeSel.addEventListener('change', () => {
        cfg.datasetFilter = typeSel.value;
        onChange(false);
      });

      const listField = container.createDiv({ cls: 'iter-modal-field' });
      listField.createEl('label', { text: 'Specific data list (optional)', cls: 'iter-modal-label' });
      const listSel = listField.createEl('select', { cls: 'iter-modal-select' });
      listSel.createEl('option', { value: '', text: 'All matching data lists' });
      for (const ds of this.context.localDatasets) {
        if (ds.type === 'rollup') continue;
        listSel.createEl('option', { value: ds.id, text: `This goal — ${ds.name}` });
      }
      for (const ch of this.context.childDatasets) {
        if (ch.dataset.type === 'rollup') continue;
        listSel.createEl('option', { value: ch.dataset.id, text: `${ch.childTitle} — ${ch.dataset.name}` });
      }
      listSel.value = cfg.datasetId || '';
      listSel.addEventListener('change', () => {
        cfg.datasetId = listSel.value;
        onChange(false);
      });

      const matchField = container.createDiv({ cls: 'iter-modal-field' });
      matchField.createEl('label', { text: 'Name contains (optional)', cls: 'iter-modal-label' });
      const matchInput = matchField.createEl('input', {
        type: 'text',
        placeholder: 'e.g. Read, Essays, Pages',
        cls: 'iter-modal-input',
      });
      matchInput.value = cfg.nameMatch || '';
      matchInput.addEventListener('input', () => {
        cfg.nameMatch = matchInput.value;
        onChange(false);
      });
      renderSuggestionChips(matchField, [...this.context.childTitles, ...this.context.datasetNames], chip => {
        matchInput.value = chip;
        cfg.nameMatch = chip;
        onChange(false);
      });
      return;
    }

    if (node.type === 'water_source') {
      const scopeField = container.createDiv({ cls: 'iter-modal-field' });
      scopeField.createEl('label', { text: 'Scope', cls: 'iter-modal-label' });
      const scopeSel = scopeField.createEl('select', { cls: 'iter-modal-select' });
      scopeSel.createEl('option', { value: 'tree_habits', text: 'All habits in tree' });
      scopeSel.createEl('option', { value: 'this_habit', text: 'This habit only' });
      scopeSel.value = cfg.scope || 'tree_habits';
      scopeSel.addEventListener('change', () => {
        cfg.scope = scopeSel.value;
        onChange(false);
      });

      const nameField = container.createDiv({ cls: 'iter-modal-field' });
      nameField.createEl('label', { text: 'Habit name contains (optional)', cls: 'iter-modal-label' });
      const nameInput = nameField.createEl('input', { type: 'text', cls: 'iter-modal-input' });
      nameInput.value = cfg.nameMatch || '';
      nameInput.addEventListener('input', () => {
        cfg.nameMatch = nameInput.value;
        onChange(false);
      });
      return;
    }

    if (node.type === 'filter') {
      const matchField = container.createDiv({ cls: 'iter-modal-field' });
      matchField.createEl('label', { text: 'Match conditions', cls: 'iter-modal-label' });
      const matchSel = matchField.createEl('select', { cls: 'iter-modal-select' });
      matchSel.createEl('option', { value: 'all', text: 'All rules match (AND)' });
      matchSel.createEl('option', { value: 'any', text: 'Any rule matches (OR)' });
      matchSel.value = cfg.match || 'all';
      matchSel.addEventListener('change', () => {
        cfg.match = matchSel.value;
        onChange(false);
      });

      const rules = Array.isArray(cfg.rules) ? cfg.rules : (cfg.rules = []);
      const rulesWrap = container.createDiv({ cls: 'iter-rule-list' });
      const suggestedFields = [
        ...this.context.fieldNames,
        ...FILTER_FIELD_PRESETS.slice(0, 4).map(p => p.id),
      ];

      rules.forEach((rule, idx) => {
        const card = rulesWrap.createDiv({ cls: 'iter-rule-card' });
        const topRow = card.createDiv({ cls: 'iter-rule-row' });

        const fieldIn = topRow.createEl('input', {
          type: 'text',
          placeholder: 'Field or property (e.g. pages, datasetName)',
          cls: 'iter-modal-input',
        });
        fieldIn.value = rule.field || '';
        fieldIn.addEventListener('input', () => {
          rule.field = fieldIn.value;
          onChange(false);
        });

        const delRule = topRow.createEl('button', {
          type: 'button',
          cls: 'iter-icon-button',
          attr: { 'aria-label': 'Remove rule' },
        });
        setIcon(delRule, 'x');
        delRule.addEventListener('click', () => {
          rules.splice(idx, 1);
          onChange(true);
        });

        renderSuggestionChips(card, suggestedFields, chip => {
          fieldIn.value = chip;
          rule.field = chip;
          onChange(false);
        });

        const opRow = card.createDiv({ cls: 'iter-modal-row' });
        const opSel = opRow.createEl('select', { cls: 'iter-modal-select' });
        for (const item of FILTER_OPS) {
          opSel.createEl('option', { value: item.id, text: item.label });
        }
        opSel.value = rule.op || 'contains';

        const valIn = opRow.createEl('input', {
          type: 'text',
          placeholder: 'Value…',
          cls: 'iter-modal-input',
        });
        valIn.value = rule.value || '';
        valIn.style.display = OPS_WITHOUT_VALUE.has(opSel.value) ? 'none' : '';

        opSel.addEventListener('change', () => {
          rule.op = opSel.value;
          valIn.style.display = OPS_WITHOUT_VALUE.has(opSel.value) ? 'none' : '';
          onChange(false);
        });
        valIn.addEventListener('input', () => {
          rule.value = valIn.value;
          onChange(false);
        });
      });

      const addRuleBtn = container.createEl('button', {
        text: '+ Add filter rule',
        type: 'button',
        cls: 'iter-btn-ghost',
      });
      addRuleBtn.addEventListener('click', () => {
        rules.push({
          field: this.context.fieldNames[0] || 'datasetName',
          op: 'contains',
          value: '',
        });
        onChange(true);
      });
      return;
    }

    if (node.type === 'extract') {
      const fField = container.createDiv({ cls: 'iter-modal-field' });
      fField.createEl('label', { text: 'Property / field to read', cls: 'iter-modal-label' });
      const fInput = fField.createEl('input', {
        type: 'text',
        placeholder: 'e.g. pages, chapters, score, value, 1',
        cls: 'iter-modal-input',
      });
      fInput.value = cfg.field || '';
      fInput.addEventListener('input', () => {
        cfg.field = fInput.value;
        onChange(false);
      });
      renderSuggestionChips(fField, [...this.context.fieldNames, 'value', '1'], chip => {
        fInput.value = chip;
        cfg.field = chip;
        onChange(false);
      });

      const fbWrap = container.createEl('label', { cls: 'iter-check-item' });
      const fbBox = fbWrap.createEl('input', { type: 'checkbox', cls: 'iter-check-box' });
      fbBox.checked = Boolean(cfg.fallbackToValue);
      fbWrap.createSpan({ text: 'Keep item number when property is absent', cls: 'iter-check-title' });
      fbBox.addEventListener('change', () => {
        cfg.fallbackToValue = fbBox.checked;
        onChange(false);
      });

      const dropWrap = container.createEl('label', { cls: 'iter-check-item' });
      const dropBox = dropWrap.createEl('input', { type: 'checkbox', cls: 'iter-check-box' });
      dropBox.checked = cfg.dropMissing !== false;
      dropWrap.createSpan({ text: 'Skip items without a numeric value', cls: 'iter-check-title' });
      dropBox.addEventListener('change', () => {
        cfg.dropMissing = dropBox.checked;
        onChange(false);
      });

      const unitField = container.createDiv({ cls: 'iter-modal-field' });
      unitField.createEl('label', { text: 'Unit label (optional)', cls: 'iter-modal-label' });
      const unitIn = unitField.createEl('input', { type: 'text', placeholder: 'e.g. pages, chapters', cls: 'iter-modal-input' });
      unitIn.value = cfg.unit || '';
      unitIn.addEventListener('input', () => {
        cfg.unit = unitIn.value;
        onChange(false);
      });
      return;
    }

    if (node.type === 'math') {
      const row = container.createDiv({ cls: 'iter-modal-row' });
      const opF = row.createDiv({ cls: 'iter-modal-field' });
      opF.createEl('label', { text: 'Operation', cls: 'iter-modal-label' });
      const opSel = opF.createEl('select', { cls: 'iter-modal-select' });
      for (const item of MATH_OPS) opSel.createEl('option', { value: item.id, text: item.label });
      opSel.value = cfg.op || 'multiply';
      opSel.addEventListener('change', () => {
        cfg.op = opSel.value;
        onChange(false);
      });

      const valF = row.createDiv({ cls: 'iter-modal-field' });
      valF.createEl('label', { text: 'Number', cls: 'iter-modal-label' });
      const valIn = valF.createEl('input', { type: 'number', step: 'any', cls: 'iter-modal-input' });
      valIn.value = String(cfg.operand ?? 1);
      valIn.addEventListener('input', () => {
        cfg.operand = Number(valIn.value);
        onChange(false);
      });

      const unitF = container.createDiv({ cls: 'iter-modal-field' });
      unitF.createEl('label', { text: 'New unit (optional)', cls: 'iter-modal-label' });
      const unitIn = unitF.createEl('input', { type: 'text', cls: 'iter-modal-input' });
      unitIn.value = cfg.unit || '';
      unitIn.addEventListener('input', () => {
        cfg.unit = unitIn.value;
        onChange(false);
      });
      return;
    }

    if (node.type === 'group') {
      const row = container.createDiv({ cls: 'iter-modal-row' });
      const byF = row.createDiv({ cls: 'iter-modal-field' });
      byF.createEl('label', { text: 'Group by', cls: 'iter-modal-label' });
      const bySel = byF.createEl('select', { cls: 'iter-modal-select' });
      for (const item of GROUP_BYS) bySel.createEl('option', { value: item.id, text: item.label });
      bySel.value = cfg.by || 'sourceTitle';

      const aggF = row.createDiv({ cls: 'iter-modal-field' });
      aggF.createEl('label', { text: 'Calculation', cls: 'iter-modal-label' });
      const aggSel = aggF.createEl('select', { cls: 'iter-modal-select' });
      for (const item of STAT_AGGS) aggSel.createEl('option', { value: item.id, text: item.label });
      aggSel.value = cfg.agg || 'sum';

      const propF = container.createDiv({ cls: 'iter-modal-field' });
      propF.createEl('label', { text: 'Property key', cls: 'iter-modal-label' });
      const propIn = propF.createEl('input', { type: 'text', placeholder: 'e.g. author, theme', cls: 'iter-modal-input' });
      propIn.value = cfg.propKey || '';
      propF.style.display = bySel.value === 'prop' ? '' : 'none';

      bySel.addEventListener('change', () => {
        cfg.by = bySel.value;
        propF.style.display = bySel.value === 'prop' ? '' : 'none';
        onChange(false);
      });
      aggSel.addEventListener('change', () => {
        cfg.agg = aggSel.value;
        onChange(false);
      });
      propIn.addEventListener('input', () => {
        cfg.propKey = propIn.value;
        onChange(false);
      });
      return;
    }

    if (node.type === 'sort') {
      const row = container.createDiv({ cls: 'iter-modal-row' });
      const byF = row.createDiv({ cls: 'iter-modal-field' });
      byF.createEl('label', { text: 'Order', cls: 'iter-modal-label' });
      const bySel = byF.createEl('select', { cls: 'iter-modal-select' });
      for (const item of SORT_BYS) bySel.createEl('option', { value: item.id, text: item.label });
      bySel.value = cfg.by || 'date_asc';
      bySel.addEventListener('change', () => {
        cfg.by = bySel.value;
        onChange(false);
      });

      const limF = row.createDiv({ cls: 'iter-modal-field' });
      limF.createEl('label', { text: 'Limit (0 = all)', cls: 'iter-modal-label' });
      const limIn = limF.createEl('input', { type: 'number', min: '0', step: '1', cls: 'iter-modal-input' });
      limIn.value = String(cfg.limit ?? 0);
      limIn.addEventListener('input', () => {
        cfg.limit = Number(limIn.value) || 0;
        onChange(false);
      });
      return;
    }

    if (node.type === 'merge') {
      const f = container.createDiv({ cls: 'iter-modal-field' });
      f.createEl('label', { text: 'Duplicates', cls: 'iter-modal-label' });
      const sel = f.createEl('select', { cls: 'iter-modal-select' });
      sel.createEl('option', { value: 'none', text: 'Keep all items from every branch' });
      sel.createEl('option', { value: 'path', text: 'Deduplicate notes by path' });
      sel.createEl('option', { value: 'id', text: 'Deduplicate identical entries' });
      sel.value = cfg.dedupe || 'none';
      sel.addEventListener('change', () => {
        cfg.dedupe = sel.value;
        onChange(false);
      });
      return;
    }

    if (node.type === 'output') {
      const dispF = container.createDiv({ cls: 'iter-modal-field' });
      dispF.createEl('label', { text: 'Widget visualization', cls: 'iter-modal-label' });
      const dispSel = dispF.createEl('select', { cls: 'iter-modal-select' });
      dispSel.createEl('option', { value: 'stat', text: 'Metric Stat' });
      dispSel.createEl('option', { value: 'goal_bar', text: 'Goal Progress Bar' });
      dispSel.createEl('option', { value: 'chart', text: 'Time / Bar Graph' });
      dispSel.createEl('option', { value: 'note_navigator', text: 'Note Navigator' });
      dispSel.value = cfg.displayType || 'stat';
      dispSel.addEventListener('change', () => {
        cfg.displayType = dispSel.value;
        onChange(true);
      });

      if (cfg.displayType === 'stat' || !cfg.displayType) {
        const aggF = container.createDiv({ cls: 'iter-modal-field' });
        aggF.createEl('label', { text: 'Calculation', cls: 'iter-modal-label' });
        const aggSel = aggF.createEl('select', { cls: 'iter-modal-select' });
        for (const item of STAT_AGGS) aggSel.createEl('option', { value: item.id, text: item.label });
        aggSel.value = cfg.agg || 'sum';
        aggSel.addEventListener('change', () => {
          cfg.agg = aggSel.value;
          onChange(false);
        });
      } else if (cfg.displayType === 'goal_bar') {
        const row = container.createDiv({ cls: 'iter-modal-row' });
        const modeF = row.createDiv({ cls: 'iter-modal-field' });
        modeF.createEl('label', { text: 'Compare value', cls: 'iter-modal-label' });
        const modeSel = modeF.createEl('select', { cls: 'iter-modal-select' });
        for (const item of BAR_MODES) modeSel.createEl('option', { value: item.id, text: item.label });
        modeSel.value = cfg.mode || 'sum';
        modeSel.addEventListener('change', () => {
          cfg.mode = modeSel.value;
          onChange(false);
        });

        const tF = row.createDiv({ cls: 'iter-modal-field' });
        tF.createEl('label', { text: 'Target', cls: 'iter-modal-label' });
        const tIn = tF.createEl('input', { type: 'number', step: 'any', cls: 'iter-modal-input' });
        tIn.value = String(cfg.target ?? 100);
        tIn.addEventListener('input', () => {
          cfg.target = Number(tIn.value);
          onChange(false);
        });
      } else if (cfg.displayType === 'chart') {
        const varF = container.createDiv({ cls: 'iter-modal-field' });
        varF.createEl('label', { text: 'Graph style', cls: 'iter-modal-label' });
        const varSel = varF.createEl('select', { cls: 'iter-modal-select' });
        for (const item of CHART_VARIANTS) varSel.createEl('option', { value: item.id, text: item.label });
        varSel.value = cfg.variant || 'bar';
        varSel.addEventListener('change', () => {
          cfg.variant = varSel.value;
          onChange(false);
        });
      }

      const unitF = container.createDiv({ cls: 'iter-modal-field' });
      unitF.createEl('label', { text: 'Unit override (optional)', cls: 'iter-modal-label' });
      const unitIn = unitF.createEl('input', { type: 'text', placeholder: 'Auto from items if blank', cls: 'iter-modal-input' });
      unitIn.value = cfg.unit || '';
      unitIn.addEventListener('input', () => {
        cfg.unit = unitIn.value;
        onChange(false);
      });
    }
  }

  renderSamplePeek(container, node, evalResult) {
    container.empty();
    const res = evalResult.nodeResults.get(node.id);
    const items = res?.items || [];
    container.createEl('div', {
      text: `Node output (${items.length} ${items.length === 1 ? 'item' : 'items'})`,
      cls: 'iter-micro-label',
    });
    if (!items.length) {
      container.createEl('p', { text: 'No items passing through this node yet.', cls: 'iter-section-hint' });
      return;
    }
    const list = container.createDiv({ cls: 'iter-flow-peek-list' });
    for (const item of items.slice(0, 4)) {
      const row = list.createDiv({ cls: 'iter-flow-peek-row' });
      const namePart = item.sourceTitle && item.sourceTitle !== item.label
        ? `${item.sourceTitle} · ${item.label}`
        : item.label;
      row.createSpan({ text: namePart, cls: 'iter-flow-peek-label' });
      if (item.value !== null && item.value !== undefined) {
        row.createSpan({
          text: `${formatNumber(item.value)}${item.unit ? ` ${item.unit}` : ''}`,
          cls: 'iter-note-score-pill',
        });
      }
    }
    if (items.length > 4) {
      container.createEl('span', { text: `+${items.length - 4} more…`, cls: 'iter-dataset-count' });
    }
  }

  refreshPreview(evalResult = evaluatePipeline(this.app, this.pipeline, this.doc)) {
    const host = this.previewEl;
    if (!host) return;
    host.empty();
    host.createEl('div', { text: 'Live widget preview', cls: 'iter-micro-label' });
    const card = host.createDiv({ cls: `iter-widget-card type-${evalResult.output.displayType}` });
    const top = card.createDiv({ cls: 'iter-widget-top' });
    top.createSpan({ text: this.title.trim() || 'Custom Flow Widget', cls: 'iter-widget-title' });
    renderWidgetDisplayBody(card, evalResult.output);
  }
}

module.exports = {
  WorkflowEditorModal,
  renderWidgetDisplayBody,
  NODE_WIDTH,
  PORT_OFFSET_Y,
};
