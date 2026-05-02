import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MEAL_URL } from "@/lib/constants";
import { startOfWeek, addWeeks, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

/**
 * Reminder for the meal order for NEXT week.
 * Shows every day until the user marks it as done.
 * Resets automatically each week (new week_start = new row).
 */
export function MealBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const nextWeekStart = format(
    addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1),
    "yyyy-MM-dd"
  );

  useEffect(() => {
    if (!user) return;
    supabase
      .from("meal_dismissals")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", nextWeekStart)
      .maybeSingle()
      .then(({ data }) => setShow(!data));
  }, [user, nextWeekStart]);

  const dismiss = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("meal_dismissals")
      .insert({ user_id: user.id, week_start: nextWeekStart });
    if (error && error.code !== "23505") {
      toast.error("Konnte nicht gespeichert werden");
      return;
    }
    setShow(false);
    toast.success("Essensanmeldung erledigt – bis nächste Woche! 🍽️");
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
                  ⚠️ Essensanmeldung für nächste Woche noch nicht erledigt!
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button asChild variant="destructive" size="sm">
                  <a href={MEAL_URL} target="_blank" rel="noreferrer">
                    Jetzt bestellen <ExternalLink className="ml-1 h-3 w-3" />
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
