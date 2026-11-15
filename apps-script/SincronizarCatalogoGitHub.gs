/**
 * CETEP-RM — Sincronização automática do acervo público com GitHub Pages.
 * Instalar como NOVO arquivo de script no mesmo projeto da Planilha Mestre.
 * Não substitui Code.gs, ConsultaWeb.gs ou SubmissaoWeb.gs.
 *
 * Configure um token GitHub Fine-grained nas Propriedades do Script:
 * CETEP_GITHUB_TOKEN: token com acesso APENAS ao repositório
 * reinereng/repositorio-cetep-rm e permissão Contents: Read and write.
 *
 * Ative com instalarGatilhoCatalogoGitHub() e teste com sincronizarCatalogoGitHub().
 * Nunca copie o token para o GitHub Pages, HTML ou para esta fonte.
 */
const GITHUB_ACERVO = Object.freeze({
  planilha: '1TmexSbzLLjBNoNf6X6lc3iTYRoLDY98NqfHia3GV8v0',
  aba: 'ACERVO_INSTITUCIONAL',
  owner: 'reinereng',
  repo: 'repositorio-cetep-rm',
  branch: 'main',
  caminho: 'data/catalogo-publico.json',
  propriedadeToken: 'CETEP_GITHUB_TOKEN'
});

function instalarGatilhoCatalogoGitHub() {
  const token = PropertiesService.getScriptProperties().getProperty(GITHUB_ACERVO.propriedadeToken);
  if (!token) throw new Error('Configure CETEP_GITHUB_TOKEN em Configurações do projeto > Propriedades do script.');
  const existe = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'sincronizarCatalogoGitHub');
  if (!existe) {
    ScriptApp.newTrigger('sincronizarCatalogoGitHub').timeBased().everyMinutes(15).create();
  }
  Logger.log('Gatilho de sincronização configurado a cada 15 minutos.');
}

function removerGatilhoCatalogoGitHub() {
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sincronizarCatalogoGitHub')
    .forEach(t=>ScriptApp.deleteTrigger(t));
  Logger.log('Gatilho de sincronização removido. Nenhum registro foi apagado.');
}

/** Padroniza nomes dos cursos no catálogo publicado, inclusive trabalhos antigos. */
function cursoCatalogoPadronizado_(texto) {
  const original = String(texto || '').trim();
  const chave = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  const mapa = {
    'biocombustivel':'Biocombustíveis', 'biocombustiveis':'Biocombustíveis',
    'eletrotecnica':'Eletrotécnica', 'mecatronica':'Mecatrônica',
    'meio ambiente':'Meio Ambiente', 'quimica':'Química',
    'refrigeracao':'Refrigeração', 'refrigeracao e climatizacao':'Refrigeração',
    'seguranca do trabalho':'Segurança do Trabalho',
    'sistemas renovaveis':'Sistemas de Energia Renovável',
    'sistemas de energias renovaveis':'Sistemas de Energia Renovável',
    'sistemas de energia renovavel':'Sistemas de Energia Renovável'
  };
  return mapa[chave] || original;
}

