import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Incidents from "./pages/Incidents";
import CrimePrediction from "./pages/CrimePrediction";
import RiskScoring from "./pages/RiskScoring";
import Heatmap from "./pages/Heatmap";
import Patrol from "./pages/Patrol";
import CitizenPortal from "./pages/CitizenPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/prediction" element={<CrimePrediction />} />
          <Route path="/risk-scoring" element={<RiskScoring />} />
          <Route path="/heatmap" element={<Heatmap />} />
          <Route path="/patrol" element={<Patrol />} />
          <Route path="/citizen" element={<CitizenPortal />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
