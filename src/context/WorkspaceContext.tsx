'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import type {
  CategoryItem,
  ExpenseItem,
  ExpenseTag,
  PricingVersion,
  Project,
  ProjectCurrency,
  ProjectStatus,
  ProjectValuation,
} from '../types/app';
import {
  buildVersionPayload,
  calculateProjectValuation,
  computePartnershipMetrics,
  computePerSqm,
} from '../utils/pricing';

export type StorageMode = 'cloud' | 'loading' | 'error';

interface WorkspaceContextValue {
  projects: Project[];
  activeProject: Project | null;
  activeProjectId: number | null;
  setActiveProjectId: (id: number) => void;
  projectCategories: CategoryItem[];
  projectExpenses: ExpenseItem[];
  projectTags: ExpenseTag[];
  tagRatesById: Record<number, number>;
  projectVersions: PricingVersion[];
  selectedVersionId: number | 'draft';
  setSelectedVersionId: (id: number | 'draft') => void;
  activeVersion: PricingVersion | null;
  draftValuation: ProjectValuation;
  displayedValuation: ProjectValuation;
  storageMode: StorageMode;
  storageError: string | null;
  clearStorageError: () => void;

  createProject: (input: {
    name: string;
    address: string;
    description: string;
    areaSqm: number | null;
    usefulAreaSqm: number | null;
    floors: number | null;
    units: number | null;
    startDateJalali: string;
    endDateJalali: string;
    status: ProjectStatus;
    currency: ProjectCurrency;
    taxPercent: number;
    landPrice: number;
    partnershipPercent: number | null;
  }) => Promise<boolean>;
  updateProject: (
    projectId: number,
    updates: Partial<Omit<Project, 'id'>>
  ) => Promise<boolean>;
  deleteProject: (projectId: number) => Promise<boolean>;

  updateDraftCategoryRate: (
    categoryName: string,
    percent: number
  ) => Promise<void>;

  addExpenses: (
    items: Array<{
      categoryName: string;
      subcategory: string;
      tagId?: number | null;
      dateJalali: string;
      title: string;
      baseAmount: number;
      overridePercent?: number | null;
      source: 'دستی' | 'اکسل' | 'نمونه' | 'جزئیات';
      entryMode?: 'general' | 'detailed';
      unitType?: 'weight' | 'count' | 'meter' | 'service' | null;
      quantity?: number | null;
      itemCount?: number | null;
      weightUnit?: 'kg' | 'ton' | null;
      unitPrice?: number | null;
      description?: string;
      images?: Array<{
        key: string;
        url: string;
        fileName: string;
        contentType: string;
        size: number;
        uploadedAt: string;
      }>;
    }>,
    mode?: 'append' | 'replace'
  ) => Promise<boolean>;
  updateExpense: (
    expenseId: number,
    updates: Partial<Omit<ExpenseItem, 'id' | 'projectId'>>
  ) => Promise<boolean>;
  setSubcategoryOverride: (
    categoryName: string,
    subcategory: string,
    overridePercent: number | null
  ) => Promise<boolean>;
  deleteExpense: (expenseId: number) => Promise<boolean>;

  createTag: (name: string, percentAdjustment?: number) => Promise<ExpenseTag | null>;
  updateTag: (
    tagId: number,
    updates: Partial<Pick<ExpenseTag, 'name' | 'percentAdjustment'>>
  ) => Promise<boolean>;
  deleteTag: (tagId: number) => Promise<boolean>;

  createCategory: (name: string, subcategories: string[]) => Promise<boolean>;
  updateCategory: (
    categoryId: number,
    updates: Partial<Pick<CategoryItem, 'name' | 'subcategories' | 'sortOrder'>>
  ) => Promise<boolean>;
  reorderCategories: (orderedIds: number[]) => Promise<void>;
  deleteCategory: (
    categoryId: number,
    targetCategoryId: number | null
  ) => Promise<boolean>;

