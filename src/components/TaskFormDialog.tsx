import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { SUBJECTS, TASK_TYPE_META, SCHOOL_TASK_TYPES, PRIVATE_TASK_TYPES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useArea } from "@/hooks/useArea";
import { toast } from "sonner";
import { TaskAttachments } from "./TaskAttachments";

const schema = z.object({
  title: z.string().trim().min(1, "Titel erforderlich").max(120),
  subject: z.string().min(1, "Kategorie wählen"),
  due_date: z.date({ required_error: "Datum wählen" }),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["open", "in_progress", "done"]),
  task_type: z.enum(["homework", "exam", "revision", "vocab", "appointment", "meeting", "errand", "health", "finance", "household", "personal", "other"]),
  description: z.string().max(1000).optional(),
  important: z.boolean().optional(),
});

type FormVals = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: any;
  onSaved?: () => void;
}

const PRIVATE_CATEGORIES = ["Allgemein", "Haushalt", "Familie", "Finanzen", "Termine", "Gesundheit", "Einkauf", "Sonstiges"];

export function TaskFormDialog({ open, onOpenChange, task, onSaved }: Props) {
  const { user } = useAuth();
  const { area } = useArea();
  const [submitting, setSubmitting] = useState(false);
  const isPrivate = area === "private";

  const categories = isPrivate ? PRIVATE_CATEGORIES : SUBJECTS;
  const defaultSubject = isPrivate ? "Allgemein" : "Mathematik";

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      subject: defaultSubject,
      due_date: new Date(),
      priority: "medium",
      status: "open",
      task_type: isPrivate ? "appointment" : "homework",
      description: "",
      important: false,
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        subject: task.subject,
        due_date: new Date(task.due_date),
        priority: task.priority,
        status: task.status,
        task_type: task.task_type ?? "other",
        description: task.description ?? "",
        important: !!task.important,
      });
    } else {
      form.reset({
        title: "",
        subject: defaultSubject,
        due_date: new Date(),
        priority: "medium",
        status: "open",
        task_type: isPrivate ? "appointment" : "homework",
        description: "",
        important: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, open, area]);

  const onSubmit = async (vals: FormVals) => {
    if (!user) return;
    setSubmitting(true);
    const payload: any = {
      user_id: user.id,
      title: vals.title,
      subject: vals.subject,
      due_date: format(vals.due_date, "yyyy-MM-dd"),
      priority: vals.priority,
      status: vals.status,
      task_type: vals.task_type,
      description: vals.description || null,
      important: !!vals.important,
      area,
      completed_at: vals.status === "done" ? new Date().toISOString() : null,
    };

    const { error } = task
      ? await supabase.from("tasks").update(payload).eq("id", task.id)
      : await supabase.from("tasks").insert(payload);

    setSubmitting(false);
    if (error) {
      toast.error("Speichern fehlgeschlagen");
      return;
    }
    toast.success(task ? "Aufgabe aktualisiert ✨" : "Aufgabe erstellt 🎯");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg glass-strong max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{task ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" {...form.register("title")} placeholder={isPrivate ? "z.B. Müll rausbringen" : "z.B. Buchpräsentation vorbereiten"} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{isPrivate ? "Kategorie" : "Fach"}</Label>
              <Select value={form.watch("subject")} onValueChange={(v) => form.setValue("subject", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {categories.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fällig am</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !form.watch("due_date") && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("due_date") ? format(form.watch("due_date"), "dd.MM.yyyy") : "Datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("due_date")}
                    onSelect={(d) => d && form.setValue("due_date", d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select value={form.watch("priority")} onValueChange={(v) => form.setValue("priority", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="low">🟢 Niedrig</SelectItem>
                  <SelectItem value="medium">🟡 Mittel</SelectItem>
                  <SelectItem value="high">🔴 Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="open">Offen</SelectItem>
                  <SelectItem value="in_progress">In Arbeit</SelectItem>
                  <SelectItem value="done">Erledigt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <Select value={form.watch("task_type")} onValueChange={(v) => form.setValue("task_type", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {(isPrivate ? PRIVATE_TASK_TYPES : SCHOOL_TASK_TYPES).map((k) => (
                  <SelectItem key={k} value={k}>{TASK_TYPE_META[k].emoji} {TASK_TYPE_META[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-3 rounded-xl border-2 border-warning/30 bg-warning/5 p-3 cursor-pointer hover:bg-warning/10 transition-colors">
            <Checkbox
              checked={!!form.watch("important")}
              onCheckedChange={(v) => form.setValue("important", !!v)}
            />
            <Star className={cn("h-4 w-4", form.watch("important") ? "fill-warning text-warning" : "text-muted-foreground")} />
            <div className="flex-1">
              <div className="text-sm font-medium">Extra wichtig</div>
              <div className="text-xs text-muted-foreground">Banner oben 5 Tage vor Deadline</div>
            </div>
          </label>

          <div className="space-y-2">
            <Label htmlFor="desc">Notizen (optional)</Label>
            <Textarea id="desc" {...form.register("description")} rows={3} placeholder="Zusätzliche Details..." />
          </div>

          {task?.id ? (
            <TaskAttachments taskId={task.id} />
          ) : (
            <p className="text-xs text-muted-foreground italic">💡 Anhänge können nach dem Erstellen hinzugefügt werden.</p>
          )}

          <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary hover:opacity-90 shadow-glow">
            {submitting ? "Speichern..." : task ? "Aktualisieren" : "Erstellen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
