import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import { createWebtoonComment, listWebtoonComments } from "../client/src/lib/commentRepository";

describe("webtoon comment repository", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("maps the safe public comment fields returned by the Supabase RPC", async () => {
    mockRpc.mockResolvedValue({ data: [{ id: "comment-1", author_id: "author-1", author_name: "독자", body: "comment-test-token", is_hidden: false, created_at: "2026-08-29T04:00:00.000Z" }], error: null });
    await expect(listWebtoonComments("work-1")).resolves.toEqual([{ id: "comment-1", authorId: "author-1", authorName: "독자", body: "comment-test-token", isHidden: false, createdAt: "2026-08-29T04:00:00.000Z" }]);
    expect(mockRpc).toHaveBeenCalledWith("list_webtoon_comments", { target_webtoon_id: "work-1" });
  });

  it("rejects blank and overlong comments before any database request", async () => {
    await expect(createWebtoonComment({ webtoonId: "work-1", authorId: "author-1", body: "   " })).rejects.toThrow("댓글 내용을 입력해 주세요.");
    await expect(createWebtoonComment({ webtoonId: "work-1", authorId: "author-1", body: "가".repeat(1001) })).rejects.toThrow("1,000자 이내");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
