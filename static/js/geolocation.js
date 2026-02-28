/**
 * geolocation.js — Robust GPS detection
 * Auto-starts on load, retries on failure, dispatches events to ui.js
 */

const GeoService = (() => {
  let watchId      = null;
  let lastPosition = null;
  let retryTimer   = null;
  let attempts     = 0;
  const MAX_ATTEMPTS = 3;

  function dispatch(lat, lng, accuracy) {
    lastPosition = { lat, lng, accuracy };
    document.dispatchEvent(
      new CustomEvent("location:update", { detail: { lat, lng, accuracy } })
    );
  }

  function dispatchError(code, message) {
    document.dispatchEvent(
      new CustomEvent("location:error", { detail: { code, message } })
    );
  }

  function onSuccess(pos) {
    attempts = 0; // reset on success
    clearTimeout(retryTimer);
    dispatch(
      pos.coords.latitude,
      pos.coords.longitude,
      pos.coords.accuracy
    );
  }

  function onError(err) {
    console.warn(`Geolocation error (attempt ${attempts}):`, err.message);

    if (err.code === 1) {
      // PERMISSION_DENIED — no point retrying
      dispatchError(err.code, "Permission denied");
      return;
    }

    // POSITION_UNAVAILABLE (2) or TIMEOUT (3) — retry up to MAX_ATTEMPTS
    if (attempts < MAX_ATTEMPTS) {
      attempts++;
      retryTimer = setTimeout(() => start(false), 2000 * attempts);
    } else {
      dispatchError(err.code, err.message);
    }
  }

  /**
   * @param {boolean} resetWatch - clear existing watch before starting
   */
  function start(resetWatch = true) {
    if (!navigator.geolocation) {
      dispatchError(0, "Geolocation not supported in this browser");
      return;
    }

    if (resetWatch && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    // 1️⃣ Immediate one-shot request (fastest first response)
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout:            10000,
      maximumAge:         0,
    });

    // 2️⃣ Continuous watch for updates
    watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout:            15000,
      maximumAge:         5000,
    });
  }

  function retry() {
    attempts = 0;
    clearTimeout(retryTimer);
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    start(false);
  }

  function getLastPosition() { return lastPosition; }

  // Auto-start as soon as DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => start());
  } else {
    start(); // DOM already ready
  }

  return { start, retry, getLastPosition };
})();