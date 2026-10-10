/* ================================================
   app.js — Form laporan, Peta, Foto, Navigasi
   ================================================ */

const CONFIG = {
  LANGFLOW_URL: "http://127.0.0.1:7860",
  FLOW_ID:      "c95bbd08-322b-4646-a54f-83191e2f55d8",
  API_KEY:      "sk-dOuH2EJWqqovv4b-OzYgswbcxatMETPqJ94vNgW07Lw", // Langflow API Key
};

const AGENCY_MAP = {
  "Jalan Berlubang":                "DINAS_PUPR",
  "Jembatan Rusak":                 "DINAS_PUPR",
  "Trotoar Rusak":                  "DINAS_PUPR",
  "Tanggul Jebol":                  "DINAS_PUPR",
  "Drainase Tersumbat":             "DINAS_PUPR",
  "Lampu Lalu Lintas Padam":        "DINAS_PERHUBUNGAN",
  "PJU (Penerangan Jalan) Mati":    "DINAS_PERHUBUNGAN",
  "PJU Mati":                       "DINAS_PERHUBUNGAN",
  "Marka Jalan Rusak":              "DINAS_PERHUBUNGAN",
  "Rambu Lalu Lintas Hilang":       "DINAS_PERHUBUNGAN",
  "Penumpukan Sampah Liar":         "DINAS_LINGKUNGAN_HIDUP",
  "Polusi / Limbah":                "DINAS_LINGKUNGAN_HIDUP",
  "Polusi Limbah":                  "DINAS_LINGKUNGAN_HIDUP",
  "Pohon Tumbang di Fasilitas Umum":"DINAS_LINGKUNGAN_HIDUP",
  "Pohon Tumbang":                  "DINAS_LINGKUNGAN_HIDUP",
};

// ---- DOM refs ----
const form           = document.getElementById("reportForm");
const submitBtn      = document.getElementById("submitBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText    = document.getElementById("loadingText");
const resultPanel    = document.getElementById("resultPanel");
const errorBanner    = document.getElementById("errorBanner");
const errorMsg       = document.getElementById("errorMsg");
const newReportBtn   = document.getElementById("newReportBtn");
const copyBtn        = document.getElementById("copyBtn");
const closeError     = document.getElementById("closeError");

// ---- Navigation ----
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const page = btn.dataset.page;
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".page").forEach(p => p.style.display = "none");
    document.getElementById("page-" + page).style.display = "block";
    if (page === "history")   renderHistory();
    if (page === "dashboard") renderDashboard();
    if (page === "tracking")  { document.getElementById("trackingInput").value = ""; document.getElementById("trackingResult").style.display = "none"; document.getElementById("trackingEmpty").style.display = "none"; }
  });
});

// ---- Map Picker ----
let leafletMap = null;
let leafletMarker = null;

document.getElementById("pickMapBtn").addEventListener("click", () => {
  const mapDiv = document.getElementById("mapPicker");
  if (mapDiv.style.display === "none") {
    mapDiv.style.display = "block";
    if (!leafletMap) {
      leafletMap = L.map("mapPicker").setView([-6.2, 106.8], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
      }).addTo(leafletMap);
      leafletMap.on("click", e => {
        const { lat, lng } = e.latlng;
        if (leafletMarker) leafletMarker.remove();
        leafletMarker = L.marker([lat, lng]).addTo(leafletMap);
        document.getElementById("location").value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        mapDiv.style.display = "none";
      });
    } else {
      setTimeout(() => leafletMap.invalidateSize(), 100);
    }
  } else {
    mapDiv.style.display = "none";
  }
});

// ---- Photo Upload ----
const photoInput   = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const photoArea    = document.getElementById("photoUploadArea");
const photoHolder  = document.getElementById("photoPlaceholder");
let photoBase64    = null;

photoArea.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    photoBase64 = e.target.result;
    photoPreview.src = photoBase64;
    photoPreview.style.display = "block";
    photoHolder.style.display  = "none";
  };
  reader.readAsDataURL(file);
});

// ---- Helpers ----
function showLoading(show, text = "Memproses laporan...") {
  loadingOverlay.style.display = show ? "flex" : "none";
  loadingText.textContent = text;
}
function showError(msg) { errorMsg.textContent = msg; errorBanner.style.display = "flex"; }
function hideError()    { errorBanner.style.display = "none"; }
function setSubmitDisabled(state) {
  submitBtn.disabled = state;
  submitBtn.querySelector(".btn-text").textContent = state ? "Memproses..." : "Kirim Laporan";
  submitBtn.querySelector(".btn-icon").textContent = state ? "⏳" : "🚀";
}

