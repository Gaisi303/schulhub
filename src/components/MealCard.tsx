import { useEffect, useState } from "react";
import { UtensilsCrossed, ExternalLink, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MEAL_URL } from "@/lib/constants";
import { startOfWeek, addWeeks, format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

export function MealCard() {
  const { user } = useAuth();
  const [done, setDone] = useState<boolean | null>(null);
  const nextMonday = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1);
  const nextWeekStart = format(nextMonday, "yyyy-MM-dd");

  const refresh = () => {
    if (!user) return;
    supabase
      .from("meal_dismissals")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", nextWeekStart)
      .maybeSingle()
      .then(({ data }) => setDone(!!data));
  };

  useEffect(refresh, [user, nextWeekStart]);

  const markDone = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("meal_dismissals")
      .insert({ user_id: user.id, week_start: nextWeekStart });
    if (error && error.code !== "23505") {
      toast.error("Konnte nicht gespeichert werden");
      return;
    }
    setDone(true);
    toast.success("Super, alles erledigt! 🍽️");
  };

  const undo = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("meal_dismissals")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start", nextWeekStart);
    if (error) { toast.error("Fehler"); return; }
    setDone(false);
  };

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 ${
          done ? "bg-success/20 text-success" : "bg-gradient-to-br from-warning/30 to-destructive/30 text-warning"
        }`}>
          {done ? <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm sm:text-base">Essensanmeldung</h3>
          <p className="text-xs text-muted-foreground">
            Woche ab {format(nextMonday, "dd.MM.yyyy", { locale: de })} ·{" "}
            {done === null ? "…" : done ? (
              <span className="text-success font-medium">Erledigt ✓</span>
            ) : (
              <span className="text-destructive font-medium">Noch offen</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0 w-full sm:w-auto">
        {!done && (
          <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-none">
            <a href={MEAL_URL} target="_blank" rel="noreferrer">
              Bestellen <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
        {done ? (
          <Button onClick={undo} size="sm" variant="ghost" className="flex-1 sm:flex-none">
            Rückgängig
          </Button>
        ) : (
          <Button onClick={markDone} size="sm" className="flex-1 sm:flex-none bg-success text-white hover:bg-success/90">
            <Check className="mr-1 h-3 w-3" /> Erledigt
          </Button>
        )}
      </div>
    </div>
  );
}
