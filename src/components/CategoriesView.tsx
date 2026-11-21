'use client';

import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  FolderPlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { CategoryItem } from '../types/app';
import { formatCurrencyValue, formatNumberFa } from '../utils/pricing';
import { ConfirmModal } from './ConfirmModal';

export function CategoriesView() {
  const {
    activeProject,
    projectCategories,
    projectExpenses,
    createCategory,
    updateCategory,
    reorderCategories,
    deleteCategory,
  } = useWorkspace();

  const [newCatName, setNewCatName] = useState('');
  const [newSubInput, setNewSubInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Edit category inline/modal
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editSubs, setEditSubs] = useState<string[]>([]);
  const [addSubDraft, setAddSubDraft] = useState('');

  // Delete category warning + transfer selection
  const [catToDelete, setCatToDelete] = useState<CategoryItem | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string>('');

  if (!activeProject) return null;

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setFormError('نام دسته اصلی الزامی است.');
      return;
    }
    if (projectCategories.some((c) => c.name === trimmed)) {
      setFormError('دسته‌ای با این نام از قبل در این پروژه وجود دارد.');
      return;
    }
    const subs = newSubInput
      .split('،')
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = await createCategory(trimmed, subs);
    if (ok) {
      setNewCatName('');
      setNewSubInput('');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= projectCategories.length) return;
    const ids = projectCategories.map((c) => c.id);
    const temp = ids[index];
    ids[index] = ids[targetIdx];
    ids[targetIdx] = temp;
    await reorderCategories(ids);
  };

  const openEditCategory = (cat: CategoryItem) => {
    setEditingCat(cat);
    setEditCatName(cat.name);
    setEditSubs([...cat.subcategories]);
    setAddSubDraft('');
  };

  const handleSaveCategoryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editCatName.trim()) return;
    await updateCategory(editingCat.id, {
      name: editCatName.trim(),
      subcategories: editSubs,
    });
    setEditingCat(null);
  };

  const handlePrepareDelete = (cat: CategoryItem) => {
    setCatToDelete(cat);
    const firstOther = projectCategories.find((c) => c.id !== cat.id);
    setTransferTargetId(firstOther ? String(firstOther.id) : '');
  };

  const expensesInCatToDelete = catToDelete
    ? projectExpenses.filter(
        (e) => e.categoryId === catToDelete.id || e.categoryName === catToDelete.name
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-lg font-bold text-slate-900">
          مدیریت دسته‌ها و زیرمجموعه‌های هزینه
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          می‌توانید دسته‌ها و زیردسته‌ها را بسازید، ویرایش کنید، جابه‌جا کنید یا در صورت نیاز هزینه‌های یک دسته را به دستهٔ دیگر منتقل نمایید.
        </p>

        {/* Add Category Form */}
        <form
          onSubmit={handleAddCategory}
          className="mt-5 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-12 items-end"
        >
          <div className="sm:col-span-4">
            <label
              htmlFor="new-cat-name"
              className="block text-xs font-semibold text-slate-700"
            >
              نام دسته اصلی جدید
            </label>
            <input
              id="new-cat-name"
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="مثال: محوطه‌سازی و نما"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            />
          </div>
          <div className="sm:col-span-5">
            <label
              htmlFor="new-cat-subs"
              className="block text-xs font-semibold text-slate-700"
            >
              زیردسته‌های اولیه (با «،» جدا کنید)
            </label>
            <input
              id="new-cat-subs"
              type="text"
              value={newSubInput}
              onChange={(e) => setNewSubInput(e.target.value)}
              placeholder="مثال: فضای سبز، سنگ‌فرش، نورپردازی"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <FolderPlus className="h-4 w-4" />
              افزودن دستهٔ جدید
            </button>
          </div>
          {formError && (
            <div className="sm:col-span-12 text-xs text-red-700">{formError}</div>
          )}
        </form>
      </div>

      {/* Categories List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {projectCategories.map((cat, idx) => {
          const catExpenses = projectExpenses.filter(
            (e) => e.categoryId === cat.id || e.categoryName === cat.name
          );
          const catTotal = catExpenses.reduce((s, e) => s + e.baseAmount, 0);

          return (
            <div
              key={cat.id}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {cat.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                    {formatNumberFa(catExpenses.length)} هزینهٔ ثبت‌شده
                    <span className="mx-1.5">·</span>
                    جمع پایه: {formatCurrencyValue(catTotal, activeProject.currency)}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    aria-label={`انتقال دسته ${cat.name} به بالا`}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === projectCategories.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    aria-label={`انتقال دسته ${cat.name} به پایین`}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditCategory(cat)}
                    aria-label={`ویرایش دسته ${cat.name}`}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrepareDelete(cat)}
                    aria-label={`حذف دسته ${cat.name}`}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs font-medium text-slate-500">
                  زیردسته‌ها / بخش‌ها:
                </div>
                {cat.subcategories.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-400">
                    زیردسته‌ای تعریف نشده است.
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-6 text-slate-700">
                    {cat.subcategories.join('  ·  ')}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Category Modal */}
      {editingCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                ویرایش دسته و زیرمجموعه‌ها
              </h3>
              <button
                type="button"
                onClick={() => setEditingCat(null)}
                aria-label="بستن ویرایش دسته"
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategoryEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  نام دسته اصلی
                </label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  زیردسته‌ها
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={addSubDraft}
                    onChange={(e) => setAddSubDraft(e.target.value)}
                    placeholder="نام زیردستهٔ جدید"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const s = addSubDraft.trim();
                      if (s && !editSubs.includes(s)) {
                        setEditSubs([...editSubs, s]);
                        setAddSubDraft('');
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    افزودن
                  </button>
                </div>

                <div className="mt-3 max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {editSubs.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400">
                      هنوز زیردسته‌ای اضافه نشده است.
                    </div>
                  ) : (
                    editSubs.map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <span className="text-slate-800">{sub}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditSubs(editSubs.filter((_, i) => i !== sIdx))
                          }
                          className="text-red-700 hover:underline"
                        >
                          حذف
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCat(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  ذخیرهٔ دسته
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Warning & Expense Transfer Modal */}
      <ConfirmModal
        open={Boolean(catToDelete)}
        title="هشدار حذف دسته‌بندی"
        description={
          catToDelete
            ? expensesInCatToDelete.length > 0
              ? `دستهٔ «${catToDelete.name}» دارای ${formatNumberFa(expensesInCatToDelete.length)} هزینهٔ ثبت‌شده است. پیش از حذف، مشخص کنید هزینه‌های آن به کدام دسته منتقل شوند یا بدون دسته‌بندی باقی بمانند.`
              : `آیا از حذف دستهٔ «${catToDelete.name}» مطمئن هستید؟`
            : ''
        }
        confirmLabel="تأیید و حذف دسته"
        onCancel={() => setCatToDelete(null)}
        onConfirm={async () => {
          if (!catToDelete) return;
          await deleteCategory(
            catToDelete.id,
            transferTargetId ? Number(transferTargetId) : null
          );
          setCatToDelete(null);
        }}
      >
        {catToDelete && expensesInCatToDelete.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label
              htmlFor="transfer-cat-select"
              className="block text-xs font-semibold text-slate-800"
            >
              انتقال هزینه‌های این دسته به:
            </label>
            <select
              id="transfer-cat-select"
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            >
              {projectCategories
                .filter((c) => c.id !== catToDelete.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    انتقال به دستهٔ «{c.name}»
                  </option>
                ))}
              <option value="">نگهداشتن هزینه‌ها بدون اتصال به دسته</option>
            </select>
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
