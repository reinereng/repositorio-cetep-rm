(() => {
  "use strict";
  const cfg = window.CETEP_CONFIG || {};
  const button = document.querySelector("[data-menu-button]");
  const menu = document.querySelector("[data-nav]");
  if (button && menu) {
    button.addEventListener("click", () => {
      const open = menu.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Fechar" : "Menu";
    });
    menu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      menu.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      button.textContent = "Menu";
    }));
  }
  document.querySelectorAll("[data-form-url]").forEach(a => { a.href = cfg.formulario; });
  document.querySelectorAll("[data-catalog-url]").forEach(a => { a.href = cfg.consultaWebExec || cfg.catalogoInstitucional; });
  const status = document.querySelector("[data-consulta-status]");
  if (status) status.textContent = cfg.consultaWebExec ?
    "A pesquisa abre a aplicação institucional, com acesso controlado pelo e-Nova." :
    "A pesquisa abre o catálogo institucional. Entre com sua conta e-Nova para visualizar os documentos.";
  // Se o arquivo da logo original ainda não foi carregado, o título textual permanece legível.
  document.querySelectorAll(".brand__logo").forEach(img => img.addEventListener("error", () => img.hidden = true));
})();
