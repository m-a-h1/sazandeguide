import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { createClientSeedBundle, DEFAULT_CATEGORIES_TEMPLATE } from '../data/pdfSeed';
import type {
  CategoryItem,
  ExpenseItem,
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

const LOCAL_SESSION_KEY = 'construction_cost_workspace_v1';

interface LocalWorkspaceState {
  projects: Project[];
  categories: CategoryItem[];
  expenses: ExpenseItem[];
  versions: PricingVersion[];
  nextId: number;
}

function loadInitialLocalWorkspace(): LocalWorkspaceState {
  try {
    const raw = sessionStorage.getItem(LOCAL_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalWorkspaceState;
      if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        return {
          ...parsed,
          projects: parsed.projects.map((p) => ({
            ...p,
            usefulAreaSqm:
              typeof p.usefulAreaSqm === 'number' ? p.usefulAreaSqm : null,
            taxPercent: typeof p.taxPercent === 'number' ? p.taxPercent : 0,
            landPrice: typeof p.landPrice === 'number' ? p.landPrice : 0,
            partnershipPercent:
              typeof p.partnershipPercent === 'number'
                ? p.partnershipPercent
                : null,
          })),
          versions: Array.isArray(parsed.versions)
            ? parsed.versions.map((v) => ({
                ...v,
                taxPercentSnapshot:
                  typeof v.taxPercentSnapshot === 'number'
                    ? v.taxPercentSnapshot
                    : 0,
                landPriceSnapshot:
                  typeof v.landPriceSnapshot === 'number'
                    ? v.landPriceSnapshot
                    : 0,
                partnershipPercentSnapshot:
                  typeof v.partnershipPercentSnapshot === 'number'
                    ? v.partnershipPercentSnapshot
                    : null,
              }))
            : [],
        };
      }
    }
  } catch {
    // Fallback to clean seed
  }
  const seed = createClientSeedBundle();
  return {
    projects: [seed.project],
    categories: seed.categories,
    expenses: seed.expenses,
    versions: [],
    nextId: 1000,
  };
}

export type StorageMode = 'cloud' | 'local' | 'loading' | 'error';

interface WorkspaceContextValue {
  projects: Project[];
  activeProject: Project | null;
  activeProjectId: number | null;
  setActiveProjectId: (id: number) => void;
  projectCategories: CategoryItem[];
  projectExpenses: ExpenseItem[];
  projectVersions: PricingVersion[];
  selectedVersionId: number | 'draft';
  setSelectedVersionId: (id: number | 'draft') => void;
  activeVersion: PricingVersion | null;
  draftValuation: ProjectValuation;
  displayedValuation: ProjectValuation;
  storageMode: StorageMode;
  storageError: string | null;
  clearStorageError: () => void;

