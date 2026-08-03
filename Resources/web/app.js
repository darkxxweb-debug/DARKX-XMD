// DarkX-Ultra - Web dashboard client logic (pairing + login/settings)

const socket = io();

// ---------- Light / dark theme toggle ----------
const THEME_KEY = "darkx_theme";
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeToggleIcon = document.getElementById("theme-toggle-icon");

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (themeToggleIcon) themeToggleIcon.textContent = "☀️";
  } else {
    document.documentElement.removeAttribute("data-theme");
    if (themeToggleIcon) themeToggleIcon.textContent = "🌙";
  }
}

const savedTheme = localStorage.getItem(THEME_KEY) ||
  (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applyTheme(savedTheme);

themeToggleBtn?.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

// ---------- Side menu (mobile toggle) ----------
const sideMenu = document.getElementById("side-menu");
const menuToggle = document.getElementById("menu-toggle");
const menuOverlay = document.getElementById("menu-overlay");

function openSideMenu() {
  sideMenu.classList.add("open");
  menuOverlay.classList.add("show");
}
function closeSideMenu() {
  sideMenu.classList.remove("open");
  menuOverlay.classList.remove("show");
}
menuToggle.addEventListener("click", () => {
  sideMenu.classList.contains("open") ? closeSideMenu() : openSideMenu();
});
menuOverlay.addEventListener("click", closeSideMenu);

// ---------- Tabs (top tabs + side menu both switch the same panels) ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const sideNavLinks = document.querySelectorAll(".side-link[data-nav]");
const panels = { pair: document.getElementById("panel-pair"), login: document.getElementById("panel-login") };

function switchTab(tab) {
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  sideNavLinks.forEach((b) => b.classList.toggle("active", b.dataset.nav === tab));
  Object.entries(panels).forEach(([key, p]) => p.classList.toggle("active", key === tab));
  closeSideMenu();
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});
sideNavLinks.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.nav));
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

// ---------- Persistent login (stay logged in, block back navigation) ----------
const SESSION_KEY = "darkx_session_token";
const SESSION_NUMBER_KEY = "darkx_session_number";
let historyLocked = false;

function saveSession(token, number) {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(SESSION_NUMBER_KEY, number);
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_NUMBER_KEY);
}

// Once logged in, trap the browser Back button so it can't step the user
// out of the logged-in view. The only way out is the Log out button.
function lockHistory() {
  if (historyLocked) return;
  historyLocked = true;
  history.pushState({ darkxLocked: true }, "", window.location.href);
  window.addEventListener("popstate", () => {
    if (historyLocked) {
      history.pushState({ darkxLocked: true }, "", window.location.href);
    }
  });
}
function unlockHistory() {
  historyLocked = false;
}

async function restoreSession() {
  const token = localStorage.getItem(SESSION_KEY);
  const number = localStorage.getItem(SESSION_NUMBER_KEY);
  if (!token || !number) return false;

  sessionToken = token;
  sessionNumber = number;
  try {
    await loadSettings();
    await loadSubscriptionStatus();
    switchTab("login");
    showStep("settings");
    lockHistory();
    return true;
  } catch (err) {
    // Session expired or invalid — fall back to a normal login.
    clearSession();
    sessionToken = null;
    sessionNumber = null;
    showStep("login");
    return false;
  }
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
    saveSession(sessionToken, sessionNumber);
    await loadSettings();
    await loadSubscriptionStatus();
    showStep("settings");
    lockHistory();

    // If this browser arrived via a referral link, attribute it once.
    const ref = localStorage.getItem("darkx_ref");
    if (ref) {
      fetch("/api/subscription/set-referrer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ ref }),
      }).catch(() => {});
      localStorage.removeItem("darkx_ref");
    }
  } catch (err) {
    loginStatus.textContent = `⚠️ ${err.message}`;
    showStep("login");
  } finally {
    verifyBtn.disabled = false;
  }
});

// ---------- Capture ?ref= from URL for referral attribution ----------
(() => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) localStorage.setItem("darkx_ref", ref.replace(/[^0-9]/g, ""));
})();

// ---------- Sub-nav (Settings / Voucher / Referral) ----------
const subnavButtons = document.querySelectorAll(".subnav-btn");
const subpanels = {
  settings: document.getElementById("sub-settings"),
  voucher: document.getElementById("sub-voucher"),
  referral: document.getElementById("sub-referral"),
};
subnavButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    subnavButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(subpanels).forEach((p) => p.classList.remove("active"));
    subpanels[btn.dataset.sub].classList.add("active");
  });
});

