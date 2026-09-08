"""Run the backend with `python -m backend` (from the repo root)."""

import uvicorn


def main() -> None:
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, log_level="info")


if __name__ == "__main__":
    main()
