import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages
import Auth from "./pages/Auth";
import Assets from "./pages/Assets";
import Connections from "./pages/Connections";
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
    // Redirect to assets (campaign-first flow)
    return <Navigate to="/assets" replace />;
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

          {/* Protected dashboard routes - campaign-first flow */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/assets" element={<Assets />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/launch" element={<Launch />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/recovery" element={<Recovery />} />
            <Route path="/history" element={<History />} />
            {/* Redirect old routes */}
            <Route path="/dashboard" element={<Navigate to="/assets" replace />} />
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