function sincronizarCatalogoGitHub() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const token = PropertiesService.getScriptProperties()
      .getProperty(GITHUB_ACERVO.propriedadeToken);
    if (!token || !/^[^\s]+$/.test(token)) {
      throw new Error('Token GitHub não configurado nas Propriedades do Script.');
    }
    const ss = SpreadsheetApp.openById(GITHUB_ACERVO.planilha);
    const sh = ss.getSheetByName(GITHUB_ACERVO.aba);
    if (!sh) throw new Error('Aba institucional não encontrada.');
    const n = sh.getLastRow();
    const valores = sh.getRange(1, 1, Math.max(1, n), 10).getDisplayValues();
    const esperado = ['ID','Título','Categoria','Feira ou evento','Curso/Área',
                      'Ano','Resumo','Palavras-chave','Link do PDF','Data de publicação'];
    if (esperado.some((v,i) => valores[0][i] !== v)) {
      throw new Error('Estrutura da planilha mudou. Sincronização suspensa.');
    }
    const normalizarEvento = v => {
      const raw = String(v || '').trim();
      if (/^n[aã]o se aplica!?$/i.test(raw)) return '';
      const chave = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      const alias = {'FECITEC':'FECITESC', 'FECITESC':'FECITESC',
        'AFROTEC':'AFROTEP', 'AFROTEP':'AFROTEP',
        'SEMATEC':'SEMATEP', 'SEMATEP':'SEMATEP'};
      return alias[chave] || raw;
    };
    const mapa = {};
    for (let i=1; i<valores.length; i++) {
      const r = valores[i];
      const id = String(r[0] || '').trim();
      const link = String(r[8] || '').trim();
      if (!id && !link) continue;
      if (!/^CETEPRM-(?:TCC|BANNER)-20\d{2}-\d{4}$/.test(id)) {
        Logger.log('Linha ' + (i+1) + ' ignorada: ID inválido.');
        continue;
      }
      if (!/^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+/.test(link)) {
        Logger.log('Linha ' + (i+1) + ' ignorada: link inválido.');
        continue;
      }
      const titulo=String(r[1]||'').trim();
      const categoria=String(r[2]||'').trim();
      if (!titulo || !categoria) continue;
      mapa[id] = {
        id:id, titulo:titulo, categoria:categoria,
        evento:normalizarEvento(r[3]), curso:cursoCatalogoPadronizado_(r[4]),
        ano:String(r[5]||'').trim(),
        // Resumo de trabalho já aprovado e publicado: será pesquisável no site.
        // Não incluir documentos internos ou registros ainda em triagem.
        resumo:String(r[6]||'').replace(/\s+/g,' ').trim().slice(0,4000),
        palavrasChave:String(r[7]||'').trim(), pdf:link
      };
    }
    const registros = Object.keys(mapa).sort().map(id=>mapa[id]);
    // A página do GitHub é pública: incluímos APENAS obras catalogadas em
    // ACERVO_INSTITUCIONAL, com título, resumo acadêmico, palavras-chave e demais campos bibliográficos, sem e-mails, nomes de responsáveis pela submissão ou dados de triagem.
    const base = 'https://api.github.com/repos/' + GITHUB_ACERVO.owner
      + '/' + GITHUB_ACERVO.repo + '/contents/' + GITHUB_ACERVO.caminho;
    const headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    const get = UrlFetchApp.fetch(base + '?ref=' + GITHUB_ACERVO.branch, {
      method:'get',headers:headers,muteHttpExceptions:true
    });
    if (get.getResponseCode() !== 200) {
      throw new Error('GitHub GET falhou (HTTP ' + get.getResponseCode() + '). Verifique token e permissões.');
    }
    const remoto = JSON.parse(get.getContentText());
    const atual = JSON.parse(
      Utilities.newBlob(Utilities.base64Decode(String(remoto.content).replace(/\s/g,'')))
        .getDataAsString('UTF-8')
    );
    const atuais = Array.isArray(atual.registros) ? atual.registros : [];
    const equivalentes = list => list.map(x=>JSON.stringify(x)).sort().join('\n');
    if (equivalentes(atuais) === equivalentes(registros)) {
      Logger.log('Acervo público atualizado. ' + registros.length + ' registros; nenhuma gravação necessária.');
      return;
    }
    const novo = {
      versao:1,
      atualizadoEm:Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd'),
      origem:'Catálogo institucional — registros publicados',
      registros:registros
    };
    const body = {
      message:'Sync institutional approved CETEP-RM catalog',
      content:Utilities.base64Encode(Utilities.newBlob(
        JSON.stringify(novo,null,2) + '\n', 'application/json'
      ).getBytes()),
      sha:remoto.sha,
      branch:GITHUB_ACERVO.branch
    };
    const put = UrlFetchApp.fetch(base, {
      method:'put',contentType:'application/json',headers:headers,
      payload:JSON.stringify(body),muteHttpExceptions:true
    });
    if (put.getResponseCode() !== 200 && put.getResponseCode() !== 201) {
      throw new Error('GitHub PUT falhou (HTTP '+put.getResponseCode()+'). Verifique permissões e conflitos.');
    }
    Logger.log('GitHub atualizado com ' + registros.length + ' trabalho(s) autorizado(s).');
  } finally {
    lock.releaseLock();
  }
}
