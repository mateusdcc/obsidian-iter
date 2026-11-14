const SVG_NS = 'http://www.w3.org/2000/svg';

function hashString(input) {
  let hash = 2166136261;
  const text = String(input || 'iter');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seedValue) {
  let state = seedValue || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function resolveStyle(tree) {
  if (tree?.style && tree.style !== 'auto') return tree.style;
  switch (tree?.module) {
    case 'gym':
      return 'bonsai';
    case 'learning':
      return 'pine';
    case 'creative':
      return 'willow';
    default:
      return 'canopy';
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
    { d: `M 80 ${baseY} Q ${round(midX)} ${round(midY)} ${round(topX)} ${round(topY)}`, width: round(2.2 + growth * 2.4) },
  ];
  const branches = [];
  const canopies = [];
  const blossoms = [];

  if (growth < 0.25) {
    canopies.push(
      { kind: 'ellipse', cx: round(topX - 8), cy: round(topY - 2), rx: 8, ry: 4.5, rotate: -26, tone: 'a' },
      { kind: 'ellipse', cx: round(topX + 8), cy: round(topY - 4), rx: 7.5, ry: 4, rotate: 24, tone: 'b' },
    );
    return { trunks, branches, canopies, blossoms };
  }

  const leftBranchX = topX - (14 + growth * 14);
  const leftBranchY = topY + height * 0.28;
  const rightBranchX = topX + (14 + growth * 14);
  const rightBranchY = topY + height * 0.22;

  branches.push(
    { d: `M ${round((midX + topX) / 2)} ${round(baseY - height * 0.52)} Q ${round(topX - 10)} ${round(leftBranchY + 8)} ${round(leftBranchX)} ${round(leftBranchY)}`, width: round(1.5 + growth * 1.1) },
    { d: `M ${round((midX + topX) / 2)} ${round(baseY - height * 0.58)} Q ${round(topX + 10)} ${round(rightBranchY + 8)} ${round(rightBranchX)} ${round(rightBranchY)}`, width: round(1.5 + growth * 1.1) },
  );

  const scale = 0.65 + growth * 0.52;
  canopies.push(
    { kind: 'ellipse', cx: round(leftBranchX), cy: round(leftBranchY - 4), rx: round(18 * scale), ry: round(13 * scale), rotate: -8, tone: 'b' },
    { kind: 'ellipse', cx: round(rightBranchX), cy: round(rightBranchY - 5), rx: round(19 * scale), ry: round(14 * scale), rotate: 8, tone: 'b' },
    { kind: 'ellipse', cx: round(topX), cy: round(topY - 8), rx: round(24 * scale), ry: round(18 * scale), rotate: 0, tone: 'a' },
  );

  if (growth >= 0.55) {
    canopies.push(
      { kind: 'ellipse', cx: round(topX - 11), cy: round(topY - 14), rx: round(15 * scale), ry: round(11 * scale), rotate: -5, tone: 'c' },
      { kind: 'ellipse', cx: round(topX + 10), cy: round(topY - 12), rx: round(14 * scale), ry: round(11 * scale), rotate: 6, tone: 'a' },
    );
  }

  if (growth >= 0.85) {
    blossoms.push(
      { cx: round(topX - 12), cy: round(topY - 10), r: 2.3 },
      { cx: round(topX + 8), cy: round(topY - 17), r: 2.1 },
      { cx: round(rightBranchX + 4), cy: round(rightBranchY - 7), r: 2 },
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
    { d: `M 80 ${baseY} C ${round(80 - dir * 24)} ${round(baseY - height * 0.35)}, ${round(bendX)} ${round(baseY - height * 0.72)}, ${round(apexX)} ${round(apexY)}`, width: round(2.8 + growth * 2.6) },
  ];
  const branches = [];
  const canopies = [];
  const blossoms = [];

  if (growth < 0.25) {
    canopies.push(
      { kind: 'ellipse', cx: round(apexX), cy: round(apexY - 4), rx: 11, ry: 5, rotate: dir * 6, tone: 'a' },
    );
    return { trunks, branches, canopies, blossoms };
  }

  const sideX = 80 - dir * (22 + growth * 14);
  const sideY = baseY - height * 0.54;
  branches.push(
    { d: `M ${round(80 - dir * 10)} ${round(baseY - height * 0.45)} Q ${round(sideX + dir * 8)} ${round(sideY + 6)} ${round(sideX)} ${round(sideY)}`, width: round(1.8 + growth) },
  );

  const padScale = 0.7 + growth * 0.48;
  canopies.push(
    { kind: 'ellipse', cx: round(sideX), cy: round(sideY - 4), rx: round(19 * padScale), ry: round(8 * padScale), rotate: -dir * 4, tone: 'b' },
    { kind: 'ellipse', cx: round(apexX), cy: round(apexY - 5), rx: round(24 * padScale), ry: round(9.5 * padScale), rotate: dir * 3, tone: 'a' },
  );

  if (growth >= 0.58) {
    const upperX = apexX - dir * 16;
    const upperY = apexY + 12;
    branches.push(
      { d: `M ${round(apexX - dir * 4)} ${round(apexY + 16)} Q ${round(upperX + dir * 6)} ${round(upperY + 4)} ${round(upperX)} ${round(upperY)}`, width: 1.6 },
    );
    canopies.push(
      { kind: 'ellipse', cx: round(upperX), cy: round(upperY - 4), rx: round(15 * padScale), ry: round(7 * padScale), rotate: 0, tone: 'c' },
    );
  }

  if (growth >= 0.85) {
    blossoms.push(
      { cx: round(apexX - 8), cy: round(apexY - 8), r: 2.2 },
      { cx: round(apexX + 9), cy: round(apexY - 5), r: 2 },
      { cx: round(sideX), cy: round(sideY - 6), r: 2 },
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
    { d: `M 80 ${baseY} Q ${round(80 - sway * 0.5)} ${round(baseY - height * 0.5)} ${round(topX)} ${round(topY + 8)}`, width: round(2.2 + growth * 2) },
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
      `Q ${round(cx - halfWidth * 0.55)} ${round(tierY - tierHeight * 0.25)} ${round(cx)} ${round(peakY)} Z`,
    ].join(' ');
    canopies.push({ kind: 'path', d, tone: i % 2 === 0 ? 'a' : 'b' });
  }

  if (growth >= 0.85) {
    blossoms.push(
      { cx: round(topX), cy: round(topY - 2), r: 2.2 },
      { cx: round(topX - 9), cy: round(topY + 18), r: 1.9 },
      { cx: round(topX + 10), cy: round(topY + 26), r: 1.9 },
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
    { d: `M 80 ${baseY} Q ${round(80 - lean * 0.4)} ${round(baseY - height * 0.48)} ${round(topX)} ${round(topY + 6)}`, width: round(2.2 + growth * 2.2) },
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
      soft: true,
    });
    canopies.push({
      kind: 'ellipse',
      cx: round(endX),
      cy: round(endY - 4),
      rx: 3.8,
      ry: 7.5,
      rotate: round(offset * 0.35),
      tone: i % 2 === 0 ? 'a' : 'b',
    });
  }

  canopies.unshift({
    kind: 'ellipse',
    cx: round(topX),
    cy: round(topY - 2),
    rx: round(12 + growth * 12),
    ry: round(7 + growth * 5),
    rotate: 0,
    tone: 'c',
  });

  if (growth >= 0.85) {
    blossoms.push(
      { cx: round(topX - 8), cy: round(topY - 3), r: 2.1 },
      { cx: round(topX + 9), cy: round(topY + 1), r: 2 },
    );
  }

  return { trunks, branches, canopies, blossoms };
}

function computeTreeGeometry(tree) {
  const growth = clamp(tree?.stats?.growth ?? 0.2, 0.15, 1);
  const style = resolveStyle(tree);
  const rand = createRng(hashString(`${tree?.title || 'Iter'}:${style}`));

  let shapes;
  if (style === 'bonsai') shapes = buildBonsaiGeometry(growth, rand);
  else if (style === 'pine') shapes = buildPineGeometry(growth, rand);
  else if (style === 'willow') shapes = buildWillowGeometry(growth, rand);
  else shapes = buildCanopyGeometry(growth, rand);

  return {
    style,
    growth,
    hydrationState: tree?.stats?.hydrationState ?? 'calm',
    ...shapes,
  };
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  if (typeof node.isShown !== 'function') {
    node.isShown = function () {
      return Boolean(this.isConnected);
    };
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  return node;
}

function appendPot(svg, hydrationState) {
  svg.appendChild(svgEl('ellipse', {
    cx: 80, cy: 164, rx: 28, ry: 3.5, class: 'iter-svg-shadow',
  }));
  svg.appendChild(svgEl('path', {
    d: 'M 55 135 L 105 135 L 98 159 Q 97 162 93 162 L 67 162 Q 63 162 62 159 Z',
    class: 'iter-svg-pot',
  }));
  svg.appendChild(svgEl('rect', {
    x: 51, y: 129, width: 58, height: 6, rx: 3, class: 'iter-svg-rim',
  }));
  svg.appendChild(svgEl('path', {
    d: 'M 56 129 Q 80 125 104 129',
    class: 'iter-svg-soil',
  }));

  if (hydrationState === 'hydrated' || hydrationState === 'partial') {
    const dewGroup = svgEl('g', {
      class: hydrationState === 'hydrated' ? 'iter-svg-dew is-hydrated' : 'iter-svg-dew is-partial',
    });
    dewGroup.appendChild(svgEl('path', {
      d: 'M 116 142 C 116 142 120 147.5 120 150 A 4 4 0 1 1 112 150 C 112 147.5 116 142 116 142 Z',
    }));
    svg.appendChild(dewGroup);
  }
}

function renderTreeSvg(container, tree, options = {}) {
  const geo = computeTreeGeometry(tree);
  const svg = svgEl('svg', {
    viewBox: '0 0 160 176',
    class: `iter-tree-svg is-${geo.hydrationState} style-${geo.style}${options.large ? ' is-large' : ''}`,
    role: 'img',
    'aria-label': `${tree?.title || 'Tree'} (${tree?.stats?.stageLabel || 'Seedling'})`,
  });

  const treeGroup = svgEl('g', { class: 'iter-svg-plant' });
  const canopyGroup = svgEl('g', { class: 'iter-svg-canopy' });

  for (const trunk of geo.trunks) {
    treeGroup.appendChild(svgEl('path', {
      d: trunk.d,
      'stroke-width': trunk.width,
      class: 'iter-svg-trunk',
    }));
  }

  for (const branch of geo.branches) {
    treeGroup.appendChild(svgEl('path', {
      d: branch.d,
      'stroke-width': branch.width,
      class: branch.soft ? 'iter-svg-branch is-soft' : 'iter-svg-branch',
    }));
  }

  for (const shape of geo.canopies) {
    if (shape.kind === 'path') {
      canopyGroup.appendChild(svgEl('path', {
        d: shape.d,
        class: `iter-svg-foliage tone-${shape.tone}`,
      }));
    } else {
      const transform = shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : null;
      canopyGroup.appendChild(svgEl('ellipse', {
        cx: shape.cx,
        cy: shape.cy,
        rx: shape.rx,
        ry: shape.ry,
        transform,
        class: `iter-svg-foliage tone-${shape.tone}`,
      }));
    }
  }

  for (const blossom of geo.blossoms) {
    canopyGroup.appendChild(svgEl('circle', {
      cx: blossom.cx,
      cy: blossom.cy,
      r: blossom.r,
      class: 'iter-svg-blossom',
    }));
  }

  treeGroup.appendChild(canopyGroup);
  svg.appendChild(treeGroup);
  appendPot(svg, geo.hydrationState);
  container.appendChild(svg);
  return svg;
}

function renderEmptyPotSvg(container) {
  const svg = svgEl('svg', {
    viewBox: '0 0 160 176',
    class: 'iter-tree-svg is-empty-pot',
    'aria-hidden': 'true',
  });
  svg.appendChild(svgEl('path', {
    d: 'M 80 128 Q 78 112 72 106',
    'stroke-width': 2,
    class: 'iter-svg-trunk',
  }));
  svg.appendChild(svgEl('ellipse', {
    cx: 72, cy: 103, rx: 6, ry: 3.2, transform: 'rotate(-25 72 103)', class: 'iter-svg-foliage tone-a',
  }));
  appendPot(svg, 'calm');
  container.appendChild(svg);
  return svg;
}

module.exports = {
  resolveStyle,
  computeTreeGeometry,
  renderTreeSvg,
  renderEmptyPotSvg,
};
