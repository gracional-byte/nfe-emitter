import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import EmitRps from "./pages/EmitRps";
import InvoiceHistory from "./pages/InvoiceHistory";
import Settings from "./pages/Settings";
import CodeEditor from "./pages/CodeEditor";
import { History } from "./pages/History";
import { useAuth } from "@/_core/hooks/useAuth";

function Router() {
  const { user } = useAuth();
  
  // Verifica se o usuário é admin
  const isAdmin = user?.role === 'admin';

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      {isAdmin && <Route path="/emit" component={EmitRps} />}
      {isAdmin && <Route path="/history" component={History} />}
      {isAdmin && <Route path="/settings" component={Settings} />}
      {isAdmin && <Route path="/editor" component={CodeEditor} />}
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
