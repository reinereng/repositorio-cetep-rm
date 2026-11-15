(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const box = $("resultados"), summary = $("resumo-busca");
  if (!box || !summary) return;

  const filters = {
    busca: $("busca"), categoria: $("categoria"), curso: $("curso"),
    ano: $("ano"), evento: $("evento")
  };
  const clear = $("limpar-filtros");
  const allCount = $("total-publicado");
  let records = [];

  const normalizar = value => String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

  function criarElemento(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = String(content);
    return el;
  }

  function adicionarFiltro(select, values, prefix, compare) {
    const sorted = [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))]
      .sort(compare || ((a, b) => a.localeCompare(b, "pt-BR")));
    for (const value of sorted) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
  }

  function validPdf(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return "";
      if (!/^\/file\/d\/[A-Za-z0-9_-]+/.test(url.pathname)) return "";
      return url.href;
    } catch (_) { return ""; }
  }

  function montarCartao(item) {
    const article = criarElemento("article", "catalog-card");
    const heading = criarElemento("div", "catalog-card__heading");
    const category = criarElemento("span", "catalog-tag", /TCC|Conclusão de Curso/i.test(item.categoria) ? "TCC" : item.categoria);
    const year = criarElemento("span", "catalog-year", item.ano || "Ano não informado");
    heading.append(category, year);
    const title = criarElemento("h2", "catalog-card__title", item.titulo);
    article.append(heading, title);

    const meta = criarElemento("div", "catalog-card__meta");
    if (item.curso) meta.append(criarElemento("span", "", "Curso/Área: " + item.curso));
    if (item.evento) meta.append(criarElemento("span", "", "Evento: " + item.evento));
    article.append(meta);

    if (item.palavrasChave) {
      const keywords = criarElemento("p", "catalog-card__keywords");
      keywords.append(criarElemento("strong", "", "Palavras-chave: "));
      keywords.append(document.createTextNode(item.palavrasChave));
      article.append(keywords);
    }
    const footer = criarElemento("div", "catalog-card__footer");
    footer.append(criarElemento("span", "catalog-id", item.id));
    const pdfUrl = validPdf(item.pdf);
    if (pdfUrl) {
      const a = criarElemento("a", "catalog-document", "Consultar PDF");
      a.href = pdfUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", "Consultar o PDF de " + item.titulo);
      footer.append(a);
    } else {
      footer.append(criarElemento("span", "catalog-no-document", "PDF indisponível"));
    }
    article.append(footer);
    return article;
  }

  function aplicarFiltros() {
    const q = normalizar(filters.busca.value);
    const ativo = q.length > 0 || ["categoria", "curso", "ano", "evento"]
      .some(key => Boolean(filters[key].value));
    // Jamais liste o acervo inteiro quando nenhum critério foi informado.
    if (!ativo) {
      box.replaceChildren();
      summary.textContent = "Digite um termo ou escolha um filtro e clique em Pesquisar.";
      box.setAttribute("aria-busy", "false");
      return;
    }
    const matches = records.filter(r => {
      const corpus = normalizar([r.titulo, r.palavrasChave, r.curso, r.categoria, r.evento, r.ano].join(" "));
      return (!q || q.split(/\s+/).every(word => corpus.includes(word))) &&
        (!filters.categoria.value || r.categoria === filters.categoria.value) &&
        (!filters.curso.value || r.curso === filters.curso.value) &&
        (!filters.ano.value || r.ano === filters.ano.value) &&
        (!filters.evento.value || r.evento === filters.evento.value);
    });
    box.replaceChildren();
    if (matches.length === 0) {
      const empty = criarElemento("div", "catalog-empty");
      empty.append(criarElemento("h2", "", records.length === 0 ? "Nenhum trabalho publicado" : "Nenhum resultado encontrado"));
      empty.append(criarElemento("p", "", records.length === 0 ?
        "Aguardando a inclusão de trabalhos no índice público." :
        "Experimente outra palavra-chave ou utilize o botão Limpar filtros."));
      box.append(empty);
    } else {
      for (const item of matches) box.append(montarCartao(item));
    }
    const label = matches.length === 1 ? "trabalho encontrado" : "trabalhos encontrados";
    summary.textContent = matches.length + " " + label;
    box.setAttribute("aria-busy", "false");
  }

  // Busca deliberada: botão Pesquisar ou tecla Enter.
  $("form-busca").addEventListener("submit", event => {
    event.preventDefault();
    aplicarFiltros();
  });
  clear.addEventListener("click", () => {
    $("form-busca").reset();
    box.replaceChildren();
    summary.textContent = "Filtros limpos. Informe um termo ou escolha um filtro para pesquisar.";
    box.setAttribute("aria-busy", "false");
    filters.busca.focus();
  });

  fetch("data/catalogo-publico.json", {cache: "no-store"})
    .then(response => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(data => {
      if (!data || !Array.isArray(data.registros)) throw new Error("Formato de catálogo inválido");
      records = data.registros.filter(r => r && r.titulo && r.id)
        .map(r => ({
          id: String(r.id), titulo: String(r.titulo), categoria: String(r.categoria || ""),
          curso: String(r.curso || ""), ano: String(r.ano || ""),
          evento: String(r.evento || ""), palavrasChave: String(r.palavrasChave || ""),
          pdf: String(r.pdf || "")
        })).sort((a, b) => Number(b.ano) - Number(a.ano) || a.titulo.localeCompare(b.titulo, "pt-BR"));
      adicionarFiltro(filters.categoria, records.map(r => r.categoria));
      adicionarFiltro(filters.curso, records.map(r => r.curso));
      adicionarFiltro(filters.ano, records.map(r => r.ano), "", (a,b) => Number(b) - Number(a));
      adicionarFiltro(filters.evento, records.map(r => r.evento));
      allCount.textContent = records.length + (records.length === 1 ? " trabalho no acervo" : " trabalhos no acervo");
      summary.textContent = records.length ?
        "Digite um termo ou escolha um filtro e clique em Pesquisar." :
        "Nenhum trabalho publicado no índice.";
      box.replaceChildren();
      box.setAttribute("aria-busy", "false");
    })
    .catch(error => {
      box.setAttribute("aria-busy", "false");
      summary.textContent = "Não foi possível carregar o acervo.";
      allCount.textContent = "Catálogo indisponível";
      box.replaceChildren(criarElemento("div", "catalog-empty", "O catálogo não pôde ser carregado. Recarregue a página em instantes."));
      console.error("Falha na consulta CETEP-RM", error);
    });
})();
