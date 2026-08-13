import { int, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the Manus OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).$type<"user" | "admin">().default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const webtoons = mysqlTable(
  "webtoons",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    genre: varchar("genre", { length: 80 }).notNull(),
    thumbnailUrl: text("thumbnailUrl"),
    thumbnailKey: text("thumbnailKey"),
    description: text("description").notNull(),
    isPublished: int("isPublished").default(1).notNull(),
    publishedAt: timestamp("publishedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("webtoons_slug_unique").on(table.slug)],
);

export const episodes = mysqlTable(
  "episodes",
  {
    id: int("id").autoincrement().primaryKey(),
    webtoonId: int("webtoonId").notNull().references(() => webtoons.id, { onDelete: "cascade" }),
    episodeNumber: int("episodeNumber").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    isPublished: int("isPublished").default(1).notNull(),
    publishedAt: timestamp("publishedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("episodes_webtoon_number_unique").on(table.webtoonId, table.episodeNumber)],
);

export const episodeImages = mysqlTable(
  "episodeImages",
  {
    id: int("id").autoincrement().primaryKey(),
    episodeId: int("episodeId").notNull().references(() => episodes.id, { onDelete: "cascade" }),
    imageUrl: text("imageUrl").notNull(),
    imageKey: text("imageKey").notNull(),
    sortOrder: int("sortOrder").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("episode_images_episode_order_unique").on(table.episodeId, table.sortOrder)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Webtoon = typeof webtoons.$inferSelect;
export type InsertWebtoon = typeof webtoons.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;

