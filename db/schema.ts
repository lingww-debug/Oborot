import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteContent = sqliteTable("site_content", {
  id: integer().primaryKey(),
  document: text().notNull(),
  revision: integer().notNull(),
});

export const products = sqliteTable("products", {
  id: text().primaryKey(),
  title: text().notNull(),
  category: text().notNull(),
  spec: text().notNull(),
  condition: text().notNull(),
  description: text().notNull(),
  price: integer().notNull(),
  published: integer({ mode: "boolean" }).notNull(),
  demo: integer({ mode: "boolean" }).notNull(),
  photoKey: text("photo_key"),
  revision: integer().notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("products_public_order").on(table.published, table.updatedAt),
  index("products_photo_key").on(table.photoKey),
]);

export const contactChallenges = sqliteTable("contact_challenges", {
  id: text().primaryKey(),
  proof: text().notNull(),
  target: text().notNull(),
  answer: integer().notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("contact_challenge_expiry").on(table.expiresAt)]);

export const contactLimits = sqliteTable("contact_limits", {
  id: text().primaryKey(),
  hits: integer().notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("contact_limit_expiry").on(table.expiresAt)]);

export const proAccess = sqliteTable("pro_access", {
  email: text().primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});
export const proPreferences = sqliteTable("pro_preferences", {
  userId: text("user_id").primaryKey(),
  document: text().notNull(),
});
export const proDeals = sqliteTable("pro_deals", {
  id: text().primaryKey(),
  userId: text("user_id").notNull(),
  document: text().notNull(),
  revision: integer().notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("pro_deals_user").on(table.userId, table.updatedAt)]);
export const proEvents = sqliteTable("pro_events", {
  id: text().primaryKey(),
  userId: text("user_id").notNull(),
  dealId: text("deal_id"),
  type: text().notNull(),
  message: text().notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("pro_events_user").on(table.userId, table.createdAt)]);
