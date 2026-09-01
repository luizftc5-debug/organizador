// Dados do painel de organização pessoal de Luiz.
//
// Este arquivo serve como "seed" inicial (financeiro.html usa a planilha
// interativa salva no navegador, mas parte destes dados no primeiro uso).
// Edite manualmente ou peça ao agente para atualizar conforme novas
// informações forem compartilhadas.
//
// Datas no formato "AAAA-MM-DD".

const DATA = {
  atualizadoEm: "2026-09-01",

  financeiro: {
    saldoAtual: 0,
    moeda: "BRL",
    categorias: [
      "Moradia",
      "Alimentação",
      "Transporte",
      "Saúde",
      "Educação",
      "Lazer",
      "Assinaturas",
      "Renda (side hustle)",
      "Outros",
    ],
    receitasMes: [
      // { descricao: "Bolsa de iniciação científica", valor: 0, data: "2026-09-05" }
    ],
    despesasMes: [
      // { descricao: "Aluguel/contas", valor: 0, data: "2026-09-10" }
    ],
    metas: [
      // { descricao: "Reserva de emergência", valorAlvo: 0, valorAtual: 0, prazo: "2026-12-31" }
    ],
  },

  faculdade: {
    disciplinas: [
      // { nome: "Clínica Médica", status: "ativa", nota: null, proximaAvaliacao: "2026-09-15" }
    ],
    prazos: [
      // { descricao: "Entrega do TCC (metanálise)", data: "2026-11-30", tipo: "tcc" }
    ],
  },

  projetos: [
    // {
    //   nome: "Metanálise - TCC",
    //   status: "em andamento",
    //   proximoPasso: "Extração de dados dos estudos incluídos",
    //   deadline: "2026-11-30",
    // },
  ],

  oportunidades: [
    // { descricao: "Curso online sobre metodologia de revisão sistemática", area: "Faculdade + Financeiro" }
  ],
};
