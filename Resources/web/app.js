// DarkX Ultimate - Web dashboard client logic (pairing + login/settings)

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
  statusEl.textContent = "✨ Connecting to DarkX Ultimate, please wait...";
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

    const purchased = data.purchasedCommands || [];
    const purchasedLine = purchased.length
      ? ` You've also individually unlocked: ${purchased.join(", ")}.`
      : "";

    if (data.promoExpiresAt && new Date(data.promoExpiresAt) > new Date()) {
      const until = new Date(data.promoExpiresAt).toLocaleString();
      subStatusBox.textContent = `🎁 You have a promo offer active — every command is unlocked until ${until}.`;
    } else if (data.plan === "starter") {
      subStatusBox.textContent = `You're on the free Starter plan — Auto View Status and Auto Typing are free forever. Everything else needs a plan or a command pack below.${purchasedLine}`;
    } else {
      const expires = data.planExpiresAt ? new Date(data.planExpiresAt).toLocaleDateString() : "—";
      subStatusBox.textContent = `You're on the ${data.planLabel} plan — every command is unlocked. Expires: ${expires}.${purchasedLine}`;
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

// ---------- Live pricing + purchasable command catalog ----------
let currentPricing = null;
let purchasableCommands = [];
let commandsPickerLoaded = false;

async function loadPricingAndCatalog() {
  try {
    const res = await fetch("/api/subscription/pricing", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load pricing.");

    currentPricing = data.pricing;
    purchasableCommands = data.commands || [];

    document.getElementById("price-weekly-amount").textContent = currentPricing.weeklyPrice.toLocaleString();
    document.getElementById("price-monthly-amount").textContent = currentPricing.monthlyPrice.toLocaleString();
    document.getElementById("price-pack-amount").textContent = currentPricing.commandPackPrice.toLocaleString();
    document.getElementById("pack-size-label").textContent = currentPricing.commandPackSize;
    document.getElementById("pack-size-label-2").textContent = currentPricing.commandPackSize;

    renderCommandsPicker();
  } catch (err) {
    console.error("Pricing load failed:", err.message);
  }
}

function renderCommandsPicker() {
  const list = document.getElementById("commands-list");
  if (!purchasableCommands.length) {
    list.innerHTML = `<div style="font-size:12.5px;color:var(--muted);">No purchasable commands found.</div>`;
    return;
  }
  const sorted = [...purchasableCommands].sort((a, b) => a.name.localeCompare(b.name));
  list.innerHTML = sorted
    .map(
      (cmd) => `
      <label class="cmd-check-row" data-cmd="${cmd.name}">
        <input type="checkbox" value="${cmd.name}" />
        <span class="cmd-name">.${cmd.name}</span>
        <span class="cmd-cat">${cmd.category || "other"}</span>
      </label>`
    )
    .join("");

  list.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.addEventListener("change", onCommandCheckChange);
  });
  commandsPickerLoaded = true;
}

function onCommandCheckChange() {
  const list = document.getElementById("commands-list");
  const checked = list.querySelectorAll('input[type="checkbox"]:checked');
  const max = currentPricing?.commandPackSize || 5;

  if (checked.length > max) {
    this.checked = false;
    return;
  }

  document.getElementById("commands-selected-count").textContent = checked.length;

  const atMax = checked.length >= max;
  list.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.disabled = atMax && !box.checked;
    box.closest(".cmd-check-row").classList.toggle("disabled", box.disabled);
  });

  document.getElementById("commands-continue-btn").disabled = checked.length === 0;
}

function getSelectedCommands() {
  return Array.from(document.querySelectorAll('#commands-list input[type="checkbox"]:checked')).map((b) => b.value);
}

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
  resetPurchaseSelection();
  updateWhatsappVerifyLink();
  subscribeModal.classList.add("show");
  loadSubscriptionStatus();
  loadPricingAndCatalog();
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
  let packageLabel = "";
  if (selectedPurchaseType === "plan" && selectedPlan) {
    packageLabel = selectedPlan.toUpperCase();
  } else if (selectedPurchaseType === "commands") {
    const chosen = getSelectedCommands();
    packageLabel = chosen.length ? `Command Pack (${chosen.join(", ")})` : "Command Pack";
  }
  let msg = "Nimelipia ila sijapokea package.";
  if (packageLabel) msg += ` Package: ${packageLabel}.`;
  if (phone) msg += ` Namba yangu: ${phone}.`;
  if (txref) msg += ` Muamala: ${txref}.`;
  verifyWhatsappBtn.href = `https://wa.me/${WHATSAPP_ADMIN_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// ---------- Package selection + payment submission ----------
let selectedPlan = null; // "weekly" | "monthly" — set when buying a full-access plan
let selectedPurchaseType = null; // "plan" | "commands"
const payStep = document.getElementById("pay-step");
const commandsPicker = document.getElementById("commands-picker");
const paySummary = document.getElementById("pay-summary");
const subscribeStatus = document.getElementById("subscribe-status");

function resetPurchaseSelection() {
  selectedPlan = null;
  selectedPurchaseType = null;
  document.querySelectorAll(".pkg-card").forEach((c) => c.classList.remove("selected"));
  payStep.style.display = "none";
  commandsPicker.style.display = "none";
  subscribeStatus.textContent = "";
  document.querySelectorAll('#commands-list input[type="checkbox"]').forEach((b) => (b.checked = false));
  document.getElementById("commands-selected-count").textContent = "0";
  document.getElementById("commands-continue-btn").disabled = true;
}

function showPayStepForPlan(plan) {
  selectedPurchaseType = "plan";
  selectedPlan = plan;
  const price = plan === "weekly" ? currentPricing?.weeklyPrice : currentPricing?.monthlyPrice;
  const days = plan === "weekly" ? 7 : 30;
  paySummary.textContent = `You're paying for: ${plan === "weekly" ? "Weekly" : "Monthly"} Plan — ${price?.toLocaleString() ?? ""} TSH (${days} days, every command unlocked)`;
  commandsPicker.style.display = "none";
  payStep.style.display = "block";
  if (payPhoneInput && !payPhoneInput.value) payPhoneInput.value = sessionNumber || "";
  updateWhatsappVerifyLink();
}

