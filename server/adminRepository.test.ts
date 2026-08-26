import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

import { getAdminDashboard } from "@/lib/adminRepository";

describe("getAdminDashboard", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    let eventRequest = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: vi.fn().mockResolvedValue({ data: [{ id: "member-a", created_at: "2026-08-27T00:00:00.000Z" }], error: null }) };
      if (table === "reading_events") {
        eventRequest += 1;
        if (eventRequest === 1) return { select: vi.fn(() => ({ gte: vi.fn().mockResolvedValue({ data: [{ id: "event-a", webtoon_id: "work-a", episode_id: "episode-a", visitor_id: "visitor-a", user_id: null, created_at: new Date().toISOString(), episodes: { title: "첫 화", episode_number: 1, webtoons: { title: "이생규장전", genre: "고전 로맨스" } } }], error: null }) })) };
        return { select: vi.fn().mockResolvedValue({ count: 73, error: null }) };
      }
      if (table === "webtoons") return { select: vi.fn().mockResolvedValue({ count: 1, error: null }) };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("uses all reading-event rows for the cumulative metric while retaining the recent trend", async () => {
    const dashboard = await getAdminDashboard();
    expect(dashboard.totalViews).toBe(73);
    expect(dashboard.dailyViews.reduce((sum, day) => sum + day.views, 0)).toBe(1);
    expect(dashboard.topEpisodes).toEqual([{ episodeId: "episode-a", workTitle: "이생규장전", episodeNumber: 1, episodeTitle: "첫 화", views: 1 }]);
    expect(dashboard.topWorks).toEqual([{ workId: "work-a", workTitle: "이생규장전", genre: "고전 로맨스", views: 1 }]);
  });
});
