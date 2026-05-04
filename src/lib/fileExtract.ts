// Extract text from PDFs and DOCX in the browser
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export type ExtractedFile = {
  name: string;
  kind: "image" | "pdf" | "docx" | "text" | "file";
  /** original file as data URL for in-app preview/download */
  dataUrl?: string;
  mimeType?: string;
  /** for documents: extracted text */
  text?: string;
  size: number;
};

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function extractFile(file: File): Promise<ExtractedFile> {
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} ist zu groß (max 10 MB)`);
  }

  // Image
  if (file.type.startsWith("image/")) {
    const dataUrl = await fileToDataUrl(file);
    return { name: file.name, kind: "image", dataUrl, mimeType: file.type, size: file.size };
  }

  const dataUrlPromise = fileToDataUrl(file);

  // PDF
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const [buf, dataUrl] = await Promise.all([file.arrayBuffer(), dataUrlPromise]);
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    const maxPages = Math.min(pdf.numPages, 50);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it: any) => ("str" in it ? it.str : ""))
        .join(" ");
      text += `\n--- Seite ${i} ---\n${pageText}\n`;
    }
    if (pdf.numPages > 50) {
      text += `\n[Hinweis: PDF hat ${pdf.numPages} Seiten, nur die ersten 50 wurden gelesen.]`;
    }
    return { name: file.name, kind: "pdf", dataUrl, mimeType: file.type || "application/pdf", text: text.trim(), size: file.size };
  }

  // DOCX
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    const [buf, dataUrl] = await Promise.all([file.arrayBuffer(), dataUrlPromise]);
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return { name: file.name, kind: "docx", dataUrl, mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document", text: result.value.trim(), size: file.size };
  }

  // Plain text
  if (
    file.type.startsWith("text/") ||
    /\.(txt|md|csv|json|log)$/i.test(file.name)
  ) {
    const [text, dataUrl] = await Promise.all([file.text(), dataUrlPromise]);
    return { name: file.name, kind: "text", dataUrl, mimeType: file.type || "text/plain", text, size: file.size };
  }

  const dataUrl = await dataUrlPromise;
  return { name: file.name, kind: "file", dataUrl, mimeType: file.type || "application/octet-stream", size: file.size };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
