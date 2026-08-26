import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";
import AdminDashboard from "@/pages/AdminDashboard";
import Home from "@/pages/Home";
import Members from "@/pages/Members";
import Viewer from "@/pages/Viewer";
import WebtoonDetail from "@/pages/WebtoonDetail";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SupabaseAuthProvider } from "./contexts/SupabaseAuthContext";
import Login from "./pages/Login";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/webtoon/:slug/episode/:episodeNumber">{params => <Viewer slug={params.slug} episodeNumber={Number(params.episodeNumber)} />}</Route>
    <Route path="/webtoon/:slug">{params => <WebtoonDetail slug={params.slug} />}</Route>
    <Route path="/admin" component={AdminDashboard} />
    <Route path="/admin/content" component={Admin} />
    <Route path="/admin/members" component={Members} />
    <Route path="/login" component={Login} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><SupabaseAuthProvider><TooltipProvider><Toaster /><Router /></TooltipProvider></SupabaseAuthProvider></ThemeProvider></ErrorBoundary>;
}
