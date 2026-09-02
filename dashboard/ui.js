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

    // Avaliações agendadas de cada disciplina. Uma avaliação com nota lançada
    // já aconteceu, então sai da agenda.
    e.faculdade.disciplinas.forEach((d) => {
      (d.avaliacoes || []).forEach((a) => {
        if (!a.data) return;
        const feita = a.nota !== null && a.nota !== undefined && a.nota !== "";
        if (feita && !incluirConcluidos) return;
        itens.push({
          id: a.id, titulo: `${a.nome || "Avaliação"} — ${d.nome}`, data: a.data,
          area: "faculdade", tipo: "prova", concluido: feita, disciplinaId: d.id,
        });
      });
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
    { id: "home", rotulo: "Visão geral", href: "index.html", cor: "", icone: "◆" },
    { id: "financeiro", rotulo: "Financeiro", href: "financeiro.html", cor: "financeiro", icone: "$" },
    { id: "faculdade", rotulo: "Faculdade", href: "faculdade.html", cor: "faculdade", icone: "▤" },
    { id: "projetos", rotulo: "Projetos", href: "projetos.html", cor: "projetos", icone: "◇" },
  ];

  // Páginas de detalhe se acendem no item de nível de cima a que pertencem.
  const GRUPO_DE = { contas: "financeiro", disciplina: "faculdade" };

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

  function iniciais(nome) {
    const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "•";
    return (partes[0][0] + (partes[1]?.[0] || "")).toUpperCase();
  }

  /** Foto do perfil quando existe; senão, as iniciais do nome. */
  function avatarHTML(perfil, classe = "brand-mark") {
    const p = perfil || {};
    return p.foto
      ? `<div class="${classe}"><img src="${fmt.escape(p.foto)}" alt="Foto de ${fmt.escape(p.nome || "perfil")}" /></div>`
      : `<div class="${classe}">${fmt.escape(iniciais(p.nome))}</div>`;
  }

  // Sub-itens aparecem só sob a seção aberta, para a barra não crescer sem fim.
  function subItens(grupo, ativo, idAtivo) {
    if (grupo === "financeiro") {
      return [{ rotulo: "Contas e cartões", href: "contas.html", ativo: ativo === "contas" }];
    }
    if (grupo === "faculdade") {
      return Store.lista("faculdade.disciplinas")
        .filter((d) => d.status !== "concluída")
        .slice(0, 8)
        .map((d) => ({
          rotulo: d.nome,
          href: `disciplina.html?id=${encodeURIComponent(d.id)}`,
          ativo: ativo === "disciplina" && idAtivo === d.id,
        }));
    }
    return [];
  }

  // Guardados para o layout poder ser remontado sozinho (ex.: depois de trocar
  // a foto do perfil) sem a página precisar repassar os mesmos argumentos.
  let paginaAtiva = "home";
  let opcoesAtivas = {};

  function montarLayout(ativo, opcoes = {}) {
    const { idAtivo = "" } = opcoes;
    paginaAtiva = ativo;
    opcoesAtivas = opcoes;
    const el = document.getElementById("sidebar");
    if (!el) return;
    const c = contagens();
    const perfil = Store.estado().perfil || {};
    const grupoAtivo = GRUPO_DE[ativo] || ativo;

    const itens = PAGINAS.map((p) => {
      const aberto = p.id === grupoAtivo;
      const subs = aberto ? subItens(p.id, ativo, idAtivo) : [];
      return `
        <a class="nav-item ${aberto ? "active" : ""}" href="${p.href}">
          <span class="nav-icon ${p.cor}">${p.icone}</span>
          <span class="nav-label">${p.rotulo}</span>
          ${c[p.id] ? `<span class="nav-count ${p.id === "home" ? "alert" : ""}">${c[p.id]}</span>` : ""}
        </a>
        ${subs.length ? `<div class="nav-sub">${subs
          .map((s) => `<a class="nav-subitem ${s.ativo ? "active" : ""}" href="${s.href}" title="${fmt.escape(s.rotulo)}">${fmt.escape(s.rotulo)}</a>`)
          .join("")}</div>` : ""}`;
    }).join("");

    const linhaCurso = [perfil.curso, perfil.semestre ? `${perfil.semestre}º sem` : ""]
      .filter(Boolean)
      .join(" · ");

    el.innerHTML = `
      <button class="brand" id="btn-perfil" type="button" title="Ver e editar seu perfil">
        ${avatarHTML(perfil)}
        <span class="brand-text">
          <span class="brand-name">${fmt.escape(perfil.nome || "Seu nome")}</span>
          <span class="brand-sub">${fmt.escape(linhaCurso || "definir curso")}</span>
        </span>
        <span class="brand-caret">▾</span>
      </button>
      <div class="nav-eyebrow">Painel</div>
      <nav class="nav">${itens}</nav>
      <div class="sidebar-foot">
        <button class="btn ghost sm" id="btn-tema"><span id="tema-icone">◐</span> <span id="tema-texto">Tema</span></button>
        <button class="btn ghost sm" id="btn-backup">⤓ Backup e dados</button>
      </div>`;

    document.getElementById("btn-perfil").addEventListener("click", abrirPerfil);
    document.getElementById("btn-tema").addEventListener("click", tema.alternar);
    document.getElementById("btn-backup").addEventListener("click", abrirBackup);
    tema.aplicarRotulo();
  }

  /* ------------------------------- Perfil ---------------------------------- */

  /**
   * Reduz a foto escolhida antes de guardar: o localStorage tem uns 5 MB para
   * tudo, e uma foto de celular sozinha passa disso. 256px de lado em JPEG
   * fica em poucas dezenas de KB e é bem mais do que o avatar precisa.
   */
  function redimensionarFoto(file, lado = 256) {
    return new Promise((ok, falha) => {
      if (!file.type.startsWith("image/")) return falha(new Error("Escolha um arquivo de imagem (JPG, PNG…)."));
      const leitor = new FileReader();
      leitor.onerror = () => falha(new Error("Não foi possível ler a imagem."));
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => falha(new Error("Este arquivo não parece ser uma imagem válida."));
        img.onload = () => {
          // Recorte quadrado central: o avatar é redondo, então sobra é sobra.
          const corte = Math.min(img.width, img.height);
          const cv = document.createElement("canvas");
          cv.width = cv.height = lado;
          const ctx = cv.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, (img.width - corte) / 2, (img.height - corte) / 2, corte, corte, 0, 0, lado, lado);
          ok(cv.toDataURL("image/jpeg", 0.82));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(file);
    });
  }

  /** Pop-up do perfil: quem é, o que já cadastrou e edição em linha. */
  function abrirPerfil() {
    const e = Store.estado();
    const p = e.perfil || {};

    const registros =
      e.financeiro.transacoes.length + e.financeiro.metas.length + e.financeiro.contas.length +
      e.financeiro.cartoes.length + e.faculdade.prazos.length + e.projetos.length + e.oportunidades.length;
    const disciplinas = e.faculdade.disciplinas.length;
    const urgentes = compromissos().filter((i) => {
      const d = diasAte(i.data);
      return d !== null && d >= 0 && d <= 7;
    }).length;

    const linha = [p.instituicao, p.cidade].filter(Boolean).join(" · ");
    const curso = [p.curso, p.semestre ? `${p.semestre}º semestre` : ""].filter(Boolean).join(" · ");

    const html = `
      <div class="perfil-topo">
        ${avatarHTML(p, "avatar")}
        <div style="min-width:0;">
          <div class="perfil-nome">${fmt.escape(p.nome || "Seu nome")}</div>
          <div class="perfil-linha">${fmt.escape(curso || "Curso não informado")}</div>
          ${linha ? `<div class="perfil-linha muted">${fmt.escape(linha)}</div>` : ""}
          <div class="perfil-foto-acoes">
            <button class="btn sm" data-acao="foto" type="button">${p.foto ? "Trocar foto" : "Enviar foto"}</button>
            ${p.foto ? `<button class="btn ghost sm" data-acao="tirar-foto" type="button">Remover</button>` : ""}
          </div>
          <input type="file" accept="image/*" class="hidden" data-arquivo-foto />
        </div>
      </div>
      <div class="modal-body">
        <div class="perfil-stats">
          <div class="perfil-stat"><b>${disciplinas}</b><span>${disciplinas === 1 ? "disciplina" : "disciplinas"}</span></div>
          <div class="perfil-stat"><b>${registros}</b><span>registros</span></div>
          <div class="perfil-stat"><b>${urgentes}</b><span>nesta semana</span></div>
        </div>
        <div class="card-note" data-uso>Anexos: calculando…</div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-acao="fechar" type="button">Fechar</button>
        <button class="btn primary" data-acao="editar" type="button">Editar perfil</button>
      </div>`;

    abrirModal(html, {
      aoMontar(modal, fechar) {
        const entrada = modal.querySelector("[data-arquivo-foto]");

        modal.querySelector('[data-acao="foto"]').addEventListener("click", () => entrada.click());

        entrada.addEventListener("change", async (ev) => {
          const f = ev.target.files[0];
          if (!f) return;
          try {
            const foto = await redimensionarFoto(f);
            Store.definirPerfil({ foto });
            fechar(null);
            montarLayout(paginaAtiva, opcoesAtivas);
            toast("Foto atualizada.");
            abrirPerfil();
          } catch (err) {
            toast(err.message);
          }
        });

        modal.querySelector('[data-acao="tirar-foto"]')?.addEventListener("click", () => {
          Store.definirPerfil({ foto: "" });
          fechar(null);
          montarLayout(paginaAtiva, opcoesAtivas);
          toast("Foto removida.");
          abrirPerfil();
        });

        modal.querySelector('[data-acao="editar"]').addEventListener("click", async () => {
          fechar(null);
          const v = await formulario({
            titulo: "Editar perfil",
            descricao: "Aparece na barra lateral e nos relatórios do painel.",
            valores: p,
            campos: [
              { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
              { nome: "curso", rotulo: "Curso", tipo: "text", placeholder: "Ex.: Medicina" },
              { nome: "semestre", rotulo: "Semestre", tipo: "number", step: "1", placeholder: "Ex.: 6" },
              { nome: "instituicao", rotulo: "Instituição", tipo: "text", placeholder: "Ex.: UFBA" },
              { nome: "cidade", rotulo: "Cidade", tipo: "text", placeholder: "Ex.: Salvador, BA" },
              { nome: "email", rotulo: "E-mail", tipo: "text" },
            ],
          });
          if (!v) return abrirPerfil();
          Store.definirPerfil(v);
          montarLayout(paginaAtiva, opcoesAtivas);
          toast("Perfil atualizado.");
          abrirPerfil();
        });

        modal.querySelector('[data-acao="fechar"]').addEventListener("click", () => fechar(null));

        // O tamanho dos anexos vem do IndexedDB, então chega depois da tela.
        const alvo = modal.querySelector("[data-uso]");
        if (typeof Arquivos !== "undefined" && Arquivos.disponivel) {
          Arquivos.uso().then((u) => {
            alvo.textContent = u.quantidade
              ? `${u.quantidade} ${u.quantidade === 1 ? "anexo guardado" : "anexos guardados"} · ${Arquivos.tamanhoLegivel(u.bytes)} neste navegador`
              : "Nenhum documento anexado ainda.";
          }).catch(() => { alvo.textContent = ""; });
        } else {
          alvo.textContent = "";
        }
      },
    });
  }

  /* --------------------------- Notas da disciplina ------------------------- */

  /** Média ponderada das avaliações que já têm nota lançada. */
  function mediaDisciplina(d) {
    const comNota = (d.avaliacoes || []).filter(
      (a) => a.nota !== null && a.nota !== undefined && a.nota !== "" && !Number.isNaN(Number(a.nota))
    );
    if (!comNota.length) return null;
    const pesoTotal = comNota.reduce((s, a) => s + (Number(a.peso) || 1), 0);
    const soma = comNota.reduce((s, a) => s + Number(a.nota) * (Number(a.peso) || 1), 0);
    return { media: soma / pesoTotal, quantidade: comNota.length };
  }

  /** Próxima avaliação ainda sem nota. */
  function proximaAvaliacao(d) {
    return (d.avaliacoes || [])
      .filter((a) => a.data && (a.nota === null || a.nota === undefined || a.nota === ""))
      .sort((a, b) => a.data.localeCompare(b.data))[0] || null;
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

          // Campos de anexo: cada um devolve a função que grava seus arquivos.
          const gravarAnexos = {};
          campos.filter((c) => c.tipo === "anexos").forEach((c) => {
            gravarAnexos[c.nome] = ligarAnexos(modal, c, valores[c.nome] ?? c.valorPadrao ?? []);
          });

          const primeiro = form.querySelector("input:not([type=hidden]):not([type=file]), select, textarea");
          primeiro?.focus();
          if (primeiro?.select) setTimeout(() => primeiro.select(), 0);

          const btnOk = modal.querySelector('[data-acao="confirmar"]');

          const confirmar = async () => {
            const saida = {};
            let erro = false;
            modal.querySelectorAll(".field .err").forEach((n) => n.remove());

            campos.forEach((c) => {
              if (c.tipo === "anexos") return; // tratado depois, é assíncrono
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

            const nomes = Object.keys(gravarAnexos);
            if (nomes.length) {
              // Gravar no IndexedDB leva um instante: trava o botão para não
              // salvar duas vezes e deixa claro que algo está acontecendo.
              btnOk.disabled = true;
              btnOk.textContent = "Salvando…";
              try {
                for (const nome of nomes) saida[nome] = await gravarAnexos[nome]();
              } catch (err) {
                btnOk.disabled = false;
                btnOk.textContent = rotuloConfirmar;
                return toast(`Não foi possível salvar os anexos: ${err.message}`);
              }
            }

            fechar(saida);
          };

          btnOk.addEventListener("click", confirmar);
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
      case "anexos": {
        // O <input file> fica escondido: quem recebe o clique e o arrastar é a
        // área pontilhada, que dá um alvo bem maior.
        const lista = Array.isArray(valor) ? valor : [];
        controle = `<div class="anexos-campo" data-anexos="${c.nome}">
            <input type="hidden" name="${c.nome}" value="" />
            <input type="file" multiple class="hidden" data-entrada />
            <div class="anexos" data-lista>${lista.map(anexoLinhaHTML).join("")}</div>
            <div class="dropzone" data-zona tabindex="0" role="button">
              <strong>Anexar documento</strong>
              Clique aqui ou arraste os arquivos${typeof Arquivos !== "undefined" ? ` (até ${Arquivos.LIMITE_MB} MB cada)` : ""}
            </div>
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

  /** Uma linha da lista de anexos dentro de um formulário (com botão remover). */
  function anexoLinhaHTML(a, pendente = false) {
    const cls = typeof Arquivos !== "undefined" ? Arquivos.classificar(a) : { classe: "", rotulo: "arq" };
    const tam = typeof Arquivos !== "undefined" ? Arquivos.tamanhoLegivel(a.tamanho) : "";
    return `<div class="anexo" data-anexo-id="${fmt.escape(a.id || "")}" ${pendente ? 'data-pendente="1"' : ""}>
        <span class="anexo-ic ${cls.classe}">${fmt.escape(cls.rotulo)}</span>
        <span class="anexo-nome">${fmt.escape(a.nome)}
          <span class="anexo-meta">${fmt.escape(tam)}${pendente ? " · a salvar" : ""}</span>
        </span>
        <button class="btn ghost sm" data-remover type="button" aria-label="Remover anexo">✕</button>
      </div>`;
  }

  /**
   * Liga a área de anexos de um formulário. Os arquivos escolhidos ficam na
   * memória até o Salvar — assim cancelar não deixa lixo no IndexedDB.
   * Devolve uma função que grava tudo e resolve com a lista final de fichas.
   */
  function ligarAnexos(modal, campo, valorInicial) {
    const raiz = modal.querySelector(`[data-anexos="${campo.nome}"]`);
    if (!raiz) return async () => valorInicial || [];

    const entrada = raiz.querySelector("[data-entrada]");
    const zona = raiz.querySelector("[data-zona]");
    const lista = raiz.querySelector("[data-lista]");

    let mantidos = [...(valorInicial || [])];
    const removidos = [];
    const novos = []; // File ainda não gravados

    const redesenhar = () => {
      lista.innerHTML =
        mantidos.map((a) => anexoLinhaHTML(a)).join("") +
        novos.map((f) => anexoLinhaHTML({ nome: f.name, tipo: f.type, tamanho: f.size }, true)).join("");

      lista.querySelectorAll(".anexo").forEach((el, i) => {
        el.querySelector("[data-remover]").addEventListener("click", () => {
          if (i < mantidos.length) removidos.push(mantidos.splice(i, 1)[0]);
          else novos.splice(i - mantidos.length, 1);
          redesenhar();
        });
      });
    };

    const aceitar = (arquivos) => {
      const limite = typeof Arquivos !== "undefined" ? Arquivos.LIMITE_MB * 1024 * 1024 : Infinity;
      [...arquivos].forEach((f) => {
        if (f.size > limite) return toast(`"${f.name}" passa de ${Arquivos.LIMITE_MB} MB e não foi anexado.`);
        novos.push(f);
      });
      redesenhar();
    };

    zona.addEventListener("click", () => entrada.click());
    zona.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); entrada.click(); }
    });
    entrada.addEventListener("change", (ev) => { aceitar(ev.target.files); entrada.value = ""; });

    ["dragenter", "dragover"].forEach((n) =>
      zona.addEventListener(n, (ev) => { ev.preventDefault(); zona.classList.add("dragover"); })
    );
    ["dragleave", "drop"].forEach((n) =>
      zona.addEventListener(n, (ev) => { ev.preventDefault(); zona.classList.remove("dragover"); })
    );
    zona.addEventListener("drop", (ev) => aceitar(ev.dataTransfer.files));

    redesenhar();

    // Só aqui os arquivos vão para o disco — e os apagados somem de vez.
    return async () => {
      for (const a of removidos) await Arquivos.remover(a.id);
      const salvos = [];
      for (const f of novos) {
        try { salvos.push(await Arquivos.salvar(f)); }
        catch (err) { toast(err.message); }
      }
      return [...mantidos, ...salvos];
    };
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
        <h2 class="modal-title">Backup e dados</h2>
        <p class="modal-desc">Tudo que você cadastra fica salvo só neste navegador. Exporte um arquivo para não perder nada ao trocar de computador ou limpar o cache.</p>
      </div>
      <div class="modal-body">
        <div class="perfil-stats">
          <div class="perfil-stat"><b>${total}</b><span>registros</span></div>
          <div class="perfil-stat"><b data-anexos-n>—</b><span>anexos</span></div>
          <div class="perfil-stat"><b data-anexos-mb>—</b><span>em arquivos</span></div>
        </div>
        <button class="btn primary block" data-acao="exportar" type="button">⤓ Exportar backup (.json)</button>
        <button class="btn block" data-acao="importar" type="button">⤒ Importar backup</button>
        <input type="file" accept="application/json" class="hidden" data-arquivo />
        <span class="hint">O backup leva junto os documentos anexados nas disciplinas, então o arquivo pode ficar grande.</span>
        <button class="btn danger block" data-acao="limpar" type="button">Apagar todos os dados</button>
      </div>
      <div class="modal-foot"><button class="btn" data-acao="fechar" type="button">Fechar</button></div>`;

    abrirModal(html, {
      aoMontar(modal, fechar) {
        const arquivo = modal.querySelector("[data-arquivo]");
        const btnExportar = modal.querySelector('[data-acao="exportar"]');

        if (typeof Arquivos !== "undefined" && Arquivos.disponivel) {
          Arquivos.uso().then((u) => {
            modal.querySelector("[data-anexos-n]").textContent = u.quantidade;
            modal.querySelector("[data-anexos-mb]").textContent = Arquivos.tamanhoLegivel(u.bytes);
          }).catch(() => {});
        }

        btnExportar.addEventListener("click", async () => {
          btnExportar.disabled = true;
          btnExportar.textContent = "Montando o backup…";
          try {
            const blob = new Blob([await Store.exportar()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `organizador-backup-${hojeISO()}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            toast("Backup exportado.");
          } catch (err) {
            toast(`Não foi possível exportar: ${err.message}`);
          }
          btnExportar.disabled = false;
          btnExportar.textContent = "⤓ Exportar backup (.json)";
        });

        modal.querySelector('[data-acao="importar"]').addEventListener("click", () => arquivo.click());

        arquivo.addEventListener("change", (ev) => {
          const f = ev.target.files[0];
          if (!f) return;
          const leitor = new FileReader();
          leitor.onload = async () => {
            try {
              const r = await Store.importar(leitor.result);
              fechar();
              toast(r.anexos ? `Backup importado com ${r.anexos} anexos. Recarregando…` : "Backup importado. Recarregando…");
              setTimeout(() => location.reload(), 800);
            } catch (err) {
              toast(`Não foi possível importar: ${err.message}`);
            }
          };
          leitor.readAsText(f);
        });

        modal.querySelector('[data-acao="limpar"]').addEventListener("click", async () => {
          const ok = await confirmar({
            titulo: "Apagar todos os dados?",
            descricao: "Isso remove tudo que você cadastrou neste navegador, inclusive os documentos anexados. Exporte um backup antes se quiser poder voltar atrás.",
            rotuloConfirmar: "Apagar tudo",
            perigo: true,
          });
          if (!ok) return;
          await Store.limpar();
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

  function iniciarPagina(ativo, opcoes) {
    tema.iniciar();
    montarLayout(ativo, opcoes);
  }

  /** Lê um parâmetro da URL (usado pelas páginas de detalhe). */
  function parametro(nome) {
    return new URLSearchParams(window.location.search).get(nome) || "";
  }

  return {
    fmt, hojeISO, mesAtual, mesAnterior, diasAte, urgencia, chaveSemana, parametro,
    compromissos, conflitos, contagens, mediaDisciplina, proximaAvaliacao,
    iniciarPagina, montarLayout, tema, toast, formulario, confirmar, abrirModal,
    abrirBackup, abrirPerfil, avatarHTML, iniciais, vazio, barras, colunasMensais, medidor,
  };
})();

// Aplica o tema antes da primeira pintura, evitando "flash" de tela clara.
UI.tema.iniciar();
