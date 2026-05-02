import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, MessageSquare, Trash2, Send, Sparkles, Loader2, PanelLeftClose, PanelLeftOpen, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type Session = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lern-chat`;

export function LernChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    setMessages((data as Msg[]) ?? []);
  };

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_sessions").delete().eq("id", id);
    if (activeId === id) newChat();
    loadSessions();
    toast.success("Unterhaltung gelöscht");
  };

  const send = async () => {
    if (!input.trim() || !user || loading) return;
    const text = input.trim();
    setInput("");
    setLoading(true);

    let sessionId = activeId;
    // Create session if needed
    if (!sessionId) {
      const title = text.slice(0, 50);
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

    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Persist user message
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: text,
    });

    // Stream assistant
    setStreaming(true);
    let assistantText = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      abortRef.current = new AbortController();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (resp.status === 429) {
        toast.error("Zu viele Anfragen. Bitte kurz warten.");
        throw new Error("rate limited");
      }
      if (resp.status === 402) {
        toast.error("AI-Guthaben aufgebraucht.");
        throw new Error("payment");
      }
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
          session_id: sessionId,
          user_id: user.id,
          role: "assistant",
          content: assistantText,
        });
        await supabase
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);
        loadSessions();
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error(e);
        if (!assistantText) {
          setMessages((m) => m.slice(0, -1));
        }
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Toggle button when collapsed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-30 h-20 w-7 items-center justify-center rounded-r-xl bg-gradient-primary text-primary-foreground shadow-glow hover:w-8 transition-all"
          aria-label="Lern-Chat öffnen"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="hidden lg:flex sticky top-0 h-screen w-[360px] xl:w-[400px] shrink-0 flex-col border-r border-border/50 bg-sidebar/40 backdrop-blur-xl z-20"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 p-3 border-b border-border/50">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold gradient-text truncate">Lern-AI</div>
                  <div className="text-[10px] text-muted-foreground">Dein KI-Tutor</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={newChat} aria-label="Neue Unterhaltung">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Schließen">
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Sessions list */}
            {sessions.length > 0 && (
              <ScrollArea className="max-h-[180px] border-b border-border/50">
                <div className="p-2 space-y-1">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveId(s.id)}
                      className={cn(
                        "group w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                        activeId === s.id
                          ? "bg-gradient-primary text-primary-foreground"
                          : "hover:bg-sidebar-accent text-sidebar-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate flex-1">{s.title}</span>
                      <span
                        onClick={(e) => deleteSession(s.id, e)}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20",
                          activeId === s.id && "hover:bg-white/20"
                        )}
                      >
                        <Trash2 className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center mb-3">
                    <GraduationCap className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <h3 className="font-bold text-base mb-1">Hi! Wie kann ich helfen?</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Frag mich alles zu deinen Hausaufgaben, Lernstoff oder lass dir Themen erklären.
                  </p>
                  <div className="grid gap-2 w-full">
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
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {m.role === "assistant" && (
                      <div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-primary flex items-center justify-center mt-1">
                        <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        m.role === "user"
                          ? "bg-gradient-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border/50 rounded-bl-sm"
                      )}
                    >
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-code:text-xs">
                          {m.content ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                          ) : (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border/50 p-3">
              <div className="relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Frag den Lern-Tutor..."
                  rows={2}
                  disabled={loading}
                  className="resize-none pr-12 text-sm rounded-xl border-border/50 focus-visible:ring-primary/50"
                />
                <Button
                  size="icon"
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="absolute right-2 bottom-2 h-8 w-8 bg-gradient-primary hover:opacity-90"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Enter zum Senden · Shift+Enter für neue Zeile
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
