def run_billing_agent(severity_score, ambulance_required):

    if severity_score >= 8:
        cost = "₹50,000 - ₹1,20,000"
    elif severity_score >= 5:
        cost = "₹20,000 - ₹50,000"
    else:
        cost = "₹5,000 - ₹20,000"

    if ambulance_required:
        ambulance_cost = "₹1,500 - ₹3,000"
    else:
        ambulance_cost = "Not Required"

    return {
        "estimated_treatment_cost": cost,
        "ambulance_cost": ambulance_cost,
        "cashless_supported": True
    }
