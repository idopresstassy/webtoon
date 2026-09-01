import { getPublicViewer, recordPublicReading } from "@/lib/webtoonRepository";
import { ChevronLeft, ChevronRight, List, Maximize2 } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";

function getVisitorId() {
  const key = "mastertoon-visitor-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}

type SwipeImage = { id: string | number; imageUrl: string | null };
type SwipePagerProps = { images: SwipeImage[]; title: string; episodeNumber: number };

function SwipePager({ images, title, episodeNumber }: SwipePagerProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const pointerDelta = useRef(0);
  const suppressClick = useRef(false);

  useEffect(() => {
    setPageIndex(0);
  }, [images.length]);

  const movePage = (delta: number) => {
    setPageIndex(current => Math.max(0, Math.min(images.length - 1, current + delta)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "PageDown") {
      event.preventDefault();
      movePage(1);
    } else if (event.key === "ArrowRight" || event.key === "PageUp") {
      event.preventDefault();
      movePage(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setPageIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPageIndex(images.length - 1);
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStart.current = event.clientX;
    pointerDelta.current = 0;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current !== null) pointerDelta.current = event.clientX - pointerStart.current;
  };
  const onPointerUp = () => {
    if (pointerStart.current !== null && Math.abs(pointerDelta.current) > 40) {
      // Fixed convention: a leftward gesture advances one page.
      movePage(pointerDelta.current < 0 ? 1 : -1);
      suppressClick.current = true;
    }
    pointerStart.current = null;
    pointerDelta.current = 0;
  };
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    // Left click advances; right click goes to the previous page.
    movePage(event.clientX - bounds.left < bounds.width / 2 ? 1 : -1);
  };

  return (
    <div
      className="viewer-swipe-stage"
      tabIndex={0}
      role="application"
      aria-label="페이지 스와이프 뷰어"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
    >
      <div className="viewer-swipe-track" style={{ position: "relative", width: "100%", height: "100%" }}>
        {images.map((image, index) => (
          <div className="viewer-swipe-page" style={{ position: "absolute", inset: 0, transform: `translate3d(${(pageIndex - index) * 100}%, 0, 0)`, transition: "transform .22s ease-out", visibility: Math.abs(index - pageIndex) <= 1 ? "visible" : "hidden" }} key={image.id} aria-hidden={index !== pageIndex}>
            <img src={image.imageUrl ?? ""} alt={`${title} ${episodeNumber}화 ${index + 1}페이지`} loading={Math.abs(index - pageIndex) <= 1 ? "eager" : "lazy"} draggable={false} />
          </div>
        ))}
      </div>
      <span className="viewer-page-indicator" aria-live="polite">{pageIndex + 1} / {images.length}</span>
    </div>
  );
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
      <main className="viewer-canvas viewer-canvas--swipe">
        {data.images.length ? <SwipePager images={data.images} title={data.work.title} episodeNumber={data.episode.episodeNumber} /> : <div className="viewer-empty"><List size={27} /><p>아직 업로드된 이미지가 없습니다.</p></div>}
      </main>
      <nav className="viewer-navigation" aria-label="회차 이동"><Link href={`/webtoon/${slug}`}><List size={18} />회차 목록</Link>{previous ? <Link href={`/webtoon/${slug}/episode/${previous.episodeNumber}`}><ChevronLeft size={18} />이전 화</Link> : <span>첫 화입니다</span>}{next ? <Link href={`/webtoon/${slug}/episode/${next.episodeNumber}`}>다음 화<ChevronRight size={18} /></Link> : <span>마지막 화입니다</span>}</nav>
    </div>
  );
}
