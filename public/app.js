const tokenInput = document.querySelector("#token");
const saveTokenButton = document.querySelector("#saveToken");
const refreshButton = document.querySelector("#refresh");
const filterSelect = document.querySelector("#filter");
const devicesBody = document.querySelector("#devices");

// Stats Elements
const statTotal = document.querySelector("#stat-total");
const statPending = document.querySelector("#stat-pending");
const statApproved = document.querySelector("#stat-approved");

tokenInput.value = localStorage.getItem("adminToken") || "";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}`
  };
}

function formatDate(value) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function updateDevice(id, body) {
  const response = await fetch(`/api/admin/devices/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Không cập nhật được thiết bị");
  }

  await loadDevices();
}

async function deleteDevice(id) {
  const response = await fetch(`/api/admin/devices/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error("Không xoá được thiết bị");
  }

  await loadDevices();
}

function updateStats(devices) {
  if (!devices) return;
  statTotal.textContent = devices.length;
  statPending.textContent = devices.filter(d => d.status === "pending").length;
  statApproved.textContent = devices.filter(d => d.status === "approved").length;
}

function renderDevices(devices) {
  devicesBody.innerHTML = "";

  if (!devices.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td class="empty" colspan="6">Không tìm thấy Game ID nào phù hợp.</td>`;
    devicesBody.appendChild(row);
    return;
  }

  for (const device of devices) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="machine" title="${device.gameId}">${device.gameId}</td>
      <td>${device.label || "Chưa đặt nhãn"}</td>
      <td><span class="badge ${device.status}">${device.status === 'pending' ? 'Chờ duyệt' : device.status === 'approved' ? 'Đã duyệt' : 'Đã chặn'}</span></td>
      <td>${formatDate(device.expiresAt)}</td>
      <td>${formatDate(device.lastSeenAt)}</td>
      <td>
        <div class="actions">
          <button class="success" data-action="approve">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Duyệt 30 ngày
          </button>
          <button class="secondary" data-action="pending">Đưa vào hàng chờ</button>
          <button class="danger" data-action="block">Chặn</button>
          <button class="danger" data-action="delete" style="padding: 0 8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </td>
    `;

    row.querySelector('[data-action="approve"]').addEventListener("click", () => {
      updateDevice(device.id, { status: "approved", expiresAt: daysFromNow(30) }).catch(alert);
    });

    row.querySelector('[data-action="pending"]').addEventListener("click", () => {
      updateDevice(device.id, { status: "pending", expiresAt: null }).catch(alert);
    });

    row.querySelector('[data-action="block"]').addEventListener("click", () => {
      updateDevice(device.id, { status: "blocked", expiresAt: null }).catch(alert);
    });

    row.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (confirm(`Xoá Game ID: ${device.gameId}?`)) {
        deleteDevice(device.id).catch(alert);
      }
    });

    devicesBody.appendChild(row);
  }
}

async function loadDevices() {
  const params = new URLSearchParams();
  if (filterSelect.value) params.set("status", filterSelect.value);

  const response = await fetch(`/api/admin/devices?${params}`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    alert(data.error || "Không tải được danh sách thiết bị");
    return;
  }

  const data = await response.json();
  
  // Tự động load tất cả để làm stats trước, rồi mới render theo bộ lọc
  const allResp = await fetch(`/api/admin/devices`, { headers: authHeaders() });
  if (allResp.ok) {
    const allData = await allResp.json();
    updateStats(allData.devices);
  }

  renderDevices(data.devices);
}

saveTokenButton.addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadDevices();
});

refreshButton.addEventListener("click", loadDevices);
filterSelect.addEventListener("change", loadDevices);

loadDevices();
