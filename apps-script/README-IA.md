# CETEP-RM — Leitura do PDF e revisão de metadados por IA

## Experiência do professor

Há apenas um botão, **Pesquisar no PDF**. Ao acioná-lo:

1. O navegador utiliza PDF.js para ler o texto de até **cinco páginas** do PDF e localizar pistas sobre título, autores, orientador, co-orientador, resumo, palavras-chave, ano, curso, categoria e evento.
2. Em **todas as pesquisas com texto extraível** e integração IA disponível, a OpenAI revê **também os campos já identificados**, e não somente os ausentes. As sugestões da IA fundamentadas no PDF prevalecem sobre os palpites locais; se a IA deixar um campo em branco, a pista local permanece para conferência.
3. Para **banners de uma página** e arquivos com pouco texto extraível, o navegador pode gerar uma **prévia JPEG reduzida da primeira página** e enviá-la para análise visual juntamente com o texto, quando disponível. Isso permite apoiar o preenchimento mesmo quando a primeira página é composta principalmente de imagem. Não é OCR completo de todas as páginas.
4. Títulos sugeridos são apresentados em escrita convencional, e nomes próprios são capitalizados adequadamente. A IA pode elaborar um **resumo fiel do conteúdo** e sugerir **palavras-chave** quando o PDF não trouxer esses elementos explicitamente. Nunca deve inventar autores, resultados, dados ou eventos.
5. O professor **confere e seleciona** quais sugestões deseja aplicar. **Nada é submetido ou publicado automaticamente** pela análise. Os campos de identificação do **responsável pelo envio** (nome, e-mail e vínculo) nunca são gerados a partir do PDF ou preenchidos pela IA.
6. Caso a IA esteja indisponível ou falhe, as informações extraídas localmente continuam disponíveis, e o preenchimento manual segue funcionando.

A consulta ao serviço de IA ocorre após a ação voluntária de clicar em Pesquisar no PDF e mediante o aviso de privacidade exibido no formulário. Não há uma segunda janela de confirmação.

## Arquitetura e dados

- Site público no GitHub Pages: `submeter.html`, `assets/leitura-pdf.js`, `assets/config.js`.
- Backend privado: `SubmissaoWeb.gs` (rota `acao=analisarIA`) e `AnaliseMetadadosIA.gs` no projeto Apps Script vinculado à planilha mestre.
- Dados enviados ao backend: texto extraído do PDF (até **12.000 caracteres**), pistas locais em JSON e, quando aplicável, a prévia JPEG (tamanho limitado). **O PDF completo não é enviado para a IA.**
- Os campos de contato informados no formulário **não** são enviados à análise. O JavaScript mascara padrões comuns de e-mail e CPF encontrados no texto; nomes que estejam no próprio documento podem continuar presentes.
- O backend exige autenticação institucional e-Nova, usa a OpenAI Responses API, `store:false` e esquema JSON estruturado. A chave fica somente nas propriedades privadas do Apps Script.
- Limites e prevenção de abuso permanecem no backend. O complemento por IA é agora iniciado sempre que a busca tiver texto ou imagem suficientes, **sem limiar de quantidade de campos encontrados**.

## Instalação da atualização

**O GitHub Pages foi atualizado, mas o projeto Apps Script não recebe alterações do GitHub automaticamente.** A chave da API já configurada permanece válida; **não** precisa recriá-la nem compartilhá-la.

1. Na conta institucional e-Nova, abra a **Planilha Mestre → Extensões → Apps Script**.
2. Atualize **somente o conteúdo de `AnaliseMetadadosIA.gs`** com a última versão do arquivo disponível neste repositório. Preserve `SubmissaoWeb.gs`, `Code.gs`, `ConsultaWeb.gs` e os demais scripts que já funcionam.
3. Salve e confirme que `verificarConfiguracaoIA` reconhece a propriedade privada `CETEP_OPENAI_API_KEY`. O modelo padrão `gpt-6-luna` continua em uso, salvo configuração deliberada na propriedade `CETEP_OPENAI_MODEL`.
4. Clique em **Implantar → Gerenciar implantações → Editar → Nova versão** para atualizar o aplicativo web **existente**, mantendo sua URL `/exec`, o domínio e-Nova e as permissões atuais.
5. Teste com um **banner de PDF textual** e depois com um banner **de uma página composto por imagem**. Confira que título/autores são apresentados para revisão e que os campos do responsável continuam vazios.
6. Se uma análise retornar erro, examine **Execuções** no Apps Script. O formulário continua permitindo preenchimento manual.

**Não reinstale gatilhos da curadoria, não apague arquivos do Apps Script e não altere as fórmulas das planilhas.**

## Privacidade e operação

- O aviso do formulário informa que trechos e eventualmente a prévia da primeira página poderão ser analisados por IA. Como os documentos podem conter nomes de estudantes, inclusive menores, é necessário que a instituição tenha uma base legal adequada e observe LGPD e políticas da rede.
- `store:false` impede o armazenamento de respostas para reutilização na API conforme a configuração, mas não elimina todas as obrigações de proteção de dados.
- O projeto Apps Script aplica limites de tamanho, autenticação e intervalo mínimo contra requisições repetidas.
- O consumo da API é registrado em logs administrativos; não há exposição de chaves, custos ou detalhes técnicos ao usuário final.
- Para suspender as chamadas de IA sem suspender a submissão, altere `iaMetadadosAtiva` para `false` em `assets/config.js`.
