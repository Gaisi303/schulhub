import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MEAL_URL } from "@/lib/constants";
import { startOfWeek, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function MealBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    // Show only on Wednesdays (day 3)
    const isWednesday = new Date().getDay() === 3;
    if (!isWednesday) {
      setShow(false);
      return;
    }
    supabase
      .from("meal_dismissals")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle()
      .then(({ data }) => setShow(!data));
  }, [user, weekStart]);

  const dismiss = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("meal_dismissals")
      .insert({ user_id: user.id, week_start: weekStart });
    if (error && error.code !== "23505") {
      toast.error("Konnte nicht gespeichert werden");
      return;
    }
    setShow(false);
    toast.success("Essensanmeldung erledigt – bis nächsten Mittwoch! 🍽️");
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="bg-destructive/10 border-b-2 border-destructive/40 backdrop-blur-md">
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="rounded-full bg-destructive p-1.5 shrink-0 animate-pulse">
                  <AlertTriangle className="h-4 w-4 text-destructive-foreground" />
                </div>
                <p className="text-sm font-semibold text-destructive-foreground/90 dark:text-destructive">
                  ⚠️ ACHTUNG: Du hast die Essensanmeldung für nächste Woche noch nicht erledigt!
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button asChild variant="destructive" size="sm">
                  <a href={MEAL_URL} target="_blank" rel="noreferrer">
                    Jetzt anmelden <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
                <Button onClick={dismiss} variant="outline" size="sm" className="border-destructive/40">
                  <Check className="mr-1 h-3 w-3" /> Erledigt
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
