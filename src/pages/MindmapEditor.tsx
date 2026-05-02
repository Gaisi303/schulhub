import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  ReactFlowProvider,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MindNode, MindNodeData } from "@/components/mindmap/MindNode";
import { SUBJECTS } from "@/lib/constants";
import { ArrowLeft, Plus, Trash2, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  { name: "Lila", value: "from-violet-500 to-purple-500" },
  { name: "Blau", value: "from-blue-500 to-cyan-500" },
  { name: "Grün", value: "from-emerald-500 to-teal-500" },
  { name: "Orange", value: "from-amber-500 to-orange-500" },
  { name: "Pink", value: "from-rose-500 to-pink-500" },
  { name: "Rot", value: "from-red-500 to-orange-600" },
  { name: "Indigo", value: "from-indigo-500 to-blue-600" },
  { name: "Limette", value: "from-lime-500 to-green-600" },
  { name: "Schiefer", value: "from-slate-500 to-slate-700" },
];

const SHAPES: MindNodeData["shape"][] = ["rounded", "pill", "square", "diamond"];
const SHAPE_LABEL: Record<MindNodeData["shape"], string> = {
  rounded: "Rund",
  pill: "Pille",
  square: "Eckig",
  diamond: "Raute",
};

const nodeTypes = { mind: MindNode };

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node<MindNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  // Load
  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("mindmaps")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) {
        toast.error("Mindmap nicht gefunden");
        navigate("/mindmaps");
        return;
      }
      setTitle(data.title);
      setSubject(data.subject);
      const loadedNodes = ((data.nodes as any[]) ?? []).map((n) => ({ ...n, type: "mind" }));
      setNodes(loadedNodes);
      setEdges((data.edges as any[]) ?? []);
      setLoading(false);
    })();
  }, [id, user, navigate]);

  // Debounced save
  const scheduleSave = useCallback(
    (patch: { title?: string; subject?: string | null; nodes?: Node[]; edges?: Edge[] }) => {
      if (!id) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      setSaving(true);
      saveTimer.current = window.setTimeout(async () => {
        const payload: any = {};
        if (patch.title !== undefined) payload.title = patch.title;
        if (patch.subject !== undefined) payload.subject = patch.subject;
        if (patch.nodes !== undefined) payload.nodes = patch.nodes;
        if (patch.edges !== undefined) payload.edges = patch.edges;
        await supabase.from("mindmaps").update(payload).eq("id", id);
        setSaving(false);
      }, 600);
    },
    [id]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds) as Node<MindNodeData>[];
        scheduleSave({ nodes: next });
        return next;
      });
    },
    [scheduleSave]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        scheduleSave({ edges: next });
        return next;
      });
    },
    [scheduleSave]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          { ...conn, animated: false, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } },
          eds
        );
        scheduleSave({ edges: next });
        return next;
      });
    },
    [scheduleSave]
  );

  const addNode = () => {
    const newId = crypto.randomUUID();
    const base = selectedNode || nodes[nodes.length - 1];
    const pos = base
      ? { x: base.position.x + 220, y: base.position.y + Math.random() * 100 - 50 }
      : { x: 250, y: 250 };
    const newNode: Node<MindNodeData> = {
      id: newId,
      type: "mind",
      position: pos,
      data: { label: "Neuer Knoten", color: "from-blue-500 to-cyan-500", shape: "rounded" },
    };
    setNodes((nds) => {
      const next = [...nds, newNode];
      scheduleSave({ nodes: next });
      return next;
    });
    if (selectedNode) {
      setEdges((eds) => {
        const next = addEdge(
          { source: selectedNode.id, target: newId, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } },
          eds
        );
        scheduleSave({ edges: next });
        return next;
      });
    }
    setSelectedNodeId(newId);
  };

  const updateSelected = (patch: Partial<MindNodeData>) => {
    if (!selectedNode) return;
    setNodes((nds) => {
      const next = nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, ...patch } } : n
      );
      scheduleSave({ nodes: next });
      return next;
    });
  };

  const deleteSelected = () => {
    if (!selectedNode) return;
    setNodes((nds) => {
      const next = nds.filter((n) => n.id !== selectedNode.id);
      scheduleSave({ nodes: next });
      return next;
    });
    setEdges((eds) => {
      const next = eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id);
      scheduleSave({ edges: next });
      return next;
    });
    setSelectedNodeId(null);
  };

  const autoLayout = () => {
    // Simple radial layout: first node center, others around in a circle
    if (nodes.length === 0) return;
    const center = { x: 400, y: 300 };
    const others = nodes.slice(1);
    const radius = Math.max(220, others.length * 30);
    const next = nodes.map((n, i) => {
      if (i === 0) return { ...n, position: center };
      const angle = ((i - 1) / others.length) * 2 * Math.PI;
      return {
        ...n,
        position: { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius },
      };
    });
    setNodes(next);
    scheduleSave({ nodes: next });
    toast.success("Automatisch angeordnet");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center text-muted-foreground py-20">Lädt...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-1 sm:px-0">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <button
            onClick={() => navigate("/mindmaps")}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-muted hover:bg-muted/70"
            aria-label="Zurück"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }); }}
            className="flex-1 min-w-[160px] text-lg font-semibold border-0 bg-transparent focus-visible:ring-0 px-0"
          />
          <Select
            value={subject ?? "none"}
            onValueChange={(v) => { const s = v === "none" ? null : v; setSubject(s); scheduleSave({ subject: s }); }}
          >
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Fach" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Fach</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1 min-w-[70px]">
            <Save className={cn("h-3 w-3", saving ? "animate-pulse text-primary" : "opacity-50")} />
            {saving ? "Speichert..." : "Gespeichert"}
          </span>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-3">
          <div className="glass rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, n) => setSelectedNodeId(n.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} color="hsl(var(--border))" />
              <Controls />
              <MiniMap pannable zoomable nodeColor={() => "hsl(var(--primary))"} maskColor="hsl(var(--background) / 0.6)" />
            </ReactFlow>
          </div>

          {/* Side panel */}
          <div className="glass rounded-2xl p-4 space-y-4 self-start">
            <div className="flex gap-2">
              <Button onClick={addNode} size="sm" className="flex-1 bg-gradient-primary text-primary-foreground">
                <Plus className="mr-1 h-4 w-4" /> Knoten
              </Button>
              <Button onClick={autoLayout} size="sm" variant="outline" title="Automatisch anordnen">
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>

            {!selectedNode ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Wähle einen Knoten, um Design & Text anzupassen.
              </p>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Text</label>
                  <Input
                    value={selectedNode.data.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                    placeholder="Knotentext"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Form</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SHAPES.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateSelected({ shape: s })}
                        className={cn(
                          "text-[10px] py-2 rounded-md border transition-colors",
                          selectedNode.data.shape === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/30 hover:bg-muted/60"
                        )}
                      >
                        {SHAPE_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Farbe</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => updateSelected({ color: c.value })}
                        title={c.name}
                        className={cn(
                          `h-8 rounded-md bg-gradient-to-br ${c.value} transition-all`,
                          selectedNode.data.color === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-105"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <Button onClick={deleteSelected} variant="destructive" size="sm" className="w-full">
                  <Trash2 className="mr-1 h-4 w-4" /> Knoten löschen
                </Button>
              </>
            )}

            <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
              <p>💡 Knoten verbinden: ziehe von einem Punkt am Rand zum anderen.</p>
              <p>💡 Verschieben: Knoten anklicken und ziehen.</p>
              <p>💡 Löschen: Knoten/Kante markieren + Entf-Taste.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function MindmapEditor() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
