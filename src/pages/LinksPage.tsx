import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link2, Plus, Search, Sparkles, ExternalLink, Trash2, Loader2, X, Tag, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SavedLink {
  id: string;
  url: string | null;
  title: string | null;
  description: string | null;
  summary: string | null;
  content: string | null;
  tags: string[];
  favicon: string | null;
  folder: string | null;
  kind: "link" | "tip";
  created_at: string;
}

export default function LinksPage() {
  const { user } = useAuth();
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [open, setOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<{ id: string; reason: string }[] | null>(null);
  const [detail, setDetail] = useState<SavedLink | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("saved_links")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLinks((data as SavedLink[]) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const addLink = async () => {
    if (!user) return;
    const url = newUrl.trim();
    if (!url) return;
    let normalized = url;
    if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    try { new URL(normalized); } catch { toast.error("Ungültige URL"); return; }
    setSaving(true);
    try {
      // 1. Quick insert with placeholder
      let domain = "";
      try { domain = new URL(normalized).hostname.replace(/^www\./, ""); } catch {}
      const { data, error } = await supabase
        .from("saved_links")
        .insert({
          user_id: user.id,
          area: "private",
          url: normalized,
          title: domain || normalized,
          description: newNote.trim() || null,
          favicon: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null,
          tags: [],
        })
        .select()
        .single();
      if (error || !data) throw error;
      setLinks((p) => [data as SavedLink, ...p]);
      setNewUrl(""); setNewNote(""); setOpen(false);
      toast.success("Link gespeichert ✨ KI analysiert ihn jetzt...");

      // 2. Background: AI summary
      const { data: aiData, error: aiErr } = await supabase.functions.invoke("link-summary", {
        body: { url: normalized, userNote: newNote.trim() },
      });
      if (!aiErr && aiData) {
        await supabase
          .from("saved_links")
          .update({
            title: aiData.title || data.title,
            description: aiData.description || data.description,
            summary: aiData.summary || null,
            tags: aiData.tags || [],
          })
          .eq("id", (data as SavedLink).id);
        load();
      }
    } catch (e: any) {
      toast.error("Konnte Link nicht speichern");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("saved_links").delete().eq("id", id);
    setLinks((p) => p.filter((l) => l.id !== id));
    setAiResults((p) => p?.filter((r) => r.id !== id) ?? null);
  };

  const runAiSearch = async () => {
    const q = search.trim();
    if (!q) { setAiResults(null); return; }
    if (links.length === 0) { toast.info("Du hast noch keine Links gespeichert."); return; }
    setAiSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("link-search", {
        body: {
          query: q,
          links: links.map((l) => ({
            id: l.id, title: l.title, url: l.url,
            description: l.description, summary: l.summary ?? l.content, tags: l.tags,
          })),
        },
      });
      if (error) throw error;
      setAiResults((data?.matches as any[]) ?? []);
      if ((data?.matches ?? []).length === 0) toast.info("Keine passenden Links gefunden");
    } catch {
      toast.error("KI-Suche fehlgeschlagen");
    } finally {
      setAiSearching(false);
    }
  };

  const filtered = useMemo(() => {
    if (aiResults) {
      const map = new Map(aiResults.map((r) => [r.id, r.reason]));
      return links
        .filter((l) => map.has(l.id))
        .sort((a, b) => aiResults.findIndex((r) => r.id === a.id) - aiResults.findIndex((r) => r.id === b.id))
        .map((l) => ({ ...l, _reason: map.get(l.id) }));
    }
    const q = search.trim().toLowerCase();
    if (!q) return links.map((l) => ({ ...l, _reason: undefined as string | undefined }));
    return links
      .filter((l) =>
        (l.title ?? "").toLowerCase().includes(q) ||
        (l.url ?? "").toLowerCase().includes(q) ||
        (l.summary ?? "").toLowerCase().includes(q) ||
        (l.content ?? "").toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
      )
      .map((l) => ({ ...l, _reason: undefined as string | undefined }));
  }, [links, search, aiResults]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
              <Link2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Links</h1>
              <p className="text-muted-foreground text-sm">{links.length} gespeichert · KI-Suche aktiv</p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary shadow-glow">
            <Plus className="mr-1 h-4 w-4" /> Link speichern
          </Button>
        </div>

        {/* AI search */}
        <div className="glass rounded-2xl p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder='z.B. "das Rezept mit den Linsen" oder "Steuer-Artikel"...'
                value={search}
                onChange={(e) => { setSearch(e.target.value); if (aiResults) setAiResults(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") runAiSearch(); }}
                className="pl-9 bg-background/50"
              />
              {aiResults && (
                <button
                  onClick={() => { setAiResults(null); setSearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button onClick={runAiSearch} disabled={aiSearching || !search.trim()} variant="outline">
              {aiSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">KI-Suche</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            💡 Beschreibe in eigenen Worten, was du suchst — die KI durchsucht Titel, Beschreibung, Tags und Zusammenfassung.
          </p>
        </div>

        {/* List */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((l) => (
              <motion.div
                key={l.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass rounded-2xl p-4 group flex flex-col gap-2"
              >
                <div className="flex items-start gap-3">
                  {l.kind === "tip" ? (
                    <div className="h-8 w-8 rounded-lg bg-gradient-accent grid place-items-center shrink-0">
                      <Lightbulb className="h-4 w-4 text-accent-foreground" />
                    </div>
                  ) : l.favicon ? (
                    <img src={l.favicon} alt="" className="h-8 w-8 rounded-lg shrink-0 bg-background border border-border/50" />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
                      <Link2 className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {l.url ? (
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-sm leading-tight hover:underline line-clamp-2 break-words"
                      >
                        {l.title || l.url}
                      </a>
                    ) : (
                      <div className="font-semibold text-sm leading-tight line-clamp-2 break-words">
                        {l.title || "KI-Tipp"}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground truncate">
                      {l.url ?? (l.kind === "tip" ? "💡 KI-Tipp" : "")}
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-muted" title="Öffnen">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button onClick={() => remove(l.id)} className="p-1.5 rounded hover:bg-destructive/20 hover:text-destructive" title="Löschen">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {l.content && (
                  <button
                    onClick={() => setDetail(l)}
                    className="text-left text-xs text-muted-foreground line-clamp-5 whitespace-pre-wrap hover:text-foreground transition-colors"
                  >
                    {l.content}
                  </button>
                )}
                {l.summary && !l.content && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{l.summary}</p>
                )}
                {l.description && !l.summary && !l.content && (
                  <p className="text-xs text-muted-foreground line-clamp-2 italic">{l.description}</p>
                )}
                {l.kind === "tip" && l.content && (
                  <button
                    onClick={() => setDetail(l)}
                    className="text-[11px] text-primary hover:underline self-start"
                  >
                    Ganzen Tipp lesen →
                  </button>
                )}
                {l.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {l.tags.slice(0, 5).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] gap-1">
                        <Tag className="h-2.5 w-2.5" /> {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {(l as any)._reason && (
                  <div className="text-[11px] text-primary border-t border-primary/20 pt-2 mt-1 flex items-start gap-1.5">
                    <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="italic">{(l as any)._reason}</span>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {l.kind === "tip" && <span className="mr-1.5">💡 Tipp</span>}
                  {format(parseISO(l.created_at), "dd.MM.yyyy", { locale: de })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            {aiResults ? "Keine KI-Treffer." : links.length === 0 ? "Noch keine Links — speichere deinen ersten 🔗" : "Nichts gefunden."}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Link speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="url">URL</Label>
              <Input id="url" placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Notiz (optional)</Label>
              <Textarea id="note" rows={2} placeholder="Was ist daran wichtig?" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              ✨ Die KI ergänzt automatisch Titel, Zusammenfassung und Tags.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={addLink} disabled={saving || !newUrl.trim()} className="bg-gradient-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
