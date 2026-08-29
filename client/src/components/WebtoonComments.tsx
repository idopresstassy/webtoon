import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createWebtoonComment, deleteWebtoonComment, listWebtoonComments, setWebtoonCommentHidden } from "@/lib/commentRepository";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, LogIn, MessageCircle, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const operatorEmail = "idopublishingcompan@gmail.com";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function WebtoonComments({ webtoonId, webtoonSlug }: { webtoonId: string; webtoonSlug: string }) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === operatorEmail;
  const queryClient = useQueryClient();
  const commentsKey = ["supabase", "webtoon-comments", webtoonId] as const;
  const { data: comments = [], isLoading, isError } = useQuery({ queryKey: commentsKey, queryFn: () => listWebtoonComments(webtoonId) });
  const [body, setBody] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: commentsKey });
  const createMutation = useMutation({
    mutationFn: createWebtoonComment,
    onSuccess: async () => { setBody(""); await refresh(); toast.success("댓글을 등록했습니다."); },
    onError: error => toast.error(error instanceof Error ? error.message : "댓글을 등록하지 못했습니다."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteWebtoonComment,
    onSuccess: async () => { await refresh(); toast.success("댓글을 삭제했습니다."); },
    onError: () => toast.error("댓글을 삭제하지 못했습니다."),
  });
  const hideMutation = useMutation({
    mutationFn: setWebtoonCommentHidden,
    onSuccess: async (_, input) => { await refresh(); toast.success(input.hidden ? "댓글을 숨겼습니다." : "댓글을 다시 공개했습니다."); },
    onError: () => toast.error("댓글 상태를 변경하지 못했습니다."),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    createMutation.mutate({ webtoonId, authorId: user.id, body });
  };
  const pending = createMutation.isPending || deleteMutation.isPending || hideMutation.isPending;

  return <section className="comments-section" aria-labelledby="comments-title">
    <div className="comments-heading"><div><p className="eyebrow eyebrow--dark">READERS' NOTE</p><h2 id="comments-title"><MessageCircle size={22} />독자 댓글 <span>{comments.filter(comment => !comment.isHidden).length}</span></h2></div><p>작품을 읽은 마음을 나눠 보세요.</p></div>
    {isAuthenticated && user ? <form className="comment-form" onSubmit={submit}><Textarea value={body} onChange={event => setBody(event.target.value)} placeholder="작품에 대한 감상과 응원을 남겨 주세요. 서로를 존중하는 말로 써 주세요." maxLength={1000} rows={4} disabled={pending} /><div><small>{body.length.toLocaleString("ko-KR")} / 1,000</small><Button type="submit" disabled={!body.trim() || pending}>{createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}댓글 등록</Button></div></form> : <div className="comments-login"><div><strong>댓글은 로그인한 회원이 작성할 수 있습니다.</strong><span>웹툰 감상은 로그인 없이 계속 무료입니다.</span></div><Button variant="outline" onClick={() => startLogin(`/webtoon/${webtoonSlug}`)}><LogIn size={16} />로그인 후 댓글 쓰기</Button></div>}
    {isLoading ? <div className="comments-state">댓글을 불러오는 중입니다.</div> : isError ? <div className="comments-state">댓글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div> : comments.length ? <ol className="comment-list">{comments.map(comment => { const canDelete = user?.id === comment.authorId || isAdmin; return <li key={comment.id} className={comment.isHidden ? "comment-item comment-item--hidden" : "comment-item"}><div className="comment-item__meta"><strong>{comment.authorName}</strong>{comment.isHidden ? <span className="comment-hidden-badge">숨김 처리됨</span> : null}<time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time></div><p>{comment.body}</p>{(canDelete || isAdmin) ? <div className="comment-item__actions">{isAdmin ? <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => hideMutation.mutate({ commentId: comment.id, hidden: !comment.isHidden, actorId: user!.id })}>{comment.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}{comment.isHidden ? "공개" : "숨김"}</Button> : null}{canDelete ? <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { if (window.confirm("이 댓글을 삭제할까요?")) deleteMutation.mutate(comment.id); }}><Trash2 size={14} />삭제</Button> : null}</div> : null}</li>; })}</ol> : <div className="comments-state"><MessageCircle size={25} /><p>첫 번째 독자 댓글을 남겨 보세요.</p></div>}
  </section>;
}

