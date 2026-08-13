import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import WebtoonCover from "@/components/WebtoonCover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BookCopy, ChevronLeft, ChevronRight, FileImage, FolderOpen, ImagePlus, Pencil, Plus, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type WorkForm = { slug: string; title: string; genre: string; description: string; isPublished: boolean; coverDataUrl?: string };
type EpisodeImage = { imageUrl: string; imageKey: string };
type EpisodeForm = { episodeNumber: string; title: string; isPublished: boolean; imageDataUrls: string[]; existingImages: EpisodeImage[] };
const blankWork: WorkForm = { slug: "", title: "", genre: "", description: "", isPublished: true };
const blankEpisode: EpisodeForm = { episodeNumber: "", title: "", isPublished: true, imageDataUrls: [], existingImages: [] };

function asDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
}

export default function Admin() { return <DashboardLayout><AdminContent /></DashboardLayout>; }

function AdminContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "idopublishingcompan@gmail.com";
  const utils = trpc.useUtils();
  const { data: works = [], isLoading } = trpc.webtoons.adminList.useQuery(undefined, { enabled: isAdmin });
  const [editingWork, setEditingWork] = useState<number | null>(null);
  const [workForm, setWorkForm] = useState<WorkForm>(blankWork);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const [episodeForm, setEpisodeForm] = useState<EpisodeForm>(blankEpisode);
  const [editingEpisode, setEditingEpisode] = useState<number | null>(null);
  const adminGetInput = useMemo(() => selectedWorkId ? { id: selectedWorkId } : undefined, [selectedWorkId]);
  const { data: selectedWork } = trpc.webtoons.adminGet.useQuery(adminGetInput!, { enabled: isAdmin && Boolean(selectedWorkId) });
  const refresh = async () => { await utils.webtoons.adminList.invalidate(); if (selectedWorkId) await utils.webtoons.adminGet.invalidate({ id: selectedWorkId }); };
  const createWork = trpc.webtoons.adminCreate.useMutation({ onSuccess: async () => { toast.success("작품을 등록했습니다."); setWorkForm(blankWork); setEditingWork(null); await refresh(); }, onError: error => toast.error(error.message) });
  const updateWork = trpc.webtoons.adminUpdate.useMutation({ onSuccess: async () => { toast.success("작품 정보를 수정했습니다."); setWorkForm(blankWork); setEditingWork(null); await refresh(); }, onError: error => toast.error(error.message) });
  const deleteWork = trpc.webtoons.adminDelete.useMutation({ onSuccess: async () => { toast.success("작품을 삭제했습니다."); if (selectedWorkId) setSelectedWorkId(null); await refresh(); }, onError: error => toast.error(error.message) });
  const createEpisode = trpc.webtoons.adminCreateEpisode.useMutation({ onSuccess: async () => { toast.success("회차와 이미지가 등록되었습니다."); setEpisodeForm(blankEpisode); await refresh(); }, onError: error => toast.error(error.message) });
  const updateEpisode = trpc.webtoons.adminUpdateEpisode.useMutation({ onSuccess: async () => { toast.success("회차 정보를 수정했습니다."); setEpisodeForm(blankEpisode); setEditingEpisode(null); await refresh(); }, onError: error => toast.error(error.message) });
  const deleteEpisode = trpc.webtoons.adminDeleteEpisode.useMutation({ onSuccess: async () => { toast.success("회차를 삭제했습니다."); await refresh(); }, onError: error => toast.error(error.message) });

  if (!isAdmin) return <div className="admin-denied"><ShieldAlert size={34} /><h1>관리자 전용 화면입니다.</h1><p>승인된 운영자 계정으로 로그인한 뒤 다시 시도해 주세요.</p></div>;
  const setWork = <K extends keyof WorkForm>(key: K, value: WorkForm[K]) => setWorkForm(previous => ({ ...previous, [key]: value }));
  const setEpisode = <K extends keyof EpisodeForm>(key: K, value: EpisodeForm[K]) => setEpisodeForm(previous => ({ ...previous, [key]: value }));
  const uploadCover = async (file?: File) => { if (!file) return; if (file.size > 7 * 1024 * 1024) return toast.error("표지 이미지는 7MB 이하여야 합니다."); setWork("coverDataUrl", await asDataUrl(file)); };
  const uploadEpisodeImages = async (files: FileList | null) => { if (!files?.length) return; const values = Array.from(files); if (values.length > 30 || values.some(file => file.size > 7 * 1024 * 1024)) return toast.error("이미지는 최대 30장, 각 7MB 이하로 등록할 수 있습니다."); setEpisode("imageDataUrls", await Promise.all(values.map(asDataUrl))); };
  const moveExistingImage = (index: number, direction: -1 | 1) => setEpisodeForm(previous => {
    const destination = index + direction;
    if (destination < 0 || destination >= previous.existingImages.length) return previous;
    const existingImages = [...previous.existingImages];
    [existingImages[index], existingImages[destination]] = [existingImages[destination], existingImages[index]];
    return { ...previous, existingImages };
  });
  const submitWork = (event: React.FormEvent) => { event.preventDefault(); if (!editingWork && !workForm.coverDataUrl) return toast.error("작품 표지 이미지를 선택해 주세요."); const payload = { slug: workForm.slug.toLowerCase().trim(), title: workForm.title, genre: workForm.genre, description: workForm.description, isPublished: workForm.isPublished }; if (editingWork) updateWork.mutate({ id: editingWork, ...payload, ...(workForm.coverDataUrl ? { coverDataUrl: workForm.coverDataUrl } : {}) }); else createWork.mutate({ ...payload, coverDataUrl: workForm.coverDataUrl! }); };
  const beginEdit = (work: typeof works[number]) => { setEditingWork(work.id); setSelectedWorkId(work.id); setWorkForm({ slug: work.slug, title: work.title, genre: work.genre, description: work.description, isPublished: work.isPublished === 1 }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const submitEpisode = (event: React.FormEvent) => { event.preventDefault(); if (!selectedWorkId) return; const payload = { episodeNumber: Number(episodeForm.episodeNumber), title: episodeForm.title, isPublished: episodeForm.isPublished }; if (editingEpisode) { updateEpisode.mutate({ id: editingEpisode, ...payload, ...(episodeForm.imageDataUrls.length ? { imageDataUrls: episodeForm.imageDataUrls } : { existingImages: episodeForm.existingImages }) }); return; } if (!episodeForm.imageDataUrls.length) return toast.error("세로 뷰어에 표시할 이미지를 선택해 주세요."); createEpisode.mutate({ webtoonId: selectedWorkId, ...payload, imageDataUrls: episodeForm.imageDataUrls }); };

  return <div className="admin-page">
    <div className="admin-page__heading"><div><p className="eyebrow eyebrow--dark">CONTENT STUDIO</p><h1>명작무료웹툰 운영</h1><p>작품과 회차를 등록하고, 독자에게 공개할 이야기를 관리합니다.</p></div><div className="admin-stat"><span>등록 작품</span><strong>{works.length}</strong></div></div>
    <section className="admin-workbench">
      <div className="admin-section__heading"><div><span className="admin-section__step">01</span><h2>{editingWork ? "작품 정보 수정" : "새 작품 등록"}</h2></div>{editingWork && <Button variant="ghost" onClick={() => { setEditingWork(null); setWorkForm(blankWork); }}>새 작품 등록으로 전환</Button>}</div>
      <form onSubmit={submitWork} className="work-form">
        <label className="cover-upload">{workForm.coverDataUrl ? <img src={workForm.coverDataUrl} alt="선택한 표지 미리보기" /> : editingWork && works.find(work => work.id === editingWork)?.thumbnailUrl ? <img src={works.find(work => work.id === editingWork)?.thumbnailUrl || ""} alt="현재 표지" /> : <><ImagePlus size={25} /><span>표지 이미지<br />선택</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadCover(event.target.files?.[0])} /></label>
        <div className="form-fields"><div className="field-grid"><div><Label htmlFor="work-title">작품 제목</Label><Input id="work-title" value={workForm.title} onChange={event => setWork("title", event.target.value)} required /></div><div><Label htmlFor="work-genre">장르</Label><Input id="work-genre" placeholder="예: 판타지, 로맨스" value={workForm.genre} onChange={event => setWork("genre", event.target.value)} required /></div></div><div><Label htmlFor="work-slug">작품 주소 (영문 소문자·숫자·하이픈)</Label><Input id="work-slug" placeholder="my-masterpiece" value={workForm.slug} onChange={event => setWork("slug", event.target.value)} required /></div><div><Label htmlFor="work-description">작품 소개</Label><Textarea id="work-description" rows={4} value={workForm.description} onChange={event => setWork("description", event.target.value)} required /></div><label className="published-check"><Checkbox checked={workForm.isPublished} onCheckedChange={checked => setWork("isPublished", checked === true)} />독자에게 즉시 공개</label><Button type="submit" disabled={createWork.isPending || updateWork.isPending}>{editingWork ? <Pencil size={16} /> : <Plus size={16} />}{editingWork ? "작품 정보 저장" : "작품 등록"}</Button></div>
      </form>
    </section>
    <section className="admin-catalog"><div className="admin-section__heading"><div><span className="admin-section__step">02</span><h2>등록된 작품</h2></div><span className="admin-section__note">작품을 선택하면 회차를 관리할 수 있습니다.</span></div>{isLoading ? <p className="admin-placeholder">작품 목록을 불러오는 중입니다.</p> : works.length ? <div className="admin-work-list">{works.map(work => <article key={work.id} className={selectedWorkId === work.id ? "admin-work-card admin-work-card--selected" : "admin-work-card"}><button className="admin-work-card__main" onClick={() => setSelectedWorkId(work.id)}><WebtoonCover src={work.thumbnailUrl} title={work.title} genre={work.genre} /><div><span>{work.genre} · {work.isPublished ? "공개" : "비공개"}</span><h3>{work.title}</h3><p>{work.episodeCount}개 회차</p></div></button><div className="admin-work-card__actions"><Button size="sm" variant="outline" onClick={() => beginEdit(work)}><Pencil size={14} />수정</Button><Button size="icon" variant="ghost" aria-label={`${work.title} 삭제`} onClick={() => { if (window.confirm(`‘${work.title}’과 모든 회차를 삭제할까요?`)) deleteWork.mutate({ id: work.id }); }}><Trash2 size={16} /></Button></div></article>)}</div> : <div className="admin-placeholder"><BookCopy size={24} /><p>아직 등록된 작품이 없습니다. 위 양식으로 첫 작품을 추가하세요.</p></div>}</section>
    {selectedWork && <section className="admin-episodes"><div className="admin-section__heading"><div><span className="admin-section__step">03</span><h2>회차 관리</h2><p>{selectedWork.work.title}</p></div><Button variant="ghost" onClick={() => { setSelectedWorkId(null); setEditingEpisode(null); setEpisodeForm(blankEpisode); }}><ChevronLeft size={16} />선택 해제</Button></div><div className="episode-admin-grid"><form onSubmit={submitEpisode} className="episode-form"><div className="episode-form__title"><h3>{editingEpisode ? <Pencil size={18} /> : <Plus size={18} />}{editingEpisode ? "회차 수정" : "새 회차 등록"}</h3>{editingEpisode && <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingEpisode(null); setEpisodeForm(blankEpisode); }}>새 회차 등록</Button>}</div><div className="field-grid"><div><Label htmlFor="episode-number">회차 번호</Label><Input id="episode-number" type="number" min="1" value={episodeForm.episodeNumber} onChange={event => setEpisode("episodeNumber", event.target.value)} required /></div><div><Label htmlFor="episode-title">회차 제목</Label><Input id="episode-title" value={episodeForm.title} onChange={event => setEpisode("title", event.target.value)} required /></div></div><label className="episode-image-upload"><Upload size={22} /><strong>{editingEpisode ? "뷰어 이미지 교체" : "세로 뷰어 이미지 선택"}</strong><span>{editingEpisode ? "새 이미지를 선택하면 현재 이미지 전체를 순서대로 교체합니다." : "순서대로 최대 30장 · JPG, PNG, WEBP · 장당 7MB 이하"}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => uploadEpisodeImages(event.target.files)} /></label>{episodeForm.imageDataUrls.length ? <div className="upload-summary"><FileImage size={16} />{episodeForm.imageDataUrls.length}장 선택됨</div> : null}{editingEpisode && !episodeForm.imageDataUrls.length && episodeForm.existingImages.length ? <div className="image-order-manager"><p>이미지 순서</p><span>화살표 버튼으로 뷰어 노출 순서를 조정하세요.</span><div>{episodeForm.existingImages.map((image, index) => <figure key={`${image.imageKey}-${index}`}><img src={image.imageUrl} alt={`${episodeForm.title} 이미지 ${index + 1}`} /><figcaption><strong>{index + 1}</strong><span><Button type="button" size="icon" variant="outline" aria-label={`${index + 1}번째 이미지를 앞으로 이동`} disabled={index === 0} onClick={() => moveExistingImage(index, -1)}><ChevronLeft size={14} /></Button><Button type="button" size="icon" variant="outline" aria-label={`${index + 1}번째 이미지를 뒤로 이동`} disabled={index === episodeForm.existingImages.length - 1} onClick={() => moveExistingImage(index, 1)}><ChevronRight size={14} /></Button></span></figcaption></figure>)}</div></div> : null}<label className="published-check"><Checkbox checked={episodeForm.isPublished} onCheckedChange={checked => setEpisode("isPublished", checked === true)} />독자에게 즉시 공개</label><Button type="submit" disabled={createEpisode.isPending || updateEpisode.isPending}>{editingEpisode ? "회차 정보 저장" : "회차와 이미지 등록"}</Button></form><div className="episode-admin-list"><h3><FolderOpen size={18} />등록된 회차 <span>{selectedWork.episodes.length}</span></h3>{selectedWork.episodes.length ? [...selectedWork.episodes].reverse().map(episode => <article key={episode.id}><div><span>{episode.episodeNumber}화 · {episode.isPublished ? "공개" : "비공개"}</span><strong>{episode.title}</strong><small>이미지 {episode.images.length}장</small></div><div className="episode-admin-list__actions"><Button size="icon" variant="ghost" aria-label={`${episode.title} 수정`} onClick={() => { setEditingEpisode(episode.id); setEpisodeForm({ episodeNumber: String(episode.episodeNumber), title: episode.title, isPublished: episode.isPublished === 1, imageDataUrls: [], existingImages: episode.images.map(image => ({ imageUrl: image.imageUrl, imageKey: image.imageKey })) }); }}><Pencil size={16} /></Button><Button size="icon" variant="ghost" aria-label={`${episode.title} 삭제`} onClick={() => { if (window.confirm(`‘${episode.title}’ 회차를 삭제할까요?`)) deleteEpisode.mutate({ id: episode.id }); }}><Trash2 size={16} /></Button></div></article>) : <p className="episode-admin-list__empty">등록된 회차가 없습니다.</p>}</div></div></section>}
  </div>;
}
