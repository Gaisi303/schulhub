import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useArea } from "@/hooks/useArea";
import { TASK_TYPE_META, type TaskType, SCHOOL_TASK_TYPES, PRIVATE_TASK_TYPES } from "@/lib/constants";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import type { Task } from "@/components/TaskCard";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";

type CalTask = Task & { task_type: TaskType };

// pastel block colors per type (light, like the reference)
const TYPE_BLOCK: Record<TaskType, string> = {
  homework: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-500/20 dark:text-blue-100 dark:border-blue-400/30",
  exam: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-400/30",
  revision: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-400/30",
  vocab: "bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-500/20 dark:text-purple-100 dark:border-purple-400/30",
  appointment: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-400/30",
  meeting: "bg-pink-100 text-pink-900 border-pink-200 dark:bg-pink-500/20 dark:text-pink-100 dark:border-pink-400/30",
  errand: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30",
  health: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-400/30",
  finance: "bg-yellow-100 text-yellow-900 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-100 dark:border-yellow-400/30",
  household: "bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-500/20 dark:text-teal-100 dark:border-teal-400/30",
  personal: "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-500/20 dark:text-violet-100 dark:border-violet-400/30",
  other: "bg-stone-100 text-stone-900 border-stone-200 dark:bg-stone-500/20 dark:text-stone-100 dark:border-stone-400/30",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { area } = useArea();
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id).eq("area", area);
    setTasks(((data as any[]) ?? []) as CalTask[]);
  };
  useEffect(() => {
    load();
  }, [user, area]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const tasksByDay = useMemo(() => {
    const m = new Map<string, CalTask[]>();
    for (const t of tasks) {
      const k = t.due_date;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [tasks]);

  const weekLabel = `${format(days[0], "dd.")} – ${format(days[6], "dd. MMMM yyyy", { locale: de })}`;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-none">
                {format(weekStart, "MMMM yyyy", { locale: de })}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">{weekLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              Heute
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
              className="bg-gradient-primary shadow-glow ml-1"
            >
              <Plus className="mr-1 h-4 w-4" /> Neu
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {(area === "private" ? PRIVATE_TASK_TYPES : SCHOOL_TASK_TYPES).map((k) => (
            <span
              key={k}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5",
                TYPE_BLOCK[k]
              )}
            >
              <span>{TASK_TYPE_META[k].emoji}</span>
              {TASK_TYPE_META[k].label}
            </span>
          ))}
        </div>

        {/* Week grid */}
        <div className="glass rounded-3xl p-3 md:p-4 overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 md:gap-3 min-w-[760px]">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = (tasksByDay.get(key) ?? []).sort((a, b) =>
                (a.task_type ?? "").localeCompare(b.task_type ?? "")
              );
              const today = isToday(day);
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-2xl border border-border/50 bg-card/40 flex flex-col min-h-[420px] overflow-hidden",
                    today && "ring-2 ring-primary/60"
                  )}
                >
                  {/* Day header */}
                  <button
                    onClick={() => {
                      setEditing(undefined);
                      setOpen(true);
                    }}
                    className={cn(
                      "px-3 py-2 text-left border-b border-border/50 flex items-center justify-between hover:bg-accent/40 transition",
                      today && "bg-primary/10"
                    )}
                  >
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                        {format(day, "EEE", { locale: de })}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-bold leading-none mt-0.5",
                          today && "text-primary"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                    {dayTasks.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {dayTasks.length}
                      </Badge>
                    )}
                  </button>

                  {/* Events */}
                  <div className="flex-1 p-2 space-y-1.5">
                    {dayTasks.length === 0 ? (
                      <div className="h-full grid place-items-center text-[11px] text-muted-foreground/60 italic">
                        —
                      </div>
                    ) : (
                      dayTasks.map((t) => {
                        const tt = (t.task_type ?? "other") as TaskType;
                        const meta = TASK_TYPE_META[tt];
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setEditing(t);
                              setOpen(true);
                            }}
                            className={cn(
                              "w-full text-left rounded-xl border px-2.5 py-2 transition hover:scale-[1.02] hover:shadow-md",
                              TYPE_BLOCK[tt],
                              t.status === "done" && "opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                              <span>{meta.emoji}</span>
                              <span className="truncate">{meta.label}</span>
                            </div>
                            <div
                              className={cn(
                                "text-xs font-semibold mt-1 line-clamp-2 leading-snug",
                                t.status === "done" && "line-through"
                              )}
                            >
                              {t.title}
                            </div>
                            <div className="text-[10px] mt-1 opacity-70 truncate">
                              {t.subject}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-3">Nächste Termine</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {tasks
              .filter(
                (t) =>
                  parseISO(t.due_date) >= new Date(new Date().setHours(0, 0, 0, 0)) &&
                  t.status !== "done"
              )
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .slice(0, 6)
              .map((t) => {
                const tt = (t.task_type ?? "other") as TaskType;
                const meta = TASK_TYPE_META[tt];
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setWeekStart(startOfWeek(parseISO(t.due_date), { weekStartsOn: 1 }));
                    }}
                    className={cn(
                      "text-left rounded-xl border px-3 py-2.5 transition hover:scale-[1.01]",
                      TYPE_BLOCK[tt]
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {meta.emoji} {meta.label}
                      </span>
                      <span className="text-[10px] opacity-70 tabular-nums">
                        {format(parseISO(t.due_date), "EEE dd.MM.", { locale: de })}
                      </span>
                    </div>
                    <div className="text-sm font-semibold mt-1 truncate">{t.title}</div>
                    <div className="text-[10px] opacity-70 truncate">{t.subject}</div>
                  </button>
                );
              })}
            {tasks.filter(
              (t) =>
                parseISO(t.due_date) >= new Date(new Date().setHours(0, 0, 0, 0)) &&
                t.status !== "done"
            ).length === 0 && (
              <p className="text-xs text-muted-foreground">Keine offenen Termine.</p>
            )}
          </div>
        </div>
      </div>

      <TaskFormDialog open={open} onOpenChange={setOpen} task={editing} onSaved={load} />
    </AppLayout>
  );
}
