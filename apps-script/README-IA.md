# CETEP-RM — Preenchimento assistido por PDF e análise com IA

O portal possui duas modalidades na página **Submeter Trabalho**:

1. **Identificar informações do PDF** — funciona imediatamente, no navegador, usando PDF.js. Extrai texto digital e sugere os campos detectáveis. Não utiliza modelo de IA, não transmite o documento para outro serviço e não envia o formulário automaticamente.
2. **Aprimorar com IA** — opcional, utiliza o modelo Gemini chamado pelo Apps Script, mediante autorização explícita e conta institucional e-Nova. **Permanece desativado até a configuração abaixo.**

O chat de consulta ao acervo é uma funcionalidade diferente e não faz parte desta etapa.

## Como testar agora a identificação local

Abra a página de submissão no GitHub Pages, selecione um PDF de até 6 MB e clique **Identificar informações do PDF**. Revise o painel de sugestões, marque somente o que estiver correto e clique **Aplicar campos selecionados**. Confira os demais campos, aceite a declaração e envie normalmente.

A detecção é limitada a texto extraível das primeiras páginas do PDF (até 12 páginas). Digitalizações como imagens podem não funcionar; ainda não há OCR. Título, autores, orientador, resumo e palavras-chave podem não aparecer, dependendo do modelo do documento. Nenhuma sugestão é aceita automaticamente.

## Ativação da análise com IA (opcional)

Esta integração só deve ser ativada após autorização institucional para processamento externo de textos de documentos. O serviço utiliza uma conta API Gemini e pode estar sujeito a cobrança, limites de uso e políticas de tratamento de dados aplicáveis.

### 1. Obtenha uma chave da API Gemini

Use https://aistudio.google.com/apikey para gerar uma chave em projeto autorizado. Verifique custos, limites de uso e políticas institucionais. **Não envie a chave a outras pessoas ou ao ChatGPT.**

### 2. Adicione as propriedades do Apps Script

Abra a Planilha Mestre com a conta e-Nova → **Extensões > Apps Script** → **Configurações do projeto > Propriedades do script** e salve:

| Propriedade | Valor |
| --- | --- |
| `CETEP_GEMINI_API_KEY` | Chave criada na API Gemini |
| `CETEP_GEMINI_MODELO` | `gemini-3.5-flash-lite` (opcional; use modelo disponível em seu projeto) |

**Não use o token do GitHub nesse campo** — a chave da IA é outra credencial. Nunca salve credenciais no GitHub ou no HTML público.

### 3. Atualize o código do Apps Script existente

No projeto Apps Script **vinculado à Planilha Mestre**:

1. Crie um **novo arquivo de script** chamado `AnaliseMetadadosIA` e cole o conteúdo de [AnaliseMetadadosIA.gs](AnaliseMetadadosIA.gs).
2. Atualize **somente o arquivo `SubmissaoWeb.gs`** com a versão mais recente do [GitHub](SubmissaoWeb.gs). Ela preserva as funções de submissão e contém o encaminhamento `acao=analisarIA` dentro do `doPost`.
3. **Não substitua o `Code.gs`, `ConsultaWeb.gs` nem `SincronizarCatalogoGitHub.gs`.**
4. Salve e execute a função `verificarConfiguracaoIA`. Ela não envia texto à API; apenas valida a presença da chave e o nome do modelo.
5. Em **Implantar > Gerenciar implantações**, edite a implantação existente para criar uma **nova versão** do mesmo aplicativo web, mantendo as permissões de acesso restritas ao e-Nova. Não é necessário gerar uma URL diferente se você editar a implantação existente.
6. Faça um teste com um PDF de demonstração **sem dados pessoais** usando uma conta e-Nova. Verifique no registro de execução do Apps Script possíveis erros da API/modelo.

### 4. Habilite o botão no GitHub

Somente depois do teste bem-sucedido, altere em `assets/config.js`:

```js
iaMetadadosAtiva: true
```

A interface mostrará então o botão **Aprimorar com IA** e um campo de autorização explícita.

## Arquitetura de privacidade

- **GitHub Pages:** interface e código público, nunca contém chave de API ou PDF.
- **Leitura local PDF.js:** conteúdo do PDF é processado no navegador.
- **IA (opcional):** apenas os primeiros 18.000 caracteres do texto extraído, com e-mails e CPFs básicos mascarados, são enviados após o consentimento à implantação do Apps Script e daí à API Gemini. **Nomes de autores podem permanecer no texto**. É indispensável verificar a autorização institucional e eventual participação de menores.
- **Resposta da IA:** apresenta sugestões para o usuário marcar e aplicar. Não grava nem publica nada por si só.
- **Submissão final:** continua com o mesmo `SubmissaoWeb.gs` e a curadoria habitual.

## Resolução de problemas

- **Não encontrou texto:** PDF pode ser escaneado ou protegido. Preencha manualmente.
- **IA indisponível:** chave ausente, modelo não autorizado, implantação antiga ou política da conta e-Nova impedindo a requisição.
- **Sem resposta no navegador:** verifique logs da implantação e o possível bloqueio de terceiros/iframes. A integração via iframe e `postMessage` precisa ser validada com o Apps Script implantado; não é garantida até o teste.
- **Limite de tamanho:** PDF de até 6 MB para envio, o mesmo limite do formulário existente.
- **Preferência pelo Google Forms:** o link alternativo permanece na página de submissão.
