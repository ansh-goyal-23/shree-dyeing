import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { RoleProvider } from "@/context/RoleContext";
import ViewerGuard from "@/components/ViewerGuard";
import EditorGuard from "@/components/EditorGuard";
import WriteRoute from "@/components/WriteRoute";
import AdminRoute from "@/components/AdminRoute";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LotList from "@/pages/LotList";
import CreateLot from "@/pages/CreateLot";
import LotDetail from "@/pages/LotDetail";
import CompareLots from "@/pages/CompareLots";
import MasterData from "@/pages/MasterData";
import PlaceholderModule from "@/pages/PlaceholderModule";
import ChallanList from "@/pages/ChallanList";
import CreateChallan from "@/pages/CreateChallan";
import ClientRateMaster from "@/pages/ClientRateMaster";
import ChallanDetail from "@/pages/ChallanDetail";
import OilConsumptionReport from "@/pages/OilConsumptionReport";
import IntakeList from "@/pages/IntakeList";
import CreateIntake from "@/pages/CreateIntake";
import IntakeDetail from "@/pages/IntakeDetail";
import CreateDirectOrder from "@/pages/CreateDirectOrder";
import ExpenseList from "@/pages/ExpenseList";
import ExpenseCreatePage from "@/pages/CreateExpense";
import ItemMaster from "@/pages/ItemMaster";
import UserManagement from "@/pages/UserManagement";
import StoreDashboard from "@/pages/store/StoreDashboard";
import StoreItemMaster from "@/pages/store/StoreItemMaster";
import StoreComingSoon from "@/pages/store/StoreComingSoon";
import StoreInwardList from "@/pages/store/StoreInwardList";
import StoreInwardCreate from "@/pages/store/StoreInwardCreate";
import StoreIssueList from "@/pages/store/StoreIssueList";
import StoreIssueForm from "@/pages/store/StoreIssueForm";
import StoreFinishedGoodsList from "@/pages/store/StoreFinishedGoodsList";
import StoreFinishedGoodsReceive from "@/pages/store/StoreFinishedGoodsReceive";
import StoreExternalDyedYarnList from "@/pages/store/StoreExternalDyedYarnList";
import StoreExternalDyedYarnReceive from "@/pages/store/StoreExternalDyedYarnReceive";
import StoreAssetManagement from "@/pages/store/StoreAssetManagement";
import StoreCurrentStock from "@/pages/store/StoreCurrentStock";
import StoreVerificationList from "@/pages/store/StoreVerificationList";
import StoreVerificationDetail from "@/pages/store/StoreVerificationDetail";
import StoreStockLedger from "@/pages/store/StoreStockLedger";
import StoreInventoryTimeline from "@/pages/store/StoreInventoryTimeline";
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
                <RoleProvider>
                  <AppProvider>
                    <ViewerGuard />
                    <EditorGuard />
                    <Layout>
                      <Routes>
                        <Route path="/shade-management" element={<Dashboard />} />
                        <Route path="/shade-management/lots" element={<LotList />} />
                        <Route path="/shade-management/lots/create" element={<WriteRoute redirectTo="/shade-management/lots"><CreateLot /></WriteRoute>} />
                        <Route path="/shade-management/compare" element={<CompareLots />} />
                        <Route path="/shade-management/lots/:lotNo" element={<LotDetail />} />
                        <Route path="/shade-management/master" element={<MasterData />} />
                        <Route path="/sampling" element={<IntakeList />} />
                        <Route path="/sampling/create" element={<WriteRoute redirectTo="/sampling"><CreateIntake /></WriteRoute>} />
                        <Route path="/sampling/order/create" element={<WriteRoute redirectTo="/sampling"><CreateDirectOrder /></WriteRoute>} />
                        <Route path="/sampling/:id" element={<IntakeDetail />} />
                        <Route path="/production" element={<PlaceholderModule />} />
                        <Route path="/expenses" element={<ExpenseList />} />
                        <Route path="/expenses/create" element={<WriteRoute redirectTo="/expenses"><ExpenseCreatePage /></WriteRoute>} />
                        <Route path="/dispatch" element={<ChallanList />} />
                        <Route path="/dispatch/create" element={<WriteRoute redirectTo="/dispatch"><CreateChallan /></WriteRoute>} />
                        <Route path="/dispatch/client-rates" element={<ClientRateMaster />} />
                        <Route path="/dispatch/oil-consumption" element={<OilConsumptionReport />} />
                        <Route path="/dispatch/:id" element={<ChallanDetail />} />
                        <Route path="/item-master" element={<ItemMaster />} />
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/store" element={<StoreDashboard />} />
                        <Route path="/store/items" element={<StoreItemMaster />} />
                        <Route path="/store/stock-inward" element={<StoreInwardList />} />
                        <Route path="/store/stock-inward/create" element={<WriteRoute redirectTo="/store/stock-inward"><StoreInwardCreate /></WriteRoute>} />
                        <Route path="/store/internal-issues" element={<StoreIssueList />} />
                        <Route path="/store/internal-issues/create" element={<WriteRoute redirectTo="/store/internal-issues"><StoreIssueForm mode="create" /></WriteRoute>} />
                        <Route path="/store/internal-issues/:id/edit" element={<WriteRoute redirectTo="/store/internal-issues"><StoreIssueForm mode="edit" /></WriteRoute>} />
                        <Route path="/store/finished-goods" element={<StoreFinishedGoodsList />} />
                        <Route path="/store/finished-goods/receive" element={<WriteRoute redirectTo="/store/finished-goods"><StoreFinishedGoodsReceive /></WriteRoute>} />
                        <Route path="/store/external-dyed-yarn" element={<StoreExternalDyedYarnList />} />
                        <Route path="/store/external-dyed-yarn/receive" element={<WriteRoute redirectTo="/store/external-dyed-yarn"><StoreExternalDyedYarnReceive /></WriteRoute>} />
                        <Route path="/store/assets" element={<StoreAssetManagement />} />
                        <Route path="/store/current-stock" element={<StoreCurrentStock />} />
                        <Route path="/store/stock-verification" element={<StoreVerificationList />} />
                        <Route path="/store/stock-verification/:id" element={<StoreVerificationDetail />} />
                        <Route path="/store/stock-ledger" element={<StoreStockLedger />} />
                        <Route path="/store/timeline" element={<StoreInventoryTimeline />} />
                        <Route path="/store/timeline/:itemId" element={<StoreInventoryTimeline />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Layout>
                  </AppProvider>
                </RoleProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
