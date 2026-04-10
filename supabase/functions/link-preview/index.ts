import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractMeta(html: string, property: string): string | null {
  // Try og: meta tags
  const ogRegex = new RegExp(
    `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  let match = html.match(ogRegex);
  if (match) return match[1];

  // Try reversed attribute order
  const ogRegex2 = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`,
    "i"
  );
  match = html.match(ogRegex2);
  if (match) return match[1];

  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractDescription(html: string): string | null {
  const regex =
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i;
  let match = html.match(regex);
  if (match) return match[1];
  const regex2 =
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i;
  match = html.match(regex2);
  return match ? match[1] : null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +https://lovable.dev)",
          Accept: "text/html",
        },
        redirect: "follow",
      });
      // Only read first 50KB to avoid huge pages
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      const MAX_SIZE = 50000;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalSize += value.length;
          if (totalSize > MAX_SIZE) break;
        }
        reader.cancel();
      }
      html = new TextDecoder().decode(
        new Uint8Array(
          chunks.reduce((acc, c) => {
            const tmp = new Uint8Array(acc.length + c.length);
            tmp.set(acc);
            tmp.set(c, acc.length);
            return tmp;
          }, new Uint8Array())
        )
      );
    } catch {
      return new Response(
        JSON.stringify({ title: null, description: null, image: null, siteName: null, url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      clearTimeout(timeout);
    }

    const ogTitle = extractMeta(html, "og:title");
    const ogDesc = extractMeta(html, "og:description");
    const ogImage = extractMeta(html, "og:image");
    const ogSiteName = extractMeta(html, "og:site_name");

    const title = ogTitle || extractTitle(html) || null;
    const description = ogDesc || extractDescription(html) || null;
    let image = ogImage || null;

    // Resolve relative image URLs
    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, url).href;
      } catch {
        image = null;
      }
    }

    return new Response(
      JSON.stringify({
        title,
        description,
        image,
        siteName: ogSiteName || getDomain(url),
        url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
