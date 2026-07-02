/* ============================================================
   DXMOD Admin — Frontend Application
   JWT auth, tabbed dashboard, CRUD, logs, toasts
   ============================================================ */

// ──────────────────────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────────────────────
const S = {
  token: localStorage.getItem("dxmod_jwt") || "",
  username: localStorage.getItem("dxmod_user") || "admin",
  currentPage: 1,
  currentLimit: 20,
  currentStatus: "",
  currentSearch: "",
  editingUid: null,   // null = add mode, string = edit uid
  refreshTimer: null,
};

// ──────────────────────────────────────────────────────────────
//  DOM SHORTCUTS
// ──────────────────────────────────────────────────────────────
const $  = (id) => document.getElementById(id);
const el = (sel) => document.querySelector(sel);

// ──────────────────────────────────────────────────────────────
//  PAGE ROUTER
// ──────────────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $(`page-${name}`).classList.add("active");
}

// ──────────────────────────────────────────────────────────────
//  TOAST NOTIFICATIONS
// ──────────────────────────────────────────────────────────────
function toast(type, title, msg, ms = 3500) {
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.innerHTML = `
    <span class="toast-icon">${icons[type] || "ℹ️"}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ""}
    </div>`;
  $("toast-container").prepend(div);
  setTimeout(() => {
    div.style.animation = "toastOut 0.3s forwards";
    setTimeout(() => div.remove(), 320);
  }, ms);
}

// ──────────────────────────────────────────────────────────────
//  API FETCH HELPER
// ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(S.token ? { Authorization: `Bearer ${S.token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ──────────────────────────────────────────────────────────────
//  DATE HELPERS
// ──────────────────────────────────────────────────────────────
function fmtDate(val) {
  if (!val) return '<span style="color:#4b5563">Vĩnh viễn</span>';
  const d = new Date(val);
  const now = new Date();
  const diff = d - now;
  const expired = diff < 0;
  const days = Math.abs(Math.floor(diff / 86400000));

  const formatted = new Intl.DateTimeFormat("vi-VN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(d);

  if (expired) {
    return `<span style="color:#f87171" title="Đã hết hạn ${days} ngày trước">${formatted} <small>(${days}d trước)</small></span>`;
  }
  const color = days < 7 ? "#fbbf24" : "#94a3b8";
  return `<span style="color:${color}" title="Còn ${days} ngày">${formatted} <small>(${days}d)</small></span>`;
}

function fmtDateShort(val) {
  if (!val) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(val));
}

function daysFromNow(n) {
  if (n === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function toLocalDatetimeInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  // Convert to local time for datetime-local input
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 16);
}

function badgeForDevice(device) {
  if (device.status === "blocked") return '<span class="badge badge-blocked">🚫 Blocked</span>';
  if (device.status === "pending") return '<span class="badge badge-pending">⏳ Pending</span>';
  if (device.active) return '<span class="badge badge-active">✅ Active</span>';
  return '<span class="badge badge-expired">🕒 Expired</span>';
}

// ──────────────────────────────────────────────────────────────
//  LOGIN
// ──────────────────────────────────────────────────────────────
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("input-username").value.trim();
  const password = $("input-password").value;
  const errEl    = $("login-error");
  const btnText  = el("#btn-login .btn-text");
  const spinner  = el("#btn-login .btn-spinner");

  errEl.classList.add("hidden");
  btnText.classList.add("hidden");
  spinner.classList.remove("hidden");

  try {
    const data = await api("POST", "/api/admin/login", { username, password });
    S.token    = data.token;
    S.username = data.username || username;
    localStorage.setItem("dxmod_jwt", S.token);
    localStorage.setItem("dxmod_user", S.username);
    $("dash-username").textContent = S.username;
    initDashboard();
    showPage("dashboard");
    toast("success", "Đăng nhập thành công", `Xin chào, ${S.username}!`);
  } catch (err) {
    errEl.textContent = err.message || "Sai tên đăng nhập hoặc mật khẩu";
    errEl.classList.remove("hidden");
  } finally {
    btnText.classList.remove("hidden");
    spinner.classList.add("hidden");
  }
});

// ──────────────────────────────────────────────────────────────
//  LOGOUT
// ──────────────────────────────────────────────────────────────
$("btn-logout").addEventListener("click", () => {
  S.token = "";
  localStorage.removeItem("dxmod_jwt");
  localStorage.removeItem("dxmod_user");
  clearInterval(S.refreshTimer);
  showPage("login");
  toast("info", "Đã đăng xuất", "Hẹn gặp lại!");
});

