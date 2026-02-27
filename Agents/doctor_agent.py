def run_doctor_agent(required_specialist, severity_score):

    if not required_specialist:
        return {
            "error": "No specialist specified"
        }

    # Response logic based on numeric score
    if severity_score > 80:
        response_time = "1 minute"
        status = "Emergency Alert Sent"
    elif severity_score > 50:
        response_time = "3 minutes"
        status = "Priority Notification Sent"
    else:
        response_time = "5-10 minutes"
        status = "Standard Notification Sent"

    return {
        "specialist_alerted": required_specialist,
        "status": status,
        "response_time_estimate": response_time
    }
