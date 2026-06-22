const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url, userNote } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Fetch page
    let html = "";
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SchulHubBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const ct = r.headers.get("content-type") ?? "";
        if (ct.includes("text/html") || ct.includes("text/plain")) {
          html = (await r.text()).slice(0, 80000);
        }
      }
    } catch (e) {
      console.warn("fetch failed", e);
    }

    // 2. Strip HTML to plain text snippet
    let text = "";
    let pageTitle = "";
    if (html) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) pageTitle = titleMatch[1].trim().slice(0, 200);
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    }

    // 3. Ask Lovable AI for structured summary
    const prompt = `URL: ${url}
Seitentitel (falls vorhanden): ${pageTitle || "(unbekannt)"}
${userNote ? `Notiz der/s Nutzer:in: ${userNote}\n` : ""}
Inhalt (Auszug):
"""
${text || "(Inhalt konnte nicht geladen werden — nutze nur URL und Titel.)"}
"""

Analysiere diesen Link. Antworte AUSSCHLIESSLICH mit gültigem JSON in genau dieser Form:
{
  "title": "Kurzer, klarer Titel (max 80 Zeichen)",
  "description": "1 Satz, worum es geht (max 140 Zeichen)",
  "summary": "2-4 Sätze Zusammenfassung auf Deutsch",
  "tags": ["tag1", "tag2", "tag3"]
}
Maximal 5 prägnante Tags (auf Deutsch, kurze Wörter, keine Hashtags).`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du analysierst Web-Links und antwortest nur mit JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ title: pageTitle || url, description: userNote || null, summary: null, tags: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    return new Response(JSON.stringify({
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 120) : pageTitle || url,
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 200) : (userNote || null),
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 600) : null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: any) => typeof t === "string").slice(0, 6) : [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("link-summary error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
