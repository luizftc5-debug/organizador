/* ===========================================================================
   Conteúdo inicial (seed) do painel.

   ATENÇÃO: este arquivo é lido UMA ÚNICA VEZ — na primeira vez que você abre o
   dashboard num navegador. Depois disso, tudo que você cadastra pelas telas
   fica salvo no próprio navegador, e este arquivo deixa de ser consultado.

   Ou seja: para o uso do dia a dia, NÃO é preciso editar nada aqui. Use os
   botões "+ Lançamento", "+ Prazo", "+ Disciplina", "+ Projeto" nas páginas.
   Para backup ou para levar os dados a outro computador, use o botão "Backup"
   na barra lateral (exporta e importa um arquivo .json com tudo).

   Preencha abaixo apenas se quiser que um navegador novo já comece com dados.
   Datas no formato "AAAA-MM-DD".
   =========================================================================== */

const DATA = {
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
      "Renda",
      "Outros",
    ],
    receitasMes: [
      // { descricao: "Bolsa de iniciação científica", valor: 700, data: "2026-09-05", categoria: "Renda" }
    ],
    despesasMes: [
      // { descricao: "Transporte para o hospital", valor: 180, data: "2026-09-10", categoria: "Transporte" }
    ],
    metas: [
      // { descricao: "Reserva de emergência", valorAlvo: 3000, valorAtual: 500, prazo: "2026-12-31" }
    ],
  },

  faculdade: {
    disciplinas: [
      // { nome: "Clínica Médica", status: "ativa", professor: "", nota: null, proximaAvaliacao: "2026-09-15" }
    ],
    prazos: [
      // { descricao: "Entrega da metanálise", data: "2026-11-30", tipo: "TCC", concluido: false }
    ],
  },

  projetos: [
    // {
    //   nome: "Metanálise — TCC",
    //   status: "em andamento",
    //   descricao: "Revisão sistemática com a Dra. …",
    //   deadline: "2026-11-30",
    //   passos: [
    //     { texto: "Busca nas bases", feito: true },
    //     { texto: "Extração de dados", feito: false },
    //   ],
    // },
  ],

  oportunidades: [
    // { descricao: "Monitoria de fisiologia", area: "Faculdade + Financeiro", potencial: "R$ 600/mês", esforco: "médio" }
  ],
};
