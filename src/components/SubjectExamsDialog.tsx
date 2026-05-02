import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Calendar as CalendarIcon, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ExamGrade {
  id: string;
  subject: string;
  exam_type: string;
  exam_name: string;
  grade: number;
  exam_date: string;
  notes: string | null;
}

const EXAM_TYPE_PRESETS = [
  "Test",
  "Schularbeit",
  "Referat",
  "Mündliche Prüfung",
  "Wiederholung",
  "Mitarbeit",
  "Hausübung",
  "Sonstiges",
];

const GRADE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

interface Props {
  subject: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubjectExamsDialog({ subject, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [examType, setExamType] = useState<string>("Test");
  const [examName, setExamName] = useState("");
  const [grade, setGrade] = useState<string>("2");
  const [examDate, setExamDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setExamType("Test");
    setExamName("");
    setGrade("2");
    setExamDate(format(new Date(), "yyyy-MM-dd"));
    setNotes("");
  };

  const load = async () => {
    if (!user || !subject) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("exam_grades")
      .select("*")
      .eq("user_id", user.id)
      .eq("subject", subject)
      .order("exam_date", { ascending: false });
    if (error) {
      toast.error("Konnte Prüfungen nicht laden");
    } else {
      setExams((data as ExamGrade[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && subject) {
      load();
      setShowForm(false);
      resetForm();
    }
  }, [open, subject, user]);

  const addExam = async () => {
    if (!user || !subject) return;
    if (!examName.trim()) {
      toast.error("Bitte einen Namen eingeben");
      return;
    }
    const gradeNum = Number(grade);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 5) {
      toast.error("Note muss zwischen 1 und 5 liegen");
      return;
    }
    const { error } = await supabase.from("exam_grades").insert({
      user_id: user.id,
      subject,
      exam_type: examType,
      exam_name: examName.trim().slice(0, 120),
      grade: gradeNum,
      exam_date: examDate,
      notes: notes.trim() ? notes.trim().slice(0, 500) : null,
    });
    if (error) {
      toast.error("Speichern fehlgeschlagen");
      return;
    }
    toast.success("Prüfung hinzugefügt");
    resetForm();
    setShowForm(false);
    load();
  };

  const deleteExam = async (id: string) => {
    const { error } = await supabase.from("exam_grades").delete().eq("id", id);
    if (error) {
      toast.error("Löschen fehlgeschlagen");
      return;
    }
    setExams((prev) => prev.filter((e) => e.id !== id));
    toast.success("Prüfung gelöscht");
  };

  const gradeColor = (g: number) =>
    g <= 1.5 ? "text-success" : g <= 2.5 ? "text-accent" : g <= 3.5 ? "text-warning" : "text-destructive";

  const average =
    exams.length > 0 ? exams.reduce((a, b) => a + Number(b.grade), 0) / exams.length : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            {subject}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-3">
            <span>Prüfungen, Tests & Referate</span>
            {average !== null && (
              <span className="text-xs">
                Schnitt:{" "}
                <span className={cn("font-bold tabular-nums", gradeColor(average))}>
                  {average.toFixed(2)}
                </span>{" "}
                <span className="text-muted-foreground">({exams.length})</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-5">
            <div className="py-3 space-y-2">
              {loading ? (
                <p className="text-center text-sm text-muted-foreground py-8">Lade…</p>
              ) : exams.length === 0 ? (
                <div className="text-center py-10 px-3">
                  <p className="text-sm text-muted-foreground mb-1">Noch keine Prüfungen erfasst</p>
                  <p className="text-xs text-muted-foreground">
                    Füge Tests, Referate, mündliche Prüfungen u.v.m. hinzu.
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {exams.map((e) => (
                    <motion.div
                      key={e.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className="group rounded-xl border border-border/50 bg-card/40 p-3 flex items-start gap-3"
                    >
                      <div
                        className={cn(
                          "h-11 w-11 shrink-0 rounded-lg bg-muted flex items-center justify-center text-lg font-bold tabular-nums",
                          gradeColor(Number(e.grade))
                        )}
                      >
                        {Number(e.grade).toFixed(1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                            {e.exam_type}
                          </span>
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(parseISO(e.exam_date), "dd.MM.yyyy", { locale: de })}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-0.5 break-words">{e.exam_name}</p>
                        {e.notes && (
                          <p className="text-xs text-muted-foreground mt-1 break-words whitespace-pre-wrap">
                            {e.notes}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteExam(e.id)}
                        className="shrink-0 h-8 w-8 rounded-md text-muted-foreground hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Prüfung löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border/50 p-4 bg-muted/20">
            {!showForm ? (
              <Button
                onClick={() => setShowForm(true)}
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Plus className="mr-1 h-4 w-4" /> Prüfung hinzufügen
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Art</Label>
                    <Select value={examType} onValueChange={setExamType}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_TYPE_PRESETS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Note</Label>
                    <Select value={grade} onValueChange={setGrade}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADE_OPTIONS.map((g) => (
                          <SelectItem key={g} value={String(g)}>
                            {g.toFixed(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Name / Thema</Label>
                  <Input
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="z.B. Vokabeltest Unit 4"
                    maxLength={120}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Datum</Label>
                  <Input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Notiz (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Themen, Feedback…"
                    maxLength={500}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={addExam}
                    className="flex-1 bg-gradient-primary text-primary-foreground"
                  >
                    Speichern
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
