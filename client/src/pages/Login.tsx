import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup" | "request-reset" | "set-password";

export default function Login() {
  const { signIn, signUp, requestPasswordReset, updatePassword, loading: authLoading } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const hasRecoveryToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery";
  const [mode, setMode] = useState<AuthMode>(hasRecoveryToken ? "set-password" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const next = new URLSearchParams(window.location.search).get("next");
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("set-password");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        toast.success("로그인했습니다.");
        setLocation(nextPath);
      } else if (mode === "signup") {
        const result = await signUp(email, password);
        toast.success(result.confirmationRequired ? "확인 이메일을 보냈습니다. 이메일 인증 후 로그인해 주세요." : "회원가입이 완료되었습니다.");
        if (!result.confirmationRequired) setLocation(nextPath);
      } else if (mode === "request-reset") {
        await requestPasswordReset(email);
        toast.success("가입된 이메일이라면 비밀번호 재설정 링크를 보냈습니다. 받은메일함과 스팸함을 확인해 주세요.");
        setMode("login");
      } else {
        if (password !== passwordConfirmation) throw new Error("새 비밀번호가 서로 일치하지 않습니다.");
        await updatePassword(password);
        toast.success("새 비밀번호를 설정했습니다. 이제 로그인할 수 있습니다.");
        setPassword("");
        setPasswordConfirmation("");
        setMode("login");
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
      <p className="eyebrow eyebrow--dark">{mode === "set-password" ? "PASSWORD RECOVERY" : "OPTIONAL MEMBERSHIP"}</p>
      <h1>{mode === "login" ? "다시 만나서 반갑습니다." : mode === "signup" ? "이야기를 더 가까이 만나세요." : mode === "request-reset" ? "비밀번호를 재설정합니다." : "새 비밀번호를 설정하세요."}</h1>
      <p className="auth-card__intro">{mode === "request-reset" ? "가입한 이메일을 입력하면 안전한 비밀번호 재설정 링크를 보내 드립니다." : mode === "set-password" ? "이메일로 받은 안전한 링크를 확인했습니다. 새 비밀번호를 입력해 주세요." : "회원가입 없이 모든 웹툰을 무료로 읽을 수 있습니다. 회원은 추후 개인화 기능과 소식 알림을 이용할 수 있습니다."}</p>
      {mode === "login" || mode === "signup" ? <div className="auth-tabs" role="tablist"><button type="button" className={mode === "login" ? "auth-tabs__active" : ""} onClick={() => setMode("login")}>로그인</button><button type="button" className={mode === "signup" ? "auth-tabs__active" : ""} onClick={() => setMode("signup")}>회원가입</button></div> : null}
      <form onSubmit={submit} className="auth-form">
        {mode !== "set-password" ? <div><Label htmlFor="member-email">이메일</Label><Input id="member-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></div> : null}
        {mode !== "request-reset" ? <div><Label htmlFor="member-password">{mode === "set-password" ? "새 비밀번호" : "비밀번호"}</Label><Input id="member-password" type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /><p>8자 이상 입력해 주세요.</p></div> : null}
        {mode === "set-password" ? <div><Label htmlFor="member-password-confirmation">새 비밀번호 확인</Label><Input id="member-password-confirmation" type="password" value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} minLength={8} autoComplete="new-password" required /></div> : null}
        <Button type="submit" disabled={pending || authLoading}>{pending ? <Loader2 className="animate-spin" size={17} /> : null}{mode === "login" ? "로그인" : mode === "signup" ? "무료 회원가입" : mode === "request-reset" ? "재설정 메일 보내기" : "새 비밀번호 저장"}</Button>
        {mode === "login" ? <button type="button" className="auth-text-button" onClick={() => setMode("request-reset")}>비밀번호를 잊으셨나요?</button> : mode === "request-reset" ? <button type="button" className="auth-text-button" onClick={() => setMode("login")}>로그인으로 돌아가기</button> : null}
      </form>
    </section>
  </main>;
}
