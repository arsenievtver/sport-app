import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide = false }: ModalProps) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div
        className={`admin-modal${wide ? " admin-modal--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="admin-modal__title">{title}</h2>
        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );
}
