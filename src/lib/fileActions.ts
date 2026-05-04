import { supabase } from "@/integrations/supabase/client";

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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function isAndroidWebView() {
  if (typeof navigator === "undefined") return false;
  return /wv|Android.*Version\//i.test(navigator.userAgent) || !!(window as any).AndroidDownloader;
}

/** Try a JS bridge that an Android app can inject as `AndroidDownloader.saveBase64(name, mime, base64)`. */
async function tryAndroidBridge(blob: Blob, filename: string, mime: string) {
  const bridge: any = (window as any).AndroidDownloader || (window as any).Android;
  if (!bridge) return false;
  try {
    const base64 = await blobToBase64(blob);
    if (typeof bridge.saveBase64 === "function") { bridge.saveBase64(filename, mime, base64); return true; }
    if (typeof bridge.downloadBase64 === "function") { bridge.downloadBase64(filename, mime, base64); return true; }
  } catch { /* ignore */ }
  return false;
}

/** Upload to private storage and return a signed HTTPS URL (works with Android DownloadManager). */
async function uploadAndSign(blob: Blob, filename: string, mime: string): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
    const { error: upErr } = await supabase.storage.from("downloads").upload(path, blob, { contentType: mime, upsert: false });
    if (upErr) return null;
    const { data, error } = await supabase.storage.from("downloads").createSignedUrl(path, 60 * 10, { download: filename });
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch { return null; }
}

export async function saveFile(source: SavableSource, filename: string, mimeType?: string | null) {
  const blob = await sourceToBlob(source, mimeType ?? guessMimeType(filename));
  const type = mimeType || blob.type || guessMimeType(filename);

  // 1. Native Android bridge (if app injects it)
  if (await tryAndroidBridge(blob, filename, type)) return;

  // 2. Web Share API (good on mobile browsers / modern WebViews)
  try {
    const file = new File([blob], filename, { type });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: filename });
      return;
    }
  } catch { /* user cancelled or unsupported – continue */ }

  // 3. Android WebView: data:/blob: downloads are blocked. Upload + signed HTTPS URL.
  if (isAndroidWebView()) {
    const signed = await uploadAndSign(blob, filename, type);
    if (signed) {
      const a = document.createElement("a");
      a.href = signed;
      a.download = filename;
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // also try opening directly in case download attribute is ignored
      setTimeout(() => { try { window.open(signed, "_blank"); } catch {} }, 100);
      return;
    }
  }

  // 4. Standard browser fallback
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
