import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, ExternalLink, Plus, Trophy, AlertTriangle, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { TaskCard, type Task } from "@/components/TaskCard";
import { MealCard } from "@/components/MealCard";
import { useMealReminder } from "@/hooks/useMealReminder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TIMETABLE_URL } from "@/lib/constants";
import { addDays, isToday, isWithinInterval, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const mealEnabled = useMealReminder();
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date");
    setTasks((data as Task[]) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Guten Morgen";
    if (h < 18) return "Hallo";
    return "Guten Abend";
  })();

  const name = profile?.display_name || user?.email?.split("@")[0] || "Schüler:in";
  const todayTasks = tasks.filter((t) => isToday(parseISO(t.due_date)) && t.status !== "done");
  const upcoming = tasks.filter((t) =>
    t.status !== "done" &&
    isWithinInterval(parseISO(t.due_date), { start: new Date(), end: addDays(new Date(), 3) })
  );
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const completedThisWeek = tasks.filter(
    (t) => t.status === "done" && isWithinInterval(parseISO(t.due_date), { start: weekStart, end: weekEnd })
  ).length;
  const openCount = tasks.filter((t) => t.status !== "done").length;

  const toggle = async (t: Task) => {
    const newStatus = t.status === "done" ? "open" : "done";
    await supabase
      .from("tasks")
      .update({ status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (newStatus === "done") toast.success("Super! 🎉");
    load();
  };

  const remove = async (t: Task) => {
    await supabase.from("tasks").delete().eq("id", t.id);
    toast.success("Gelöscht");
    load();
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {greeting}, <span className="gradient-text">{name}</span>! 👋
          </h1>
          <p className="text-muted-foreground mt-1">Hier ist dein Überblick für heute.</p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={<ListChecks className="h-4 w-4" />} label="Heute" value={todayTasks.length} accent="primary" />
          <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Offen" value={openCount} accent="warning" />
          <StatCard icon={<Trophy className="h-4 w-4" />} label="Diese Woche erledigt" value={completedThisWeek} accent="success" />
          <StatCard icon={<Sparkles className="h-4 w-4" />} label="Bald fällig" value={upcoming.length} accent="accent" />
        </div>

        {/* Action cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href={TIMETABLE_URL}
            target="_blank"
            rel="noreferrer"
            className="glass rounded-2xl p-5 flex items-center gap-4 hover:shadow-glow transition-all group"
          >
            <div className="h-12 w-12 rounded-xl bg-gradient-accent flex items-center justify-center shrink-0">
              <CalendarDays className="h-6 w-6 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Stundenplan öffnen</h3>
              <p className="text-xs text-muted-foreground">WebUntis – aktueller Plan</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
          </a>

          <Link
            to="/fortschritt"
            className="glass rounded-2xl p-5 flex items-center gap-4 hover:shadow-glow transition-all group"
          >
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
              <Trophy className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Lernfortschritt</h3>
              <p className="text-xs text-muted-foreground">Noten & Statistik je Fach</p>
            </div>
          </Link>
        </div>

        {/* Meal reminder card */}
        {mealEnabled && <MealCard />}

        {/* Today + Upcoming */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Section title="Heute fällig" empty="Nichts für heute – genieße den Tag! ☕">
            {todayTasks.map((t) => (
              <TaskCard key={t.id} task={t} onToggle={toggle} onEdit={() => {}} onDelete={remove} />
            ))}
          </Section>
          <Section title="Nächste 3 Tage" empty="Keine bevorstehenden Deadlines">
            {upcoming.slice(0, 5).map((t) => (
              <TaskCard key={t.id} task={t} onToggle={toggle} onEdit={() => {}} onDelete={remove} />
            ))}
          </Section>
        </div>
      </div>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-primary shadow-glow flex items-center justify-center text-primary-foreground z-40 animate-pulse-glow"
        aria-label="Neue Aufgabe"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <TaskFormDialog open={open} onOpenChange={setOpen} onSaved={load} />
    </AppLayout>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: "primary" | "warning" | "success" | "accent" }) {
  const colors = {
    primary: "from-primary/20 to-primary/5 text-primary",
    warning: "from-warning/20 to-warning/5 text-warning",
    success: "from-success/20 to-success/5 text-success",
    accent: "from-accent/20 to-accent/5 text-accent",
  };
  return (
    <motion.div whileHover={{ y: -2 }} className="glass rounded-2xl p-4">
      <div className={`inline-flex h-8 w-8 rounded-lg items-center justify-center bg-gradient-to-br ${colors[accent]}`}>
        {icon}
      </div>
      <div className="mt-2">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </motion.div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      <div className="space-y-2">
        {has ? children : <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}
