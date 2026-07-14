// ===== Telecom AI Ops Dashboard - Main JS =====
const App = {
  data: {
    dashboard: null,
    predictions: [],
    records: [],
    metrics: null,
    datasetError: "",
    uploadedDataset: null,
    pendingDatasetFile: null,
  },
  charts: {},
  user: null,
};

const DATASET_URL = "dataset/cleaned_telecom_dataset.xlsx";
const XLSX_CDN = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
const REQUIRED_TELECOM_COLUMNS = [
  "Ticket_ID",
  "Complaint_Date",
  "SIM_Provider",
  "City_Type",
  "Network_Type",
  "Customer_Issue",
  "Signal_Strength",
  "Tower_Load",
  "Weather",
  "Previous_Complaints",
  "Predicted_Root_Cause",
  "Suggested_Solution",
  "Severity_Level",
  "Escalation_Required",
];

// ---------- Auth ----------
function checkAuth() {
  const u = sessionStorage.getItem("taio_user");
  if (!u) {
    window.location.href = "index.html";
    return false;
  }
  App.user = JSON.parse(u);
  return true;
}
function logout() {
  sessionStorage.removeItem("taio_user");
  window.location.href = "index.html";
}

// ---------- Routing ----------
function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".sb-nav .nav-link[data-page]").forEach(l => l.classList.remove("active"));
  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");
  const link = document.querySelector(`.sb-nav .nav-link[data-page="${page}"]`);
  if (link) link.classList.add("active");
  const titleEl = document.getElementById("tb-title");
  if (titleEl) titleEl.textContent = link ? link.dataset.title : "Dashboard";
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeSidebar();
  if (page === "dashboard") renderDashboard();
  if (page === "analytics") renderAnalytics();
  if (page === "reports") renderReports();
  if (page === "recommendation") renderRecommendations();
}

// ---------- Data ----------
async function loadDataset() {
  try {
    await ensureExcelParser();
    const res = await fetch(DATASET_URL);
    if (!res.ok) throw new Error("No dataset loaded.");

    const workbookBuffer = await res.arrayBuffer();
    const records = parseExcel(workbookBuffer);
    const metrics = calculateMetrics(records);

    App.data.records = records;
    App.data.metrics = metrics;
    App.data.dashboard = buildDashboardData(metrics, records);
    App.data.predictions = records.map(recordToPrediction);
    App.data.datasetError = "";

    // Future FastAPI integration: replace the local fetch with an API call that returns validated records.
    // Future SQLite storage: persist parsed workbook records after backend validation succeeds.
  } catch (e) {
    console.error("Dataset load failed", e);
    const message = e.message === "The uploaded dataset does not match the required telecom format."
      ? e.message
      : "No dataset loaded.";
    App.data.records = [];
    App.data.metrics = null;
    App.data.dashboard = emptyDashboardData();
    App.data.predictions = [];
    App.data.datasetError = message;
  }
}

