// DarkX Ultimate - standalone Admin panel client logic
// Same REST endpoints as the main dashboard's admin block, now running on
// its own full-screen page (reached via its own link, e.g. /admin.html).

// ---------- Light / dark theme (shares the same saved preference as the main panel) ----------
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

// ---------- Login screen <-> Dashboard ----------
const loginScreen = document.getElementById("admin-login-screen");
const adminApp = document.getElementById("admin-app");
const adminPasswordInput = document.getElementById("admin-password");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminLoginError = document.getElementById("admin-login-error");
const adminLogoutBtn = document.getElementById("admin-logout-btn");

const adminSessionsList = document.getElementById("admin-sessions-list");
const banNumberInput = document.getElementById("ban-number-input");
const banBtn = document.getElementById("ban-btn");
const adminBannedList = document.getElementById("admin-banned-list");

const notifyImageInput = document.getElementById("notify-image");
const notifyMessageInput = document.getElementById("notify-message");
const notifySendBtn = document.getElementById("notify-send-btn");
const adminNotifyStatus = document.getElementById("admin-notify-status");

const channelImageInput = document.getElementById("channel-image");
const channelTextInput = document.getElementById("channel-text");
const channelSendBtn = document.getElementById("channel-send-btn");
const adminChannelStatus = document.getElementById("admin-channel-status");

const ADMIN_TOKEN_KEY = "darkx_admin_token";
let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);

function showDashboard() {
  loginScreen.classList.add("hidden");
  adminApp.classList.add("show");
  Promise.all([loadAdminSessions(), loadAdminBanned(), loadAdminTransactions(), loadAdminVouchers()]);
}
function showLogin() {
  adminApp.classList.remove("show");
  loginScreen.classList.remove("hidden");
  adminPasswordInput.value = "";
  adminLoginError.textContent = "";
}

// If a token from an earlier session is still around, skip straight to the dashboard.
if (adminToken) showDashboard();

adminLoginBtn.addEventListener("click", doAdminLogin);
adminPasswordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdminLogin(); });

async function doAdminLogin() {
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
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    showDashboard();
  } catch (err) {
    adminLoginError.textContent = err.message;
  } finally {
    adminLoginBtn.disabled = false;
  }
}

adminLogoutBtn.addEventListener("click", () => {
  adminToken = null;
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  showLogin();
});

// ---------- Sidebar tab / "window" switching ----------
const pageMeta = {
  sessions: ["Sessions", "Connected and offline WhatsApp sessions"],
  banned: ["Banned Numbers", "Numbers blocked from using the bot"],
  transactions: ["Transactions", "Pending subscription payments awaiting review"],
  vouchers: ["Vouchers", "Generate and manage subscription vouchers"],
  broadcast: ["Broadcast", "Send a notification to every connected owner"],
  channel: ["Channel Post", "Publish a message to the WhatsApp channel"],
};
function switchAdminTab(name) {
  document.querySelectorAll(".sidebar-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.adminTab === name);
  });
  document.querySelectorAll(".admin-window").forEach((win) => {
    win.classList.toggle("active", win.id === `admin-window-${name}`);
  });
  const meta = pageMeta[name];
  if (meta) {
    document.getElementById("admin-page-title").textContent = meta[0];
    document.getElementById("admin-page-sub").textContent = meta[1];
  }
}
document.querySelectorAll(".sidebar-link[data-admin-tab]").forEach((btn) => {
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
  if (res.status === 401) {
    // Token expired or invalid — drop back to the login screen.
    adminToken = null;
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    showLogin();
  }
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
          <span><span class="dot ${s.connected ? "online" : "offline"}"></span>${s.number} — ${s.botName || "DarkX Ultimate"} ${s.connected ? "(Online)" : "(Offline)"}</span>
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

channelSendBtn.addEventListener("click", async () => {
  const message = channelTextInput.value.trim();
  const imageUrl = channelImageInput.value.trim();
  if (!message) {
    adminChannelStatus.textContent = "Please write a message first.";
    return;
  }

  channelSendBtn.disabled = true;
  adminChannelStatus.textContent = "Pushing to channel...";
  try {
    const data = await adminFetch("/api/admin/channel-send", {
      method: "POST",
      body: JSON.stringify({ message, imageUrl }),
    });
    adminChannelStatus.textContent = `✅ Posted to channel (via ${data.sentFrom}).`;
    channelTextInput.value = "";
    channelImageInput.value = "";
  } catch (err) {
    adminChannelStatus.textContent = `⚠️ ${err.message}`;
  } finally {
    channelSendBtn.disabled = false;
  }
});
