import PublicHeader from "@/components/PublicHeader";
import { getPublicViewer, recordPublicReading } from "@/lib/webtoonRepository";
import { ChevronLeft, ChevronRight, List, Maximize2 } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

function getVisitorId() {
  const key = "mastertoon-visitor-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}

export default function Viewer({ slug, episodeNumber }: { slug: string; episodeNumber: number }) {
  const input = useMemo(() => ({ slug, episodeNumber }), [slug, episodeNumber]);
  const { data, isLoading, error } = useQuery({ queryKey: ["supabase", "viewer", input], queryFn: () => getPublicViewer(slug, episodeNumber) });
  useEffect(() => {
    if (!data) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    const readKey = `mastertoon-read-${data.episode.id}-${dayKey}`;
    if (localStorage.getItem(readKey)) return;
    localStorage.setItem(readKey, "1");
    void recordPublicReading(data.work.id, data.episode.id, getVisitorId());
  }, [data]);
  if (isLoading) return <div className="viewer-page viewer-state">회차를 불러오는 중입니다.</div>;
  if (error || !data) return <div className="viewer-page viewer-state">요청하신 회차를 찾을 수 없습니다.</div>;
  const currentIndex = data.allEpisodes.findIndex(episode => episode.episodeNumber === episodeNumber);
  const previous = data.allEpisodes[currentIndex - 1];
  const next = data.allEpisodes[currentIndex + 1];
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
  };
  return (
    <div className="viewer-page">
      <div className="viewer-topbar"><Link href={`/webtoon/${slug}`} className="viewer-back"><ChevronLeft size={20} />목록</Link><div><strong>{data.work.title}</strong><span>{data.episode.episodeNumber}화 · {data.episode.title}</span></div><button className="viewer-icon" onClick={toggleFullscreen} aria-label="전체 화면 전환"><Maximize2 size={18} /></button></div>
      <main className="viewer-canvas">
        {data.images.length ? data.images.map(image => <img key={image.id} src={image.imageUrl ?? ""} alt={`${data.work.title} ${data.episode.episodeNumber}화`} />) : <div className="viewer-empty"><List size={27} /><p>아직 업로드된 이미지가 없습니다.</p></div>}
      </main>
      <nav className="viewer-navigation" aria-label="회차 이동"><Link href={`/webtoon/${slug}`}><List size={18} />회차 목록</Link>{previous ? <Link href={`/webtoon/${slug}/episode/${previous.episodeNumber}`}><ChevronLeft size={18} />이전 화</Link> : <span>첫 화입니다</span>}{next ? <Link href={`/webtoon/${slug}/episode/${next.episodeNumber}`}>다음 화<ChevronRight size={18} /></Link> : <span>마지막 화입니다</span>}</nav>
    </div>
  );
}