// ---------- Subscription status / plan badge ----------
const planBadge = document.getElementById("plan-badge");
const subStatusBox = document.getElementById("sub-status-box");
const refLinkInput = document.getElementById("ref-link");
const refInvited = document.getElementById("ref-invited");
const refBonusHours = document.getElementById("ref-bonus-hours");
const refBonusDays = document.getElementById("ref-bonus-days");

async function loadSubscriptionStatus() {
  try {
    const res = await fetch("/api/subscription/status", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load subscription status.");

    planBadge.textContent = data.planLabel.toUpperCase();
    planBadge.className = `plan-badge ${data.plan}`;

    if (data.plan === "starter") {
      subStatusBox.textContent = "You're on the free Starter plan — limited commands (.ping, .repo, .quran, .list, .yts) and 5-hour sessions. Subscribe below to unlock more.";
    } else {
      const expires = data.planExpiresAt ? new Date(data.planExpiresAt).toLocaleDateString() : "—";
      subStatusBox.textContent = `You're on the ${data.planLabel} plan. Renews/expires: ${expires}.`;
    }

    refLinkInput.value = `${window.location.origin}/?ref=${data.referralCode}`;
    refInvited.textContent = data.referralStats?.invited || 0;
    refBonusHours.textContent = data.referralStats?.freeBonusHoursEarned || 0;
    refBonusDays.textContent = data.referralStats?.paidBonusDaysEarned || 0;
  } catch (err) {
    subStatusBox.textContent = `⚠️ ${err.message}`;
  }
}

document.getElementById("ref-copy-btn").addEventListener("click", () => {
  refLinkInput.select();
  document.execCommand("copy");
});

// ---------- Subscription modal (its own window) ----------
const subscribeModal = document.getElementById("subscribe-modal");
const subscribeCloseBtn = document.getElementById("subscribe-close-btn");
const payPhoneInput = document.getElementById("pay-phone");
const verifyWhatsappBtn = document.getElementById("verify-whatsapp-btn");
const WHATSAPP_ADMIN_NUMBER = "255775710774";

function openSubscribeModal() {
  if (!sessionToken) {
    switchTab("login");
    loginStatus.textContent = "Please log in first, then open Subscribe.";
    return;
  }
  if (payPhoneInput && !payPhoneInput.value) payPhoneInput.value = sessionNumber || "";
  updateWhatsappVerifyLink();
  subscribeModal.classList.add("show");
  loadSubscriptionStatus();
  closeSideMenu();
}
function closeSubscribeModal() {
  subscribeModal.classList.remove("show");
}

document.getElementById("side-subscribe-btn").addEventListener("click", openSubscribeModal);
document.getElementById("topbar-subscribe-btn").addEventListener("click", openSubscribeModal);
document.getElementById("open-subscribe-modal-btn").addEventListener("click", openSubscribeModal);
subscribeCloseBtn.addEventListener("click", closeSubscribeModal);
subscribeModal.addEventListener("click", (e) => {
  if (e.target === subscribeModal) closeSubscribeModal();
});

function updateWhatsappVerifyLink() {
  const phone = (payPhoneInput?.value || sessionNumber || "").trim();
  const txref = document.getElementById("pay-txref")?.value.trim() || "";
  const planLabel = selectedPlan ? selectedPlan.toUpperCase() : "";
  let msg = "Nimelipia ila sijapokea package.";
  if (planLabel) msg += ` Package: ${planLabel}.`;
  if (phone) msg += ` Namba yangu: ${phone}.`;
  if (txref) msg += ` Muamala: ${txref}.`;
  verifyWhatsappBtn.href = `https://wa.me/${WHATSAPP_ADMIN_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// ---------- Package selection + payment submission ----------
let selectedPlan = null;
const payStep = document.getElementById("pay-step");
const subscribeStatus = document.getElementById("subscribe-status");

["pkg-lite", "pkg-pro"].forEach((id) => {
  document.getElementById(id).addEventListener("click", () => {
    document.querySelectorAll(".pkg-card").forEach((c) => c.classList.remove("selected"));
    document.getElementById(id).classList.add("selected");
    selectedPlan = id === "pkg-lite" ? "lite" : "pro";
    payStep.style.display = "block";
    if (payPhoneInput && !payPhoneInput.value) payPhoneInput.value = sessionNumber || "";
    updateWhatsappVerifyLink();
  });
});

document.getElementById("pay-txref").addEventListener("input", updateWhatsappVerifyLink);
if (payPhoneInput) payPhoneInput.addEventListener("input", updateWhatsappVerifyLink);

document.getElementById("pay-submit-btn").addEventListener("click", async () => {
  const payerNumber = payPhoneInput.value.trim();
  const transactionRef = document.getElementById("pay-txref").value.trim();
  if (!selectedPlan) return;
  if (!payerNumber) {
    subscribeStatus.textContent = "Please enter the phone number you paid from.";
    return;
  }
  if (!transactionRef) {
    subscribeStatus.textContent = "Please enter your transaction number.";
    return;
  }

  subscribeStatus.textContent = "Submitting...";
  try {
    const res = await fetch("/api/subscription/subscribe/request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ plan: selectedPlan, transactionRef, payerNumber }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit request.");
    subscribeStatus.textContent = "✅ " + data.message + " You can tap 'Verify Your Subscription' below to notify the admin on WhatsApp.";
    updateWhatsappVerifyLink();
  } catch (err) {
    subscribeStatus.textContent = `⚠️ ${err.message}`;
  }
});

// ---------- Voucher redeem ----------
document.getElementById("voucher-redeem-btn").addEventListener("click", async () => {
  const code = document.getElementById("voucher-code").value.trim();
  const voucherStatus = document.getElementById("voucher-status");
  if (!code) return;

  voucherStatus.textContent = "Checking...";
  try {
    const res = await fetch("/api/subscription/voucher/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid voucher.");
    voucherStatus.textContent = data.message;
    document.getElementById("voucher-code").value = "";
    await loadSubscriptionStatus();
  } catch (err) {
    voucherStatus.textContent = `⚠️ ${err.message}`;
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
  clearSession();
  unlockHistory();
  loginPhoneInput.value = "";
  verifyCodeInput.value = "";
  loginStatus.textContent = "";
  settingsStatus.textContent = "";
  showStep("login");
  switchTab("login");
});

// ---------- Admin dashboard ----------
const adminLink = document.getElementById("admin-link");
const adminModal = document.getElementById("admin-modal");
const adminDashboard = document.getElementById("admin-dashboard");
const adminPasswordInput = document.getElementById("admin-password");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminCancelBtn = document.getElementById("admin-cancel-btn");
const adminLoginError = document.getElementById("admin-login-error");
const adminCloseBtn = document.getElementById("admin-close-btn");

const adminSessionsList = document.getElementById("admin-sessions-list");
const banNumberInput = document.getElementById("ban-number-input");
const banBtn = document.getElementById("ban-btn");
const adminBannedList = document.getElementById("admin-banned-list");

const notifyImageInput = document.getElementById("notify-image");
const notifyMessageInput = document.getElementById("notify-message");
const notifySendBtn = document.getElementById("notify-send-btn");
const adminNotifyStatus = document.getElementById("admin-notify-status");

let adminToken = null;

function openAdminLogin(e) {
  e.preventDefault();
  adminPasswordInput.value = "";
  adminLoginError.textContent = "";
  adminModal.classList.add("show");
  closeSideMenu();
}
adminLink.addEventListener("click", openAdminLogin);
document.getElementById("bottom-admin-link")?.addEventListener("click", openAdminLogin);

adminCancelBtn.addEventListener("click", () => adminModal.classList.remove("show"));

adminLoginBtn.addEventListener("click", async () => {
  const password = adminPasswordInput.value;
  if (!password) return;

  adminLoginBtn.disabled = true;
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed.");

    adminToken = data.token;
    adminModal.classList.remove("show");
    adminDashboard.classList.add("show");
    await Promise.all([loadAdminSessions(), loadAdminBanned(), loadAdminTransactions(), loadAdminVouchers()]);
  } catch (err) {
    adminLoginError.textContent = err.message;
  } finally {
    adminLoginBtn.disabled = false;
  }
});

adminCloseBtn.addEventListener("click", () => adminDashboard.classList.remove("show"));

// ---------- Admin dashboard: tab / "window" switching ----------
function switchAdminTab(name) {
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.adminTab === name);
  });
  document.querySelectorAll(".admin-window").forEach((win) => {
    win.classList.toggle("active", win.id === `admin-window-${name}`);
  });
}
document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchAdminTab(btn.dataset.adminTab));
});

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function loadAdminSessions() {
  adminSessionsList.innerHTML = "Loading...";
  try {
    const { sessions } = await adminFetch("/api/admin/sessions");
    document.getElementById("stat-sessions").textContent = sessions.length;
    if (!sessions.length) {
      adminSessionsList.innerHTML = `<div class="admin-row"><span>No sessions yet.</span></div>`;
      return;
    }
    adminSessionsList.innerHTML = sessions
      .map(
        (s) => `
        <div class="admin-row">
          <span><span class="dot ${s.connected ? "online" : "offline"}"></span>${s.number} — ${s.botName || "DarkX-Ultra"} ${s.connected ? "(Online)" : "(Offline)"}</span>
          <button class="btn-danger" data-delete="${s.number}">Delete</button>
        </div>`
      )
      .join("");

    adminSessionsList.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(`Delete session ${btn.dataset.delete}? This cannot be undone.`)) return;
        btn.disabled = true;
        try {
          await adminFetch(`/api/admin/sessions/${btn.dataset.delete}`, { method: "DELETE" });
          await loadAdminSessions();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    adminSessionsList.innerHTML = `<div class="admin-row"><span>⚠️ ${err.message}</span></div>`;
  }
}

async function loadAdminBanned() {
  adminBannedList.innerHTML = "Loading...";
  try {
    const { banned } = await adminFetch("/api/admin/banned");
    document.getElementById("stat-banned").textContent = banned.length;
    if (!banned.length) {
      adminBannedList.innerHTML = `<div class="admin-row"><span>No banned numbers.</span></div>`;
      return;
    }
    adminBannedList.innerHTML = banned
      .map(
        (num) => `
        <div class="admin-row">
          <span>🚫 ${num}</span>
          <button class="btn-secondary" data-unban="${num}">Unban</button>
        </div>`
      )
      .join("");

    adminBannedList.querySelectorAll("[data-unban]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await adminFetch("/api/admin/unban", { method: "POST", body: JSON.stringify({ number: btn.dataset.unban }) });
          await loadAdminBanned();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    adminBannedList.innerHTML = `<div class="admin-row"><span>⚠️ ${err.message}</span></div>`;
  }
}

async function loadAdminTransactions() {
  const list = document.getElementById("admin-tx-list");
  list.innerHTML = "Loading...";
  try {
    const { transactions } = await adminFetch("/api/admin/transactions?status=pending");
    document.getElementById("stat-tx").textContent = transactions.length;
    if (!transactions.length) {
      list.innerHTML = `<div class="admin-row"><span>No pending transactions.</span></div>`;
      return;
    }
    list.innerHTML = transactions
      .map(
        (t) => `
        <div class="admin-row">
          <span>📱 ${t.number} — ${t.plan.toUpperCase()} (${t.amount} TSH)<br/><small>Paid from: ${t.payerNumber || t.number} · Ref: ${t.transactionRef}</small></span>
          <span>
            <button class="btn-secondary" data-approve="${t._id}">Approve</button>
            <button class="btn-danger" data-reject="${t._id}">Reject</button>
          </span>
        </div>`
      )
      .join("");

    list.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await adminFetch(`/api/admin/transactions/${btn.dataset.approve}/approve`, { method: "POST" });
          await loadAdminTransactions();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
    list.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await adminFetch(`/api/admin/transactions/${btn.dataset.reject}/reject`, { method: "POST" });
          await loadAdminTransactions();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="admin-row"><span>⚠️ ${err.message}</span></div>`;
  }
}

