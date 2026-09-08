"""Entry point for the Jvalyx backend.

Run from the repository root:

    python app.py                 # serve on http://127.0.0.1:8000
    python app.py --reload        # auto-reload on code changes (dev)
    python app.py --port 9000     # custom port

Equivalent to `uvicorn backend.app:app`.
"""

import argparse

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Jvalyx backend API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="auto-reload on file changes")
    args = parser.parse_args()

    uvicorn.run(
        "backend.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
