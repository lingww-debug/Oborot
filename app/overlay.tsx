"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Overlay({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="overlay"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="overlay-inner">
        <button className="icon-button close-button" type="button" onClick={onClose} aria-label="Закрыть окно">×</button>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
