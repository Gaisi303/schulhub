import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useArea } from "@/hooks/useArea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { NoteEditor } from "@/components/NoteEditor";
import { SUBJECTS } from "@/lib/constants";
import {
  Plus, Trash2, FileText, Search, ArrowLeft, Network, Folder, FolderPlus,
  Inbox, FolderOpen, MoreVertical, Pencil, FolderInput,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Note {
  id: string;
  title: string;
  content: string;
  subject: string | null;
  folder: string | null;
  updated_at: string;
}

const ALL = "__all__";
const NONE = "__none__";

export default function Notes() {
  const { user } = useAuth();
  const { area } = useArea();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showListMobile, setShowListMobile] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>(ALL);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const saveTimer = useRef<number | null>(null);

  const active = useMemo(() => notes.find((n) => n.id === activeId) || null, [notes, activeId]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => { if (n.folder) set.add(n.folder); });
    extraFolders.forEach((f) => set.add(f));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [notes, extraFolders]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .eq("area", area)
      .order("updated_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
  };
  useEffect(() => { setActiveId(null); setExtraFolders([]); setSelectedFolder(ALL); load(); }, [user, area]);

  const createNote = async () => {
    if (!user) return;
    const folder = selectedFolder !== ALL && selectedFolder !== NONE ? selectedFolder : null;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: user.id, title: "Neue Notiz", content: "", folder, area })
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

  const moveNote = async (noteId: string, folder: string | null) => {
    setNotes((p) => p.map((n) => (n.id === noteId ? { ...n, folder } : n)));
    const { error } = await supabase.from("notes").update({ folder }).eq("id", noteId);
    if (error) toast.error("Verschieben fehlgeschlagen");
    else toast.success(folder ? `Verschoben nach „${folder}"` : "Aus Ordner entfernt");
  };

  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.includes(name)) { toast.error("Ordner existiert bereits"); return; }
    setExtraFolders((p) => [...p, name]);
    setNewFolderName("");
    setNewFolderOpen(false);
    setSelectedFolder(name);
  };

  const renameFolder = async (oldName: string) => {
    const name = renameValue.trim();
    if (!name || name === oldName) { setRenameOpen(null); return; }
    if (folders.includes(name)) { toast.error("Ordner existiert bereits"); return; }
    const { error } = await supabase
      .from("notes")
      .update({ folder: name })
      .eq("user_id", user!.id)
      .eq("folder", oldName);
    if (error) { toast.error("Umbenennen fehlgeschlagen"); return; }
    setNotes((p) => p.map((n) => (n.folder === oldName ? { ...n, folder: name } : n)));
    setExtraFolders((p) => p.map((f) => (f === oldName ? name : f)));
    if (selectedFolder === oldName) setSelectedFolder(name);
    setRenameOpen(null);
    toast.success("Ordner umbenannt");
  };

  const deleteFolder = async (name: string) => {
    const inFolder = notes.filter((n) => n.folder === name);
    if (inFolder.length > 0) {
      const { error } = await supabase
        .from("notes")
        .update({ folder: null })
        .eq("user_id", user!.id)
        .eq("folder", name);
      if (error) { toast.error("Löschen fehlgeschlagen"); return; }
      setNotes((p) => p.map((n) => (n.folder === name ? { ...n, folder: null } : n)));
    }
    setExtraFolders((p) => p.filter((f) => f !== name));
    if (selectedFolder === name) setSelectedFolder(ALL);
    toast.success("Ordner gelöscht");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = notes;
    if (selectedFolder === NONE) arr = arr.filter((n) => !n.folder);
    else if (selectedFolder !== ALL) arr = arr.filter((n) => n.folder === selectedFolder);
    if (!q) return arr;
    return arr.filter((n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.subject || "").toLowerCase().includes(q)
    );
  }, [notes, search, selectedFolder]);

  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const folderCount = (name: string | null) =>
    notes.filter((n) => (name === null ? !n.folder : n.folder === name)).length;

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

        <div className="grid md:grid-cols-[200px_280px_1fr] gap-4">
          {/* Folder sidebar */}
          <div className={`${active && !showListMobile ? "hidden md:block" : "block"} space-y-2`}>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ordner</span>
              <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
                <DialogTrigger asChild>
                  <button className="h-6 w-6 rounded-md hover:bg-muted inline-flex items-center justify-center" aria-label="Neuer Ordner">
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Neuer Ordner</DialogTitle></DialogHeader>
                  <Input
                    autoFocus
                    placeholder="z.B. Schule, Privat, Projekte..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addFolder(); }}
                  />
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>Abbrechen</Button>
                    <Button onClick={addFolder}>Erstellen</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="glass rounded-2xl p-2 space-y-0.5">
              <FolderRow
                icon={<Inbox className="h-4 w-4" />}
                label="Alle Notizen"
                count={notes.length}
                active={selectedFolder === ALL}
                onClick={() => setSelectedFolder(ALL)}
              />
              <FolderRow
                icon={<FileText className="h-4 w-4" />}
                label="Ohne Ordner"
                count={folderCount(null)}
                active={selectedFolder === NONE}
                onClick={() => setSelectedFolder(NONE)}
              />
              {folders.length > 0 && <div className="h-px bg-border/50 my-1" />}
              {folders.map((f) => (
                <div key={f} className="group/folder flex items-center">
                  <FolderRow
                    icon={selectedFolder === f ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                    label={f}
                    count={folderCount(f)}
                    active={selectedFolder === f}
                    onClick={() => setSelectedFolder(f)}
                    className="flex-1"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-7 w-7 rounded-md opacity-0 group-hover/folder:opacity-100 hover:bg-muted inline-flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setRenameValue(f); setRenameOpen(f); }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Umbenennen
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteFolder(f)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>

            <Dialog open={!!renameOpen} onOpenChange={(o) => !o && setRenameOpen(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Ordner umbenennen</DialogTitle></DialogHeader>
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && renameOpen) renameFolder(renameOpen); }}
                />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setRenameOpen(null)}>Abbrechen</Button>
                  <Button onClick={() => renameOpen && renameFolder(renameOpen)}>Speichern</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

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
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`relative group ${activeId === n.id ? "bg-primary/10" : "hover:bg-muted/40"} transition-colors`}
                    >
                      <button
                        onClick={() => { setActiveId(n.id); setShowListMobile(false); }}
                        className="w-full text-left p-3"
                      >
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{n.title || "Ohne Titel"}</div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {stripHtml(n.content) || "Leere Notiz"}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {n.folder && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary inline-flex items-center gap-1">
                                  <Folder className="h-2.5 w-2.5" /> {n.folder}
                                </span>
                              )}
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
                        </div>
                      </button>
                      <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1 rounded hover:bg-muted"
                              aria-label="Verschieben"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <FolderInput className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => moveNote(n.id, null)}>
                              <Inbox className="h-3.5 w-3.5 mr-2" /> Ohne Ordner
                            </DropdownMenuItem>
                            {folders.length > 0 && <DropdownMenuSeparator />}
                            {folders.map((f) => (
                              <DropdownMenuItem key={f} onClick={() => moveNote(n.id, f)}>
                                <Folder className="h-3.5 w-3.5 mr-2" /> {f}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }}
                          className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
                          aria-label="Löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
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
                    value={active.folder ?? NONE}
                    onValueChange={(v) => patchActive({ folder: v === NONE ? null : v })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Ordner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Kein Ordner</SelectItem>
                      {folders.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={active.subject ?? "none"}
                    onValueChange={(v) => patchActive({ subject: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="w-[160px]">
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

function FolderRow({
  icon, label, count, active, onClick, className = "",
}: {
  icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`${className} w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors ${
        active ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted/60"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}