// ──────────────────────────────────────────────────────────────
//  TABS
// ──────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(`tab-${tab}`).classList.add("active");
    if (tab === "logs") loadLogs();
  });
});

// ──────────────────────────────────────────────────────────────
//  STATS
// ──────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await api("GET", "/api/admin/users?limit=1000");
    const all = data.devices || [];
    const today = new Date().toDateString();

    $("s-total").textContent   = all.length;
    $("s-active").textContent  = all.filter((d) => d.active).length;
    $("s-pending").textContent = all.filter((d) => d.status === "pending").length;
    $("s-blocked").textContent = all.filter((d) => d.status === "blocked").length;

    // Today's accesses from logs
    try {
      const logData = await api("GET", "/api/admin/logs?limit=200");
      const todayLogs = (logData.logs || []).filter((l) =>
        new Date(l.timestamp).toDateString() === today
      );
      $("s-today").textContent = todayLogs.length;
    } catch { $("s-today").textContent = "—"; }
  } catch (err) {
    console.error("loadStats error", err);
  }
}

// ──────────────────────────────────────────────────────────────
//  LOAD USERS TABLE
// ──────────────────────────────────────────────────────────────
async function loadUsers() {
  const params = new URLSearchParams({
    page:   S.currentPage,
    limit:  S.currentLimit,
    status: S.currentStatus,
    search: S.currentSearch,
  });

  const tbody = $("uid-tbody");
  tbody.innerHTML = `<tr><td colspan="7" class="empty-row">⏳ Đang tải...</td></tr>`;

  try {
    const data = await api("GET", `/api/admin/users?${params}`);
    const devices = data.devices || [];
    const pag     = data.pagination || {};

    renderUsersTable(devices);
    renderPagination(pag);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row" style="color:#f87171">❌ ${err.message}</td></tr>`;
    if (err.message.includes("401") || err.message.includes("Unauthorized")) {
      handleAuthError();
    }
  }
}

