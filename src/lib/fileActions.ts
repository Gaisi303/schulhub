export type SavableSource = Blob | string;

export function guessMimeType(name: string, fallback = "application/octet-stream") {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
  };
  return ext ? map[ext] ?? fallback : fallback;
}

export async function sourceToBlob(source: SavableSource, mimeType?: string | null) {
  if (source instanceof Blob) return source;
  const response = await fetch(source);
  const blob = await response.blob();
  if (mimeType && blob.type !== mimeType) return blob.slice(0, blob.size, mimeType);
  return blob;
}

export async function saveFile(source: SavableSource, filename: string, mimeType?: string | null) {
  const blob = await sourceToBlob(source, mimeType ?? guessMimeType(filename));
  const type = mimeType || blob.type || guessMimeType(filename);
  const file = new File([blob], filename, { type });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    await nav.share({ files: [file], title: filename });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}