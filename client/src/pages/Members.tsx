import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { listAdminMembers } from "@/lib/adminRepository";
import { ShieldAlert, UserRoundCheck, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const operatorEmail = "idopublishingcompan@gmail.com";

export default function Members() { return <DashboardLayout><MemberContent /></DashboardLayout>; }

function MemberContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === operatorEmail;
  const { data: members = [], isLoading, isError } = useQuery({ queryKey: ["supabase", "admin", "members"], queryFn: listAdminMembers, enabled: isAdmin });
  if (!isAdmin) return <div className="admin-denied"><ShieldAlert size={34} /><h1>관리자 전용 화면입니다.</h1><p>승인된 운영자 계정으로 로그인한 뒤 다시 시도해 주세요.</p></div>;
  return <div className="admin-page members-page">
    <div className="admin-page__heading"><div><p className="eyebrow eyebrow--dark">MEMBER DIRECTORY</p><h1>회원 관리</h1><p>회원가입·로그인을 선택한 독자와 운영 계정의 현황을 확인합니다.</p></div><div className="overview-badge"><UsersRound size={19} /><span>{members.length.toLocaleString("ko-KR")}명</span></div></div>
    <section className="members-note"><UserRoundCheck size={19} /><p><strong>웹툰 감상은 회원가입 없이 무료</strong>입니다. 이 목록에는 회원가입 또는 로그인을 직접 선택한 계정만 표시됩니다.</p></section>
    <section className="member-table-wrap">{isLoading ? <div className="dashboard-loading">회원 정보를 불러오는 중입니다.</div> : isError ? <div className="analytics-empty"><UsersRound size={25} /><p>회원 정보를 불러오지 못했습니다. 운영자 계정으로 다시 로그인해 주세요.</p></div> : members.length ? <table className="member-table"><thead><tr><th>회원</th><th>로그인 수단</th><th>역할</th><th>가입일</th><th>최근 로그인</th></tr></thead><tbody>{members.map(member => <tr key={member.id}><td><strong>{member.name || "이름 없음"}</strong><span>{member.email || "이메일 정보 없음"}</span></td><td>이메일</td><td><mark className={member.role === "admin" ? "role-pill role-pill--admin" : "role-pill"}>{member.role === "admin" ? "운영자" : "회원"}</mark></td><td>{new Date(member.createdAt).toLocaleDateString("ko-KR")}</td><td>{member.lastSignedInAt ? new Date(member.lastSignedInAt).toLocaleDateString("ko-KR") : "기록 없음"}</td></tr>)}</tbody></table> : <div className="analytics-empty"><UsersRound size={25} /><p>아직 가입·로그인을 선택한 회원이 없습니다.</p></div>}</section>
  </div>;
}
