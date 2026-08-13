import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  episodeImages,
  episodes,
  InsertEpisode,
  InsertUser,
  InsertWebtoon,
  users,
  webtoons,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

type PublishedListInput = { search?: string; genre?: string };

export async function getPublishedWebtoons(input: PublishedListInput = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(webtoons.isPublished, 1)];
  if (input.genre) conditions.push(eq(webtoons.genre, input.genre));
  if (input.search?.trim()) {
    const term = `%${input.search.trim()}%`;
    conditions.push(or(like(webtoons.title, term), like(webtoons.description, term))!);
  }
  const works = await db.select().from(webtoons).where(and(...conditions)).orderBy(desc(webtoons.updatedAt));
  if (!works.length) return [];
  const workIds = works.map(work => work.id);
  const publishedEpisodes = await db
    .select()
    .from(episodes)
    .where(and(inArray(episodes.webtoonId, workIds), eq(episodes.isPublished, 1)))
    .orderBy(desc(episodes.episodeNumber));
  const latestByWork = new Map<number, (typeof publishedEpisodes)[number]>();
  for (const episode of publishedEpisodes) {
    if (!latestByWork.has(episode.webtoonId)) latestByWork.set(episode.webtoonId, episode);
  }
  return works.map(work => ({ ...work, latestEpisode: latestByWork.get(work.id) ?? null }));
}

export async function getGenres() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ genre: webtoons.genre }).from(webtoons).where(eq(webtoons.isPublished, 1));
  return Array.from(new Set(rows.map(row => row.genre))).sort((a, b) => a.localeCompare(b, "ko"));
}

export async function getPublicWebtoonBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const workRows = await db.select().from(webtoons).where(and(eq(webtoons.slug, slug), eq(webtoons.isPublished, 1))).limit(1);
  const work = workRows[0];
  if (!work) return null;
  const workEpisodes = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.webtoonId, work.id), eq(episodes.isPublished, 1)))
    .orderBy(asc(episodes.episodeNumber));
  return { work, episodes: workEpisodes };
}

export async function getPublicEpisode(slug: string, episodeNumber: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ work: webtoons, episode: episodes })
    .from(episodes)
    .innerJoin(webtoons, eq(episodes.webtoonId, webtoons.id))
    .where(and(eq(webtoons.slug, slug), eq(webtoons.isPublished, 1), eq(episodes.episodeNumber, episodeNumber), eq(episodes.isPublished, 1)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const images = await db.select().from(episodeImages).where(eq(episodeImages.episodeId, row.episode.id)).orderBy(asc(episodeImages.sortOrder));
  const allEpisodes = await db
    .select({ episodeNumber: episodes.episodeNumber, title: episodes.title })
    .from(episodes)
    .where(and(eq(episodes.webtoonId, row.work.id), eq(episodes.isPublished, 1)))
    .orderBy(asc(episodes.episodeNumber));
  return { ...row, images, allEpisodes };
}

export async function getAdminWebtoons() {
  const db = await getDb();
  if (!db) return [];
  const works = await db.select().from(webtoons).orderBy(desc(webtoons.updatedAt));
  const counts = await db.select().from(episodes);
  return works.map(work => ({ ...work, episodeCount: counts.filter(episode => episode.webtoonId === work.id).length }));
}

export async function getAdminWebtoon(id: number) {
  const db = await getDb();
  if (!db) return null;
  const work = (await db.select().from(webtoons).where(eq(webtoons.id, id)).limit(1))[0];
  if (!work) return null;
  const workEpisodes = await db.select().from(episodes).where(eq(episodes.webtoonId, id)).orderBy(asc(episodes.episodeNumber));
  const episodeIds = workEpisodes.map(episode => episode.id);
  const images = episodeIds.length
    ? await db.select().from(episodeImages).where(inArray(episodeImages.episodeId, episodeIds)).orderBy(asc(episodeImages.sortOrder))
    : [];
  return { work, episodes: workEpisodes.map(episode => ({ ...episode, images: images.filter(image => image.episodeId === episode.id) })) };
}

export async function createWebtoon(values: InsertWebtoon) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(webtoons).values(values);
  return Number(result[0].insertId);
}

export async function updateWebtoon(id: number, values: Partial<InsertWebtoon>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(webtoons).set(values).where(eq(webtoons.id, id));
}

export async function removeWebtoon(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(webtoons).where(eq(webtoons.id, id));
}

export async function createEpisode(values: InsertEpisode) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(episodes).values(values);
  return Number(result[0].insertId);
}

export async function updateEpisode(id: number, values: Partial<InsertEpisode>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(episodes).set(values).where(eq(episodes.id, id));
}

export async function removeEpisode(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(episodes).where(eq(episodes.id, id));
}

export async function replaceEpisodeImages(episodeId: number, images: { imageUrl: string; imageKey: string }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(episodeImages).where(eq(episodeImages.episodeId, episodeId));
  if (images.length) {
    await db.insert(episodeImages).values(images.map((image, index) => ({ ...image, episodeId, sortOrder: index + 1 })));
  }
}
