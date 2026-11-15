# CETEP-RM — Leitura de PDF e identificação com OpenAI

## 1. Modalidade sem custos de API: identificação local

No site **Submeter Trabalho**, selecione um PDF de até 6 MB e clique **Identificar informações do PDF**.

O site usa PDF.js no próprio navegador, lê até as 12 primeiras páginas de texto extraível e sugere título, autores (quando explicitamente identificados), orientador, resumo, palavras-chave, ano, curso, categoria e evento. O professor escolhe as sugestões que deseja aplicar e faz a conferência manual.

Essa modalidade **não chama nenhum modelo de IA e não consome créditos de API**. Não faz OCR: documentos escaneados como imagem exigem preenchimento manual.

## 2. Modalidade opcional com OpenAI

Foi preparada a integração com a **OpenAI Responses API**, utilizando por padrão o modelo econômico `gpt-6-luna`. O modelo possui saída estruturada em JSON.

**Importante:** a modalidade com GPT só é exibida depois de implantar o código na conta e-Nova, configurar a chave e ativar manualmente `iaMetadadosAtiva` no GitHub. A chave nunca deve ser escrita no frontend público nem compartilhada com o assistente.

A API OpenAI **é cobrada por tokens**. Créditos existentes na conta da API são usados, mas a assinatura do ChatGPT não equivale a créditos adicionais da API. A estimativa varia com a extensão do texto e do resumo; consulte os preços atuais em https://platform.openai.com/pricing/.

### Configuração no Apps Script (projeto existente da Planilha Mestre)

1. Entre em https://platform.openai.com/api-keys e crie uma chave de API em seu projeto autorizado. Se desejar, configure limite de gastos no painel da API.
2. Na Planilha Mestre, abra **Extensões > Apps Script > Configurações do projeto > Propriedades do script**.
3. Adicione as propriedades:
   - Nome: `CETEP_OPENAI_API_KEY` / Valor: sua chave da OpenAI (não a chave/token do GitHub).
   - Nome: `CETEP_OPENAI_MODEL` / Valor: `gpt-6-luna` (opcional; esse é o padrão). O modelo poderá ser alterado futuramente.
4. Crie ou substitua o arquivo **`AnaliseMetadadosIA.gs`** pelo código disponível neste repositório.
5. Atualize **somente `SubmissaoWeb.gs`** com o arquivo do repositório, se ainda não tiver a rota `acao=analisarIA` no `doPost`. **Não substitua `Code.gs`, `ConsultaWeb.gs` nem o sincronizador GitHub.**
6. Execute `verificarConfiguracaoIA`. A função só verifica a presença e o formato da configuração; **não consome créditos**.
7. Em **Implantar > Gerenciar implantações**, edite a implantação existente e selecione **Nova versão**. Preserve o acesso restrito à organização e-Nova.
8. Para teste, use primeiro um PDF fictício, sem dados pessoais. Somente depois de confirmar a autorização institucional e a funcionalidade do backend, altere no arquivo `assets/config.js`: `iaMetadadosAtiva: true`.
9. Faça o teste completo de **Aprimorar com GPT**. O sistema envia texto extraído e limitado do PDF **apenas após consentimento**, e devolve sugestões para revisão; não registra nem publica trabalho por essa ação.

### Privacidade e segurança

- GitHub Pages contém apenas a interface; **não contém o PDF nem a chave da API**.
- O botão de leitura local não envia texto para a OpenAI.
- Com GPT, o navegador envia **até 18.000 caracteres extraídos do PDF** ao Apps Script institucional; o Apps Script consulta a API OpenAI. E-mails e CPFs com formato usual são mascarados no navegador antes dessa etapa; nomes de alunos/autores **podem permanecer no texto**.
- A chamada à OpenAI está configurada com `store: false`, além de saída JSON estruturada; isso **não elimina** a necessidade de autorização institucional e avaliação de proteção de dados.
- A rota de IA exige conta do domínio e-Nova e aplica um intervalo mínimo entre análises para cada usuário.
- A análise de IA pode errar: sempre revise título, nomes, resumo e demais campos.
- O professor continua submetendo o PDF e metadados pelo mesmo fluxo de triagem existente.

### Dificuldades conhecidas

- **PDF escaneado sem texto:** a leitura local não realiza OCR.
- **Erro de autenticação/iframe:** confira o acesso e-Nova, a implantação mais recente e o console/registro de execução do Apps Script.
- **Erro de modelo ou limite de gastos:** valide `CETEP_OPENAI_MODEL`, saldo do projeto API e permissões de acesso ao modelo.
- **Botão da IA não aparece:** a flag `iaMetadadosAtiva` permanece `false` até a integração ser comprovada.
- **Formulário Google:** permanece como alternativa de submissão, sem relação com a IA.

## Documentação oficial

- API de Respostas: https://developers.openai.com/api/reference/resources/responses/methods/create
- Modelo econômico escolhido: https://developers.openai.com/api/docs/models/gpt-6-luna
- Preços da API: https://platform.openai.com/pricing/
