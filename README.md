# Repositório Pedagógico e Científico — CETEP-RM

Portal responsivo do CETEP-RM em HTML, CSS e JavaScript, hospedado no GitHub Pages.

## Páginas
- `index.html`: apresentação.
- `consultar.html`: **pesquisa realizada dentro do próprio site**, com filtros por título, palavras-chave, categoria, curso, ano e evento.
- `submeter.html`: formulário próprio, responsivo, com PDF de até 6 MB e envio ao backend Apps Script depois de ativado.
- `sobre.html`: apresentação institucional.
- `assets/busca.js`: carregamento e filtragem do catálogo no navegador.
- `assets/submissao.js`: validação do formulário e envio POST para o Apps Script.
- `assets/leitura-pdf.js`: identifica título, orientador, resumo e outros metadados na leitura local do PDF; permite revisar antes de preencher.
- `apps-script/AnaliseMetadadosIA.gs`: integração opcional com a OpenAI Responses API (GPT-6 Luna), após autorização, configuração privada da chave e implantação.
- [`apps-script/README-IA.md`](apps-script/README-IA.md): configuração da análise por IA e privacidade.
- `apps-script/SubmissaoWeb.gs`: backend que grava PDF na triagem e acrescenta a linha na Planilha Mestre.
- [`apps-script/README.md`](apps-script/README.md): passos de implantação na conta e-Nova.
- `data/catalogo-publico.json`: índice público **somente de metadados de trabalhos publicados e autorizados**.
- `assets/logo-cetep-rm-original.png`: imagem original do CETEP-RM, sem redesenho, cópia byte a byte do arquivo fornecido.

## Status da submissão própria
O HTML está no GitHub. **Ainda precisa de implantação manual no Apps Script**; enquanto o campo `submissaoWebExec` estiver vazio em `assets/config.js`, o botão novo fica desativado e o formulário antigo permanece disponível. A integração nunca concede publicação automática.

## Como funciona a consulta
A página carrega `data/catalogo-publico.json` no próprio domínio do site, processa os filtros localmente e apresenta cartões para cada trabalho. **Não abre a planilha.** Quando houver PDF autorizado, o cartão tem link direto ao documento no Drive.

A divulgação dos metadados NÃO altera permissões de arquivo: PDFs podem continuar exigindo acesso institucional e-Nova.

### Sincronização de novos trabalhos
**Importante:** a catalogação pelo Google Apps Script continua independente. Neste momento, o índice JSON do GitHub **não é atualizado automaticamente** quando um novo trabalho for aprovado no Google Sheets.

Para atualizar, use exclusivamente as linhas com status **Publicado** da planilha de consulta institucional (não a planilha mestre), selecione os campos públicos `id`, `titulo`, `categoria`, `evento`, `curso`, `ano`, `palavrasChave`, `pdf` e atualize `data/catalogo-publico.json`.

Nunca inclua nomes de alunos, e-mails, identificadores pessoais, dados da triagem, arquivos internos ou documentos ainda não aprovados.

**Próxima melhoria planejada:** sincronizar automaticamente esse índice público com o catálogo institucional por um serviço autenticado, sem publicar tokens/chaves no código do GitHub Pages.

## Publicação
Configurar em Settings → Pages → Deploy from a branch → `main` → `/(root)`.

Endereço esperado: https://reinereng.github.io/repositorio-cetep-rm/

## Segurança
GitHub Pages é público: qualquer pessoa pode examinar os arquivos HTML, CSS, JS e JSON. Coloque ali apenas dados explicitamente autorizados para publicação pública.

**Não** exponha a planilha mestre, tokens, chaves de IA ou dados pessoais. A submissão e a curadoria continuam no Google Workspace e-Nova.
