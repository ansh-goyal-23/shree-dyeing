import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LotList from "@/pages/LotList";
import CreateLot from "@/pages/CreateLot";
import LotDetail from "@/pages/LotDetail";
import MasterData from "@/pages/MasterData";
import PlaceholderModule from "@/pages/PlaceholderModule";
import IntakeList from "@/pages/IntakeList";
import CreateIntake from "@/pages/CreateIntake";
import IntakeDetail from "@/pages/IntakeDetail";
import CreateDirectOrder from "@/pages/CreateDirectOrder";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (user) return <Navigate to="/shade-management" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/" element={<Navigate to="/shade-management" replace />} />
            <Route path="*" element={
              <ProtectedRoute>
                <AppProvider>
                  <Layout>
                    <Routes>
                      <Route path="/shade-management" element={<Dashboard />} />
                      <Route path="/shade-management/lots" element={<LotList />} />
                      <Route path="/shade-management/lots/create" element={<CreateLot />} />
                      <Route path="/shade-management/lots/:lotNo" element={<LotDetail />} />
                      <Route path="/shade-management/master" element={<MasterData />} />
                      <Route path="/sampling" element={<IntakeList />} />
                      <Route path="/sampling/create" element={<CreateIntake />} />
                      <Route path="/sampling/:id" element={<IntakeDetail />} />
                      <Route path="/production" element={<PlaceholderModule />} />
                      <Route path="/expenses" element={<PlaceholderModule />} />
                      <Route path="/dispatch" element={<PlaceholderModule />} />
                      <Route path="/inventory" element={<PlaceholderModule />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                </AppProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
