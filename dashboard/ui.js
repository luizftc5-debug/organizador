/* ===========================================================================
   UI — componentes compartilhados: layout, formulários em modal, avisos,
   estados vazios e gráficos. Sem dependências externas.
   =========================================================================== */

const UI = (() => {
  /* ------------------------------ Formatos ------------------------------- */

  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  const fmt = {
    moeda(v) {
      return (Number(v) || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: Store.estado().financeiro.moeda || "BRL",
        maximumFractionDigits: 2,
      });
    },
    moedaCurta(v) {
      const n = Number(v) || 0;
      const abs = Math.abs(n);
      if (abs >= 1000000) return `${n < 0 ? "-" : ""}R$ ${(abs / 1000000).toFixed(1).replace(".", ",")}M`;
      if (abs >= 10000) return `${n < 0 ? "-" : ""}R$ ${(abs / 1000).toFixed(1).replace(".", ",")}k`;
      return fmt.moeda(n);
    },
    data(iso) {
      if (!iso) return "—";
      const [a, m, d] = iso.split("-");
      return `${d}/${m}/${a}`;
    },
    dataCurta(iso) {
      if (!iso) return "—";
      const [a, m, d] = iso.split("-");
      return `${d} ${MESES[Number(m) - 1]}`;
    },
    mesRotulo(chave) {
      if (!chave) return "—";
      const [a, m] = chave.split("-");
      return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
    },
    escape(s) {
      return String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
      );
    },
  };

  /* -------------------------------- Datas -------------------------------- */

  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function mesAtual() { return hojeISO().slice(0, 7); }

  function mesAnterior(chave) {
    const [a, m] = chave.split("-").map(Number);
    const d = new Date(a, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function diasAte(iso) {
    if (!iso) return null;
    const alvo = new Date(iso + "T00:00:00");
    const hoje = new Date(hojeISO() + "T00:00:00");
    return Math.round((alvo - hoje) / 86400000);
  }

  // Nível de urgência sempre acompanhado de rótulo textual — a cor nunca
  // carrega o significado sozinha.
  function urgencia(iso) {
    const d = diasAte(iso);
    if (d === null) return { nivel: "futuro", rotulo: "sem data", dias: null };
    if (d < 0) return { nivel: "atrasado", rotulo: `atrasado ${Math.abs(d)}d`, dias: d };
    if (d === 0) return { nivel: "hoje", rotulo: "hoje", dias: 0 };
    if (d === 1) return { nivel: "urgente", rotulo: "amanhã", dias: 1 };
    if (d <= 7) return { nivel: "urgente", rotulo: `em ${d} dias`, dias: d };
    if (d <= 30) return { nivel: "proximo", rotulo: `em ${d} dias`, dias: d };
    if (d <= 90) return { nivel: "futuro", rotulo: `em ${d} dias`, dias: d };
    return { nivel: "futuro", rotulo: `em ${Math.round(d / 30)} meses`, dias: d };
  }

  // Chave ISO da semana (segunda a domingo) — base da detecção de conflitos.
  function chaveSemana(iso) {
    const d = new Date(iso + "T00:00:00");
    const dia = (d.getDay() + 6) % 7; // segunda = 0
    d.setDate(d.getDate() - dia);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /* -------------------- Compromissos unificados (3 pilares) --------------- */

  function compromissos({ incluirConcluidos = false } = {}) {
    const e = Store.estado();
    const itens = [];

    e.faculdade.prazos.forEach((p) => {
      if (!p.data || (!incluirConcluidos && p.concluido)) return;
      itens.push({ id: p.id, titulo: p.descricao, data: p.data, area: "faculdade", tipo: p.tipo || "entrega", concluido: !!p.concluido });
    });

    e.faculdade.disciplinas.forEach((d) => {
      if (!d.proximaAvaliacao) return;
      itens.push({ id: d.id, titulo: `Prova — ${d.nome}`, data: d.proximaAvaliacao, area: "faculdade", tipo: "prova", concluido: false });
    });

    e.projetos.forEach((p) => {
      if (!p.deadline || (!incluirConcluidos && p.status === "concluído")) return;
      itens.push({ id: p.id, titulo: p.nome, data: p.deadline, area: "projetos", tipo: "projeto", concluido: p.status === "concluído" });
    });

    e.financeiro.metas.forEach((m) => {
      if (!m.prazo) return;
      const pronta = m.valorAlvo > 0 && m.valorAtual >= m.valorAlvo;
      if (pronta && !incluirConcluidos) return;
      itens.push({ id: m.id, titulo: `Meta — ${m.descricao}`, data: m.prazo, area: "financeiro", tipo: "meta", concluido: pronta });
    });

    return itens.sort((a, b) => a.data.localeCompare(b.data));
  }

  // Semanas com mais de um compromisso — o alerta é mais forte quando os
  // compromissos vêm de pilares diferentes.
  function conflitos() {
    const porSemana = {};
    compromissos()
      .filter((i) => (diasAte(i.data) ?? -1) >= 0)
      .forEach((i) => {
        const k = chaveSemana(i.data);
        (porSemana[k] = porSemana[k] || []).push(i);
      });

    return Object.entries(porSemana)
      .filter(([, itens]) => itens.length > 1)
      .map(([semana, itens]) => ({
        semana,
        itens,
        areas: [...new Set(itens.map((i) => i.area))],
        multiplasAreas: new Set(itens.map((i) => i.area)).size > 1,
      }))
      .sort((a, b) => a.semana.localeCompare(b.semana));
  }

  /* -------------------------------- Layout -------------------------------- */

  const PAGINAS = [
    { id: "home", rotulo: "Visão geral", href: "index.html", cor: "" },
    { id: "financeiro", rotulo: "Financeiro", href: "financeiro.html", cor: "financeiro" },
    { id: "faculdade", rotulo: "Faculdade", href: "faculdade.html", cor: "faculdade" },
    { id: "projetos", rotulo: "Projetos", href: "projetos.html", cor: "projetos" },
  ];

  function contagens() {
    const e = Store.estado();
    const urgentes = compromissos().filter((i) => {
      const d = diasAte(i.data);
      return d !== null && d <= 7;
    });
    return {
      home: urgentes.length,
      financeiro: e.financeiro.transacoes.filter((t) => t.status === "pendente").length,
      faculdade: urgentes.filter((i) => i.area === "faculdade").length,
      projetos: urgentes.filter((i) => i.area === "projetos").length,
    };
  }

  function montarLayout(ativo) {
    const el = document.getElementById("sidebar");
    if (!el) return;
    const c = contagens();
    el.innerHTML = `
      <div class="brand">
        <div class="brand-mark">O</div>
        <div class="brand-text">
          <div class="brand-name">Organizador</div>
          <div class="brand-sub">Luiz · Medicina</div>
        </div>
      </div>
      ${PAGINAS.map((p) => `
        <a class="nav-item ${p.id === ativo ? "active" : ""}" href="${p.href}">
          <span class="nav-swatch ${p.cor}"></span>
          <span>${p.rotulo}</span>
          ${c[p.id] ? `<span class="nav-count ${p.id === "home" && c.home ? "alert" : ""}">${c[p.id]}</span>` : ""}
        </a>`).join("")}
      <div class="sidebar-foot">
        <button class="btn ghost sm" id="btn-tema" style="width:100%; justify-content:flex-start;">
          <span id="tema-icone">◐</span> <span id="tema-texto">Tema</span>
        </button>
        <button class="btn ghost sm" id="btn-backup" style="width:100%; justify-content:flex-start;">
          ⤓ Backup
        </button>
      </div>`;

    document.getElementById("btn-tema").addEventListener("click", tema.alternar);
    document.getElementById("btn-backup").addEventListener("click", abrirBackup);
    tema.aplicarRotulo();
  }

  /* --------------------------------- Tema --------------------------------- */

  const tema = {
    KEY: "organizador.tema",
    atual() {
      try { return localStorage.getItem(tema.KEY) || "auto"; } catch { return "auto"; }
    },
    definir(v) {
      try { localStorage.setItem(tema.KEY, v); } catch { /* modo anônimo */ }
      if (v === "auto") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", v);
      tema.aplicarRotulo();
    },
    alternar() {
      const ordem = ["auto", "light", "dark"];
      const prox = ordem[(ordem.indexOf(tema.atual()) + 1) % ordem.length];
      tema.definir(prox);
      toast(`Tema: ${{ auto: "automático", light: "claro", dark: "escuro" }[prox]}`);
    },
    aplicarRotulo() {
      const t = document.getElementById("tema-texto");
      const i = document.getElementById("tema-icone");
      if (!t || !i) return;
      const mapa = { auto: ["◐", "Tema automático"], light: ["☀", "Tema claro"], dark: ["☾", "Tema escuro"] };
      const [icone, texto] = mapa[tema.atual()];
      i.textContent = icone;
      t.textContent = texto;
    },
    iniciar() {
      const v = tema.atual();
      if (v !== "auto") document.documentElement.setAttribute("data-theme", v);
    },
  };

  /* -------------------------------- Toast --------------------------------- */

  function toast(mensagem, { acaoRotulo, aoAcionar, duracao = 3200 } = {}) {
    let caixa = document.querySelector(".toasts");
    if (!caixa) {
      caixa = document.createElement("div");
      caixa.className = "toasts";
      document.body.appendChild(caixa);
    }
    // No máximo dois avisos ao mesmo tempo — uma pilha maior cobre a tela.
    while (caixa.children.length >= 2) caixa.firstElementChild.remove();

    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<span>${fmt.escape(mensagem)}</span>`;
    if (acaoRotulo) {
      const b = document.createElement("button");
      b.textContent = acaoRotulo;
      b.addEventListener("click", () => { aoAcionar?.(); el.remove(); });
      el.appendChild(b);
    }
    caixa.appendChild(el);
    setTimeout(() => el.remove(), duracao);
  }

  /* ------------------------- Modal / formulários --------------------------- */

  function abrirModal(conteudoHTML, { aoMontar, aoFechar } = {}) {
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${conteudoHTML}</div>`;
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";

    const fechar = (resultado) => {
      document.body.style.overflow = "";
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      aoFechar?.(resultado);
    };
    const onKey = (e) => { if (e.key === "Escape") fechar(null); };

    backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) fechar(null); });
    document.addEventListener("keydown", onKey);
    aoMontar?.(backdrop.querySelector(".modal"), fechar);
    return fechar;
  }

  /**
   * Formulário em modal.
   * campos: [{ nome, rotulo, tipo, opcoes, obrigatorio, dica, valorPadrao }]
   * tipos: text | textarea | number | dinheiro | date | select | segmento
   * Resolve com um objeto de valores, ou null se cancelado.
   */
  function formulario({ titulo, descricao, campos, valores = {}, rotuloConfirmar = "Salvar" }) {
    return new Promise((resolve) => {
      const html = `
        <div class="modal-head">
          <h2 class="modal-title">${fmt.escape(titulo)}</h2>
          ${descricao ? `<p class="modal-desc">${fmt.escape(descricao)}</p>` : ""}
        </div>
        <form class="modal-body" novalidate>
          ${campos.map((c) => campoHTML(c, valores[c.nome] ?? c.valorPadrao ?? "")).join("")}
        </form>
        <div class="modal-foot">
          <button class="btn" data-acao="cancelar" type="button">Cancelar</button>
          <button class="btn primary" data-acao="confirmar" type="button">${fmt.escape(rotuloConfirmar)}</button>
        </div>`;

      abrirModal(html, {
        aoMontar(modal, fechar) {
          const form = modal.querySelector("form");

          // Botões de segmento (escolha única em linha)
          modal.querySelectorAll(".seg").forEach((seg) => {
            seg.addEventListener("click", (e) => {
              const b = e.target.closest("button");
              if (!b) return;
              seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
              seg.querySelector("input").value = b.dataset.valor;
            });
          });

          const primeiro = form.querySelector("input, select, textarea");
          primeiro?.focus();
          if (primeiro?.select) setTimeout(() => primeiro.select(), 0);

          const confirmar = () => {
            const saida = {};
            let erro = false;
            modal.querySelectorAll(".field .err").forEach((n) => n.remove());

            campos.forEach((c) => {
              const input = form.querySelector(`[name="${c.nome}"]`);
              let v = input.value;
              if (c.tipo === "number" || c.tipo === "dinheiro") {
                v = v === "" ? null : Number(String(v).replace(",", "."));
                if (v !== null && Number.isNaN(v)) v = null;
              } else {
                v = String(v).trim();
              }
              const vazio = v === "" || v === null;
              if (c.obrigatorio && vazio) {
                erro = true;
                const campo = input.closest(".field");
                const span = document.createElement("span");
                span.className = "err";
                span.textContent = "Preencha este campo.";
                campo.appendChild(span);
              }
              saida[c.nome] = v;
            });

            if (erro) return;
            fechar(saida);
          };

          modal.querySelector('[data-acao="confirmar"]').addEventListener("click", confirmar);
          modal.querySelector('[data-acao="cancelar"]').addEventListener("click", () => fechar(null));
          form.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); confirmar(); }
          });
        },
        aoFechar: resolve,
      });
    });
  }

  function campoHTML(c, valor) {
    const v = fmt.escape(valor);
    let controle;

    switch (c.tipo) {
      case "textarea":
        controle = `<textarea name="${c.nome}" placeholder="${fmt.escape(c.placeholder || "")}">${v}</textarea>`;
        break;
      case "select":
        controle = `<select name="${c.nome}">${c.opcoes
          .map((o) => {
            const val = typeof o === "string" ? o : o.valor;
            const rot = typeof o === "string" ? o : o.rotulo;
            return `<option value="${fmt.escape(val)}" ${String(val) === String(valor) ? "selected" : ""}>${fmt.escape(rot)}</option>`;
          })
          .join("")}</select>`;
        break;
      case "segmento": {
        const atual = valor || c.opcoes[0].valor;
        controle = `<div class="seg">
            <input type="hidden" name="${c.nome}" value="${fmt.escape(atual)}" />
            ${c.opcoes.map((o) => `<button type="button" data-valor="${fmt.escape(o.valor)}" aria-pressed="${String(o.valor) === String(atual)}">${fmt.escape(o.rotulo)}</button>`).join("")}
          </div>`;
        break;
      }
      case "date":
        controle = `<input type="date" name="${c.nome}" value="${v}" />`;
        break;
      case "number":
      case "dinheiro":
        controle = `<input type="number" step="${c.tipo === "dinheiro" ? "0.01" : c.step || "1"}" name="${c.nome}" value="${v}" placeholder="${fmt.escape(c.placeholder || "")}" />`;
        break;
      default:
        controle = `<input type="text" name="${c.nome}" value="${v}" placeholder="${fmt.escape(c.placeholder || "")}" />`;
    }

    return `<div class="field">
        <label for="${c.nome}">${fmt.escape(c.rotulo)}${c.obrigatorio ? "" : ' <span class="muted">(opcional)</span>'}</label>
        ${controle}
        ${c.dica ? `<span class="hint">${fmt.escape(c.dica)}</span>` : ""}
      </div>`;
  }

  function confirmar({ titulo, descricao, rotuloConfirmar = "Confirmar", perigo = false }) {
    return new Promise((resolve) => {
      const html = `
        <div class="modal-head">
          <h2 class="modal-title">${fmt.escape(titulo)}</h2>
          ${descricao ? `<p class="modal-desc">${fmt.escape(descricao)}</p>` : ""}
        </div>
        <div class="modal-body"></div>
        <div class="modal-foot">
          <button class="btn" data-acao="nao" type="button">Cancelar</button>
          <button class="btn ${perigo ? "danger" : "primary"}" data-acao="sim" type="button">${fmt.escape(rotuloConfirmar)}</button>
        </div>`;
      abrirModal(html, {
        aoMontar(modal, fechar) {
          modal.querySelector('[data-acao="sim"]').addEventListener("click", () => fechar(true));
          modal.querySelector('[data-acao="nao"]').addEventListener("click", () => fechar(false));
          modal.querySelector('[data-acao="sim"]').focus();
        },
        aoFechar: (r) => resolve(!!r),
      });
    });
  }

  /* ------------------------------- Backup ---------------------------------- */

  function abrirBackup() {
    const e = Store.estado();
    const total =
      e.financeiro.transacoes.length + e.financeiro.metas.length + e.faculdade.disciplinas.length +
      e.faculdade.prazos.length + e.projetos.length + e.oportunidades.length;

    const html = `
      <div class="modal-head">
        <h2 class="modal-title">Backup dos seus dados</h2>
        <p class="modal-desc">Seus dados ficam salvos neste navegador. Exporte um arquivo para não perdê-los ao trocar de computador ou limpar o cache.</p>
      </div>
      <div class="modal-body">
        <div class="notice info"><span class="ic">i</span><span>Você tem <strong>${total}</strong> ${total === 1 ? "registro salvo" : "registros salvos"} neste navegador.</span></div>
        <button class="btn primary" data-acao="exportar" type="button" style="justify-content:center;">⤓ Exportar backup (.json)</button>
        <button class="btn" data-acao="importar" type="button" style="justify-content:center;">⤒ Importar backup</button>
        <input type="file" accept="application/json" class="hidden" data-arquivo />
        <button class="btn danger" data-acao="limpar" type="button" style="justify-content:center;">Apagar todos os dados</button>
      </div>
      <div class="modal-foot"><button class="btn" data-acao="fechar" type="button">Fechar</button></div>`;

    abrirModal(html, {
      aoMontar(modal, fechar) {
        const arquivo = modal.querySelector("[data-arquivo]");

        modal.querySelector('[data-acao="exportar"]').addEventListener("click", () => {
          const blob = new Blob([Store.exportar()], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `organizador-backup-${hojeISO()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast("Backup exportado.");
        });

        modal.querySelector('[data-acao="importar"]').addEventListener("click", () => arquivo.click());

        arquivo.addEventListener("change", (ev) => {
          const f = ev.target.files[0];
          if (!f) return;
          const leitor = new FileReader();
          leitor.onload = () => {
            try {
              Store.importar(leitor.result);
              fechar();
              toast("Backup importado. Recarregando…");
              setTimeout(() => location.reload(), 600);
            } catch (err) {
              toast(`Não foi possível importar: ${err.message}`);
            }
          };
          leitor.readAsText(f);
        });

        modal.querySelector('[data-acao="limpar"]').addEventListener("click", async () => {
          const ok = await confirmar({
            titulo: "Apagar todos os dados?",
            descricao: "Isso remove tudo que você cadastrou neste navegador. Exporte um backup antes se quiser poder voltar atrás.",
            rotuloConfirmar: "Apagar tudo",
            perigo: true,
          });
          if (!ok) return;
          Store.limpar();
          fechar();
          location.reload();
        });

        modal.querySelector('[data-acao="fechar"]').addEventListener("click", () => fechar(null));
      },
    });
  }

  /* ---------------------------- Estado vazio ------------------------------- */

  function vazio({ icone = "＋", titulo, texto, rotuloAcao, aoAcionar }) {
    const el = document.createElement("div");
    el.className = "empty";
    el.innerHTML = `
      <div class="empty-icon">${icone}</div>
      <div class="empty-title">${fmt.escape(titulo)}</div>
      ${texto ? `<div class="empty-text">${fmt.escape(texto)}</div>` : ""}
      ${rotuloAcao ? `<button class="btn primary" type="button">${fmt.escape(rotuloAcao)}</button>` : ""}`;
    if (rotuloAcao) el.querySelector("button").addEventListener("click", aoAcionar);
    return el;
  }

  /* ------------------------------ Gráficos --------------------------------- */

  /**
   * Barras horizontais — magnitude de uma única série.
   * Cada barra leva o valor escrito ao lado (rótulo direto), então a cor nunca
   * é o único canal de leitura.
   */
  function barras(el, { linhas, cor = "var(--s-financeiro)", formatar = fmt.moeda }) {
    el.innerHTML = "";
    if (!linhas.length) return;
    const max = Math.max(...linhas.map((l) => l.valor), 0) || 1;
    linhas.forEach((l) => {
      const pct = Math.max((l.valor / max) * 100, 1);
      const row = document.createElement("div");
      row.className = "chart-row";
      row.innerHTML = `
        <div class="chart-name" title="${fmt.escape(l.nome)}">${fmt.escape(l.nome)}</div>
        <div class="chart-track"><div class="chart-bar" style="width:${pct}%; background:${cor};"></div></div>
        <div class="chart-value">${formatar(l.valor)}</div>`;
      el.appendChild(row);
    });
  }

  /**
   * Colunas agrupadas por mês — duas séries (receitas e despesas).
   * Duas séries ⇒ legenda obrigatória; barras finas com topo arredondado e
   * 2px de respiro entre as colunas do mesmo mês.
   */
  function colunasMensais(el, { meses, alturaPlot = 132 }) {
    el.innerHTML = "";
    if (!meses.length) return;
    const max = Math.max(...meses.flatMap((m) => [m.receita, m.despesa]), 0) || 1;

    // Alturas em pixels: percentual não resolve de forma confiável dentro de
    // um contêiner flex sem altura explícita.
    const altura = (v) => (v > 0 ? Math.max(Math.round((v / max) * alturaPlot), 3) : 0);

    const cols = document.createElement("div");
    cols.className = "cols";
    cols.style.height = `${alturaPlot + 22}px`;
    meses.forEach((m) => {
      const g = document.createElement("div");
      g.className = "col-group";
      g.innerHTML = `
        <div class="col-bars" style="height:${alturaPlot}px;">
          <div class="col-bar" style="height:${altura(m.receita)}px; background:var(--s-financeiro);"
               title="Receitas em ${fmt.mesRotulo(m.chave)}: ${fmt.moeda(m.receita)}"></div>
          <div class="col-bar" style="height:${altura(m.despesa)}px; background:var(--s-projetos);"
               title="Despesas em ${fmt.mesRotulo(m.chave)}: ${fmt.moeda(m.despesa)}"></div>
        </div>
        <div class="col-label">${fmt.mesRotulo(m.chave)}</div>`;
      cols.appendChild(g);
    });
    el.appendChild(cols);

    const leg = document.createElement("div");
    leg.className = "legend";
    leg.innerHTML = `
      <span class="legend-item"><span class="legend-key" style="background:var(--s-financeiro)"></span>Receitas</span>
      <span class="legend-item"><span class="legend-key" style="background:var(--s-projetos)"></span>Despesas</span>`;
    el.appendChild(leg);
  }

  /** Medidor de progresso (metas, projetos) — valor sempre escrito. */
  function medidor({ rotulo, atual, alvo, sufixo = "", formatar = fmt.moeda, cor = "var(--s-financeiro)" }) {
    const pct = alvo > 0 ? Math.min(100, (atual / alvo) * 100) : 0;
    const el = document.createElement("div");
    el.className = "meter";
    el.innerHTML = `
      <div class="meter-head">
        <span style="font-size:12.5px; font-weight:550;">${fmt.escape(rotulo)}</span>
        <span class="num" style="font-size:12.5px; color:var(--ink-2);">${formatar(atual)} / ${formatar(alvo)}${sufixo}</span>
      </div>
      <div class="meter-track"><div class="meter-fill" style="width:${pct}%; background:${cor};"></div></div>`;
    return el;
  }

  /* ------------------------------ Inicialização ---------------------------- */

  function iniciarPagina(ativo) {
    tema.iniciar();
    montarLayout(ativo);
  }

  return {
    fmt, hojeISO, mesAtual, mesAnterior, diasAte, urgencia, chaveSemana,
    compromissos, conflitos, contagens,
    iniciarPagina, montarLayout, tema, toast, formulario, confirmar, abrirModal,
    abrirBackup, vazio, barras, colunasMensais, medidor,
  };
})();

// Aplica o tema antes da primeira pintura, evitando "flash" de tela clara.
UI.tema.iniciar();
