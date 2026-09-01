/* Projetos — acompanhamento por etapas e oportunidades de renda. */

(() => {
  UI.iniciarPagina("projetos");

  const { fmt } = UI;

  const projetos = () => Store.lista("projetos");
  const oportunidades = () => Store.lista("oportunidades");

  const progresso = (p) => {
    const passos = p.passos || [];
    if (!passos.length) return null;
    return { feitos: passos.filter((s) => s.feito).length, total: passos.length };
  };

  /* --------------------------------- Render --------------------------------- */

  function render() {
    const ativos = projetos().filter((p) => p.status !== "concluído");
    document.getElementById("s-ativos").textContent = ativos.length;
    document.getElementById("s-ativos-d").textContent = `${projetos().length} ${projetos().length === 1 ? "projeto no total" : "projetos no total"}`;

    const passos = projetos().flatMap((p) => p.passos || []);
    const feitos = passos.filter((s) => s.feito).length;
    document.getElementById("s-etapas").textContent = passos.length ? `${feitos}/${passos.length}` : "—";
    document.getElementById("s-etapas-d").textContent = passos.length
      ? `${Math.round((feitos / passos.length) * 100)}% do total planejado`
      : "Adicione etapas aos projetos";

    const comPrazo = ativos.filter((p) => p.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
    const prox = comPrazo[0];
    document.getElementById("s-deadline").textContent = prox ? prox.nome : "Nenhum";
    document.getElementById("s-deadline-d").innerHTML = prox
      ? `${fmt.data(prox.deadline)} · <span class="delta ${UI.urgencia(prox.deadline).nivel === "atrasado" ? "down" : "flat"}">${UI.urgencia(prox.deadline).rotulo}</span>`
      : "Nenhum projeto ativo com prazo";

    renderProjetos();
    renderOportunidades();
    UI.montarLayout("projetos");
  }

  function renderProjetos() {
    const box = document.getElementById("projetos");
    box.innerHTML = "";
    const lista = projetos();

    if (!lista.length) {
      const card = document.createElement("div");
      card.className = "card";
      card.appendChild(
        UI.vazio({
          icone: "◇",
          titulo: "Nenhum projeto cadastrado",
          texto: "Cadastre a metanálise, o TCC ou qualquer iniciativa paralela e quebre em etapas para acompanhar o progresso.",
          rotuloAcao: "Criar primeiro projeto",
          aoAcionar: novoProjeto,
        })
      );
      box.appendChild(card);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "grid g2";

    lista
      .slice()
      .sort((a, b) => {
        if ((a.status === "concluído") !== (b.status === "concluído")) return a.status === "concluído" ? 1 : -1;
        return (a.deadline || "9999").localeCompare(b.deadline || "9999");
      })
      .forEach((p) => grid.appendChild(cartaoProjeto(p)));

    box.appendChild(grid);
  }

  function cartaoProjeto(p) {
    const card = document.createElement("div");
    card.className = "card";
    const u = p.deadline ? UI.urgencia(p.deadline) : null;
    const prog = progresso(p);
    const concluido = p.status === "concluído";

    card.innerHTML = `
      <div class="card-head" style="align-items:flex-start;">
        <div>
          <h2 class="card-title" style="font-size:15px;">
            <span class="swatch projetos"></span>
            <span class="${concluido ? "strike" : ""}">${fmt.escape(p.nome)}</span>
          </h2>
          <div class="stat-sub" style="margin-top:4px;">
            <span class="badge ${concluido ? "feito" : ""}">${fmt.escape(p.status)}</span>
            ${u && !concluido ? `<span class="badge ${u.nivel}">${u.rotulo}</span>` : ""}
            ${p.deadline ? `<span class="muted"> · ${fmt.data(p.deadline)}</span>` : ""}
          </div>
        </div>
        <span class="row-actions" style="opacity:1;">
          <button class="btn ghost sm" data-editar>Editar</button>
          <button class="btn ghost sm" data-excluir>Excluir</button>
        </span>
      </div>
      ${p.descricao ? `<p class="card-note" style="margin:0 0 12px;">${fmt.escape(p.descricao)}</p>` : ""}
      <div data-progresso></div>
      <div data-passos></div>
      <button class="btn ghost sm" data-add-passo style="margin-top:8px;">+ Etapa</button>`;

    if (prog) {
      card.querySelector("[data-progresso]").appendChild(
        UI.medidor({
          rotulo: "Progresso",
          atual: prog.feitos,
          alvo: prog.total,
          formatar: (n) => `${n}`,
          sufixo: " etapas",
          cor: "var(--s-projetos)",
        })
      );
    }

    const boxPassos = card.querySelector("[data-passos]");
    if (!p.passos?.length) {
      boxPassos.innerHTML = `<p class="card-note" style="margin:4px 0 0;">Sem etapas ainda — quebre o projeto em passos para acompanhar o avanço.</p>`;
    } else {
      const ul = document.createElement("ul");
      ul.className = "list";
      p.passos.forEach((s) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <input type="checkbox" class="check" ${s.feito ? "checked" : ""} aria-label="Concluir etapa" />
          <span class="grow ${s.feito ? "strike" : ""}">${fmt.escape(s.texto)}</span>
          <span class="row-actions"><button class="btn ghost sm" data-rm-passo>Remover</button></span>`;
        li.querySelector("input").addEventListener("change", (ev) => {
          s.feito = ev.target.checked;
          Store.atualizar("projetos", p.id, { passos: p.passos });
          render();
        });
        li.querySelector("[data-rm-passo]").addEventListener("click", () => {
          Store.atualizar("projetos", p.id, { passos: p.passos.filter((x) => x.id !== s.id) });
          UI.toast("Etapa removida.");
          render();
        });
        ul.appendChild(li);
      });
      boxPassos.appendChild(ul);
    }

    card.querySelector("[data-editar]").addEventListener("click", () => editarProjeto(p));
    card.querySelector("[data-excluir]").addEventListener("click", () => excluir("projetos", p, "Projeto"));
    card.querySelector("[data-add-passo]").addEventListener("click", () => novaEtapa(p));
    return card;
  }

  function renderOportunidades() {
    const box = document.getElementById("oportunidades");
    box.innerHTML = "";
    const lista = oportunidades();

    if (!lista.length) {
      box.appendChild(
        UI.vazio({
          icone: "◈",
          titulo: "Nenhuma oportunidade anotada",
          texto: "Anote ideias de renda — monitoria, cursinho, revisão de artigos, plantões — com o retorno esperado e o esforço envolvido.",
          rotuloAcao: "Anotar oportunidade",
          aoAcionar: novaOportunidade,
        })
      );
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "list";
    lista.forEach((o) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="grow">
          <span class="title">${fmt.escape(o.descricao)}</span>
          <span class="meta">${[o.area, o.potencial && `retorno: ${o.potencial}`, o.esforco && `esforço: ${o.esforco}`]
            .filter(Boolean).map(fmt.escape).join(" · ") || "sem detalhes"}</span>
        </span>
        <span class="row-actions">
          <button class="btn ghost sm" data-editar>Editar</button>
          <button class="btn ghost sm" data-excluir>Excluir</button>
        </span>`;
      li.querySelector("[data-editar]").addEventListener("click", () => editarOportunidade(o));
      li.querySelector("[data-excluir]").addEventListener("click", () => excluir("oportunidades", o, "Oportunidade"));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  /* --------------------------------- Ações ---------------------------------- */

  const camposProjeto = () => [
    { nome: "nome", rotulo: "Nome do projeto", tipo: "text", obrigatorio: true, placeholder: "Ex.: Metanálise — TCC" },
    { nome: "status", rotulo: "Situação", tipo: "select", opcoes: ["planejamento", "em andamento", "pausado", "concluído"] },
    { nome: "descricao", rotulo: "Descrição", tipo: "textarea", placeholder: "Objetivo, parceiros, revista alvo…" },
    { nome: "deadline", rotulo: "Deadline", tipo: "date" },
  ];

  const camposOportunidade = () => [
    { nome: "descricao", rotulo: "Oportunidade", tipo: "text", obrigatorio: true, placeholder: "Ex.: Monitoria de fisiologia" },
    { nome: "area", rotulo: "Área relacionada", tipo: "select", opcoes: ["Faculdade", "Projetos", "Faculdade + Financeiro", "Externa"] },
    { nome: "potencial", rotulo: "Retorno estimado", tipo: "text", placeholder: "Ex.: R$ 600/mês" },
    { nome: "esforco", rotulo: "Esforço", tipo: "select", opcoes: ["baixo", "médio", "alto"] },
  ];

  async function novoProjeto() {
    const v = await UI.formulario({ titulo: "Novo projeto", campos: camposProjeto() });
    if (!v) return;
    Store.inserir("projetos", { ...v, passos: [] });
    UI.toast("Projeto criado.");
    render();
  }

  async function editarProjeto(p) {
    const v = await UI.formulario({ titulo: "Editar projeto", campos: camposProjeto(), valores: p });
    if (!v) return;
    Store.atualizar("projetos", p.id, v);
    UI.toast("Projeto atualizado.");
    render();
  }

  async function novaEtapa(p) {
    const v = await UI.formulario({
      titulo: "Nova etapa",
      descricao: `Adicionar um passo a "${p.nome}".`,
      campos: [{ nome: "texto", rotulo: "O que precisa ser feito", tipo: "text", obrigatorio: true, placeholder: "Ex.: Extração de dados dos estudos" }],
      rotuloConfirmar: "Adicionar",
    });
    if (!v) return;
    const passos = [...(p.passos || []), { id: Store.uid("s"), texto: v.texto, feito: false }];
    Store.atualizar("projetos", p.id, { passos });
    UI.toast("Etapa adicionada.");
    render();
  }

  async function novaOportunidade() {
    const v = await UI.formulario({
      titulo: "Nova oportunidade",
      descricao: "Uma ideia de renda para avaliar depois.",
      campos: camposOportunidade(),
    });
    if (!v) return;
    Store.inserir("oportunidades", v);
    UI.toast("Oportunidade anotada.");
    render();
  }

  async function editarOportunidade(o) {
    const v = await UI.formulario({ titulo: "Editar oportunidade", campos: camposOportunidade(), valores: o });
    if (!v) return;
    Store.atualizar("oportunidades", o.id, v);
    UI.toast("Oportunidade atualizada.");
    render();
  }

  function excluir(caminho, item, rotulo) {
    const indice = Store.indiceDe(caminho, item.id);
    Store.remover(caminho, item.id);
    render();
    UI.toast(`${rotulo} excluído.`, {
      acaoRotulo: "Desfazer",
      aoAcionar: () => { Store.restaurar(caminho, item, indice); render(); },
    });
  }

  document.getElementById("btn-projeto").addEventListener("click", novoProjeto);
  document.getElementById("btn-oportunidade").addEventListener("click", novaOportunidade);

  render();
})();
