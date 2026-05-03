import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Calculator, History, Save } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SUBJECTS } from "@/lib/constants";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

type Country = "AT" | "DE" | "CH";
type CompKind = "exam" | "percent" | "points" | "participation";
interface Component {
  id: string;
  kind: CompKind;
  name: string;
  weight: number;
  // for exam: grade entered directly in country scale
  grade?: number;
  // for percent
  percent?: number;
  // for points
  achieved?: number;
  total?: number;
}

const COUNTRY_META: Record<Country, { label: string; flag: string; min: number; max: number; bestIsLow: boolean; passLabel: string }> = {
  AT: { label: "Österreich", flag: "🇦🇹", min: 1, max: 5, bestIsLow: true, passLabel: "1 = Sehr gut, 5 = Nicht genügend" },
  DE: { label: "Deutschland", flag: "🇩🇪", min: 1, max: 6, bestIsLow: true, passLabel: "1 = Sehr gut, 6 = Ungenügend" },
  CH: { label: "Schweiz", flag: "🇨🇭", min: 1, max: 6, bestIsLow: false, passLabel: "6 = Sehr gut, 1 = Ungenügend" },
};

// percentage → grade per country
function percentToGrade(p: number, c: Country): number {
  p = Math.max(0, Math.min(100, p));
  if (c === "AT") {
    if (p >= 90) return 1;
    if (p >= 80) return 2;
    if (p >= 65) return 3;
    if (p >= 50) return 4;
    return 5;
  }
  if (c === "DE") {
    // linear-ish based on common scheme
    if (p >= 92) return 1;
    if (p >= 81) return 2;
    if (p >= 67) return 3;
    if (p >= 50) return 4;
    if (p >= 30) return 5;
    return 6;
  }
  // CH: 1-6, best is 6. linear from 0%→1 to 100%→6
  return Math.round((1 + (p / 100) * 5) * 10) / 10;
}

function gradeLabel(grade: number, c: Country): string {
  if (c === "CH") {
    if (grade >= 5.5) return "Sehr gut";
    if (grade >= 4.5) return "Gut";
    if (grade >= 4) return "Genügend";
    return "Ungenügend";
  }
  const g = Math.round(grade);
  if (c === "AT") return ["", "Sehr gut", "Gut", "Befriedigend", "Genügend", "Nicht genügend"][g] || "-";
  return ["", "Sehr gut", "Gut", "Befriedigend", "Ausreichend", "Mangelhaft", "Ungenügend"][g] || "-";
}

const PRESET_NAMES: Record<CompKind, string> = {
  exam: "Prüfung",
  percent: "Test (Prozent)",
  points: "Test (Punkte)",
  participation: "Mitarbeit",
};

