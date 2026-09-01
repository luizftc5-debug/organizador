/* ===========================================================================
   Store — fonte única de dados do dashboard.

   Tudo que você cadastra pelas telas fica salvo no localStorage do navegador,
   sem precisar editar código nem usar git. O arquivo data.js serve apenas como
   conteúdo inicial (seed) na primeira vez que o dashboard é aberto.

   Backup: use "Exportar backup" (gera um .json com TUDO) e "Importar backup"
   para restaurar ou levar os dados para outro computador/navegador.
   =========================================================================== */

const Store = (() => {
  const KEY = "organizador.estado.v2";
  const KEY_LEGADO_TRANSACOES = "organizador.financeiro.transacoes.v1";

  const CATEGORIAS_PADRAO = [
    "Moradia",
    "Alimentação",
    "Transporte",
    "Saúde",
    "Educação",
    "Lazer",
    "Assinaturas",
    "Renda",
    "Outros",
  ];

  let estado = null;
  const ouvintes = [];

  function uid(prefixo = "i") {
    return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function estadoVazio() {
    return {
      versao: 2,
      atualizadoEm: new Date().toISOString(),
      financeiro: { saldoAtual: 0, moeda: "BRL", categorias: [...CATEGORIAS_PADRAO], transacoes: [], metas: [] },
      faculdade: { disciplinas: [], prazos: [] },
      projetos: [],
      oportunidades: [],
    };
  }

  /* --------- Conversão do data.js (seed) para o formato do store ---------- */

  function apartirDoSeed() {
    const base = estadoVazio();
    if (typeof DATA === "undefined") return base;

    const fin = DATA.financeiro || {};
    base.financeiro.saldoAtual = Number(fin.saldoAtual) || 0;
    base.financeiro.moeda = fin.moeda || "BRL";
    if (Array.isArray(fin.categorias) && fin.categorias.length) {
      base.financeiro.categorias = [...fin.categorias];
    }

    (fin.receitasMes || []).forEach((r) =>
      base.financeiro.transacoes.push({
        id: uid("t"), data: r.data, tipo: "receita", categoria: r.categoria || "Renda",
        descricao: r.descricao || "", forma: "", status: "pago", valor: Number(r.valor) || 0,
      })
    );
    (fin.despesasMes || []).forEach((d) =>
      base.financeiro.transacoes.push({
        id: uid("t"), data: d.data, tipo: "despesa", categoria: d.categoria || "Outros",
        descricao: d.descricao || "", forma: "", status: "pago", valor: Number(d.valor) || 0,
      })
    );
    (fin.metas || []).forEach((m) =>
      base.financeiro.metas.push({
        id: uid("m"), descricao: m.descricao || "", valorAlvo: Number(m.valorAlvo) || 0,
        valorAtual: Number(m.valorAtual) || 0, prazo: m.prazo || "",
      })
    );

    const fac = DATA.faculdade || {};
    (fac.disciplinas || []).forEach((d) =>
      base.faculdade.disciplinas.push({
        id: uid("d"), nome: d.nome || "", status: d.status || "ativa", professor: d.professor || "",
        nota: d.nota ?? null, proximaAvaliacao: d.proximaAvaliacao || "",
      })
    );
    (fac.prazos || []).forEach((p) =>
      base.faculdade.prazos.push({
        id: uid("p"), descricao: p.descricao || "", data: p.data || "",
        tipo: p.tipo || "entrega", concluido: !!p.concluido,
      })
    );

    (DATA.projetos || []).forEach((p) =>
      base.projetos.push({
        id: uid("pj"), nome: p.nome || "", status: p.status || "em andamento",
        descricao: p.descricao || "", deadline: p.deadline || "",
        passos: (p.passos || (p.proximoPasso ? [{ texto: p.proximoPasso }] : [])).map((s) => ({
          id: uid("s"), texto: typeof s === "string" ? s : s.texto || "", feito: typeof s === "object" && !!s.feito,
        })),
      })
    );

    (DATA.oportunidades || []).forEach((o) =>
      base.oportunidades.push({
        id: uid("o"), descricao: o.descricao || "", area: o.area || "",
        potencial: o.potencial || "", esforco: o.esforco || "", anotacoes: o.anotacoes || "",
      })
    );

    return base;
  }

  /* ----- Migração dos lançamentos salvos pela versão anterior do app ------ */

  function migrarLegado(base) {
    try {
      const bruto = localStorage.getItem(KEY_LEGADO_TRANSACOES);
      if (!bruto) return base;
      const antigos = JSON.parse(bruto);
      if (!Array.isArray(antigos) || antigos.length === 0) return base;

      // Substitui o seed: dados digitados pelo usuário valem mais que o exemplo.
      base.financeiro.transacoes = antigos.map((t) => ({
        id: t.id || uid("t"), data: t.data || "", tipo: t.tipo === "receita" ? "receita" : "despesa",
        categoria: t.categoria || "Outros", descricao: t.descricao || "", forma: t.forma || "",
        status: t.status === "pendente" ? "pendente" : "pago", valor: Number(t.valor) || 0,
      }));
      localStorage.removeItem(KEY_LEGADO_TRANSACOES);
    } catch (e) {
      console.warn("Não foi possível migrar os lançamentos antigos.", e);
    }
    return base;
  }

  /* ------------------------------ Carga ---------------------------------- */

  function carregar() {
    if (estado) return estado;
    try {
      const bruto = localStorage.getItem(KEY);
      if (bruto) {
        estado = normalizar(JSON.parse(bruto));
        return estado;
      }
    } catch (e) {
      console.warn("Estado salvo ilegível; recomeçando a partir do seed.", e);
    }
    estado = migrarLegado(apartirDoSeed());
    persistir();
    return estado;
  }

  // Garante que estados salvos por versões anteriores tenham todos os campos.
  function normalizar(e) {
    const base = estadoVazio();
    const out = { ...base, ...e };
    out.financeiro = { ...base.financeiro, ...(e.financeiro || {}) };
    out.faculdade = { ...base.faculdade, ...(e.faculdade || {}) };
    out.financeiro.transacoes = e.financeiro?.transacoes || [];
    out.financeiro.metas = e.financeiro?.metas || [];
    out.financeiro.categorias = e.financeiro?.categorias?.length ? e.financeiro.categorias : [...CATEGORIAS_PADRAO];
    out.faculdade.disciplinas = e.faculdade?.disciplinas || [];
    out.faculdade.prazos = e.faculdade?.prazos || [];
    out.projetos = Array.isArray(e.projetos) ? e.projetos : [];
    out.oportunidades = Array.isArray(e.oportunidades) ? e.oportunidades : [];
    return out;
  }

  function persistir() {
    estado.atualizadoEm = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(estado));
    } catch (e) {
      console.error("Falha ao salvar no navegador.", e);
      alert("Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado (modo anônimo).");
      return;
    }
    ouvintes.forEach((fn) => fn(estado));
  }

  /* ------------------------- Acesso às coleções --------------------------- */

  // Caminhos aceitos: "financeiro.transacoes", "financeiro.metas",
  // "faculdade.disciplinas", "faculdade.prazos", "projetos", "oportunidades".
  function colecao(caminho) {
    const e = carregar();
    const partes = caminho.split(".");
    let alvo = e;
    for (const p of partes) alvo = alvo[p];
    if (!Array.isArray(alvo)) throw new Error(`Coleção inválida: ${caminho}`);
    return alvo;
  }

  return {
    uid,
    CATEGORIAS_PADRAO,

    estado: () => carregar(),
    aoMudar(fn) { ouvintes.push(fn); },

    lista(caminho) { return colecao(caminho); },

    inserir(caminho, item) {
      const novo = { id: uid(), ...item };
      colecao(caminho).push(novo);
      persistir();
      return novo;
    },

    atualizar(caminho, id, patch) {
      const item = colecao(caminho).find((x) => x.id === id);
      if (!item) return null;
      Object.assign(item, patch);
      persistir();
      return item;
    },

    remover(caminho, id) {
      const arr = colecao(caminho);
      const i = arr.findIndex((x) => x.id === id);
      if (i < 0) return null;
      const [removido] = arr.splice(i, 1);
      persistir();
      return removido;
    },

    // Reinsere um item removido na posição original (usado pelo "desfazer").
    restaurar(caminho, item, indice) {
      const arr = colecao(caminho);
      arr.splice(Math.min(indice ?? arr.length, arr.length), 0, item);
      persistir();
    },

    indiceDe(caminho, id) { return colecao(caminho).findIndex((x) => x.id === id); },

    definirSaldo(valor) {
      carregar().financeiro.saldoAtual = Number(valor) || 0;
      persistir();
    },

    /* ------------------------- Backup completo -------------------------- */

    exportar() {
      return JSON.stringify(carregar(), null, 2);
    },

    importar(texto) {
      const dados = JSON.parse(texto);
      if (!dados || typeof dados !== "object") throw new Error("Arquivo inválido.");
      if (!dados.financeiro && !dados.faculdade && !dados.projetos) {
        throw new Error("Este arquivo não parece ser um backup do Organizador.");
      }
      estado = normalizar(dados);
      persistir();
      return estado;
    },

    limpar() {
      estado = estadoVazio();
      persistir();
      return estado;
    },
  };
})();