// ---- Build payload ----
function buildPayload(fd) {
  const category    = fd.get("category");
  const urgency     = fd.get("urgency");
  const location    = fd.get("location").trim();
  const summary     = fd.get("summary").trim();
  const action_code = fd.get("action_code");
  return {
    category,
    urgency,
    target_agency: AGENCY_MAP[category] || "DINAS_PUPR",
    location,
    summary,
    action_code,
  };
}

// ---- Langflow API ----
async function callLangflow(payload) {
  const body = JSON.stringify({
    input_value: JSON.stringify(payload),
    input_type:  "chat",
    output_type: "chat",
  });
  const resp = await fetch(
    `${CONFIG.LANGFLOW_URL}/api/v1/run/${CONFIG.FLOW_ID}?stream=false`,
    { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": CONFIG.API_KEY }, body }
  );
  if (!resp.ok) throw new Error(`Langflow error ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

function extractJSON(raw) {
  try { return JSON.parse(raw); } catch (_) {}
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch (_) {} }
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  if (s !== -1 && e !== -1) { try { return JSON.parse(raw.slice(s, e + 1)); } catch (_) {} }
  throw new Error("Tidak dapat mengurai respons JSON dari AI.");
}

function parseLangflowOutput(apiResp) {
  const out  = apiResp.outputs[0].outputs[0];
  const text = out.results?.message?.text || out.messages?.[0]?.message || "";
  return extractJSON(text);
}

// ---- Render result ----
let lastTicketData = null;

function priorityClass(level) {
  if (!level) return "";
  if (level.includes("EMERGENCY")) return "badge-emergency";
  if (level.includes("SCHEDULED"))  return "badge-scheduled";
  return "badge-routine";
}

function renderResult(data) {
  lastTicketData = data;
  const isMerged = data.status === "MERGED";
  document.getElementById("resultTitle").textContent = isMerged ? "🔀 Laporan Digabungkan" : "✅ Laporan Diterima";
  document.getElementById("ticketId").textContent     = data.ticket_id || "—";
  document.getElementById("ticketStatus").textContent = data.status    || "SUCCESS";
  document.getElementById("ticketStatus").style.background = isMerged ? "#b45309" : "";

  const di = data.dispatch_info || {};
  document.getElementById("assignedAgency").textContent = di.assigned_agency || "—";
  const plEl = document.getElementById("priorityLevel");
  plEl.textContent = di.priority_level || "—";
  plEl.className   = "info-value " + priorityClass(di.priority_level || "");
  document.getElementById("locationTarget").textContent = di.location_target || "—";
  document.getElementById("workSummary").textContent    = di.work_summary    || "—";

  const ct = data.citizen_tracking || {};
  document.getElementById("citizenMsg").textContent    = ct.status_message || "—";
  document.getElementById("estimatedSla").textContent  = ct.estimated_sla  || "—";
  document.getElementById("auditLog").textContent      = data.system_audit_log || "—";

  resultPanel.style.display = "block";
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- Form submit ----
form.addEventListener("submit", async e => {
  e.preventDefault();
  hideError();
  const fd = new FormData(form);
  if (!fd.get("category"))        { showError("Pilih kategori masalah.");  return; }
  if (!fd.get("urgency"))         { showError("Pilih tingkat urgensi.");   return; }
  if (!fd.get("location").trim()) { showError("Isi lokasi kejadian.");     return; }
  if (!fd.get("summary").trim())  { showError("Isi deskripsi masalah.");   return; }

  const payload = buildPayload(fd);
  if (photoBase64) payload.photo_base64 = photoBase64.substring(0, 100) + "...[foto tersimpan]";

  setSubmitDisabled(true);
  showLoading(true);
  resultPanel.style.display = "none";

  try {
    const apiResp = await callLangflow(payload);
    const result  = parseLangflowOutput(apiResp);
    // Tambahkan foto ke data tiket yang disimpan
    if (photoBase64) result._photo = photoBase64;
    result._location_text = fd.get("location").trim();
    Storage.save(result);
    renderResult(result);
  } catch (err) {
    console.error(err);
    showError("Gagal memproses laporan: " + err.message);
  } finally {
    showLoading(false);
    setSubmitDisabled(false);
  }
});

// ---- New report ----
newReportBtn.addEventListener("click", () => {
  form.reset();
  photoBase64 = null;
  photoPreview.style.display = "none";
  photoHolder.style.display  = "block";
  resultPanel.style.display  = "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---- Copy ticket ----
copyBtn.addEventListener("click", () => {
  if (!lastTicketData) return;
  const { _photo, ...clean } = lastTicketData;
  navigator.clipboard.writeText(JSON.stringify(clean, null, 2)).then(() => {
    copyBtn.textContent = "✅ Tersalin!";
    setTimeout(() => { copyBtn.textContent = "📋 Salin JSON"; }, 2000);
  });
});

closeError.addEventListener("click", hideError);

// ---- History render ----
function renderHistory() {
  const list = document.getElementById("historyList");
  const all  = Storage.getAll();
  if (!all.length) {
    list.innerHTML = '<div class="empty-state">📭 Belum ada laporan tersimpan.</div>';
    return;
  }
  list.innerHTML = all.map(t => {
    const di = t.dispatch_info || {};
    const ct = t.citizen_tracking || {};
    const pClass = priorityClass(di.priority_level || "");
    const photo  = t._photo ? `<img src="${t._photo}" class="history-photo" alt="foto" />` : "";
    return `
      <div class="history-item">
        <div class="history-top">
          <span class="history-tid">${t.ticket_id || "—"}</span>
          <span class="info-value ${pClass}" style="font-size:12px;">${di.priority_level || "—"}</span>
        </div>
        <div class="history-meta">
          <span>🏢 ${di.assigned_agency || "—"}</span>
          <span>📍 ${di.location_target || t._location_text || "—"}</span>
          <span>⏱️ ${ct.estimated_sla || "—"}</span>
        </div>
        <div class="history-summary">${di.work_summary || "—"}</div>
        ${photo}
        <div class="history-ts">${t._savedAt ? new Date(t._savedAt).toLocaleString("id-ID") : ""}</div>
      </div>`;
  }).join("");
}

// ---- Clear history ----
document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (confirm("Hapus semua riwayat laporan?")) { Storage.clear(); renderHistory(); }
});

// ---- Tracking ----
document.getElementById("trackingBtn").addEventListener("click", () => {
  const id  = document.getElementById("trackingInput").value.trim().toUpperCase();
  const res = document.getElementById("trackingResult");
  const emp = document.getElementById("trackingEmpty");
  if (!id) return;

  const ticket = Storage.findById(id);
  res.style.display = "none";
  emp.style.display = "none";

  if (!ticket) { emp.style.display = "block"; return; }

  const di = ticket.dispatch_info || {};
  const ct = ticket.citizen_tracking || {};
  const pClass = priorityClass(di.priority_level || "");
  const photo  = ticket._photo ? `<img src="${ticket._photo}" class="tracking-photo" alt="foto bukti" />` : "";
  res.innerHTML = `
    <div class="card" style="margin:0;">
      <div class="ticket-header">
        <div class="ticket-id">${ticket.ticket_id}</div>
        <div class="ticket-status">${ticket.status}</div>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Dinas</span><span class="info-value">${di.assigned_agency||"—"}</span></div>
        <div class="info-item"><span class="info-label">Prioritas</span><span class="info-value ${pClass}">${di.priority_level||"—"}</span></div>
        <div class="info-item"><span class="info-label">Lokasi</span><span class="info-value">${di.location_target||"—"}</span></div>
        <div class="info-item"><span class="info-label">SLA</span><span class="info-value">${ct.estimated_sla||"—"}</span></div>
      </div>
      <div class="summary-box"><span class="info-label">Ringkasan</span><p>${di.work_summary||"—"}</p></div>
      <div class="summary-box"><span class="info-label">Status Warga</span><p>${ct.status_message||"—"}</p></div>
      ${photo}
      <div class="audit-log">${ticket.system_audit_log||""}</div>
      <div style="font-size:12px;color:#718096;margin-top:8px;">Disimpan: ${ticket._savedAt ? new Date(ticket._savedAt).toLocaleString("id-ID") : "—"}</div>
    </div>`;
  res.style.display = "block";
});

document.getElementById("trackingInput").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("trackingBtn").click();
});
