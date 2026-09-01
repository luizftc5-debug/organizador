// Configuração da integração com o Google (Calendar + Drive).
//
// Como obter o CLIENT_ID:
// 1. Acesse https://console.cloud.google.com/apis/credentials
// 2. Crie um projeto (ou use um existente)
// 3. Em "Tela de consentimento OAuth", configure como "Externo" e adicione seu
//    e-mail como usuário de teste
// 4. Em "Credenciais" → "Criar credenciais" → "ID do cliente OAuth"
//    - Tipo de aplicativo: "Aplicativo da Web"
//    - Em "Origens JavaScript autorizadas", adicione a URL que você usa para
//      abrir o dashboard, por exemplo: http://localhost:8000
//      (IMPORTANTE: login do Google NÃO funciona abrindo o arquivo direto
//      com file:// — veja o README para rodar um servidor local simples)
// 5. Copie o "Client ID" gerado e cole abaixo
// 6. Em "APIs e serviços" → "Biblioteca", ative:
//    - Google Calendar API
//    - Google Drive API

const GOOGLE_CONFIG = {
  CLIENT_ID: "SEU_CLIENT_ID_AQUI.apps.googleusercontent.com",
  SCOPES: [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
  ].join(" "),
};
