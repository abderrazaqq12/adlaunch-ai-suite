import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages
import Auth from "./pages/Auth";
import NewProject from "./pages/NewProject";
import Dashboard from "./pages/Dashboard";
import Connections from "./pages/Connections";
import Assets from "./pages/Assets";
import Analysis from "./pages/Analysis";
import Launch from "./pages/Launch";
import Rules from "./pages/Rules";
import Monitoring from "./pages/Monitoring";
import Recovery from "./pages/Recovery";
import History from "./pages/History";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useProjectStore();
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user } = useProjectStore();
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
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
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route
            path="/auth"
            element={
              <AuthRoute>
                <Auth />
              </AuthRoute>
            }
          />
          <Route
            path="/projects/new"
            element={
              <ProtectedRoute>
                <NewProject />
              </ProtectedRoute>
            }
          />

          {/* Protected dashboard routes */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/analyze" element={<Analysis />} />
            <Route path="/launch" element={<Launch />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/history" element={<History />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
