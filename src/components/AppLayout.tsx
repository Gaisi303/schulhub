import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MealBanner } from "./MealBanner";
import { ImportantBanner } from "./ImportantBanner";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, GraduationCap, Home } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useArea } from "@/hooks/useArea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { user, loading } = useAuth();
  const { area, toggle: toggleArea } = useArea();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate("/auth", { replace: true });
      setChecked(true);
    }
  }, [user, loading, navigate]);

  if (loading || !checked || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse-glow rounded-full bg-gradient-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Bis bald! 👋");
    navigate("/auth", { replace: true });
  };

  const isPrivate = area === "private";

  const handleAreaSwitch = () => {
    toggleArea();
    navigate("/");
    toast.success(isPrivate ? "Schul-Bereich aktiv 🎓" : "Privater Bereich aktiv 🏡");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-2 border-b border-border/50 px-4 glass">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <Button
                variant={isPrivate ? "default" : "outline"}
                size="sm"
                onClick={handleAreaSwitch}
                className={cn(
                  "h-9 gap-1.5",
                  isPrivate
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "border-primary/40"
                )}
                aria-label="Bereich wechseln"
                title={isPrivate ? "Zum Schul-Bereich wechseln" : "Zum privaten Bereich wechseln"}
              >
                {isPrivate ? <Home className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                <span className="hidden sm:inline text-xs font-semibold">
                  {isPrivate ? "Privat" : "Schule"}
                </span>
              </Button>
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Theme wechseln">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Abmelden">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <ImportantBanner />
          {!isPrivate && <MealBanner />}
          <main className="flex-1 p-4 md:p-8 animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
