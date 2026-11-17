/* CETEP-RM — leitura do PDF, revisão assistida e sugestões de metadados.
 * O leitor identifica pistas locais primeiro; se houver texto extraível e integração
 * habilitada, a IA SEMPRE confere esses achados e sugere os demais campos.
 * Nenhum campo do responsável pelo envio é inferido, preenchido ou enviado como pista.
 * A pessoa confere e escolhe o que aplicar; não há submissão automática.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const pdfInput = $("arquivoPdf"), localBtn = $("identificar-pdf");
  if (!pdfInput || !localBtn) return;
  const status = $("extracao-status"), suggestions = $("revisao-sugestoes");
  const list = $("lista-sugestoes"), apply = $("aplicar-sugestoes");
  const config = window.CETEP_CONFIG || {};
  const limitBytes = (Number(config.limitePdfMB) || 6) * 1024 * 1024;
  const maxPages = 5, aiMaxChars = 12000;
  const pdfjsSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.5.438/pdf.min.mjs";
  const workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.5.438/pdf.worker.min.mjs";
  const backendUrl = String(config.submissaoWebExec || "");
  const aiReady = config.iaMetadadosAtiva === true &&
    /^https:\/\/script\.google\.com\//.test(backendUrl);
  let textExtracted = "", imagePreview = "", localFound = {}, current = {}, pending = null;
  const fields = {
    titulo:"Título", autores:"Autores", orientador:"Orientador(a)",
    coorientador:"Co-orientador(a)", resumo:"Resumo", palavrasChave:"Palavras-chave",
    ano:"Ano", curso:"Curso/Área", categoria:"Categoria", evento:"Feira/Evento"
  };
  const clean = s => String(s || "").replace(/\s+/g," ").trim();
  const norm = s => clean(s).normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").toLowerCase();

  /* Capitalização editorial das sugestões; evita títulos inteiros em caixa alta. */
  function textoEmCaixaAlta(raw) {
    const chars = (clean(raw).match(/[A-Za-zÀ-ÿ]/g) || []);
    return chars.length >= 8 &&
      chars.filter(c => c === c.toLocaleUpperCase("pt-BR") &&
        c !== c.toLocaleLowerCase("pt-BR")).length / chars.length >= .75;
  }
  function nomesProprios(s) {
    return s
      .replace(/camaçari/gi,"Camaçari")
      .replace(/monte gordo/gi,"Monte Gordo")
      .replace(/rio capivara/gi,"Rio Capivara")
      .replace(/rio camaçari/gi,"Rio Camaçari")
      .replace(/abrantes/gi,"Abrantes")
      .replace(/tupinambás/gi,"Tupinambás")
      .replace(/nordeste brasileiro/gi,"Nordeste brasileiro")
      .replace(/cetep-rm/gi,"CETEP-RM")
      .replace(/fecitesc/gi,"FECITESC")
      .replace(/afrotep/gi,"AFROTEP")
      .replace(/sematep/gi,"SEMATEP")
      .replace(/uv-vis/gi,"UV-Vis")
      .replace(/fe²⁺/gi,"Fe²⁺");
  }
  function padronizarCampo(key, value) {
    const limites = {titulo:250,autores:1200,orientador:200,coorientador:200,
      resumo:4000,palavrasChave:400,ano:4,curso:120,categoria:70,evento:160};
    let s = clean(value).slice(0, limites[key] || 4000);
    if (key === "titulo" && textoEmCaixaAlta(s)) {
      s = s.toLocaleLowerCase("pt-BR")
        .replace(/(^|[:.!?]\s+)([a-zà-ÿ])/giu, (_,pre,l) => pre+l.toLocaleUpperCase("pt-BR"));
      return nomesProprios(s);
    }
    if (key === "palavrasChave" && textoEmCaixaAlta(s)) {
      return nomesProprios(s.toLocaleLowerCase("pt-BR"));
    }
    if (["autores","orientador","coorientador"].includes(key) && textoEmCaixaAlta(s)) {
      return s.toLocaleLowerCase("pt-BR").replace(/(^|[\s,;])([a-zà-ÿ]+)/giu, (_,sep,word) =>
        sep && /^(de|da|do|das|dos|e)$/i.test(word) ? sep+word :
        sep+word.charAt(0).toLocaleUpperCase("pt-BR")+word.slice(1));
    }
    return s;
  }
  function setStatus(message) { status.textContent = message; }

  function resetReading() {
    if (pending) {
      clearTimeout(pending.timeout);
      pending.iframe.remove();
      pending = null;
    }
    textExtracted = ""; imagePreview = ""; localFound = {}; current = {};
    apply.disabled = false;
    suggestions.hidden = true;
    list.replaceChildren();
    localBtn.disabled = false;
    setStatus("PDF selecionado. Clique em Pesquisar no PDF para identificar informações.");
  }
  pdfInput.addEventListener("change", resetReading);

  async function extract() {
    const file = pdfInput.files?.[0];
    if (!file) throw new Error("Selecione o PDF na área acima.");
    if (!/\.pdf$/i.test(file.name) || file.size <= 0 || file.size > limitBytes) {
      throw new Error("Use um PDF válido de até " + (limitBytes / 1048576) + " MB.");
    }
    const signature = new TextDecoder().decode(await file.slice(0,5).arrayBuffer());
    if (signature !== "%PDF-") throw new Error("Esse arquivo não apresenta a assinatura de um PDF válido.");
    setStatus("Analisando as primeiras páginas do documento…");
    const pdfjs = await import(pdfjsSrc);
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await task.promise;
    try {
      const total = Math.min(pdf.numPages, maxPages);
      const texts = [];
      for (let n = 1; n <= total; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        let lines = [], line = [], prevY = null;
        for (const item of content.items) {
          if (!item.str) continue;
          const y = Array.isArray(item.transform) ? item.transform[5] : 0;
          if (prevY !== null && Math.abs(y - prevY) > 3 && line.length) {
            lines.push(clean(line.join(" "))); line = [];
          }
          line.push(item.str);
          if (item.hasEOL) { lines.push(clean(line.join(" "))); line = []; prevY = null; }
          else prevY = y;
        }
        if (line.length) lines.push(clean(line.join(" ")));
        texts.push(lines.filter(Boolean).join("\n"));
        if (texts.join("").length > 75000) break;
      }
      const all = texts.join("\n\n");
      let image = "";
      // Banners de uma página e PDFs com texto escasso: a disposição visual
      // ajuda a IA a distinguir título, autoria, orientação e conteúdo.
      if (aiReady && (pdf.numPages === 1 || all.replace(/\s/g,"").length < 300)) {
        try {
          const firstPage = await pdf.getPage(1);
          const natural = firstPage.getViewport({scale:1});
          const scale = Math.min(2, 1450 / Math.max(natural.width,natural.height));
          const viewport = firstPage.getViewport({scale});
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1,Math.round(viewport.width));
          canvas.height = Math.max(1,Math.round(viewport.height));
          const ctx = canvas.getContext("2d",{alpha:false});
          if (ctx) {
            await firstPage.render({canvasContext:ctx,viewport}).promise;
            image = canvas.toDataURL("image/jpeg",0.68).split(",")[1] || "";
            // Impede solicitações muito grandes ao Apps Script.
            if (image.length > 1250000) image = "";
          }
          canvas.width=0;canvas.height=0;
        } catch (imageError) {
          console.warn("CETEP-RM: prévia visual indisponível",imageError);
        }
      }
      if (all.replace(/\s/g,"").length < 100 && !image) {
        throw new Error("O PDF não contém texto legível suficiente. Se for digitalizado como imagem, preencha os campos manualmente.");
      }
      return {all, pages:texts, count: pdf.numPages, readPages: total, image};
    } finally {
      // O PDF.js expõe destroy() na tarefa de carregamento; algumas builds
      // não o expõem no proxy do documento. Falha no cleanup não invalida a leitura.
      try {
        if (typeof task.destroy === "function") await task.destroy();
        else if (typeof pdf.cleanup === "function") await pdf.cleanup();
      } catch (cleanupError) {
        console.warn("CETEP-RM: limpeza do PDF:", cleanupError);
      }
    }
  }


  function findLabel(lines, regex) {
    for (const line of lines) {
      const hit = line.match(regex);
      if (hit && clean(hit[1]).length > 2) return clean(hit[1]);
    }
    return "";
  }
  function guessTitle(lines, pages) {
    let t = findLabel(lines.slice(0, 110), /^(?:t[ií]tulo(?: do trabalho)?|tema(?: do projeto)?)\s*[:\-]\s*(.{12,240})/i);
    if (t) return t.slice(0,250);
    const cover = (pages[0]||"").split("\n");
    const exclude = /CENTRO|SECRETARIA|EDUCA[ÇC][ÃA]O|PROFISSIONAL|METROPOLITANA|CETEP|CURSO|TRABALHO DE CONCLUS|ORIENTADOR|ORIENTADORA|PROFESSOR|MINIST[ÉE]RIO|GOVERNO|APRESENTAD|CAMA[ÇC]ARI|SALVADOR|BAHIA|INSTITUI[ÇC][ÃA]O|AUTORES|EQUIPE|ALUNOS|T[ÉE]CNICO/i;
    const blocks = [];
    for (let i=0;i<cover.length;i++) {
      const line = clean(cover[i]);
      if (line.length < 14 || line.length > 160 || exclude.test(line)) continue;
      const letters = line.match(/[A-Za-zÀ-ÿ]/g)||[];
      const upper = line.match(/[A-ZÀ-Ý]/g)||[];
      if (letters.length < 12 || upper.length/letters.length < .7) continue;
      let candidate = line;
      for(let j=i+1;j<Math.min(i+4,cover.length);j++){
        const nx=clean(cover[j]), nl=nx.match(/[A-Za-zÀ-ÿ]/g)||[], nu=nx.match(/[A-ZÀ-Ý]/g)||[];
        if(nx.length<10 || exclude.test(nx) || nl.length<10 || nu.length/nl.length<.68 || candidate.length+nx.length>245) break;
        candidate+=" "+nx;
      }
      if(candidate.length>30 && candidate.length<250){
        const cues = /\b(?:DESENVOLVIMENTO|AVALIA[ÇC][ÃA]O|AN[ÁA]LISE|PRODU[ÇC][ÃA]O|IMPORT[ÂA]NCIA|EXTRA[ÇC][ÃA]O|TRATAMENTO|ESTUDO|PESQUISA|CARACTERIZA[ÇC][ÃA]O|ELABORA[ÇC][ÃA]O|UTILIZA[ÇC][ÃA]O|APLICA[ÇC][ÃA]O|QUALIDADE|DETERMINA[ÇC][ÃA]O|BIOPL[ÁA]STICO|BIODIESEL|AMBIENTAL|HORTA|POLUI[ÇC][ÃA]O|GIZ(?:ES)?|CERA)\b/i;
        const words=line.split(/\s+/).length;
        // Linhas curtas em caixa-alta no começo costumam ser nomes dos autores.
        const maybeName=words>=2 && words<=6 && line.length<65 && !cues.test(line);
        const score=candidate.length+(cues.test(candidate)?140:0)-(maybeName?260:0);
        blocks.push({value:candidate,score});
      }
    }
    blocks.sort((a,b)=>b.score-a.score);
    return blocks[0]?.value||"";
  }
  function guessSection(all, name, ending, maxLength) {
    const escaped = name.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
    const r = new RegExp("(?:^|\\n)\\s*"+escaped+"\\s*[:.]?\\s*\\n", "im");
    const m=r.exec(all);
    if(!m) return "";
    const rest=all.slice(m.index+m[0].length);
    const end=ending.exec(rest);
    const block=(end?rest.slice(0,end.index):rest).trim();
    return clean(block).slice(0,maxLength);
  }
  function guess(all,pages) {
    const lines=all.split(/\n+/).map(clean).filter(Boolean);
    const header=lines.slice(0,170);
    const out={};
    out.titulo=guessTitle(header,pages);
    out.autores=findLabel(header,/^(?:autor(?:es|a|as)?|alunos?|equipe|integrantes)\s*[:\-]\s*(.{4,300})$/i);
    out.orientador=findLabel(lines.slice(0,280),/^(?:orientador(?:a)?|professor(?:a)?\s+orientador(?:a)?)\s*[:\-]\s*(.{4,170})$/i);
    out.coorientador=findLabel(lines.slice(0,280),/^(?:(?:co[ -]?orientador(?:a)?|professor(?:a)?\s+co[ -]?orientador(?:a)?|co[ -]?orienta[çc][ãa]o))\s*[:\-]\s*(.{4,195})$/i);
    out.resumo=guessSection(all,"RESUMO",/\n\s*(?:Palavras[ -]chave|Keywords|ABSTRACT|1\s*[.\-]?\s*INTRODU[ÇC][ÃA]O|INTRODU[ÇC][ÃA]O|LISTA DE|SUM[ÁA]RIO)\b/i,4000);
    if(out.resumo && out.resumo.length<90) out.resumo="";
    const kwMatch=all.match(/(?:Palavras[ -]chave|Descritores)\s*[:.\-]\s*([^\n]{5,400})/i);
    out.palavrasChave=kwMatch?clean(kwMatch[1]).slice(0,400):"";
    const cursoMatch=all.slice(0,14000).match(/(?:curso\s+t[eé]cnico\s+(?:integrado\s+)?(?:em|de)|t[eé]cnico\s+em)\s+([A-Za-zÀ-ÿ ]{4,60})/i);
    if(cursoMatch)out.curso=clean(cursoMatch[1]).replace(/\s+(?:ano|turno|modalidade).*$/i,"").slice(0,120);
    if(!out.curso)for(const course of ["Química","Meio Ambiente","Eletrotécnica","Mecatrônica"]){
      if(new RegExp("CURSO.{0,25}"+norm(course).replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&"),"i").test(norm(all.slice(0,10000)))){
        out.curso=course;break;
      }
    }
    const years=(pages[0]||"").match(/\b20(?:0\d|1\d|2\d|3\d)\b/g);
    out.ano=years?.length?years[years.length-1]:"";
    if(/trabalho de conclus[aã]o|tcc/i.test(norm(all.slice(0,14000))))out.categoria="Trabalho de Conclusão de Curso (TCC)";
    else if(pages.length===1||/banner cient[ií]fico/i.test(all))out.categoria="Banner de pesquisa";
    const event=all.slice(0,15000).match(/\b(FECITESC|FECITEC|AFROTEP|AFROTEC|SEMATEP|SEMATEC|CEMATEP|FECIBA)\b/i);
    out.evento=event ? (window.CETEP_DICIONARIOS?.normalizarEvento(event[1]) || event[1].toUpperCase()) : "";
    return Object.fromEntries(Object.entries(out).filter(([key,val])=>!!clean(val) && Object.hasOwn(fields,key)));
  }


  function show(data) {
    current=data;
    list.replaceChildren();
    let count=0;
    for (const [key,label] of Object.entries(fields)) {
      const raw=padronizarCampo(key,data[key]);
      const val=key==="curso" ? (window.CETEP_DICIONARIOS?.normalizarCurso(raw) || "")
        : key==="evento" ? (window.CETEP_DICIONARIOS?.normalizarEvento(raw) || raw) : raw;
      current[key]=val;
      if(!val)continue;
      count++;
      const row=document.createElement("label");row.className="submission-suggestion";
      const check=document.createElement("input");check.type="checkbox";check.dataset.key=key;
      const existing=$(key)?.value || "";
      check.checked=!existing.trim() || key==="ano" && existing.trim()==="2026";
      const body=document.createElement("span");
      const strong=document.createElement("strong");strong.textContent=label;
      const preview=document.createElement("small");preview.textContent=val.length>270?val.slice(0,270)+"…":val;
      body.append(strong,preview);row.append(check,body);list.append(row);
    }
    suggestions.hidden=count===0;
    if(count) setStatus(count+" informação(ões) encontrada(s). Confira as sugestões antes de aplicar.");
    else setStatus("Não foi possível identificar informações suficientes. Preencha os campos manualmente.");
    return count;
  }


  localBtn.addEventListener("click", async () => {
    const file = pdfInput.files?.[0];
    if (!file) { setStatus("Selecione o PDF antes de pesquisar."); pdfInput.focus(); return; }
    if (pending) return;
    localBtn.disabled = true;
    try {
      const result = await extract();
      if (pdfInput.files?.[0] !== file) return;
      textExtracted = result.all;
      imagePreview = result.image || "";
      localFound = guess(result.all, result.pages);
      show(localFound);
      // Para qualquer PDF com texto extraível: leitura local primeiro,
      // depois revisão dos campos encontrados e sugestão dos ausentes pela IA.
      // A etapa de IA nunca preenche o formulário sem conferência humana.
      if (aiReady && (textExtracted.length >= 120 || imagePreview)) {
        apply.disabled = true;
        setStatus("Leitura inicial concluída. Conferindo os dados e buscando sugestões adicionais…");
        solicitarComplementoIA();
        return;
      }
      setStatus("Sugestões encontradas no PDF. Revise e selecione os dados que deseja preencher.");
    } catch (error) {
      setStatus(error.message || "Não foi possível ler o arquivo. Preencha manualmente.");
    } finally {
      if (!pending) localBtn.disabled = false;
    }
  });

  apply.addEventListener("click",()=>{
    let applied=0;
    for(const checkbox of list.querySelectorAll("input[type=checkbox]:checked")){
      const key=checkbox.dataset.key,input=$(key),value=current[key];
      if(!input || !value)continue;
      if(key==="evento") {
        const valid=[...input.options].some(o=>o.value===value);
        if(!valid){ input.value="__outros__"; $("eventoOutro").value=value; }
        else input.value=value;
        input.dispatchEvent(new Event("change",{bubbles:true}));
        applied++; continue;
      }
      if(input.tagName==="SELECT" && ![...input.options].some(o=>o.value===value))continue;
      input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));
      applied++;
    }
    suggestions.hidden=true;
    setStatus(applied+" campo(s) preenchido(s). Confira as informações e conclua manualmente os campos restantes.");
    $("titulo")?.scrollIntoView({behavior:"smooth",block:"center"});
  });


  // O complemento é ativado após busca voluntária do PDF, quando necessário.
  // O formulário avisa previamente que poderá haver processamento por IA.
  // O HTML faz POST ao aplicativo web sem expor a credencial da API.
  function limparPendente() {
    if (!pending) return;
    clearTimeout(pending.timeout);
    pending.iframe.remove();
    pending = null;
    localBtn.disabled = false;
    apply.disabled = false;
  }

  window.addEventListener("message", event => {
    if (!pending) return;
    const host = (() => {try {return new URL(event.origin).hostname;} catch (_) {return "";} })();
    const googleOrigin = host === "script.google.com" ||
      host === "script.googleusercontent.com" ||
      host.endsWith(".script.googleusercontent.com") ||
      host.endsWith(".googleusercontent.com");
    if (!googleOrigin) return;
    const msg = event.data;
    if (!msg || msg.tipo !== "CETEP_IA_METADADOS" || msg.requisicaoId !== pending.id) return;
    limparPendente();
    if (msg.ok && msg.sugestoes && typeof msg.sugestoes === "object") {
      // A IA REVISA também o que a leitura local encontrou; quando há uma
      // sugestão confirmada, ela prevalece. Quando faltar evidência para um campo,
      // a pista local permanece apenas como sugestão a ser conferida pela pessoa.
      const merged = {...localFound};
      for (const key of Object.keys(fields)) {
        const suggestion = padronizarCampo(key,msg.sugestoes[key]);
        if (suggestion) merged[key] = suggestion;
      }
      show(merged);
      setStatus("Revisão concluída. Confira título, autores e demais informações antes de aplicar.");
      if (msg.consumo) {
        // Informações técnicas ficam no log para conferência, nunca na tela pública.
        console.info("CETEP-RM: identificação complementar concluída", {
          totalTokens: Number(msg.consumo.total)||0
        });
      }
    } else {
      show(localFound);
      setStatus("Não foi possível complementar os dados. Revise as sugestões e preencha o restante manualmente.");
    }
  });

  function solicitarComplementoIA() {
    if (!aiReady || (!textExtracted && !imagePreview) || pending) return;
    const id = crypto.randomUUID ?
      crypto.randomUUID() : Date.now().toString(36)+"_"+Math.random().toString(36).slice(2)+"_ref";
    let iframe, post;
    try {
      iframe = document.createElement("iframe");
      iframe.name = "metadados_"+id.replace(/[^a-zA-Z0-9_]/g,"");
      iframe.hidden = true;
      iframe.title = "Análise complementar do documento";
      document.body.append(iframe);
      post = document.createElement("form");
      post.method = "POST";
      post.action = backendUrl;
      post.target = iframe.name;
      // Pistas locais são usadas para checagem, nunca como fonte de verdade.
      // O nome/e-mail/vínculo de quem submete não entram neste objeto.
      const pistas = Object.fromEntries(Object.entries(localFound)
        .filter(([key]) => Object.hasOwn(fields,key))
        .map(([key,value]) => [key,clean(value).slice(0,key==="resumo"?220:180)]));
      const parameters = {
        acao:"analisarIA",
        requisicaoId:id,
        analiseAutomatica:"sim",
        pistasLocais:JSON.stringify(pistas),
        imagemPaginaBase64:imagePreview,
        // Somente texto extraível; PDF completo, e-mail e CPF não seguem à IA.
        textoPDF:textExtracted.slice(0,aiMaxChars)
          .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[e-mail omitido]")
          .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,"[documento omitido]")
          .replace(/\b\d{11}\b/g,"[documento omitido]")
      };
      for (const [name,value] of Object.entries(parameters)) {
        const h = document.createElement("input");
        h.type = "hidden"; h.name = name; h.value = value; post.append(h);
      }
      document.body.append(post);
      setStatus("Buscando informações complementares no documento…");
      const timeout = setTimeout(() => {
        if (!pending || pending.id !== id) return;
        limparPendente();
        show(localFound);
        setStatus("Não foi possível concluir a identificação. Confira as sugestões ou preencha os campos manualmente.");
      },65000);
      pending = {id,iframe,timeout};
      post.submit();
    } catch (err) {
      limparPendente();
      if (iframe) iframe.remove();
      apply.disabled = false;
      show(localFound);
      setStatus("Não foi possível complementar as sugestões. Você pode preencher os campos manualmente.");
    } finally {
      if (post) post.remove();
    }
  }
})();
