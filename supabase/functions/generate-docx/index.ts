// Generates a .docx from a topic prompt using AI to plan the structure
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "npm:docx@9.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DocSpec = {
  title: string;
  sections: { heading: string; paragraphs: string[] }[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("prompt required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Ask AI to produce structured outline
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du erstellst strukturierte deutsche Dokumente für Schüler:innen. Antworte mit präzisem, lehrreichen Inhalt." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_document",
            description: "Strukturiertes Word-Dokument erstellen",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Titel des Dokuments" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      heading: { type: "string" },
                      paragraphs: { type: "array", items: { type: "string" } },
                    },
                    required: ["heading", "paragraphs"],
                  },
                },
              },
              required: ["title", "sections"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_document" } },
      }),
    });

    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Zu viele Anfragen." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      throw new Error("AI Fehler");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Keine Struktur erhalten");
    const spec: DocSpec = JSON.parse(toolCall.function.arguments);

    // Build .docx
    const children: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: spec.title, bold: true, size: 40 })],
        spacing: { after: 400 },
      }),
    ];
    for (const sec of spec.sections) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: sec.heading, bold: true, size: 28 })],
        spacing: { before: 300, after: 200 },
      }));
      for (const p of sec.paragraphs) {
        children.push(new Paragraph({
          children: [new TextRun({ text: p, size: 24 })],
          spacing: { after: 160 },
        }));
      }
    }

    const doc = new Document({
      styles: { default: { document: { run: { font: "Calibri", size: 24 } } } },
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    return new Response(JSON.stringify({
      filename: `${spec.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").slice(0, 60) || "Dokument"}.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      base64,
      title: spec.title,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-docx error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
