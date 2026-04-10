/**
 * Zoho Desk KB Extractor — SisCRM
 *
 * INSTRUÇÕES:
 * 1. Abra o portal no seu navegador: https://suporte.sismais.com/portal/pt-br/kb/maissimples
 * 2. Abra o Console do DevTools (F12 → Console)
 * 3. Cole e execute este script inteiro
 * 4. O arquivo "zohodesk-kb-export.json" será baixado automaticamente
 * 5. Importe o arquivo na página Base de Conhecimento → botão "Importar Zoho Desk"
 */
(async function extractZohoDeskKB() {
  const base = window.location.origin;
  const portalName = 'maissimples';
  console.log('[Extractor] Iniciando extração do Zoho Desk em ' + base + '...');

  async function fetchJSON(url) {
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' em ' + url);
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Resposta não é JSON em ' + url + ': ' + text.substring(0, 200));
    }
  }

  // Tenta diferentes endpoints da API Zoho Desk
  async function fetchCategories() {
    const endpoints = [
      base + '/api/v1/helpcenter/categories?portalName=' + portalName,
      base + '/api/v1/portal/' + portalName + '/categories',
      base + '/api/v1/helpcenter/categories',
    ];
    for (const url of endpoints) {
      try {
        const data = await fetchJSON(url);
        const list = data.data || data.categories || (Array.isArray(data) ? data : null);
        if (list && list.length > 0) {
          console.log('[Extractor] Categorias via: ' + url);
          return list;
        }
      } catch (e) {
        console.warn('[Extractor] Tentativa falhou (' + url + '):', e.message);
      }
    }
    throw new Error('Não foi possível obter categorias. Verifique se está na página correta e tente novamente.');
  }

  async function fetchSections(categoryId) {
    const endpoints = [
      base + '/api/v1/helpcenter/categories/' + categoryId + '/sections?portalName=' + portalName,
      base + '/api/v1/portal/' + portalName + '/categories/' + categoryId + '/sections',
    ];
    for (const url of endpoints) {
      try {
        const data = await fetchJSON(url);
        return data.data || data.sections || (Array.isArray(data) ? data : []);
      } catch (e) { /* tenta próximo */ }
    }
    return [];
  }

  async function fetchArticles(sectionId, page) {
    const endpoints = [
      base + '/api/v1/helpcenter/sections/' + sectionId + '/articles?portalName=' + portalName + '&from=' + ((page - 1) * 25) + '&limit=25',
      base + '/api/v1/portal/' + portalName + '/sections/' + sectionId + '/articles?page=' + page,
    ];
    for (const url of endpoints) {
      try {
        const data = await fetchJSON(url);
        return data.data || data.articles || (Array.isArray(data) ? data : []);
      } catch (e) { /* tenta próximo */ }
    }
    return [];
  }

  async function fetchArticleDetail(articleId) {
    const endpoints = [
      base + '/api/v1/helpcenter/articles/' + articleId + '?portalName=' + portalName,
      base + '/api/v1/portal/' + portalName + '/articles/' + articleId,
    ];
    for (const url of endpoints) {
      try {
        const data = await fetchJSON(url);
        return data.data || data;
      } catch (e) { /* tenta próximo */ }
    }
    return null;
  }

  // 1. Categorias
  const categories = await fetchCategories();
  console.log('[Extractor] ' + categories.length + ' categoria(s) encontrada(s)');

  const result = {
    exported_at: new Date().toISOString(),
    source_url: base,
    portal_name: portalName,
    categories: [],
  };

  for (const cat of categories) {
    const catId = cat.id || cat.categoryId;
    console.log('[Extractor] Categoria: ' + (cat.name || cat.title));
    const catData = {
      id: catId,
      name: cat.name || cat.title,
      description: cat.description || null,
      sections: [],
    };

    // 2. Seções da categoria
    const sections = await fetchSections(catId);
    console.log('  → ' + sections.length + ' seção(ões)');

    for (const section of sections) {
      const sectionId = section.id || section.sectionId;
      console.log('  Seção: ' + (section.name || section.title));
      const sectionData = {
        id: sectionId,
        name: section.name || section.title,
        description: section.description || null,
        articles: [],
      };

      // 3. Artigos da seção (paginado)
      let page = 1;
      while (true) {
        const articles = await fetchArticles(sectionId, page);
        if (!Array.isArray(articles) || articles.length === 0) break;

        for (const art of articles) {
          const artId = art.id || art.articleId;
          // Busca conteúdo completo do artigo
          let content_html = art.answer || art.content || art.body || '';
          if (!content_html && artId) {
            const detail = await fetchArticleDetail(artId);
            content_html = detail?.answer || detail?.content || detail?.body || '';
          }

          sectionData.articles.push({
            id: artId,
            title: art.title || art.name,
            content_html,
            status: art.status || 'published', // published / draft
            tags: art.tags || [],
            url: base + '/portal/pt-br/kb/' + portalName + '/' + artId,
            created_at: art.createdTime || art.created_at,
            updated_at: art.modifiedTime || art.updated_at,
          });
        }

        console.log('    Página ' + page + ': ' + articles.length + ' artigo(s)');
        if (articles.length < 25) break;
        page++;
      }

      console.log('    Total: ' + sectionData.articles.length + ' artigo(s)');
      catData.sections.push(sectionData);
    }

    result.categories.push(catData);
  }

  // Estatísticas
  const totalSections = result.categories.reduce((a, c) => a + c.sections.length, 0);
  const totalArticles = result.categories.reduce(
    (a, c) => a + c.sections.reduce((b, s) => b + s.articles.length, 0),
    0
  );
  console.log('\n[Extractor] ✓ Concluído! ' +
    result.categories.length + ' categorias, ' +
    totalSections + ' seções, ' +
    totalArticles + ' artigos.');

  // Download automático
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'zohodesk-kb-export.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('[Extractor] Arquivo zohodesk-kb-export.json baixado! Agora importe na plataforma.');
  return result;
})().catch(function (err) {
  console.error('[Extractor] Erro:', err.message);
  console.error('Dica: certifique-se de estar em https://suporte.sismais.com e tente novamente.');
});
