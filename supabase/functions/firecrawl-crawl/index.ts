const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, options } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Starting crawl for:', formattedUrl, 'limit:', options?.limit || 10);

    // Start crawl job
    const startResponse = await fetch('https://api.firecrawl.dev/v1/crawl', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        limit: options?.limit || 10,
        maxDepth: options?.maxDepth || 20,
        includePaths: options?.includePaths,
        excludePaths: options?.excludePaths,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      }),
    });

    const startData = await startResponse.json();

    if (!startResponse.ok) {
      console.error('Firecrawl crawl start error:', startData);
      return new Response(
        JSON.stringify({ success: false, error: startData.error || `Failed with status ${startResponse.status}` }),
        { status: startResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const crawlId = startData.id;
    if (!crawlId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No crawl ID returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Crawl started, ID:', crawlId);

    // Poll for completion (max 120s)
    let result = null;
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      const statusData = await statusResponse.json();
      console.log(`Poll ${i + 1}: status=${statusData.status}, completed=${statusData.completed}/${statusData.total}`);

      if (statusData.status === 'completed') {
        result = statusData;
        break;
      }

      if (statusData.status === 'failed') {
        return new Response(
          JSON.stringify({ success: false, error: 'Crawl failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ success: false, error: 'Crawl timed out after 120s. Try with fewer pages.' }),
        { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map results
    const pages = (result.data || []).map((page: any) => ({
      url: page.metadata?.sourceURL || page.metadata?.url || '',
      title: page.metadata?.title || 'Sem título',
      markdown: page.markdown || '',
    })).filter((p: any) => p.markdown.length > 50);

    console.log(`Crawl complete: ${pages.length} pages extracted`);

    return new Response(
      JSON.stringify({ success: true, pages, total: pages.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error crawling:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to crawl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
