# Organizador Pessoal - Luiz

Repositório de apoio ao agente de organização pessoal descrito em [`CLAUDE.md`](./CLAUDE.md), cobrindo os três pilares: **Financeiro**, **Faculdade** e **Projetos**.

## Dashboard

Um dashboard estático multi-página fica em [`dashboard/`](./dashboard/):

- `dashboard/index.html` — visão geral dos 3 pilares, com alertas de conflito de prazos
- `dashboard/financeiro.html` — planilha completa de receitas/despesas por categoria, gráfico de gastos, metas e documentos do Google Drive
- `dashboard/faculdade.html` — disciplinas, prazos, provas e agenda do Google Calendar
- `dashboard/projetos.html` — status, próximos passos e deadlines dos projetos + oportunidades de renda
- `dashboard/data.js` — dados fixos (seed) editáveis: disciplinas, prazos, projetos, oportunidades
- `dashboard/config.js` — configuração da integração com Google (Client ID)
- `dashboard/shared.css` / `dashboard/shared.js` — estilos e utilidades compartilhadas
- `dashboard/google-integration.js` — login e chamadas às APIs do Google Calendar/Drive

### Como rodar

O login do Google **não funciona** abrindo o arquivo diretamente (`file://`). Rode um servidor local simples:

```bash
cd dashboard
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador.

> Sem a integração Google configurada, o dashboard funciona normalmente — só os blocos "Google Calendar"/"Google Drive" ficam vazios/desconectados.

### Preenchendo os dados

- **Financeiro**: abra `financeiro.html` e use a planilha interativa (botão "+ Novo lançamento"). Os lançamentos ficam salvos no `localStorage` do navegador. Use "Exportar (JSON)" para fazer backup e "Importar (JSON)" para restaurar/migrar entre computadores.
- **Faculdade** e **Projetos**: edite `dashboard/data.js` com suas disciplinas, prazos, projetos e oportunidades.

O painel destaca automaticamente conflitos de prazos (ex.: prova e deadline de projeto na mesma semana).

### Conectando ao Google Calendar e Drive

1. Acesse [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) e crie um projeto.
2. Configure a "Tela de consentimento OAuth" (tipo Externo, adicione seu e-mail como usuário de teste).
3. Em "Credenciais" → "Criar credenciais" → "ID do cliente OAuth":
   - Tipo: **Aplicativo da Web**
   - Origem JavaScript autorizada: `http://localhost:8000` (ou a porta que você usar)
4. Em "APIs e serviços" → "Biblioteca", ative **Google Calendar API** e **Google Drive API**.
5. Copie o Client ID gerado e cole em `dashboard/config.js` (`GOOGLE_CONFIG.CLIENT_ID`).
6. Abra o dashboard via `http://localhost:8000` e clique em "Conectar ao Google" nas páginas Faculdade/Financeiro.

## Próximos passos sugeridos

- Preencher `dashboard/data.js` com disciplinas, prazos e projetos reais.
- Preencher a planilha financeira em `financeiro.html`.
- Configurar o Client ID do Google para ativar Calendar/Drive.
- Manter os dados atualizados conforme novas informações forem compartilhadas com o agente.
