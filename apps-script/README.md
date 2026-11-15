# Implantação da submissão própria — CETEP-RM

## Situação atual
O frontend está publicado em `submeter.html` (GitHub Pages). O arquivo do backend está em `SubmissaoWeb.gs`. Ele **ainda precisa ser adicionado à conta e-Nova e implantado**; a conexão GitHub não instala código diretamente no editor Apps Script.

Por segurança, enquanto `submissaoWebExec` estiver vazio em `assets/config.js`, o botão **Enviar para triagem** fica desabilitado e o formulário antigo do Google Forms permanece disponível.

## Configuração no projeto Apps Script já existente

**Não apague, renomeie nem substitua o `Code.gs` ou `ConsultaWeb.gs` que estão funcionando.**

1. Acesse a planilha mestre na conta e-Nova. Abra **Extensões > Apps Script**.
2. À esquerda, clique em **+ → Script**, crie o arquivo `SubmissaoWeb`.
3. Copie o conteúdo integral de [SubmissaoWeb.gs](SubmissaoWeb.gs) para o novo arquivo e salve.
4. Selecione a função `verificarSubmissaoWeb` e clique **Executar**. Autorize as permissões necessárias e confira os registros do log. Essa função apenas verifica planilha e pasta, sem receber arquivos.
5. **Implantar > Gerenciar implantações**, localize a implantação de aplicativo da web e crie uma nova versão, ou utilize **Implantar > Nova implantação > Aplicativo da Web**. Configure:
   - **Executar como:** Eu (proprietário do Drive institucional)
   - **Quem tem acesso:** **Somente usuários da organização e-Nova** (não selecionar Qualquer pessoa)
6. Copie a URL de implantação terminada em `/exec`.
7. No GitHub, edite `assets/config.js` e preencha a propriedade `submissaoWebExec` com a URL `/exec`; não inclua token, senha nem dados de estudante.
8. No editor Apps Script, execute manualmente `ativarSubmissaoWeb` para habilitar o recebimento. Essa função altera apenas uma configuração da automação. **Não reinstale os gatilhos antigos.**
9. Acesse o site com uma conta e-Nova, envie **um PDF de teste não sensível de até 6 MB** e confira se:
   - o arquivo foi criado em `01_RECEBIDOS_PARA_TRIAGEM`;
   - uma nova linha apareceu em `Respostas ao formulário 1`;
   - a linha correspondente em `SUBMISSOES` está com status **Recebido**;
   - nenhuma publicação foi feita no catálogo público.
10. Peça para outro professor testar com a conta e-Nova. Enquanto não confirmar o comportamento do login e do POST do Google Workspace, mantenha o Google Forms como alternativa.

### Observações de segurança
O site GitHub Pages é público, mas o endpoint deve ficar limitado a contas e-Nova. O backend exige `Session.getActiveUser().getEmail()` com domínio `enova.educacao.ba.gov.br`; se o Google não fornecer a identidade autenticada nessa implantação, o envio será recusado — **não remova essa validação para fazê-lo funcionar**.

O `doPost` recebe um corpo `application/x-www-form-urlencoded` com o PDF convertido para Base64 no navegador, sem usar CORS. Ao concluir, a navegação exibe uma página de confirmação do Apps Script. Os arquivos são recebidos diretamente no Drive, não são armazenados no repositório do GitHub.

O Apps Script que já cataloga os TCCs continua com os mesmos fluxos e gatilhos. Como a linha é acrescentada por código (e não por resposta real do Google Forms), o backend marca o campo `SUBMISSOES!K` como **Recebido** explicitamente.

### Se o PDF tiver mais de 6 MB
Use o formulário anterior. O limite é intencional para a primeira versão; poderemos ampliar após testar os limites de requisição do Apps Script.

### Como suspender os envios
Execute `desativarSubmissaoWeb` no projeto Apps Script. O botão da página continuará visível, mas o servidor recusará novos recebimentos e mostrará orientação para usar o formulário antigo.

### Importante para a administração
A autorização de divulgação e a verificação de privacidade **não são marcadas como confirmadas automaticamente**. A curadoria continua preenchendo as colunas V, W e X e aprovando pela coluna K, usando o fluxo atual.


## Sincronização automática do acervo com o GitHub Pages

O arquivo [SincronizarCatalogoGitHub.gs](SincronizarCatalogoGitHub.gs) sincroniza a aba `ACERVO_INSTITUCIONAL` com `data/catalogo-publico.json` a cada 15 minutos. Somente os metadados já publicados no catálogo de consulta são copiados (ID, título, categoria, evento, curso, ano, palavras-chave e link do PDF). Não são enviados nomes de alunos, emails, resumos, dados de triagem nem o próprio PDF.

**Configuração uma única vez (necessária):**

1. No GitHub, crie um **fine-grained personal access token** com acesso apenas ao repositório `reinereng/repositorio-cetep-rm`, permissão **Contents: Read and write**, e validade limitada.
2. Na Planilha Mestre, abra **Extensões > Apps Script**. Crie um novo arquivo Script `SincronizarCatalogoGitHub` e cole o conteúdo do arquivo `SincronizarCatalogoGitHub.gs`. Não altere os códigos de publicação existentes.
3. Em **Configurações do projeto > Propriedades do script**, adicione a propriedade `CETEP_GITHUB_TOKEN` com o valor do token. **Nunca me envie o token**, nem o coloque no GitHub, HTML, JS ou Sheets.
4. Execute manualmente `sincronizarCatalogoGitHub`. Confirme que o GitHub atualizou o JSON ou que o log mostrou “nenhuma gravação necessária”.
5. Execute uma única vez `instalarGatilhoCatalogoGitHub`, que agenda a verificação a cada 15 minutos. Ele detecta gatilhos anteriores para evitar duplicatas.

A sincronização não modifica PDFs, não altera permissões de Drive, não aprova trabalhos e não cria arquivos internos no GitHub. Publicações aprovadas ficam disponíveis após a próxima execução e atualização do GitHub Pages.

Para desligar as atualizações automáticas, execute `removerGatilhoCatalogoGitHub` ou revogue o token no GitHub. Ao expirar o token, será necessário substituí-lo nas Propriedades do Script.

**Atenção:** o GitHub Pages é público. A sincronização deve ser usada somente se todos os registros de `ACERVO_INSTITUCIONAL` forem autorizados para divulgação dos metadados. Não coloque nessa aba materiais confidenciais ou ainda pendentes.
