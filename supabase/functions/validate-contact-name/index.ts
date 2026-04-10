const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customer_name } = await req.json();
    if (!customer_name || typeof customer_name !== "string") {
      return new Response(
        JSON.stringify({ valid: false, reason: "Nome não informado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const name = customer_name.trim();

    // Quick regex pre-checks for obviously invalid names
    // Only dots, special chars, or whitespace
    if (/^[\.\-\_\s\*\#\@\!\?\,]+$/.test(name)) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Nome contém apenas caracteres especiais" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phone number pattern (8+ digits, optionally with + or spaces/dashes)
    if (/^\+?\d[\d\s\-\(\)]{7,}$/.test(name)) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Nome parece ser um número de telefone" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single character
    if (name.length <= 1) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Nome muito curto para identificar o contato" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only numbers
    if (/^\d+$/.test(name)) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Nome contém apenas números" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Names that look clearly valid (2+ words, all letters, common pattern)
    if (/^[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(name) && name.length >= 5) {
      return new Response(
        JSON.stringify({ valid: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For ambiguous cases, use LLM
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      // If no API key, allow ambiguous names through
      console.warn("OPENROUTER_API_KEY not set, skipping AI name validation");
      return new Response(
        JSON.stringify({ valid: true, reason: "Validação IA indisponível" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Analise se o texto a seguir é um nome real de pessoa (brasileiro ou estrangeiro).

REJEITE (valid: false):
- Números de telefone ou códigos
- Pontos isolados, caracteres aleatórios
- Siglas sem sentido ou texto incompreensível
- Nomes de empresa quando claramente não é uma pessoa
- Emojis ou texto sem significado

ACEITE (valid: true):
- Nomes próprios (completos ou apenas primeiro nome)
- Apelidos comuns brasileiros (Dudu, Kiko, Bia, etc.)
- Nomes estrangeiros
- Nomes compostos
- Abreviações razoáveis (ex: "J. Silva", "M. Santos")

Responda APENAS em JSON: {"valid": true/false, "reason": "explicação curta em português"}

Nome: "${name}"`;

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let result: { valid: boolean; reason?: string };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse AI response:", content);
      // On parse failure, allow through
      result = { valid: true, reason: "Não foi possível validar automaticamente" };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ valid: true, reason: "Erro na validação" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
