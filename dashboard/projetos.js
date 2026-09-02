/* Projetos — iniciativas pessoais que geram renda, acompanhadas por etapas.
   Trabalhos acadêmicos e o TCC ficam na aba Faculdade. */

(() => {
  UI.iniciarPagina("projetos");

  const { fmt } = UI;

  const projetos = () => Store.lista("projetos");
  const oportunidades = () => Store.lista("oportunidades");
  const ativos = () => projetos().filter((p) => p.status !== "concluído" && p.status !== "arquivado");

  const progresso = (p) => {
    const passos = p.passos || [];
    if (!passos.length) return null;
    return { feitos: passos.filter((s) => s.feito).length, total: passos.length };
  };

  /* --------------------------------- Render --------------------------------- */

  function render() {
    const lista = projetos();
    const emAndamento = ativos();

    document.getElementById("s-ativos").textContent = emAndamento.length;
    document.getElementById("s-ativos-d").textContent = `${lista.length} ${lista.length === 1 ? "projeto no total" : "projetos no total"}`;

    const renda = emAndamento.reduce((s, p) => s + (Number(p.rendaEstimada) || 0), 0);
    document.getElementById("s-renda").textContent = renda ? fmt.moeda(renda) : "—";
    document.getElementById("s-renda-d").textContent = renda
      ? "Por mês, somando os projetos ativos"
      : "Informe a renda estimada de cada projeto";

    const faturado = lista.reduce((s, p) => s + (Number(p.receitaGerada) || 0), 0);
    document.getElementById("s-faturado").textContent = faturado ? fmt.moeda(faturado) : "—";
    document.getElementById("s-faturado-d").textContent = faturado
      ? "Total já recebido nestes projetos"
      : "Registre o que cada projeto já rendeu";

    const passos = lista.flatMap((p) => p.passos || []);
    const feitos = passos.filter((s) => s.feito).length;
    document.getElementById("s-etapas").textContent = passos.length ? `${feitos}/${passos.length}` : "—";
    document.getElementById("s-etapas-d").textContent = passos.length
      ? `${Math.round((feitos / passos.length) * 100)}% do planejado`
      : "Quebre os projetos em etapas";

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
          texto: "Aqui entram iniciativas que trazem dinheiro — monitoria, cursinho, plantões, conteúdo, freelas. Trabalhos da faculdade e o TCC ficam na aba Faculdade.",
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
        const fim = (p) => p.status === "concluído" || p.status === "arquivado";
        if (fim(a) !== fim(b)) return fim(a) ? 1 : -1;
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
    const encerrado = p.status === "concluído" || p.status === "arquivado";

    card.innerHTML = `
      <div class="card-head" style="align-items:flex-start;">
        <div style="min-width:0;">
          <h2 class="card-title" style="font-size:15px;">
            <span class="swatch projetos"></span>
            <span class="${encerrado ? "strike" : ""}">${fmt.escape(p.nome)}</span>
          </h2>
          <div class="stat-sub" style="margin-top:5px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <span class="badge ${p.status === "concluído" ? "feito" : ""}">${fmt.escape(p.status)}</span>
            ${u && !encerrado ? `<span class="badge ${u.nivel}">${u.rotulo}</span>` : ""}
            ${p.deadline ? `<span class="muted">${fmt.data(p.deadline)}</span>` : ""}
          </div>
        </div>
        <span class="row-actions" style="opacity:1;">
          <button class="btn ghost sm" data-editar>Editar</button>
          <button class="btn ghost sm" data-excluir>Excluir</button>
        </span>
      </div>

      ${p.descricao ? `<p class="card-note" style="margin:0 0 12px;">${fmt.escape(p.descricao)}</p>` : ""}

      ${(p.rendaEstimada || p.receitaGerada) ? `
        <div class="mini-stats">
          ${p.rendaEstimada ? `<div><div class="stat-label">Renda estimada</div><div class="mini-valor num">${fmt.moeda(p.rendaEstimada)}<span class="muted" style="font-weight:400;">/mês</span></div></div>` : ""}
          ${p.receitaGerada ? `<div><div class="stat-label">Já faturado</div><div class="mini-valor num" style="color:var(--success-text);">${fmt.moeda(p.receitaGerada)}</div></div>` : ""}
        </div>` : ""}

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
          Store.subAtualizar("projetos", p.id, "passos", s.id, { feito: ev.target.checked });
          render();
        });
        li.querySelector("[data-rm-passo]").addEventListener("click", () => {
          Store.subRemover("projetos", p.id, "passos", s.id);
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
          texto: "Anote ideias de renda antes de decidir tocá-las: monitoria, cursinho, revisão de artigos, plantões. Quando decidir seguir, vire projeto com um clique.",
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
          <span class="meta">${[o.potencial && `retorno: ${o.potencial}`, o.esforco && `esforço: ${o.esforco}`]
            .filter(Boolean).map(fmt.escape).join(" · ") || "sem detalhes"}</span>
        </span>
        <span class="row-actions">
          <button class="btn ghost sm" data-virar>Virar projeto</button>
          <button class="btn ghost sm" data-editar>Editar</button>
          <button class="btn ghost sm" data-excluir>Excluir</button>
        </span>`;
      li.querySelector("[data-virar]").addEventListener("click", () => virarProjeto(o));
      li.querySelector("[data-editar]").addEventListener("click", () => editarOportunidade(o));
      li.querySelector("[data-excluir]").addEventListener("click", () => excluir("oportunidades", o, "Oportunidade"));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  /* --------------------------------- Ações ---------------------------------- */

  const camposProjeto = () => [
    { nome: "nome", rotulo: "Nome do projeto", tipo: "text", obrigatorio: true, placeholder: "Ex.: Monitoria de fisiologia" },
    { nome: "status", rotulo: "Situação", tipo: "select", opcoes: ["planejamento", "em andamento", "pausado", "concluído", "arquivado"] },
    { nome: "descricao", rotulo: "Descrição", tipo: "textarea", placeholder: "O que é, para quem, como cobra…" },
    { nome: "rendaEstimada", rotulo: "Renda estimada por mês (R$)", tipo: "dinheiro", dica: "Quanto você espera que renda quando estiver rodando." },
    { nome: "receitaGerada", rotulo: "Já faturado (R$)", tipo: "dinheiro", dica: "Total recebido até agora com este projeto." },
    { nome: "deadline", rotulo: "Prazo", tipo: "date" },
  ];

  const camposOportunidade = () => [
    { nome: "descricao", rotulo: "Oportunidade", tipo: "text", obrigatorio: true, placeholder: "Ex.: Revisar artigos para colegas" },
    { nome: "potencial", rotulo: "Retorno estimado", tipo: "text", placeholder: "Ex.: R$ 600/mês" },
    { nome: "esforco", rotulo: "Esforço", tipo: "select", opcoes: ["baixo", "médio", "alto"] },
    { nome: "anotacoes", rotulo: "Anotações", tipo: "textarea" },
  ];

  async function novoProjeto() {
    const v = await UI.formulario({
      titulo: "Novo projeto",
      descricao: "Uma iniciativa pessoal que gera (ou vai gerar) renda.",
      campos: camposProjeto(),
    });
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
      campos: [{ nome: "texto", rotulo: "O que precisa ser feito", tipo: "text", obrigatorio: true, placeholder: "Ex.: Divulgar nas turmas do 3º semestre" }],
      rotuloConfirmar: "Adicionar",
    });
    if (!v) return;
    Store.subInserir("projetos", p.id, "passos", { texto: v.texto, feito: false });
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

  // Promove uma ideia a projeto, aproveitando o que já foi anotado.
  async function virarProjeto(o) {
    const v = await UI.formulario({
      titulo: "Virar projeto",
      descricao: "A oportunidade sai da lista de ideias e passa a ser acompanhada por etapas.",
      campos: camposProjeto(),
      valores: { nome: o.descricao, status: "planejamento", descricao: o.anotacoes || "" },
      rotuloConfirmar: "Criar projeto",
    });
    if (!v) return;
    Store.inserir("projetos", { ...v, passos: [] });
    const indice = Store.indiceDe("oportunidades", o.id);
    Store.remover("oportunidades", o.id);
    render();
    UI.toast("Virou projeto.", {
      acaoRotulo: "Desfazer",
      aoAcionar: () => { Store.restaurar("oportunidades", o, indice); render(); },
    });
  }

  function excluir(caminho, item, rotulo) {
    const indice = Store.indiceDe(caminho, item.id);
    Store.remover(caminho, item.id);
    render();
    UI.toast(`${rotulo} excluíd${rotulo === "Oportunidade" ? "a" : "o"}.`, {
      acaoRotulo: "Desfazer",
      aoAcionar: () => { Store.restaurar(caminho, item, indice); render(); },
    });
  }

  document.getElementById("btn-projeto").addEventListener("click", novoProjeto);
  document.getElementById("btn-oportunidade").addEventListener("click", novaOportunidade);

  render();
})();
