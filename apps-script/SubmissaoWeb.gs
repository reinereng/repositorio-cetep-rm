/**
 * CETEP-RM — Recebimento via GitHub Pages (etapa 1)
 * Adicione este arquivo ao projeto Apps Script VINCULADO à Planilha Mestre.
 * NÃO substitua o Code.gs atual. Não cria gatilhos, não publica PDFs.
 *
 * Implantar como aplicativo da Web: Executar como "Eu";
 * Quem tem acesso: SOMENTE organização e-Nova (DOMÍNIO).
 *
 * IMPORTANTE: o doGet() existente da consulta deve ser preservado.
 * Este arquivo adiciona apenas doPost() e rotinas de validação.
 */
const ENVIO_WEB = Object.freeze({
  pastaTriagem: '01_RECEBIDOS_PARA_TRIAGEM',
  dominio: 'enova.educacao.ba.gov.br',
  limiteBytes: 6 * 1024 * 1024,
  urlVoltar: 'https://reinereng.github.io/repositorio-cetep-rm/submeter.html',
  termo: 'Declaro que o material encaminhado corresponde a uma versão autorizada para submissão ao repositório pedagógico e científico do CETEP-RM. Estou ciente de que a disponibilização para consulta dependerá de avaliação e das autorizações institucionais aplicáveis, especialmente quanto à autoria, aos direitos de terceiros e à proteção de dados pessoais.'
});

function verificarSubmissaoWeb() {
  const contexto = contextoEnvioWeb_();
  Logger.log('Planilha de respostas: ' + contexto.respostas.getName());
  Logger.log('Planilha de curadoria: ' + contexto.curadoria.getName());
  Logger.log('Pasta de recebidos: ' + contexto.pasta.getName());
  Logger.log('Envio ativo: ' + (PropertiesService.getScriptProperties().getProperty('CETEP_RECEBIMENTO_ATIVO') === 'SIM'));
}

/** Execute manualmente após conferir a implantação para a organização e-Nova. */
function ativarSubmissaoWeb() {
  verificarSubmissaoWeb();
  PropertiesService.getScriptProperties().setProperty('CETEP_RECEBIMENTO_ATIVO', 'SIM');
  Logger.log('Recebimento habilitado: teste com uma conta e-Nova.');
}

/** Desativa novos envios sem alterar documentos nem submissões existentes. */
function desativarSubmissaoWeb() {
  PropertiesService.getScriptProperties().setProperty('CETEP_RECEBIMENTO_ATIVO', 'NAO');
  Logger.log('Recebimento desativado.');
}

function doPost(e) {
  // Análise opt-in: sugere campos, nunca grava PDF nem publica dados.
  if (e && e.parameter && e.parameter.acao === 'analisarIA') {
    return analisarMetadadosIA_(e);
  }
  let retorno;
  try {
    retorno = receberSubmissaoWeb_(e);
    return respostaEnvioWeb_(true, 'Trabalho recebido', 
      'O arquivo foi enviado para triagem. Protocolo: ' + retorno.protocolo + '. A publicação dependerá da avaliação da equipe responsável.');
  } catch (err) {
    Logger.log('Falha no recebimento: ' + (err && err.stack ? err.stack : err));
    return respostaEnvioWeb_(false, 'Envio não concluído',
      err && err.message ? err.message : 'Não foi possível concluir o envio. Tente novamente ou use o formulário institucional.');
  }
}

