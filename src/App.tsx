import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AreaProvider } from "@/hooks/useArea";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Progress from "./pages/Progress";
import LernAI from "./pages/LernAI";
import Notes from "./pages/Notes";
import Mindmaps from "./pages/Mindmaps";
import MindmapEditor from "./pages/MindmapEditor";
import GradeCalculator from "./pages/GradeCalculator";
import Settings from "./pages/Settings";
import CalendarPage from "./pages/CalendarPage";
import LinksPage from "./pages/LinksPage";
import HaushaltsAI from "./pages/HaushaltsAI";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AreaProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/aufgaben" element={<Tasks />} />
              <Route path="/fortschritt" element={<Progress />} />
              <Route path="/kalender" element={<CalendarPage />} />
              <Route path="/notenberechnung" element={<GradeCalculator />} />
              <Route path="/lern-ai" element={<LernAI />} />
              <Route path="/notizen" element={<Notes />} />
              <Route path="/mindmaps" element={<Mindmaps />} />
              <Route path="/mindmaps/:id" element={<MindmapEditor />} />
              <Route path="/links" element={<LinksPage />} />
              <Route path="/haushalts-ai" element={<HaushaltsAI />} />
              <Route path="/einstellungen" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AreaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
