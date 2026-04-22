from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, redirect, request, send_from_directory, session
from flask_cors import CORS
from flask_session import Session

try:
    from anthropic import Anthropic
except ImportError:  # pragma: no cover - optional integration
    Anthropic = None

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
except ImportError:  # pragma: no cover - optional integration
    Request = None
    Credentials = None
    Flow = None
    build = None


BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
CONTENT_PATH = ROOT_DIR / "content.json"
FRONTEND_DIST = ROOT_DIR / "dist"
DEFAULT_FRONTEND_URL = os.getenv("FRONTEND_URL", os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"))

load_dotenv(ROOT_DIR / ".env")


def load_content() -> dict[str, Any]:
    if not CONTENT_PATH.exists():
        return {"brand": {}, "features": [], "timelines": {}, "steps": [], "quiz": [], "calendarEvents": []}

    with CONTENT_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


CONTENT = load_content()
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.update(
        SECRET_KEY=os.getenv("FLASK_SECRET_KEY") or os.getenv("SESSION_SECRET") or "dev-secret-change-me",
        SESSION_TYPE=os.getenv("SESSION_TYPE", "filesystem"),
        SESSION_FILE_DIR=str(BASE_DIR / ".flask_session"),
        SESSION_PERMANENT=False,
        SESSION_USE_SIGNER=True,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    Path(app.config["SESSION_FILE_DIR"]).mkdir(parents=True, exist_ok=True)
    Session(app)

    allowed_origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGIN", DEFAULT_FRONTEND_URL).split(",") if origin.strip()]
    if DEFAULT_FRONTEND_URL not in allowed_origins:
        allowed_origins.append(DEFAULT_FRONTEND_URL)

    CORS(
        app,
        supports_credentials=True,
        resources={
            r"/api/*": {"origins": allowed_origins},
            r"/auth/*": {"origins": allowed_origins},
        },
    )

    register_routes(app)
    return app

def app_flags() -> dict[str, bool]:
    google_ready = bool(
        Flow
        and build
        and Credentials
        and Request
        and os.getenv("GOOGLE_CLIENT_ID")
        and os.getenv("GOOGLE_CLIENT_SECRET")
        and os.getenv("GOOGLE_REDIRECT_URI")
    )
    ai_ready = bool(Anthropic and os.getenv("ANTHROPIC_API_KEY"))
    return {"googleAuthEnabled": google_ready, "aiEnabled": ai_ready}


def current_user() -> dict[str, Any] | None:
    return session.get("user")


def is_authenticated() -> bool:
    return bool(session.get("authenticated") and current_user())


def google_ready() -> bool:
    return app_flags()["googleAuthEnabled"]


def google_client_config() -> dict[str, Any]:
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", f"{os.getenv('BACKEND_URL', 'http://localhost:8000')}/auth/google/callback")
    return {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }


def google_flow(state: str | None = None) -> Any:
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", f"{os.getenv('BACKEND_URL', 'http://localhost:8000')}/auth/google/callback")
    flow = Flow.from_client_config(google_client_config(), scopes=SCOPES, state=state)
    flow.redirect_uri = redirect_uri
    return flow


def credentials_from_session() -> Any:
    if not session.get("google_credentials") or not Credentials:
        return None

    creds = Credentials.from_authorized_user_info(session["google_credentials"], SCOPES)
    if creds.expired and creds.refresh_token and Request:
        creds.refresh(Request())
        session["google_credentials"] = json.loads(creds.to_json())
    return creds


def build_calendar_template_link(title: str, date: str, description: str | None) -> str:
    start = datetime.strptime(date, "%Y-%m-%d") + timedelta(hours=9)
    end = start + timedelta(hours=1)
    params = {
        "action": "TEMPLATE",
        "text": title,
        "details": description or "",
        "dates": f"{start.strftime('%Y%m%dT%H%M%S')}/{end.strftime('%Y%m%dT%H%M%S')}",
        "ctz": "America/New_York",
    }
    return f"https://calendar.google.com/calendar/render?{urlencode(params)}"


def create_calendar_event(title: str, date: str, description: str | None) -> dict[str, Any]:
    payload = {
        "summary": title,
        "description": description or "",
        "start": {
            "dateTime": (datetime.strptime(date, "%Y-%m-%d") + timedelta(hours=9)).isoformat(),
            "timeZone": "America/New_York",
        },
        "end": {
            "dateTime": (datetime.strptime(date, "%Y-%m-%d") + timedelta(hours=10)).isoformat(),
            "timeZone": "America/New_York",
        },
    }

    creds = credentials_from_session()
    if not creds or not build:
        return {
            "success": True,
            "mode": "template",
            "eventLink": build_calendar_template_link(title, date, description),
        }

    service = build("calendar", "v3", credentials=creds)
    result = service.events().insert(calendarId="primary", body=payload).execute()
    return {
        "success": True,
        "mode": "google",
        "eventId": result.get("id"),
        "eventLink": result.get("htmlLink"),
    }


def summarize_prompt(prompt: str) -> str:
    normalized = prompt.lower()
    quoted = re.findall(r'"([^"]+)"', prompt)
    topic = quoted[0] if quoted else prompt.strip()

    for collection_name in ("timelines", "steps", "calendarEvents"):
        collection = CONTENT.get(collection_name, {})
        if isinstance(collection, dict):
            iterable = [item for values in collection.values() for item in values]
        else:
            iterable = collection

        for item in iterable:
            title = (item.get("title") or item.get("name") or "").lower()
            if title and title in normalized:
                return f"{item.get('title') or item.get('name')}: {item.get('desc') or item.get('detail') or ''}".strip()

    if "primary" in normalized:
        return "A primary election is how parties choose their nominees for the general election."
    if "electoral college" in normalized:
        return "The Electoral College is the system used to formally elect the President after the popular vote."
    if "timeline" in normalized or "election day" in normalized:
        return f"{topic}: this is one of the key moments in the election cycle."

    return (
        f"Here is a concise civic explanation for: {topic}. "
        "The election process moves from candidate filing and primaries to the general election, certification, and inauguration."
    )


def ai_response(prompt: str) -> tuple[str, str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")

    if api_key and Anthropic:
        try:
            client = Anthropic(api_key=api_key)
            message = client.messages.create(
                model=model,
                max_tokens=600,
                system="You are a helpful civic education assistant. Keep answers concise, accurate, and practical.",
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(
                block.text for block in message.content if getattr(block, "type", None) == "text" and getattr(block, "text", None)
            ).strip()
            if text:
                return text, "anthropic"
        except Exception:
            pass

    return summarize_prompt(prompt), "fallback"


def auth_payload() -> dict[str, Any]:
    return {
        "authenticated": is_authenticated(),
        "user": current_user(),
        "integrations": app_flags(),
        "frontendUrl": DEFAULT_FRONTEND_URL,
    }


def register_routes(app: Flask) -> None:
    @app.get("/api/bootstrap")
    def bootstrap() -> Any:
        return jsonify(auth_payload())

    @app.get("/api/auth/user")
    def get_user() -> Any:
        return jsonify(auth_payload())

    @app.post("/api/auth/demo-login")
    def demo_login() -> Any:
        payload = request.get_json(silent=True) or {}
        user = {
            "name": payload.get("name") or "Guest Explorer",
            "email": payload.get("email") or "guest@example.com",
            "picture": None,
            "provider": "demo",
        }
        session["authenticated"] = True
        session["user"] = user
        session["loginMode"] = "demo"
        session.pop("google_credentials", None)
        return jsonify({"success": True, "user": user})

    @app.post("/api/auth/logout")
    def logout() -> Any:
        session.clear()
        return jsonify({"success": True})

    @app.get("/auth/google")
    def google_login() -> Any:
        if not google_ready():
            return jsonify({"success": False, "error": "Google OAuth is not configured"}), 501

        flow = google_flow()
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        session["oauth_state"] = state
        return redirect(authorization_url)

    @app.get("/auth/google/callback")
    def google_callback() -> Any:
        if not google_ready():
            return redirect(DEFAULT_FRONTEND_URL)

        try:
            flow = google_flow(state=session.get("oauth_state"))
            flow.fetch_token(code=request.args.get("code"))
            credentials = flow.credentials
            session["google_credentials"] = json.loads(credentials.to_json())

            user_info = {"name": "Google User", "email": "", "picture": None, "provider": "google"}
            if build:
                oauth2 = build("oauth2", "v2", credentials=credentials)
                data = oauth2.userinfo().get().execute()
                user_info = {
                    "name": data.get("name") or data.get("email") or "Google User",
                    "email": data.get("email") or "",
                    "picture": data.get("picture"),
                    "provider": "google",
                }

            session["authenticated"] = True
            session["user"] = user_info
            session["loginMode"] = "google"
            return redirect(DEFAULT_FRONTEND_URL)
        except Exception as exc:
            return jsonify({"success": False, "error": f"Authentication failed: {exc}"}), 500

    @app.post("/api/calendar/add-event")
    def add_event() -> Any:
        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or "").strip()
        date = (payload.get("date") or "").strip()
        description = payload.get("description") or ""

        if not title or not date:
            return jsonify({"success": False, "error": "Missing required fields"}), 400

        try:
            result = create_calendar_event(title, date, description)
            result.setdefault("success", True)
            result.setdefault("eventLink", build_calendar_template_link(title, date, description))
            return jsonify(result)
        except Exception as exc:
            return jsonify({"success": False, "error": f"Failed to add event: {exc}"}), 500

    @app.post("/api/calendar/add-events")
    def add_events() -> Any:
        payload = request.get_json(silent=True) or {}
        events = payload.get("events") or []

        if not isinstance(events, list) or not events:
            return jsonify({"success": False, "error": "No events provided"}), 400

        results = []
        for event in events:
            try:
                title = (event.get("title") or "").strip()
                date = (event.get("date") or "").strip()
                description = event.get("description") or ""
                if not title or not date:
                    raise ValueError("Missing title or date")
                result = create_calendar_event(title, date, description)
                result.update({"title": title})
                results.append(result)
            except Exception as exc:
                results.append({"success": False, "title": event.get("title"), "error": str(exc)})

        return jsonify({"success": True, "results": results, "addedCount": sum(1 for result in results if result.get("success"))})

    @app.post("/api/ai/prompt")
    def prompt_ai() -> Any:
        payload = request.get_json(silent=True) or {}
        prompt = (payload.get("prompt") or "").strip()

        if not prompt:
            return jsonify({"success": False, "error": "No prompt provided"}), 400

        response_text, source = ai_response(prompt)
        return jsonify({"success": True, "response": response_text, "source": source})

    @app.get("/")
    def index() -> Any:
        if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
            return send_from_directory(FRONTEND_DIST, "index.html")

        return jsonify(
            {
                "message": "Frontend build not found.",
                "frontend": DEFAULT_FRONTEND_URL,
                "hint": "Run the React dev server with npm start, or build the frontend with npm run build.",
            }
        )

    @app.route("/<path:path>")
    def spa(path: str) -> Any:
        if path.startswith(("api/", "auth/")):
            abort(404)

        candidate = FRONTEND_DIST / path
        if FRONTEND_DIST.exists() and candidate.exists() and candidate.is_file():
            return send_from_directory(FRONTEND_DIST, path)

        if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
            return send_from_directory(FRONTEND_DIST, "index.html")

        abort(404)

    @app.errorhandler(404)
    def not_found(_: Any) -> Any:
        return jsonify({"success": False, "error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(error: Any) -> Any:
        return jsonify({"success": False, "error": str(error) or "Internal server error"}), 500


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    app.run(host=host, port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")