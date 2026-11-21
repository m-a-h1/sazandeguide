'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'تأیید و ادامه',
  cancelLabel = 'انصراف',
  tone = 'danger',
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                tone === 'danger'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-slate-900"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="بستن پنجره تأیید"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 ${
              tone === 'danger'
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-amber-700 hover:bg-amber-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
