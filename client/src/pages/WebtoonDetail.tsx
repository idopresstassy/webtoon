import PublicHeader from "@/components/PublicHeader";
import WebtoonCover from "@/components/WebtoonCover";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, BookOpen, ChevronRight, List, Play } from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";

export default function WebtoonDetail({ slug }: { slug: string }) {
  const input = useMemo(() => ({ slug }), [slug]);
  const { data, isLoading, error } = trpc.webtoons.detail.useQuery(input);
  if (isLoading) return <div className="detail-page"><PublicHeader backTo="/" /><main className="container detail-loading">작품을 불러오는 중입니다.</main></div>;
  if (error || !data) return <div className="detail-page"><PublicHeader backTo="/" /><main className="container detail-loading">요청하신 작품을 찾을 수 없습니다.</main></div>;
  const firstEpisode = data.episodes[0];
  return (
    <div className="detail-page public-page">
      <PublicHeader backTo="/" />
      <main className="container">
        <section className="detail-hero">
          <div className="detail-hero__cover"><WebtoonCover src={data.work.thumbnailUrl} title={data.work.title} genre={data.work.genre} /></div>
          <div className="detail-hero__content">
            <p className="eyebrow eyebrow--dark">{data.work.genre}</p>
            <h1>{data.work.title}</h1>
            <p className="detail-description">{data.work.description}</p>
            <div className="detail-hero__actions">
              {firstEpisode ? <Link href={`/webtoon/${slug}/episode/${firstEpisode.episodeNumber}`} className="read-button"><Play size={16} fill="currentColor" />첫 화부터 보기</Link> : <Button disabled>연재 준비 중</Button>}
              <span><BookOpen size={16} />전체 {data.episodes.length}화</span>
            </div>
          </div>
          <div className="detail-ornament" aria-hidden="true">M</div>
        </section>
        <section className="episode-section">
          <div className="episode-section__heading"><div><p className="eyebrow eyebrow--dark">EPISODES</p><h2>회차 목록</h2></div><span>모든 회차 무료</span></div>
          {data.episodes.length ? <ol className="episode-list">{[...data.episodes].reverse().map(episode => <li key={episode.id}><Link href={`/webtoon/${slug}/episode/${episode.episodeNumber}`}><span className="episode-list__number">{String(episode.episodeNumber).padStart(2, "0")}</span><span className="episode-list__title">{episode.title}</span><span className="episode-list__date">{new Date(episode.publishedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}</span><ChevronRight size={19} /></Link></li>)}</ol> : <div className="empty-episodes"><List size={25} /><p>공개된 회차가 아직 없습니다.</p></div>}
        </section>
      </main>
    </div>
  );
}

