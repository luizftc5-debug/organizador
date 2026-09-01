// Integração com Google Calendar e Google Drive via OAuth (client-side).
//
// Requisitos para funcionar:
// 1. Preencha GOOGLE_CONFIG.CLIENT_ID em config.js (veja instruções lá)
// 2. Abra o dashboard via servidor local (http://localhost:...), não como
//    arquivo file:// — o Google não permite login OAuth em páginas file://
//
// Depois de conectado, busca os próximos eventos do Calendar e os arquivos
// recentes do Drive e injeta nos elementos com id #google-calendar-list e
// #google-drive-list (quando existirem na página).

let gapiInited = false;
let gisInited = false;
let tokenClient = null;
let accessToken = null;

function updateGoogleStatus(connected) {
  const el = document.getElementById("google-status");
  if (!el) return;
  if (connected) {
    el.textContent = "● Conectado ao Google";
    el.classList.add("connected");
  } else {
    el.textContent = "○ Não conectado ao Google";
    el.classList.remove("connected");
  }
}

function isClientIdConfigured() {
  return (
    typeof GOOGLE_CONFIG !== "undefined" &&
    GOOGLE_CONFIG.CLIENT_ID &&
    !GOOGLE_CONFIG.CLIENT_ID.startsWith("SEU_CLIENT_ID")
  );
}

function initGapiClient() {
  gapi.client
    .init({})
    .then(() => {
      return Promise.all([
        gapi.client.load("https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"),
        gapi.client.load("https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"),
      ]);
    })
    .then(() => {
      gapiInited = true;
    });
}

function onGapiLoad() {
  gapi.load("client", initGapiClient);
}

function onGisLoad() {
  if (!isClientIdConfigured()) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CONFIG.CLIENT_ID,
    scope: GOOGLE_CONFIG.SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error("Erro de autenticação Google", resp);
        return;
      }
      accessToken = resp.access_token;
      updateGoogleStatus(true);
      fetchCalendarEvents();
      fetchDriveFiles();
    },
  });
  gisInited = true;
}

function connectGoogle() {
  if (!isClientIdConfigured()) {
    alert(
      "Configure o CLIENT_ID em dashboard/config.js antes de conectar. Veja as instruções nesse arquivo."
    );
    return;
  }
  if (!gapiInited || !gisInited) {
    alert("Bibliotecas do Google ainda carregando, tente novamente em alguns segundos.");
    return;
  }
  tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
}

function fetchCalendarEvents() {
  const el = document.getElementById("google-calendar-list");
  if (!el) return;
  gapi.client.calendar.events
    .list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 10,
      orderBy: "startTime",
    })
    .then((resp) => {
      const events = resp.result.items || [];
      if (events.length === 0) {
        el.innerHTML = `<div class="empty">Nenhum evento futuro encontrado.</div>`;
        return;
      }
      const ul = document.createElement("ul");
      ul.className = "list";
      events.forEach((ev) => {
        const start = ev.start.dateTime || ev.start.date;
        const li = document.createElement("li");
        li.innerHTML = `<span>${ev.summary || "(sem título)"}</span><span class="date">${new Date(
          start
        ).toLocaleString("pt-BR")}</span>`;
        ul.appendChild(li);
      });
      el.innerHTML = "";
      el.appendChild(ul);
    })
    .catch((err) => {
      el.innerHTML = `<div class="empty">Erro ao buscar eventos do Calendar.</div>`;
      console.error(err);
    });
}

function fetchDriveFiles() {
  const el = document.getElementById("google-drive-list");
  if (!el) return;
  gapi.client.drive.files
    .list({
      pageSize: 10,
      orderBy: "modifiedTime desc",
      fields: "files(id, name, modifiedTime, webViewLink, iconLink)",
    })
    .then((resp) => {
      const files = resp.result.files || [];
      if (files.length === 0) {
        el.innerHTML = `<div class="empty">Nenhum arquivo encontrado.</div>`;
        return;
      }
      const ul = document.createElement("ul");
      ul.className = "list";
      files.forEach((f) => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="${f.webViewLink}" target="_blank" rel="noopener">${f.name}</a><span class="date">${new Date(
          f.modifiedTime
        ).toLocaleDateString("pt-BR")}</span>`;
        ul.appendChild(li);
      });
      el.innerHTML = "";
      el.appendChild(ul);
    })
    .catch((err) => {
      el.innerHTML = `<div class="empty">Erro ao buscar arquivos do Drive.</div>`;
      console.error(err);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  updateGoogleStatus(false);
  const btn = document.getElementById("google-connect-btn");
  if (btn) btn.addEventListener("click", connectGoogle);
});
