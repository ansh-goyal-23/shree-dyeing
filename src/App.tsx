import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import LotList from "@/pages/LotList";
import CreateLot from "@/pages/CreateLot";
import LotDetail from "@/pages/LotDetail";
import MasterData from "@/pages/MasterData";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/lots" element={<LotList />} />
              <Route path="/lots/create" element={<CreateLot />} />
              <Route path="/lots/:lotNo" element={<LotDetail />} />
              <Route path="/master" element={<MasterData />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
