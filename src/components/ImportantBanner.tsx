import { useEffect, useState } from "react";
import { AlertTriangle, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useArea } from "@/hooks/useArea";

type ImportantTask = {
  id: string;
  title: string;
  due_date: string;
  subject: string | null;
};

export function ImportantBanner() {
  const { user } = useAuth();
  const { area } = useArea();
  const [tasks, setTasks] = useState<ImportantTask[]>([]);

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const in5 = new Date();
    in5.setDate(today.getDate() + 5);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    supabase
      .from("tasks")
      .select("id,title,due_date,subject")
      .eq("user_id", user.id)
      .eq("area", area)
      .eq("important", true)
      .neq("status", "done")
      .gte("due_date", fmt(today))
      .lte("due_date", fmt(in5))
      .order("due_date")
      .then(({ data }) => setTasks((data as ImportantTask[]) ?? []));
  }, [user, area]);

  if (tasks.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="bg-warning/15 border-b-2 border-warning/50 backdrop-blur-md">
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="rounded-full bg-warning p-1.5 shrink-0 animate-pulse">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  ⭐ {tasks.length === 1 ? "Wichtige Aufgabe" : `${tasks.length} wichtige Aufgaben`} bald fällig!
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {tasks.slice(0, 4).map((t) => {
                    const days = differenceInCalendarDays(parseISO(t.due_date), new Date());
                    return (
                      <span key={t.id} className="text-xs inline-flex items-center gap-1 font-medium">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        <span className="font-semibold">{t.title}</span>
                        <span className="text-muted-foreground">
                          · {days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`} ({format(parseISO(t.due_date), "dd.MM.", { locale: de })})
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
