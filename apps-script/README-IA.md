# CETEP-RM — Identificação automática de dados do PDF

## Funcionamento da interface

Na página **Submeter trabalho**, o usuário vê apenas o botão **Pesquisar no PDF**.

1. O navegador lê texto extraível de **até cinco páginas** do PDF, sem enviar o documento para IA.
2. Se encontrar **cinco ou mais campos**, exibe as sugestões para conferência, sem gastar tokens.
3. Se encontrar **menos de quatro campos** (zero a três) e a integração com OpenAI estiver habilitada, inicia automaticamente a análise complementar, sem pedir uma confirmação adicional. Um aviso claro sobre o possível processamento por IA aparece antes do botão Pesquisar no PDF.
4. Quando o complemento for necessário, até **12.000 caracteres** do texto extraído podem ser enviados ao Apps Script, que chama a OpenAI e retorna apenas sugestões para campos ainda não identificados. Nada é publicado ou submetido automaticamente pela análise.
5. Caso a integração esteja desativada, falhe, ou não haja texto extraível, o professor pode preencher o restante manualmente.

**Importante:** o sistema não realiza OCR. PDFs digitalizados como imagem podem exigir preenchimento manual. A IA é uma ajuda, não uma validação da exatidão dos dados. Co-orientador é opcional; os demais campos seguem a validação do formulário.

## Arquivos do Apps Script a manter atualizados

O projeto Apps Script é aquele vinculado à **Planilha Mestre** da conta e-Nova.

- [SubmissaoWeb.gs](SubmissaoWeb.gs): recebe o PDF, registra a submissão, valida cursos e eventos e armazena co-orientação em `SUBMISSOES!AC`; inclui a rota `acao=analisarIA`.
- [AnaliseMetadadosIA.gs](AnaliseMetadadosIA.gs): análise complementar com a Responses API da OpenAI, integrada à rota anterior.
- [SincronizarCatalogoGitHub.gs](SincronizarCatalogoGitHub.gs): sincroniza o catálogo aprovado, padroniza os eventos FECITESC, AFROTEP, SEMATEP e disponibiliza o resumo de obras publicadas para pesquisa.

**Não substituir** `Code.gs` (ou o código principal de curadoria), `ConsultaWeb.gs` e demais arquivos da automação existente.

## Atualização passo a passo

1. Faça uma cópia de segurança do projeto ou dos três arquivos Apps Script que serão atualizados.
2. Abra a **Planilha Mestre > Extensões > Apps Script**.
3. No editor, substitua integralmente o conteúdo de `SubmissaoWeb.gs` pelo arquivo atualizado do GitHub.
4. Substitua integralmente o conteúdo de `SincronizarCatalogoGitHub.gs` pela última versão do GitHub.
5. Se o arquivo `AnaliseMetadadosIA.gs` não existir, crie-o em **+ > Script**. Se existir, substitua seu conteúdo pela versão atualizada do GitHub.
6. Em **Configurações do projeto > Propriedades do script**, mantenha `CETEP_GITHUB_TOKEN` como já está. Para habilitar a IA, adicione `CETEP_OPENAI_API_KEY` com o valor de uma chave da API OpenAI de um projeto autorizado. Opcionalmente, use `CETEP_OPENAI_MODEL` com valor `gpt-6-luna`.
7. Clique em **Salvar**. Execute `verificarSubmissaoWeb` e `verificarConfiguracaoIA` (a última só valida a chave; não consome tokens). Execute `sincronizarCatalogoGitHub` uma vez para testar o índice.
8. Em **Implantar > Gerenciar implantações**, edite **a implantação web existente**, escolha **Nova versão** e confirme. Preserve o mesmo link `/exec`, acesso restrito à organização e-Nova e a configuração de execução que já funciona.
9. Faça uma submissão de teste com PDF fictício e verifique o recebimento; depois teste a identificação de poucos campos com uma conta e-Nova.
10. A configuração pública do GitHub já está com `iaMetadadosAtiva: true`. Assim que a implantação Apps Script atualizada estiver funcional, o complemento poderá ocorrer automaticamente nas buscas com menos de quatro campos. Em caso de erro, a leitura local e o preenchimento manual continuam disponíveis. Para suspender chamadas à API, altere a flag para `false`.

**Não reinstale** o gatilho de sincronização dos 15 minutos nem o da curadoria. Se você já acrescentou a pergunta opcional sobre co-orientador ao Google Forms **e ainda não instalou** seu gatilho dedicado, execute `instalarGatilhoCoorientadorFormulario` uma única vez.

## Privacidade, segurança e consumo de API

- A chave OpenAI deve ficar **somente nas propriedades privadas do Apps Script**, nunca no HTML, JS, planilha, GitHub ou conversa.
- A leitura inicial é executada no navegador. A análise complementar, quando necessária e habilitada, pode enviar texto a um serviço externo automaticamente, após o usuário iniciar a busca com conhecimento do aviso na página. Isso não dispensa a verificação institucional de uma base legal adequada ao tratamento dos dados.
- Antes de enviar, o JavaScript mascara e-mails e CPFs em formatos usuais. **Nomes de autores podem permanecer**: obtenha a autorização institucional necessária, especialmente se envolver menores de idade.
- O Apps Script utiliza `store:false`; isso não elimina todas as questões de proteção de dados. Consulte as regras e o contrato de tratamento aplicáveis.
- Há limite de texto (12 mil caracteres), de saída (`max_output_tokens`) e de frequência por usuário. Mesmo assim, chamadas efetivas à API geram custo segundo as tarifas e créditos da conta API.
- A contagem de tokens retornada pela API é registrada nos logs da administração, não exibida na interface dos professores.
- O formulário permanece plenamente utilizável manualmente caso a extração automática falhe.

**Documentação oficial:** https://developers.openai.com/api/docs/models/gpt-6-luna e https://platform.openai.com/pricing/.
