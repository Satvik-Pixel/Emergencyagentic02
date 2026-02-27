import requests

def run_location_agent(lat, lng):
    try:
        url = "https://nominatim.openstreetmap.org/reverse"

        params = {
            "lat": lat,
            "lon": lng,
            "format": "json"
        }

        headers = {
            "User-Agent": "EmergencyAI/1.0"
        }

        response = requests.get(url, params=params, headers=headers)

        if response.status_code != 200:
            return "Unknown Location"

        data = response.json()

        address = data.get("address", {})
        print("Reverse Geocode Status:", response.status_code)
        print("Response Text:", response.text)

        # Choose most useful field
        return (
            address.get("suburb")
            or address.get("city")
            or address.get("town")
            or address.get("state")
            or "Unknown Location"
        )

    except Exception as e:
        print("Location Agent Error:", e)
        return "Unknown Location"


