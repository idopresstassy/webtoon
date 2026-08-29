import { supabase } from "@/lib/supabase";

export type WebtoonComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  isHidden: boolean;
  isPinned: boolean;
  createdAt: string;
};

type CommentRow = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  is_hidden: boolean;
  is_pinned: boolean;
  created_at: string;
};

export async function listWebtoonComments(webtoonId: string): Promise<WebtoonComment[]> {
  const { data, error } = await supabase.rpc("list_webtoon_comments", { target_webtoon_id: webtoonId });
  if (error) throw error;
  return ((data ?? []) as CommentRow[]).map(comment => ({
    id: comment.id,
    authorId: comment.author_id,
    authorName: comment.author_name,
    body: comment.body,
    isHidden: comment.is_hidden,
    isPinned: comment.is_pinned,
    createdAt: comment.created_at,
  }));
}

export async function createWebtoonComment(input: { webtoonId: string; authorId: string; body: string }) {
  const body = input.body.trim();
  if (!body) throw new Error("댓글 내용을 입력해 주세요.");
  if (body.length > 1000) throw new Error("댓글은 1,000자 이내로 작성해 주세요.");
  const { error } = await supabase.from("webtoon_comments").insert({ webtoon_id: input.webtoonId, author_id: input.authorId, body });
  if (error) throw error;
}

export async function deleteWebtoonComment(commentId: string) {
  const { error } = await supabase.from("webtoon_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function setWebtoonCommentHidden(input: { commentId: string; hidden: boolean; actorId: string }) {
  const { error } = await supabase.from("webtoon_comments").update({ is_hidden: input.hidden, hidden_at: input.hidden ? new Date().toISOString() : null, hidden_by: input.hidden ? input.actorId : null }).eq("id", input.commentId);
  if (error) throw error;
}

export async function setWebtoonCommentPinned(input: { commentId: string; pinned: boolean; actorId: string }) {
  const { error } = await supabase.from("webtoon_comments").update({ is_pinned: input.pinned, pinned_at: input.pinned ? new Date().toISOString() : null, pinned_by: input.pinned ? input.actorId : null }).eq("id", input.commentId);
  if (error) throw error;
}
