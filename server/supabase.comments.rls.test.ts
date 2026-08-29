import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.VITE_SUPABASE_URL!;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anonymous = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = crypto.randomUUID().replace(/-/g, "");
const password = `CommentTest!${suffix.slice(0, 16)}`;
let workId = "";
let memberId = "";
let otherMemberId = "";
let moderatorId = "";
let memberClient: SupabaseClient;
let otherMemberClient: SupabaseClient;
let moderatorClient: SupabaseClient;
let commentId = "";
let secondCommentId = "";

async function createAuthenticatedClient(email: string) {
  const client = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

beforeAll(async () => {
  const { data: work, error: workError } = await admin.from("webtoons").select("id").eq("slug", "isgjj-1").single();
  if (workError) throw workError;
  workId = work.id;
  const createUser = async (kind: string) => {
    const { data, error } = await admin.auth.admin.createUser({ email: `comment-rls-${kind}-${suffix}@example.invalid`, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Temporary test user creation failed");
    return data.user.id;
  };
  memberId = await createUser("member");
  otherMemberId = await createUser("other");
  moderatorId = await createUser("moderator");
  const { error: roleError } = await admin.from("profiles").update({ role: "admin" }).eq("id", moderatorId);
  if (roleError) throw roleError;
  memberClient = await createAuthenticatedClient(`comment-rls-member-${suffix}@example.invalid`);
  otherMemberClient = await createAuthenticatedClient(`comment-rls-other-${suffix}@example.invalid`);
  moderatorClient = await createAuthenticatedClient(`comment-rls-moderator-${suffix}@example.invalid`);
});

afterAll(async () => {
  if (commentId) await admin.from("webtoon_comments").delete().eq("id", commentId);
  if (secondCommentId) await admin.from("webtoon_comments").delete().eq("id", secondCommentId);
  for (const id of [memberId, otherMemberId, moderatorId].filter(Boolean)) await admin.auth.admin.deleteUser(id);
});

describe("Supabase webtoon comment RLS", () => {
  it("blocks anonymous writing but allows a member to create and read a comment", async () => {
    const { error: anonymousError } = await anonymous.from("webtoon_comments").insert({ webtoon_id: workId, author_id: crypto.randomUUID(), body: `comment-test-token-${suffix}` });
    expect(anonymousError).not.toBeNull();

    const token = `comment-test-token-${suffix}`;
    const { data, error: memberError } = await memberClient.from("webtoon_comments").insert({ webtoon_id: workId, author_id: memberId, body: token }).select("id").single();
    expect(memberError).toBeNull();
    commentId = data!.id;
    const { data: anonymousComments, error: visibleError } = await anonymous.rpc("list_webtoon_comments", { target_webtoon_id: workId });
    expect(visibleError).toBeNull();
    expect(anonymousComments?.some(comment => comment.id === commentId && comment.body === token)).toBe(true);
  });

  it("prevents other members from deleting or pinning while allowing an admin to pin, hide and delete", async () => {
    const { data: otherDelete, error: otherDeleteError } = await otherMemberClient.from("webtoon_comments").delete().eq("id", commentId).select("id");
    expect(otherDeleteError).toBeNull();
    expect(otherDelete).toEqual([]);
    const { data: retained } = await admin.from("webtoon_comments").select("id").eq("id", commentId).maybeSingle();
    expect(retained?.id).toBe(commentId);

    const { data: otherPin, error: otherPinError } = await otherMemberClient.from("webtoon_comments").update({ is_pinned: true }).eq("id", commentId).select("id");
    expect(otherPinError).toBeNull();
    expect(otherPin).toEqual([]);
    const { data: secondComment, error: secondCommentError } = await memberClient.from("webtoon_comments").insert({ webtoon_id: workId, author_id: memberId, body: `comment-second-token-${suffix}` }).select("id").single();
    expect(secondCommentError).toBeNull();
    secondCommentId = secondComment!.id;
    const { error: pinError } = await moderatorClient.from("webtoon_comments").update({ is_pinned: true, pinned_at: new Date().toISOString(), pinned_by: moderatorId }).eq("id", commentId);
    expect(pinError).toBeNull();
    const { data: orderedComments, error: orderedError } = await anonymous.rpc("list_webtoon_comments", { target_webtoon_id: workId });
    expect(orderedError).toBeNull();
    expect(orderedComments?.[0]?.id).toBe(commentId);
    expect(orderedComments?.[0]?.is_pinned).toBe(true);

    const { error: hideError } = await moderatorClient.from("webtoon_comments").update({ is_hidden: true, hidden_at: new Date().toISOString(), hidden_by: moderatorId }).eq("id", commentId);
    expect(hideError).toBeNull();
    const { data: anonymousComments } = await anonymous.rpc("list_webtoon_comments", { target_webtoon_id: workId });
    expect(anonymousComments?.some(comment => comment.id === commentId)).toBe(false);
    const { data: authorComments } = await memberClient.rpc("list_webtoon_comments", { target_webtoon_id: workId });
    expect(authorComments?.find(comment => comment.id === commentId)?.is_hidden).toBe(true);

    const { error: moderatorDeleteError } = await moderatorClient.from("webtoon_comments").delete().eq("id", commentId);
    expect(moderatorDeleteError).toBeNull();
    const { data: removed } = await admin.from("webtoon_comments").select("id").eq("id", commentId).maybeSingle();
    expect(removed).toBeNull();
    commentId = "";
  });
});
