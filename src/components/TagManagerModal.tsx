'use client';

import React, { useMemo, useState } from 'react';
import { Check, Edit3, Plus, Tag, Trash2, X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { ExpenseTag } from '../types/app';
import { validateTagInput } from '../utils/detailedExpense';
import { formatCurrencyValue, formatNumberFa } from '../utils/pricing';
import { ConfirmModal } from './ConfirmModal';

interface TagManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function TagManagerModal({ open, onClose }: TagManagerModalProps) {
  const {
    activeProject,
    projectTags,
    projectExpenses,
    createTag,
    updateTag,
    deleteTag,
  } = useWorkspace();

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingNameTagId, setEditingNameTagId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [savingTagId, setSavingTagId] = useState<number | null>(null);
  const [tagToDelete, setTagToDelete] = useState<ExpenseTag | null>(null);

  const tagStats = useMemo(() => {
    const map = new Map<number, { count: number; baseSum: number }>();
    for (const exp of projectExpenses) {
      if (typeof exp.tagId === 'number' && exp.tagId > 0) {
        const cur = map.get(exp.tagId) ?? { count: 0, baseSum: 0 };
        cur.count += 1;
        cur.baseSum += exp.baseAmount;
        map.set(exp.tagId, cur);
      }
    }
    return map;
  }, [projectExpenses]);

  if (!open || !activeProject) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const check = validateTagInput(newName, 0);
    if (!check.valid || !check.name) {
      setFormError(check.error || 'اطلاعات برچسب نامعتبر است.');
      return;
    }

    setCreating(true);
    const created = await createTag(check.name, 0);
    setCreating(false);

    if (created) {
      setNewName('');
    } else {
      setFormError('ایجاد برچسب انجام نشد (ممکن است نام تکراری باشد).');
    }
  };

  const handleSaveRename = async (tag: ExpenseTag) => {
    const check = validateTagInput(editingNameValue, tag.percentAdjustment);
    if (!check.valid || !check.name) {
      setFormError(check.error || 'نام برچسب معتبر نیست.');
      return;
    }
    setFormError(null);
    setSavingTagId(tag.id);
    const ok = await updateTag(tag.id, { name: check.name });
    setSavingTagId(null);
    if (ok) {
      setEditingNameTagId(null);
      setEditingNameValue('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-manager-title"
    >
      <div className="my-6 w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Tag className="h-5 w-5 text-slate-700" />
            <div>
              <h2
                id="tag-manager-title"
                className="text-base font-bold text-slate-900"
              >
                مدیریت برچسب‌های هزینه‌های جزئی
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                برای تجمیع خریدهای تکراری یک کالا یا خدمت در یک ردیف بازشو، برچسب بسازید. تنظیم درصد افزایش هر برچسب در بخش «هزینه‌ها و نرخ‌ها» انجام می‌شود.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره مدیریت برچسب‌ها"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create new tag form (name only, no percentage here) */}
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
        >
          <div className="text-xs font-bold text-slate-800">
            ایجاد برچسب جدید
          </div>

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {formError}
            </div>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="new-tag-name"
                className="block text-[11px] font-medium text-slate-600"
              >
                نام برچسب <span className="text-red-600">*</span>
              </label>
              <input
                id="new-tag-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: میلگرد ۱۶، بتن آماده، اجرت اسکلت"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-700 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'در حال ثبت...' : 'افزودن برچسب'}
            </button>
          </div>
        </form>

        {/* Existing tags list */}
        <div className="mt-5 space-y-2.5 max-h-[380px] overflow-y-auto">
          {projectTags.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              هنوز برچسبی برای این پروژه ایجاد نشده است. از فرم بالا اولین برچسب را بسازید.
            </div>
          ) : (
            projectTags.map((tag) => {
              const stats = tagStats.get(tag.id) ?? { count: 0, baseSum: 0 };
              const isEditingName = editingNameTagId === tag.id;
              const isBusy = savingTagId === tag.id;

              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    {isEditingName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          aria-label={`ویرایش نام برچسب ${tag.name}`}
                          className="w-full max-w-xs rounded border border-sky-700 px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSaveRename(tag)}
                          aria-label="ذخیره نام جدید برچسب"
                          className="rounded bg-slate-900 p-1.5 text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNameTagId(null);
                            setEditingNameValue('');
                          }}
                          aria-label="انصراف از ویرایش نام"
                          className="rounded border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-slate-900">
                          {tag.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNameTagId(tag.id);
                            setEditingNameValue(tag.name);
                          }}
                          aria-label={`ویرایش نام برچسب ${tag.name}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
                      <span>{formatNumberFa(stats.count)} ردیف هزینه</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        جمع پایه:{' '}
                        <strong className="text-slate-800">
                          {formatCurrencyValue(
                            stats.baseSum,
                            activeProject.currency
                          )}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setTagToDelete(tag)}
                    aria-label={`حذف برچسب ${tag.name}`}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            بستن
          </button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(tagToDelete)}
        title="تأیید حذف برچسب"
        description={
          tagToDelete
            ? `آیا از حذف برچسب «${tagToDelete.name}» مطمئن هستید؟ هزینه‌های ثبت‌شده با این برچسب حذف نمی‌شوند و فقط از گروه برچسب خارج شده و به‌صورت ردیف بدون برچسب نمایش داده می‌شوند.`
            : ''
        }
        confirmLabel="حذف برچسب"
        onCancel={() => setTagToDelete(null)}
        onConfirm={async () => {
          if (!tagToDelete) return;
          await deleteTag(tagToDelete.id);
          setTagToDelete(null);
        }}
      />
    </div>
  );
}
