import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface VersionItemSnapshot {
  expenseId: number;
  title: string;
  categoryName: string;
  subcategory: string;
  dateJalali: string;
  baseAmount: number;
  referenceAmount: number;
  categoryRateApplied: number;
  overridePercent: number | null;
  effectivePercent: number;
  rateSource: 'CATEGORY' | 'INDEPENDENT';
  estimatedAmount: number;
  diffFromBaseAmount: number;
  diffFromBasePercent: number;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  address: text('address').default('').notNull(),
  description: text('description').default('').notNull(),
  areaSqm: doublePrecision('area_sqm'),
  usefulAreaSqm: doublePrecision('useful_area_sqm'),
  floors: integer('floors'),
  units: integer('units'),
  startDateJalali: text('start_date_jalali').default('').notNull(),
  endDateJalali: text('end_date_jalali').default('').notNull(),
  status: text('status').default('در حال ساخت').notNull(),
  currency: text('currency').default('تعیین‌نشده').notNull(),
  taxPercent: doublePrecision('tax_percent').default(0).notNull(),
  landPrice: doublePrecision('land_price').default(0).notNull(),
  partnershipPercent: doublePrecision('partnership_percent'),
  pdfAuditNote: text('pdf_audit_note').default('').notNull(),
  draftCategoryRates: jsonb('draft_category_rates')
    .$type<Record<string, number>>()
    .default({})
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  subcategories: jsonb('subcategories').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: integer('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  categoryName: text('category_name').notNull(),
  subcategory: text('subcategory').default('').notNull(),
  dateJalali: text('date_jalali').notNull(),
  title: text('title').notNull(),
  baseAmount: doublePrecision('base_amount').notNull(),
  overridePercent: doublePrecision('override_percent'),
  source: text('source').default('دستی').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const pricingVersions = pgTable('pricing_versions', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  versionDateJalali: text('version_date_jalali').notNull(),
  description: text('description').default('').notNull(),
  baseReferenceType: text('base_reference_type').default('BASE').notNull(),
  parentVersionId: integer('parent_version_id'),
  parentVersionName: text('parent_version_name'),
  categoryRatesSnapshot: jsonb('category_rates_snapshot')
    .$type<Record<string, number>>()
    .default({})
    .notNull(),
  totalBaseAmount: doublePrecision('total_base_amount').notNull(),
  totalReferenceAmount: doublePrecision('total_reference_amount').notNull(),
  totalEstimatedAmount: doublePrecision('total_estimated_amount').notNull(),
  taxPercentSnapshot: doublePrecision('tax_percent_snapshot').default(0).notNull(),
  landPriceSnapshot: doublePrecision('land_price_snapshot').default(0).notNull(),
  partnershipPercentSnapshot: doublePrecision('partnership_percent_snapshot'),
  diffFromBaseAmount: doublePrecision('diff_from_base_amount').notNull(),
  diffFromBasePercent: doublePrecision('diff_from_base_percent').notNull(),
  itemsSnapshot: jsonb('items_snapshot')
    .$type<VersionItemSnapshot[]>()
    .default([])
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  categories: many(categories),
  expenses: many(expenses),
  pricingVersions: many(pricingVersions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  project: one(projects, {
    fields: [categories.projectId],
    references: [projects.id],
  }),
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  project: one(projects, {
    fields: [expenses.projectId],
    references: [projects.id],
  }),
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
}));

export const pricingVersionsRelations = relations(pricingVersions, ({ one }) => ({
  project: one(projects, {
    fields: [pricingVersions.projectId],
    references: [projects.id],
  }),
}));
