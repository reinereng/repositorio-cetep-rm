/* CETEP-RM: extração local de texto do PDF + revisão humana.
 * A leitura inicial usa PDF.js no navegador; não envia o PDF ao serviço de IA.
 * A análise opcional por modelo exige consentimento e backend do Apps Script.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const pdfInput = $("arquivoPdf"), localBtn = $("identificar-pdf"), aiBtn = $("analisar-com-ia");
  if (!pdfInput || !localBtn) return;
  const status = $("extracao-status"), suggestions = $("revisao-sugestoes");
  const list = $("lista-sugestoes"), apply = $("aplicar-sugestoes");
  const aiConsent = $("consentimento-ia"), aiConsentBox = $("consentimento-ia-box");
  const aiDesc = $("ia-explicacao");
  const config = window.CETEP_CONFIG || {};
  const limitBytes = (Number(config.limitePdfMB) || 6) * 1024 * 1024;
  const pdfjsSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.5.438/pdf.min.mjs";
  const workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.5.438/pdf.worker.min.mjs";
  const backendUrl = String(config.submissaoWebExec || "");
  const aiReady = config.iaMetadadosAtiva === true && /^https:\/\/script\.google\.com\//.test(backendUrl);
  let textExtracted = "", current = {};
  const fields = {
    titulo: "Título", autores: "Autores", orientador: "Orientador(a)",
    resumo: "Resumo", palavrasChave: "Palavras-chave", ano: "Ano",
    curso: "Curso/Área", categoria: "Categoria", evento: "Feira/Evento"
  };
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const norm = s => clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (aiReady) {
    aiBtn.disabled = false;
    aiConsentBox.hidden = false;
    aiDesc.textContent = "Para usar IA, marque a autorização acima. O texto extraído do PDF será processado pelo serviço de IA configurado, sem substituir sua conferência.";
  } else {
    aiBtn.hidden = true;
    aiDesc.textContent = "A identificação de campos funciona no próprio navegador, sem enviar o texto do PDF a um serviço externo. Arquivos digitalizados como imagem podem não conter texto reconhecível.";
  }
  function setStatus(message) { status.textContent = message; }
  function resetReading() {
    textExtracted = ""; current = {};
    suggestions.hidden = true;
    list.replaceChildren();
    setStatus("PDF selecionado. Clique em “Identificar informações do PDF”.");
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
    setStatus("Lendo as primeiras páginas do PDF no navegador…");
    const pdfjs = await import(pdfjsSrc);
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await task.promise;
    try {
      const total = Math.min(pdf.numPages, 12);
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
      if (all.replace(/\s/g,"").length < 100) {
        throw new Error("Não consegui extrair texto suficiente. O arquivo pode estar digitalizado como imagem; preencha manualmente.");
      }
      return {all, pages:texts, count: pdf.numPages};
    } finally { await pdf.destroy(); }
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
    const event=all.slice(0,15000).match(/\b(FECITEC|FECITESC|CEMATEP|FECIBA)\b/i);
    out.evento=event?event[1].toUpperCase():"";
    return Object.fromEntries(Object.entries(out).filter(([key,val])=>!!clean(val) && Object.hasOwn(fields,key)));
  }

  function show(data,source) {
    current=data;
    list.replaceChildren();
    let count=0;
    for (const [key,label] of Object.entries(fields)) {
      const val=clean(data[key]);
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
    if(count) setStatus(source+": "+count+" campo(s) identificado(s). Revise as sugestões antes de aplicar.");
    else setStatus("Nenhum campo confiável foi identificado. Você pode preencher o formulário manualmente.");
  }

  localBtn.addEventListener("click",async()=>{
    if(!pdfInput.files?.length){setStatus("Selecione o PDF antes de iniciar.");pdfInput.focus();return;}
    localBtn.disabled=true;
    try {
      const res=await extract();textExtracted=res.all;
      show(guess(res.all,res.pages),"Leitura local");
    }catch(err){setStatus(err.message||"Não foi possível ler o PDF.");}
    finally{localBtn.disabled=false;}
  });
  apply.addEventListener("click",()=>{
    let applied=0;
    for(const checkbox of list.querySelectorAll("input[type=checkbox]:checked")){
      const key=checkbox.dataset.key,input=$(key),value=current[key];
      if(!input || !value)continue;
      if(input.tagName==="SELECT" && ![...input.options].some(o=>o.value===value))continue;
      input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));
      applied++;
    }
    suggestions.hidden=true;
    setStatus(applied+" campo(s) preenchido(s). Confira as informações e conclua manualmente os campos restantes.");
    $("titulo")?.scrollIntoView({behavior:"smooth",block:"center"});
  });

  // A análise com IA envia APENAS trechos textuais, após autorização expressa.
  // Usa POST de formulário para iframe: Apps Script não oferece CORS padrão.
  let pending=null;
  window.addEventListener("message",event=>{
    if(!pending)return;
    const host=(()=>{try{return new URL(event.origin).hostname;}catch(_){return "";}})();
    if(host!=="script.google.com" && host!=="script.googleusercontent.com" && !host.endsWith(".script.googleusercontent.com") && !host.endsWith(".googleusercontent.com"))return;
    const msg=event.data;
    if(!msg || msg.tipo!=="CETEP_IA_METADADOS" || msg.requisicaoId!==pending.id)return;
    clearTimeout(pending.timeout);pending.iframe.remove();pending=null;aiBtn.disabled=false;
    if(msg.ok && msg.sugestoes && typeof msg.sugestoes==="object"){
      show(Object.fromEntries(Object.entries(msg.sugestoes).filter(([k])=>Object.hasOwn(fields,k))),"Análise por IA");
    }else{setStatus("A análise por IA não foi concluída: "+String(msg.erro||"verifique a configuração do serviço"));}
  });

  aiBtn.addEventListener("click",async()=>{
    if(!aiReady)return;
    if(!aiConsent.checked){setStatus("Marque a autorização para enviar o texto extraído ao serviço de IA.");aiConsent.focus();return;}
    if(!textExtracted){setStatus("Primeiro clique em “Identificar informações do PDF”.");return;}
    if(pending){setStatus("Já existe uma análise em andamento.");return;}
    const id=crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
    const iframe=document.createElement("iframe");iframe.name="ia_recebe_"+id.replace(/[^a-zA-Z0-9_]/g,"");
    iframe.hidden=true;iframe.setAttribute("title","Resposta da análise institucional por IA");document.body.append(iframe);
    const post=document.createElement("form");post.method="POST";post.action=backendUrl;post.target=iframe.name;
    const values={
      acao:"analisarIA", requisicaoId:id, consentimento:"sim",
      // Nunca envie o PDF ao modelo: apenas texto limitado e sem e-mails/telefones.
      textoPDF:textExtracted.slice(0,18000).replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[e-mail omitido]").replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,"[documento omitido]")
    };
    for(const [name,value] of Object.entries(values)){
      const hidden=document.createElement("input");hidden.type="hidden";hidden.name=name;hidden.value=value;post.append(hidden);
    }
    document.body.append(post);aiBtn.disabled=true;
    setStatus("Analisando os campos com IA. Aguarde a resposta institucional…");
    const timeout=setTimeout(()=>{
      if(!pending || pending.id!==id)return;
      pending.iframe.remove();pending=null;aiBtn.disabled=false;
      setStatus("A análise não respondeu. Use as sugestões da leitura local ou preencha manualmente.");
    },65000);
    pending={id,iframe,timeout};
    post.submit();post.remove();
  });
})();