["pkg-weekly", "pkg-monthly"].forEach((id) => {
  document.getElementById(id).addEventListener("click", () => {
    document.querySelectorAll(".pkg-card").forEach((c) => c.classList.remove("selected"));
    document.getElementById(id).classList.add("selected");
    showPayStepForPlan(id === "pkg-weekly" ? "weekly" : "monthly");
  });
});

document.getElementById("pkg-commands").addEventListener("click", () => {
  document.querySelectorAll(".pkg-card").forEach((c) => c.classList.remove("selected"));
  document.getElementById("pkg-commands").classList.add("selected");
  selectedPurchaseType = "commands";
  selectedPlan = null;
  payStep.style.display = "none";
  commandsPicker.style.display = "block";
  if (!commandsPickerLoaded) renderCommandsPicker();
});

document.getElementById("commands-continue-btn").addEventListener("click", () => {
  const chosen = getSelectedCommands();
  if (!chosen.length) return;
  paySummary.textContent = `You're paying for: Command Pack — ${currentPricing?.commandPackPrice?.toLocaleString() ?? ""} TSH (unlocks: ${chosen.join(", ")} — forever, no expiry)`;
  payStep.style.display = "block";
  if (payPhoneInput && !payPhoneInput.value) payPhoneInput.value = sessionNumber || "";
  updateWhatsappVerifyLink();
});

document.getElementById("pay-txref").addEventListener("input", updateWhatsappVerifyLink);
if (payPhoneInput) payPhoneInput.addEventListener("input", updateWhatsappVerifyLink);

document.getElementById("pay-submit-btn").addEventListener("click", async () => {
  const payerNumber = payPhoneInput.value.trim();
  const transactionRef = document.getElementById("pay-txref").value.trim();
  if (!selectedPurchaseType) return;
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
    const isCommands = selectedPurchaseType === "commands";
    const url = isCommands ? "/api/subscription/commands/request" : "/api/subscription/subscribe/request";
    const body = isCommands
      ? { commands: getSelectedCommands(), transactionRef, payerNumber }
      : { plan: selectedPlan, transactionRef, payerNumber };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify(body),
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
  document.getElementById("s-privateMode").checked = !!s.privateMode;
  document.getElementById("s-antilink").checked = !!s.antilink;
  document.getElementById("s-antidelete").checked = !!s.antidelete;
  document.getElementById("s-autoViewStatus").checked = !!s.autoViewStatus;
  document.getElementById("s-autoReactStatus").checked = !!s.autoReactStatus;
  document.getElementById("s-autoReadChat").checked = !!s.autoReadChat;
  document.getElementById("s-autoReactChat").checked = !!s.autoReactChat;
  document.getElementById("s-autoTyping").checked = !!s.autoTyping;
  document.getElementById("s-autoRecording").checked = !!s.autoRecording;
  document.getElementById("s-mongoUrl").value = s.mongoUrl || "";
  document.getElementById("s-autoViewOnce").checked = !!s.autoViewOnce;
  document.getElementById("s-autoSaveStatus").checked = !!s.autoSaveStatus;
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
    privateMode: document.getElementById("s-privateMode").checked,
    antilink: document.getElementById("s-antilink").checked,
    antidelete: document.getElementById("s-antidelete").checked,
    autoViewStatus: document.getElementById("s-autoViewStatus").checked,
    autoReactStatus: document.getElementById("s-autoReactStatus").checked,
    autoReadChat: document.getElementById("s-autoReadChat").checked,
    autoReactChat: document.getElementById("s-autoReactChat").checked,
    autoTyping: document.getElementById("s-autoTyping").checked,
    autoRecording: document.getElementById("s-autoRecording").checked,
    mongoUrl: document.getElementById("s-mongoUrl").value.trim(),
    autoViewOnce: document.getElementById("s-autoViewOnce").checked,
    autoSaveStatus: document.getElementById("s-autoSaveStatus").checked,
  };

  if (payload.autoSaveStatus && !payload.mongoUrl) {
    settingsStatus.textContent = "⚠️ Set your own MongoDB URL above before turning on Auto Save Status.";
    saveSettingsBtn.disabled = false;
    return;
  }

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