function receberSubmissaoWeb_(e) {
  if (!e || !e.parameter) throw new Error('Solicitação inválida.');
  if (PropertiesService.getScriptProperties().getProperty('CETEP_RECEBIMENTO_ATIVO') !== 'SIM') {
    throw new Error('O novo formulário ainda não foi ativado. Utilize temporariamente o formulário institucional.');
  }
  const emailSessao = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!emailSessao || !emailSessao.endsWith('@' + ENVIO_WEB.dominio)) {
    throw new Error('A submissão exige uma sessão autenticada com uma conta institucional e-Nova. Entre com essa conta e tente novamente.');
  }

  let dados;
  try { dados = JSON.parse(String(e.parameter.metadados || '')); }
  catch (_) { throw new Error('Os dados do formulário estão incompletos ou inválidos.'); }
  if (!dados || typeof dados !== 'object') throw new Error('Dados da submissão inválidos.');
  const campo = (chave, limite) => {
    const v = String(dados[chave] == null ? '' : dados[chave]).trim();
    if (!v || v.length > limite) throw new Error('Revise o campo: ' + chave + '.');
    return v;
  };
  const obrig = ['nomeResponsavel','emailContato','vinculo','categoria','titulo','ano',
                 'curso','autores','orientador','resumo','palavrasChave'];
  const limites = {nomeResponsavel:160,emailContato:180,vinculo:40,categoria:70,
                   titulo:250,ano:4,curso:120,autores:1200,orientador:200,
                   resumo:4000,palavrasChave:400};
  const d = {};
  obrig.forEach(k => { d[k] = campo(k, limites[k]); });
  d.evento = String(dados.evento || '').trim().slice(0,160) || 'Não se aplica!';
  d.complemento = String(dados.complemento || '').trim().slice(0,1000);
  const categoriaValida = ['Trabalho de Conclusão de Curso (TCC)', 'Banner de pesquisa'];
  if (!categoriaValida.includes(d.categoria)) throw new Error('Escolha TCC ou banner de pesquisa.');
  if (!/^20\d{2}$/.test(d.ano)) throw new Error('Informe o ano com quatro dígitos.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.emailContato)) throw new Error('E-mail de contato inválido.');
  if (String(dados.aceite || '') !== 'sim') throw new Error('A declaração de responsabilidade precisa ser aceita.');
  if (String(dados.arquivoNome || '').slice(-4).toLowerCase() !== '.pdf') throw new Error('Envie um arquivo PDF.');
  const requestId = String(dados.envioId || '');
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(requestId)) throw new Error('Identificador do envio inválido.');

  const b64 = String(e.parameter.arquivoBase64 || '');
  if (!b64 || b64.length > Math.ceil(ENVIO_WEB.limiteBytes / 3) * 4 + 12 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new Error('PDF inválido ou superior a 6 MB.');
  }
  let bytes;
  try { bytes = Utilities.base64Decode(b64); }
  catch (_) { throw new Error('Não foi possível ler o PDF.'); }
  if (bytes.length === 0 || bytes.length > ENVIO_WEB.limiteBytes ||
      (bytes[0] & 255) !== 37 || (bytes[1] & 255) !== 80 ||
      (bytes[2] & 255) !== 68 || (bytes[3] & 255) !== 70 || (bytes[4] & 255) !== 45) {
    throw new Error('O arquivo não é um PDF válido ou ultrapassa 6 MB.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Há outro envio em andamento. Tente novamente.');
  try {
    const cache = CacheService.getScriptCache();
    const chaveCache = 'envio_' + requestId;
    const anterior = cache.get(chaveCache);
    if (anterior) return {protocolo:anterior};

    const cx = contextoEnvioWeb_();
    const nomeArquivo = 'RECEBIDO_WEB_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '_' + Utilities.getUuid().slice(0,8) + '.pdf';
    const arquivo = cx.pasta.createFile(Utilities.newBlob(bytes, 'application/pdf', nomeArquivo));
    // O arquivo permanece privado, na pasta de triagem. O curador decide a divulgação.
    let linhaCriada = false;
    try {
      const seguro = value => {
        const s = String(value == null ? '' : value);
        return /^[=+\-@]/.test(s) ? "'" + s : s; // Previne fórmulas introduzidas por texto do usuário.
      };
      const valores = [
        new Date(), emailSessao, seguro(d.nomeResponsavel), seguro(d.emailContato),
        seguro(d.vinculo), d.categoria, seguro(d.evento), seguro(d.titulo), d.ano,
        seguro(d.curso), seguro(d.autores), seguro(d.orientador), seguro(d.resumo),
        seguro(d.palavrasChave), arquivo.getUrl(), seguro(d.complemento), ENVIO_WEB.termo
      ];
      const linha = cx.respostas.getLastRow() + 1;
      cx.respostas.getRange(linha, 1, 1, 17).setValues([valores]);
      linhaCriada = true;
      // Inserção via Apps Script NÃO dispara o gatilho onFormSubmit: marca explicitamente.
      cx.curadoria.getRange(linha, 11).setValue('Recebido');
      SpreadsheetApp.flush();
      const registrado = cx.curadoria.getRange(linha, 1).getDisplayValue().trim();
      const protocolo = registrado || ('SUB-' + String(linha - 1).padStart(4, '0'));
      cache.put(chaveCache, protocolo, 21600);
      return {protocolo};
    } catch (erro) {
      if (!linhaCriada) {
        // Só desfaz upload quando nenhuma resposta foi gravada.
        try { arquivo.setTrashed(true); } catch (_) {}
      }
      throw new Error('Não foi possível finalizar o registro na planilha. Se o arquivo apareceu na triagem, não repita o envio: procure a curadoria.');
    }
  } finally {
    lock.releaseLock();
  }
}

