import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Login() {
  const { signIn, signUp, loading: authLoading } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const next = new URLSearchParams(window.location.search).get("next");
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        toast.success("로그인했습니다.");
        setLocation(nextPath);
      } else {
        const result = await signUp(email, password);
        toast.success(result.confirmationRequired ? "확인 이메일을 보냈습니다. 이메일 인증 후 로그인해 주세요." : "회원가입이 완료되었습니다.");
        if (!result.confirmationRequired) setLocation(nextPath);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "인증 처리 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  };

  return <main className="auth-page">
    <Link href="/" className="auth-back"><ArrowLeft size={17} />무료 웹툰으로 돌아가기</Link>
    <section className="auth-card">
      <div className="auth-mark"><Sparkles size={18} />명작무료웹툰</div>
      <p className="eyebrow eyebrow--dark">OPTIONAL MEMBERSHIP</p>
      <h1>{mode === "login" ? "다시 만나서 반갑습니다." : "이야기를 더 가까이 만나세요."}</h1>
      <p className="auth-card__intro">회원가입 없이 모든 웹툰을 무료로 읽을 수 있습니다. 회원은 추후 개인화 기능과 소식 알림을 이용할 수 있습니다.</p>
      <div className="auth-tabs" role="tablist"><button type="button" className={mode === "login" ? "auth-tabs__active" : ""} onClick={() => setMode("login")}>로그인</button><button type="button" className={mode === "signup" ? "auth-tabs__active" : ""} onClick={() => setMode("signup")}>회원가입</button></div>
      <form onSubmit={submit} className="auth-form">
        <div><Label htmlFor="member-email">이메일</Label><Input id="member-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div>
        <div><Label htmlFor="member-password">비밀번호</Label><Input id="member-password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /><p>8자 이상 입력해 주세요.</p></div>
        <Button type="submit" disabled={pending || authLoading}>{pending ? <Loader2 className="animate-spin" size={17} /> : null}{mode === "login" ? "로그인" : "무료 회원가입"}</Button>
      </form>
    </section>
  </main>;
}
