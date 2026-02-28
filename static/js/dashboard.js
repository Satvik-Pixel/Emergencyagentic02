/**
 * dashboard.js
 * Powers the Doctor Dashboard with live polling, animations, and filtering
 */

const DoctorDashboard = (() => {
  let pollInterval = null;
  let allCases = [];
  let activeFilter = "all";
  let lastCaseCount = 0;

  const POLL_MS = 5000;

  // ─── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    bindFilters();
    loadCases();
    pollInterval = setInterval(loadCases, POLL_MS);
    startClock();
  });

  // ─── Clock ─────────────────────────────────────────────────────────────────
  function startClock() {
    const clockEl = document.getElementById("liveClock");
    if (!clockEl) return;
    function tick() {
      clockEl.textContent = new Date().toLocaleTimeString();
    }
    tick();
    setInterval(tick, 1000);
  }

  // ─── Fetch Cases ───────────────────────────────────────────────────────────
  async function loadCases() {
    try {
      const res  = await fetch("/doctor-requests");
      const data = await res.json();
      allCases = data;

      // Badge on tab title
      const pending = data.filter(c => c.status === "Bed Reserved").length;
      document.title = pending > 0
        ? `(${pending}) Doctor Dashboard — EmergencyAI`
        : "Doctor Dashboard — EmergencyAI";

      updateStats(data);
      renderCases(data);
      updateLastRefresh();

      // Alert on new cases
      if (data.length > lastCaseCount && lastCaseCount > 0) {
        notifyNewCase();
      }
      lastCaseCount = data.length;

    } catch (err) {
      console.error("Failed to load cases:", err);
      showConnectionError(true);
    }
  }

  // ─── Stats Banner ──────────────────────────────────────────────────────────
  function updateStats(cases) {
    const countEl     = document.getElementById("statTotal");
    const pendingEl   = document.getElementById("statPending");
    const enrouteEl   = document.getElementById("statEnRoute");
    const completedEl = document.getElementById("statCompleted");

    if (countEl)     countEl.textContent    = cases.length;
    if (pendingEl)   pendingEl.textContent  = cases.filter(c => c.status === "Bed Reserved").length;
    if (enrouteEl)   enrouteEl.textContent  = cases.filter(c => c.status === "En Route").length;
    if (completedEl) completedEl.textContent = cases.filter(c => c.status === "Completed").length;
  }

  // ─── Filters ───────────────────────────────────────────────────────────────
  function bindFilters() {
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        renderCases(allCases);
      });
    });
  }

  function filterCases(cases) {
    if (activeFilter === "all")      return cases;
    if (activeFilter === "reserved") return cases.filter(c => c.status === "Bed Reserved");
    if (activeFilter === "enroute")  return cases.filter(c => c.status === "En Route");
    if (activeFilter === "done")     return cases.filter(c => c.status === "Completed");
    return cases;
  }

  // ─── Render Cases ──────────────────────────────────────────────────────────
  function renderCases(cases) {
    const container = document.getElementById("cases");
    if (!container) return;

    const filtered = filterCases(cases);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏥</div>
          <p>No cases to display</p>
        </div>`;
      return;
    }

    // Sort: Reserved → En Route → Completed
    const order = { "Bed Reserved": 0, "En Route": 1, "Completed": 2 };
    const sorted = [...filtered].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

    container.innerHTML = sorted.map((c, idx) => renderCaseCard(c, idx)).join("");

    // Bind action buttons
    container.querySelectorAll("[data-action='accept']").forEach(btn => {
      btn.addEventListener("click", () => acceptCase(parseInt(btn.dataset.id)));
    });
    container.querySelectorAll("[data-action='complete']").forEach(btn => {
      btn.addEventListener("click", () => completeCase(parseInt(btn.dataset.id)));
    });
  }

  function renderCaseCard(c, idx) {
    const statusMap = {
      "Bed Reserved": { cls: "status-reserved", label: "Reserved",  icon: "🟡" },
      "En Route":     { cls: "status-enroute",  label: "En Route",  icon: "🔵" },
      "Completed":    { cls: "status-complete", label: "Completed", icon: "🟢" },
    };
    const s = statusMap[c.status] || { cls: "", label: c.status, icon: "⚪" };

    const sevClass = c.severity_level === "Critical" ? "sev-critical"
                   : c.severity_level === "Moderate"  ? "sev-moderate"
                   : "sev-low";

    const dispatchHtml = c.dispatch ? `
      <div class="dispatch-panel">
        <div class="dispatch-row">
          <span class="dispatch-icon">🚑</span>
          <span>${c.dispatch.dispatch_status}</span>
        </div>
        <div class="dispatch-meta">
          <span><strong>ETA:</strong> ${c.dispatch.eta || "—"}</span>
          <span><strong>Priority:</strong> ${c.dispatch.priority_level}</span>
          <span><strong>Ambulance:</strong> ${c.dispatch.ambulance_required ? "Required" : "Not Required"}</span>
        </div>
      </div>
    ` : "";

    const actionHtml = c.status === "Bed Reserved"
      ? `<button class="btn btn-accept" data-action="accept" data-id="${c.case_id}">
           <span class="btn-icon">✓</span> Accept Case
         </button>`
      : c.status === "En Route"
      ? `<button class="btn btn-complete" data-action="complete" data-id="${c.case_id}">
           <span class="btn-icon">🏁</span> Mark Completed
         </button>`
      : `<span class="done-label">✓ Completed</span>`;

    return `
      <div class="case-card ${c.status === 'Bed Reserved' ? 'case-urgent' : ''}" 
           style="animation-delay:${idx * 0.06}s">
        <div class="case-header">
          <div class="case-id-wrap">
            <span class="case-id">#${c.case_id}</span>
            <span class="status-badge ${s.cls}">${s.icon} ${s.label}</span>
          </div>
          <span class="severity-tag ${sevClass}">${c.severity_level || "—"}</span>
        </div>
        <div class="case-body">
          <div class="case-field">
            <span class="field-label">Hospital</span>
            <span class="field-val">🏥 ${c.hospital_name}</span>
          </div>
          <div class="case-field">
            <span class="field-label">Specialist</span>
            <span class="field-val">👨‍⚕️ ${c.required_specialist || "—"}</span>
          </div>
          ${c.emergency_type ? `
          <div class="case-field">
            <span class="field-label">Emergency</span>
            <span class="field-val">⚠️ ${c.emergency_type}</span>
          </div>` : ""}
          ${c.location ? `
          <div class="case-field">
            <span class="field-label">Location</span>
            <span class="field-val">📍 ${c.location}</span>
          </div>` : ""}
        </div>
        ${dispatchHtml}
        <div class="case-actions">
          ${actionHtml}
        </div>
      </div>
    `;
  }

  // ─── Accept Case ───────────────────────────────────────────────────────────
  async function acceptCase(id) {
    const btn = document.querySelector(`[data-action='accept'][data-id='${id}']`);
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="btn-icon">⏳</span> Accepting…`; }

    try {
      const res  = await fetch(`/accept-case/${id}`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        showToast("Error: " + data.error, "error");
        if (btn) { btn.disabled = false; btn.innerHTML = `<span class="btn-icon">✓</span> Accept Case`; }
      } else {
        showToast(`Case #${id} accepted — dispatch triggered!`, "success");
        loadCases();
      }
    } catch (err) {
      showToast("Network error: " + err.message, "error");
    }
  }

  // ─── Complete Case ─────────────────────────────────────────────────────────
  async function completeCase(id) {
    const btn = document.querySelector(`[data-action='complete'][data-id='${id}']`);
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="btn-icon">⏳</span> Completing…`; }

    try {
      const res  = await fetch(`/complete-case/${id}`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        showToast("Error: " + data.error, "error");
        if (btn) { btn.disabled = false; btn.innerHTML = `<span class="btn-icon">🏁</span> Mark Completed`; }
      } else {
        showToast(`Case #${id} completed. Bed released.`, "success");
        loadCases();
      }
    } catch (err) {
      showToast("Network error: " + err.message, "error");
    }
  }

  // ─── Misc ──────────────────────────────────────────────────────────────────
  function updateLastRefresh() {
    const el = document.getElementById("lastRefresh");
    if (el) el.textContent = "Updated " + new Date().toLocaleTimeString();
    showConnectionError(false);
  }

  function showConnectionError(show) {
    const el = document.getElementById("connError");
    if (el) el.classList.toggle("hidden", !show);
  }

  function notifyNewCase() {
    showToast("🚨 New emergency case received!", "warn");
    // Flash the title
    let flashes = 0;
    const orig = document.title;
    const flash = setInterval(() => {
      document.title = flashes % 2 === 0 ? "🚨 NEW CASE!" : orig;
      if (++flashes > 6) { clearInterval(flash); document.title = orig; }
    }, 500);
  }

  function showToast(msg, type = "info") {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("toast-show"));
    setTimeout(() => {
      toast.classList.remove("toast-show");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

})();