import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NoteEditor } from "@/components/NoteEditor";
import { SUBJECTS } from "@/lib/constants";
import { Plus, Trash2, FileText, Search, ArrowLeft, Network } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Note {
  id: string;
  title: string;
  content: string;
  subject: string | null;
  updated_at: string;
}

export default function Notes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showListMobile, setShowListMobile] = useState(true);
  const saveTimer = useRef<number | null>(null);

  const active = useMemo(() => notes.find((n) => n.id === activeId) || null, [notes, activeId]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const createNote = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Neue Notiz", content: "" })
      .select()
      .single();
    if (error || !data) { toast.error("Konnte nicht erstellen"); return; }
    setNotes((p) => [data as Note, ...p]);
    setActiveId((data as Note).id);
    setShowListMobile(false);
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) { toast.error("Löschen fehlgeschlagen"); return; }
    setNotes((p) => p.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const patchActive = (patch: Partial<Note>) => {
    if (!active) return;
    setNotes((p) => p.map((n) => (n.id === active.id ? { ...n, ...patch } : n)));
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await supabase.from("notes").update(patch).eq("id", active.id);
    }, 500);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.subject || "").toLowerCase().includes(q)
    );
  }, [notes, search]);

  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-1 sm:px-0">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notizen</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Schreibe formatierte Notizen mit Rechtschreibprüfung
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/mindmaps">
              <Button size="sm" variant="outline" className="shrink-0">
                <Network className="mr-1 h-4 w-4" /> Mindmaps
              </Button>
            </Link>
            <Button size="sm" onClick={createNote} className="bg-gradient-primary text-primary-foreground shadow-glow shrink-0">
              <Plus className="mr-1 h-4 w-4" /> Notiz
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-[280px_1fr] gap-4">
          {/* List */}
          <div className={`${active && !showListMobile ? "hidden md:block" : "block"} space-y-2`}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="glass rounded-2xl divide-y divide-border/50 overflow-hidden max-h-[70vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {notes.length === 0 ? "Noch keine Notizen" : "Keine Treffer"}
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((n) => (
                    <motion.button
                      key={n.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={() => { setActiveId(n.id); setShowListMobile(false); }}
                      className={`w-full text-left p-3 transition-colors group ${
                        activeId === n.id ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{n.title || "Ohne Titel"}</div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {stripHtml(n.content) || "Leere Notiz"}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {n.subject && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground">
                                {n.subject}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {format(parseISO(n.updated_at), "dd.MM. HH:mm", { locale: de })}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
                          aria-label="Löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className={`${active && !showListMobile ? "block" : "hidden md:block"} min-w-0`}>
            {!active ? (
              <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Wähle eine Notiz oder erstelle eine neue.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowListMobile(true)}
                    className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-md bg-muted hover:bg-muted/70"
                    aria-label="Zurück"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Input
                    value={active.title}
                    onChange={(e) => patchActive({ title: e.target.value })}
                    placeholder="Titel"
                    className="flex-1 min-w-[160px] text-base sm:text-lg font-semibold border-0 bg-transparent focus-visible:ring-0 px-0"
                  />
                  <Select
                    value={active.subject ?? "none"}
                    onValueChange={(v) => patchActive({ subject: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Fach" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Fach</SelectItem>
                      {SUBJECTS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <NoteEditor
                  content={active.content}
                  onChange={(html) => patchActive({ content: html })}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
