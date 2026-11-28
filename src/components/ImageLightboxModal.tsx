'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';
import type { ExpenseImageAttachment, ProjectCurrency } from '../types/app';
import { formatJalaliDisplay } from '../utils/jalali';
import { formatCurrencyValue, formatNumberFa } from '../utils/pricing';

interface ImageLightboxModalProps {
  open: boolean;
  images: ExpenseImageAttachment[];
  initialIndex?: number;
  title: string;
  dateJalali?: string;
  categoryName?: string;
  amount?: number;
  currency?: ProjectCurrency;
  onClose: () => void;
}

export function ImageLightboxModal({
  open,
  images,
  initialIndex = 0,
  title,
  dateJalali,
  categoryName,
  amount,
  currency = 'تومان',
  onClose,
}: ImageLightboxModalProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [failedKeys, setFailedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setActiveIndex(Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)));
    setFailedKeys({});
  }, [open, initialIndex, images.length]);

  useEffect(() => {
    if (!open || images.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        setActiveIndex((prev) => (prev + 1) % images.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, images.length, onClose]);

  if (!open || images.length === 0) return null;

  const current = images[activeIndex] ?? images[0];
  const hasFailed = Boolean(failedKeys[current.key]);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3.5">
          <div className="min-w-0">
            <h2
              id="lightbox-title"
              className="truncate text-sm font-bold text-white"
            >
              {title}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
              {categoryName && <span>{categoryName}</span>}
              {dateJalali && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatJalaliDisplay(dateJalali)}</span>
                </>
              )}
              {typeof amount === 'number' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-200">
                    {formatCurrencyValue(amount, currency)}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                تصویر {formatNumberFa(activeIndex + 1)} از{' '}
                {formatNumberFa(images.length)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن گالری تصاویر"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Image Area */}
        <div className="relative flex min-h-[340px] flex-1 items-center justify-center bg-slate-950 p-4">
          {hasFailed ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-slate-400">
              <ImageOff className="h-10 w-10 text-slate-500" />
              <div className="text-sm font-medium text-slate-300">
                بارگذاری تصویر ممکن نشد
              </div>
              <div className="text-xs text-slate-500">{current.fileName}</div>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={`${title} - ${current.fileName}`}
              referrerPolicy="no-referrer"
              onError={() =>
                setFailedKeys((prev) => ({ ...prev, [current.key]: true }))
              }
              className="max-h-[62vh] max-w-full rounded-lg object-contain"
            />
          )}

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                aria-label="تصویر قبلی"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900/90 p-2.5 text-white hover:bg-slate-800"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="تصویر بعدی"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900/90 p-2.5 text-white hover:bg-slate-800"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Footer & Thumbnails */}
        <div className="border-t border-slate-800 bg-slate-900 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="truncate">{current.fileName}</span>
            {current.size > 0 && (
              <span className="tabular-nums">
                {formatNumberFa(current.size / 1024, { maxDecimals: 1 })} کیلوبایت
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={img.key}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`نمایش تصویر ${formatNumberFa(idx + 1)}`}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-opacity ${
                      isSelected
                        ? 'border-sky-400 opacity-100'
                        : 'border-slate-700 opacity-65 hover:opacity-100'
                    }`}
                  >
                    {failedKeys[img.key] ? (
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-500">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt={img.fileName}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedKeys((prev) => ({ ...prev, [img.key]: true }))
                        }
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