function contextoEnvioWeb_() {
  // Reutiliza a configuração já existente no Code.gs do projeto da Planilha Mestre.
  if (typeof CFG === 'undefined' || !CFG.planilhaMestre || !CFG.pastaTCC) {
    throw new Error('Instale este arquivo no MESMO projeto Apps Script da Planilha Mestre.');
  }
  const ss = SpreadsheetApp.openById(CFG.planilhaMestre);
  const respostas = ss.getSheetByName(CFG.abaRespostas);
  const curadoria = ss.getSheetByName(CFG.abaSubmissoes);
  if (!respostas || !curadoria) throw new Error('As abas de respostas ou curadoria não foram encontradas.');
  const pais = DriveApp.getFolderById(CFG.pastaTCC).getParents();
  if (!pais.hasNext()) throw new Error('Não foi possível localizar a pasta principal do repositório.');
  const pastas = pais.next().getFoldersByName(ENVIO_WEB.pastaTriagem);
  if (!pastas.hasNext()) throw new Error('Não foi localizada a pasta ' + ENVIO_WEB.pastaTriagem + '.');
  return {respostas:respostas, curadoria:curadoria, pasta:pastas.next()};
}

function respostaEnvioWeb_(ok, titulo, mensagem) {
  const escapar = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapar(titulo) + ' | CETEP-RM</title>' +
    '<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;background:#f3f8fc;color:#18344e}' +
    '.wrap{max-width:610px;margin:8vh auto;padding:22px}.card{background:#fff;border-radius:18px;' +
    'padding:36px;box-shadow:0 16px 42px #17406a17;border-top:5px solid ' +
    (ok ? '#2478bf' : '#cf3e56') + '}h1{margin:0 0 12px;font-size:1.65rem;color:#09264d}' +
    'a{display:inline-block;margin-top:18px;background:#1158ac;color:#fff;text-decoration:none;' +
    'padding:12px 20px;border-radius:10px;font-weight:750}small{color:#536f86}</style></head>' +
    '<body><main class="wrap"><section class="card"><small>REPOSITÓRIO PEDAGÓGICO E CIENTÍFICO · CETEP-RM</small>' +
    '<h1>' + escapar(titulo) + '</h1><p>' + escapar(mensagem) + '</p>' +
    '<a href="' + escapar(ENVIO_WEB.urlVoltar) + '" target="_top">Voltar ao repositório</a>' +
    '</section></main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(titulo);
}
