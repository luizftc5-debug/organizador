// Funções e utilidades compartilhadas entre as páginas do dashboard.

const NAV_ITEMS = [
  { id: "home", label: "Visão geral", icon: "◆", href: "index.html" },
  { id: "financeiro", label: "Financeiro", icon: "$", href: "financeiro.html" },
  { id: "faculdade", label: "Faculdade", icon: "▤", href: "faculdade.html" },
  { id: "projetos", label: "Projetos", icon: "◇", href: "projetos.html" },
];

function renderSidebar(activeId) {
  const el = document.getElementById("sidebar");
  if (!el) return;
  el.innerHTML = `
    <div class="brand">Organização Pessoal</div>
    <div class="brand-sub">Luiz · Medicina</div>
    ${NAV_ITEMS.map(
      (item) => `
      <a class="nav-item ${item.id === activeId ? "active" : ""}" href="${item.href}">
        <span class="nav-icon">${item.icon}</span>${item.label}
      </a>`
    ).join("")}
    <div class="sidebar-footer">
      Dados atualizados em<br />${formatDate(DATA.atualizadoEm)}
    </div>
  `;
}

function formatDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatCurrency(v) {
  return (v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: (DATA.financeiro && DATA.financeiro.moeda) || "BRL",
  });
}

function sum(list, field) {
  return list.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
}

function weekKey(iso) {
  const date = new Date(iso + "T00:00:00");
  const onejan = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${week}`;
}

// Todos os prazos/deadlines dos 3 pilares, unificados e ordenados.
function collectDeadlines() {
  const items = [];
  (DATA.faculdade.prazos || []).forEach((p) =>
    items.push({ desc: p.descricao, data: p.data, area: "faculdade" })
  );
  (DATA.faculdade.disciplinas || []).forEach((d) => {
    if (d.proximaAvaliacao) {
      items.push({ desc: `Avaliação: ${d.nome}`, data: d.proximaAvaliacao, area: "faculdade" });
    }
  });
  (DATA.projetos || []).forEach((p) => {
    if (p.deadline) {
      items.push({ desc: `Projeto: ${p.nome}`, data: p.deadline, area: "projetos" });
    }
  });
  return items.filter((i) => i.data).sort((a, b) => a.data.localeCompare(b.data));
}

function conflictGroups() {
  const items = collectDeadlines();
  const byWeek = {};
  items.forEach((i) => {
    const key = weekKey(i.data);
    byWeek[key] = byWeek[key] || [];
    byWeek[key].push(i);
  });
  return Object.values(byWeek).filter((group) => group.length > 1);
}

function renderAlerts(targetId) {
  const el = document.getElementById(targetId || "alerts");
  if (!el) return;
  el.innerHTML = "";
  conflictGroups().forEach((group) => {
    const div = document.createElement("div");
    div.className = "alert";
    div.innerHTML = `⚠ <span>Conflito de prazos na mesma semana: ${group
      .map((i) => `${i.desc} (${formatDate(i.data)})`)
      .join(" · ")}</span>`;
    el.appendChild(div);
  });
}

// ---------- Persistência local (planilha financeira) ----------
// Como o dashboard é estático (sem backend), os lançamentos financeiros
// digitados na planilha ficam salvos no localStorage do navegador.
// Use os botões de Exportar/Importar para levar os dados entre
// computadores ou fazer backup em dashboard/data.js.

const STORAGE_KEY_TRANSACOES = "organizador.financeiro.transacoes.v1";

function loadTransacoes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSACOES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Não foi possível ler o localStorage", e);
  }
  return seedTransacoesFromData();
}

function seedTransacoesFromData() {
  const items = [];
  (DATA.financeiro.receitasMes || []).forEach((r, i) =>
    items.push({
      id: `seed-r-${i}`,
      data: r.data,
      tipo: "receita",
      categoria: "Outros",
      descricao: r.descricao,
      valor: r.valor,
      forma: "",
      status: "pago",
    })
  );
  (DATA.financeiro.despesasMes || []).forEach((d, i) =>
    items.push({
      id: `seed-d-${i}`,
      data: d.data,
      tipo: "despesa",
      categoria: "Outros",
      descricao: d.descricao,
      valor: d.valor,
      forma: "",
      status: "pago",
    })
  );
  return items;
}

function saveTransacoes(list) {
  localStorage.setItem(STORAGE_KEY_TRANSACOES, JSON.stringify(list));
}
