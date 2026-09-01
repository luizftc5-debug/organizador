(function () {
  renderSidebar("financeiro");
  document.getElementById("updated").textContent = `Atualizado em ${formatDate(DATA.atualizadoEm)}`;

  const CATEGORIAS = DATA.financeiro.categorias || ["Outros"];
  let transacoes = loadTransacoes();

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthKeyOf(iso) {
    return iso ? iso.slice(0, 7) : "";
  }

  function uid() {
    return `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function populateMonthFilter() {
    const select = document.getElementById("month-filter");
    const months = Array.from(new Set(transacoes.map((t) => monthKeyOf(t.data)).filter(Boolean))).sort();
    const cur = currentMonthKey();
    if (!months.includes(cur)) months.push(cur);
    months.sort();
    select.innerHTML = `<option value="todos">Todos os meses</option>` +
      months.map((m) => `<option value="${m}" ${m === cur ? "selected" : ""}>${m}</option>`).join("");
  }

  function filteredTransacoes() {
    const filter = document.getElementById("month-filter").value;
    if (filter === "todos") return transacoes;
    return transacoes.filter((t) => monthKeyOf(t.data) === filter);
  }

  function renderSummary() {
    const filter = document.getElementById("month-filter").value;
    const monthKey = filter === "todos" ? currentMonthKey() : filter;
    const monthItems = transacoes.filter((t) => monthKeyOf(t.data) === monthKey);
    const receitas = sum(monthItems.filter((t) => t.tipo === "receita"), "valor");
    const despesas = sum(monthItems.filter((t) => t.tipo === "despesa"), "valor");

    document.getElementById("stat-saldo").textContent = formatCurrency(DATA.financeiro.saldoAtual);
    document.getElementById("stat-receitas").textContent = formatCurrency(receitas);
    document.getElementById("stat-despesas").textContent = formatCurrency(despesas);
    const resultado = receitas - despesas;
    const resultadoEl = document.getElementById("stat-resultado");
    resultadoEl.textContent = formatCurrency(resultado);
    resultadoEl.style.color = resultado >= 0 ? "var(--financeiro)" : "var(--alert)";

    renderCategoriaBars(monthItems.filter((t) => t.tipo === "despesa"), despesas);
  }

  function renderCategoriaBars(despesaItems, total) {
    const el = document.getElementById("categoria-bars");
    el.innerHTML = "";
    if (despesaItems.length === 0) {
      el.innerHTML = `<div class="empty">Sem despesas no período.</div>`;
      return;
    }
    const byCat = {};
    despesaItems.forEach((t) => {
      byCat[t.categoria] = (byCat[t.categoria] || 0) + Number(t.valor || 0);
    });
    Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, val]) => {
        const pct = total ? (val / total) * 100 : 0;
        const row = document.createElement("div");
        row.style.marginBottom = "10px";
        row.innerHTML = `
          <div class="stat-row" style="border:none; padding:2px 0;"><span class="label">${cat}</span><span class="value">${formatCurrency(val)}</span></div>
          <div class="bar-bg"><div class="bar-fill financeiro" style="width:${pct}%"></div></div>
        `;
        el.appendChild(row);
      });
  }

  function renderMetas() {
    const el = document.getElementById("metas-list");
    el.innerHTML = "";
    if (DATA.financeiro.metas.length === 0) {
      el.innerHTML = `<div class="empty">Sem metas cadastradas. Edite dashboard/data.js.</div>`;
      return;
    }
    DATA.financeiro.metas.forEach((m) => {
      const pct = m.valorAlvo ? Math.min(100, (m.valorAtual / m.valorAlvo) * 100) : 0;
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "14px";
      wrap.innerHTML = `
        <div class="stat-row" style="border:none; padding:2px 0;"><span class="label">${m.descricao}</span><span class="value">${formatCurrency(m.valorAtual)} / ${formatCurrency(m.valorAlvo)}</span></div>
        <div class="bar-bg"><div class="bar-fill financeiro" style="width:${pct}%"></div></div>
      `;
      el.appendChild(wrap);
    });
  }

  function renderSheet() {
    const tbody = document.getElementById("sheet-body");
    tbody.innerHTML = "";
    const items = filteredTransacoes().sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    items.forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="date" value="${t.data || ""}" data-field="data" /></td>
        <td>
          <select data-field="tipo">
            <option value="receita" ${t.tipo === "receita" ? "selected" : ""}>Receita</option>
            <option value="despesa" ${t.tipo === "despesa" ? "selected" : ""}>Despesa</option>
          </select>
        </td>
        <td>
          <select data-field="categoria">
            ${CATEGORIAS.map((c) => `<option value="${c}" ${t.categoria === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </td>
        <td><input type="text" value="${t.descricao || ""}" data-field="descricao" placeholder="Descrição" /></td>
        <td><input type="text" value="${t.forma || ""}" data-field="forma" placeholder="Pix, cartão..." /></td>
        <td>
          <select data-field="status">
            <option value="pago" ${t.status === "pago" ? "selected" : ""}>Pago</option>
            <option value="pendente" ${t.status === "pendente" ? "selected" : ""}>Pendente</option>
          </select>
        </td>
        <td><input type="number" step="0.01" value="${t.valor ?? ""}" data-field="valor" /></td>
        <td><button class="row-remove" title="Remover">✕</button></td>
      `;

      tr.querySelectorAll("[data-field]").forEach((input) => {
        input.addEventListener("change", (e) => {
          const field = e.target.dataset.field;
          const value = field === "valor" ? Number(e.target.value) : e.target.value;
          const item = transacoes.find((x) => x.id === t.id);
          item[field] = value;
          saveTransacoes(transacoes);
          if (field === "data" || field === "tipo" || field === "valor") {
            populateMonthFilter();
            renderSummary();
            renderSheetTotal();
          }
        });
      });

      tr.querySelector(".row-remove").addEventListener("click", () => {
        transacoes = transacoes.filter((x) => x.id !== t.id);
        saveTransacoes(transacoes);
        populateMonthFilter();
        renderAll();
      });

      tbody.appendChild(tr);
    });

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">Nenhum lançamento neste período. Clique em "+ Novo lançamento".</td></tr>`;
    }

    renderSheetTotal();
  }

  function renderSheetTotal() {
    const items = filteredTransacoes();
    const receitas = sum(items.filter((t) => t.tipo === "receita"), "valor");
    const despesas = sum(items.filter((t) => t.tipo === "despesa"), "valor");
    document.getElementById("sheet-total").textContent =
      `Receitas ${formatCurrency(receitas)} · Despesas ${formatCurrency(despesas)} · Saldo ${formatCurrency(receitas - despesas)}`;
  }

  function renderAll() {
    renderSummary();
    renderSheet();
    renderMetas();
  }

  document.getElementById("add-row").addEventListener("click", () => {
    transacoes.push({
      id: uid(),
      data: new Date().toISOString().slice(0, 10),
      tipo: "despesa",
      categoria: CATEGORIAS[0],
      descricao: "",
      forma: "",
      status: "pendente",
      valor: 0,
    });
    saveTransacoes(transacoes);
    populateMonthFilter();
    renderAll();
  });

  document.getElementById("month-filter").addEventListener("change", () => {
    renderSummary();
    renderSheet();
  });

  document.getElementById("export-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(transacoes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "financeiro-lancamentos.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-json").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error("Formato inválido");
        transacoes = imported;
        saveTransacoes(transacoes);
        populateMonthFilter();
        renderAll();
      } catch (err) {
        alert("Arquivo JSON inválido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  populateMonthFilter();
  renderAll();
})();
