// Generates a .pptx from a topic prompt
import pptxgen from "npm:pptxgenjs@3.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Slide = { title: string; bullets: string[] };
type PptSpec = { title: string; subtitle?: string; slides: Slide[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("prompt required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du erstellst klare, lehrreiche PowerPoint-Präsentationen auf Deutsch für Schüler:innen. Pro Slide max 5 prägnante Bullet Points." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_presentation",
            description: "PowerPoint-Präsentation erstellen",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                subtitle: { type: "string" },
                slides: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      bullets: { type: "array", items: { type: "string" } },
                    },
                    required: ["title", "bullets"],
                  },
                },
              },
              required: ["title", "slides"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_presentation" } },
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
    const spec: PptSpec = JSON.parse(toolCall.function.arguments);

    // Build pptx
    const pres = new pptxgen();
    pres.layout = "LAYOUT_WIDE";
    const PRIMARY = "5B21B6"; // purple
    const ACCENT = "06B6D4";  // cyan
    const DARK = "0F172A";

    // Title slide
    const title = pres.addSlide();
    title.background = { color: DARK };
    title.addText(spec.title, {
      x: 0.5, y: 2.2, w: 12.3, h: 1.5,
      fontFace: "Calibri", fontSize: 44, bold: true, color: "FFFFFF", align: "center",
    });
    if (spec.subtitle) {
      title.addText(spec.subtitle, {
        x: 0.5, y: 3.8, w: 12.3, h: 0.8,
        fontFace: "Calibri", fontSize: 20, color: ACCENT, align: "center",
      });
    }
    title.addShape("rect", {
      x: 5.65, y: 5.2, w: 2, h: 0.08, fill: { color: PRIMARY }, line: { type: "none" },
    });

    // Content slides
    for (const s of spec.slides) {
      const slide = pres.addSlide();
      slide.background = { color: "F8FAFC" };
      // Side bar
      slide.addShape("rect", {
        x: 0, y: 0, w: 0.3, h: 7.5, fill: { color: PRIMARY }, line: { type: "none" },
      });
      // Title
      slide.addText(s.title, {
        x: 0.7, y: 0.4, w: 12, h: 0.9,
        fontFace: "Calibri", fontSize: 32, bold: true, color: DARK,
      });
      // Bullets
      const items = s.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF" }, color: DARK, fontSize: 18 } }));
      slide.addText(items, {
        x: 0.9, y: 1.5, w: 11.7, h: 5.5,
        fontFace: "Calibri", paraSpaceAfter: 12, valign: "top",
      });
    }

    const buf = await pres.write({ outputType: "uint8array" }) as Uint8Array;
    const base64 = btoa(String.fromCharCode(...buf));

    return new Response(JSON.stringify({
      filename: `${spec.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").slice(0, 60) || "Praesentation"}.pptx`,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      base64,
      title: spec.title,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-pptx error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