async function ensureExcelParser() {
  if (window.XLSX) return;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${XLSX_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = XLSX_CDN;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  if (!window.XLSX) throw new Error("No dataset loaded.");
}

function parseExcel(workbookBuffer) {
  const workbook = XLSX.read(workbookBuffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("No dataset loaded.");

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  if (!rows.length) throw new Error("No dataset loaded.");

  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_TELECOM_COLUMNS.filter(column => !headers.includes(column));
  if (missing.length) throw new Error("The uploaded dataset does not match the required telecom format.");

  return rows.map((row, index) => normalizeTelecomRecord(row, index));
}

function normalizeTelecomRecord(row, index) {
  return {
    id: cleanValue(row.Ticket_ID) || `TKT${String(index + 1).padStart(6, "0")}`,
    complaintDate: normalizeDate(row.Complaint_Date),
    provider: cleanValue(row.SIM_Provider),
    region: cleanValue(row.City_Type),
    network: cleanValue(row.Network_Type),
    issue: titleCase(row.Customer_Issue),
    signalStrength: cleanValue(row.Signal_Strength),
    towerLoad: cleanValue(row.Tower_Load),
    weather: cleanValue(row.Weather),
    previousComplaints: Number(row.Previous_Complaints) || 0,
    rootCause: titleCase(row.Predicted_Root_Cause),
    solution: sentenceCase(row.Suggested_Solution),
    severity: titleCase(row.Severity_Level),
    escalation: normalizeYesNo(row.Escalation_Required),
  };
}

function calculateMetrics(records) {
  const severityCounts = countBy(records, record => record.severity || "Unknown");
  return {
    totalRecords: records.length,
    totalComplaints: records.length,
    criticalIssues: severityCounts.Critical || 0,
    highSeverityCount: severityCounts.High || 0,
    escalatedCases: records.filter(record => record.escalation === "Yes").length,
    issueTypeDistribution: countBy(records, record => record.issue || "Unknown"),
    regionDistribution: countBy(records, record => record.region || "Unknown"),
    providerDistribution: countBy(records, record => record.provider || "Unknown"),
    networkDistribution: countBy(records, record => record.network || "Unknown"),
    severityDistribution: severityCounts,
    towerLoadDistribution: countBy(records, record => record.towerLoad || "Unknown"),
  };
}

function updateDashboard() {
  renderDashboard();
}

function updateCharts() {
  drawDashboardCharts();
  drawAnalyticsCharts();
}

function updateReports() {
  renderReports();
}

function updatePredictionHistory() {
  renderAnalytics();
}

function buildDashboardData(metrics, records) {
  const sortedRecords = [...records].sort((a, b) => b.complaintDate - a.complaintDate);
  const recent = sortedRecords.slice(0, 5);
  const avgConfidence = average(records.map(predictionConfidence));

  return {
    kpis: {
      totalComplaints: metrics.totalComplaints,
      totalRecords: metrics.totalRecords,
      criticalIssues: metrics.criticalIssues,
      highSeverityCount: metrics.highSeverityCount,
      escalatedCases: metrics.escalatedCases,
      aiAccuracy: avgConfidence,
    },
    complaintTrend: buildDailyTrend(records),
    issueMix: distributionToChart(metrics.issueTypeDistribution),
    providerSplit: distributionToChart(metrics.providerDistribution),
    networkType: distributionToChart(metrics.networkDistribution),
    severityTrend: buildSeverityTrend(records),
    cityType: distributionToChart(metrics.regionDistribution),
    aiAccuracyTrend: buildAccuracyTrend(records),
    towerLoad: distributionToChart(metrics.towerLoadDistribution),
    recommendations: buildRecommendations(metrics),
    activity: recent.map(record => ({
      title: `${record.severity || "New"} issue logged`,
      body: `${record.provider || "Provider"} ${record.issue || "complaint"} in ${record.region || "Unknown"}${record.escalation === "Yes" ? " requires escalation." : " is under monitoring."}`,
      time: formatRelativeDate(record.complaintDate),
    })),
  };
}

function emptyDashboardData() {
  return {
    kpis: { totalComplaints: 0, totalRecords: 0, criticalIssues: 0, highSeverityCount: 0, escalatedCases: 0, aiAccuracy: 0 },
    complaintTrend: { labels: [], resolved: [], new: [] },
    issueMix: { labels: [], data: [] },
    providerSplit: { labels: [], data: [] },
    networkType: { labels: [], data: [] },
    severityTrend: { labels: [], critical: [], high: [], medium: [] },
    cityType: { labels: [], data: [] },
    aiAccuracyTrend: { labels: [], data: [] },
    towerLoad: { labels: [], data: [] },
    recommendations: [],
    activity: [],
  };
}

function recordToPrediction(record) {
  return {
    id: record.id,
    sim: record.provider,
    city: record.region,
    network: record.network,
    issue: record.issue,
    signal: record.signalStrength,
    towerLoad: record.towerLoad,
    weather: record.weather,
    prevComplaints: record.previousComplaints,
    rootCause: record.rootCause,
    severity: record.severity,
    escalation: record.escalation,
    solution: record.solution,
    confidence: predictionConfidence(record),
    date: formatDate(record.complaintDate),
  };
}

function buildDailyTrend(records) {
  const days = [...new Set(records.map(record => dateKey(record.complaintDate)))].sort().slice(-7);
  return {
    labels: days.map(key => formatShortDate(new Date(key))),
    resolved: days.map(key => records.filter(record => dateKey(record.complaintDate) === key && record.escalation !== "Yes").length),
    new: days.map(key => records.filter(record => dateKey(record.complaintDate) === key).length),
  };
}

function buildSeverityTrend(records) {
  const monthKeys = [...new Set(records.map(record => monthKey(record.complaintDate)))].sort().slice(-4);
  return {
    labels: monthKeys.map(key => formatMonthLabel(key)),
    critical: monthKeys.map(key => records.filter(record => monthKey(record.complaintDate) === key && record.severity === "Critical").length),
    high: monthKeys.map(key => records.filter(record => monthKey(record.complaintDate) === key && record.severity === "High").length),
    medium: monthKeys.map(key => records.filter(record => monthKey(record.complaintDate) === key && record.severity === "Medium").length),
  };
}

function buildAccuracyTrend(records) {
  const monthKeys = [...new Set(records.map(record => monthKey(record.complaintDate)))].sort().slice(-7);
  return {
    labels: monthKeys.map(key => formatMonthLabel(key)),
    data: monthKeys.map(key => average(records.filter(record => monthKey(record.complaintDate) === key).map(predictionConfidence))),
  };
}

function buildRecommendations(metrics) {
  const topIssue = topDistributionEntry(metrics.issueTypeDistribution);
  const topProvider = topDistributionEntry(metrics.providerDistribution);
  const topRegion = topDistributionEntry(metrics.regionDistribution);
  return [
    {
      id: "R-01",
      title: `Reduce ${topIssue.label} complaints`,
      impact: metrics.criticalIssues > 0 ? "Critical" : "High",
      effort: "Medium",
      desc: `${topIssue.count.toLocaleString()} records point to ${topIssue.label}. Prioritize root-cause review and corrective actions for this issue type.`,
      tag: "Issue Trend",
    },
    {
      id: "R-02",
      title: `Review ${topProvider.label} provider performance`,
      impact: "High",
      effort: "Medium",
      desc: `${topProvider.label} has ${topProvider.count.toLocaleString()} complaints in the loaded dataset. Compare tower load, network type, and severity before capacity planning.`,
      tag: "Provider",
    },
    {
      id: "R-03",
      title: `Monitor ${topRegion.label} region closely`,
      impact: metrics.escalatedCases > 0 ? "High" : "Medium",
      effort: "Low",
      desc: `${topRegion.label} contributes ${topRegion.count.toLocaleString()} records. Track escalations and recurring causes from this cluster.`,
      tag: "Region",
    },
  ];
}

function distributionToChart(distribution) {
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  return {
    labels: entries.map(([label]) => label),
    data: entries.map(([, value]) => value),
  };
}

function countBy(items, selector) {
  return items.reduce((counts, item) => {
    const key = selector(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function topDistributionEntry(distribution) {
  const [label = "Unknown", count = 0] = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0] || [];
  return { label, count };
}

function predictionConfidence(record) {
  const severityScore = { Critical: 92, High: 88, Medium: 82, Low: 76 }[record.severity] || 80;
  const escalationBoost = record.escalation === "Yes" ? 3 : 0;
  const complaintBoost = Math.min(record.previousComplaints, 5);
  return Math.min(98, severityScore + escalationBoost + complaintBoost);
}

function average(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (!nums.length) return 0;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(1));
}

// ---------- Toast ----------
function toast(msg, icon = "bi-check-circle-fill") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerHTML = `<i class="bi ${icon}"></i><span>${msg}</span>`;
  t.classList.add("show");
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- Dashboard ----------
function renderDashboard() {
  if (!App.data.dashboard) App.data.dashboard = emptyDashboardData();
  const k = App.data.dashboard.kpis;
  document.getElementById("kpi-total").textContent = k.totalComplaints.toLocaleString();
  document.getElementById("kpi-critical").textContent = k.criticalIssues;
  document.getElementById("kpi-escalated").textContent = k.escalatedCases;
  document.getElementById("kpi-accuracy").textContent = k.aiAccuracy + "%";

  // Activity timeline
  const tl = document.getElementById("activity-timeline");
  if (tl) {
    tl.innerHTML = App.data.datasetError ? dataMessage(App.data.datasetError) : App.data.dashboard.activity.map(a => `
      <div class="timeline-item">
        <div class="t-title">${a.title}</div>
        <div class="t-time">${a.time}</div>
        <div class="t-body">${a.body}</div>
      </div>`).join("");
  }

  // Recent predictions table
  const tb = document.getElementById("dash-recent");
  if (tb) {
    tb.innerHTML = App.data.datasetError ? tableMessage(App.data.datasetError, 6) : App.data.predictions.slice(0, 5).map(p => `
      <tr>
        <td><strong>${p.id}</strong></td>
        <td>${p.sim}</td>
        <td>${p.issue}</td>
        <td><span class="pill pill-${p.severity.toLowerCase()}">${p.severity}</span></td>
        <td>${p.confidence}%</td>
        <td>${p.date}</td>
      </tr>`).join("");
  }

  drawDashboardCharts();
}

function drawDashboardCharts() {
  const d = App.data.dashboard;
  // Complaint trend
  mkChart("chart-trend", "line", {
    labels: d.complaintTrend.labels,
    datasets: [
      { label: "Resolved", data: d.complaintTrend.resolved, borderColor: "#1f9d55", backgroundColor: "rgba(31,157,85,.12)", fill: true, tension: .4 },
      { label: "New", data: d.complaintTrend.new, borderColor: "#0b5cad", backgroundColor: "rgba(11,92,173,.12)", fill: true, tension: .4 },
    ],
  }, { plugins: { legend: { position: "bottom" } }, scales: defaultScales() });

  // Issue mix doughnut
  mkChart("chart-issues", "doughnut", {
    labels: d.issueMix.labels,
    datasets: [{ data: d.issueMix.data, backgroundColor: palette() }],
  }, { cutout: "62%", plugins: { legend: { position: "right" } } });

  // Provider split bar
  mkChart("chart-provider", "bar", {
    labels: d.providerSplit.labels,
    datasets: [{ label: "Complaints %", data: d.providerSplit.data, backgroundColor: "#0b5cad", borderRadius: 6 }],
  }, { plugins: { legend: { display: false } }, scales: defaultScales() });

  // AI accuracy trend
  mkChart("chart-accuracy", "line", {
    labels: d.aiAccuracyTrend.labels,
    datasets: [{ label: "AI Accuracy %", data: d.aiAccuracyTrend.data, borderColor: "#00a3a3", backgroundColor: "rgba(0,163,163,.12)", fill: true, tension: .4 }],
  }, { plugins: { legend: { display: false } }, scales: defaultScales() });
}

// ---------- Analytics ----------
function renderAnalytics() {
  const tb = document.getElementById("analytics-table");
  if (tb) {
    tb.innerHTML = App.data.datasetError ? tableMessage(App.data.datasetError, 9) : App.data.predictions.map(p => `
      <tr>
        <td><strong>${p.id}</strong></td>
        <td>${p.sim}</td>
        <td>${p.city}</td>
        <td>${p.network}</td>
        <td>${p.issue}</td>
        <td><span class="pill pill-${p.severity.toLowerCase()}">${p.severity}</span></td>
        <td>${p.escalation === "Yes" ? '<span class="pill pill-yes">Yes</span>' : '<span class="pill pill-no">No</span>'}</td>
        <td>${p.confidence}%</td>
        <td>${p.date}</td>
      </tr>`).join("");
  }
  drawAnalyticsCharts();
}

function drawAnalyticsCharts() {
  const d = App.data.dashboard;
  mkChart("a-chart-severity", "bar", {
    labels: d.severityTrend.labels,
    datasets: [
      { label: "Critical", data: d.severityTrend.critical, backgroundColor: "#d6362e", borderRadius: 5 },
      { label: "High", data: d.severityTrend.high, backgroundColor: "#e08a00", borderRadius: 5 },
      { label: "Medium", data: d.severityTrend.medium, backgroundColor: "#0b5cad", borderRadius: 5 },
    ],
  }, { plugins: { legend: { position: "bottom" } }, scales: defaultScales() });

  mkChart("a-chart-network", "polarArea", {
    labels: d.networkType.labels,
    datasets: [{ data: d.networkType.data, backgroundColor: palette().map(c => c.replace(")", ",.7)").replace("rgb", "rgba")) }],
  }, { plugins: { legend: { position: "right" } } });

  mkChart("a-chart-city", "bar", {
    labels: d.cityType.labels,
    datasets: [{ label: "Complaints %", data: d.cityType.data, backgroundColor: "#00a3a3", borderRadius: 6 }],
  }, { indexAxis: "y", plugins: { legend: { display: false } }, scales: defaultScales() });

  mkChart("a-chart-tower", "bar", {
    labels: d.towerLoad.labels,
    datasets: [{ label: "Tower Load %", data: d.towerLoad.data, backgroundColor: d.towerLoad.data.map(v => v > 75 ? "#d6362e" : v > 60 ? "#e08a00" : "#1f9d55"), borderRadius: 6 }],
  }, { plugins: { legend: { display: false } }, scales: defaultScales() });
}

// ---------- Prediction ----------
async function predictIssue() {

    const form = document.getElementById("pred-form");

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const requestData = {
        SIM_Provider: val("f-sim"),
        City_Type: val("f-city"),
        Network_Type: val("f-network"),
        Customer_Issue: val("f-issue"),
        Signal_Strength: val("f-signal"),
        Tower_Load: val("f-tower"),
        Weather: val("f-weather"),
        Previous_Complaints: parseInt(val("f-prev"))
    };

    console.log("Sending Request:", requestData);

    try {

        const response = await fetch("http://127.0.0.1:8000/predict", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(requestData)

        });

        console.log("Status:", response.status);

        const result = await response.json();

        console.log(result);

        showResult({

            id: "AI",

            sim: requestData.SIM_Provider,

            city: requestData.City_Type,

            network: requestData.Network_Type,

            issue: requestData.Customer_Issue,

            signal: requestData.Signal_Strength,

            towerLoad: requestData.Tower_Load,

            weather: requestData.Weather,

            prevComplaints: requestData.Previous_Complaints,

            rootCause: result["Root Cause"],

            severity: result["Severity"],

            escalation: result["Escalation"],

            solution: result["Suggested Solution"],

            confidence: 98,

            date: new Date().toLocaleString()

        });

        toast("Prediction Completed");

    } catch (err) {

        console.error(err);

        alert("Cannot connect to FastAPI server.");

    }
}
function showResult(r) {
  const card = document.getElementById("result-card");
  card.style.display = "block";
  card.classList.add("result-card");
  card.querySelector(".card-body").innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="section-title mb-0">Prediction Result</h6>
      <span class="pill pill-${r.severity.toLowerCase()}">${r.severity}</span>
    </div>
    <div class="text-muted-2 mb-3" style="font-size:12px">${r.id} &middot; ${r.date} &middot; Confidence ${r.confidence}%</div>
    <div class="result-row"><span class="lbl">Root Cause</span><span class="val">${r.rootCause}</span></div>
    <div class="result-row"><span class="lbl">Severity</span><span class="val">${r.severity}</span></div>
    <div class="result-row"><span class="lbl">Escalation</span><span class="val">${r.escalation === "Yes" ? '<span class="pill pill-yes">Required</span>' : '<span class="pill pill-no">Not Required</span>'}</span></div>
    <div class="result-row"><span class="lbl">Suggested Solution</span><span class="val text-end">${r.solution}</span></div>
    <div class="mt-3 d-flex gap-2">
      <button class="btn btn-primary btn-sm" onclick="navigate('reports')"><i class="bi bi-list-check me-1"></i>View in Reports</button>
      <button class="btn btn-outline-secondary btn-sm" onclick="navigate('recommendation')"><i class="bi bi-lightbulb me-1"></i>Get AI Recommendation</button>
    </div>`;
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---------- Recommendations ----------
function renderRecommendations() {
  const wrap = document.getElementById("rec-list");
  if (!wrap) return;
  if (App.data.datasetError) {
    wrap.innerHTML = `<div class="card-soft"><div class="card-body text-center text-muted-2">${App.data.datasetError}</div></div>`;
    return;
  }
  wrap.innerHTML = App.data.dashboard.recommendations.map(r => `
    <div class="card-soft mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h6 class="mb-0">${r.title}</h6>
          <span class="pill pill-${r.impact === "Critical" ? "critical" : r.impact === "High" ? "high" : "medium"}">${r.impact} Impact</span>
        </div>
        <p class="text-muted-2 mb-3" style="font-size:13px">${r.desc}</p>
        <div class="d-flex gap-2 align-items-center">
          <span class="badge bg-soft-blue"><i class="bi bi-tag me-1"></i>${r.tag}</span>
          <span class="badge bg-soft-orange">Effort: ${r.effort}</span>
          <button class="btn btn-sm btn-primary ms-auto" onclick="toast('Recommendation accepted and routed to ops queue')"><i class="bi bi-check2 me-1"></i>Accept</button>
          <button class="btn btn-sm btn-outline-secondary" onclick="toast('Recommendation deferred', 'bi-clock-history')"><i class="bi bi-x-lg"></i></button>
        </div>
      </div>
    </div>`).join("");
}

// ---------- Reports ----------
function renderReports() {
  const tb = document.getElementById("reports-table");
  if (!tb) return;
  tb.innerHTML = App.data.datasetError ? tableMessage(App.data.datasetError, 10) : App.data.predictions.map(p => `
    <tr>
      <td><strong>${p.id}</strong></td>
      <td>${p.sim}</td>
      <td>${p.city}</td>
      <td>${p.network}</td>
      <td>${p.issue}</td>
      <td>${p.rootCause}</td>
      <td><span class="pill pill-${p.severity.toLowerCase()}">${p.severity}</span></td>
      <td>${p.escalation === "Yes" ? '<span class="pill pill-yes">Yes</span>' : '<span class="pill pill-no">No</span>'}</td>
      <td>${p.confidence}%</td>
      <td>${p.date}</td>
    </tr>`).join("");
}

function downloadPDF() {
  const win = window.open("", "_blank");
  if (!win) { toast("Popup blocked. Allow popups to download PDF.", "bi-exclamation-triangle"); return; }
  const rows = App.data.predictions.map(p => `<tr>
    <td>${p.id}</td><td>${p.sim}</td><td>${p.city}</td><td>${p.network}</td>
    <td>${p.issue}</td><td>${p.rootCause}</td><td>${p.severity}</td>
    <td>${p.escalation}</td><td>${p.confidence}%</td><td>${p.date}</td></tr>`).join("");
  win.document.write(`<!doctype html><html><head><title>Telecom AI Ops - Prediction Report</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:32px;color:#1f2a37}
      h1{color:#0b5cad;font-size:22px;margin:0 0 4px}
      .sub{color:#6b7785;font-size:13px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#0b5cad;color:#fff;padding:8px;text-align:left}
      td{padding:7px 8px;border-bottom:1px solid #e3e8ef}
      .foot{margin-top:24px;color:#6b7785;font-size:11px}
    </style></head><body>
    <h1>Telecom AI Operations - Prediction History Report</h1>
    <div class="sub">Generated ${new Date().toLocaleString()} &middot; ${App.data.predictions.length} records</div>
    <table><thead><tr>
      <th>ID</th><th>Provider</th><th>City</th><th>Network</th><th>Issue</th>
      <th>Root Cause</th><th>Severity</th><th>Escalation</th><th>Confidence</th><th>Date</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="foot">Confidential - Internal NOC use only.</div>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
  win.document.close();
  toast("PDF report generated");
}

function exportCSV() {
  const headers = ["ID","Provider","City","Network","Issue","Root Cause","Severity","Escalation","Confidence","Date"];
  const rows = App.data.predictions.map(p => [p.id,p.sim,p.city,p.network,p.issue,p.rootCause,p.severity,p.escalation,p.confidence,p.date]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "prediction-history.csv";
  a.click();
  toast("CSV exported");
}

// ---------- Upload Dataset ----------
function initDatasetUpload() {
  const input = document.getElementById("dataset-file");
  const dropZone = document.getElementById("dataset-drop-zone");
  if (!input || !dropZone) return;

  input.addEventListener("change", () => setPendingDatasetFile(input.files[0]));

  ["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      dropZone.classList.add("bg-light");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      dropZone.classList.remove("bg-light");
    });
  });

  dropZone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    setPendingDatasetFile(file);
  });

  renderDatasetInfo();
  renderValidation();
  renderSummary();
  renderPreview();
}

function handleFileUpload() {
  const input = document.getElementById("dataset-file");
  const file = App.data.pendingDatasetFile || input?.files?.[0];
  if (!file) {
    toast("Choose a CSV file first", "bi-exclamation-triangle");
    return;
  }
  if (!isCSVFile(file)) {
    toast("Only .csv files are supported", "bi-exclamation-triangle");
    return;
  }

  setDatasetStatus("Uploading...", true);

  const reader = new FileReader();
  reader.onerror = () => {
    setDatasetStatus("No dataset uploaded yet.", false);
    toast("Unable to read CSV file", "bi-exclamation-triangle");
  };
  reader.onload = () => {
    setDatasetStatus("Processing...", true);
    setTimeout(() => {
      try {
        const rawCSV = String(reader.result || "");
        const parsed = parseCSV(rawCSV);
        const validation = validateDataset(parsed);
        const uploadTime = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        App.data.uploadedDataset = {
          fileName: file.name,
          fileSize: file.size,
          uploadTime,
          rawCSV,
          headers: parsed.headers,
          rows: parsed.rows,
          validation,
          summary: {
            totalRows: parsed.totalRows,
            totalColumns: parsed.totalColumns,
            numericColumns: validation.numericColumns,
            textColumns: validation.textColumns,
          },
        };

        // Future Flask/FastAPI integration: POST App.data.uploadedDataset to the backend here.
        // Future SQLite storage: persist parsed rows and validation metadata after backend upload succeeds.

        renderDatasetInfo();
        renderValidation();
        renderSummary();
        renderPreview();
        setDatasetStatus("Completed Successfully", false);
        toast("Dataset uploaded successfully");
      } catch (e) {
        console.error("CSV processing failed", e);
        App.data.uploadedDataset = null;
        renderDatasetInfo();
        renderValidation();
        renderSummary();
        renderPreview();
        setDatasetStatus("No dataset uploaded yet.", false);
        toast(e.message || "CSV processing failed", "bi-exclamation-triangle");
      }
    }, 450);
  };
  reader.readAsText(file);
}

function parseCSV(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("CSV file is empty");

  const parsedRows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell.trim());
      parsedRows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  parsedRows.push(row);

  const nonEmptyRows = parsedRows.filter(items => items.some(item => item !== ""));
  if (!nonEmptyRows.length) throw new Error("CSV file is empty");

  const headers = nonEmptyRows[0].map((header, index) => header || `Column ${index + 1}`);
  if (!headers.length) throw new Error("CSV header row is missing");

  const rows = nonEmptyRows.slice(1).map(items => headers.map((_, index) => items[index] ?? ""));
  return {
    headers,
    rows,
    totalRows: rows.length,
    totalColumns: headers.length,
  };
}

function validateDataset(dataset) {
  let missingValues = 0;
  let duplicateRows = 0;
  let emptyColumns = 0;
  let numericColumns = 0;
  const seenRows = new Set();

  dataset.rows.forEach(row => {
    row.forEach(value => {
      if (String(value).trim() === "") missingValues++;
    });

    const rowKey = row.map(value => String(value).trim()).join("\u001f");
    if (seenRows.has(rowKey)) duplicateRows++;
    else seenRows.add(rowKey);
  });

  dataset.headers.forEach((_, columnIndex) => {
    const values = dataset.rows.map(row => String(row[columnIndex] ?? "").trim());
    const filledValues = values.filter(value => value !== "");
    if (!filledValues.length) emptyColumns++;
    if (filledValues.length && filledValues.every(isNumericValue)) numericColumns++;
  });

  const hasWarning = missingValues > 0 || duplicateRows > 0 || emptyColumns > 0;
  return {
    missingValues,
    duplicateRows,
    emptyColumns,
    validationStatus: hasWarning ? "Warning" : "Success",
    totalRows: dataset.totalRows,
    totalColumns: dataset.totalColumns,
    numericColumns,
    textColumns: Math.max(dataset.totalColumns - numericColumns, 0),
  };
}

function renderDatasetInfo() {
  const wrap = document.getElementById("dataset-info");
  if (!wrap) return;
  const dataset = App.data.uploadedDataset;
  if (!dataset) {
    wrap.innerHTML = `<div class="text-center text-muted-2">No dataset uploaded yet.</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="result-row"><span class="lbl">File Name</span><span class="val text-end">${escapeHtml(dataset.fileName)}</span></div>
    <div class="result-row"><span class="lbl">File Size</span><span class="val">${formatBytes(dataset.fileSize)}</span></div>
    <div class="result-row"><span class="lbl">Upload Time</span><span class="val text-end">${escapeHtml(dataset.uploadTime)}</span></div>
    <div class="result-row"><span class="lbl">Total Rows</span><span class="val">${dataset.summary.totalRows.toLocaleString()}</span></div>
    <div class="result-row"><span class="lbl">Total Columns</span><span class="val">${dataset.summary.totalColumns.toLocaleString()}</span></div>`;
}

function renderPreview() {
  const wrap = document.getElementById("dataset-preview");
  if (!wrap) return;
  const dataset = App.data.uploadedDataset;
  if (!dataset) {
    wrap.innerHTML = `<div class="text-center text-muted-2 p-4">No dataset uploaded yet.</div>`;
    return;
  }
  if (!dataset.rows.length) {
    wrap.innerHTML = `<div class="text-center text-muted-2 p-4">CSV header detected, but no data rows were found.</div>`;
    return;
  }

  const headerHTML = dataset.headers.map(header => `<th>${escapeHtml(header)}</th>`).join("");
  const rowsHTML = dataset.rows.slice(0, 10).map(row => `
    <tr>${dataset.headers.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`).join("");

  wrap.innerHTML = `
    <div class="table-responsive">
      <table class="table">
        <thead><tr>${headerHTML}</tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>`;
}

function clearDataset() {
  App.data.pendingDatasetFile = null;
  App.data.uploadedDataset = null;

  const input = document.getElementById("dataset-file");
  const fileName = document.getElementById("dataset-file-name");
  if (input) input.value = "";
  if (fileName) fileName.textContent = "No file selected";

  renderDatasetInfo();
  renderValidation();
  renderSummary();
  renderPreview();
  setDatasetStatus("No dataset uploaded yet.", false);
  toast("Dataset cleared", "bi-arrow-counterclockwise");
}

function renderValidation() {
  const wrap = document.getElementById("dataset-validation");
  if (!wrap) return;
  const dataset = App.data.uploadedDataset;
  if (!dataset) {
    wrap.innerHTML = `<div class="text-center text-muted-2">No dataset uploaded yet.</div>`;
    return;
  }

  const v = dataset.validation;
  const statusClass = v.validationStatus === "Success" ? "pill-no" : "pill-medium";
  wrap.innerHTML = `
    <div class="result-row"><span class="lbl">Missing Values</span><span class="val">${v.missingValues.toLocaleString()}</span></div>
    <div class="result-row"><span class="lbl">Duplicate Rows</span><span class="val">${v.duplicateRows.toLocaleString()}</span></div>
    <div class="result-row"><span class="lbl">Empty Columns</span><span class="val">${v.emptyColumns.toLocaleString()}</span></div>
    <div class="result-row"><span class="lbl">Validation Status</span><span class="pill ${statusClass}">${v.validationStatus}</span></div>`;
}

function renderSummary() {
  const wrap = document.getElementById("dataset-summary");
  if (!wrap) return;
  const dataset = App.data.uploadedDataset;
  if (!dataset && App.data.datasetError) {
    wrap.innerHTML = `<div class="text-center text-muted-2">${App.data.datasetError}</div>`;
    return;
  }
  if (!dataset && App.data.metrics) {
    const m = App.data.metrics;
    wrap.innerHTML = `
      <div class="result-row"><span class="lbl">Total Records</span><span class="val">${m.totalRecords.toLocaleString()}</span></div>
      <div class="result-row"><span class="lbl">Total Complaints</span><span class="val">${m.totalComplaints.toLocaleString()}</span></div>
      <div class="result-row"><span class="lbl">Critical Issues</span><span class="val">${m.criticalIssues.toLocaleString()}</span></div>
      <div class="result-row"><span class="lbl">Escalated Cases</span><span class="val">${m.escalatedCases.toLocaleString()}</span></div>`;
    return;
  }
  if (!dataset) {
    wrap.innerHTML = `<div class="text-center text-muted-2">No dataset uploaded yet.</div>`;
    return;
  }

  const s = dataset.summary;
  wrap.innerHTML = `
    <div class="result-row"><span class="lbl">Total Rows</span><span class="val">${s.totalRows.toLocaleString()}</span></div>
    <div class="result-row"><span class="lbl">Total Columns</span><span class="val">${s.totalColumns.toLocaleString()}</span></div>
    <div class="result-row"><span class="lbl">Numeric Columns</span><span class="val">${s.numericColumns.toLocaleString()}</span></div>
    <div class="result-row"><span class="lbl">Text Columns</span><span class="val">${s.textColumns.toLocaleString()}</span></div>`;
}

function setPendingDatasetFile(file) {
  const input = document.getElementById("dataset-file");
  const fileName = document.getElementById("dataset-file-name");
  if (!file) {
    App.data.pendingDatasetFile = null;
    if (fileName) fileName.textContent = "No file selected";
    return;
  }
  if (!isCSVFile(file)) {
    App.data.pendingDatasetFile = null;
    if (input) input.value = "";
    if (fileName) fileName.textContent = "No file selected";
    setDatasetStatus("No dataset uploaded yet.", false);
    toast("Only .csv files are supported", "bi-exclamation-triangle");
    return;
  }

  App.data.pendingDatasetFile = file;
  if (fileName) fileName.textContent = file.name;
}

function setDatasetStatus(message, loading = false) {
  const status = document.getElementById("dataset-status");
  const spinner = document.getElementById("dataset-spinner");
  if (status) status.textContent = message;
  if (spinner) spinner.style.display = loading ? "inline-block" : "none";
}

function isCSVFile(file) {
  return !!file && /\.csv$/i.test(file.name);
}

function isNumericValue(value) {
  return value !== "" && Number.isFinite(Number(value));
}

function formatBytes(bytes) {
  if (!bytes) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

// ---------- Chatbot ----------
const Chat = {
  open: false,
  responses: {
    "hi": () => `Hi! I can help with telecom terms, dashboard usage, predictions, reports, contact details, and current NOC metrics. Type <strong>Help</strong> to see commands.`,
    "hello": () => `Hello! I can help with telecom terms, dashboard usage, predictions, reports, contact details, and current NOC metrics. Type <strong>Help</strong> to see commands.`,
    "good morning": () => `Good morning! I can help with telecom terms, dashboard usage, predictions, reports, contact details, and current NOC metrics.`,
    "good afternoon": () => `Good afternoon! I can help with telecom terms, dashboard usage, predictions, reports, contact details, and current NOC metrics.`,
    "good evening": () => `Good evening! I can help with telecom terms, dashboard usage, predictions, reports, contact details, and current NOC metrics.`,
    "thank you": () => `You're welcome. Happy to help with the Telecom AI Ops dashboard.`,
    "thanks": () => `You're welcome. Happy to help with the Telecom AI Ops dashboard.`,
    "bye": () => `Goodbye! Have a productive NOC shift.`,
    "goodbye": () => `Goodbye! Have a productive NOC shift.`,
    "help": () => Chat.menu(),
    "menu": () => Chat.menu(),
    "commands": () => Chat.menu(),
    "what is call drop": () => `<strong>Call Drop</strong> means an active voice call disconnects unexpectedly, often because of weak signal, handover failure, interference, or overloaded network resources.`,
    "what is network congestion": () => `<strong>Network Congestion</strong> happens when too many users or sessions compete for limited cell, backhaul, or core network capacity, causing failed calls, slow data, or delays.`,
    "what is slow internet": () => `<strong>Slow Internet</strong> means users get lower-than-expected data speed or high latency, commonly due to weak signal, congestion, poor coverage, device issues, or backhaul saturation.`,
    "what is tower load": () => `<strong>Tower Load</strong> is the percentage of capacity being used at a cell tower or sector. High load can increase call drops, latency, and slow data complaints.`,
    "what is signal strength": () => `<strong>Signal Strength</strong> shows how strongly a device receives the network radio signal. Weaker values can cause no signal, call drops, and poor data quality.`,
    "what is escalation": () => `<strong>Escalation</strong> means routing an issue to a higher support or NOC level because it is severe, repeated, customer-impacting, or needs specialist action.`,
    "what is severity": () => `<strong>Severity</strong> classifies the business and customer impact of an issue, such as Low, Medium, High, or Critical.`,
    "what is root cause": () => `<strong>Root Cause</strong> is the underlying reason a complaint or network issue happened, such as tower congestion, RF coverage failure, power outage, or configuration drift.`,
    "how to predict": () => `To predict an issue, go to <strong>Predict Issue</strong>, enter SIM provider, city, network, issue type, signal, tower load, weather, and previous complaints. The model returns root cause, severity, escalation, and a suggested solution.`,
    "how to upload dataset": () => `This dashboard version uses the loaded project datasets for analytics and predictions. To use a new dataset, add it through the configured project data workflow, then review updated results in <strong>Analytics</strong> and <strong>Reports</strong>.`,
    "how to use reports": () => `Use <strong>Reports</strong> to review prediction history, severity, escalation status, confidence, and root cause. You can export the report as PDF or CSV.`,
    "explain analytics": () => `<strong>Analytics</strong> shows prediction patterns by severity, city, network type, tower load, and recent records so the NOC team can spot trends and recurring risks.`,
    "explain dashboard": () => `<strong>Dashboard</strong> gives a high-level NOC view of total complaints, critical issues, escalated cases, AI accuracy, complaint trends, issue mix, provider split, and recent predictions.`,
    "contact team": () => Chat.contact(),
    "contact support": () => Chat.contact(),
    "email": () => Chat.contact(),
    "version": () => `<strong>Telecom AI Ops Dashboard</strong><br>Version: 1.0<br>Built for telecom complaint prediction, analytics, reports, and NOC recommendations.`,
    "about project": () => `<strong>About Project</strong><br>This dashboard helps telecom operations teams analyze complaints, predict issue severity, identify root causes, recommend actions, and track reports from one workspace.`
  },
  topics: [
    {
      keys: ["critical"],
      answer: () => `There are <strong>${App.data.dashboard.kpis.criticalIssues} critical issues</strong> currently. Top causes: tower congestion, power outages, and RF coverage failures.`
    },
    {
      keys: ["escalat"],
      answer: () => `<strong>${App.data.dashboard.kpis.escalatedCases} cases</strong> are escalated. Most are in the Metro and Rural clusters.`
    },
    {
      keys: ["accuracy", "ai"],
      answer: () => `Current AI model accuracy is <strong>${App.data.dashboard.kpis.aiAccuracy}%</strong>, up from 88.1% in January after weekly retraining.`
    },
    {
      keys: ["complaint", "total"],
      answer: () => `Total complaints tracked: <strong>${App.data.dashboard.kpis.totalComplaints.toLocaleString()}</strong>. Resolution rate is trending up week-over-week.`
    },
    {
      keys: ["predict"],
      answer: () => Chat.responses["how to predict"]()
    },
    {
      keys: ["tower", "load"],
      answer: () => `Highest tower load is on <strong>Tower C (82%)</strong> and <strong>Tower A (78%)</strong>. Consider load balancing or capacity upgrade.`
    },
    {
      keys: ["jio", "airtel", "vi", "bsnl", "provider"],
      answer: () => {
        const p = App.data.dashboard.providerSplit;
        return `Provider complaint share: Jio ${p.data[0]}%, Airtel ${p.data[1]}%, Vi ${p.data[2]}%, BSNL ${p.data[3]}%. Jio leads due to larger subscriber base.`;
      }
    },
    {
      keys: ["report"],
      answer: () => Chat.responses["how to use reports"]()
    },
    {
      keys: ["analytics"],
      answer: () => Chat.responses["explain analytics"]()
    },
    {
      keys: ["dashboard"],
      answer: () => Chat.responses["explain dashboard"]()
    },
    {
      keys: ["support", "contact", "email"],
      answer: () => Chat.contact()
    }
  ],
  init() {
    const fab = document.getElementById("chat-fab");
    const panel = document.getElementById("chat-panel");
    fab.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open") && !Chat._seeded) {
        Chat.botSay("Hi " + (App.user?.name || "there") + ", I'm NOC Assistant. Ask me about complaints, predictions, or network issues.");
        Chat._seeded = true;
      }
    });
    document.getElementById("chat-close").addEventListener("click", () => panel.classList.remove("open"));
    document.getElementById("chat-send").addEventListener("click", Chat.send);
    document.getElementById("chat-input").addEventListener("keydown", e => { if (e.key === "Enter") Chat.send(); });
    document.querySelectorAll(".chat-quick button").forEach(b => b.addEventListener("click", () => {
      document.getElementById("chat-input").value = b.textContent;
      Chat.send();
    }));
  },
  send() {
    const inp = document.getElementById("chat-input");
    const text = inp.value.trim();
    if (!text) return;
    Chat.userSay(text);
    inp.value = "";
    Chat.typing();
    setTimeout(async () => {
      await Chat.respond(text);
    }, 900);
  },
  userSay(t) {
    const body = document.getElementById("chat-body");
    body.insertAdjacentHTML("beforeend", `<div class="chat-msg user"><div class="bubble">${escapeHtml(t)}</div></div>`);
    body.scrollTop = body.scrollHeight;
  },
  botSay(t) {
    const body = document.getElementById("chat-body");
    body.insertAdjacentHTML("beforeend", `<div class="chat-msg bot"><div class="avatar-sm"><i class="bi bi-cpu"></i></div><div class="bubble">${t}</div></div>`);
    body.scrollTop = body.scrollHeight;
  },
  typing() {
    const body = document.getElementById("chat-body");
    body.insertAdjacentHTML("beforeend", `<div class="chat-msg bot" id="typing"><div class="avatar-sm"><i class="bi bi-cpu"></i></div><div class="bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div></div>`);
    body.scrollTop = body.scrollHeight;
  },
  async respond(q) {

    const t = document.getElementById("typing");

    if (t) t.remove();

    const ql = Chat.normalize(q);

    //------------------------------------------------
    // Built-in help commands
    //------------------------------------------------

    const directAnswer = Chat.responses[ql];

    if (directAnswer) {

        Chat.botSay(directAnswer());

        return;

    }

    //------------------------------------------------
    // AI Prediction
    //------------------------------------------------

    try {

        const response = await fetch(
            "http://127.0.0.1:8000/predict",
            {

                method: "POST",

                headers: {
                    "Content-Type":"application/json"
                },

                body: JSON.stringify({

                    SIM_Provider:"Jio",

                    City_Type:"Urban",

                    Network_Type:"5G",

                    Customer_Issue:q,

                    Signal_Strength:"Average",

                    Tower_Load:"High",

                    Weather:"Sunny",

                    Previous_Complaints:1

                })

            }
        );

        const data = await response.json();

        let html = `
        <b>🧠 AI Network Analysis</b><br><br>

        <b>Most Probable Cause</b><br>
        ${data["Root Cause"]}<br><br>
        `;

        if(data["Possible Causes"]){

            html += `<b>Possible Causes</b><br>`;

            data["Possible Causes"].forEach(c=>{

                html += `
                • ${c.Cause}
                (${c.Confidence}%)
                <br>
                `;

            });

            html += "<br>";

        }

        html += `
        <b>Severity</b><br>

        ${data["Severity"]}<br><br>

        <b>Escalation</b><br>

        ${data["Escalation"]}<br><br>
        `;

        if(data["Reason"]){

            html += `
            <b>Reason</b><br>

            ${data["Reason"]}<br><br>
            `;

        }

        if(data["Recommendation"]){

            html += `<b>Recommendations</b><br>`;

            data["Recommendation"].forEach(r=>{

                html += `✅ ${r}<br>`;

            });

        }

        Chat.botSay(html);

    }

    catch(error){

        console.log(error);

        Chat.botSay(
            "❌ Cannot connect to AI server."
        );

    }

},
  normalize(q) {
    return q.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  },
  menu() {
    return `You can ask:<br><strong>Hi</strong>, <strong>Help</strong>, <strong>What is Call Drop?</strong>, <strong>What is Network Congestion?</strong>, <strong>How to predict?</strong>, <strong>How to use reports?</strong>, <strong>Explain analytics.</strong>, <strong>Contact Support</strong>, or <strong>About Project</strong>.`;
  },
  contact() {
    return `<strong>Contact Support</strong><br>Email: telecom-ops-support@example.com<br>Team: NOC Operations Support<br>Use this contact for dashboard access, dataset, prediction, or report issues.`;
  },
  fallback() {
    return `I am not sure about that yet. Try asking <strong>Help</strong>, <strong>What is Call Drop?</strong>, <strong>What is Signal Strength?</strong>, <strong>How to predict?</strong>, <strong>Explain dashboard.</strong>, or <strong>Contact Support</strong>.`;
  }
};

// ---------- Helpers ----------
function val(id) { return document.getElementById(id).value; }
function cleanValue(value) { return String(value ?? "").trim(); }
function titleCase(value) {
  return cleanValue(value).toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}
function sentenceCase(value) {
  const text = cleanValue(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}
function normalizeYesNo(value) {
  return /^y(es)?$/i.test(cleanValue(value)) ? "Yes" : "No";
}
function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function dateKey(date) {
  return date.toISOString().slice(0, 10);
}
function monthKey(date) {
  return date.toISOString().slice(0, 7);
}
function formatDate(date) {
  return date.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function formatMonthLabel(key) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}
function formatRelativeDate(date) {
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
function tableMessage(message, colspan) {
  return `<tr><td colspan="${colspan}" class="text-center text-muted-2 p-4">${message}</td></tr>`;
}
function dataMessage(message) {
  return `<div class="text-center text-muted-2 p-4">${message}</div>`;
}
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function mkChart(id, type, data, options) {
  const el = document.getElementById(id);
  if (!el) return;
  if (App.charts[id]) App.charts[id].destroy();
  App.charts[id] = new Chart(el, { type, data, options: { responsive: true, maintainAspectRatio: false, ...options } });
}
function defaultScales() {
  return {
    x: { grid: { display: false }, ticks: { color: "#6b7785" } },
    y: { grid: { color: "#eef2f7" }, ticks: { color: "#6b7785" }, beginAtZero: true },
  };
}
function palette() {
  return ["#0b5cad", "#00a3a3", "#e08a00", "#d6362e", "#1f9d55", "#7c3aed", "#0891b2", "#b45309"];
}

// ---------- Sidebar mobile ----------
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sb-backdrop").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sb-backdrop").classList.remove("show");
}

// ---------- Settings ----------
function saveSettings(e) {
  e.preventDefault();
  toast("Settings saved successfully");
}

// ---------- Init ----------
async function initApp() {
  if (!checkAuth()) return;
  await loadDataset();
  const nameEl = document.getElementById("user-name");
  if (nameEl) nameEl.textContent = App.user.name;
  const avEl = document.getElementById("user-avatar");
  if (avEl) avEl.textContent = App.user.name.charAt(0).toUpperCase();
  initDatasetUpload();
  Chat.init();
  navigate("dashboard");
}
