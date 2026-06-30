const tokenInput = document.querySelector("#token");
const saveTokenButton = document.querySelector("#saveToken");
const refreshButton = document.querySelector("#refresh");
const filterSelect = document.querySelector("#filter");
const devicesBody = document.querySelector("#devices");

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

function renderDevices(devices) {
  devicesBody.innerHTML = "";

  if (!devices.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td class="empty" colspan="6">Chưa có thiết bị nào.</td>`;
    devicesBody.appendChild(row);
    return;
  }

  for (const device of devices) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="machine" title="${device.gameId}">${device.gameId}</td>
      <td>${device.label || ""}</td>
      <td><span class="badge ${device.status}">${device.status}</span></td>
      <td>${formatDate(device.expiresAt)}</td>
      <td>${formatDate(device.lastSeenAt)}</td>
      <td>
        <div class="actions">
          <button data-action="approve">30 ngày</button>
          <button class="secondary" data-action="pending">Chờ</button>
          <button class="danger" data-action="block">Chặn</button>
          <button class="danger" data-action="delete">Xoá</button>
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
      if (confirm("Xoá thiết bị này?")) {
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
  renderDevices(data.devices);
}

saveTokenButton.addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadDevices();
});

refreshButton.addEventListener("click", loadDevices);
filterSelect.addEventListener("change", loadDevices);

loadDevices();
