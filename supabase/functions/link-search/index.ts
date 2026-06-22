const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { query, links } = await req.json();
    if (!query || !Array.isArray(links) || links.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Compact link list for prompt
    const items = (links as any[]).slice(0, 200).map((l, i) => ({
      i,
      id: String(l.id),
      title: String(l.title ?? "").slice(0, 120),
      url: String(l.url ?? "").slice(0, 200),
      desc: String(l.description ?? "").slice(0, 200),
      sum: String(l.summary ?? "").slice(0, 400),
      tags: Array.isArray(l.tags) ? l.tags.slice(0, 6).join(", ") : "",
    }));

    const list = items.map((l) =>
      `[${l.id}] ${l.title}\n  URL: ${l.url}\n  Beschreibung: ${l.desc}\n  Zusammenfassung: ${l.sum}\n  Tags: ${l.tags}`
    ).join("\n\n");

    const prompt = `Suchanfrage: "${query}"

Hier ist die Link-Sammlung der/s Nutzer:in:

${list}

Finde die passendsten Links (max. 8). Antworte AUSSCHLIESSLICH mit gültigem JSON in dieser Form:
{
  "matches": [
    { "id": "<die id in eckigen Klammern>", "reason": "Kurzer Grund (max 80 Zeichen)" }
  ]
}
Sortiere nach Relevanz (beste zuerst). Wenn nichts passt, gib leeres matches-Array zurück.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du hilfst, Links anhand semantischer Beschreibungen zu finden. Antworte nur mit JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "pay" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ matches: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const validIds = new Set(items.map((i) => i.id));
    const matches = Array.isArray(parsed.matches)
      ? parsed.matches
          .filter((m: any) => m && typeof m.id === "string" && validIds.has(m.id))
          .map((m: any) => ({ id: m.id, reason: typeof m.reason === "string" ? m.reason.slice(0, 120) : "" }))
          .slice(0, 12)
      : [];

    return new Response(JSON.stringify({ matches }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("link-search error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
