import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { TaskCard, type Task } from "@/components/TaskCard";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SUBJECTS } from "@/lib/constants";
import { toast } from "sonner";

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const [q, setQ] = useState("");
  const [fSubject, setFSubject] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [sort, setSort] = useState<"due" | "subject" | "priority">("due");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id);
    setTasks((data as Task[]) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    let arr = [...tasks];
    if (q) arr = arr.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
    if (fSubject !== "all") arr = arr.filter((t) => t.subject === fSubject);
    if (fStatus !== "all") arr = arr.filter((t) => t.status === fStatus);
    if (fPriority !== "all") arr = arr.filter((t) => t.priority === fPriority);
    const prioRank = { high: 0, medium: 1, low: 2 };
    if (sort === "due") arr.sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (sort === "subject") arr.sort((a, b) => a.subject.localeCompare(b.subject));
    if (sort === "priority") arr.sort((a, b) => prioRank[a.priority] - prioRank[b.priority]);
    return arr;
  }, [tasks, q, fSubject, fStatus, fPriority, sort]);

  const toggle = async (t: Task) => {
    const ns = t.status === "done" ? "open" : "done";
    await supabase.from("tasks").update({ status: ns, completed_at: ns === "done" ? new Date().toISOString() : null }).eq("id", t.id);
    if (ns === "done") toast.success("Erledigt! 🎉");
    load();
  };
  const remove = async (t: Task) => {
    await supabase.from("tasks").delete().eq("id", t.id);
    load();
  };
  const edit = (t: Task) => { setEditing(t); setOpen(true); };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Aufgaben</h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} von {tasks.length} angezeigt</p>
          </div>
          <Button onClick={() => { setEditing(undefined); setOpen(true); }} className="bg-gradient-primary shadow-glow">
            <Plus className="mr-1 h-4 w-4" /> Neue Aufgabe
          </Button>
        </div>

        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Aufgabe suchen..." className="pl-9 bg-background/50" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={fSubject} onValueChange={setFSubject}>
              <SelectTrigger><SelectValue placeholder="Fach" /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Alle Fächer</SelectItem>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="open">Offen</SelectItem>
                <SelectItem value="in_progress">In Arbeit</SelectItem>
                <SelectItem value="done">Erledigt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fPriority} onValueChange={setFPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Alle Prioritäten</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="due">Sortieren: Datum</SelectItem>
                <SelectItem value="subject">Sortieren: Fach</SelectItem>
                <SelectItem value="priority">Sortieren: Priorität</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((t) => (
              <TaskCard key={t.id} task={t} onToggle={toggle} onEdit={edit} onDelete={remove} />
            ))}
          </AnimatePresence>
        </div>
        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            Keine Aufgaben gefunden. Erstelle eine neue! 🚀
          </div>
        )}
      </div>

      <TaskFormDialog open={open} onOpenChange={setOpen} task={editing} onSaved={load} />
    </AppLayout>
  );
}
