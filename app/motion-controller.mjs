/** Progressive enhancement: content already on screen must never disappear. */
export function mountMotion(root, view = window) {
  const preference = view.matchMedia('(prefers-reduced-motion: reduce)');
  let dispose = () => {};
  function setup() {
    dispose();
    dispose = () => {};
    if (preference.matches || !view.IntersectionObserver) return;
    const waiting = new Set();
    const running = new Map();
    const reveal = (target) => {
      if (!waiting.delete(target)) return;
      target.removeAttribute('data-motion-pending');
      // No fill: completed animations release transform to the hover styles.
      if (typeof target.animate !== 'function') return;
      const animation = target.animate([
        { opacity: 0, transform: 'translateY(16px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 550, easing: 'cubic-bezier(.22,1,.36,1)' });
      running.set(target, animation);
      animation.onfinish = () => { running.delete(target); animation.cancel(); };
    };
    const observer = new view.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    root.querySelectorAll('[data-reveal]').forEach((target) => {
      // Avoid replay on hydration, restored scroll position and preference changes.
      if (target.getBoundingClientRect().top < view.innerHeight || target.hasAttribute('data-motion-seen')) return;
      target.setAttribute('data-motion-seen', '');
      target.setAttribute('data-motion-pending', '');
      waiting.add(target);
      observer.observe(target);
    });
    const focus = (event) => {
      for (const target of waiting) {
        if (!target.contains(event.target)) continue;
        reveal(target);
        observer.unobserve(target);
        running.get(target)?.finish();
      }
    };
    root.addEventListener('focusin', focus);
    const scenes = Array.from(root.querySelectorAll('[data-scene]')).map((scene) => ({
      scene, stage: scene.querySelector('.continuation-sticky'),
    })).filter(({ stage }) => stage);
    let frame = 0;
    const render = () => {
      frame = 0;
      // Read geometry before writing styles, with the actual sticky height/offset.
      const updates = scenes.map(({ scene, stage }) => {
        const rect = scene.getBoundingClientRect();
        const computed = view.getComputedStyle(stage);
        const offset = parseFloat(computed.top) || 0;
        const distance = rect.height - stage.offsetHeight;
        const progress = computed.position !== 'relative' && distance > 0 ? Math.min(1, Math.max(0, (offset - rect.top) / distance)) : 0;
        return { stage, progress };
      });
      updates.forEach(({ stage, progress }) => stage.style.setProperty('--progress', String(progress)));
    };
    const schedule = () => { if (!frame) frame = view.requestAnimationFrame(render); };
    view.addEventListener('scroll', schedule, { passive: true });
    view.addEventListener('resize', schedule, { passive: true });
    schedule();
    dispose = () => {
      observer.disconnect();
      waiting.forEach((target) => target.removeAttribute('data-motion-pending'));
      running.forEach((animation) => animation.cancel());
      root.removeEventListener('focusin', focus);
      view.removeEventListener('scroll', schedule);
      view.removeEventListener('resize', schedule);
      view.cancelAnimationFrame(frame);
      scenes.forEach(({ stage }) => stage.style.removeProperty('--progress'));
    };
  }
  setup();
  preference.addEventListener('change', setup);
  return () => { dispose(); preference.removeEventListener('change', setup); };
}
