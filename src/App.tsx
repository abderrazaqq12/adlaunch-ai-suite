import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import Connections from "./pages/Connections";
import Launch from "./pages/Launch";
import Execution from "./pages/Execution";
import Rules from "./pages/Rules";
import Monitoring from "./pages/Monitoring";
import Recovery from "./pages/Recovery";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import OAuthSuccess from "./pages/OAuthSuccess";
import OAuthError from "./pages/OAuthError";
import PendingApproval from "./pages/PendingApproval";

// Public Pages
import { PublicLayout } from "./components/public/PublicLayout";
import Landing from "./pages/public/Landing";
import About from "./pages/public/About";
import Privacy from "./pages/public/Privacy";
import Terms from "./pages/public/Terms";
import Contact from "./pages/public/Contact";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useProjectStore();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isApproved } = useProjectStore();

  if (user) {
    // Check if user is approved
    if (!isApproved) {
      return <Navigate to="/pending-approval" replace />;
    }
    // Redirect to dashboard (new entry point)
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Wrapper that checks if user is approved before allowing access
function ApprovedRoute({ children }: { children: React.ReactNode }) {
  const { user, isApproved } = useProjectStore();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public marketing pages */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
          </Route>

          {/* Auth route */}
          <Route
            path="/auth"
            element={
              <AuthRoute>
                <Auth />
              </AuthRoute>
            }
          />

          {/* Pending approval page */}
          <Route path="/pending-approval" element={<PendingApproval />} />

          {/* OAuth callback routes - outside protected area */}
          <Route path="/oauth-success" element={<OAuthSuccess />} />
          <Route path="/oauth-error" element={<OAuthError />} />

          {/* Protected dashboard routes - requires approval */}
          <Route
            element={
              <ApprovedRoute>
                <DashboardLayout />
              </ApprovedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/launch" element={<Launch />} />
            <Route path="/execution" element={<Execution />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/settings" element={<Settings />} />
            {/* Redirect old routes */}
            <Route path="/history" element={<Navigate to="/execution" replace />} />
            <Route path="/analyze" element={<Navigate to="/assets" replace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
