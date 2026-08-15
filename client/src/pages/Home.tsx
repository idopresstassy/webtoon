import PublicHeader from "@/components/PublicHeader";
import WebtoonCover from "@/components/WebtoonCover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

export default function Home() {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("전체");
  const { isAuthenticated } = useAuth();
  const listInput = useMemo(() => ({ search: search.trim() || undefined, genre: genre === "전체" ? undefined : genre }), [search, genre]);
  const { data: works, isLoading } = trpc.webtoons.list.useQuery(listInput);
  const { data: genres = [] } = trpc.webtoons.genres.useQuery();
  const hasFilters = Boolean(search.trim()) || genre !== "전체";

  return (
    <div className="public-page home-page">
      <PublicHeader />
      <main>
        <section className="hero-section">
          <div className="hero-art" aria-hidden="true"><img src="/manus-storage/ink-painting-hero_48f08ddb.jpg" alt="" /></div>
          <div className="hero-content container">
            <div className="eyebrow"><Sparkles size={14} />FREE TO READ · ALWAYS</div>
            <p className="hero-kicker">한 편의 이야기로 완성되는 하루.</p>
            <h1>읽을수록 깊어지는<br /><em>명작의 시간</em></h1>
            <p className="hero-copy">누구나, 어디서나, 로그인 없이. 좋은 이야기를 위한 가장 단정한 자리입니다.</p>
            <a className="hero-scroll" href="#collection">무료 작품 둘러보기 <ArrowRight size={17} /></a>
          </div>
          <div className="hero-index" aria-hidden="true">01&nbsp;&nbsp; / &nbsp;&nbsp;COLLECTION</div>
        </section>

        <section className="collection-section container" id="collection">
          <aside className="ai-disclosure" role="note" aria-label="AI 활용 제작 안내">
            <Sparkles size={18} aria-hidden="true" />
            <div><p>AI-ASSISTED CREATION · FREE CLASSICS PROJECT</p><strong>한국 명작을 더 많은 독자에게 무료로 전하기 위해, AI를 창작 도구로 활용합니다.</strong><span>고전을 전면 제작하는 데에는 많은 시간과 비용이 필요합니다. 이 프로젝트는 그 현실적 제약 속에서도 한국의 좋은 이야기를 무료로 소개하기 위해 AI 기술을 활용합니다.</span></div>
          </aside>
          <div className="section-heading">
            <div><p className="eyebrow eyebrow--dark">OUR COLLECTION</p><h2>무료 웹툰 작품</h2></div>
            <p>새롭게 업데이트되는 작품을<br className="desktop-only" /> 자유롭게 감상하세요.</p>
          </div>
          <div className="discovery-bar">
            <div className="genre-pills" role="group" aria-label="장르 선택">
              {["전체", ...genres].map(item => <button key={item} onClick={() => setGenre(item)} className={genre === item ? "genre-pill genre-pill--active" : "genre-pill"}>{item}</button>)}
            </div>
            <label className="search-field"><Search size={18} /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="제목 또는 소개글 검색" aria-label="작품 검색" /></label>
          </div>

          {isLoading ? <div className="loading-grid">{Array.from({ length: 6 }).map((_, index) => <div className="cover-skeleton" key={index} />)}</div> : works?.length ? (
            <div className="work-grid">
              {works.map((work, index) => (
                <Link key={work.id} href={`/webtoon/${work.slug}`} className="work-card">
                  <div className="work-card__cover"><WebtoonCover src={work.thumbnailUrl} title={work.title} genre={work.genre} /><span className="work-card__number">{String(index + 1).padStart(2, "0")}</span></div>
                  <div className="work-card__meta"><span>{work.genre}</span><span>{work.latestEpisode ? `최신 ${work.latestEpisode.episodeNumber}화` : "연재 준비 중"}</span></div>
                  <h3>{work.title}</h3>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-collection">
              <div className="empty-collection__symbol">M</div>
              <h3>{hasFilters ? "조건에 맞는 작품이 없습니다." : "첫 번째 명작을 준비하고 있습니다."}</h3>
              <p>{hasFilters ? "검색어나 장르를 바꾸어 다시 찾아보세요." : "관리자 화면에서 작품과 회차를 등록하면 이곳에 공개됩니다."}</p>
              {hasFilters ? <Button variant="outline" onClick={() => { setSearch(""); setGenre("전체"); }}>필터 초기화</Button> : <Link href="/admin" className="text-link">운영 화면으로 이동 <ArrowRight size={15} /></Link>}
            </div>
          )}
          {!isAuthenticated && <aside className="member-invitation"><div><p className="eyebrow eyebrow--dark">OPTIONAL MEMBERSHIP</p><h3>좋은 이야기를<br />더 가까이에서 만나세요.</h3><p>감상은 가입 없이 계속 가능합니다. 가입하면 앞으로 제공될 소식과 개인화 기능을 편리하게 이용할 수 있습니다.</p></div><Button onClick={() => startLogin()}>무료 회원가입 · 로그인</Button></aside>}
        </section>
      </main>
      <footer className="public-footer"><div className="container"><span className="brand-mark"><span className="brand-mark__dot" />명작무료웹툰</span><p>좋은 이야기는 누구에게나 열려 있어야 합니다.</p></div></footer>
    </div>
  );
}
