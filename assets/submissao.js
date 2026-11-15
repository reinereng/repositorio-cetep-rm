(() => {
  "use strict";
  const form = document.getElementById("form-submissao");
  if (!form) return;
  const $ = id => document.getElementById(id);
  const cfg = window.CETEP_CONFIG || {};
  const endpoint = String(cfg.submissaoWebExec || "").trim();
  const habilitado = (() => {
    try {
      const destino = new URL(endpoint);
      // Aceita o formato padrão e o formato institucional e-Nova do Apps Script.
      return destino.protocol === "https:" &&
        destino.hostname === "script.google.com" &&
        /^\/(?:macros\/s|a\/macros\/enova\.educacao\.ba\.gov\.br\/s)\/[A-Za-z0-9_-]+\/exec$/.test(destino.pathname) &&
        !destino.search && !destino.hash;
    } catch (_) { return false; }
  })();
  const btn = $("enviar-trabalho"), info = $("aviso-integracao"), status = $("envio-status");
  const arquivo = $("arquivoPdf"), arquivoInfo = $("arquivo-info"), resumo = $("resumo");
  const maxBytes = (Number(cfg.limitePdfMB) || 6) * 1024 * 1024;
  let enviando = false;

  if (habilitado) {
    form.action = endpoint;
    btn.disabled = false;
    info.classList.add("submission-notice--ready");
    info.textContent = "Envio disponível. Entre com sua conta e-Nova, preencha as informações e aguarde a confirmação do recebimento pelo sistema institucional.";
    status.textContent = "Preencha os campos obrigatórios e anexe um PDF para enviar à triagem.";
  } else {
    info.innerHTML = "O formulário personalizado já está pronto, mas o recebimento automático aguarda a implantação do Apps Script. Até a ativação, utilize o <a href=\"https://forms.gle/a8Pf7tfMcteJvhjP8\" target=\"_blank\" rel=\"noopener noreferrer\">formulário institucional existente</a>.";
    status.textContent = "Envio temporariamente indisponível. Utilize o formulário existente no link acima.";
  }
  function formatar(bytes) { return (bytes / 1024 / 1024).toFixed(2).replace(".", ",") + " MB"; }
  arquivo.addEventListener("change", () => {
    const file = arquivo.files && arquivo.files[0];
    arquivoInfo.textContent = file ? file.name + " — " + formatar(file.size) : "Nenhum arquivo selecionado.";
    arquivoInfo.classList.toggle("submission-file-info--bad", !!file && (file.size > maxBytes || !/\.pdf$/i.test(file.name)));
  });
  resumo.addEventListener("input", () => {
    $("resumo-contador").textContent = resumo.value.length.toLocaleString("pt-BR") + " / 4.000 caracteres";
  });
  const categoria = $("categoria"), evento = $("evento"), eventoOutro = $("eventoOutro");
  const atualizarEvento = () => {
    const isBanner = categoria.value === "Banner de pesquisa";
    const outro = evento.value === "__outros__";
    evento.required = isBanner;
    $("campo-outro-evento").hidden = !outro;
    eventoOutro.required = outro;
    if (!outro) eventoOutro.value = "";
  };
  categoria.addEventListener("change", atualizarEvento);
  evento.addEventListener("change", atualizarEvento);
  atualizarEvento();

  const lerBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const split = value.indexOf(",");
      if (split < 0) reject(new Error("Falha ao ler o arquivo."));
      else resolve(value.slice(split + 1));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!habilitado || enviando) return;
    if (!form.reportValidity()) return;
    const file = arquivo.files && arquivo.files[0];
    if (!file) { status.textContent = "Selecione o PDF antes de enviar."; arquivo.focus(); return; }
    if (file.size <= 0 || file.size > maxBytes || !/\.pdf$/i.test(file.name)) {
      status.textContent = "O arquivo precisa ser um PDF de até " + (maxBytes / 1048576) + " MB.";
      arquivo.focus();
      return;
    }
    const ano = Number($("ano").value);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2099) {
      status.textContent = "Revise o ano do trabalho.";
      $("ano").focus();
      return;
    }
    enviando = true;
    btn.disabled = true;
    btn.textContent = "Preparando o PDF…";
    status.textContent = "Verificando o PDF antes do envio institucional.";
    try {
      const buf = await file.slice(0, 5).arrayBuffer();
      const signature = new TextDecoder().decode(buf);
      if (signature !== "%PDF-") throw new Error("O arquivo selecionado não contém a assinatura de PDF.");
      const base64 = await lerBase64(file);
      const fields = Object.fromEntries(new FormData(form).entries());
      // Usa somente nomes canônicos, independentemente de caixa ou acentos.
      const dicionarios = window.CETEP_DICIONARIOS;
      const cursoPadrao = dicionarios?.normalizarCurso(fields.curso);
      if (!cursoPadrao) throw new Error("Selecione um curso válido na lista.");
      fields.curso = cursoPadrao;
      fields.evento = evento.value === "__outros__"
        ? String(eventoOutro.value || "").trim() : dicionarios?.normalizarEvento(evento.value) || "";
      if (evento.value === "__outros__" && fields.evento.length < 3) {
        throw new Error("Informe o nome do outro evento científico.");
      }
      delete fields.eventoOutro;
      delete fields.metadados;
      delete fields.arquivoBase64;
      fields.aceite = $("aceite").checked ? "sim" : "nao";
      fields.arquivoNome = file.name;
      fields.envioId = (crypto.randomUUID ? crypto.randomUUID() :
        (Date.now().toString(36) + "_" + Math.random().toString(36).slice(2) + "_id"));
      $("metadados").value = JSON.stringify(fields);
      $("arquivoBase64").value = base64;
      status.textContent = "Enviando para a triagem. A página exibirá a confirmação do Apps Script.";
      btn.textContent = "Enviando…";
      // Um POST HTML padrão evita depender de CORS para script.google.com.
      // O backend retorna página institucional de sucesso/erro; nunca inventamos confirmação local.
      form.submit();
    } catch (err) {
      enviando = false;
      btn.disabled = false;
      btn.textContent = "Enviar para triagem";
      status.textContent = err.message || "Não foi possível preparar o envio.";
      $("arquivoBase64").value = "";
    }
  });
})();
