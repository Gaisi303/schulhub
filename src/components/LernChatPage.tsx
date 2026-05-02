import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus, MessageSquare, Trash2, Send, Sparkles, Loader2,
  GraduationCap, Paperclip, X, Image as ImageIcon, FileText,
  FileImage, Presentation, Download, Wand2, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractFile, type ExtractedFile } from "@/lib/fileExtract";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type Attachment = { name: string; downloadUrl: string; mimeType: string; kind: "image" | "docx" | "pptx" };

type Msg = {
  role: "user" | "assistant";
  content: string | ContentPart[];
  attachments?: Attachment[];
};

type Session = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lern-chat`;
const MAX_FILES = 5;

export function LernChatPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [genBusy, setGenBusy] = useState<null | "image" | "docx" | "pptx">(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSessions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setSessions((data as Session[]) ?? []);
  };

  const loadMessages = async (sessionId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at");
    const parsed = (data ?? []).map((m: any) => {
      let content: Msg["content"] = m.content;
      let attachments: Attachment[] | undefined;
      if (typeof m.content === "string" && m.content.startsWith("{")) {
        try {
          const obj = JSON.parse(m.content);
          if (obj && typeof obj === "object" && "content" in obj) {
            content = obj.content;
            attachments = obj.attachments;
          }
        } catch { /* keep */ }
      } else if (typeof m.content === "string" && m.content.startsWith("[")) {
        try { content = JSON.parse(m.content); } catch { /* keep */ }
      }
      return { role: m.role, content, attachments } as Msg;
    });
    setMessages(parsed);
  };

  useEffect(() => { if (user) loadSessions(); }, [user]);
  useEffect(() => { activeId ? loadMessages(activeId) : setMessages([]); }, [activeId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const newChat = () => { setActiveId(null); setMessages([]); };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_sessions").delete().eq("id", id);
    if (activeId === id) newChat();
    loadSessions();
    toast.success("Unterhaltung gelöscht");
  };

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    const remaining = MAX_FILES - files.length;
    const slice = Array.from(list).slice(0, remaining);
    for (const f of slice) {
      try {
        const ex = await extractFile(f);
        setFiles((p) => [...p, ex]);
      } catch (e: any) {
        toast.error(e.message ?? "Datei konnte nicht gelesen werden");
      }
    }
  };

  const ensureSession = async (titleHint: string): Promise<string | null> => {
    if (!user) return null;
    if (activeId) return activeId;
    const title = titleHint.slice(0, 50) || "Neue Unterhaltung";
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title })
      .select("id, title, updated_at")
      .single();
    if (error || !data) { toast.error("Konnte Unterhaltung nicht erstellen"); return null; }
    setActiveId(data.id);
    setSessions((s) => [data as Session, ...s]);
    return data.id;
  };

  const persistMessage = async (sessionId: string, msg: Msg) => {
    const payload = msg.attachments?.length
      ? JSON.stringify({ content: msg.content, attachments: msg.attachments })
      : (typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
    await supabase.from("chat_messages").insert({
      session_id: sessionId, user_id: user!.id, role: msg.role, content: payload,
    });
    await supabase.from("chat_sessions")
      .update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
  };

  // ---------- Generation actions ----------
  const generateImage = async () => {
    const prompt = input.trim();
    if (!prompt || !user) return;
    setInput("");
    setGenBusy("image");
    const sessionId = await ensureSession(`Bild: ${prompt}`);
    if (!sessionId) { setGenBusy(null); return; }

    const userMsg: Msg = { role: "user", content: `🎨 Bild erstellen: ${prompt}` };
    setMessages((m) => [...m, userMsg]);
    await persistMessage(sessionId, userMsg);

    try {
      const { data, error } = await supabase.functions.invoke("generate-image", { body: { prompt } });
      if (error) throw error;
      if (!data?.imageUrl) throw new Error("Kein Bild");

      const attachments: Attachment[] = [{
        name: "Generiertes Bild.png", downloadUrl: data.imageUrl,
        mimeType: "image/png", kind: "image",
      }];
      const aMsg: Msg = {
        role: "assistant",
        content: `Hier ist dein Bild zu **${prompt}** ✨`,
        attachments,
      };
      setMessages((m) => [...m, aMsg]);
      await persistMessage(sessionId, aMsg);
      loadSessions();
    } catch (e: any) {
      toast.error(e?.message ?? "Bild-Generierung fehlgeschlagen");
    } finally {
      setGenBusy(null);
    }
  };

  const generateDoc = async (kind: "docx" | "pptx") => {
    const prompt = input.trim();
    if (!prompt || !user) return;
    setInput("");
    setGenBusy(kind);
    const label = kind === "docx" ? "Word-Dokument" : "PowerPoint-Präsentation";
    const sessionId = await ensureSession(`${label}: ${prompt}`);
    if (!sessionId) { setGenBusy(null); return; }

    const userMsg: Msg = {
      role: "user",
      content: `${kind === "docx" ? "📄" : "🖼️"} ${label} erstellen: ${prompt}`,
    };
    setMessages((m) => [...m, userMsg]);
    await persistMessage(sessionId, userMsg);

    try {
      const fn = kind === "docx" ? "generate-docx" : "generate-pptx";
      const { data, error } = await supabase.functions.invoke(fn, { body: { prompt } });
      if (error) throw error;
      if (!data?.base64) throw new Error("Datei konnte nicht erstellt werden");

      const downloadUrl = `data:${data.mimeType};base64,${data.base64}`;
      const attachments: Attachment[] = [{
        name: data.filename, downloadUrl, mimeType: data.mimeType, kind,
      }];
      const aMsg: Msg = {
        role: "assistant",
        content: `Fertig! Hier ist dein ${label}: **${data.title}** 🎉\n\nKlicke unten zum Herunterladen.`,
        attachments,
      };
      setMessages((m) => [...m, aMsg]);
      await persistMessage(sessionId, aMsg);
      loadSessions();
    } catch (e: any) {
      toast.error(e?.message ?? "Generierung fehlgeschlagen");
    } finally {
      setGenBusy(null);
    }
  };

  // ---------- Chat send ----------
  const send = async () => {
    if ((!input.trim() && files.length === 0) || !user || loading) return;
    const userText = input.trim();
    const attachedFiles = files;
    setInput("");
    setFiles([]);
    setLoading(true);

    const sessionId = await ensureSession(userText || "Datei-Frage");
    if (!sessionId) { setLoading(false); return; }

    // Build user content: text + image parts. Documents are folded into text context.
    const imgFiles = attachedFiles.filter((f) => f.kind === "image" && f.dataUrl);
    const docFiles = attachedFiles.filter((f) => f.kind !== "image" && f.text);

    let composedText = userText;
    if (docFiles.length) {
      const ctx = docFiles.map((f) => `--- DATEI: ${f.name} ---\n${f.text!.slice(0, 30000)}`).join("\n\n");
      composedText = `${userText}\n\n[Kontext aus angehängten Dateien]\n${ctx}`.trim();
    }

    let userContent: Msg["content"];
    if (imgFiles.length > 0) {
      const parts: ContentPart[] = imgFiles.map((f) => ({
        type: "image_url" as const, image_url: { url: f.dataUrl! },
      }));
      if (composedText) parts.push({ type: "text", text: composedText });
      userContent = parts;
    } else {
      userContent = composedText;
    }

    // Display message uses the original (visible) text + image previews — NOT the long doc context
    const visibleParts: ContentPart[] = [
      ...imgFiles.map((f) => ({ type: "image_url" as const, image_url: { url: f.dataUrl! } })),
      ...(userText ? [{ type: "text" as const, text: userText }] : []),
    ];
    const docNames = docFiles.map((f) => f.name);

    const displayMsg: Msg = {
      role: "user",
      content: visibleParts.length ? visibleParts : userText,
      attachments: docNames.map((n) => ({
        name: n, downloadUrl: "", mimeType: "application/octet-stream", kind: "docx" as const,
      })),
    };

    const newMessages = [...messages, { role: "user" as const, content: userContent }];
    setMessages((m) => [...m, displayMsg]);

    // Persist visible version
    await supabase.from("chat_messages").insert({
      session_id: sessionId, user_id: user.id, role: "user",
      content: JSON.stringify({
        content: displayMsg.content,
        attachments: displayMsg.attachments,
      }),
    });

    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    let assistantText = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (resp.status === 429) { toast.error("Zu viele Anfragen."); throw new Error("rate"); }
      if (resp.status === 402) { toast.error("AI-Guthaben aufgebraucht."); throw new Error("pay"); }
      if (!resp.ok || !resp.body) throw new Error("Stream fehlgeschlagen");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((m) => {
                const c = [...m];
                c[c.length - 1] = { role: "assistant", content: assistantText };
                return c;
              });
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }

      if (assistantText) {
        await supabase.from("chat_messages").insert({
          session_id: sessionId, user_id: user.id, role: "assistant", content: assistantText,
        });
        await supabase.from("chat_sessions")
          .update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
        loadSessions();
      }
    } catch (e) {
      console.error(e);
      if (!assistantText) setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && !genBusy) send();
    }
  };

  const isBusy = loading || genBusy !== null;

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-7.5rem)] md:h-[calc(100vh-8.5rem)] flex gap-4">
      {/* Sessions sidebar (hidden on small) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col glass rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-border/50 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verlauf</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={newChat} aria-label="Neue Unterhaltung">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-3">Noch keine Unterhaltungen.</p>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "group w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                  activeId === s.id
                    ? "bg-gradient-primary text-primary-foreground"
                    : "hover:bg-sidebar-accent"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{s.title}</span>
                <span
                  onClick={(e) => deleteSession(s.id, e)}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded",
                    activeId === s.id ? "hover:bg-white/20" : "hover:bg-destructive/20"
                  )}
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col glass rounded-2xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-3 border-b border-border/50">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold gradient-text truncate">Lern-AI</div>
              <div className="text-[10px] text-muted-foreground">Gemini · Chat, Bilder, Word, PowerPoint</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={newChat} className="md:hidden">
            <Plus className="h-3.5 w-3.5 mr-1" /> Neu
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <EmptyState onPick={(s) => setInput(s)} />
          ) : (
            messages.map((m, i) => <MessageBubble key={i} msg={m} />)
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border/50 p-3 space-y-2">
          {files.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {files.map((f, i) => (
                <FilePreview
                  key={i}
                  file={f}
                  onRemove={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          )}
          <div className="rounded-xl border border-border/50 bg-background focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Frage stellen, Datei anhängen oder Bild/Word/Slides erstellen..."
              rows={2}
              disabled={isBusy}
              className="resize-none border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none min-h-[56px]"
            />
            <input
              ref={fileRef} type="file" multiple className="hidden"
              accept="image/*,.pdf,.docx,.txt,.md,.csv"
              onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-0.5">
                <Button
                  size="icon" variant="ghost" type="button" className="h-8 w-8"
                  onClick={() => fileRef.current?.click()}
                  disabled={isBusy || files.length >= MAX_FILES}
                  aria-label="Datei anhängen"
                  title="Bild, PDF oder Word anhängen"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon" variant="ghost" type="button" className="h-8 w-8"
                      disabled={isBusy || !input.trim()}
                      aria-label="Erstellen"
                      title="Bild / Word / PowerPoint erstellen"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={generateImage}>
                      <ImageIcon className="h-4 w-4 mr-2" /> Bild erstellen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => generateDoc("docx")}>
                      <FileText className="h-4 w-4 mr-2" /> Word-Dokument erstellen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => generateDoc("pptx")}>
                      <Presentation className="h-4 w-4 mr-2" /> PowerPoint erstellen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                size="icon" onClick={send}
                disabled={(!input.trim() && files.length === 0) || isBusy}
                className="h-8 w-8 bg-gradient-primary hover:opacity-90"
              >
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            📎 Anhängen · 🪄 Tippe etwas und wähle "erstellen" für Bild/Word/PPT · Enter = senden
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Subcomponents ----------

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    "Erkläre mir die Mitternachtsformel mit Beispielen",
    "Hilf mir bei englischer Grammatik",
    "Erstelle ein Bild von einer Photosynthese-Skizze",
    "Erstelle eine PowerPoint über den Wasserkreislauf",
    "Erstelle ein Word-Dokument: Zusammenfassung des Imperialismus",
  ];
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="h-16 w-16 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center mb-4">
        <GraduationCap className="h-8 w-8 text-primary-foreground" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Hi! Wie kann ich helfen?</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Frag mich alles, lade Aufgaben (Bild/PDF/Word) hoch oder lass mich Bilder, Word-Dokumente oder PowerPoints erstellen.
      </p>
      <div className="grid gap-2 w-full max-w-lg">
        {suggestions.map((s) => (
          <button
            key={s} onClick={() => onPick(s)}
            className="text-left text-sm px-4 py-2.5 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const text = typeof msg.content === "string"
    ? msg.content
    : msg.content.filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text").map((p) => p.text).join("\n");
  const imgs = typeof msg.content === "string"
    ? []
    : msg.content.filter((p): p is Extract<ContentPart, { type: "image_url" }> => p.type === "image_url").map((p) => p.image_url.url);

  return (
    <div className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
      {msg.role === "assistant" && (
        <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-primary flex items-center justify-center mt-1">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm space-y-2",
          msg.role === "user"
            ? "bg-gradient-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border/50 rounded-bl-sm"
        )}
      >
        {imgs.length > 0 && (
          <div className={cn("grid gap-1.5", imgs.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {imgs.map((src, i) => (
              <img key={i} src={src} alt="" className="rounded-lg max-h-64 w-full object-cover" />
            ))}
          </div>
        )}
        {msg.role === "assistant" ? (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-code:text-xs">
            {text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
        ) : (
          text && <p className="whitespace-pre-wrap break-words">{text}</p>
        )}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {msg.attachments.map((a, i) => (
              <AttachmentChip key={i} att={a} dark={msg.role === "user"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentChip({ att, dark }: { att: Attachment; dark: boolean }) {
  const Icon = att.kind === "image" ? FileImage : att.kind === "pptx" ? Presentation : FileText;

  // For generated images, show preview
  if (att.kind === "image" && att.downloadUrl) {
    return (
      <div className="space-y-1.5">
        <img src={att.downloadUrl} alt={att.name} className="rounded-lg max-h-80 w-full object-cover" />
        <a
          href={att.downloadUrl} download={att.name}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors",
            dark ? "bg-white/20 hover:bg-white/30" : "bg-muted hover:bg-muted/80"
          )}
        >
          <Download className="h-3 w-3" /> Bild speichern
        </a>
      </div>
    );
  }

  if (!att.downloadUrl) {
    // attached doc placeholder (user upload)
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg",
        dark ? "bg-white/20" : "bg-muted"
      )}>
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{att.name}</span>
      </div>
    );
  }

  return (
    <a
      href={att.downloadUrl} download={att.name}
      className={cn(
        "flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors",
        dark
          ? "border-white/30 bg-white/10 hover:bg-white/20"
          : "border-border/50 bg-background hover:bg-muted"
      )}
    >
      <div className={cn(
        "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
        att.kind === "pptx" ? "bg-warning/20 text-warning" : "bg-accent/20 text-accent"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{att.name}</div>
        <div className={cn("text-[10px] opacity-70")}>{att.kind === "pptx" ? "PowerPoint" : "Word-Dokument"}</div>
      </div>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
}

function FilePreview({ file, onRemove }: { file: ExtractedFile; onRemove: () => void }) {
  if (file.kind === "image" && file.dataUrl) {
    return (
      <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/50">
        <img src={file.dataUrl} alt="" className="h-full w-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }
  const Icon = file.kind === "pdf" ? FileText : FileText;
  return (
    <div className="relative flex items-center gap-2 px-2.5 py-1.5 pr-7 rounded-lg border border-border/50 bg-card text-xs max-w-[200px]">
      <Icon className="h-3.5 w-3.5 shrink-0 text-accent" />
      <span className="truncate">{file.name}</span>
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 h-5 w-5 rounded-full hover:bg-destructive/20 flex items-center justify-center"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
