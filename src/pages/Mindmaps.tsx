import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus, Network, Trash2, ArrowLeft, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Mindmap {
  id: string;
  title: string;
  subject: string | null;
  updated_at: string;
}

export default function Mindmaps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [maps, setMaps] = useState<Mindmap[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("mindmaps")
      .select("id, title, subject, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setMaps((data as Mindmap[]) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user) return;
    const initialNodes = [
      { id: "1", type: "mind", position: { x: 250, y: 200 }, data: { label: "Hauptthema", color: "from-violet-500 to-purple-500", shape: "rounded" } },
    ];
    const { data, error } = await supabase
      .from("mindmaps")
      .insert({ user_id: user.id, title: "Neue Mindmap", nodes: initialNodes, edges: [] })
      .select()
      .single();
    if (error || !data) { toast.error("Fehler"); return; }
    navigate(`/mindmaps/${data.id}`);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("mindmaps").delete().eq("id", id);
    if (error) { toast.error("Löschen fehlgeschlagen"); return; }
    setMaps((p) => p.filter((m) => m.id !== id));
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-1 sm:px-0">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mindmaps</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Visualisiere Themen mit anpassbaren Knoten
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/notizen">
              <Button size="sm" variant="outline">
                <FileText className="mr-1 h-4 w-4" /> Notizen
              </Button>
            </Link>
            <Button size="sm" onClick={create} className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="mr-1 h-4 w-4" /> Mindmap
            </Button>
          </div>
        </div>

        {maps.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <Network className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground mb-4 text-sm">Noch keine Mindmaps.</p>
            <Button onClick={create} className="bg-gradient-primary text-primary-foreground">
              <Plus className="mr-1 h-4 w-4" /> Erste Mindmap erstellen
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence>
              {maps.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass rounded-2xl p-4 group cursor-pointer relative"
                  onClick={() => navigate(`/mindmaps/${m.id}`)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(m.id); }}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-muted/60 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex items-start gap-3 pr-8">
                    <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                      <Network className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{m.title}</h3>
                      {m.subject && (
                        <span className="inline-block text-[10px] mt-1 px-1.5 py-0.5 rounded bg-accent/20">
                          {m.subject}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(m.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
