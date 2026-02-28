# Deploying to Render

Quick steps to deploy this Flask app to Render:

1. In your Render dashboard, create a new **Web Service**.
2. Connect the repository and choose the `main` branch.
3. Set the **Build Command** to:

```bash
pip install -r requirements.txt
```

4. Set the **Start Command** to:

```bash
gunicorn app:app --bind 0.0.0.0:$PORT
```

5. Add an environment variable `SECRET_KEY` (set a secure random value).

Notes:
- The repository includes a `Procfile` and `render.yaml` for convenience.
- If your app requires extra Python packages, add them to `requirements.txt`.