function renderUsersTable(devices) {
  const tbody = $("uid-tbody");
  if (!devices.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Không tìm thấy UID nào phù hợp</td></tr>`;
    return;
  }
  tbody.innerHTML = devices.map((d) => `
    <tr>
      <td class="uid-cell" title="${d.uid}">${d.uid}</td>
      <td class="label-cell">${d.label || '<span style="color:#374151">—</span>'}</td>
      <td>${badgeForDevice(d)}</td>
      <td class="date-cell">${fmtDate(d.expiresAt)}</td>
      <td class="date-cell">${fmtDateShort(d.lastSeenAt)}</td>
      <td class="note-cell" title="${d.note || ''}">${d.note || '<span style="color:#374151">—</span>'}</td>
      <td class="actions-cell">
        <button class="btn btn-success btn-xs" data-action="approve30" data-uid="${d.uid}" title="Duyệt 30 ngày">+30d</button>
        <button class="btn btn-warning btn-xs" data-action="edit"      data-uid="${d.uid}" title="Sửa">✏️</button>
        <button class="btn btn-ghost   btn-xs" data-action="block"     data-uid="${d.uid}" title="Chặn">🚫</button>
        <button class="btn btn-danger  btn-xs" data-action="delete"    data-uid="${d.uid}" title="Xoá">🗑️</button>
      </td>
    </tr>`).join("");

  // Attach handlers
  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", handleAction);
  });
}

async function handleAction(e) {
  const { action, uid } = e.currentTarget.dataset;
  try {
    if (action === "approve30") {
      await api("PUT", `/api/admin/users/${encodeURIComponent(uid)}`, {
        status: "approved",
        expiresAt: daysFromNow(30),
      });
      toast("success", "Đã duyệt 30 ngày", uid);
      refreshAll();
    } else if (action === "edit") {
      openEditModal(uid);
    } else if (action === "block") {
      if (!confirm(`Chặn UID: ${uid}?`)) return;
      await api("PUT", `/api/admin/users/${encodeURIComponent(uid)}`, { status: "blocked", expiresAt: null });
      toast("info", "Đã chặn UID", uid);
      refreshAll();
    } else if (action === "delete") {
      if (!confirm(`XOÁ VĨNH VIỄN UID: ${uid}?\nThao tác này không thể hoàn tác!`)) return;
      await api("DELETE", `/api/admin/users/${encodeURIComponent(uid)}`);
      toast("success", "Đã xoá", uid);
      refreshAll();
    }
  } catch (err) {
    toast("error", "Lỗi", err.message);
  }
}

// ──────────────────────────────────────────────────────────────
//  PAGINATION
// ──────────────────────────────────────────────────────────────
function renderPagination(pag) {
  const el = $("pagination");
  if (!pag || pag.pages <= 1) { el.innerHTML = ""; return; }

  let html = "";
  if (pag.page > 1) {
    html += `<button class="btn btn-ghost btn-xs" data-pg="${pag.page - 1}">‹ Trước</button>`;
  }
  html += `<span class="page-num">Trang ${pag.page} / ${pag.pages} (${pag.total} bản ghi)</span>`;
  if (pag.page < pag.pages) {
    html += `<button class="btn btn-ghost btn-xs" data-pg="${pag.page + 1}">Sau ›</button>`;
  }
  el.innerHTML = html;
  el.querySelectorAll("[data-pg]").forEach((btn) => {
    btn.addEventListener("click", () => {
      S.currentPage = Number(btn.dataset.pg);
      loadUsers();
    });
  });
}

// ──────────────────────────────────────────────────────────────
//  ACCESS LOGS
// ──────────────────────────────────────────────────────────────
async function loadLogs() {
  $("logs-tbody").innerHTML = `<tr><td colspan="6" class="empty-row">⏳ Đang tải...</td></tr>`;
  try {
    const data = await api("GET", "/api/admin/logs?limit=50");
    const logs = data.logs || [];
    if (!logs.length) {
      $("logs-tbody").innerHTML = `<tr><td colspan="6" class="empty-row">Chưa có nhật ký truy cập</td></tr>`;
      return;
    }
    $("logs-tbody").innerHTML = logs.map((l, i) => {
      let badgeHtml = "";
      const status = l.status || (l.active ? "approved" : "pending");
      
      if (status === "approved") {
        badgeHtml = '<span class="badge badge-log-ok">✅ APPROVED</span>';
      } else if (status === "pending") {
        badgeHtml = '<span class="badge badge-log-pending">⏳ PENDING</span>';
      } else if (status === "blocked") {
        badgeHtml = '<span class="badge badge-log-blocked">🚫 BLOCKED</span>';
      } else if (status === "expired") {
        badgeHtml = '<span class="badge badge-log-expired">⏰ EXPIRED</span>';
      } else {
        badgeHtml = '<span class="badge badge-log-no">❌ DENIED</span>';
      }

      return `
        <tr>
          <td style="color:${i % 2 === 0 ? '#38bdf8' : '#818cf8'};font-family:monospace;font-size:11px">${i + 1}</td>
          <td class="date-cell">${fmtDateShort(l.timestamp)}</td>
          <td class="uid-cell">${l.uid}</td>
          <td style="font-family:monospace;font-size:12px;color:#64748b">${l.ip}</td>
          <td>${badgeHtml}</td>
          <td style="font-size:11px;color:#4b5563;font-family:monospace">${l.method || 'check'}</td>
        </tr>`;
    }).join("");
  } catch (err) {
    $("logs-tbody").innerHTML = `<tr><td colspan="6" class="empty-row" style="color:#f87171">❌ ${err.message}</td></tr>`;
  }
}

// ──────────────────────────────────────────────────────────────
//  TOOLBAR EVENTS
// ──────────────────────────────────────────────────────────────
$("btn-refresh").addEventListener("click", refreshAll);
$("btn-refresh-logs").addEventListener("click", loadLogs);

$("search-uid").addEventListener("input", debounce(() => {
  S.currentSearch = $("search-uid").value.trim();
  S.currentPage = 1;
  loadUsers();
}, 350));

$("filter-status").addEventListener("change", () => {
  S.currentStatus = $("filter-status").value;
  S.currentPage = 1;
  loadUsers();
});

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function refreshAll() {
  loadUsers();
  loadStats();
}

// ──────────────────────────────────────────────────────────────
//  ADD / EDIT MODAL
// ──────────────────────────────────────────────────────────────
$("btn-add-uid").addEventListener("click", () => openAddModal());

function openAddModal() {
  S.editingUid = null;
  $("modal-uid-title").textContent = "➕ Thêm UID mới";
  $("modal-uid-input").value = "";
  $("modal-uid-input").disabled = false;
  $("modal-label-input").value = "";
  $("modal-expires-input").value = toLocalDatetimeInput(daysFromNow(30));
  $("modal-note-input").value = "";
  $("modal-status-group").style.display = "none";
  $("modal-uid").classList.remove("hidden");
  $("modal-uid-input").focus();
}

async function openEditModal(uid) {
  S.editingUid = uid;
  $("modal-uid-title").textContent = "✏️ Chỉnh sửa UID";
  $("modal-uid-input").value = uid;
  $("modal-uid-input").disabled = true;
  $("modal-status-group").style.display = "flex";

  // Load current data
  try {
    const data = await api("GET", `/api/admin/users?search=${encodeURIComponent(uid)}&limit=1`);
    const dev  = data.devices?.[0];
    if (dev) {
      $("modal-label-input").value   = dev.label || "";
      $("modal-expires-input").value = toLocalDatetimeInput(dev.expiresAt);
      $("modal-note-input").value    = dev.note || "";
      $("modal-status-input").value  = dev.status || "approved";
    }
  } catch { /* proceed with empty */ }

  $("modal-uid").classList.remove("hidden");
  $("modal-label-input").focus();
}

function closeModal() {
  $("modal-uid").classList.add("hidden");
  S.editingUid = null;
}

$("modal-uid-close").addEventListener("click", closeModal);
$("modal-uid-cancel").addEventListener("click", closeModal);
$("modal-uid").addEventListener("click", (e) => { if (e.target === $("modal-uid")) closeModal(); });

// Preset day buttons
document.querySelectorAll(".preset-row [data-days]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const days = Number(btn.dataset.days);
    if (days === 0) {
      $("modal-expires-input").value = "";
    } else {
      $("modal-expires-input").value = toLocalDatetimeInput(daysFromNow(days));
    }
  });
});

$("modal-uid-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid     = $("modal-uid-input").value.trim();
  const label   = $("modal-label-input").value.trim() || null;
  const expires = $("modal-expires-input").value;
  const note    = $("modal-note-input").value.trim() || null;
  const status  = S.editingUid ? $("modal-status-input").value : "approved";

  if (!uid) { toast("error", "Thiếu thông tin", "Vui lòng nhập Game UID"); return; }

  const expiresAt = expires ? new Date(expires).toISOString() : null;
  const submitBtn = $("modal-uid-submit");
  submitBtn.disabled = true;
  submitBtn.querySelector(".btn-text").textContent = "Đang lưu...";

  try {
    if (S.editingUid) {
      await api("PUT", `/api/admin/users/${encodeURIComponent(S.editingUid)}`, { label, expiresAt, note, status });
      toast("success", "Đã cập nhật", uid);
    } else {
      await api("POST", "/api/admin/users", { uid, label, expiresAt, note });
      toast("success", "Đã thêm UID", uid);
    }
    closeModal();
    refreshAll();
  } catch (err) {
    toast("error", "Lỗi", err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector(".btn-text").textContent = "Lưu";
  }
});

// ──────────────────────────────────────────────────────────────
//  AUTH ERROR HANDLER
// ──────────────────────────────────────────────────────────────
function handleAuthError() {
  S.token = "";
  localStorage.removeItem("dxmod_jwt");
  clearInterval(S.refreshTimer);
  showPage("login");
  toast("error", "Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại");
}

// ──────────────────────────────────────────────────────────────
//  DASHBOARD INIT
// ──────────────────────────────────────────────────────────────
function initDashboard() {
  $("dash-username").textContent = S.username;
  refreshAll();
  clearInterval(S.refreshTimer);
  S.refreshTimer = setInterval(refreshAll, 30_000); // auto-refresh 30s
}

// ──────────────────────────────────────────────────────────────
//  BOOT — auto-login if token exists
// ──────────────────────────────────────────────────────────────
(async function boot() {
  if (!S.token) {
    showPage("login");
    return;
  }
  // Verify token is still valid by making a quick request
  try {
    await api("GET", "/api/admin/users?limit=1");
    $("dash-username").textContent = S.username;
    initDashboard();
    showPage("dashboard");
  } catch {
    // Token expired or invalid
    S.token = "";
    localStorage.removeItem("dxmod_jwt");
    showPage("login");
  }
})();
