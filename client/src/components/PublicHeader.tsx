import { Link, useLocation } from "wouter";
import { ChevronLeft, Menu, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

const operatorEmail = "idopublishingcompan@gmail.com";

export default function PublicHeader({ backTo }: { backTo?: string }) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === operatorEmail;
  return (
    <header className="public-header">
      <div className="public-header__inner">
        {backTo ? (
          <button className="icon-button" onClick={() => setLocation(backTo)} aria-label="이전으로 이동"><ChevronLeft size={20} /></button>
        ) : (
          <Link href="/" className="brand-mark" aria-label="명작무료웹툰 홈"><span className="brand-mark__dot" />명작무료웹툰</Link>
        )}
        {backTo && <Link href="/" className="brand-mark brand-mark--center"><span className="brand-mark__dot" />명작무료웹툰</Link>}
        <nav className="public-nav" aria-label="주요 메뉴">
          <Link href="/" className="public-nav__link">작품 둘러보기</Link>
          {isAuthenticated ? <span className="member-status">{user?.name || "회원"}</span> : <button className="member-link" onClick={() => startLogin()}>회원가입 · 로그인</button>}
          {isAdmin ? <Link href="/admin" className="admin-link"><ShieldCheck size={15} />운영</Link> : <button className="admin-link" onClick={() => startLogin("/admin")}><ShieldCheck size={15} />운영자 로그인</button>}
        </nav>
        <button className="icon-button mobile-menu" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      </div>
      {menuOpen && <nav className="mobile-nav-panel" aria-label="모바일 메뉴"><Link href="/" onClick={() => setMenuOpen(false)}>작품 둘러보기</Link>{isAuthenticated ? <span>{user?.name || "회원"}님</span> : <button onClick={() => startLogin()}>회원가입 · 로그인</button>}{isAdmin ? <Link href="/admin" onClick={() => setMenuOpen(false)}>운영</Link> : <button onClick={() => { setMenuOpen(false); startLogin("/admin"); }}>운영자 로그인</button>}</nav>}
    </header>
  );
}
