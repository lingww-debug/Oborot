import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMotion } from '../app/motion-controller.mjs';

function element(top, height = 300) {
  const attributes = new Map();
  const properties = new Map();
  const animations = [];
  return {
    attributes, properties, animations,
    getBoundingClientRect: () => ({ top, height }),
    hasAttribute: (name) => attributes.has(name),
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    contains: (target) => target === 'focused-child',
    style: { setProperty: (k, v) => properties.set(k, v), removeProperty: (k) => properties.delete(k) },
    animate: (_, options) => {
      const animation = { options, cancelled: false, cancel() { this.cancelled = true; }, finish() { this.onfinish?.(); } };
      animations.push(animation);
      return animation;
    },
  };
}
function fixture({ reduced = false, targets = [], scenes = [] } = {}) {
  const listeners = new Map();
  const frames = new Map();
  const observed = new Set();
  let id = 0, intersect;
  const preference = { matches: reduced, addEventListener(_, f) { this.change = f; }, removeEventListener() {} };
  const root = {
    querySelectorAll: (q) => q === '[data-reveal]' ? targets : scenes,
    addEventListener: (k, f) => listeners.set(k, f), removeEventListener: (k) => listeners.delete(k),
  };
  const view = {
    innerHeight: 800, matchMedia: () => preference,
    IntersectionObserver: class {
      constructor(callback) { intersect = callback; }
      observe(t) { observed.add(t); }
      unobserve(t) { observed.delete(t); }
      disconnect() { observed.clear(); }
    },
    getComputedStyle: () => ({ top: '70px' }),
    addEventListener: (k, f) => listeners.set(k, f), removeEventListener: (k) => listeners.delete(k),
    requestAnimationFrame: (f) => { frames.set(++id, f); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  return { root, view, preference, frames, listeners, observed,
    enter: (target) => intersect([{ target, isIntersecting: true }]),
    tick: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((f) => f()); },
  };
}

test('hydration and restored scroll never hide content already in the viewport', () => {
  const visible = element(100), partlyVisible = element(790), below = element(1000);
  const f = fixture({ targets: [visible, partlyVisible, below] });
  const stop = mountMotion(f.root, f.view);
  assert.equal(visible.hasAttribute('data-motion-pending'), false);
  assert.equal(partlyVisible.hasAttribute('data-motion-pending'), false);
  assert.equal(below.hasAttribute('data-motion-pending'), true);
  f.enter(below);
  assert.equal(below.hasAttribute('data-motion-pending'), false);
  assert.equal(below.animations.length, 1);
  assert.equal(below.animations[0].options.fill, undefined);
  below.animations[0].finish();
  assert.equal(below.animations[0].cancelled, true);
  assert.equal(f.observed.size, 0);
  stop();
});
test('keyboard focus reveals pending content immediately', () => {
  const below = element(1200), f = fixture({ targets: [below] });
  const stop = mountMotion(f.root, f.view);
  f.listeners.get('focusin')({ target: 'focused-child' });
  assert.equal(below.hasAttribute('data-motion-pending'), false);
  assert.equal(below.animations[0].cancelled, true);
  stop();
});
test('changing reduced motion clears pending content, active animations and scheduled frames', () => {
  const first = element(1000), second = element(1600), f = fixture({ targets: [first, second] });
  const stop = mountMotion(f.root, f.view);
  f.enter(first);
  f.preference.matches = true;
  f.preference.change();
  assert.equal(second.hasAttribute('data-motion-pending'), false);
  assert.equal(first.animations[0].cancelled, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.listeners.size, 0);
  stop();
});
test('reduced motion and missing IntersectionObserver leave all content visible', () => {
  for (const reduced of [true, false]) {
    const target = element(1000), f = fixture({ reduced, targets: [target] });
    if (!reduced) f.view.IntersectionObserver = undefined;
    mountMotion(f.root, f.view)();
    assert.equal(target.attributes.size, 0);
    assert.equal(target.animations.length, 0);
  }
});
test('scene progress uses actual sticky offset and height, clamps at both ends and coalesces scroll frames', () => {
  const stage = element(0); stage.offsetHeight = 730;
  let top = 70;
  const scene = { getBoundingClientRect: () => ({ top, height: 1200 }), querySelector: () => stage };
  const f = fixture({ scenes: [scene] });
  const stop = mountMotion(f.root, f.view);
  f.tick();
  assert.equal(stage.properties.get('--progress'), '0');
  top = -165;
  f.listeners.get('scroll')(); f.listeners.get('scroll')();
  assert.equal(f.frames.size, 1);
  f.tick();
  assert.equal(stage.properties.get('--progress'), '0.5');
  top = -1000; f.listeners.get('scroll')(); f.tick();
  assert.equal(stage.properties.get('--progress'), '1');
  top = 500; f.listeners.get('scroll')(); f.tick();
  assert.equal(stage.properties.get('--progress'), '0');
  stop();
  assert.equal(stage.properties.size, 0);
});
