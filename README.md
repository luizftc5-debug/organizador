# Organizador Pessoal - Luiz

Repositório de apoio ao agente de organização pessoal descrito em [`CLAUDE.md`](./CLAUDE.md), cobrindo os três pilares: **Financeiro**, **Escola** e **Projetos**.

## Dashboard

Um dashboard estático fica em [`dashboard/`](./dashboard/):

- `dashboard/index.html` — página do painel (visões: Status, Próximos passos, Oportunidades, Análise financeira)
- `dashboard/data.js` — dados editáveis (comece aqui para preencher suas informações)
- `dashboard/app.js` — lógica de renderização e detecção de conflitos de prazos
- `dashboard/style.css` — estilos

### Como usar

1. Edite `dashboard/data.js` com seus dados reais (financeiro, disciplinas, prazos, projetos, oportunidades).
2. Abra `dashboard/index.html` diretamente no navegador (não depende de servidor, pois os dados são carregados via `<script>`).

O painel destaca automaticamente conflitos de prazos (ex.: prova e deadline de projeto na mesma semana) e calcula totais de receitas/despesas/metas a partir dos dados informados.

## Próximos passos sugeridos

- Conectar integrações reais (Google Calendar, Google Drive, Gmail, GitHub) quando disponíveis, e usar o agente para sincronizar `dashboard/data.js` automaticamente.
- Manter `dashboard/data.js` atualizado conforme novas informações forem compartilhadas com o agente.
