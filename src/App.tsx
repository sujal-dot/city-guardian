import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Incidents from "./pages/Incidents";
import CrimePrediction from "./pages/CrimePrediction";
import RiskScoring from "./pages/RiskScoring";
import Heatmap from "./pages/Heatmap";
import Patrol from "./pages/Patrol";
import CitizenPortal from "./pages/CitizenPortal";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import RoleManagement from "./pages/RoleManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Landing page - routes based on role */}
            <Route path="/landing" element={<Landing />} />
            
            {/* Protected routes - Police/Admin only */}
            <Route path="/" element={
              <ProtectedRoute requiredRoles={['police', 'admin']}>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/incidents" element={
              <ProtectedRoute requiredRoles={['police', 'admin']}>
                <Incidents />
              </ProtectedRoute>
            } />
            <Route path="/prediction" element={
              <ProtectedRoute requiredRoles={['police', 'admin']}>
                <CrimePrediction />
              </ProtectedRoute>
            } />
            <Route path="/risk-scoring" element={
              <ProtectedRoute requiredRoles={['police', 'admin']}>
                <RiskScoring />
              </ProtectedRoute>
            } />
            <Route path="/heatmap" element={
              <ProtectedRoute requiredRoles={['police', 'admin']}>
                <Heatmap />
              </ProtectedRoute>
            } />
            <Route path="/patrol" element={
              <ProtectedRoute requiredRoles={['police', 'admin']}>
                <Patrol />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requiredRoles={['police', 'admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/role-management" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <RoleManagement />
              </ProtectedRoute>
            } />
            
            {/* Protected routes - Authenticated users */}
            <Route path="/citizen" element={
              <ProtectedRoute>
                <CitizenPortal />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
