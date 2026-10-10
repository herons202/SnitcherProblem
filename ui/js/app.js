/* ================================================
   SnicherProblem — app.js
   Langflow API: http://127.0.0.1:7860
   Flow ID: c95bbd08-322b-4646-a54f-83191e2f55d8
   ================================================ */

const CONFIG = {
  LANGFLOW_URL: "http://127.0.0.1:7860",
  FLOW_ID:      "c95bbd08-322b-4646-a54f-83191e2f55d8",
  API_KEY:      "sk-dOuH2EJWqqovv4b-OzYgswbcxatMETPqJ94vNgW07Lw", // Langflow API Key
};

// Agency mapping berdasarkan category
const AGENCY_MAP = {
  "Jalan Berlubang":            "DINAS_PUPR",
  "Jembatan Rusak":             "DINAS_PUPR",
  "Trotoar Rusak":              "DINAS_PUPR",
  "Tanggul Jebol":              "DINAS_PUPR",
  "Drainase Tersumbat":         "DINAS_PUPR",
  "Lampu Lalu Lintas Padam":    "DINAS_PERHUBUNGAN",
  "PJU (Penerangan Jalan) Mati":"DINAS_PERHUBUNGAN",
  "Marka Jalan Rusak":          "DINAS_PERHUBUNGAN",
  "Rambu Lalu Lintas Hilang":   "DINAS_PERHUBUNGAN",
  "Penumpukan Sampah Liar":     "DINAS_LINGKUNGAN_HIDUP",
  "Polusi / Limbah":            "DINAS_LINGKUNGAN_HIDUP",
  "Pohon Tumbang di Fasilitas Umum": "DINAS_LINGKUNGAN_HIDUP",
};

// ---- DOM refs ----
const form          = document.getElementById("reportForm");
const submitBtn     = document.getElementById("submitBtn");
const loadingOverlay= document.getElementById("loadingOverlay");
const resultPanel   = document.getElementById("resultPanel");
const errorBanner   = document.getElementById("errorBanner");
const errorMsg      = document.getElementById("errorMsg");
const newReportBtn  = document.getElementById("newReportBtn");
const copyBtn       = document.getElementById("copyBtn");
const closeError    = document.getElementById("closeError");

// ---- Helpers ----
function showLoading(show) {
  loadingOverlay.style.display = show ? "flex" : "none";
}
function showError(msg) {
  errorMsg.textContent = msg;
  errorBanner.style.display = "flex";
}
function hideError() {
  errorBanner.style.display = "none";
}
function setDisabled(state) {
  submitBtn.disabled = state;
  submitBtn.querySelector(".btn-text").textContent = state ? "Memproses..." : "Kirim Laporan";
  submitBtn.querySelector(".btn-icon").textContent = state ? "⏳" : "🚀";
}

// ---- Build payload ----
function buildPayload(fd) {
  const category   = fd.get("category");
  const urgency    = fd.get("urgency");
  const location   = fd.get("location").trim();
  const summary    = fd.get("summary").trim();
  const action_code= fd.get("action_code");
  const target     = AGENCY_MAP[category] || "DINAS_PUPR";

  return {
    category,
    urgency,
    target_agency: target,
    location,
    summary,
    action_code,
  };
}

// ---- Call Langflow API ----
async function callLangflow(payload) {
  const endpoint = `${CONFIG.LANGFLOW_URL}/api/v1/run/${CONFIG.FLOW_ID}?stream=false`;
  // input_value harus plain string (JSON payload sebagai teks)
  // Langflow akan meneruskan string ini ke Agent sebagai input chat
  const body = JSON.stringify({
    input_value: JSON.stringify(payload),
    input_type:  "chat",
    output_type: "chat",
  });
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    CONFIG.API_KEY,
    },
    body,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Langflow error ${resp.status}: ${txt}`);
  }
  return await resp.json();
}

// ---- Parse Langflow response ----
function extractJSON(raw) {
  // Coba langsung parse
  try { return JSON.parse(raw); } catch (_) {}
  // Coba ekstrak dari markdown code block ```json ... ```
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch (_) {}
  }
  // Coba cari kurung kurawal pertama dan terakhir
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {}
  }
  throw new Error("Tidak dapat mengurai respons JSON dari AI.");
}

function parseLangflowOutput(apiResp) {
  try {
    const outputs  = apiResp.outputs[0].outputs[0];
    const rawText  = outputs.results?.message?.text
                  || outputs.messages?.[0]?.message
                  || "";
    return extractJSON(rawText);
  } catch (e) {
    throw new Error("Format respons tidak dikenali: " + e.message);
  }
}

// ---- Render result ----
function priorityBadgeClass(level) {
  if (!level) return "";
  if (level.includes("EMERGENCY")) return "badge-emergency";
  if (level.includes("SCHEDULED"))  return "badge-scheduled";
  return "badge-routine";
}

let lastTicketData = null;

function renderResult(data) {
  lastTicketData = data;

  const isMerged = data.status === "MERGED";
  const title    = isMerged ? "🔀 Laporan Digabungkan" : "✅ Laporan Diterima";
  resultPanel.querySelector(".card-title").textContent = title;

  document.getElementById("ticketId").textContent     = data.ticket_id || "—";
  document.getElementById("ticketStatus").textContent = data.status    || "SUCCESS";
  if (isMerged) {
    document.getElementById("ticketStatus").style.background = "#b45309";
  }

  const di = data.dispatch_info || {};
  document.getElementById("assignedAgency").textContent = di.assigned_agency || "—";

  const plEl = document.getElementById("priorityLevel");
  plEl.textContent  = di.priority_level || "—";
  plEl.className    = "info-value " + priorityBadgeClass(di.priority_level || "");

  document.getElementById("locationTarget").textContent = di.location_target || "—";
  document.getElementById("workSummary").textContent    = di.work_summary    || "—";

  const ct = data.citizen_tracking || {};
  document.getElementById("citizenMsg").textContent  = ct.status_message || "—";
  document.getElementById("estimatedSla").textContent = ct.estimated_sla  || "—";

  document.getElementById("auditLog").textContent = data.system_audit_log || "—";

  resultPanel.style.display = "block";
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- Form submit ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  // Validasi manual
  const fd = new FormData(form);
  if (!fd.get("category")) { showError("Pilih kategori masalah."); return; }
  if (!fd.get("urgency"))  { showError("Pilih tingkat urgensi."); return; }
  if (!fd.get("location").trim()) { showError("Isi lokasi kejadian."); return; }
  if (!fd.get("summary").trim())  { showError("Isi deskripsi masalah."); return; }

  const payload = buildPayload(fd);

  setDisabled(true);
  showLoading(true);
  resultPanel.style.display = "none";

  try {
    const apiResp = await callLangflow(payload);
    const result  = parseLangflowOutput(apiResp);
    renderResult(result);
  } catch (err) {
    console.error(err);
    showError("Gagal memproses laporan: " + err.message);
  } finally {
    showLoading(false);
    setDisabled(false);
  }
});

// ---- New report ----
newReportBtn.addEventListener("click", () => {
  form.reset();
  resultPanel.style.display = "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---- Copy ticket ----
copyBtn.addEventListener("click", () => {
  if (!lastTicketData) return;
  const text = JSON.stringify(lastTicketData, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = "✅ Tersalin!";
    setTimeout(() => { copyBtn.textContent = "📋 Salin Tiket"; }, 2000);
  });
});

// ---- Close error ----
closeError.addEventListener("click", hideError);
