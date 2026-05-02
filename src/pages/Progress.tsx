import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, ReferenceLine,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SUBJECT_COLORS, SUBJECTS } from "@/lib/constants";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, Search, TrendingUp, TrendingDown, Minus, ListChecks } from "lucide-react";
import { SubjectExamsDialog } from "@/components/SubjectExamsDialog";
import { format, parseISO, startOfWeek, addWeeks, isWithinInterval } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

interface Progress { id: string; subject: string; current_grade: number | null; }
interface Task { id: string; subject: string; status: string; completed_at: string | null; due_date: string; }
interface HistoryEntry { subject: string; grade: number; recorded_at: string; }

const PIE_COLORS = ["hsl(256 90% 60%)", "hsl(188 95% 50%)", "hsl(280 95% 65%)", "hsl(38 95% 55%)", "hsl(152 70% 42%)", "hsl(0 85% 60%)"];

export default function Progress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Progress[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: t }, { data: h }] = await Promise.all([
      supabase.from("subject_progress").select("*").eq("user_id", user.id).order("subject"),
      supabase.from("tasks").select("id, subject, status, completed_at, due_date").eq("user_id", user.id),
      supabase.from("grade_history").select("subject, grade, recorded_at").eq("user_id", user.id).order("recorded_at"),
    ]);
    setProgress((p as Progress[]) ?? []);
    setTasks((t as Task[]) ?? []);
    setHistory((h as HistoryEntry[]) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const updateGrade = async (id: string, subject: string, grade: number) => {
    setProgress((prev) => prev.map((p) => p.id === id ? { ...p, current_grade: grade } : p));
    const { error } = await supabase.from("subject_progress").update({ current_grade: grade }).eq("id", id);
    if (error) { toast.error("Speichern fehlgeschlagen"); return; }
    if (user) await supabase.from("grade_history").insert({ user_id: user.id, subject, grade });
    setHistory((prev) => [...prev, { subject, grade, recorded_at: new Date().toISOString() }]);
  };

  const addSubject = async (subject: string) => {
    if (!user) return;
    if (progress.some((p) => p.subject === subject)) {
      toast.info(`${subject} ist schon hinzugefügt`);
      return;
    }
    const { error } = await supabase
      .from("subject_progress")
      .insert({ user_id: user.id, subject, current_grade: null });
    if (error) { toast.error("Konnte nicht hinzugefügt werden"); return; }
    toast.success(`${subject} hinzugefügt`);
    setSearch("");
    setPickerOpen(false);
    load();
  };

  const removeSubject = async (id: string, subject: string) => {
    const { error } = await supabase.from("subject_progress").delete().eq("id", id);
    if (error) { toast.error("Löschen fehlgeschlagen"); return; }
    toast.success(`${subject} entfernt`);
    setProgress((prev) => prev.filter((p) => p.id !== id));
  };

  const stats = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    progress.forEach((p) => (map[p.subject] = { done: 0, total: 0 }));
    tasks.forEach((t) => {
      if (!map[t.subject]) map[t.subject] = { done: 0, total: 0 };
      map[t.subject].total++;
      if (t.status === "done") map[t.subject].done++;
    });
    return map;
  }, [tasks, progress]);

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

  const subjectDist = useMemo(() => {
    return Object.entries(stats)
      .filter(([_, v]) => v.total - v.done > 0)
      .map(([name, v]) => ({ name, value: v.total - v.done }));
  }, [stats]);

  // Only count subjects with a defined grade
  const gradedSubjects = useMemo(
    () => progress.filter((p) => p.current_grade !== null && p.current_grade !== undefined),
    [progress]
  );

  const currentAverage = useMemo(() => {
    if (gradedSubjects.length === 0) return null;
    const sum = gradedSubjects.reduce((a, b) => a + Number(b.current_grade), 0);
    return sum / gradedSubjects.length;
  }, [gradedSubjects]);

  const averageTrend = useMemo(() => {
    if (gradedSubjects.length === 0) return [];
    const subjectSet = new Set(gradedSubjects.map((p) => p.subject));
    const relevant = history.filter((h) => subjectSet.has(h.subject));
    const firstKnown: Record<string, number> = {};
    relevant.forEach((h) => { if (firstKnown[h.subject] === undefined) firstKnown[h.subject] = Number(h.grade); });
    const state: Record<string, number> = {};
    gradedSubjects.forEach((p) => {
      state[p.subject] = firstKnown[p.subject] ?? Number(p.current_grade);
    });

    const points: { date: string; avg: number }[] = [];
    const count = gradedSubjects.length;
    const seedTime = relevant.length > 0 ? new Date(relevant[0].recorded_at).getTime() - 1 : Date.now() - 1;
    const pushPoint = (timeMs: number) => {
      const avg = Object.values(state).reduce((a, b) => a + b, 0) / count;
      points.push({ date: format(new Date(timeMs), "dd.MM"), avg: Number(avg.toFixed(2)) });
    };
    pushPoint(seedTime);
    relevant.forEach((h) => {
      state[h.subject] = Number(h.grade);
      pushPoint(new Date(h.recorded_at).getTime());
    });
    const latestAvg = gradedSubjects.reduce((a, b) => a + Number(b.current_grade), 0) / count;
    if (points.length === 0 || points[points.length - 1].avg !== Number(latestAvg.toFixed(2))) {
      points.push({ date: "jetzt", avg: Number(latestAvg.toFixed(2)) });
    }
    return points.slice(-30);
  }, [history, gradedSubjects]);

  const trendDelta = useMemo(() => {
    if (averageTrend.length < 2) return 0;
    return averageTrend[averageTrend.length - 1].avg - averageTrend[0].avg;
  }, [averageTrend]);

  const gradeColor = (g: number) => g <= 1.5 ? "text-success" : g <= 2.5 ? "text-accent" : g <= 3.5 ? "text-warning" : "text-destructive";

  const availableToAdd = useMemo(() => {
    const taken = new Set(progress.map((p) => p.subject));
    const q = search.trim().toLowerCase();
    return SUBJECTS.filter((s) => !taken.has(s) && (q === "" || s.toLowerCase().includes(q)));
  }, [progress, search]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Lernfortschritt</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Deine Noten, dein Schnitt und Statistik je Fach</p>
          </div>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow shrink-0">
                <Plus className="mr-1 h-4 w-4" /> Fach
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="end">
              <div className="p-3 border-b border-border/50">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Fach suchen…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {availableToAdd.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Keine Treffer
                  </div>
                ) : (
                  availableToAdd.map((s) => (
                    <button
                      key={s}
                      onClick={() => addSubject(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/30 transition-colors"
                    >
                      {s}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Average grade hero card */}
        <div className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Notendurchschnitt</p>
              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <span className={`text-4xl sm:text-5xl font-bold tabular-nums ${currentAverage ? gradeColor(currentAverage) : ""}`}>
                  {currentAverage !== null ? currentAverage.toFixed(2) : "–"}
                </span>
                {averageTrend.length >= 2 && (
                  <span className={`flex items-center gap-1 text-sm font-medium ${
                    trendDelta < -0.05 ? "text-success" : trendDelta > 0.05 ? "text-destructive" : "text-muted-foreground"
                  }`}>
                    {trendDelta < -0.05 ? <TrendingDown className="h-4 w-4" /> :
                     trendDelta > 0.05 ? <TrendingUp className="h-4 w-4" /> :
                     <Minus className="h-4 w-4" />}
                    {trendDelta > 0 ? "+" : ""}{trendDelta.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                {gradedSubjects.length === 0
                  ? "Noch keine Noten festgelegt"
                  : `Über ${gradedSubjects.length} ${gradedSubjects.length === 1 ? "benotetes Fach" : "benotete Fächer"}`}
              </p>
            </div>
          </div>

          <div className="mt-4 -mx-2 sm:mx-0">
            {averageTrend.length < 2 ? (
              <div className="h-[140px] sm:h-[160px] flex items-center justify-center text-xs sm:text-sm text-muted-foreground text-center px-4">
                Lege Noten fest, um deinen Verlauf zu sehen 📈
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={averageTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis domain={[1, 5]} reversed stroke="hsl(var(--muted-foreground))" fontSize={11} ticks={[1, 2, 3, 4, 5]} width={24} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                    formatter={(v: number) => [v.toFixed(2), "Schnitt"]}
                  />
                  <ReferenceLine y={3} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" opacity={0.5} />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--primary))", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-4 sm:p-5">
            <h2 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Erledigte Aufgaben (letzte 6 Wochen)</h2>
            <div className="-mx-2 sm:mx-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} width={24} />
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
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5">
            <h2 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Offene Aufgaben nach Fach</h2>
            {subjectDist.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Alles erledigt! 🎉
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={subjectDist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {subjectDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {progress.length === 0 ? (
          <div className="glass rounded-2xl p-8 sm:p-10 text-center">
            <p className="text-muted-foreground mb-4 text-sm">Noch keine Fächer ausgewählt.</p>
            <Button onClick={() => setPickerOpen(true)} className="bg-gradient-primary text-primary-foreground">
              <Plus className="mr-1 h-4 w-4" /> Erstes Fach hinzufügen
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <AnimatePresence>
              {progress.map((p, idx) => {
                const s = stats[p.subject] || { done: 0, total: 0 };
                const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                const hasGrade = p.current_grade !== null && p.current_grade !== undefined;
                const gradeNum = hasGrade ? Number(p.current_grade) : 3;
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.02 }}
                    className="glass rounded-2xl p-4 sm:p-5 relative group"
                  >
                    <button
                      onClick={() => removeSubject(p.id, p.subject)}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-muted/60 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      aria-label={`${p.subject} entfernen`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-start justify-between mb-3 pr-10 gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{p.subject}</h3>
                        <p className="text-xs text-muted-foreground">{s.done} / {s.total} Aufgaben</p>
                      </div>
                      <div className={`text-2xl sm:text-3xl font-bold tabular-nums shrink-0 ${hasGrade ? gradeColor(gradeNum) : "text-muted-foreground"}`}>
                        {hasGrade ? gradeNum.toFixed(1) : "–"}
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
                        <div className="flex justify-between text-[11px] text-muted-foreground mb-1 gap-2">
                          <span>Note</span>
                          <span className="truncate text-right">1 = sehr gut · 5 = nicht genügend</span>
                        </div>
                        <Slider
                          min={1} max={5} step={0.5}
                          value={[gradeNum]}
                          onValueChange={(v) => updateGrade(p.id, p.subject, v[0])}
                        />
                        {!hasGrade && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">
                            Schiebe den Regler, um eine Note festzulegen
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
