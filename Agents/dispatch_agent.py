def run_dispatch_agent(severity_level):

    if severity_level == "Critical":
        return {
            "ambulance_required": True,
            "priority_level": "HIGH",
            "dispatch_status": "Ambulance Dispatched",
            "eta": "5 minutes"
        }

    elif severity_level == "Moderate":
        return {
            "ambulance_required": True,
            "priority_level": "MEDIUM",
            "dispatch_status": "Ambulance Queued",
            "eta": "10 minutes"
        }

    else:
        return {
            "ambulance_required": False,
            "priority_level": "LOW",
            "dispatch_status": "No Ambulance Required",
            "eta": None
        }
