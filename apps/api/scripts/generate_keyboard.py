import argparse
import os
import sys
import time
import uuid
import json
import requests


def die(msg: str, code: int = 1):
    print(msg)
    sys.exit(code)


def get_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        die(f"Missing env var: {name}")
    return val


def post_json(url: str, headers: dict, payload: dict) -> dict:
    r = requests.post(url, headers=headers, json=payload, timeout=30)
    if r.status_code >= 400:
        raise SystemExit(f"POST {url} failed [{r.status_code}]: {r.text}")
    # PostgREST returns an array when Prefer:return=representation
    try:
        data = r.json()
    except Exception:
        data = {}
    if isinstance(data, list) and data:
        return data[0]
    return data


def main():
    parser = argparse.ArgumentParser(description="Generate a Keyboard run and variant, syncing to Supabase")
    parser.add_argument("--project-id", required=True, help="Supabase projects.id (UUID)")
    parser.add_argument("--prompt", required=True, help="Design prompt for the keyboard")
    parser.add_argument("--model", default="openai:gpt-4.1", help="LLM model identifier (for logging)")
    args = parser.parse_args()

    supabase_url = get_env("SUPABASE_URL")
    service_key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    # Prefer anon key for 'apikey' header when available; keep service key for Authorization
    anon_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

    # Allow both host-only (dvgdx...supabase.co) and full URL (https://dvgdx...supabase.co)
    if supabase_url.startswith("http://") or supabase_url.startswith("https://"):
        base = supabase_url.rstrip("/")
    else:
        base = f"https://{supabase_url}"
    headers = {
        "apikey": (anon_key or service_key),
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation",
    }

    project_id = args.project_id

    # 1) Create run (omit status to use allowed default per constraints)
    run_id = f"run-{uuid.uuid4()}"
    run_payload = {
        "run_id": run_id,
        "project_id": project_id,
        "parameters": {"prompt": args.prompt, "model": args.model},
        "metadata": {"generator": "generate_keyboard.py"},
    }
    run_row = post_json(f"{base}/rest/v1/runs", headers, run_payload)
    print(f"Run created: {run_id}")

    # 2) Simulate generation: use placeholder URLs; integrate your pipeline here
    image_url = "https://dummyimage.com/800x600/222/eee.png&text=Keyboard+Render"
    thumbnail_url = "https://dummyimage.com/300x200/555/fff.png&text=Thumb"

    # 3) Insert variant linked by run_id (thumbnail_url required by constraints)
    variant_payload = {
        "run_id": run_id,
        "image_url": image_url,
        "thumbnail_url": thumbnail_url,
        "score": 75.3,
        "metrics": {"mass_g": 280, "wall_thickness_mm": 2.0},
        "dfx_analysis": "Placeholder variant generated via script.",
    }
    var_row = post_json(f"{base}/rest/v1/variants", headers, variant_payload)
    print(f"Variant inserted for run: {run_id}")

    # 4) Mark run as completed
    try:
        requests.patch(
            f"{base}/rest/v1/runs?run_id=eq.{run_id}",
            headers=headers,
            json={"status": "completed", "finished_at": time.strftime("%Y-%m-%dT%H:%M:%S+00:00")},
            timeout=20,
        )
        print("Run marked completed")
    except Exception as e:
        print(f"Warning: failed to mark run completed: {e}")

    print(json.dumps({"run": run_row, "variant": var_row}, indent=2))


if __name__ == "__main__":
    main()
