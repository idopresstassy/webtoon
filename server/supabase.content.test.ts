import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.VITE_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

describe("Supabase migrated webtoon content", () => {
  it("contains the restored 이생규장전 work, four episodes, and at least the imported viewer images", async () => {
    const { data: work, error: workError } = await supabase.from("webtoons").select("id, slug").eq("slug", "isgjj-1").single();
    expect(workError).toBeNull();
    expect(work?.slug).toBe("isgjj-1");

    const { count: episodeCount, error: episodeError } = await supabase
      .from("episodes")
      .select("id", { count: "exact", head: true })
      .eq("webtoon_id", work!.id);
    expect(episodeError).toBeNull();
    expect(episodeCount).toBe(4);

    const { count: imageCount, error: imageError } = await supabase
      .from("episode_images")
      .select("id", { count: "exact", head: true });
    expect(imageError).toBeNull();
    expect(imageCount).toBeGreaterThanOrEqual(12);

    const { data: viewerImages, error: storageError } = await supabase.storage.from("webtoon-assets").list("episodes/isgjj-1/001");
    expect(storageError).toBeNull();
    expect(viewerImages).toHaveLength(3);
  });
});
