"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Scroll motion stays outside React's render loop and respects system preferences. */
export function Motion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let dispose = () => {};
    const setup = () => {
      dispose();
      if (preference.matches) return;
      const animations: Animation[] = [];
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          animations.push(target.animate([
            { opacity: 0, transform: "translate3d(0, 36px, 0)" },
            { opacity: 1, transform: "translate3d(0, 0, 0)" },
          ], { duration: 900, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" }));
          observer.unobserve(target);
        });
      }, { threshold: 0.08 });
      element.querySelectorAll("[data-reveal]").forEach((target) => observer.observe(target));
      const scenes = Array.from(element.querySelectorAll<HTMLElement>("[data-scene]"));
      let frame = 0;
      const render = () => {
        frame = 0;
        scenes.forEach((scene) => {
          const rect = scene.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > innerHeight) return;
          const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - innerHeight)));
          scene.style.setProperty("--progress", String(progress));
        });
      };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
      addEventListener("scroll", schedule, { passive: true });
      addEventListener("resize", schedule, { passive: true });
      schedule();
      dispose = () => {
        observer.disconnect();
        animations.forEach((animation) => animation.cancel());
        removeEventListener("scroll", schedule);
        removeEventListener("resize", schedule);
        cancelAnimationFrame(frame);
        scenes.forEach((scene) => scene.style.removeProperty("--progress"));
      };
    };
    setup();
    preference.addEventListener("change", setup);
    return () => { dispose(); preference.removeEventListener("change", setup); };
  }, []);
  return <div ref={root} className="motion-root">{children}</div>;
}
