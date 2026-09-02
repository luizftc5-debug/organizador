/* Página de uma disciplina — avaliações, prazos, materiais e resumos. */

(() => {
  const { fmt } = UI;
  const CAMINHO = "faculdade.disciplinas";
  const id = UI.parametro("id");

  let disciplina = Store.achar(CAMINHO, id);

  // Disciplina inexistente (link antigo ou dados apagados): explica em vez de
  // deixar a página quebrada.
  if (!disciplina) {
    UI.iniciarPagina("faculdade");
    document.getElementById("conteudo").innerHTML = `
      <a class="voltar" href="faculdade.html">← Faculdade</a>
      <div class="card" style="margin-top:16px;"></div>`;
    document.querySelector(".card").appendChild(
      UI.vazio({
        icone: "◌",
        titulo: "Disciplina não encontrada",
        texto: "Ela pode ter sido excluída, ou este link é de outro navegador — os dados ficam salvos em cada navegador.",
        rotuloAcao: "Ver disciplinas",
        aoAcionar: () => (location.href = "faculdade.html"),
      })
    );
    return;
  }

  UI.iniciarPagina("disciplina", { idAtivo: id });

  const recarregar = () => { disciplina = Store.achar(CAMINHO, id); };
  const prazosDaDisciplina = () => Store.lista("faculdade.prazos").filter((p) => p.disciplinaId === id);

  /* --------------------------------- Render --------------------------------- */

  function render() {
    recarregar();
    document.title = `${disciplina.nome} · Organizador`;
    document.getElementById("titulo").textContent = disciplina.nome;
    document.getElementById("subtitulo").innerHTML = [
      disciplina.professor ? `Prof. ${fmt.escape(disciplina.professor)}` : "",
      `<span class="badge">${fmt.escape(disciplina.status || "ativa")}</span>`,
    ].filter(Boolean).join(" · ");

    const media = UI.mediaDisciplina(disciplina);
    document.getElementById("s-media").textContent = media ? media.media.toFixed(1) : "—";
    document.getElementById("s-media-d").textContent = media
      ? `Ponderada por ${media.quantidade} ${media.quantidade === 1 ? "nota lançada" : "notas lançadas"}`
      : "Nenhuma nota lançada ainda";

    const prox = UI.proximaAvaliacao(disciplina);
    document.getElementById("s-proxima").textContent = prox ? prox.nome || "Avaliação" : "Nada agendado";
    document.getElementById("s-proxima-d").innerHTML = prox
      ? `${fmt.data(prox.data)} · <span class="badge ${UI.urgencia(prox.data).nivel}">${UI.urgencia(prox.data).rotulo}</span>`
      : "Cadastre a próxima prova ou trabalho";

    const abertos = prazosDaDisciplina().filter((p) => !p.concluido);
    document.getElementById("s-prazos").textContent = abertos.length;
    const atrasados = abertos.filter((p) => (UI.diasAte(p.data) ?? 0) < 0).length;
    const dPrazos = document.getElementById("s-prazos-d");
    dPrazos.textContent = atrasados ? `${atrasados} já ${atrasados === 1 ? "venceu" : "venceram"}` : "Nenhum atrasado";
    dPrazos.className = `stat-sub ${atrasados ? "delta down" : ""}`;

    const nMat = (disciplina.materiais || []).length;
    const nRes = (disciplina.resumos || []).length;
    document.getElementById("s-conteudo").textContent = nMat + nRes;
    document.getElementById("s-conteudo-d").textContent = `${nMat} ${nMat === 1 ? "material" : "materiais"} · ${nRes} ${nRes === 1 ? "resumo" : "resumos"}`;

    renderAvaliacoes();
    renderPrazos();
    renderMateriais();
    renderResumos();
    UI.montarLayout("disciplina", { idAtivo: id });
  }

  function renderAvaliacoes() {
    const box = document.getElementById("avaliacoes");
    box.innerHTML = "";
    const lista = (disciplina.avaliacoes || [])
      .slice()
      .sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999"));

    if (!lista.length) {
      box.appendChild(
        UI.vazio({
          icone: "◎",
          titulo: "Nenhuma avaliação cadastrada",
          texto: "Cadastre provas e trabalhos com data e peso. Quando a nota sair, é só lançar aqui — a média é calculada sozinha.",
          rotuloAcao: "Adicionar avaliação",
          aoAcionar: novaAvaliacao,
        })
      );
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "list";
    lista.forEach((a) => {
      const temNota = a.nota !== null && a.nota !== undefined && a.nota !== "";
      const u = a.data && !temNota ? UI.urgencia(a.data) : null;
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="grow">
          <span class="title">${fmt.escape(a.nome || "Avaliação")}</span>
          <span class="meta">${[
            a.data ? fmt.data(a.data) : "sem data",
            `peso ${a.peso || 1}`,
          ].join(" · ")}</span>
        </span>
        ${temNota
          ? `<span class="nota-chip">${fmt.escape(String(a.nota))}</span>`
          : u ? `<span class="badge ${u.nivel}">${u.rotulo}</span>` : `<span class="badge">a lançar</span>`}
        <span class="row-actions">
          <button class="btn ghost sm" data-editar>Editar</button>
          <button class="btn ghost sm" data-excluir>Excluir</button>
        </span>`;
      li.querySelector("[data-editar]").addEventListener("click", () => editarAvaliacao(a));
      li.querySelector("[data-excluir]").addEventListener("click", () => excluirSub("avaliacoes", a, "Avaliação"));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function renderPrazos() {
    const box = document.getElementById("prazos");
    box.innerHTML = "";
    const lista = prazosDaDisciplina().sort((a, b) => (a.data || "").localeCompare(b.data || ""));

    if (!lista.length) {
      box.appendChild(
        UI.vazio({
          icone: "◷",
          titulo: "Nenhum prazo desta disciplina",
          texto: "Entregas, seminários e trabalhos cadastrados aqui já aparecem vinculados a esta matéria na agenda geral.",
          rotuloAcao: "Adicionar prazo",
          aoAcionar: novoPrazo,
        })
      );
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "list";
    lista.forEach((p) => {
      const u = UI.urgencia(p.data);
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="checkbox" class="check" ${p.concluido ? "checked" : ""} aria-label="Marcar como concluído" />
        <span class="grow">
          <span class="title ${p.concluido ? "strike" : ""}">${fmt.escape(p.descricao)}</span>
          <span class="meta">${fmt.escape(p.tipo || "entrega")} · ${fmt.data(p.data)}</span>
        </span>
        <span class="badge ${p.concluido ? "feito" : u.nivel}">${p.concluido ? "concluído" : u.rotulo}</span>
        <span class="row-actions"><button class="btn ghost sm" data-excluir>Excluir</button></span>`;
      li.querySelector("input").addEventListener("change", (ev) => {
        Store.atualizar("faculdade.prazos", p.id, { concluido: ev.target.checked });
        render();
      });
      li.querySelector("[data-excluir]").addEventListener("click", () => {
        const indice = Store.indiceDe("faculdade.prazos", p.id);
        Store.remover("faculdade.prazos", p.id);
        render();
        UI.toast("Prazo excluído.", {
          acaoRotulo: "Desfazer",
          aoAcionar: () => { Store.restaurar("faculdade.prazos", p, indice); render(); },
        });
      });
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function renderMateriais() {
    const box = document.getElementById("materiais");
    box.innerHTML = "";
    const lista = disciplina.materiais || [];

    if (!lista.length) {
      box.appendChild(
        UI.vazio({
          icone: "◫",
          titulo: "Nenhum material salvo",
          texto: "Guarde aqui os links que você usa nesta matéria: slides no Drive, artigos, vídeos, listas de exercícios.",
          rotuloAcao: "Adicionar material",
          aoAcionar: novoMaterial,
        })
      );
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "list";
    lista.forEach((m) => {
      const li = document.createElement("li");
      const titulo = m.url
        ? `<a class="title" href="${fmt.escape(m.url)}" target="_blank" rel="noopener">${fmt.escape(m.titulo)}</a>`
        : `<span class="title">${fmt.escape(m.titulo)}</span>`;
      li.innerHTML = `
        <span class="badge faculdade">${fmt.escape(m.tipo || "link")}</span>
        <span class="grow">
          ${titulo}
          ${m.url ? `<span class="meta">${fmt.escape(dominio(m.url))}</span>` : ""}
        </span>
        <span class="row-actions">
          <button class="btn ghost sm" data-editar>Editar</button>
          <button class="btn ghost sm" data-excluir>Excluir</button>
        </span>`;
      li.querySelector("[data-editar]").addEventListener("click", () => editarMaterial(m));
      li.querySelector("[data-excluir]").addEventListener("click", () => excluirSub("materiais", m, "Material"));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  function dominio(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }

  function renderResumos() {
    const box = document.getElementById("resumos");
    box.innerHTML = "";
    const lista = (disciplina.resumos || [])
      .slice()
      .sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || ""));

    if (!lista.length) {
      const card = document.createElement("div");
      card.className = "card";
      card.appendChild(
        UI.vazio({
          icone: "✎",
          titulo: "Nenhum resumo escrito",
          texto: "Escreva resumos por assunto. Ficam salvos neste navegador e entram no backup junto com o resto.",
          rotuloAcao: "Escrever resumo",
          aoAcionar: novoResumo,
        })
      );
      box.appendChild(card);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "grid g2";
    lista.forEach((r) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-head" style="align-items:flex-start;">
          <div style="min-width:0;">
            <h3 class="card-title" style="font-size:14px;">${fmt.escape(r.titulo)}</h3>
            <div class="card-note" style="margin-top:2px;">${r.atualizadoEm ? `atualizado em ${fmt.data(r.atualizadoEm)}` : ""}</div>
          </div>
          <span class="row-actions" style="opacity:1;">
            <button class="btn ghost sm" data-editar>Editar</button>
            <button class="btn ghost sm" data-excluir>Excluir</button>
          </span>
        </div>
        <div class="resumo-texto">${fmt.escape(r.conteudo || "")}</div>`;
      card.querySelector("[data-editar]").addEventListener("click", () => editarResumo(r));
      card.querySelector("[data-excluir]").addEventListener("click", () => excluirSub("resumos", r, "Resumo"));
      grid.appendChild(card);
    });
    box.appendChild(grid);
  }

  /* --------------------------------- Ações ---------------------------------- */

  const camposDisciplina = () => [
    { nome: "nome", rotulo: "Nome da disciplina", tipo: "text", obrigatorio: true },
    { nome: "professor", rotulo: "Professor(a)", tipo: "text" },
    { nome: "status", rotulo: "Situação", tipo: "select", opcoes: ["ativa", "concluída", "trancada"] },
  ];

  const camposAvaliacao = () => [
    { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true, placeholder: "Ex.: Prova 1" },
    { nome: "data", rotulo: "Data", tipo: "date" },
    { nome: "peso", rotulo: "Peso", tipo: "number", step: "0.5", valorPadrao: 1, dica: "Use 1 se todas as avaliações valem o mesmo." },
    { nome: "nota", rotulo: "Nota", tipo: "number", step: "0.1", dica: "Deixe em branco enquanto não sair." },
  ];

  const camposMaterial = () => [
    { nome: "titulo", rotulo: "Título", tipo: "text", obrigatorio: true, placeholder: "Ex.: Slides da aula 4" },
    { nome: "url", rotulo: "Link", tipo: "text", placeholder: "https://drive.google.com/..." },
    { nome: "tipo", rotulo: "Tipo", tipo: "select", opcoes: ["slides", "artigo", "vídeo", "livro", "exercícios", "link"] },
  ];

  const camposResumo = () => [
    { nome: "titulo", rotulo: "Título", tipo: "text", obrigatorio: true, placeholder: "Ex.: Insuficiência cardíaca" },
    { nome: "conteudo", rotulo: "Resumo", tipo: "textarea", obrigatorio: true },
  ];

  async function editarDisciplina() {
    const v = await UI.formulario({ titulo: "Editar disciplina", campos: camposDisciplina(), valores: disciplina });
    if (!v) return;
    Store.atualizar(CAMINHO, id, v);
    UI.toast("Disciplina atualizada.");
    render();
  }

  async function novaAvaliacao() {
    const v = await UI.formulario({ titulo: "Nova avaliação", descricao: `Prova ou trabalho de ${disciplina.nome}.`, campos: camposAvaliacao() });
    if (!v) return;
    Store.subInserir(CAMINHO, id, "avaliacoes", v);
    UI.toast("Avaliação cadastrada.");
    render();
  }

  async function editarAvaliacao(a) {
    const v = await UI.formulario({ titulo: "Editar avaliação", campos: camposAvaliacao(), valores: a });
    if (!v) return;
    Store.subAtualizar(CAMINHO, id, "avaliacoes", a.id, v);
    UI.toast("Avaliação atualizada.");
    render();
  }

  async function novoPrazo() {
    const v = await UI.formulario({
      titulo: "Novo prazo",
      descricao: `Entrega ou trabalho de ${disciplina.nome}.`,
      campos: [
        { nome: "descricao", rotulo: "O que é", tipo: "text", obrigatorio: true },
        { nome: "data", rotulo: "Data", tipo: "date", obrigatorio: true, valorPadrao: UI.hojeISO() },
        { nome: "tipo", rotulo: "Tipo", tipo: "select", opcoes: ["entrega", "seminário", "trabalho", "TCC", "outro"] },
      ],
    });
    if (!v) return;
    Store.inserir("faculdade.prazos", { ...v, disciplinaId: id, concluido: false });
    UI.toast("Prazo cadastrado.");
    render();
  }

  async function novoMaterial() {
    const v = await UI.formulario({ titulo: "Novo material", descricao: "Um link ou referência desta matéria.", campos: camposMaterial() });
    if (!v) return;
    Store.subInserir(CAMINHO, id, "materiais", v);
    UI.toast("Material salvo.");
    render();
  }

  async function editarMaterial(m) {
    const v = await UI.formulario({ titulo: "Editar material", campos: camposMaterial(), valores: m });
    if (!v) return;
    Store.subAtualizar(CAMINHO, id, "materiais", m.id, v);
    UI.toast("Material atualizado.");
    render();
  }

  async function novoResumo() {
    const v = await UI.formulario({ titulo: "Novo resumo", campos: camposResumo(), rotuloConfirmar: "Salvar resumo" });
    if (!v) return;
    Store.subInserir(CAMINHO, id, "resumos", { ...v, atualizadoEm: UI.hojeISO() });
    UI.toast("Resumo salvo.");
    render();
  }

  async function editarResumo(r) {
    const v = await UI.formulario({ titulo: "Editar resumo", campos: camposResumo(), valores: r, rotuloConfirmar: "Salvar" });
    if (!v) return;
    Store.subAtualizar(CAMINHO, id, "resumos", r.id, { ...v, atualizadoEm: UI.hojeISO() });
    UI.toast("Resumo atualizado.");
    render();
  }

  function excluirSub(campo, item, rotulo) {
    Store.subRemover(CAMINHO, id, campo, item.id);
    render();
    UI.toast(`${rotulo} excluído.`, {
      acaoRotulo: "Desfazer",
      aoAcionar: () => { Store.subInserir(CAMINHO, id, campo, item); render(); },
    });
  }

  document.getElementById("btn-editar").addEventListener("click", editarDisciplina);
  document.getElementById("btn-avaliacao").addEventListener("click", novaAvaliacao);
  document.getElementById("btn-avaliacao-2").addEventListener("click", novaAvaliacao);
  document.getElementById("btn-prazo").addEventListener("click", novoPrazo);
  document.getElementById("btn-material").addEventListener("click", novoMaterial);
  document.getElementById("btn-resumo").addEventListener("click", novoResumo);

  render();
})();
