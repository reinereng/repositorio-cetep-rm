// Configuração pública: não inclua tokens, senhas, chaves de API ou dados pessoais.
window.CETEP_CONFIG = Object.freeze({
  formulario: "https://forms.gle/a8Pf7tfMcteJvhjP8",
  catalogoInstitucional: "https://docs.google.com/spreadsheets/d/1TmexSbzLLjBNoNf6X6lc3iTYRoLDY98NqfHia3GV8v0/edit",
  // Opcional: cole aqui o endereço /exec do Apps Script de consulta autenticada.
  consultaWebExec: "",
  // Implantação no domínio e-Nova. O envio exige autenticação institucional e backend ativado.
  // Nunca insira credenciais nem tokens neste arquivo público.
  submissaoWebExec: "https://script.google.com/a/macros/enova.educacao.ba.gov.br/s/AKfycbxV-5h0bbdy1EiDS5XTBEtK_VTxx0yRSx1eP59uISRUiBeTxSTmyizvKWAAtAi8tdF34Q/exec",
  limitePdfMB: 6,
  // A pesquisa poderá complementar automaticamente campos ausentes via IA.
  // A credencial fica exclusivamente nas propriedades do Apps Script.
  // O backend somente atende quando configurado; em falha, permanece o preenchimento manual.
  iaMetadadosAtiva: true
});
