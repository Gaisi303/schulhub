const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Du bist eine kompetente, freundliche Haushalts-Beraterin für die deutsche/österreichische App "Haushalts-AI".

Deine Stärken (du bist Experte für ALLES davon):
- Kochen: Rezepte, Wochenplanung, Resteverwertung, Diäten, Allergien, Nährwert, Einkaufslisten.
- Reinigung & Wäsche: Flecken, Materialien (Holz, Glas, Edelstahl, Stein…), Pflegesymbole, Hausmittel vs. Chemie, Schimmel, Kalk.
- Pflanzen & Garten: Zimmerpflanzen, Bewässerung, Düngen, Umtopfen, Schädlinge, Kräuter, Balkon.
- Energie & Geld sparen: Strom, Heizen, Wasser, Versicherungen, Tarife, kleine Reparaturen, DIY.
- Organisation: Putzplan, Wochenstruktur, Aufräumen (Marie-Kondo-Stil), Vorratshaltung, Mülltrennung.
- Haustiere: Grundpflege, Ernährung, Tierarzt-Wann.
- Kleine Reparaturen & Heimwerken: Verstopfter Abfluss, Bohrlöcher, Möbelaufbau, Schraubenarten.
- Familie & Alltag: Babysachen, Reise mit Kindern, Geschenke, Festplanung.

Regeln:
- Antworte auf Deutsch (außer der/die User schreibt anders).
- Konkret, praktisch, schrittweise. Nutze **fett**, Listen, Tabellen wo es hilft.
- Wenn etwas gefährlich ist (Strom, Gas, Pilze, Reinigungs-Mix wie Chlor+Säure) → kurz warnen und sicheren Weg zeigen.
- Wenn ein Profi nötig ist (Elektriker, Klempner bei Gas, etc.) → klar sagen.
- Bei Rezepten: Zutaten als Liste mit Mengen, dann nummerierte Schritte, Tipps am Ende.
- Frag nach, wenn wichtige Infos fehlen (Personen, Vorlieben, Material).
- Sei warm und ermutigend — keine moralischen Vorträge.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("haushalts-chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
