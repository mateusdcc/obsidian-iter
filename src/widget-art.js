const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
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

  const values = points.map(p => p.value);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (options.variant === 'bar') {
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
    const x = options.variant === 'bar'
      ? pad.left + ((index + 0.5) / count) * plotW
      : pad.left + xRatio * plotW;
    const yRatio = (point.value - minVal) / span;
    const y = pad.top + plotH - yRatio * plotH;
    return {
      ...point,
      x: round(x),
      y: round(y),
    };
  });

  return { width, height, pad, plotW, plotH, minVal, maxVal, coords };
}

function formatAxisVal(val) {
  if (!Number.isFinite(val)) return '';
  if (Math.abs(val) >= 1000) return `${Math.round(val / 100) / 10}k`;
  return Number.isInteger(val) ? String(val) : String(Math.round(val * 10) / 10);
}

function renderChartSvg(container, points, { variant = 'line', unit = '', onPointClick } = {}) {
  const geo = computeChartGeometry(points, { variant });
  const { width, height, pad, plotW, plotH, minVal, maxVal, coords } = geo;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: `iter-chart-svg is-${variant}`,
    role: 'img',
    'aria-label': `Progress ${variant} chart`,
  });

  // Subtle baseline & mid/top hairlines
  const baselineY = pad.top + plotH;
  for (const ratio of [0, 0.5, 1]) {
    const y = round(pad.top + plotH * (1 - ratio));
    svg.appendChild(svgEl('line', {
      x1: pad.left,
      y1: y,
      x2: pad.left + plotW,
      y2: y,
      class: ratio === 0 ? 'iter-chart-axis' : 'iter-chart-grid',
    }));
  }

  const minLabel = svgEl('text', { x: pad.left - 6, y: baselineY + 3, class: 'iter-chart-label is-y' });
  minLabel.textContent = formatAxisVal(minVal);
  svg.appendChild(minLabel);

  const maxLabel = svgEl('text', { x: pad.left - 6, y: pad.top + 4, class: 'iter-chart-label is-y' });
  maxLabel.textContent = formatAxisVal(maxVal);
  svg.appendChild(maxLabel);

  if (!coords.length) return svg;

  if (variant === 'bar') {
    const slotW = plotW / coords.length;
    const barW = Math.min(28, Math.max(6, slotW * 0.58));
    for (const pt of coords) {
      const barH = Math.max(3, baselineY - pt.y);
      const rect = svgEl('rect', {
        x: round(pt.x - barW / 2),
        y: round(baselineY - barH),
        width: round(barW),
        height: round(barH),
        rx: Math.min(4, round(barW / 3)),
        class: `iter-chart-bar${pt.noteFile ? ' is-clickable' : ''}`,
      });
      const tip = svgEl('title');
      tip.textContent = `${pt.date || ''}: ${pt.value}${unit ? ` ${unit}` : ''}${pt.noteFile ? ` (${pt.label})` : ''}`;
      rect.appendChild(tip);
      if (pt.noteFile && onPointClick) {
        rect.addEventListener('click', () => onPointClick(pt));
      }
      svg.appendChild(rect);
    }
  } else {
    if (coords.length > 1) {
      const linePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
      const areaPoints = `${coords[0].x},${baselineY} ${linePoints} ${coords[coords.length - 1].x},${baselineY}`;
      svg.appendChild(svgEl('polygon', { points: areaPoints, class: 'iter-chart-area' }));
      svg.appendChild(svgEl('polyline', { points: linePoints, class: 'iter-chart-line' }));
    }
    for (const pt of coords) {
      const circle = svgEl('circle', {
        cx: pt.x,
        cy: pt.y,
        r: coords.length === 1 ? 4.5 : 3.5,
        class: `iter-chart-dot${pt.noteFile ? ' is-clickable' : ''}`,
      });
      const tip = svgEl('title');
      tip.textContent = `${pt.date || ''}: ${pt.value}${unit ? ` ${unit}` : ''}${pt.noteFile ? ` (${pt.label})` : ''}`;
      circle.appendChild(tip);
      if (pt.noteFile && onPointClick) {
        circle.addEventListener('click', () => onPointClick(pt));
      }
      svg.appendChild(circle);
    }
  }

  // Date range labels
  const firstDate = coords[0]?.date;
  const lastDate = coords[coords.length - 1]?.date;
  if (firstDate) {
    const leftText = svgEl('text', { x: pad.left, y: height - 5, class: 'iter-chart-label is-x-start' });
    leftText.textContent = firstDate;
    svg.appendChild(leftText);
  }
  if (lastDate && lastDate !== firstDate) {
    const rightText = svgEl('text', { x: pad.left + plotW, y: height - 5, class: 'iter-chart-label is-x-end' });
    rightText.textContent = lastDate;
    svg.appendChild(rightText);
  }

  container.appendChild(svg);
  return svg;
}

module.exports = {
  computeChartGeometry,
  renderChartSvg,
};