  // Actions
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
      dateJalali: string;
      title: string;
      baseAmount: number;
      overridePercent?: number | null;
      source: 'دستی' | 'اکسل' | 'نمونه';
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
  const { user, loading: authLoading, getIdToken } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [versions, setVersions] = useState<PricingVersion[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | 'draft'>(
    'draft'
  );
  const [storageMode, setStorageMode] = useState<StorageMode>('loading');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [localNextId, setLocalNextId] = useState<number>(1000);

  const persistLocalSnapshot = useCallback(
    (
      nextProjects: Project[],
      nextCategories: CategoryItem[],
      nextExpenses: ExpenseItem[],
      nextVersions: PricingVersion[],
      nextIdVal: number
    ) => {
      try {
        sessionStorage.setItem(
          LOCAL_SESSION_KEY,
          JSON.stringify({
            projects: nextProjects,
            categories: nextCategories,
            expenses: nextExpenses,
            versions: nextVersions,
            nextId: nextIdVal,
          })
        );
      } catch {
        // Ignore storage quota errors
      }
    },
    []
  );

  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getIdToken();
      if (!token) {
        throw new Error('توکن احراز هویت در دسترس نیست.');
      }
      const res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init?.headers ?? {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'خطا در ارتباط با سرور.');
      }
      return data;
    },
    [getIdToken]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const local = loadInitialLocalWorkspace();
      setProjects(local.projects);
      setCategories(local.categories);
      setExpenses(local.expenses);
      setVersions(local.versions);
      setLocalNextId(local.nextId);
      setActiveProjectId((prev) =>
        prev && local.projects.some((p) => p.id === prev)
          ? prev
          : (local.projects[0]?.id ?? null)
      );
      setStorageMode('local');
      setStorageError(null);
      return;
    }

    let cancelled = false;
    setStorageMode('loading');
    setStorageError(null);

    authFetch('/api/workspace')
      .then((data) => {
        if (cancelled) return;
        const loadedProjects: Project[] = (data.projects ?? []).map((p: Project) => ({
          ...p,
          usefulAreaSqm:
            typeof p.usefulAreaSqm === 'number' ? p.usefulAreaSqm : null,
          taxPercent: typeof p.taxPercent === 'number' ? p.taxPercent : 0,
          landPrice: typeof p.landPrice === 'number' ? p.landPrice : 0,
          partnershipPercent:
            typeof p.partnershipPercent === 'number'
              ? p.partnershipPercent
              : null,
        }));
        const loadedVersions: PricingVersion[] = (data.versions ?? []).map(
          (v: PricingVersion) => ({
            ...v,
            taxPercentSnapshot:
              typeof v.taxPercentSnapshot === 'number'
                ? v.taxPercentSnapshot
                : 0,
            landPriceSnapshot:
              typeof v.landPriceSnapshot === 'number'
                ? v.landPriceSnapshot
                : 0,
            partnershipPercentSnapshot:
              typeof v.partnershipPercentSnapshot === 'number'
                ? v.partnershipPercentSnapshot
                : null,
          })
        );
        setProjects(loadedProjects);
        setCategories(data.categories ?? []);
        setExpenses(data.expenses ?? []);
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
        console.error('Failed to load cloud workspace:', err);
        const local = loadInitialLocalWorkspace();
        setProjects(local.projects);
        setCategories(local.categories);
        setExpenses(local.expenses);
        setVersions(local.versions);
        setLocalNextId(local.nextId);
        setActiveProjectId(local.projects[0]?.id ?? null);
        setStorageMode('error');
        setStorageError(
          err instanceof Error
            ? `${err.message} (حالت موقت مرورگر فعال شد)`
            : 'اتصال به پایگاه داده برقرار نشد. حالت موقت مرورگر فعال شد.'
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
      areaSqm: activeProject?.areaSqm ?? null,
      usefulAreaSqm: activeProject?.usefulAreaSqm ?? null,
      taxPercent: activeProject?.taxPercent ?? 0,
      landPrice: activeProject?.landPrice ?? 0,
      partnershipPercent: activeProject?.partnershipPercent ?? null,
    });
  }, [projectExpenses, activeProject]);

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

  const isCloud = storageMode === 'cloud' && Boolean(user);

  const createProject: WorkspaceContextValue['createProject'] = async (
    input
  ) => {
    setStorageError(null);
    if (isCloud) {
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
    }

    const newProjId = localNextId;
    let nextIdCursor = localNextId + 1;
    const newProject: Project = {
      id: newProjId,
      ...input,
      pdfAuditNote: '',
      draftCategoryRates: {},
    };
    const newCats: CategoryItem[] = DEFAULT_CATEGORIES_TEMPLATE.map((c) => ({
      id: nextIdCursor++,
      projectId: newProjId,
      name: c.name,
      sortOrder: c.sortOrder,
      subcategories: [...c.subcategories],
    }));

    const nextProjects = [...projects, newProject];
    const nextCats = [...categories, ...newCats];
    setProjects(nextProjects);
    setCategories(nextCats);
    setLocalNextId(nextIdCursor);
    setActiveProjectId(newProjId);
    setSelectedVersionId('draft');
    persistLocalSnapshot(nextProjects, nextCats, expenses, versions, nextIdCursor);
    return true;
  };

  const updateProject: WorkspaceContextValue['updateProject'] = async (
    projectId,
    updates
  ) => {
    setStorageError(null);
    if (isCloud) {
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
    }

    const nextProjects = projects.map((p) =>
      p.id === projectId ? { ...p, ...updates } : p
    );
    setProjects(nextProjects);
    persistLocalSnapshot(nextProjects, categories, expenses, versions, localNextId);
    return true;
  };

  const deleteProject: WorkspaceContextValue['deleteProject'] = async (
    projectId
  ) => {
    setStorageError(null);
    if (isCloud) {
      try {
        await authFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      } catch (err: unknown) {
        setStorageError(
          err instanceof Error ? err.message : 'حذف پروژه انجام نشد.'
        );
        return false;
      }
    }
    const nextProjects = projects.filter((p) => p.id !== projectId);
    const nextCats = categories.filter((c) => c.projectId !== projectId);
    const nextExps = expenses.filter((e) => e.projectId !== projectId);
    const nextVers = versions.filter((v) => v.projectId !== projectId);
    setProjects(nextProjects);
    setCategories(nextCats);
    setExpenses(nextExps);
    setVersions(nextVers);
    if (activeProjectId === projectId) {
      setActiveProjectId(nextProjects[0]?.id ?? null);
      setSelectedVersionId('draft');
    }
    if (!isCloud) {
      persistLocalSnapshot(
        nextProjects,
        nextCats,
        nextExps,
        nextVers,
        localNextId
      );
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

    if (isCloud) {
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
    }

    let nextIdCursor = localNextId;
    let nextCats = [...categories];
    const projCats = nextCats.filter((c) => c.projectId === activeProjectId);
    const catByName = new Map(projCats.map((c) => [c.name, c]));
    let maxSort = projCats.reduce((m, c) => Math.max(m, c.sortOrder), 0);

    for (const item of items) {
      const existingCat = catByName.get(item.categoryName);
      if (!existingCat) {
        const created: CategoryItem = {
          id: nextIdCursor++,
          projectId: activeProjectId,
          name: item.categoryName,
          sortOrder: ++maxSort,
          subcategories: item.subcategory ? [item.subcategory] : [],
        };
        nextCats.push(created);
        catByName.set(created.name, created);
      } else if (
        item.subcategory &&
        !existingCat.subcategories.includes(item.subcategory)
      ) {
        const updatedCat: CategoryItem = {
          ...existingCat,
          subcategories: [...existingCat.subcategories, item.subcategory],
        };
        nextCats = nextCats.map((c) =>
          c.id === updatedCat.id ? updatedCat : c
        );
        catByName.set(updatedCat.name, updatedCat);
      }
    }

    const newExpenses: ExpenseItem[] = items.map((item) => ({
      id: nextIdCursor++,
      projectId: activeProjectId,
      categoryId: catByName.get(item.categoryName)?.id ?? null,
      categoryName: item.categoryName,
      subcategory: item.subcategory,
      dateJalali: item.dateJalali,
      title: item.title,
      baseAmount: item.baseAmount,
      overridePercent: item.overridePercent ?? null,
      source: item.source,
    }));

    const baseExpenses =
      mode === 'replace'
        ? expenses.filter((e) => e.projectId !== activeProjectId)
        : expenses;
    const nextExpenses = [...baseExpenses, ...newExpenses];

    setCategories(nextCats);
    setExpenses(nextExpenses);
    setLocalNextId(nextIdCursor);
    persistLocalSnapshot(
      projects,
      nextCats,
      nextExpenses,
      versions,
      nextIdCursor
    );
    return true;
  };

  const updateExpense: WorkspaceContextValue['updateExpense'] = async (
    expenseId,
    updates
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);

    if (isCloud) {
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
    }

    const nextExpenses = expenses.map((e) =>
      e.id === expenseId ? { ...e, ...updates } : e
    );
    setExpenses(nextExpenses);
    persistLocalSnapshot(
      projects,
      categories,
      nextExpenses,
      versions,
      localNextId
    );
    return true;
  };

  const setSubcategoryOverride: WorkspaceContextValue['setSubcategoryOverride'] =
    async (categoryName, subcategory, overridePercent) => {
      if (!activeProjectId) return false;
      setStorageError(null);

      if (isCloud) {
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
      }

      const nextExpenses = expenses.map((e) =>
        e.projectId === activeProjectId &&
        e.categoryName === categoryName &&
        e.subcategory === subcategory
          ? { ...e, overridePercent }
          : e
      );
      setExpenses(nextExpenses);
      if (!isCloud) {
        persistLocalSnapshot(
          projects,
          categories,
          nextExpenses,
          versions,
          localNextId
        );
      }
      return true;
    };

  const deleteExpense: WorkspaceContextValue['deleteExpense'] = async (
    expenseId
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    if (isCloud) {
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
    }
    const nextExpenses = expenses.filter((e) => e.id !== expenseId);
    setExpenses(nextExpenses);
    if (!isCloud) {
      persistLocalSnapshot(
        projects,
        categories,
        nextExpenses,
        versions,
        localNextId
      );
    }
    return true;
  };

  const createCategory: WorkspaceContextValue['createCategory'] = async (
    name,
    subcategories
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    if (isCloud) {
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
    }

    const maxOrder = projectCategories.reduce(
      (m, c) => Math.max(m, c.sortOrder),
      0
    );
    const created: CategoryItem = {
      id: localNextId,
      projectId: activeProjectId,
      name: name.trim(),
      sortOrder: maxOrder + 1,
      subcategories,
    };
    const nextCats = [...categories, created];
    const nextId = localNextId + 1;
    setCategories(nextCats);
    setLocalNextId(nextId);
    persistLocalSnapshot(projects, nextCats, expenses, versions, nextId);
    return true;
  };

  const updateCategory: WorkspaceContextValue['updateCategory'] = async (
    categoryId,
    updates
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    const oldCat = categories.find((c) => c.id === categoryId);
    if (!oldCat) return false;

    if (isCloud) {
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
    }

    const nextCats = categories.map((c) =>
      c.id === categoryId ? { ...c, ...updates } : c
    );
    let nextExpenses = expenses;
    let nextProjects = projects;
    if (updates.name && updates.name !== oldCat.name) {
      nextExpenses = expenses.map((e) =>
        e.projectId === activeProjectId && e.categoryId === categoryId
          ? { ...e, categoryName: updates.name! }
          : e
      );
      if (activeProject) {
        const rates = { ...(activeProject.draftCategoryRates ?? {}) };
        if (Object.prototype.hasOwnProperty.call(rates, oldCat.name)) {
          rates[updates.name] = rates[oldCat.name];
          delete rates[oldCat.name];
        }
        nextProjects = projects.map((p) =>
          p.id === activeProject.id ? { ...p, draftCategoryRates: rates } : p
        );
      }
    }
    setCategories(nextCats);
    setExpenses(nextExpenses);
    setProjects(nextProjects);
    persistLocalSnapshot(
      nextProjects,
      nextCats,
      nextExpenses,
      versions,
      localNextId
    );
    return true;
  };

  const reorderCategories = async (orderedIds: number[]) => {
    if (!activeProjectId) return;
    if (isCloud) {
      await authFetch(`/api/projects/${activeProjectId}/categories/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds }),
      }).catch((e) => console.error(e));
    }
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx + 1]));
    const nextCats = categories.map((c) =>
      c.projectId === activeProjectId && orderMap.has(c.id)
        ? { ...c, sortOrder: orderMap.get(c.id)! }
        : c
    );
    setCategories(nextCats);
    if (!isCloud) {
      persistLocalSnapshot(projects, nextCats, expenses, versions, localNextId);
    }
  };

  const deleteCategory: WorkspaceContextValue['deleteCategory'] = async (
    categoryId,
    targetCategoryId
  ) => {
    if (!activeProjectId) return false;
    setStorageError(null);
    if (isCloud) {
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
    }

    const targetCat = targetCategoryId
      ? categories.find((c) => c.id === targetCategoryId)
      : null;

    const nextCats = categories.filter((c) => c.id !== categoryId);
    const nextExpenses = expenses.map((e) => {
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
    });

    setCategories(nextCats);
    setExpenses(nextExpenses);
    if (!isCloud) {
      persistLocalSnapshot(
        projects,
        nextCats,
        nextExpenses,
        versions,
        localNextId
      );
    }
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
        taxPercent: activeProject.taxPercent ?? 0,
        landPrice: activeProject.landPrice ?? 0,
        partnershipPercent: activeProject.partnershipPercent ?? null,
        referenceVersion: refVersion,
      });

      if (isCloud) {
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
      }

      const created: PricingVersion = {
        ...payload,
        id: localNextId,
      };
      const nextVers = [created, ...versions];
      const nextId = localNextId + 1;
      setVersions(nextVers);
      setLocalNextId(nextId);
      setSelectedVersionId(created.id);
      persistLocalSnapshot(projects, categories, expenses, nextVers, nextId);
      return created;
    };

  const updatePricingVersionMeta: WorkspaceContextValue['updatePricingVersionMeta'] =
    async (versionId, data) => {
      if (!activeProjectId) return false;
      setStorageError(null);
      if (isCloud) {
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
      }

      const nextVers = versions.map((v) =>
        v.id === versionId ? { ...v, ...data } : v
      );
      setVersions(nextVers);
      persistLocalSnapshot(
        projects,
        categories,
        expenses,
        nextVers,
        localNextId
      );
      return true;
    };

  const deletePricingVersion: WorkspaceContextValue['deletePricingVersion'] =
    async (versionId) => {
      if (!activeProjectId) return false;
      setStorageError(null);
      if (isCloud) {
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
      }
      const nextVers = versions.filter((v) => v.id !== versionId);
      setVersions(nextVers);
      if (selectedVersionId === versionId) {
        setSelectedVersionId('draft');
      }
      if (!isCloud) {
        persistLocalSnapshot(
          projects,
          categories,
          expenses,
          nextVers,
          localNextId
        );
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
