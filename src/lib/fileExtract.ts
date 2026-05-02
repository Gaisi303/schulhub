// Extract text from PDFs and DOCX in the browser
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export type ExtractedFile = {
  name: string;
  kind: "image" | "pdf" | "docx" | "text";
  /** for images: data URL */
  dataUrl?: string;
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
    return { name: file.name, kind: "image", dataUrl, size: file.size };
  }

  // PDF
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const buf = await file.arrayBuffer();
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
    return { name: file.name, kind: "pdf", text: text.trim(), size: file.size };
  }

  // DOCX
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return { name: file.name, kind: "docx", text: result.value.trim(), size: file.size };
  }

  // Plain text
  if (
    file.type.startsWith("text/") ||
    /\.(txt|md|csv|json|log)$/i.test(file.name)
  ) {
    const text = await file.text();
    return { name: file.name, kind: "text", text, size: file.size };
  }

  throw new Error(`Dateityp wird nicht unterstützt: ${file.name}`);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
