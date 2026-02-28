from flask import Flask, jsonify, request, render_template, session
import threading
from flask_session import Session

from Agents.location_agent import run_location_agent
from Agents.triage_agent import run_triage
from Agents.hospital_agent import run_hospital_agent
from Agents.dispatch_agent import run_dispatch_agent

import os

app = Flask(__name__)

# ==================================
# Session Configuration
# ==================================
app.config["SECRET_KEY"]          = os.environ.get("SECRET_KEY") or os.urandom(24)
app.config["SESSION_PERMANENT"]   = False
app.config["SESSION_TYPE"]        = "filesystem"          # stores sessions in ./flask_session/
app.config["SESSION_FILE_DIR"]    = os.path.join(os.path.dirname(__file__), "flask_session")
app.config["SESSION_FILE_THRESHOLD"] = 500                # max session files on disk
app.config["SESSION_USE_SIGNER"]  = True                  # cryptographically sign the cookie
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

Session(app)   # initialise flask-session

# ==================================
# In-Memory Storage (server-wide)
# ==================================
lock = threading.Lock()
cases: list        = []
case_counter: int  = 1

# { "Hospital Name": { "total_beds": 10, "booked_beds": 0 } }
hospital_bed_tracker: dict = {}


# ──────────────────────────────────────────────────────────────────────────────
# SESSION HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _session_save_emergency(triage, location, hospitals, ambulance_status,
                             doctor_status, expected_bill):
    """Persist the triage/hospital result into the Flask session."""
    session["emergency"] = {
        "triage":           triage,
        "location":         location,
        "hospitals":        hospitals,
        "ambulance_status": ambulance_status,
        "doctor_status":    doctor_status,
        "expected_bill":    expected_bill,
    }
    session.modified = True


def _session_save_booking(case_id, hospital_name, available_beds):
    """Persist the booking confirmation into the Flask session."""
    session["booking"] = {
        "case_id":        case_id,
        "hospital_name":  hospital_name,
        "available_beds": available_beds,
    }
    session.modified = True


def _session_clear():
    """Wipe the current user's emergency/booking session data."""
    session.pop("emergency", None)
    session.pop("booking",   None)
    session.modified = True


# ──────────────────────────────────────────────────────────────────────────────
# API: SESSION STATE  — frontend calls this on every page load/refresh
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/session-state", methods=["GET"])
def session_state():
    """
    Returns whatever emergency / booking data the server has stored for
    this browser session so the frontend can restore its UI state after a refresh.
    """
    return jsonify({
        "emergency": session.get("emergency"),   # None if not set
        "booking":   session.get("booking"),     # None if not set
    })


@app.route("/session-clear", methods=["POST"])
def session_clear():
    """Lets the frontend explicitly reset a session (e.g. 'Start New Emergency')."""
    _session_clear()
    return jsonify({"message": "Session cleared"})


