# Repositório Pedagógico e Científico — CETEP-RM

Portal responsivo do CETEP-RM em HTML, CSS e JavaScript, hospedado no GitHub Pages.

## Páginas
- `index.html`: apresentação.
- `consultar.html`: **pesquisa realizada dentro do próprio site**, com botão Pesquisar (ou Enter); sem exibir trabalhos antes da busca; filtros por título, palavras-chave, categoria, curso, ano e evento; cartões compactos com até três colunas no desktop.
- `submeter.html`: formulário próprio, responsivo, com PDF de até 6 MB e envio ao backend Apps Script depois de ativado.
- `sobre.html`: apresentação institucional.
- `assets/busca.js`: pesquisa por título, palavras-chave, resumo, curso, ano e evento; resumos recolhidos em cada cartão.
- `data/resumos-publicos.json`: resumos dos trabalhos já publicados, disponíveis para a busca (índice complementar).
- `assets/submissao.js`: validação do formulário e envio POST para o Apps Script.
- `assets/leitura-pdf.js`: oferece um único botão de identificação, lê até cinco páginas localmente e chama IA automaticamente apenas se encontrar menos de quatro campos, preservando a revisão humana.
- `apps-script/AnaliseMetadadosIA.gs`: integração opcional com a OpenAI Responses API (GPT-6 Luna), após autorização, configuração privada da chave e implantação.
- [`apps-script/README-IA.md`](apps-script/README-IA.md): configuração da análise por IA e privacidade.
- `apps-script/SubmissaoWeb.gs`: backend que grava PDF na triagem e acrescenta a linha na Planilha Mestre, incluindo o campo opcional de co-orientação em `SUBMISSOES!AC`.
- [`apps-script/README.md`](apps-script/README.md): passos de implantação na conta e-Nova.
- `data/catalogo-publico.json`: índice público **somente de metadados de trabalhos publicados e autorizados**.
- `assets/logo-cetep-rm-original.png`: imagem original do CETEP-RM, sem redesenho, cópia byte a byte do arquivo fornecido.

## Status da submissão própria
O frontend da submissão já aponta para a implantação institucional e-Nova. O código do Apps Script precisa estar atualizado e implantado na versão correspondente para que o envio e o complemento por IA funcionem. A aprovação de trabalhos continua sendo feita exclusivamente pela curadoria. O formulário alternativo permanece disponível.

## Como funciona a consulta
A página carrega `data/catalogo-publico.json` no próprio domínio do site, processa os filtros localmente e apresenta cartões para cada trabalho. **Não abre a planilha.** Quando houver PDF autorizado, o cartão tem link direto ao documento no Drive.

A divulgação dos metadados NÃO altera permissões de arquivo: PDFs podem continuar exigindo acesso institucional e-Nova.

### Sincronização de novos trabalhos
A rotina `SincronizarCatalogoGitHub.gs` atualiza o índice de trabalhos aprovados automaticamente quando o gatilho e o token GitHub estão configurados. Não atualiza documentos ainda em triagem.

Para atualizar, use exclusivamente as linhas com status **Publicado** da planilha de consulta institucional (não a planilha mestre), selecione os campos públicos `id`, `titulo`, `categoria`, `evento`, `curso`, `ano`, `palavrasChave`, `pdf` e atualize `data/catalogo-publico.json`.

Nunca inclua nomes de alunos, e-mails, identificadores pessoais, dados da triagem, arquivos internos ou documentos ainda não aprovados.

**Atualização administrativa:** após editar arquivos `.gs` no repositório, a versão correspondente também deve ser copiada para o projeto Apps Script. O aplicativo web precisa de nova implantação para receber alterações de `SubmissaoWeb.gs` ou `AnaliseMetadadosIA.gs`.

## Publicação
Configurar em Settings → Pages → Deploy from a branch → `main` → `/(root)`.

Endereço esperado: https://reinereng.github.io/repositorio-cetep-rm/

## Segurança
GitHub Pages é público: qualquer pessoa pode examinar os arquivos HTML, CSS, JS e JSON. Coloque ali apenas dados explicitamente autorizados para publicação pública.

**Não** exponha a planilha mestre, tokens, chaves de IA ou dados pessoais. A submissão e a curadoria continuam no Google Workspace e-Nova.


## Listas padronizadas de submissão

Os cursos aparecem em ordem alfabética no formulário: **Biocombustíveis, Eletrotécnica, Mecatrônica, Meio Ambiente, Química, Refrigeração, Segurança do Trabalho e Sistemas de Energia Renovável**.

Eventos previstos: **FECITESC, AFROTEP, SEMATEP, Outro evento (campo aberto), Não se aplica**. A ausência de evento é padrão para TCC, mas banners devem informar o evento.

O módulo `assets/dicionarios.js` padroniza sugestões como `QUÍMICA` → `Química`. O backend `apps-script/SubmissaoWeb.gs` valida os cursos no recebimento; o sincronizador `apps-script/SincronizarCatalogoGitHub.gs` normaliza os cursos do índice público, inclusive variações históricas. Essas duas alterações ao Apps Script exigem que o responsável atualize os arquivos no projeto e, para o Web App de submissão, publique uma nova versão.


## Pesquisa nos resumos

A consulta em `consultar.html` também pesquisa o **resumo dos trabalhos aprovados e publicados**. Os resumos atualmente disponíveis encontram-se no índice complementar `data/resumos-publicos.json`, preservado independentemente do sincronizador antigo. A versão atualizada de `apps-script/SincronizarCatalogoGitHub.gs` inclui o campo `resumo` em `data/catalogo-publico.json` nas próximas publicações. O navegador prioriza o resumo do JSON principal e recorre ao índice complementar quando ele ainda não está presente.

**Privacidade:** esses resumos integram os arquivos públicos do GitHub Pages. Somente indexe os resumos que a curadoria autorizou divulgar. Não acrescente documentos internos, registros de estudantes ou informações da etapa de triagem. Para aplicar a mudança futura, atualize o código `SincronizarCatalogoGitHub.gs` dentro do projeto Apps Script e salve; o gatilho existente continua funcionando, sem reinstalação.
