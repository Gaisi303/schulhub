import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SUBJECT_COLORS, SUBJECTS } from "@/lib/constants";
import { Slider } from "@/components/ui/slider";
import { format, parseISO, startOfWeek, addWeeks, isWithinInterval } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface Progress { id: string; subject: string; current_grade: number; }
interface Task { id: string; subject: string; status: string; completed_at: string | null; due_date: string; }

const PIE_COLORS = ["hsl(256 90% 60%)", "hsl(188 95% 50%)", "hsl(280 95% 65%)", "hsl(38 95% 55%)", "hsl(152 70% 42%)", "hsl(0 85% 60%)"];

export default function Progress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Progress[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("subject_progress").select("*").eq("user_id", user.id).order("subject"),
      supabase.from("tasks").select("id, subject, status, completed_at, due_date").eq("user_id", user.id),
    ]);
    setProgress((p as Progress[]) ?? []);
    setTasks((t as Task[]) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const updateGrade = async (id: string, grade: number) => {
    setProgress((prev) => prev.map((p) => p.id === id ? { ...p, current_grade: grade } : p));
    const { error } = await supabase.from("subject_progress").update({ current_grade: grade }).eq("id", id);
    if (error) toast.error("Speichern fehlgeschlagen");
  };

  const stats = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    SUBJECTS.forEach((s) => (map[s] = { done: 0, total: 0 }));
    tasks.forEach((t) => {
      if (!map[t.subject]) map[t.subject] = { done: 0, total: 0 };
      map[t.subject].total++;
      if (t.status === "done") map[t.subject].done++;
    });
    return map;
  }, [tasks]);

  // Weekly completion chart (last 6 weeks)
  const weeklyData = useMemo(() => {
    const weeks = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfWeek(addWeeks(new Date(), -i), { weekStartsOn: 1 });
      const end = addWeeks(start, 1);
      const done = tasks.filter(
        (t) => t.status === "done" && t.completed_at && isWithinInterval(parseISO(t.completed_at), { start, end })
      ).length;
      weeks.push({ week: format(start, "dd.MM", { locale: de }), erledigt: done });
    }
    return weeks;
  }, [tasks]);

  // Subject distribution (pending tasks)
  const subjectDist = useMemo(() => {
    return Object.entries(stats)
      .filter(([_, v]) => v.total - v.done > 0)
      .map(([name, v]) => ({ name, value: v.total - v.done }));
  }, [stats]);

  const gradeColor = (g: number) => g <= 1.5 ? "text-success" : g <= 2.5 ? "text-accent" : g <= 3.5 ? "text-warning" : "text-destructive";

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lernfortschritt</h1>
          <p className="text-muted-foreground text-sm mt-1">Deine Noten und Aufgabenstatistik je Fach</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Erledigte Aufgaben (letzte 6 Wochen)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                />
                <Bar dataKey="erledigt" radius={[8, 8, 0, 0]} fill="url(#barGrad)" />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--primary-glow))" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Offene Aufgaben nach Fach</h2>
            {subjectDist.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                Alles erledigt! 🎉
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={subjectDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {subjectDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {progress.map((p, idx) => {
            const s = stats[p.subject] || { done: 0, total: 0 };
            const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="glass rounded-2xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{p.subject}</h3>
                    <p className="text-xs text-muted-foreground">{s.done} / {s.total} Aufgaben</p>
                  </div>
                  <div className={`text-3xl font-bold tabular-nums ${gradeColor(p.current_grade)}`}>
                    {p.current_grade.toFixed(1)}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full bg-gradient-to-r ${SUBJECT_COLORS[p.subject] || "from-primary to-primary-glow"}`}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{pct}% erledigt</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Note</span>
                      <span>1 = sehr gut · 5 = nicht genügend</span>
                    </div>
                    <Slider
                      min={1} max={5} step={0.5}
                      value={[p.current_grade]}
                      onValueChange={(v) => updateGrade(p.id, v[0])}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
