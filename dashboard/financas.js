/* ===========================================================================
   Finanças — cálculos derivados de contas, cartões e lançamentos.

   Nada aqui guarda estado: tudo é calculado a partir dos lançamentos salvos,
   para que saldo e fatura nunca fiquem fora de sincronia com a planilha.
   =========================================================================== */

const Financas = (() => {
  const TIPOS_CONTA = ["corrente", "poupança", "investimento", "dinheiro"];
  const BANDEIRAS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outra"];

  const contas = () => Store.lista("financeiro.contas");
  const cartoes = () => Store.lista("financeiro.cartoes");
  const transacoes = () => Store.lista("financeiro.transacoes");

  /* ------------------------- Origem de um lançamento ---------------------- */
  // Guardada como "conta:<id>" ou "cartao:<id>" — um único campo no lançamento.

  function partesOrigem(origem) {
    if (!origem || typeof origem !== "string") return { tipo: "", id: "" };
    const [tipo, id] = origem.split(":");
    return { tipo: tipo || "", id: id || "" };
  }

  function nomeOrigem(origem) {
    const { tipo, id } = partesOrigem(origem);
    if (!tipo) return "";
    const item = (tipo === "conta" ? contas() : cartoes()).find((x) => x.id === id);
    return item ? item.nome : "(removido)";
  }

  // Opções para o campo "Pago com" do formulário de lançamento.
  function opcoesOrigem() {
    const opcoes = [{ valor: "", rotulo: "— não informado —" }];
    contas().forEach((c) => opcoes.push({ valor: `conta:${c.id}`, rotulo: `${c.nome} (${c.tipo})` }));
    cartoes().forEach((c) => opcoes.push({ valor: `cartao:${c.id}`, rotulo: `${c.nome} (cartão)` }));
    return opcoes;
  }

  function lancamentosDe(origem) {
    return transacoes().filter((t) => t.origem === origem);
  }

  /* -------------------------------- Contas -------------------------------- */

  /**
   * Saldo de uma conta = saldo informado na abertura + receitas − despesas
   * lançadas nela. Despesas no cartão não entram aqui: elas entram quando a
   * fatura é lançada como despesa da conta.
   */
  function saldoConta(conta) {
    const chave = `conta:${conta.id}`;
    return lancamentosDe(chave).reduce(
      (soma, t) => soma + (t.tipo === "receita" ? 1 : -1) * (Number(t.valor) || 0),
      Number(conta.saldoInicial) || 0
    );
  }

  /**
   * Soma das contas cadastradas. Enquanto não houver nenhuma conta, vale o
   * saldo informado à mão na visão geral (compatível com quem já usava assim).
   */
  function saldoTotal() {
    const lista = contas();
    if (!lista.length) return Number(Store.estado().financeiro.saldoAtual) || 0;
    return lista.reduce((soma, c) => soma + saldoConta(c), 0);
  }

  const temContas = () => contas().length > 0;

  /* -------------------------------- Cartões -------------------------------- */

  function ultimoDiaDoMes(ano, mes) {
    return new Date(ano, mes + 1, 0).getDate();
  }

  function iso(ano, mes, dia) {
    const d = Math.min(dia, ultimoDiaDoMes(ano, mes));
    return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  /**
   * Ciclo da fatura aberta de um cartão.
   * Compras feitas depois do fechamento entram na fatura seguinte, que é a
   * regra usual dos cartões brasileiros.
   */
  function cicloAtual(cartao, hoje = new Date()) {
    const fechamento = Number(cartao.fechamento) || 1;
    const vencimento = Number(cartao.vencimento) || fechamento;
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const dia = hoje.getDate();

    // Se já passou o fechamento deste mês, o ciclo aberto é o do mês seguinte.
    const mesFim = dia > fechamento ? mes + 1 : mes;
    const fim = new Date(ano, mesFim, Math.min(fechamento, ultimoDiaDoMes(ano, mesFim)));
    const inicioBase = new Date(fim);
    inicioBase.setMonth(inicioBase.getMonth() - 1);
    inicioBase.setDate(inicioBase.getDate() + 1);

    // O vencimento cai depois do fechamento — no mês seguinte quando o dia de
    // vencimento é menor ou igual ao de fechamento.
    const mesVenc = vencimento > fechamento ? fim.getMonth() : fim.getMonth() + 1;

    return {
      inicio: iso(inicioBase.getFullYear(), inicioBase.getMonth(), inicioBase.getDate()),
      fim: iso(fim.getFullYear(), fim.getMonth(), fim.getDate()),
      vencimento: iso(fim.getFullYear(), mesVenc, vencimento),
    };
  }

  /** Fatura aberta: despesas do cartão dentro do ciclo atual. */
  function faturaCartao(cartao, hoje = new Date()) {
    const ciclo = cicloAtual(cartao, hoje);
    const itens = lancamentosDe(`cartao:${cartao.id}`).filter(
      (t) => t.tipo === "despesa" && t.data >= ciclo.inicio && t.data <= ciclo.fim
    );
    const total = itens.reduce((s, t) => s + (Number(t.valor) || 0), 0);
    const limite = Number(cartao.limite) || 0;
    return {
      ciclo,
      itens,
      total,
      limite,
      disponivel: limite ? Math.max(limite - total, 0) : null,
      usoPercentual: limite ? Math.min((total / limite) * 100, 100) : null,
    };
  }

  /** Total já gasto no cartão em qualquer período (para o balanço geral). */
  function gastoTotalCartao(cartao) {
    return lancamentosDe(`cartao:${cartao.id}`)
      .filter((t) => t.tipo === "despesa")
      .reduce((s, t) => s + (Number(t.valor) || 0), 0);
  }

  /* ------------------------------ Balanço geral ---------------------------- */

  /** Uma linha por conta e por cartão, para a página de balanço. */
  function balanco(hoje = new Date()) {
    return {
      contas: contas().map((c) => ({
        ...c,
        kind: "conta",
        saldo: saldoConta(c),
        movimentos: lancamentosDe(`conta:${c.id}`).length,
      })),
      cartoes: cartoes().map((c) => {
        const f = faturaCartao(c, hoje);
        return { ...c, kind: "cartao", fatura: f.total, ciclo: f.ciclo, limite: f.limite, disponivel: f.disponivel, usoPercentual: f.usoPercentual, movimentos: f.itens.length };
      }),
    };
  }

  /** Lançamentos sem conta/cartão informado — ficam de fora do balanço. */
  function semOrigem() {
    return transacoes().filter((t) => !t.origem);
  }

  return {
    TIPOS_CONTA, BANDEIRAS,
    partesOrigem, nomeOrigem, opcoesOrigem, lancamentosDe,
    saldoConta, saldoTotal, temContas,
    cicloAtual, faturaCartao, gastoTotalCartao,
    balanco, semOrigem,
  };
})();
