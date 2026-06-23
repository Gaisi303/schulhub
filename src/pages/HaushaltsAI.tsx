import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bookmark, ChefHat, Loader2, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type Session = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/haushalts-chat`;

const SUGGESTIONS = [
  "Wie entferne ich Rotweinflecken aus weißem Stoff?",
  "Wie pflege ich eine Monstera richtig?",
  "Schneller Wochenplan mit 4 günstigen Rezepten",
  "Wie spare ich Strom bei Wäsche & Geschirrspüler?",
  "Was kann ich aus Hähnchen, Reis und Zucchini kochen?",
];

export default function HaushaltsAI() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .eq("area", "private")
      .order("updated_at", { ascending: false });
    setSessions((data as Session[]) ?? []);
  };

  const loadMessages = async (sessionId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at");
    setMessages(((data as any[]) ?? []).map((m) => ({ role: m.role, content: m.content })));
  };

  useEffect(() => { if (user) loadSessions(); }, [user]);
  useEffect(() => { activeId ? loadMessages(activeId) : setMessages([]); }, [activeId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const newChat = () => { setActiveId(null); setMessages([]); };

  const saveTip = async (content: string) => {
    if (!user || !content.trim()) return;
    // Derive a short title from the user's preceding question, or the first line.
    let defaultTitle = "";
    const idx = messages.findIndex((m) => m.role === "assistant" && m.content === content);
    if (idx > 0) defaultTitle = messages[idx - 1]?.content ?? "";
    if (!defaultTitle) defaultTitle = content.split("\n").find((l) => l.trim())?.replace(/[#*_>`-]/g, "").trim() ?? "KI-Tipp";
    const title = window.prompt("Titel für diesen Tipp:", defaultTitle.slice(0, 80))?.trim();
    if (!title) return;
    const { error } = await supabase.from("saved_links").insert({
      user_id: user.id,
      area: "private",
      kind: "tip",
      url: null,
      title,
      content,
      summary: content.slice(0, 400),
      tags: ["haushalt", "ki-tipp"],
    } as any);
    if (error) { toast.error("Konnte Tipp nicht speichern"); return; }
    toast.success("Tipp bei Links gespeichert ✨");
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_sessions").delete().eq("id", id);
    if (activeId === id) newChat();
    loadSessions();
  };

  const ensureSession = async (titleHint: string) => {
    if (!user) return null;
    if (activeId) return activeId;
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: titleHint.slice(0, 50) || "Neue Frage", area: "private" })
      .select("id, title, updated_at")
      .single();
    if (error || !data) { toast.error("Konnte nicht starten"); return null; }
    setActiveId(data.id);
    setSessions((s) => [data as Session, ...s]);
    return data.id;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !user || loading) return;
    setInput("");
    setLoading(true);

    const sessionId = await ensureSession(text);
    if (!sessionId) { setLoading(false); return; }

    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    await supabase.from("chat_messages").insert({
      session_id: sessionId, user_id: user.id, role: "user", content: text,
    });

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
      if (resp.status === 402) { toast.error("KI-Guthaben aufgebraucht."); throw new Error("pay"); }
      if (!resp.ok || !resp.body) throw new Error("Stream fehlgeschlagen");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
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
          } catch { /* partial */ }
        }
      }

      if (assistantText) {
        await supabase.from("chat_messages").insert({
          session_id: sessionId, user_id: user.id, role: "assistant", content: assistantText,
        });
        await supabase.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
        loadSessions();
      }
    } catch (e) {
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
    <AppLayout>
      <div className="max-w-7xl mx-auto h-[calc(100vh-7.5rem)] md:h-[calc(100vh-8.5rem)] flex gap-4 min-w-0 overflow-x-hidden">
        <aside className="hidden md:flex w-64 shrink-0 flex-col glass rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verlauf</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={newChat}>
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
                    "group grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors",
                    activeId === s.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-sidebar-accent"
                  )}
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 whitespace-normal break-words leading-snug">{s.title}</span>
                  <span
                    onClick={(e) => deleteSession(s.id, e)}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 p-1 rounded shrink-0",
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

        <div className="flex-1 flex flex-col glass rounded-2xl overflow-hidden min-w-0">
          <div className="flex items-center gap-2 p-3 border-b border-border/50">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
              <ChefHat className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold gradient-text leading-tight">Haushalts-AI</div>
              <div className="text-[10px] text-muted-foreground">Rezepte · Reinigen · Pflanzen · Sparen · Organisation</div>
            </div>
            <Button size="icon" variant="ghost" className="ml-auto h-9 w-9 md:hidden" onClick={newChat}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-primary shadow-glow grid place-items-center mb-4">
                  <ChefHat className="h-8 w-8 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Frag mich alles rund um den Haushalt</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  Rezepte, Putzen, Wäsche, Pflanzen, Energiesparen, Organisation — ich helfe gerne.
                </p>
                <div className="grid gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left text-sm px-4 py-2.5 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" && (
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-primary grid place-items-center mt-1">
                      <ChefHat className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className={cn(
                    "min-w-0 max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm break-words",
                    m.role === "user"
                      ? "bg-gradient-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border/50 rounded-bl-sm"
                  )}>
                    {m.role === "assistant" ? (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2">
                          {m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        </div>
                        {m.content && !loading && (
                          <button
                            onClick={() => saveTip(m.content)}
                            className="mt-2 -mb-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
                            title="Diesen Tipp bei Links speichern"
                          >
                            <Bookmark className="h-3 w-3" />
                            Bei Links speichern
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border/50 p-3">
            <div className="rounded-xl border border-border/50 bg-background focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Frag etwas zum Thema Haushalt..."
                rows={2}
                disabled={loading}
                className="resize-none border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none min-h-[56px]"
              />
              <div className="flex items-center justify-end px-2 pb-2">
                <Button size="icon" onClick={send} disabled={!input.trim() || loading} className="h-8 w-8 bg-gradient-primary hover:opacity-90">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
