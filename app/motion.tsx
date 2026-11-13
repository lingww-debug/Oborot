"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { mountMotion } from "./motion-controller.mjs";

export function Motion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) return mountMotion(root.current);
  }, []);
  return <div ref={root} className="motion-root">{children}</div>;
}
