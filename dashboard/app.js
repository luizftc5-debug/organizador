(function () {
  const content = document.getElementById("content");
  const alertsEl = document.getElementById("alerts");
  const updatedEl = document.getElementById("updated");
  const nav = document.getElementById("views");

  updatedEl.textContent = DATA.atualizadoEm
    ? `Atualizado em ${formatDate(DATA.atualizadoEm)}`
    : "";

  function formatDate(iso) {
    if (!iso) return "-";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function formatCurrency(v) {
    return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: DATA.financeiro.moeda || "BRL" });
  }

  function sum(list, field) {
    return list.reduce((acc, item) => acc + (item[field] || 0), 0);
  }

  function weekKey(iso) {
    const date = new Date(iso + "T00:00:00");
    const onejan = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil(((date - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${week}`;
  }

  function collectDeadlines() {
    const items = [];
    (DATA.escola.prazos || []).forEach((p) =>
      items.push({ desc: p.descricao, data: p.data, area: "escola" })
    );
    (DATA.escola.disciplinas || []).forEach((d) => {
      if (d.proximaAvaliacao) {
        items.push({ desc: `Avaliação: ${d.nome}`, data: d.proximaAvaliacao, area: "escola" });
      }
    });
    (DATA.projetos || []).forEach((p) => {
      if (p.deadline) {
        items.push({ desc: `Projeto: ${p.nome}`, data: p.deadline, area: "projetos" });
      }
    });
    return items.filter((i) => i.data).sort((a, b) => a.data.localeCompare(b.data));
  }

  function renderAlerts() {
    alertsEl.innerHTML = "";
    const items = collectDeadlines();
    const byWeek = {};
    items.forEach((i) => {
      const key = weekKey(i.data);
      byWeek[key] = byWeek[key] || [];
      byWeek[key].push(i);
    });
    Object.values(byWeek).forEach((group) => {
      const areas = new Set(group.map((i) => i.area));
      if (areas.size > 1 || group.length > 1) {
        const div = document.createElement("div");
        div.className = "alert";
        div.textContent =
          "⚠ Conflito de prazos na mesma semana: " +
          group.map((i) => `${i.desc} (${formatDate(i.data)})`).join(" · ");
        alertsEl.appendChild(div);
      }
    });
  }

  function statCard(title, dotClass, rows) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h2><span class="dot ${dotClass}"></span>${title}</h2>`;
    const wrap = document.createElement("div");
    if (rows.length === 0) {
      wrap.innerHTML = `<div class="empty">Sem dados ainda. Edite dashboard/data.js.</div>`;
    } else {
      rows.forEach((r) => wrap.appendChild(r));
    }
    card.appendChild(wrap);
    return card;
  }

  function row(label, value) {
    const div = document.createElement("div");
    div.className = "stat-row";
    div.innerHTML = `<span class="label">${label}</span><span>${value}</span>`;
    return div;
  }

  function listCard(title, dotClass, items, render) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h2><span class="dot ${dotClass}"></span>${title}</h2>`;
    if (items.length === 0) {
      card.innerHTML += `<div class="empty">Sem itens ainda.</div>`;
    } else {
      const ul = document.createElement("ul");
      ul.className = "list";
      items.forEach((item) => ul.appendChild(render(item)));
      card.appendChild(ul);
    }
    return card;
  }

  function viewStatus() {
    content.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid";

    const receitas = sum(DATA.financeiro.receitasMes, "valor");
    const despesas = sum(DATA.financeiro.despesasMes, "valor");
    grid.appendChild(
      statCard("Financeiro", "financeiro", [
        row("Saldo atual", formatCurrency(DATA.financeiro.saldoAtual)),
        row("Receitas do mês", formatCurrency(receitas)),
        row("Despesas do mês", formatCurrency(despesas)),
        row("Metas ativas", DATA.financeiro.metas.length),
      ])
    );

    grid.appendChild(
      statCard("Escola", "escola", [
        row("Disciplinas ativas", DATA.escola.disciplinas.length),
        row("Prazos cadastrados", DATA.escola.prazos.length),
      ])
    );

    grid.appendChild(
      statCard("Projetos", "projetos", [
        row("Projetos em acompanhamento", DATA.projetos.length),
        row(
          "Próximo deadline",
          DATA.projetos
            .filter((p) => p.deadline)
            .sort((a, b) => a.deadline.localeCompare(b.deadline))[0]?.deadline
            ? formatDate(
                DATA.projetos
                  .filter((p) => p.deadline)
                  .sort((a, b) => a.deadline.localeCompare(b.deadline))[0].deadline
              )
            : "-"
        ),
      ])
    );

    content.appendChild(grid);
  }

  function viewProximos() {
    content.innerHTML = "";
    const items = collectDeadlines();
    const card = listCard("Próximos passos (todos os pilares)", "projetos", items, (item) => {
      const li = document.createElement("li");
      li.innerHTML = `<span><span class="badge">${item.area}</span> ${item.desc}</span><span class="date">${formatDate(item.data)}</span>`;
      return li;
    });
    content.appendChild(card);
  }

  function viewOportunidades() {
    content.innerHTML = "";
    const card = listCard("Oportunidades", "financeiro", DATA.oportunidades, (item) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${item.descricao}</span><span class="badge">${item.area || ""}</span>`;
      return li;
    });
    content.appendChild(card);
  }

  function viewFinanceiro() {
    content.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid";

    grid.appendChild(
      listCard("Receitas do mês", "financeiro", DATA.financeiro.receitasMes, (item) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${item.descricao}</span><span class="date">${formatCurrency(item.valor)} · ${formatDate(item.data)}</span>`;
        return li;
      })
    );

    grid.appendChild(
      listCard("Despesas do mês", "financeiro", DATA.financeiro.despesasMes, (item) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${item.descricao}</span><span class="date">${formatCurrency(item.valor)} · ${formatDate(item.data)}</span>`;
        return li;
      })
    );

    const metasCard = document.createElement("div");
    metasCard.className = "card";
    metasCard.innerHTML = `<h2><span class="dot financeiro"></span>Metas</h2>`;
    if (DATA.financeiro.metas.length === 0) {
      metasCard.innerHTML += `<div class="empty">Sem metas cadastradas.</div>`;
    } else {
      DATA.financeiro.metas.forEach((m) => {
        const pct = m.valorAlvo ? Math.min(100, (m.valorAtual / m.valorAlvo) * 100) : 0;
        const wrap = document.createElement("div");
        wrap.style.marginBottom = "12px";
        wrap.innerHTML = `
          <div class="stat-row"><span class="label">${m.descricao}</span><span>${formatCurrency(m.valorAtual)} / ${formatCurrency(m.valorAlvo)}</span></div>
          <div class="bar-bg"><div class="bar-fill financeiro" style="width:${pct}%"></div></div>
        `;
        metasCard.appendChild(wrap);
      });
    }
    grid.appendChild(metasCard);

    content.appendChild(grid);
  }

  const views = {
    status: viewStatus,
    proximos: viewProximos,
    oportunidades: viewOportunidades,
    financeiro: viewFinanceiro,
  };

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-view]");
    if (!btn) return;
    nav.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    views[btn.dataset.view]();
  });

  renderAlerts();
  viewStatus();
})();
