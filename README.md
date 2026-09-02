# Organizador Pessoal

Painel para acompanhar três frentes ao mesmo tempo — **Financeiro**, **Faculdade** e **Projetos** —
com alerta automático quando prazos de áreas diferentes caem na mesma semana.

Aplicação estática: HTML, CSS e JavaScript puros, sem instalação e sem servidor de dados.

## Como abrir

**Online (recomendado):** <https://luizftc5-debug.github.io/organizador/dashboard/>

**No seu computador**, pela pasta `dashboard`:

```bash
python -m http.server 8000
```

E acesse <http://localhost:8000>.

> Abrir o arquivo direto (`file://`) funciona para tudo, **menos** o login do Google — ele exige
> `http://` ou `https://`.

## Como usar

Não é preciso editar nenhum arquivo. Tudo se cadastra pelos botões das telas:

| Onde | O que dá para fazer |
|---|---|
| **Visão geral** | Saldo, alertas de atraso e de semana cheia, agenda dos próximos 30 dias, leitura automática da situação |
| **Financeiro** | Lançar receitas e despesas (dizendo de qual conta ou cartão saíram), ver gastos por categoria e por mês, acompanhar metas |
| **Contas e cartões** | Cadastrar contas com saldo, cadastrar cartões com fechamento e vencimento, ver a fatura aberta e o balanço de cada um |
| **Faculdade** | Disciplinas, prazos e entregas. Cada disciplina abre em **página própria**, com avaliações e notas, prazos, materiais e resumos |
| **Projetos** | Só iniciativas pessoais que geram renda, divididas em etapas, com renda estimada e o que já foi faturado |

> Trabalhos da faculdade e o TCC ficam em **Faculdade**, não em Projetos.

### Como funcionam o saldo e a fatura

- O saldo de cada conta parte do valor informado no cadastro e se atualiza sozinho a cada lançamento.
- A fatura do cartão junta as compras do ciclo atual: compras feitas depois do dia do fechamento já
  entram na fatura seguinte.
- Para um lançamento entrar nesse balanço, escolha em **"Pago com"** de qual conta ou cartão ele saiu.

Excluiu algo sem querer? O aviso que aparece embaixo traz **Desfazer**.

### Onde ficam seus dados

No próprio navegador (localStorage) — nada é enviado para lugar nenhum. Consequência prática: os
dados ficam **naquele navegador, naquele computador**.

Para backup ou para usar em outro aparelho, clique em **Backup** na barra lateral:

- **Exportar** gera um arquivo `.json` com tudo
- **Importar** restaura esse arquivo em qualquer navegador

Vale exportar de tempos em tempos — limpar os dados de navegação do navegador apaga o que está salvo.

### Tema

O botão **Tema** alterna entre automático (segue o sistema), claro e escuro.

## Conectar ao Google Calendar e Drive

Opcional. Habilita ver os próximos eventos da agenda (Faculdade) e os arquivos recentes do Drive
(Financeiro).

1. Em <https://console.cloud.google.com/apis/credentials>, crie um projeto.
2. Em **APIs e serviços → Biblioteca**, ative **Google Calendar API** e **Google Drive API**.
3. Configure a **tela de consentimento OAuth** (tipo Externo) e adicione seu e-mail como usuário de teste.
4. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web** e, em
   *Origens JavaScript autorizadas*, informe a origem de onde você abre o painel — por exemplo
   `https://luizftc5-debug.github.io` ou `http://localhost:8000`.
5. Copie o Client ID e cole em `dashboard/config.js`, no lugar de `SEU_CLIENT_ID_AQUI`.

Se algo estiver faltando, o botão "Conectar ao Google" abre uma caixa dizendo exatamente o que
corrigir — inclusive mostrando a origem que precisa ser registrada.

## Estrutura

```
dashboard/
  index.html       home.js         visão geral
  financeiro.html  financeiro.js   lançamentos, gráficos e metas
  contas.html      contas.js       contas, cartões e balanço
  faculdade.html   faculdade.js    lista de disciplinas e prazos
  disciplina.html  disciplina.js   página de uma disciplina
  projetos.html    projetos.js     projetos de renda e oportunidades
  store.js                         dados: localStorage, CRUD e backup
  financas.js                      saldo por conta, fatura por cartão
  ui.js                            modais, avisos, gráficos, datas
  theme.css                        design system (claro/escuro)
  config.js        google-integration.js   integração com o Google
  data.js                          conteúdo inicial (lido só na 1ª abertura)
```

O arquivo `CLAUDE.md` traz as instruções do agente que acompanha este repositório.
