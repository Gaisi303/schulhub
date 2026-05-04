import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import mammoth from "mammoth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveFile, sourceToBlob, type SavableSource } from "@/lib/fileActions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ViewableFile = {
  name: string;
  url: string;
  mimeType?: string | null;
  source?: SavableSource;
};

function isImage(file?: ViewableFile | null) {
  return !!file && (file.mimeType?.startsWith("image/") || /^data:image\//.test(file.url) || /\.(png|jpe?g|webp|gif)$/i.test(file.name));
}

function isPdf(file?: ViewableFile | null) {
  return !!file && (file.mimeType === "application/pdf" || /^data:application\/pdf/.test(file.url) || /\.pdf$/i.test(file.name));
}

function isText(file?: ViewableFile | null) {
  return !!file && (file.mimeType?.startsWith("text/") || /^data:text\//.test(file.url) || /\.(txt|md|csv|json|log)$/i.test(file.name));
}

export function FileViewerDialog({ file, onOpenChange }: { file: ViewableFile | null; onOpenChange: (open: boolean) => void }) {
  const open = !!file;
  const [previewText, setPreviewText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreviewText(null);
    if (!file || isImage(file) || isPdf(file)) return;
    const load = async () => {
      try {
        const blob = await sourceToBlob(file.source ?? file.url, file.mimeType);
        let text: string | null = null;
        if (isText(file)) text = await blob.text();
        if (/\.docx$/i.test(file.name) || file.mimeType?.includes("wordprocessingml")) {
          text = (await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() })).value.trim();
        }
        if (!cancelled) setPreviewText(text || null);
      } catch {
        if (!cancelled) setPreviewText(null);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [file]);

  const download = async () => {
    if (!file) return;
    try {
      await saveFile(file.source ?? file.url, file.name, file.mimeType);
    } catch {
      toast.error("Speichern ist in dieser App nicht möglich. Öffne die Datei und teile/speichere sie dort.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border/50 px-3 py-2.5 pr-12 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <DialogTitle className="min-w-0 truncate text-sm sm:text-base">{file?.name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-2 sm:p-4">
          {file && isImage(file) ? (
            <div className="flex min-h-full items-center justify-center">
              <img src={file.url} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          ) : file && isPdf(file) ? (
            <iframe title={file.name} src={file.url} className="h-full min-h-[70vh] w-full rounded-lg border border-border/50 bg-background" />
          ) : previewText ? (
            <pre className="min-h-full whitespace-pre-wrap rounded-lg border border-border/50 bg-background p-4 text-sm leading-relaxed text-foreground">{previewText}</pre>
          ) : (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <FileText className="h-10 w-10" />
              <p className="max-w-sm">Dieses Format kann nicht direkt bearbeitbar angezeigt werden. Du kannst es schreibgeschützt öffnen oder speichern.</p>
              {file?.url && (
                <Button asChild variant="outline">
                  <a href={file.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Öffnen</a>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className={cn("grid gap-2 border-t border-border/50 p-2 sm:flex sm:justify-end", !file?.url && "hidden")}>
          <Button type="button" variant="outline" onClick={download}>
            <Download className="h-4 w-4" /> Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}