# ──────────────────────────────────────────────────────────────────────────────
# STEP 1 — Emergency Request
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/emergency", methods=["POST"])
def emergency():
    try:
        data = request.get_json()

        user_input = data.get("message")
        lat        = data.get("lat")
        lng        = data.get("lng")

        if not user_input or lat is None or lng is None:
            return jsonify({"error": "Missing required fields"}), 400

        # 1. TRIAGE
        triage = run_triage(user_input)
        if "error" in triage:
            return jsonify(triage), 400

        # 2. LOCATION
        location = run_location_agent(lat, lng)

        # 3. HOSPITAL SEARCH
        hospitals_data = run_hospital_agent(
            lat, lng,
            triage["severity_score"],
            triage["required_specialist"],
        )
        recommended = hospitals_data.get("recommended_hospitals", [])

        # Pre-register hospitals in bed tracker
        for hospital in recommended:
            name = hospital["name"]
            if name not in hospital_bed_tracker:
                hospital_bed_tracker[name] = {"total_beds": 10, "booked_beds": 0}

        ambulance_status = hospitals_data.get("ambulance_status", "")
        doctor_status    = hospitals_data.get("doctor_status_user_view", "")
        expected_bill    = hospitals_data.get("expected_bill", "")

        # ── Save to session ──────────────────────────────────────────────────
        # Clear any previous booking if user is starting a new emergency
        session.pop("booking", None)
        _session_save_emergency(
            triage, location, recommended,
            ambulance_status, doctor_status, expected_bill,
        )

        return jsonify({
            "triage":           triage,
            "location":         location,
            "hospitals":        recommended,
            "ambulance_status": ambulance_status,
            "doctor_status":    doctor_status,
            "expected_bill":    expected_bill,
        })

    except Exception as e:
        print("ERROR /emergency:", str(e))
        return jsonify({"error": str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# STEP 2 — User selects a hospital
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/select-hospital", methods=["POST"])
def select_hospital():
    global case_counter

    try:
        data = request.get_json()

        hospital_name = data.get("hospital_name")
        triage        = data.get("triage")
        location      = data.get("location")

        if not hospital_name or not triage:
            return jsonify({"error": "Missing hospital_name or triage"}), 400

        if hospital_name not in hospital_bed_tracker:
            return jsonify({"error": "Hospital not registered. Submit emergency first."}), 404

        with lock:
            hospital = hospital_bed_tracker[hospital_name]
            if hospital["booked_beds"] >= hospital["total_beds"]:
                return jsonify({"error": "No beds available at this hospital"}), 400
            hospital["booked_beds"] += 1

        case = {
            "case_id":             case_counter,
            "hospital_name":       hospital_name,
            "severity_score":      triage.get("severity_score"),
            "severity_level":      triage.get("severity_level"),
            "required_specialist": triage.get("required_specialist"),
            "emergency_type":      triage.get("emergency_type", ""),
            "location":            location,
            "status":              "Bed Reserved",
        }

        with lock:
            cases.append(case)
            case_counter += 1

        available = hospital["total_beds"] - hospital["booked_beds"]

        # ── Save booking to session ──────────────────────────────────────────
        _session_save_booking(case["case_id"], hospital_name, available)

        return jsonify({
            "message":        "Bed Reserved Successfully",
            "case_id":        case["case_id"],
            "hospital":       hospital_name,
            "available_beds": available,
        })

    except Exception as e:
        print("ERROR /select-hospital:", str(e))
        return jsonify({"error": str(e)}), 500


# ──────────────────────────────────────────────────────────────────────────────
# STEP 3 — Doctor Dashboard
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/doctor-dashboard")
def doctor_dashboard():
    return render_template("doctor_dashboard.html")


@app.route("/doctor-requests", methods=["GET"])
def doctor_requests():
    active = [
        c for c in cases
        if c.get("status") in ("Bed Reserved", "En Route", "Completed")
    ]
    return jsonify(active)


# ──────────────────────────────────────────────────────────────────────────────
# STEP 4 — Doctor accepts a case
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/accept-case/<int:case_id>", methods=["POST"])
def accept_case(case_id):
    case = next((c for c in cases if c["case_id"] == case_id), None)

    if not case:
        return jsonify({"error": "Case not found"}), 404

    if case["status"] != "Bed Reserved":
        return jsonify({"error": f"Cannot accept case with status: {case['status']}"}), 400

    case["status"] = "Doctor Assigned"
    dispatch        = run_dispatch_agent(case["severity_level"])
    case["dispatch"] = dispatch
    case["status"]   = "En Route"

    return jsonify({
        "message":  "Doctor accepted. Dispatch triggered.",
        "case_id":  case_id,
        "dispatch": dispatch,
    })


# ──────────────────────────────────────────────────────────────────────────────
# STEP 5 — Mark case complete
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/complete-case/<int:case_id>", methods=["POST"])
def complete_case(case_id):
    case = next((c for c in cases if c["case_id"] == case_id), None)

    if not case:
        return jsonify({"error": "Case not found"}), 404

    if case["status"] != "En Route":
        return jsonify({"error": f"Cannot complete case with status: {case['status']}"}), 400

    hospital_name = case["hospital_name"]

    with lock:
        if hospital_name in hospital_bed_tracker:
            h = hospital_bed_tracker[hospital_name]
            if h["booked_beds"] > 0:
                h["booked_beds"] -= 1

    case["status"] = "Completed"

    return jsonify({
        "message":  "Case completed",
        "case_id":  case_id,
        "hospital": hospital_name,
    })


# ──────────────────────────────────────────────────────────────────────────────
# Hospital Status (admin / debug)
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/hospital-status", methods=["GET"])
def hospital_status():
    return jsonify([
        {
            "hospital_name":  name,
            "total_beds":     info["total_beds"],
            "booked_beds":    info["booked_beds"],
            "available_beds": info["total_beds"] - info["booked_beds"],
        }
        for name, info in hospital_bed_tracker.items()
    ])


# ──────────────────────────────────────────────────────────────────────────────
# Pages
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return render_template("landing.html")


@app.route("/emergency-form")
def emergency_form():
    return render_template("index.html")


@app.route("/result")
def result_page():
    return render_template("emergency_result.html")


if __name__ == "__main__":
    app.run(debug=True)