  createPricingVersion: (input: {
    name: string;
    versionDateJalali: string;
    description: string;
    referenceVersionId: number | null;
  }) => Promise<PricingVersion | null>;
  updatePricingVersionMeta: (
    versionId: number,
    data: { name: string; versionDateJalali: string; description: string }
  ) => Promise<boolean>;
  deletePricingVersion: (versionId: number) => Promise<boolean>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, getAuthHeaders } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [tags, setTags] = useState<ExpenseTag[]>([]);
  const [versions, setVersions] = useState<PricingVersion[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | 'draft'>(
    'draft'
  );
  const [storageMode, setStorageMode] = useState<StorageMode>('loading');
  const [storageError, setStorageError] = useState<string | null>(null);

  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const res = await fetch(url, {
        ...init,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...(init?.headers ?? {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'خطا در ارتباط با سرور.');
      }
      return data;
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'builder') {
      setProjects([]);
      setCategories([]);
      setExpenses([]);
      setTags([]);
      setVersions([]);
      setActiveProjectId(null);
      setStorageMode('loading');
      return;
    }

    let cancelled = false;
    setStorageMode('loading');
    setStorageError(null);

    authFetch('/api/workspace')
      .then((data) => {
        if (cancelled) return;
        const loadedProjects: Project[] = (data.projects ?? []).map(
          (p: Project) => ({
            ...p,
            usefulAreaSqm:
              typeof p.usefulAreaSqm === 'number' ? p.usefulAreaSqm : null,
            taxPercent: typeof p.taxPercent === 'number' ? p.taxPercent : 0,
            landPrice: typeof p.landPrice === 'number' ? p.landPrice : 0,
            partnershipPercent:
              typeof p.partnershipPercent === 'number'
                ? p.partnershipPercent
                : null,
          })
        );
        const loadedVersions: PricingVersion[] = (data.versions ?? []).map(
          (v: PricingVersion) => ({
            ...v,
            taxPercentSnapshot:
              typeof v.taxPercentSnapshot === 'number'
                ? v.taxPercentSnapshot
                : 0,
            landPriceSnapshot:
              typeof v.landPriceSnapshot === 'number' ? v.landPriceSnapshot : 0,
            partnershipPercentSnapshot:
              typeof v.partnershipPercentSnapshot === 'number'
                ? v.partnershipPercentSnapshot
                : null,
          })
        );
        setProjects(loadedProjects);
        setCategories(data.categories ?? []);
        setExpenses(data.expenses ?? []);
        setTags(data.tags ?? []);
        setVersions(loadedVersions);
        setActiveProjectId((prev) =>
          prev && loadedProjects.some((p) => p.id === prev)
            ? prev
            : (loadedProjects[0]?.id ?? null)
        );
        setSelectedVersionId('draft');
        setStorageMode('cloud');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load workspace:', err);
        setStorageMode('error');
        setStorageError(
          err instanceof Error
            ? err.message
            : 'بارگذاری اطلاعات از پایگاه داده با خطا روبه‌رو شد.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, authFetch]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const projectCategories = useMemo(
    () =>
      categories
        .filter((c) => c.projectId === activeProjectId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [categories, activeProjectId]
  );

  const projectExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.projectId === activeProjectId)
        .sort((a, b) => a.id - b.id),
    [expenses, activeProjectId]
  );

  const projectTags = useMemo(
    () =>
      tags
        .filter((t) => t.projectId === activeProjectId)
        .sort((a, b) => a.id - b.id),
    [tags, activeProjectId]
  );

  const tagRatesById = useMemo(() => {
    const map: Record<number, number> = {};
    for (const tag of projectTags) {
      map[tag.id] = tag.percentAdjustment;
    }
    return map;
  }, [projectTags]);

  const projectVersions = useMemo(
    () =>
      versions
        .filter((v) => v.projectId === activeProjectId)
        .sort((a, b) => b.id - a.id),
    [versions, activeProjectId]
  );

  const activeVersion = useMemo(() => {
    if (selectedVersionId === 'draft') return null;
    return projectVersions.find((v) => v.id === selectedVersionId) ?? null;
  }, [projectVersions, selectedVersionId]);

  const draftValuation = useMemo(() => {
    return calculateProjectValuation({
      expenses: projectExpenses,
      categoryRates: activeProject?.draftCategoryRates ?? {},
      tagRatesById,
      areaSqm: activeProject?.areaSqm ?? null,
      usefulAreaSqm: activeProject?.usefulAreaSqm ?? null,
      taxPercent: activeProject?.taxPercent ?? 0,
      landPrice: activeProject?.landPrice ?? 0,
      partnershipPercent: activeProject?.partnershipPercent ?? null,
    });
  }, [projectExpenses, activeProject, tagRatesById]);

  const displayedValuation = useMemo((): ProjectValuation => {
    if (!activeVersion) return draftValuation;

    const area = activeProject?.areaSqm ?? null;
    const usefulArea = activeProject?.usefulAreaSqm ?? null;
    const taxPercent = activeVersion.taxPercentSnapshot ?? 0;
    const baseTaxAmount = activeVersion.totalBaseAmount * (taxPercent / 100);
    const totalBaseWithTax = activeVersion.totalBaseAmount + baseTaxAmount;
    const estimatedTaxAmount =
      activeVersion.totalEstimatedAmount * (taxPercent / 100);
    const totalEstimatedWithTax =
      activeVersion.totalEstimatedAmount + estimatedTaxAmount;

    const catTotals = new Map<
      string,
      { baseAmount: number; estimatedAmount: number; itemCount: number }
    >();

    for (const item of activeVersion.itemsSnapshot) {
      const existing = catTotals.get(item.categoryName) ?? {
        baseAmount: 0,
        estimatedAmount: 0,
        itemCount: 0,
      };
      existing.baseAmount += item.baseAmount;
      existing.estimatedAmount += item.estimatedAmount;
      existing.itemCount += 1;
      catTotals.set(item.categoryName, existing);
    }

    const categoryBreakdown = Array.from(catTotals.entries())
      .map(([categoryName, data]) => ({
        categoryName,
        baseAmount: data.baseAmount,
        estimatedAmount: data.estimatedAmount,
        shareOfBasePercent:
          activeVersion.totalBaseAmount > 0
            ? (data.baseAmount / activeVersion.totalBaseAmount) * 100
            : 0,
        shareOfEstimatedPercent:
          activeVersion.totalEstimatedAmount > 0
            ? (data.estimatedAmount / activeVersion.totalEstimatedAmount) * 100
            : 0,
        itemCount: data.itemCount,
      }))
      .sort((a, b) => b.estimatedAmount - a.estimatedAmount);

    return {
      items: activeVersion.itemsSnapshot,
      totalBaseAmount: activeVersion.totalBaseAmount,
      totalReferenceAmount: activeVersion.totalReferenceAmount,
      totalEstimatedAmount: activeVersion.totalEstimatedAmount,
      taxPercent,
      baseTaxAmount,
      totalBaseWithTax,
      estimatedTaxAmount,
      totalEstimatedWithTax,
      diffFromBaseAmount: activeVersion.diffFromBaseAmount,
      diffFromBasePercent: activeVersion.diffFromBasePercent,
      basePerSqm: computePerSqm(activeVersion.totalBaseAmount, area),
      estimatedPerSqm: computePerSqm(activeVersion.totalEstimatedAmount, area),
      basePerUsefulSqm: computePerSqm(activeVersion.totalBaseAmount, usefulArea),
      estimatedPerUsefulSqm: computePerSqm(
        activeVersion.totalEstimatedAmount,
        usefulArea
      ),
      partnership: computePartnershipMetrics({
        pureBaseAmount: activeVersion.totalBaseAmount,
        pureEstimatedAmount: activeVersion.totalEstimatedAmount,
        taxPercent,
        landPrice: activeVersion.landPriceSnapshot ?? 0,
        areaSqm: area,
        usefulAreaSqm: usefulArea,
        partnershipPercent: activeVersion.partnershipPercentSnapshot ?? null,
      }),
      categoryBreakdown,
    };
  }, [
    activeVersion,
    draftValuation,
    activeProject?.areaSqm,
    activeProject?.usefulAreaSqm,
  ]);

  const createProject: WorkspaceContextValue['createProject'] = async (
    input
  ) => {
    setStorageError(null);
    try {
      const res = await authFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setProjects((prev) => [...prev, res.project]);
      setCategories((prev) => [...prev, ...(res.categories ?? [])]);
      setActiveProjectId(res.project.id);
      setSelectedVersionId('draft');
      return true;
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'ایجاد پروژه انجام نشد.'
      );
      return false;
    }
  };

  const updateProject: WorkspaceContextValue['updateProject'] = async (
    projectId,
    updates
  ) => {
    setStorageError(null);
    try {
      const updated = await authFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updated : p))
      );
      return true;
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'ویرایش پروژه انجام نشد.'
      );
      return false;
    }
  };

  const deleteProject: WorkspaceContextValue['deleteProject'] = async (
    projectId
  ) => {
    setStorageError(null);
    try {
      await authFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'حذف پروژه انجام نشد.'
      );
      return false;
    }

    const nextProjects = projects.filter((p) => p.id !== projectId);
    setProjects(nextProjects);
    setCategories((prev) => prev.filter((c) => c.projectId !== projectId));
    setExpenses((prev) => prev.filter((e) => e.projectId !== projectId));
    setTags((prev) => prev.filter((t) => t.projectId !== projectId));
    setVersions((prev) => prev.filter((v) => v.projectId !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(nextProjects[0]?.id ?? null);
      setSelectedVersionId('draft');
    }
    return true;
  };

  const updateDraftCategoryRate = async (
    categoryName: string,
    percent: number
  ) => {
    if (!activeProject) return;
    const nextRates = {
      ...(activeProject.draftCategoryRates ?? {}),
      [categoryName]: Number.isFinite(percent) ? percent : 0,
    };
    await updateProject(activeProject.id, { draftCategoryRates: nextRates });
  };

  const addExpenses: WorkspaceContextValue['addExpenses'] = async (
    items,
    mode = 'append'
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);

    try {
      const res = await authFetch(
        `/api/projects/${activeProjectId}/expenses`,
        {
          method: 'POST',
          body: JSON.stringify({ items, mode }),
        }
      );
      setExpenses((prev) => {
        const base =
          mode === 'replace'
            ? prev.filter((e) => e.projectId !== activeProjectId)
            : prev;
        return [...base, ...(res.inserted ?? [])];
      });
      if (Array.isArray(res.categories)) {
        setCategories((prev) => [
          ...prev.filter((c) => c.projectId !== activeProjectId),
          ...res.categories,
        ]);
      }
      return true;
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'ثبت هزینه‌ها انجام نشد.'
      );
      return false;
    }
  };

  const updateExpense: WorkspaceContextValue['updateExpense'] = async (
    expenseId,
    updates
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);

    try {
      const updated = await authFetch(
        `/api/projects/${activeProjectId}/expenses/${expenseId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
      setExpenses((prev) =>
        prev.map((e) => (e.id === expenseId ? updated : e))
      );
      return true;
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'ویرایش هزینه انجام نشد.'
      );
      return false;
    }
  };

  const setSubcategoryOverride: WorkspaceContextValue['setSubcategoryOverride'] =
    async (categoryName, subcategory, overridePercent) => {
      if (!activeProjectId) return false;
      setStorageError(null);

      try {
        await authFetch(
          `/api/projects/${activeProjectId}/expenses/subcategory-override`,
          {
            method: 'POST',
            body: JSON.stringify({
              categoryName,
              subcategory,
              overridePercent,
            }),
          }
        );
      } catch (err: unknown) {
        setStorageError(
          err instanceof Error ? err.message : 'تغییر درصد زیردسته انجام نشد.'
        );
        return false;
      }

      setExpenses((prev) =>
        prev.map((e) =>
          e.projectId === activeProjectId &&
          e.categoryName === categoryName &&
          e.subcategory === subcategory
            ? { ...e, overridePercent }
            : e
        )
      );
      return true;
    };

  const deleteExpense: WorkspaceContextValue['deleteExpense'] = async (
    expenseId
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    try {
      await authFetch(
        `/api/projects/${activeProjectId}/expenses/${expenseId}`,
        { method: 'DELETE' }
      );
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'حذف هزینه انجام نشد.'
      );
      return false;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    return true;
  };

  const createTag: WorkspaceContextValue['createTag'] = async (
    name,
    percentAdjustment = 0
  ) => {
    if (!activeProjectId) return null;
    setStorageError(null);
    try {
      const created = (await authFetch(
        `/api/projects/${activeProjectId}/tags`,
        {
          method: 'POST',
          body: JSON.stringify({ name, percentAdjustment }),
        }
      )) as ExpenseTag;
      setTags((prev) => [...prev, created]);
      return created;
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'ایجاد برچسب انجام نشد.'
      );
      return null;
    }
  };

  const updateTag: WorkspaceContextValue['updateTag'] = async (
    tagId,
    updates
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    const previousTag = tags.find((t) => t.id === tagId);
    if (updates.percentAdjustment !== undefined && previousTag) {
      setTags((prev) =>
        prev.map((t) =>
          t.id === tagId
            ? { ...t, percentAdjustment: updates.percentAdjustment! }
            : t
        )
      );
    }
    try {
      const updated = (await authFetch(
        `/api/projects/${activeProjectId}/tags/${tagId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      )) as ExpenseTag;
      setTags((prev) => prev.map((t) => (t.id === tagId ? updated : t)));
      if (updates.name) {
        setExpenses((prev) =>
          prev.map((e) =>
            e.projectId === activeProjectId && e.tagId === tagId
              ? { ...e, tagName: updated.name }
              : e
          )
        );
      }
      return true;
    } catch (err: unknown) {
      if (updates.percentAdjustment !== undefined && previousTag) {
        setTags((prev) =>
          prev.map((t) => (t.id === tagId ? previousTag : t))
        );
      }
      setStorageError(
        err instanceof Error ? err.message : 'ویرایش برچسب انجام نشد.'
      );
      return false;
    }
  };

  const deleteTag: WorkspaceContextValue['deleteTag'] = async (tagId) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    try {
      await authFetch(`/api/projects/${activeProjectId}/tags/${tagId}`, {
        method: 'DELETE',
      });
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'حذف برچسب انجام نشد.'
      );
      return false;
    }
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setExpenses((prev) =>
      prev.map((e) =>
        e.projectId === activeProjectId && e.tagId === tagId
          ? { ...e, tagId: null, tagName: '' }
          : e
      )
    );
    return true;
  };

  const createCategory: WorkspaceContextValue['createCategory'] = async (
    name,
    subcategories
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    try {
      const created = await authFetch(
        `/api/projects/${activeProjectId}/categories`,
        {
          method: 'POST',
          body: JSON.stringify({ name, subcategories }),
        }
      );
      setCategories((prev) => [...prev, created]);
      return true;
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'ایجاد دسته انجام نشد.'
      );
      return false;
    }
  };

  const updateCategory: WorkspaceContextValue['updateCategory'] = async (
    categoryId,
    updates
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    const oldCat = categories.find((c) => c.id === categoryId);
    if (!oldCat) return false;

    try {
      const updated = await authFetch(
        `/api/projects/${activeProjectId}/categories/${categoryId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? updated : c))
      );
      if (updates.name && updates.name !== oldCat.name) {
        setExpenses((prev) =>
          prev.map((e) =>
            e.projectId === activeProjectId && e.categoryId === categoryId
              ? { ...e, categoryName: updates.name! }
              : e
          )
        );
        if (activeProject) {
          const rates = { ...(activeProject.draftCategoryRates ?? {}) };
          if (Object.prototype.hasOwnProperty.call(rates, oldCat.name)) {
            rates[updates.name] = rates[oldCat.name];
            delete rates[oldCat.name];
            setProjects((prev) =>
              prev.map((p) =>
                p.id === activeProject.id
                  ? { ...p, draftCategoryRates: rates }
                  : p
              )
            );
          }
        }
      }
      return true;
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'ویرایش دسته انجام نشد.'
      );
      return false;
    }
  };

  const reorderCategories = async (orderedIds: number[]) => {
    if (!activeProjectId) return;
    await authFetch(`/api/projects/${activeProjectId}/categories/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ orderedIds }),
    }).catch((e) => console.error(e));

    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx + 1]));
    setCategories((prev) =>
      prev.map((c) =>
        c.projectId === activeProjectId && orderMap.has(c.id)
          ? { ...c, sortOrder: orderMap.get(c.id)! }
          : c
      )
    );
  };

  const deleteCategory: WorkspaceContextValue['deleteCategory'] = async (
    categoryId,
    targetCategoryId
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    try {
      await authFetch(
        `/api/projects/${activeProjectId}/categories/${categoryId}`,
        {
          method: 'DELETE',
          body: JSON.stringify({ targetCategoryId }),
        }
      );
    } catch (err: unknown) {
      setStorageError(
        err instanceof Error ? err.message : 'حذف دسته انجام نشد.'
      );
      return false;
    }

    const targetCat = targetCategoryId
      ? categories.find((c) => c.id === targetCategoryId)
      : null;

    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.projectId === activeProjectId && e.categoryId === categoryId) {
          if (targetCat) {
            return {
              ...e,
              categoryId: targetCat.id,
              categoryName: targetCat.name,
            };
          }
          return { ...e, categoryId: null };
        }
        return e;
      })
    );
    return true;
  };

  const createPricingVersion: WorkspaceContextValue['createPricingVersion'] =
    async (input) => {
      if (!activeProject) return null;
      setStorageError(null);
      const refVersion = input.referenceVersionId
        ? projectVersions.find((v) => v.id === input.referenceVersionId) ?? null
        : null;

      const payload = buildVersionPayload({
        projectId: activeProject.id,
        name: input.name,
        versionDateJalali: input.versionDateJalali,
        description: input.description,
        expenses: projectExpenses,
        categoryRates: activeProject.draftCategoryRates ?? {},
        tagRatesById,
        taxPercent: activeProject.taxPercent ?? 0,
        landPrice: activeProject.landPrice ?? 0,
        partnershipPercent: activeProject.partnershipPercent ?? null,
        referenceVersion: refVersion,
      });

      try {
        const created = (await authFetch(
          `/api/projects/${activeProject.id}/versions`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        )) as PricingVersion;
        setVersions((prev) => [created, ...prev]);
        setSelectedVersionId(created.id);
        return created;
      } catch (err: unknown) {
        setStorageError(
          err instanceof Error ? err.message : 'ثبت نسخه انجام نشد.'
        );
        return null;
      }
    };

  const updatePricingVersionMeta: WorkspaceContextValue['updatePricingVersionMeta'] =
    async (versionId, data) => {
      if (!activeProjectId) return false;
      setStorageError(null);
      try {
        const updated = await authFetch(
          `/api/projects/${activeProjectId}/versions/${versionId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(data),
          }
        );
        setVersions((prev) =>
          prev.map((v) => (v.id === versionId ? updated : v))
        );
        return true;
      } catch (err: unknown) {
        setStorageError(
          err instanceof Error ? err.message : 'ویرایش نسخه انجام نشد.'
        );
        return false;
      }
    };

  const deletePricingVersion: WorkspaceContextValue['deletePricingVersion'] =
    async (versionId) => {
      if (!activeProjectId) return false;
      setStorageError(null);
      try {
        await authFetch(
          `/api/projects/${activeProjectId}/versions/${versionId}`,
          { method: 'DELETE' }
        );
      } catch (err: unknown) {
        setStorageError(
          err instanceof Error ? err.message : 'حذف نسخه انجام نشد.'
        );
        return false;
      }
      setVersions((prev) => prev.filter((v) => v.id !== versionId));
      if (selectedVersionId === versionId) {
        setSelectedVersionId('draft');
      }
      return true;
    };

  return (
    <WorkspaceContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectId,
        setActiveProjectId: (id) => {
          setActiveProjectId(id);
          setSelectedVersionId('draft');
        },
        projectCategories,
        projectExpenses,
        projectTags,
        tagRatesById,
        projectVersions,
        selectedVersionId,
        setSelectedVersionId,
        activeVersion,
        draftValuation,
        displayedValuation,
        storageMode,
        storageError,
        clearStorageError: () => setStorageError(null),
        createProject,
        updateProject,
        deleteProject,
        updateDraftCategoryRate,
        addExpenses,
        updateExpense,
        setSubcategoryOverride,
        deleteExpense,
        createTag,
        updateTag,
        deleteTag,
        createCategory,
        updateCategory,
        reorderCategories,
        deleteCategory,
        createPricingVersion,
        updatePricingVersionMeta,
        deletePricingVersion,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }
  return ctx;
}
