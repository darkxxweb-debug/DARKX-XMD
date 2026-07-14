// DarkX-Ultra - Web dashboard client logic (pairing + login/settings)

const socket = io();

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = { pair: document.getElementById("panel-pair"), login: document.getElementById("panel-login") };

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(panels).forEach((p) => p.classList.remove("active"));
    panels[btn.dataset.tab].classList.add("active");
  });
});

// ---------- Panel 1: Pairing ----------
const phoneInput = document.getElementById("phone");
const pairBtn = document.getElementById("pair-btn");
const statusEl = document.getElementById("status");
const codeBox = document.getElementById("code-box");
const codeEl = document.getElementById("pairing-code");

pairBtn.addEventListener("click", () => {
  const number = phoneInput.value.trim();
  if (!number) {
    statusEl.textContent = "Please type your WhatsApp number first.";
    return;
  }
  pairBtn.disabled = true;
  statusEl.textContent = "✨ Connecting to DarkX-Ultra, please wait...";
  codeBox.style.display = "none";
  socket.emit("pair-request", number);
});

socket.on("status", (data) => { statusEl.textContent = data.message; });
socket.on("pairing-code", (data) => {
  statusEl.textContent = `Code generated for ${data.number}`;
  codeEl.textContent = data.code;
  codeBox.style.display = "block";
  pairBtn.disabled = false;
});
socket.on("pairing-error", (data) => {
  statusEl.textContent = `⚠️ ${data.error}`;
  pairBtn.disabled = false;
});
socket.on("connected", (data) => {
  statusEl.textContent = `⚡ Number ${data.number} is now connected and online!`;
  codeBox.style.display = "none";
  pairBtn.disabled = false;
});
socket.on("disconnected", (data) => {
  statusEl.textContent = `Number ${data.number} got disconnected. ${data.willReconnect ? "Reconnecting..." : "Please pair again."}`;
});

// ---------- Panel 2: Login + Settings ----------
const loginStep = document.getElementById("login-step");
const verifyStep = document.getElementById("verify-step");
const settingsStep = document.getElementById("settings-step");

const loginPhoneInput = document.getElementById("login-phone");
const requestCodeBtn = document.getElementById("request-code-btn");
const loginStatus = document.getElementById("login-status");

const verifyCodeInput = document.getElementById("verify-code");
const verifyBtn = document.getElementById("verify-btn");
const backToLoginBtn = document.getElementById("back-to-login");

const saveSettingsBtn = document.getElementById("save-settings-btn");
const logoutBtn = document.getElementById("logout-btn");
const settingsStatus = document.getElementById("settings-status");

let sessionToken = null;
let sessionNumber = null;

function showStep(step) {
  loginStep.style.display = step === "login" ? "block" : "none";
  verifyStep.style.display = step === "verify" ? "block" : "none";
  settingsStep.style.display = step === "settings" ? "block" : "none";
}

requestCodeBtn.addEventListener("click", async () => {
  const number = loginPhoneInput.value.trim();
  if (!number) {
    loginStatus.textContent = "Please type your WhatsApp number first.";
    return;
  }
  requestCodeBtn.disabled = true;
  loginStatus.textContent = "Sending verification code...";

  try {
    const res = await fetch("/api/login/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send code.");

    sessionNumber = number;
    loginStatus.textContent = "✅ Code sent! Check your WhatsApp.";
    showStep("verify");
  } catch (err) {
    loginStatus.textContent = `⚠️ ${err.message}`;
  } finally {
    requestCodeBtn.disabled = false;
  }
});

backToLoginBtn.addEventListener("click", () => {
  showStep("login");
  loginStatus.textContent = "";
});

verifyBtn.addEventListener("click", async () => {
  const code = verifyCodeInput.value.trim();
  if (!code) return;

  verifyBtn.disabled = true;
  try {
    const res = await fetch("/api/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: sessionNumber, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid code.");

    sessionToken = data.token;
    await loadSettings();
    showStep("settings");
  } catch (err) {
    loginStatus.textContent = `⚠️ ${err.message}`;
    showStep("login");
  } finally {
    verifyBtn.disabled = false;
  }
});

async function loadSettings() {
  const res = await fetch("/api/settings", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load settings.");

  const s = data.settings;
  document.getElementById("s-botName").value = s.botName || "";
  document.getElementById("s-ownerName").value = s.ownerName || "";
  document.getElementById("s-ownerNumber").value = s.ownerNumber || "";
  document.getElementById("s-prefix").value = s.prefix || ".";
  document.getElementById("s-statusEmojis").value = (s.statusEmojis || []).join(", ");
  document.getElementById("s-chatEmojis").value = (s.chatEmojis || []).join(", ");
  document.getElementById("s-antilink").checked = !!s.antilink;
  document.getElementById("s-antidelete").checked = !!s.antidelete;
  document.getElementById("s-autoViewStatus").checked = !!s.autoViewStatus;
  document.getElementById("s-autoReactStatus").checked = !!s.autoReactStatus;
  document.getElementById("s-autoReadChat").checked = !!s.autoReadChat;
  document.getElementById("s-autoReactChat").checked = !!s.autoReactChat;
  document.getElementById("s-autoTyping").checked = !!s.autoTyping;
  document.getElementById("s-autoRecording").checked = !!s.autoRecording;
}

saveSettingsBtn.addEventListener("click", async () => {
  saveSettingsBtn.disabled = true;
  settingsStatus.textContent = "Saving...";

  const payload = {
    botName: document.getElementById("s-botName").value.trim(),
    ownerName: document.getElementById("s-ownerName").value.trim(),
    ownerNumber: document.getElementById("s-ownerNumber").value.trim(),
    prefix: document.getElementById("s-prefix").value.trim() || ".",
    statusEmojis: document.getElementById("s-statusEmojis").value,
    chatEmojis: document.getElementById("s-chatEmojis").value,
    antilink: document.getElementById("s-antilink").checked,
    antidelete: document.getElementById("s-antidelete").checked,
    autoViewStatus: document.getElementById("s-autoViewStatus").checked,
    autoReactStatus: document.getElementById("s-autoReactStatus").checked,
    autoReadChat: document.getElementById("s-autoReadChat").checked,
    autoReactChat: document.getElementById("s-autoReactChat").checked,
    autoTyping: document.getElementById("s-autoTyping").checked,
    autoRecording: document.getElementById("s-autoRecording").checked,
  };

  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save settings.");
    settingsStatus.textContent = "✅ Settings saved!";
  } catch (err) {
    settingsStatus.textContent = `⚠️ ${err.message}`;
  } finally {
    saveSettingsBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => {
  sessionToken = null;
  sessionNumber = null;
  loginPhoneInput.value = "";
  verifyCodeInput.value = "";
  loginStatus.textContent = "";
  settingsStatus.textContent = "";
  showStep("login");
});
