import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const database = vi.hoisted(() => ({
  getPublishedWebtoons: vi.fn(),
  getGenres: vi.fn(),
  getPublicWebtoonBySlug: vi.fn(),
  getPublicEpisode: vi.fn(),
  getAdminWebtoons: vi.fn(),
  getAdminWebtoon: vi.fn(),
  createWebtoon: vi.fn(),
  updateWebtoon: vi.fn(),
  removeWebtoon: vi.fn(),
  createEpisode: vi.fn(),
  updateEpisode: vi.fn(),
  removeEpisode: vi.fn(),
  replaceEpisodeImages: vi.fn(),
  recordReadingEvent: vi.fn(),
  getAdminMembers: vi.fn(),
  getAdminAnalytics: vi.fn(),
}));

vi.mock("./db", () => database);
vi.mock("./webtoonUploads", () => ({ uploadWebtoonImage: vi.fn() }));

import { appRouter } from "./routers";
import { uploadWebtoonImage } from "./webtoonUploads";

function contextFor(role?: "user" | "admin", email = "test@example.com"): TrpcContext {
  return {
    user: role ? {
      id: 1,
      openId: "test-user",
      email,
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("webtoons router access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows a visitor without login to search published works", async () => {
    database.getPublishedWebtoons.mockResolvedValue([{ id: 1, title: "공개 작품", slug: "public-work" }]);
    const caller = appRouter.createCaller(contextFor());

    await expect(caller.webtoons.list({ search: "공개", genre: "드라마" })).resolves.toEqual([
      { id: 1, title: "공개 작품", slug: "public-work" },
    ]);
    expect(database.getPublishedWebtoons).toHaveBeenCalledWith({ search: "공개", genre: "드라마" });
  });

  it("allows a visitor without login to read public detail and viewer data", async () => {
    database.getPublicWebtoonBySlug.mockResolvedValue({ work: { id: 7, title: "공개 작품" }, episodes: [{ id: 9, episodeNumber: 1 }] });
    database.getPublicEpisode.mockResolvedValue({ work: { id: 7, title: "공개 작품" }, episode: { id: 9, episodeNumber: 1 }, images: [], allEpisodes: [{ episodeNumber: 1, title: "첫 화" }] });
    const caller = appRouter.createCaller(contextFor());

    await expect(caller.webtoons.detail({ slug: "public-work" })).resolves.toMatchObject({ work: { title: "공개 작품" } });
    await expect(caller.webtoons.viewer({ slug: "public-work", episodeNumber: 1 })).resolves.toMatchObject({ episode: { episodeNumber: 1 } });
  });

  it("records a reading event without requiring reader signup", async () => {
    database.recordReadingEvent.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(contextFor());
    await expect(caller.analytics.recordReading({ visitorId: "visitor-unique-123", webtoonId: 7, episodeId: 9 })).resolves.toEqual({ success: true });
    expect(database.recordReadingEvent).toHaveBeenCalledWith({ visitorId: "visitor-unique-123", webtoonId: 7, episodeId: 9 });
  });

  it("keeps the full browse-to-read journey public for a visitor without an account", async () => {
    database.getPublishedWebtoons.mockResolvedValue([{ id: 7, slug: "public-work", title: "공개 작품" }]);
    database.getPublicWebtoonBySlug.mockResolvedValue({ work: { id: 7, slug: "public-work", title: "공개 작품" }, episodes: [{ id: 9, episodeNumber: 1, title: "첫 화" }] });
    database.getPublicEpisode.mockResolvedValue({ work: { id: 7, title: "공개 작품" }, episode: { id: 9, episodeNumber: 1, title: "첫 화" }, images: [{ id: 1, imageUrl: "/manus-storage/page-1.jpg" }], allEpisodes: [{ episodeNumber: 1, title: "첫 화" }] });
    database.recordReadingEvent.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(contextFor());

    await expect(caller.webtoons.list()).resolves.toHaveLength(1);
    await expect(caller.webtoons.detail({ slug: "public-work" })).resolves.toMatchObject({ episodes: [{ episodeNumber: 1 }] });
    await expect(caller.webtoons.viewer({ slug: "public-work", episodeNumber: 1 })).resolves.toMatchObject({ images: [{ imageUrl: "/manus-storage/page-1.jpg" }] });
    await expect(caller.analytics.recordReading({ visitorId: "visitor-full-flow-123", webtoonId: 7, episodeId: 9 })).resolves.toEqual({ success: true });
  });

  it("rejects unauthenticated access to the administrator catalog", async () => {
    const caller = appRouter.createCaller(contextFor());
    await expect(caller.webtoons.adminList()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a regular user from the administrator catalog", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.webtoons.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an administrator to retrieve all works", async () => {
    database.getAdminWebtoons.mockResolvedValue([{ id: 3, title: "운영 작품", episodeCount: 2 }]);
    const caller = appRouter.createCaller(contextFor("admin"));
    await expect(caller.webtoons.adminList()).resolves.toEqual([{ id: 3, title: "운영 작품", episodeCount: 2 }]);
  });

  it("allows the designated publishing operator email when a stale session role is user", async () => {
    database.getAdminWebtoons.mockResolvedValue([]);
    const caller = appRouter.createCaller(contextFor("user", "idopublishingcompan@gmail.com"));
    await expect(caller.webtoons.adminList()).resolves.toEqual([]);
  });

  it("restricts member and analytics management to an administrator", async () => {
    const visitor = appRouter.createCaller(contextFor());
    await expect(visitor.members.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(visitor.analytics.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    database.getAdminMembers.mockResolvedValue([{ id: 1, email: "member@example.com" }]);
    database.getAdminAnalytics.mockResolvedValue({ totalMembers: 1, totalViews: 0, topWorks: [{ workId: 1, workTitle: "명작", views: 4 }] });
    const admin = appRouter.createCaller(contextFor("admin"));
    await expect(admin.members.list()).resolves.toEqual([{ id: 1, email: "member@example.com" }]);
    await expect(admin.analytics.dashboard()).resolves.toMatchObject({ totalMembers: 1, topWorks: [{ workTitle: "명작", views: 4 }] });
  });

  it("stores a new cover before an administrator creates a work", async () => {
    vi.mocked(uploadWebtoonImage).mockResolvedValue({ key: "webtoons/covers/cover.png", url: "/manus-storage/cover.png" });
    database.createWebtoon.mockResolvedValue(12);
    const caller = appRouter.createCaller(contextFor("admin"));

    await expect(caller.webtoons.adminCreate({
      slug: "new-work",
      title: "새 작품",
      genre: "판타지",
      description: "공개할 작품 소개입니다.",
      isPublished: true,
      coverDataUrl: "data:image/png;base64,AA==",
    })).resolves.toEqual({ id: 12 });
    expect(database.createWebtoon).toHaveBeenCalledWith(expect.objectContaining({ thumbnailKey: "webtoons/covers/cover.png", isPublished: 1 }));
  });

  it("preserves an administrator-selected existing image order while updating an episode", async () => {
    database.updateEpisode.mockResolvedValue(undefined);
    database.replaceEpisodeImages.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(contextFor("admin"));

    await expect(caller.webtoons.adminUpdateEpisode({
      id: 8,
      episodeNumber: 2,
      title: "두 번째 화",
      isPublished: true,
      existingImages: [
        { imageKey: "episodes/second.png", imageUrl: "/manus-storage/second.png" },
        { imageKey: "episodes/first.png", imageUrl: "/manus-storage/first.png" },
      ],
    })).resolves.toEqual({ id: 8 });
    expect(database.replaceEpisodeImages).toHaveBeenCalledWith(8, [
      { imageKey: "episodes/second.png", imageUrl: "/manus-storage/second.png" },
      { imageKey: "episodes/first.png", imageUrl: "/manus-storage/first.png" },
    ]);
  });

  it("allows an administrator to delete a work and a specific episode", async () => {
    database.removeWebtoon.mockResolvedValue(undefined);
    database.removeEpisode.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(contextFor("admin"));

    await expect(caller.webtoons.adminDelete({ id: 6 })).resolves.toEqual({ id: 6 });
    await expect(caller.webtoons.adminDeleteEpisode({ id: 9 })).resolves.toEqual({ id: 9 });
    expect(database.removeWebtoon).toHaveBeenCalledWith(6);
    expect(database.removeEpisode).toHaveBeenCalledWith(9);
  });
});
