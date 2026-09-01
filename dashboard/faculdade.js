/* Faculdade — disciplinas, provas e entregas. */

(() => {
  UI.iniciarPagina("faculdade");

  const { fmt } = UI;
  let verConcluidos = false;

  const disciplinas = () => Store.lista("faculdade.disciplinas");
  const prazos = () => Store.lista("faculdade.prazos");

  /* --------------------------------- Render --------------------------------- */

  function render() {
    const ativas = disciplinas().filter((d) => d.status !== "concluída");
    const abertos = prazos().filter((p) => !p.concluido);
    const atrasados = abertos.filter((p) => (UI.diasAte(p.data) ?? 0) < 0);

    document.getElementById("s-disciplinas").textContent = ativas.length;
    const comNota = disciplinas().filter((d) => d.nota !== null && d.nota !== "" && !Number.isNaN(Number(d.nota)));
    document.getElementById("s-disciplinas-d").textContent = comNota.length
      ? `Média das notas lançadas: ${(comNota.reduce((s, d) => s + Number(d.nota), 0) / comNota.length).toFixed(1)}`
      : "Nenhuma nota lançada ainda";

    document.getElementById("s-prazos").textContent = abertos.length;
    const dPrazos = document.getElementById("s-prazos-d");
    dPrazos.textContent = atrasados.length ? `${atrasados.length} já ${atrasados.length === 1 ? "venceu" : "venceram"}` : "Nenhum atrasado";
    dPrazos.className = `stat-sub ${atrasados.length ? "delta down" : ""}`;

    const proximas = UI.compromissos()
      .filter((i) => i.area === "faculdade" && (UI.diasAte(i.data) ?? -1) >= 0);
    const prox = proximas[0];
    document.getElementById("s-proxima").textContent = prox ? prox.titulo : "Nada agendado";
    document.getElementById("s-proxima-d").innerHTML = prox
      ? `${fmt.data(prox.data)} · <span class="delta ${UI.urgencia(prox.data).nivel === "atrasado" ? "down" : "flat"}">${UI.urgencia(prox.data).rotulo}</span>`
      : "Cadastre provas e entregas para acompanhar";

    renderAvisos();
    renderDisciplinas();
    renderPrazos();
    UI.montarLayout("faculdade");
  }

  function renderAvisos() {
    const box = document.getElementById("avisos");
    box.innerHTML = "";
    UI.conflitos()
      .filter((c) => c.itens.some((i) => i.area === "faculdade") && c.itens.length > 1)
      .slice(0, 2)
      .forEach((c) => {
        const el = document.createElement("div");
        el.className = c.multiplasAreas ? "notice warning" : "notice info";
        el.innerHTML = `<span class="ic">▲</span><span><strong>Semana de ${fmt.data(c.semana)}:</strong>
          ${c.itens.map((i) => `${fmt.escape(i.titulo)} <span class="muted">(${fmt.dataCurta(i.data)})</span>`).join(" · ")}</span>`;
        box.appendChild(el);
      });
  }

  function renderDisciplinas() {
    const box = document.getElementById("disciplinas");
    box.innerHTML = "";
    const lista = disciplinas();

    if (!lista.length) {
      box.appendChild(
        UI.vazio({
          icone: "▤",
          titulo: "Nenhuma disciplina cadastrada",
          texto: "Cadastre as matérias do semestre para acompanhar notas e datas de prova.",
          rotuloAcao: "Adicionar disciplina",
          aoAcionar: novaDisciplina,
        })
      );
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "list";
    lista
      .slice()
      .sort((a, b) => (a.proximaAvaliacao || "9999").localeCompare(b.proximaAvaliacao || "9999"))
      .forEach((d) => {
        const u = d.proximaAvaliacao ? UI.urgencia(d.proximaAvaliacao) : null;
        const li = document.createElement("li");
        li.innerHTML = `
          <span class="grow">
            <span class="title ${d.status === "concluída" ? "strike" : ""}">${fmt.escape(d.nome)}</span>
            <span class="meta">${[
              d.professor && `Prof. ${fmt.escape(d.professor)}`,
              d.nota !== null && d.nota !== "" ? `nota ${fmt.escape(d.nota)}` : null,
              d.proximaAvaliacao ? `prova em ${fmt.data(d.proximaAvaliacao)}` : null,
            ].filter(Boolean).join(" · ") || "sem informações extras"}</span>
          </span>
          ${u ? `<span class="badge ${u.nivel}">${u.rotulo}</span>` : `<span class="badge">${fmt.escape(d.status)}</span>`}
          <span class="row-actions">
            <button class="btn ghost sm" data-editar>Editar</button>
            <button class="btn ghost sm" data-excluir>Excluir</button>
          </span>`;
        li.querySelector("[data-editar]").addEventListener("click", () => editarDisciplina(d));
        li.querySelector("[data-excluir]").addEventListener("click", () => excluir("faculdade.disciplinas", d, "Disciplina"));
        ul.appendChild(li);
      });
    box.appendChild(ul);
  }

  function renderPrazos() {
    const box = document.getElementById("prazos");
    box.innerHTML = "";
    const lista = prazos()
      .filter((p) => verConcluidos || !p.concluido)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));

    if (!lista.length) {
      box.appendChild(
        UI.vazio({
          icone: "◷",
          titulo: prazos().length ? "Nenhum prazo em aberto" : "Nenhum prazo cadastrado",
          texto: prazos().length
            ? "Tudo em dia por aqui. Marque a caixa acima para rever os concluídos."
            : "Cadastre entregas, provas e marcos do TCC para o painel cruzar com os prazos dos projetos.",
          rotuloAcao: prazos().length ? null : "Adicionar prazo",
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
        <span class="row-actions">
          <button class="btn ghost sm" data-editar>Editar</button>
          <button class="btn ghost sm" data-excluir>Excluir</button>
        </span>`;
      li.querySelector("input").addEventListener("change", (ev) => {
        Store.atualizar("faculdade.prazos", p.id, { concluido: ev.target.checked });
        UI.toast(ev.target.checked ? "Prazo concluído." : "Prazo reaberto.");
        render();
      });
      li.querySelector("[data-editar]").addEventListener("click", () => editarPrazo(p));
      li.querySelector("[data-excluir]").addEventListener("click", () => excluir("faculdade.prazos", p, "Prazo"));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  /* --------------------------------- Ações ---------------------------------- */

  const camposDisciplina = () => [
    { nome: "nome", rotulo: "Nome da disciplina", tipo: "text", obrigatorio: true, placeholder: "Ex.: Clínica Médica" },
    { nome: "professor", rotulo: "Professor(a)", tipo: "text" },
    { nome: "status", rotulo: "Situação", tipo: "select", opcoes: ["ativa", "concluída", "trancada"] },
    { nome: "nota", rotulo: "Nota", tipo: "number", step: "0.1", dica: "Deixe em branco se ainda não saiu." },
    { nome: "proximaAvaliacao", rotulo: "Próxima avaliação", tipo: "date" },
  ];

  const camposPrazo = () => [
    { nome: "descricao", rotulo: "O que é", tipo: "text", obrigatorio: true, placeholder: "Ex.: Entrega da metanálise" },
    { nome: "data", rotulo: "Data", tipo: "date", obrigatorio: true, valorPadrao: UI.hojeISO() },
    { nome: "tipo", rotulo: "Tipo", tipo: "select", opcoes: ["entrega", "prova", "seminário", "TCC", "outro"] },
  ];

  async function novaDisciplina() {
    const v = await UI.formulario({ titulo: "Nova disciplina", campos: camposDisciplina() });
    if (!v) return;
    Store.inserir("faculdade.disciplinas", v);
    UI.toast("Disciplina adicionada.");
    render();
  }

  async function editarDisciplina(d) {
    const v = await UI.formulario({ titulo: "Editar disciplina", campos: camposDisciplina(), valores: d });
    if (!v) return;
    Store.atualizar("faculdade.disciplinas", d.id, v);
    UI.toast("Disciplina atualizada.");
    render();
  }

  async function novoPrazo() {
    const v = await UI.formulario({ titulo: "Novo prazo", descricao: "Provas, entregas e marcos do TCC.", campos: camposPrazo() });
    if (!v) return;
    Store.inserir("faculdade.prazos", { ...v, concluido: false });
    UI.toast("Prazo cadastrado.");
    render();
  }

  async function editarPrazo(p) {
    const v = await UI.formulario({ titulo: "Editar prazo", campos: camposPrazo(), valores: p });
    if (!v) return;
    Store.atualizar("faculdade.prazos", p.id, v);
    UI.toast("Prazo atualizado.");
    render();
  }

  function excluir(caminho, item, rotulo) {
    const indice = Store.indiceDe(caminho, item.id);
    Store.remover(caminho, item.id);
    render();
    UI.toast(`${rotulo} excluída.`, {
      acaoRotulo: "Desfazer",
      aoAcionar: () => { Store.restaurar(caminho, item, indice); render(); },
    });
  }

  document.getElementById("btn-disciplina").addEventListener("click", novaDisciplina);
  document.getElementById("btn-disciplina-2").addEventListener("click", novaDisciplina);
  document.getElementById("btn-prazo").addEventListener("click", novoPrazo);
  document.getElementById("ver-concluidos").addEventListener("change", (e) => {
    verConcluidos = e.target.checked;
    renderPrazos();
  });

  render();
})();
