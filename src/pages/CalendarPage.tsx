import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TASK_TYPE_META, type TaskType } from "@/lib/constants";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import type { Task } from "@/components/TaskCard";
import { format, isSameDay, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

type CalTask = Task & { task_type: TaskType };

export default function CalendarPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id);
    setTasks(((data as any[]) ?? []) as CalTask[]);
  };
  useEffect(() => { load(); }, [user]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, CalTask[]>();
    for (const t of tasks) {
      const k = t.due_date;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [tasks]);

  const dayTasks = useMemo(() => {
    return tasks
      .filter((t) => isSameDay(parseISO(t.due_date), selected))
      .sort((a, b) => (a.task_type ?? "").localeCompare(b.task_type ?? ""));
  }, [tasks, selected]);

  const typeModifiers = useMemo(() => {
    const mods: Record<string, Date[]> = {
      homework: [], exam: [], revision: [], vocab: [], other: [],
    };
    for (const t of tasks) {
      const d = parseISO(t.due_date);
      const tt = (t.task_type ?? "other") as TaskType;
      mods[tt].push(d);
    }
    return mods;
  }, [tasks]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kalender</h1>
            <p className="text-muted-foreground text-sm mt-1">Prüfungen, Hausübungen & Deadlines im Überblick</p>
          </div>
          <Button onClick={() => { setEditing(undefined); setOpen(true); }} className="bg-gradient-primary shadow-glow">
            <Plus className="mr-1 h-4 w-4" /> Neuer Termin
          </Button>
        </div>

        <div className="grid lg:grid-cols-[auto,1fr] gap-6">
          <div className="glass rounded-2xl p-4 w-fit mx-auto lg:mx-0">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => d && setSelected(d)}
              locale={de}
              showOutsideDays
              modifiers={typeModifiers}
              modifiersClassNames={{
                homework: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-blue-500",
                exam: "relative font-bold ring-1 ring-red-500/60",
                revision: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-amber-500",
                vocab: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-purple-500",
              }}
              className={cn("p-2 pointer-events-auto")}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {(Object.keys(TASK_TYPE_META) as TaskType[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", TASK_TYPE_META[k].dot)} />
                  <span className="text-muted-foreground">{TASK_TYPE_META[k].label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold text-lg">
              {format(selected, "EEEE, dd. MMMM yyyy", { locale: de })}
            </h2>
            {dayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Termine an diesem Tag. 🌿</p>
            ) : (
              <div className="space-y-2">
                {dayTasks.map((t) => {
                  const meta = TASK_TYPE_META[(t.task_type ?? "other") as TaskType];
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setEditing(t); setOpen(true); }}
                      className="w-full text-left glass rounded-xl p-3 hover:bg-accent/40 transition flex items-start gap-3"
                    >
                      <span className="text-xl">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("font-medium", t.status === "done" && "line-through opacity-60")}>{t.title}</span>
                          <Badge variant="outline" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge>
                          <Badge variant="outline" className="text-[10px]">{t.subject}</Badge>
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="pt-4 border-t border-border/40">
              <h3 className="text-sm font-semibold mb-2">Nächste Termine</h3>
              <div className="space-y-1.5">
                {tasks
                  .filter((t) => parseISO(t.due_date) >= new Date(new Date().setHours(0,0,0,0)) && t.status !== "done")
                  .sort((a, b) => a.due_date.localeCompare(b.due_date))
                  .slice(0, 6)
                  .map((t) => {
                    const meta = TASK_TYPE_META[(t.task_type ?? "other") as TaskType];
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelected(parseISO(t.due_date))}
                        className="w-full text-left flex items-center gap-2 text-sm hover:bg-accent/30 rounded-lg px-2 py-1.5 transition"
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", meta.dot)} />
                        <span className="text-muted-foreground tabular-nums shrink-0 text-xs">{format(parseISO(t.due_date), "dd.MM.")}</span>
                        <span className="truncate">{t.title}</span>
                      </button>
                    );
                  })}
                {tasks.filter((t) => parseISO(t.due_date) >= new Date(new Date().setHours(0,0,0,0)) && t.status !== "done").length === 0 && (
                  <p className="text-xs text-muted-foreground">Keine offenen Termine.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TaskFormDialog open={open} onOpenChange={setOpen} task={editing} onSaved={load} />
    </AppLayout>
  );
}
