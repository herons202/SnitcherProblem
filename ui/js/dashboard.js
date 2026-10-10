/* ================================================
   dashboard.js — Statistik & Grafik
   ================================================ */

function renderDashboard() {
  const all = Storage.getAll();

  // ---- Stat cards ----
  document.getElementById("statTotal").textContent     = all.length;
  document.getElementById("statEmergency").textContent = all.filter(t => (t.dispatch_info?.priority_level||"").includes("EMERGENCY")).length;
  document.getElementById("statScheduled").textContent = all.filter(t => (t.dispatch_info?.priority_level||"").includes("SCHEDULED")).length;
  document.getElementById("statRoutine").textContent   = all.filter(t => (t.dispatch_info?.priority_level||"").includes("ROUTINE")).length;

  // ---- Bar chart: per Dinas ----
  const dinasCounts = {};
  all.forEach(t => {
    const d = t.dispatch_info?.assigned_agency || "UNKNOWN";
    dinasCounts[d] = (dinasCounts[d] || 0) + 1;
  });
  renderBarChart("chartDinas", dinasCounts, {
    "DINAS_PUPR":            "#3b6bde",
    "DINAS_PERHUBUNGAN":     "#e6a817",
    "DINAS_LINGKUNGAN_HIDUP":"#22863a",
    "UNKNOWN":               "#aaa",
  });

  // ---- Bar chart: per Hari (7 hari terakhir) ----
  const dailyCounts = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyCounts[d.toLocaleDateString("id-ID", { day:"2-digit", month:"short" })] = 0;
  }
  all.forEach(t => {
    const saved = t._savedAt ? new Date(t._savedAt) : null;
    if (!saved) return;
    const key = saved.toLocaleDateString("id-ID", { day:"2-digit", month:"short" });
    if (key in dailyCounts) dailyCounts[key]++;
  });
  renderBarChart("chartHarian", dailyCounts, null, "#3b6bde");

  // ---- Donut chart: Prioritas ----
  const emergency = all.filter(t => (t.dispatch_info?.priority_level||"").includes("EMERGENCY")).length;
  const scheduled = all.filter(t => (t.dispatch_info?.priority_level||"").includes("SCHEDULED")).length;
  const routine   = all.filter(t => (t.dispatch_info?.priority_level||"").includes("ROUTINE")).length;
  renderDonut([emergency, scheduled, routine], ["#c0392b","#b45309","#276749"], ["Emergency","Scheduled","Routine"]);
}

function renderBarChart(containerId, dataObj, colorMap, defaultColor = "#3b6bde") {
  const container = document.getElementById(containerId);
  const entries   = Object.entries(dataObj);
  if (!entries.length) { container.innerHTML = '<div class="empty-state" style="padding:20px;">📭 Belum ada data.</div>'; return; }

  const max = Math.max(...entries.map(e => e[1]), 1);
  const shortLabel = l => l.replace("DINAS_","").replace("_"," ");

  container.innerHTML = entries.map(([label, count]) => {
    const pct   = Math.round((count / max) * 100);
    const color = colorMap ? (colorMap[label] || defaultColor) : defaultColor;
    return `
      <div class="bar-row">
        <span class="bar-label" title="${label}">${shortLabel(label)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <span class="bar-count">${count}</span>
      </div>`;
  }).join("");
}

function renderDonut(values, colors, labels) {
  const canvas = document.getElementById("donutCanvas");
  const ctx    = canvas.getContext("2d");
  const total  = values.reduce((a, b) => a + b, 0);
  const cx = canvas.width / 2, cy = canvas.height / 2, r = 75, innerR = 45;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (total === 0) {
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.fill();
    document.getElementById("donutLegend").innerHTML = '<span style="color:#aaa;font-size:13px;">Belum ada data</span>';
    return;
  }

  let startAngle = -Math.PI / 2;
  values.forEach((val, i) => {
    if (!val) return;
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    startAngle += slice;
  });

  // Donut hole
  ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = "#fff"; ctx.fill();

  // Center text
  ctx.fillStyle = "#1a202c"; ctx.font = "bold 20px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(total, cx, cy - 8);
  ctx.font = "11px system-ui"; ctx.fillStyle = "#718096";
  ctx.fillText("Total", cx, cy + 12);

  // Legend
  document.getElementById("donutLegend").innerHTML = labels.map((l, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]};"></span>
      <span>${l}: <strong>${values[i]}</strong></span>
    </div>`).join("");
}
