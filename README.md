# Repositório Pedagógico e Científico — CETEP-RM

Portal responsivo em **HTML, CSS e JavaScript**, preparado para GitHub Pages.

## Páginas
- `index.html`: apresentação.
- `consultar.html`: acesso ao acervo autenticado e-Nova.
- `submeter.html`: formulário de submissão.
- `sobre.html`: informações institucionais.
- `assets/style.css`: design responsivo.
- `assets/app.js`: navegação e links.
- `assets/config.js`: URLs dos serviços existentes.

## Publicar
Em **Settings > Pages > Build and deployment**, escolha **Deploy from a branch**, branch `main`, pasta `/(root)` e salve. Aguarde o indicador de publicação. Endereço previsto: `https://reinereng.github.io/repositorio-cetep-rm/`.

## Segurança
O portal GitHub Pages é **público**. Não publicar PDFs restritos, dados pessoais de estudantes, Planilha Mestre ou credenciais no repositório.
Os documentos seguem no Google Drive / Planilhas / Apps Script, com controle de acesso e-Nova. O botão de consulta abre o acervo institucional.

## Consulta integrada
Caso exista a URL `/exec` do Apps Script de consulta autenticada, pode-se configurá-la em `assets/config.js` no campo `consultaWebExec`, depois de verificar o modelo de autenticação. Não exponha uma API que execute como proprietário e forneça registros protegidos sem validar a identidade.

## Logo original
O projeto utiliza uma identificação textual no cabeçalho. Para adicionar a logo oficial **sem alterar nenhum traço**, envie o PNG original para `assets/logo-cetep-rm-original.png` e acrescente uma tag `<img>` no elemento `.brand` em cada página, usando a classe `brand__logo`. Não usar logos redesenhadas por IA.

## Próximas etapas
Avaliar responsividade, vincular pesquisa diretamente ao serviço autenticado e posteriormente considerar extração de metadados de PDF mediante revisão e aprovação humana, sem expor chaves de IA no frontend.
