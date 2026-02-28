/**
 * ui.js — Emergency Form interactivity + session restore on refresh
 * Depends on: geolocation.js (must load first)
 */

const EmergencyUI = (() => {

  const state = {
    lat: null, lng: null, locationReady: false,
    triageData: null, locationData: null,
    animating: false, step: 1,
  };

  const $ = (id) => document.getElementById(id);

  function show(id) {
    const el = $(id); if (!el) return;
    el.classList.remove("hidden");
    el.style.animation = "none"; void el.offsetWidth;
    el.style.animation = "fadeSlideIn 0.4s ease forwards";
  }
  function hide(id) { $(id)?.classList.add("hidden"); }

  function setStep(n) {
    state.step = n;
    document.querySelectorAll(".step-pill").forEach((el, i) => {
      el.classList.toggle("active", i + 1 === n);
      el.classList.toggle("done",   i + 1 < n);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOCATION UI
  // ══════════════════════════════════════════════════════════════════════════

  function setLocState(status, details, icon, boxClass) {
    const locBox     = $("locBox");
    const statusEl   = $("locStatus");
    const detailsEl  = $("locDetails");
    const iconEl     = $("locIcon");

    if (statusEl)  statusEl.textContent  = status;
    if (detailsEl) detailsEl.textContent = details;
    if (iconEl)    iconEl.textContent    = icon;

    if (locBox) {
      locBox.classList.remove("loc-ready", "loc-error", "loc-detecting");
      if (boxClass) locBox.classList.add(boxClass);
    }
  }

  document.addEventListener("location:update", (e) => {
    const { lat, lng, accuracy } = e.detail || {};
    state.lat = lat; state.lng = lng;
    state.locationReady = typeof lat === "number" && typeof lng === "number";

    if (state.locationReady) {
      const acc = accuracy ? `±${Math.round(accuracy)} m accuracy` : "";
      setLocState(
        "✓ Location detected",
        `${lat.toFixed(5)}, ${lng.toFixed(5)}  ${acc}`,
        "📍",
        "loc-ready"
      );
      hide("manualLocWrap");
    }
    updateSubmitBtn();
  });

  document.addEventListener("location:error", (e) => {
    const { code } = e.detail || {};
    const msg = code === 1
      ? "Permission denied — enable location in browser settings"
      : "Could not detect location — use manual entry below";

    setLocState("⚠ Location unavailable", msg, "❌", "loc-error");
    show("manualLocWrap");
    updateSubmitBtn();
  });

  // ── DOMContentLoaded ──────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    $("message")?.addEventListener("input", updateSubmitBtn);

    // Retry button
    $("retryLocBtn")?.addEventListener("click", () => {
      setLocState("Detecting your location…", "Allow location access when prompted", "⏳", "");
      hide("manualLocWrap");
      state.locationReady = false;
      updateSubmitBtn();
      GeoService.retry();
    });

    // Manual coords
    $("manualLocBtn")?.addEventListener("click", applyManualCoords);
    $("manualLat")?.addEventListener("keydown", (e) => { if (e.key === "Enter") applyManualCoords(); });
    $("manualLng")?.addEventListener("keydown", (e) => { if (e.key === "Enter") applyManualCoords(); });

    updateSubmitBtn();
    await restoreSession();
  });

  function applyManualCoords() {
    const lat = parseFloat($("manualLat")?.value);
    const lng = parseFloat($("manualLng")?.value);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast("Enter valid latitude (−90–90) and longitude (−180–180)", "warn");
      return;
    }

    state.lat = lat; state.lng = lng; state.locationReady = true;
    setLocState(
      "✓ Manual location set",
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      "📍",
      "loc-ready"
    );
    hide("manualLocWrap");
    updateSubmitBtn();
    showToast("Manual coordinates applied.", "success");
  }

  function updateSubmitBtn() {
    const btn = $("submitBtn"); if (!btn) return;
    const msg   = ($("message")?.value || "").trim();
    const ready = state.locationReady && msg.length >= 5;
    btn.disabled = !ready;
    btn.classList.toggle("btn-ready", ready);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION RESTORE
  // ══════════════════════════════════════════════════════════════════════════
  async function restoreSession() {
    try {
      const res  = await fetch("/session-state");
      const data = await res.json();
      const { emergency, booking } = data;
      if (!emergency) { setStep(1); return; }

      state.triageData   = emergency.triage;
      state.locationData = emergency.location;

      showRestoredBanner();
      renderTriage(emergency.triage, emergency.location,
                   emergency.ambulance_status, emergency.expected_bill);

      if (booking) {
        renderConfirmation({
          case_id: booking.case_id, hospital: booking.hospital_name,
          available_beds: booking.available_beds,
        });
        hide("hospitalSection"); setStep(3);
      } else {
        renderHospitals(emergency.hospitals); setStep(2);
      }

      try {
        sessionStorage.setItem("emergencyResult", JSON.stringify({
          triage: emergency.triage, location: emergency.location,
          hospitals: emergency.hospitals,
          ambulance_status: emergency.ambulance_status,
          expected_bill: emergency.expected_bill,
        }));
      } catch (_) {}

    } catch (err) {
      console.warn("Session restore failed:", err); setStep(1);
    }
  }

  function showRestoredBanner() {
    document.querySelector(".restore-banner")?.remove();
    const banner = document.createElement("div");
    banner.className = "restore-banner";
    banner.innerHTML = `<span>🔄 Previous emergency data restored.</span>
      <button id="clearSessionBtn" type="button">Start New</button>`;
    document.querySelector(".container")?.prepend(banner);
    document.getElementById("clearSessionBtn")?.addEventListener("click", clearSession);
  }

  async function clearSession() {
    try { await fetch("/session-clear", { method: "POST" }); } catch (_) {}
    document.querySelector(".restore-banner")?.remove();
    hide("triageSection"); hide("hospitalSection"); hide("confirmSection");
    if ($("message")) $("message").value = "";
    state.triageData = null; state.locationData = null; state.animating = false;
    try { sessionStorage.removeItem("emergencyResult"); } catch (_) {}
    setStep(1); updateSubmitBtn();
    showToast("Session cleared — ready for a new emergency.", "info");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEND EMERGENCY
  // ══════════════════════════════════════════════════════════════════════════
  async function sendEmergency() {
    const message = ($("message")?.value || "").trim();
    if (!message) return showToast("Please describe the emergency.", "warn");

    let lat = state.lat, lng = state.lng;

    // Last-chance GPS attempt if still not ready
    if (!state.locationReady) {
      if (!navigator.geolocation) {
        show("manualLocWrap");
        return showToast("Geolocation not supported — enter coordinates manually.", "warn");
      }
      try {
        showToast("Fetching location one more time…", "info");
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej,
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
        state.lat = lat; state.lng = lng; state.locationReady = true;
      } catch {
        show("manualLocWrap");
        return showToast("Location unavailable. Enter coordinates manually below.", "error");
      }
    }

    setLoading(true, "Analyzing emergency & finding nearby hospitals…");
    setStep(2);
    hide("triageSection"); hide("hospitalSection"); hide("confirmSection");
    document.querySelector(".restore-banner")?.remove();

    try {
      const res  = await fetch("/emergency", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, lat, lng }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.error) { setStep(1); return showToast("Error: " + data.error, "error"); }

      state.triageData   = data.triage;
      state.locationData = data.location;

      try {
        sessionStorage.setItem("emergencyResult", JSON.stringify({
          triage: data.triage, location: data.location, hospitals: data.hospitals,
          ambulance_status: data.ambulance_status, expected_bill: data.expected_bill,
        }));
      } catch (_) {}

      renderTriage(data.triage, data.location, data.ambulance_status, data.expected_bill);
      renderHospitals(data.hospitals);

    } catch (err) {
      setLoading(false); setStep(1);
      showToast("Network error: " + err.message, "error");
    }
  }

  // ─── Triage Render ────────────────────────────────────────────────────────
  function renderTriage(triage, location, ambulance, bill) {
    const level      = triage.severity_level || "Low";
    const badgeClass = level === "Critical" ? "badge-critical" : level === "Moderate" ? "badge-moderate" : "badge-low";
    const scorePercent = ((triage.severity_score || 0) / 10) * 100;
    $("triageBox").innerHTML = `
      <div class="triage-grid">
        <div class="triage-item"><span class="triage-label">Emergency Type</span><span class="triage-value">${triage.emergency_type||"—"}</span></div>
        <div class="triage-item"><span class="triage-label">Specialist Needed</span><span class="triage-value">${triage.required_specialist||"—"}</span></div>
        <div class="triage-item"><span class="triage-label">Location</span><span class="triage-value">${location||"—"}</span></div>
        <div class="triage-item"><span class="triage-label">Ambulance</span><span class="triage-value">${ambulance||"—"}</span></div>
        <div class="triage-item"><span class="triage-label">Est. Bill</span><span class="triage-value">${bill||"—"}</span></div>
        <div class="triage-item"><span class="triage-label">Severity</span>
          <span class="triage-value severity-row">
            <span class="score-num">${triage.severity_score}/10</span>
            <span class="badge ${badgeClass}">${level}</span>
          </span>
          <div class="severity-bar-wrap"><div class="severity-bar" style="width:0%" data-width="${scorePercent}%"></div></div>
        </div>
      </div>`;
    show("triageSection");
    requestAnimationFrame(() => setTimeout(() => {
      const bar = document.querySelector(".severity-bar");
      if (bar) bar.style.width = bar.dataset.width;
    }, 200));
  }

  // ─── Hospital Render ──────────────────────────────────────────────────────
  function renderHospitals(hospitals) {
    const list = $("hospitalList"); if (!list) return;
    list.innerHTML = "";
    if (!hospitals || hospitals.length === 0) {
      list.innerHTML = `<p class="no-data">No hospitals found nearby.</p>`;
      show("hospitalSection"); return;
    }
    hospitals.forEach((h, idx) => {
      const distKm = (h.distance_meters / 1000).toFixed(1);
      const card = document.createElement("div");
      card.className = "hospital-card";
      card.style.animationDelay = `${idx * 0.08}s`;
      card.innerHTML = `
        <div class="hosp-info">
          <span class="hosp-name">${h.name}</span>
          <span class="hosp-dist">📍 ${distKm} km away</span>
        </div>
        <button class="btn-select" data-name="${h.name.replace(/"/g,"&quot;")}">Reserve Bed</button>`;
      list.appendChild(card);
    });
    list.querySelectorAll(".btn-select").forEach(btn =>
      btn.addEventListener("click", () => selectHospital(btn.dataset.name)));
    show("hospitalSection");
  }

  // ─── Select Hospital ──────────────────────────────────────────────────────
  async function selectHospital(hospitalName) {
    if (!state.triageData) return showToast("Submit emergency first.", "warn");
    if (state.animating) return;
    state.animating = true;
    document.querySelectorAll(".hospital-card").forEach(card => {
      const btn = card.querySelector(".btn-select");
      if (btn && btn.dataset.name === hospitalName) { card.classList.add("selected"); btn.textContent = "Reserving…"; btn.disabled = true; }
      else card.classList.add("dimmed");
    });
    try {
      const res  = await fetch("/select-hospital", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospital_name: hospitalName, triage: state.triageData, location: state.locationData }),
      });
      const data = await res.json();
      if (data.error) {
        state.animating = false;
        document.querySelectorAll(".hospital-card").forEach(c => c.classList.remove("selected","dimmed"));
        document.querySelectorAll(".btn-select").forEach(b => { b.disabled = false; b.textContent = "Reserve Bed"; });
        return showToast("Error: " + data.error, "error");
      }
      renderConfirmation(data); hide("hospitalSection"); setStep(3);
    } catch (err) { state.animating = false; showToast("Network error: " + err.message, "error"); }
  }

  // ─── Confirmation ─────────────────────────────────────────────────────────
  function renderConfirmation(data) {
    $("confirmMsg").innerHTML = `
      <div class="confirm-icon">✅</div>
      <h3 class="confirm-title">Bed Reserved Successfully!</h3>
      <div class="confirm-grid">
        <div class="confirm-item"><span class="confirm-label">Case ID</span><span class="confirm-val">#${data.case_id}</span></div>
        <div class="confirm-item"><span class="confirm-label">Hospital</span><span class="confirm-val">${data.hospital||data.hospital_name}</span></div>
        <div class="confirm-item"><span class="confirm-label">Available Beds</span><span class="confirm-val">${data.available_beds}</span></div>
      </div>
      <p class="confirm-note">A doctor will be assigned shortly. Please proceed to the hospital.</p>`;
    show("confirmSection"); launchConfetti();
  }

  // ─── Loader ───────────────────────────────────────────────────────────────
  function setLoading(active, msg) {
    const loader = $("loader"), btn = $("submitBtn"); if (!loader) return;
    if (active) {
      loader.innerHTML = `<div class="loader-inner"><div class="pulse-ring"></div><span>${msg||"Loading…"}</span></div>`;
      loader.classList.remove("hidden");
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    } else {
      loader.classList.add("hidden");
      if (btn) { btn.textContent = "Send Emergency Alert →"; updateSubmitBtn(); }
    }
  }

  // ─── Toast ────────────────────────────────────────────────────────────────
  function showToast(msg, type = "info") {
    document.querySelector(".toast")?.remove();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("toast-show"));
    setTimeout(() => { toast.classList.remove("toast-show"); setTimeout(() => toast.remove(), 300); }, 3800);
  }

  // ─── Confetti ─────────────────────────────────────────────────────────────
  function launchConfetti() {
    const colors = ["#27ae60","#2980b9","#f39c12","#8e44ad","#e74c3c"];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("div");
      c.className = "confetti-piece";
      c.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${0.8+Math.random()*1.2}s;animation-delay:${Math.random()*0.4}s;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;border-radius:${Math.random()>0.5?"50%":"2px"};`;
      document.body.appendChild(c);
      c.addEventListener("animationend", () => c.remove());
    }
  }

  return { sendEmergency, clearSession };
})();

window.sendEmergency = EmergencyUI.sendEmergency;