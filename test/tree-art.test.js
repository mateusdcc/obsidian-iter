const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveStyle, computeTreeGeometry } = require('../src/tree-art');

test('resolveStyle maps modules cleanly when style is auto', () => {
  assert.equal(resolveStyle({ module: 'gym', style: 'auto' }), 'bonsai');
  assert.equal(resolveStyle({ module: 'learning', style: 'auto' }), 'pine');
  assert.equal(resolveStyle({ module: 'creative', style: 'auto' }), 'willow');
  assert.equal(resolveStyle({ module: 'general', style: 'auto' }), 'canopy');
  assert.equal(resolveStyle({ module: 'gym', style: 'pine' }), 'pine');
});

test('computeTreeGeometry is deterministic and grows with progress across all styles', () => {
  for (const style of ['canopy', 'bonsai', 'pine', 'willow']) {
    const young = computeTreeGeometry({
      title: `Goal-${style}`,
      module: 'general',
      style,
      stats: { growth: 0.2, hydrationState: 'thirsty' },
    });
    const mature = computeTreeGeometry({
      title: `Goal-${style}`,
      module: 'general',
      style,
      stats: { growth: 0.95, hydrationState: 'hydrated' },
    });
    const repeat = computeTreeGeometry({
      title: `Goal-${style}`,
      module: 'general',
      style,
      stats: { growth: 0.95, hydrationState: 'hydrated' },
    });

    assert.equal(young.style, style);
    assert.ok(young.trunks.length >= 1);
    assert.ok(young.canopies.length >= 1);
    assert.equal(young.blossoms.length, 0);
    assert.ok(mature.blossoms.length >= 2);
    assert.deepEqual(mature, repeat);
  }
});
