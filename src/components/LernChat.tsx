import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus, MessageSquare, Trash2, Send, Sparkles, Loader2,
  GraduationCap, ImagePlus, X, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- types ---
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type Msg = { role: "user" | "assistant"; content: string | ContentPart[] };
type Session = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lern-chat`;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// --- helpers ---
const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const extractText = (c: Msg["content"]) =>
  typeof c === "string"
    ? c
    : c.filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
        .map((p) => p.text).join("\n");

const extractImages = (c: Msg["content"]) =>
  typeof c === "string"
    ? []
    : c.filter((p): p is Extract<ContentPart, { type: "image_url" }> => p.type === "image_url")
        .map((p) => p.image_url.url);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LernChat({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]); // data URLs
  const [loading, setLoading] = useState(false);
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
    // content is stored as JSON string for multimodal, fallback to plain string
    const parsed = (data ?? []).map((m: any) => {
      let c: Msg["content"] = m.content;
      if (typeof m.content === "string" && m.content.startsWith("[")) {
        try { c = JSON.parse(m.content); } catch { /* keep string */ }
      }
      return { role: m.role, content: c } as Msg;
    });
    setMessages(parsed);
  };

  useEffect(() => { if (user && open) loadSessions(); }, [user, open]);
  useEffect(() => { activeId ? loadMessages(activeId) : setMessages([]); }, [activeId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_sessions").delete().eq("id", id);
    if (activeId === id) newChat();
    loadSessions();
    toast.success("Unterhaltung gelöscht");
  };

  const onPickImages = async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_IMAGES - images.length;
    const slice = Array.from(files).slice(0, remaining);
    const next: string[] = [];
    for (const f of slice) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`${f.name} ist zu groß (max 5MB)`);
        continue;
      }
      next.push(await fileToDataUrl(f));
    }
    if (next.length) setImages((p) => [...p, ...next]);
  };

  const send = async () => {
    if ((!input.trim() && images.length === 0) || !user || loading) return;
    const text = input.trim();
    const imgs = images;
    setInput("");
    setImages([]);
    setLoading(true);

    let sessionId = activeId;
    if (!sessionId) {
      const title = (text || "Bild-Frage").slice(0, 50);
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, title })
        .select("id, title, updated_at")
        .single();
      if (error || !data) {
        toast.error("Konnte Unterhaltung nicht erstellen");
        setLoading(false);
        return;
      }
      sessionId = data.id;
      setActiveId(sessionId);
      setSessions((s) => [data as Session, ...s]);
    }

    // Build user message (multimodal if images present)
    let userContent: Msg["content"];
    if (imgs.length > 0) {
      const parts: ContentPart[] = imgs.map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      }));
      if (text) parts.push({ type: "text", text });
      userContent = parts;
    } else {
      userContent = text;
    }

    const userMsg: Msg = { role: "user", content: userContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Persist user message
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: typeof userContent === "string" ? userContent : JSON.stringify(userContent),
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

      if (resp.status === 429) { toast.error("Zu viele Anfragen. Bitte kurz warten."); throw new Error("rate"); }
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
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: assistantText };
                return copy;
              });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
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
      send();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 w-full sm:max-w-md md:max-w-lg flex flex-col gap-0"
      >
        <SheetTitle className="sr-only">Lern-AI Chat</SheetTitle>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-3 pr-12 border-b border-border/50">
          <div className="flex items-center gap-2 min-w-0">
            {showHistory ? (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowHistory(false)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold gradient-text truncate">
                {showHistory ? "Verlauf" : "Lern-AI"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {showHistory ? `${sessions.length} Unterhaltungen` : "Dein KI-Tutor (Gemini)"}
              </div>
            </div>
          </div>
          {!showHistory && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowHistory(true)} aria-label="Verlauf">
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={newChat} aria-label="Neue Unterhaltung">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* History view */}
        {showHistory ? (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sessions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Noch keine Unterhaltungen.</p>
              )}
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setActiveId(s.id); setShowHistory(false); }}
                  className={cn(
                    "group w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    activeId === s.id
                      ? "bg-gradient-primary text-primary-foreground"
                      : "hover:bg-sidebar-accent"
                  )}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">{s.title}</span>
                  <span
                    onClick={(e) => deleteSession(s.id, e)}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20",
                      activeId === s.id && "hover:bg-white/20"
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center mb-3">
                    <GraduationCap className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <h3 className="font-bold text-base mb-1">Hi! Wie kann ich helfen?</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Frag mich alles oder lade ein Foto deiner Aufgabe hoch.
                  </p>
                  <div className="grid gap-2 w-full max-w-sm">
                    {[
                      "Erkläre mir die Mitternachtsformel",
                      "Wie funktioniert Photosynthese?",
                      "Hilf mir bei englischer Grammatik",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="text-left text-xs px-3 py-2 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => {
                  const text = extractText(m.content);
                  const imgs = extractImages(m.content);
                  return (
                    <div
                      key={i}
                      className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      {m.role === "assistant" && (
                        <div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-primary flex items-center justify-center mt-1">
                          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm space-y-2",
                          m.role === "user"
                            ? "bg-gradient-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border border-border/50 rounded-bl-sm"
                        )}
                      >
                        {imgs.length > 0 && (
                          <div className={cn("grid gap-1", imgs.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                            {imgs.map((src, idx) => (
                              <img key={idx} src={src} alt="" className="rounded-lg max-h-48 w-full object-cover" />
                            ))}
                          </div>
                        )}
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-code:text-xs">
                            {text ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                            ) : (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                          </div>
                        ) : (
                          text && <p className="whitespace-pre-wrap break-words">{text}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border/50 p-3 space-y-2">
              {images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {images.map((src, i) => (
                    <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/50">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Frag den Lern-Tutor..."
                  rows={2}
                  disabled={loading}
                  className="resize-none pl-10 pr-12 text-sm rounded-xl border-border/50 focus-visible:ring-primary/50"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { onPickImages(e.target.files); e.target.value = ""; }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={loading || images.length >= MAX_IMAGES}
                  className="absolute left-1.5 bottom-1.5 h-8 w-8"
                  aria-label="Bild hochladen"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={send}
                  disabled={(!input.trim() && images.length === 0) || loading}
                  className="absolute right-2 bottom-2 h-8 w-8 bg-gradient-primary hover:opacity-90"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Enter senden · Shift+Enter neue Zeile · 🖼️ bis zu {MAX_IMAGES} Bilder
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
