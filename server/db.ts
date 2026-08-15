import { and, asc, desc, eq, gte, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  episodeImages,
  episodes,
  InsertEpisode,
  InsertUser,
  InsertWebtoon,
  users,
  webtoons,
  readingEvents,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
const operatorAdminEmails = new Set(["idopublishingcompan@gmail.com"]);

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
  const normalizedEmail = user.email?.toLowerCase();
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId || (normalizedEmail && operatorAdminEmails.has(normalizedEmail))) {
    values.role = "admin";
    updateSet.role = "admin";
  }
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

export async function recordReadingEvent(values: { visitorId: string; webtoonId: number; episodeId: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(readingEvents).values(values);
}

export async function getAdminMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    loginMethod: users.loginMethod,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));
}

export async function getAdminAnalytics() {
  const db = await getDb();
  if (!db) return { totalMembers: 0, newMembers: 0, totalViews: 0, activeVisitors: 0, dailyViews: [], topEpisodes: [], topWorks: [] };
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 13);
  rangeStart.setHours(0, 0, 0, 0);
  const memberStart = new Date(now);
  memberStart.setDate(memberStart.getDate() - 29);
  memberStart.setHours(0, 0, 0, 0);
  const [members, recentEvents, allEvents, availableEpisodes, availableWorks] = await Promise.all([
    db.select().from(users),
    db.select().from(readingEvents).where(gte(readingEvents.createdAt, rangeStart)),
    db.select({ id: readingEvents.id }).from(readingEvents),
    db.select().from(episodes),
    db.select().from(webtoons),
  ]);
  const dailyMap = new Map<string, number>();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    dailyMap.set(date.toISOString().slice(0, 10), 0);
  }
  for (const event of recentEvents) {
    const key = new Date(event.createdAt).toISOString().slice(0, 10);
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
  }
  const episodeMap = new Map(availableEpisodes.map(episode => [episode.id, episode]));
  const workMap = new Map(availableWorks.map(work => [work.id, work]));
  const episodeCounts = new Map<number, number>();
  const workCounts = new Map<number, number>();
  for (const event of recentEvents) {
    episodeCounts.set(event.episodeId, (episodeCounts.get(event.episodeId) ?? 0) + 1);
    workCounts.set(event.webtoonId, (workCounts.get(event.webtoonId) ?? 0) + 1);
  }
  const topEpisodes = Array.from(episodeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).flatMap(([episodeId, views]) => {
    const episode = episodeMap.get(episodeId);
    const work = episode ? workMap.get(episode.webtoonId) : undefined;
    return episode && work ? [{ episodeId, episodeNumber: episode.episodeNumber, episodeTitle: episode.title, workTitle: work.title, views }] : [];
  });
  const topWorks = Array.from(workCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).flatMap(([workId, views]) => {
    const work = workMap.get(workId);
    return work ? [{ workId, workTitle: work.title, genre: work.genre, views }] : [];
  });
  return {
    totalMembers: members.length,
    newMembers: members.filter(member => new Date(member.createdAt) >= memberStart).length,
    totalViews: allEvents.length,
    activeVisitors: new Set(recentEvents.map(event => event.visitorId)).size,
    dailyViews: Array.from(dailyMap.entries()).map(([date, views]) => ({ date, views })),
    topEpisodes,
    topWorks,
  };
}