export default function GradeCalculator() {
  const { user } = useAuth();
  const [country, setCountry] = useState<Country>("AT");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [title, setTitle] = useState("Berechnung");
  const [components, setComponents] = useState<Component[]>([
    { id: crypto.randomUUID(), kind: "exam", name: "Schularbeit 1", weight: 2, grade: 2 },
    { id: crypto.randomUUID(), kind: "participation", name: "Mitarbeit", weight: 1, grade: 2 },
  ]);
  const [history, setHistory] = useState<any[]>([]);

  const meta = COUNTRY_META[country];

  const componentGrade = (c: Component): number | null => {
    if (c.kind === "exam" || c.kind === "participation") {
      if (c.grade == null || isNaN(c.grade)) return null;
      return Math.max(meta.min, Math.min(meta.max, c.grade));
    }
    if (c.kind === "percent") {
      if (c.percent == null || isNaN(c.percent)) return null;
      return percentToGrade(c.percent, country);
    }
    if (c.kind === "points") {
      if (!c.total || c.achieved == null) return null;
      return percentToGrade((c.achieved / c.total) * 100, country);
    }
    return null;
  };

  const result = useMemo(() => {
    let totalW = 0, sum = 0;
    for (const c of components) {
      const g = componentGrade(c);
      if (g == null || c.weight <= 0) continue;
      sum += g * c.weight;
      totalW += c.weight;
    }
    if (totalW === 0) return null;
    const avg = sum / totalW;
    return Math.round(avg * 100) / 100;
  }, [components, country]);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await (supabase.from as any)("grade_calculations")
      .select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setHistory(data ?? []);
  };
  useEffect(() => { loadHistory(); }, [user]);

  const addComp = (kind: CompKind) => {
    setComponents((p) => [...p, {
      id: crypto.randomUUID(), kind, name: PRESET_NAMES[kind], weight: 1,
      ...(kind === "exam" || kind === "participation" ? { grade: meta.bestIsLow ? 2 : 5 } : {}),
      ...(kind === "percent" ? { percent: 75 } : {}),
      ...(kind === "points" ? { achieved: 15, total: 20 } : {}),
    }]);
  };
  const updateComp = (id: string, patch: Partial<Component>) => {
    setComponents((p) => p.map((c) => c.id === id ? { ...c, ...patch } : c));
  };
  const removeComp = (id: string) => setComponents((p) => p.filter((c) => c.id !== id));

  const save = async () => {
    if (!user || result == null) return;
    const { error } = await (supabase.from as any)("grade_calculations").insert({
      user_id: user.id, country, subject, title,
      components: components as any, result_grade: result, result_label: gradeLabel(result, country),
    });
    if (error) { toast.error("Speichern fehlgeschlagen"); return; }
    toast.success("Berechnung gespeichert ✨");
    loadHistory();
  };

  const deleteHistory = async (id: string) => {
    await (supabase.from as any)("grade_calculations").delete().eq("id", id);
    loadHistory();
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Calculator className="h-7 w-7 text-primary" /> Notenberechnung
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Berechne deine Gesamtnote nach dem Notensystem deines Landes.</p>
          </div>
        </div>

        <Tabs defaultValue="calc">
          <TabsList>
            <TabsTrigger value="calc">Berechnen</TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> Verlauf ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="calc" className="space-y-4">
            <Card className="glass p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Land</Label>
                  <Select value={country} onValueChange={(v) => setCountry(v as Country)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {(Object.keys(COUNTRY_META) as Country[]).map((c) => (
                        <SelectItem key={c} value={c}>{COUNTRY_META[c].flag} {COUNTRY_META[c].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">{meta.passLabel}</p>
                </div>
                <div className="space-y-2">
                  <Label>Fach</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bezeichnung</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. 1. Semester" />
                </div>
              </div>
            </Card>

            <Card className="glass p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold">Leistungen</h3>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => addComp("exam")}><Plus className="h-3 w-3 mr-1" />Prüfung</Button>
                  <Button size="sm" variant="outline" onClick={() => addComp("percent")}><Plus className="h-3 w-3 mr-1" />Test (%)</Button>
                  <Button size="sm" variant="outline" onClick={() => addComp("points")}><Plus className="h-3 w-3 mr-1" />Test (Punkte)</Button>
                  <Button size="sm" variant="outline" onClick={() => addComp("participation")}><Plus className="h-3 w-3 mr-1" />Mitarbeit</Button>
                </div>
              </div>

              <div className="space-y-2">
                {components.map((c) => {
                  const g = componentGrade(c);
                  return (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{PRESET_NAMES[c.kind]}</Badge>
                        <Input
                          value={c.name}
                          onChange={(e) => updateComp(c.id, { name: e.target.value })}
                          className="flex-1 min-w-[150px] h-8 text-sm"
                        />
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Gewicht</Label>
                          <Input
                            type="number" min={0} step={0.5}
                            value={c.weight}
                            onChange={(e) => updateComp(c.id, { weight: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-16 text-sm"
                          />
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" onClick={() => removeComp(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                        {(c.kind === "exam" || c.kind === "participation") && (
                          <div className="space-y-1">
                            <Label className="text-xs">Note ({meta.min}–{meta.max})</Label>
                            <Input
                              type="number" min={meta.min} max={meta.max} step={0.1}
                              value={c.grade ?? ""}
                              onChange={(e) => updateComp(c.id, { grade: parseFloat(e.target.value) })}
                              className="h-9"
                            />
                          </div>
                        )}
                        {c.kind === "percent" && (
                          <div className="space-y-1">
                            <Label className="text-xs">Prozent erreicht</Label>
                            <Input
                              type="number" min={0} max={100} step={1}
                              value={c.percent ?? ""}
                              onChange={(e) => updateComp(c.id, { percent: parseFloat(e.target.value) })}
                              className="h-9"
                            />
                          </div>
                        )}
                        {c.kind === "points" && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Erreichte Punkte</Label>
                              <Input
                                type="number" min={0} step={0.5}
                                value={c.achieved ?? ""}
                                onChange={(e) => updateComp(c.id, { achieved: parseFloat(e.target.value) })}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Maximale Punkte</Label>
                              <Input
                                type="number" min={1} step={0.5}
                                value={c.total ?? ""}
                                onChange={(e) => updateComp(c.id, { total: parseFloat(e.target.value) })}
                                className="h-9"
                              />
                            </div>
                          </>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {g != null ? <>Ergebnis: <span className="font-bold text-foreground">{g.toFixed(2)}</span> · {gradeLabel(g, country)}</> : "—"}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {components.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">Noch keine Leistungen. Füge oben eine hinzu.</p>
                )}
              </div>
            </Card>

            <Card className="glass-strong p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Gesamtnote ({meta.flag} {meta.label})</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-5xl font-bold gradient-text">{result != null ? result.toFixed(2) : "—"}</span>
                  {result != null && <span className="text-lg font-medium">{gradeLabel(result, country)}</span>}
                </div>
              </div>
              <Button onClick={save} disabled={result == null} className="bg-gradient-primary shadow-glow">
                <Save className="h-4 w-4 mr-2" /> Im Verlauf speichern
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-2">
            {history.length === 0 && (
              <Card className="glass p-8 text-center text-muted-foreground">Noch keine gespeicherten Berechnungen.</Card>
            )}
            {history.map((h) => (
              <Card key={h.id} className="glass p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{h.title}</span>
                    <Badge variant="outline" className="text-[10px]">{COUNTRY_META[h.country as Country]?.flag} {h.country}</Badge>
                    {h.subject && <Badge variant="outline" className="text-[10px]">{h.subject}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(h.created_at), "dd. MMM yyyy, HH:mm", { locale: de })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-bold gradient-text">{Number(h.result_grade).toFixed(2)}</div>
                    <div className="text-[11px] text-muted-foreground">{h.result_label}</div>
                  </div>
                  <Button size="icon" variant="ghost" className="hover:text-destructive" onClick={() => deleteHistory(h.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
