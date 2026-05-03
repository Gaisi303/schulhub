import { useEffect, useRef, useState } from "react";
import { Paperclip, Upload, X, Download, FileText, Cloud, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  storage_type: "cloud" | "local";
  storage_path: string | null;
  local_data_url: string | null;
}

const ACCEPT = ".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.ods,.odp,.txt,.md,.csv,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_LOCAL_BYTES = 2 * 1024 * 1024; // 2MB cap for local (data URL)
const MAX_CLOUD_BYTES = 25 * 1024 * 1024; // 25MB

const LOCAL_KEY = (taskId: string) => `task-att-local:${taskId}`;

function readLocal(taskId: string): Attachment[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY(taskId)) || "[]"); } catch { return []; }
}
function writeLocal(taskId: string, list: Attachment[]) {
  localStorage.setItem(LOCAL_KEY(taskId), JSON.stringify(list));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function TaskAttachments({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const [target, setTarget] = useState<"cloud" | "local">("cloud");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase.from as any)("task_attachments")
      .select("*").eq("task_id", taskId).order("created_at", { ascending: true });
    const cloud = (data ?? []) as Attachment[];
    setItems([...cloud, ...readLocal(taskId)]);
  };
  useEffect(() => { load(); }, [taskId, user]);

  const onPick = () => inputRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (target === "cloud") {
          if (file.size > MAX_CLOUD_BYTES) { toast.error(`${file.name}: max 25 MB`); continue; }
          const path = `${user.id}/${taskId}/${crypto.randomUUID()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file, { contentType: file.type });
          if (upErr) { toast.error(upErr.message); continue; }
          const { error } = await (supabase.from as any)("task_attachments").insert({
            task_id: taskId, user_id: user.id, file_name: file.name, file_size: file.size,
            mime_type: file.type || null, storage_type: "cloud", storage_path: path,
          });
          if (error) toast.error(error.message);
        } else {
          if (file.size > MAX_LOCAL_BYTES) { toast.error(`${file.name}: lokal max 2 MB`); continue; }
          const dataUrl = await fileToDataUrl(file);
          const list = readLocal(taskId);
          list.push({
            id: crypto.randomUUID(), task_id: taskId, user_id: user.id,
            file_name: file.name, file_size: file.size, mime_type: file.type || null,
            storage_type: "local", storage_path: null, local_data_url: dataUrl,
          });
          writeLocal(taskId, list);
        }
      }
      toast.success("Anhang hinzugefügt");
      load();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDownload = async (a: Attachment) => {
    if (a.storage_type === "local" && a.local_data_url) {
      const r = await fetch(a.local_data_url); const b = await r.blob();
      downloadBlob(b, a.file_name); return;
    }
    if (a.storage_path) {
      const { data, error } = await supabase.storage.from("task-attachments").download(a.storage_path);
      if (error || !data) { toast.error("Download fehlgeschlagen"); return; }
      downloadBlob(data, a.file_name);
    }
  };

  const onDelete = async (a: Attachment) => {
    if (a.storage_type === "local") {
      writeLocal(taskId, readLocal(taskId).filter((x) => x.id !== a.id));
    } else {
      if (a.storage_path) await supabase.storage.from("task-attachments").remove([a.storage_path]);
      await (supabase.from as any)("task_attachments").delete().eq("id", a.id);
    }
    load();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Anhänge</Label>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={target} onValueChange={(v) => setTarget(v as any)}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="cloud"><span className="flex items-center gap-1.5"><Cloud className="h-3 w-3" /> Cloud</span></SelectItem>
              <SelectItem value="local"><span className="flex items-center gap-1.5"><HardDrive className="h-3 w-3" /> Lokal</span></SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" onClick={onPick} disabled={busy}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Datei
          </Button>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Keine Anhänge. PDF, Word, Excel, PowerPoint, ODT u.a.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{a.file_name}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                    {a.storage_type === "cloud" ? <><Cloud className="h-2.5 w-2.5 mr-0.5" /> Cloud</> : <><HardDrive className="h-2.5 w-2.5 mr-0.5" /> Lokal</>}
                  </Badge>
                  {fmtSize(a.file_size)}
                </div>
              </div>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(a)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(a)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
