/* CETEP-RM — catálogo controlado para evitar cursos duplicados por grafia. */
(() => {
  "use strict";
  const cursos = Object.freeze([
    "Biocombustíveis",
    "Eletrotécnica",
    "Mecatrônica",
    "Meio Ambiente",
    "Química",
    "Refrigeração",
    "Segurança do Trabalho",
    "Sistemas de Energia Renovável"
  ]);
  const eventos = Object.freeze(["FECITESC", "AFROTEP", "SEMATEP"]);
  const norm = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\s+/g, " ").trim();
  const alias = {
    "biocombustivel": "Biocombustíveis",
    "biocombustiveis": "Biocombustíveis",
    "eletrotecnica": "Eletrotécnica",
    "mecatronica": "Mecatrônica",
    "meio ambiente": "Meio Ambiente",
    "quimica": "Química",
    "refrigeracao": "Refrigeração",
    "refrigeracao e climatizacao": "Refrigeração",
    "seguranca do trabalho": "Segurança do Trabalho",
    "sistemas renovaveis": "Sistemas de Energia Renovável",
    "sistemas de energias renovaveis": "Sistemas de Energia Renovável",
    "sistemas de energia renovavel": "Sistemas de Energia Renovável"
  };
  const normalizarCurso = raw => alias[norm(raw)] || "";
  const normalizarEvento = raw => {
    const v = norm(raw);
    if (!v || v === "nao se aplica" || v === "nenhum" || v === "sem evento") return "";
    const aliases = { "fecitec": "FECITESC", "afrotec": "AFROTEP", "sematec": "SEMATEP" };
    const selected = eventos.find(e => norm(e) === v);
    return aliases[v] || selected || String(raw || "").trim().slice(0,160);
  };
  window.CETEP_DICIONARIOS = Object.freeze({cursos,eventos,normalizarCurso,normalizarEvento});
})();