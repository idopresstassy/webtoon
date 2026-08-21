import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Activity, BarChart3, BookOpen, ChartNoAxesCombined, Eye, UsersRound } from "lucide-react";

const operatorEmail = "idopublishingcompan@gmail.com";

export default function AdminDashboard() {
  return <DashboardLayout><AdminDashboardContent /></DashboardLayout>;
}

function AdminDashboardContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === operatorEmail;
  const { data, isLoading, error, refetch } = trpc.analytics.dashboard.useQuery(undefined, { enabled: isAdmin });
  if (!isAdmin) return <div className="admin-denied"><Activity size={34} /><h1>관리자 전용 화면입니다.</h1><p>승인된 운영자 계정으로 로그인한 뒤 다시 시도해 주세요.</p></div>;
  if (isLoading) return <div className="dashboard-loading">운영 통계를 불러오는 중입니다.</div>;
  if (error || !data) return <div className="dashboard-loading"><Activity size={26} /><p>운영 통계를 불러오지 못했습니다.</p><Button variant="outline" size="sm" onClick={() => void refetch()}>다시 불러오기</Button></div>;
  const dashboard = { ...data, dailyViews: data.dailyViews ?? [], topEpisodes: data.topEpisodes ?? [], topWorks: data.topWorks ?? [] };
  const maxViews = Math.max(...dashboard.dailyViews.map(item => item.views), 1);
  return <div className="admin-page dashboard-page">
    <div className="admin-page__heading"><div><p className="eyebrow eyebrow--dark">OPERATING OVERVIEW</p><h1>운영 현황</h1><p>회원과 독자의 실제 이용 흐름을 한눈에 확인하세요.</p></div><div className="overview-badge"><span>최근 14일 기준</span><ChartNoAxesCombined size={19} /></div></div>
    <section className="metric-grid" aria-label="운영 핵심 지표">
      <article><span className="metric-icon"><UsersRound size={19} /></span><p>전체 회원</p><strong>{dashboard.totalMembers.toLocaleString("ko-KR")}</strong><small>최근 30일 신규 {dashboard.newMembers.toLocaleString("ko-KR")}명</small></article>
      <article><span className="metric-icon"><Eye size={19} /></span><p>누적 회차 열람</p><strong>{dashboard.totalViews.toLocaleString("ko-KR")}</strong><small>회차 화면을 연 열람 기록</small></article>
      <article><span className="metric-icon"><Activity size={19} /></span><p>최근 14일 독자</p><strong>{dashboard.activeVisitors.toLocaleString("ko-KR")}</strong><small>중복을 제외한 기기 기준</small></article>
      <article><span className="metric-icon"><BookOpen size={19} /></span><p>등록 작품</p><strong>{dashboard.topEpisodes.length ? "운영 중" : "준비 중"}</strong><small>작품·회차 관리에서 등록하세요</small></article>
    </section>
    <section className="analytics-grid">
      <article className="analytics-panel views-panel"><div className="panel-heading"><div><p className="eyebrow eyebrow--dark">READING TREND</p><h2>최근 14일 열람</h2></div><span>실제 기록만 표시</span></div><div className="bar-chart">{dashboard.dailyViews.map(item => <div key={item.date} className="bar-chart__item"><span className="bar-chart__value">{item.views || ""}</span><div className="bar-chart__track"><i style={{ height: `${Math.max((item.views / maxViews) * 100, item.views ? 5 : 1)}%` }} /></div><small>{item.date.slice(5).replace("-", ".")}</small></div>)}</div></article>
      <article className="analytics-panel popular-panel"><div className="panel-heading"><div><p className="eyebrow eyebrow--dark">POPULAR EPISODES</p><h2>많이 읽은 회차</h2></div><span>최근 14일</span></div>{dashboard.topEpisodes.length ? <ol className="popular-list">{dashboard.topEpisodes.map((episode, index) => <li key={episode.episodeId}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{episode.workTitle}</strong><span>{episode.episodeNumber}화 · {episode.episodeTitle}</span></div><em>{episode.views.toLocaleString("ko-KR")} 열람</em></li>)}</ol> : <div className="analytics-empty"><BarChart3 size={25} /><p>독자가 회차를 감상하면 이곳에 실제 열람 현황이 표시됩니다.</p></div>}</article>
    </section>
    <section className="analytics-panel work-panel"><div className="panel-heading"><div><p className="eyebrow eyebrow--dark">POPULAR WORKS</p><h2>작품별 열람 현황</h2></div><span>최근 14일</span></div>{dashboard.topWorks.length ? <ol className="work-list">{dashboard.topWorks.map((work, index) => <li key={work.workId}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{work.workTitle}</strong><span>{work.genre}</span></div><em>{work.views.toLocaleString("ko-KR")} 열람</em></li>)}</ol> : <div className="analytics-empty"><BookOpen size={25} /><p>공개된 작품의 회차를 감상하면 작품별 열람 현황이 표시됩니다.</p></div>}</section>
  </div>;
}