async function loadAdminVouchers() {
  const list = document.getElementById("admin-voucher-list");
  list.innerHTML = "Loading...";
  try {
    const { vouchers } = await adminFetch("/api/admin/vouchers");
    document.getElementById("stat-vouchers").textContent = vouchers.filter((v) => v.active).length;
    if (!vouchers.length) {
      list.innerHTML = `<div class="admin-row"><span>No vouchers yet.</span></div>`;
      return;
    }
    list.innerHTML = vouchers
      .map((v) => {
        const status = v.claimedBy
          ? `claimed by ${v.claimedBy}`
          : v.active
          ? "unclaimed"
          : "inactive";
        return `
        <div class="admin-row">
          <span>🎟️ ${v._id} — ${v.plan.toUpperCase()} / ${v.durationDays}d<br/><small>For: ${v.targetNumber || "—"} · Status: ${status}</small></span>
          ${v.active ? `<button class="btn-danger" data-deactivate="${v._id}">Deactivate</button>` : ""}
        </div>`;
      })
      .join("");

    list.querySelectorAll("[data-deactivate]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await adminFetch(`/api/admin/vouchers/${btn.dataset.deactivate}/deactivate`, { method: "POST" });
          await loadAdminVouchers();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="admin-row"><span>⚠️ ${err.message}</span></div>`;
  }
}

document.getElementById("voucher-generate-btn").addEventListener("click", async () => {
  const plan = document.getElementById("voucher-plan-select").value;
  const durationDays = document.getElementById("voucher-days-input").value || 30;
  const targetNumber = document.getElementById("voucher-target-input").value.trim();
  const btn = document.getElementById("voucher-generate-btn");
  if (!targetNumber) {
    alert("Please enter the recipient's number this voucher is being generated for.");
    return;
  }
  btn.disabled = true;
  try {
    const data = await adminFetch("/api/admin/vouchers", {
      method: "POST",
      body: JSON.stringify({ plan, durationDays, targetNumber }),
    });
    alert(`Voucher created for ${targetNumber}: ${data.voucher._id}`);
    document.getElementById("voucher-target-input").value = "";
    await loadAdminVouchers();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

banBtn.addEventListener("click", async () => {
  const number = banNumberInput.value.trim();
  if (!number) return;
  banBtn.disabled = true;
  try {
    await adminFetch("/api/admin/ban", { method: "POST", body: JSON.stringify({ number }) });
    banNumberInput.value = "";
    await loadAdminBanned();
  } catch (err) {
    alert(err.message);
  } finally {
    banBtn.disabled = false;
  }
});

notifySendBtn.addEventListener("click", async () => {
  const message = notifyMessageInput.value.trim();
  const imageUrl = notifyImageInput.value.trim();
  if (!message) {
    adminNotifyStatus.textContent = "Please write a message first.";
    return;
  }

  notifySendBtn.disabled = true;
  adminNotifyStatus.textContent = "Sending...";
  try {
    const data = await adminFetch("/api/admin/notify", {
      method: "POST",
      body: JSON.stringify({ message, imageUrl }),
    });
    adminNotifyStatus.textContent = `✅ Sent to ${data.sent}/${data.total} connected owner(s).`;
    notifyMessageInput.value = "";
    notifyImageInput.value = "";
  } catch (err) {
    adminNotifyStatus.textContent = `⚠️ ${err.message}`;
  } finally {
    notifySendBtn.disabled = false;
  }
});

// ---------- Public bug-report sidebar ----------
const reportBugBtn = document.getElementById("report-bug-btn");
const sideReportBugBtn = document.getElementById("side-report-bug-btn");
const bugSidebar = document.getElementById("bug-sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const bugCloseBtn = document.getElementById("bug-close-btn");
const bugNameInput = document.getElementById("bug-name");
const bugMessageInput = document.getElementById("bug-message");
const bugSubmitBtn = document.getElementById("bug-submit-btn");
const bugFormStatus = document.getElementById("bug-form-status");
const bugList = document.getElementById("bug-list");

function openBugSidebar() {
  bugSidebar.classList.add("open");
  sidebarOverlay.classList.add("show");
  loadBugReports();
  closeSideMenu();
}
function closeBugSidebar() {
  bugSidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
}

reportBugBtn.addEventListener("click", openBugSidebar);
sideReportBugBtn.addEventListener("click", openBugSidebar);
bugCloseBtn.addEventListener("click", closeBugSidebar);
sidebarOverlay.addEventListener("click", closeBugSidebar);

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function loadBugReports() {
  bugList.innerHTML = "Loading...";
  try {
    const res = await fetch("/api/bugs");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load reports.");

    if (!data.reports.length) {
      bugList.innerHTML = `<div class="bug-empty">No bug reports yet. Be the first!</div>`;
      return;
    }

    bugList.innerHTML = data.reports
      .map(
        (r) => `
        <div class="bug-item">
          <span class="bug-name">${r.name}</span>
          <span class="bug-time">${timeAgo(r.createdAt)}</span>
          <div class="bug-msg">${r.message}</div>
        </div>`
      )
      .join("");
  } catch (err) {
    bugList.innerHTML = `<div class="bug-empty">⚠️ ${err.message}</div>`;
  }
}

bugSubmitBtn.addEventListener("click", async () => {
  const message = bugMessageInput.value.trim();
  if (!message) {
    bugFormStatus.textContent = "Please describe the bug first.";
    return;
  }

  bugSubmitBtn.disabled = true;
  bugFormStatus.textContent = "Submitting...";

  try {
    const res = await fetch("/api/bugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bugNameInput.value.trim(), message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit.");

    bugFormStatus.textContent = "✅ Thank you! Your report was posted.";
    bugMessageInput.value = "";
    await loadBugReports();
  } catch (err) {
    bugFormStatus.textContent = `⚠️ ${err.message}`;
  } finally {
    bugSubmitBtn.disabled = false;
  }
});

// ---------- On page load: restore an existing session if there is one ----------
updateWhatsappVerifyLink();
restoreSession();
