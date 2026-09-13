#!/usr/bin/env python3
"""
Arduino CRITICAL alert trigger for Jvalyx demo.

Polls the backend's current event state and sends 'C' (CRITICAL) or 'N' (reset)
to the Arduino over serial. The LED on pin 13 lights up ONLY when:
  1. The current route_state is CRITICAL, AND
  2. The matched_facility matches DEMO_FACILITY_NAME (so only "this facility's"
     control room activates, not every CRITICAL fire in the country).

Setup:
  pip install pyserial requests
  Upload arduino_led.ino to your board first.

Usage:
  python arduino_trigger.py                     # auto-detect COM port, default facility
  python arduino_trigger.py --port COM5         # explicit port
  python arduino_trigger.py --facility "MRPL"   # partial name match (case-insensitive)
  python arduino_trigger.py --port COM5 --facility "MRPL" --backend http://localhost:8000
"""

import argparse
import time
import sys

import requests

# ── Configuration ──────────────────────────────────────────────────────────────

DEFAULT_BACKEND = "http://localhost:8000"

# Change this to the facility name (or substring) shown in your backend/UI.
# The trigger ONLY fires when the CRITICAL detection matches this facility.
DEFAULT_DEMO_FACILITY = "MRPL"   # e.g. "MRPL Petrochemical", "NTPC Sipat", etc.

POLL_INTERVAL = 3  # seconds between polls

# ── Serial helpers ─────────────────────────────────────────────────────────────

def open_serial(port: str, baud: int = 9600):
    try:
        import serial
        s = serial.Serial(port, baud, timeout=1)
        time.sleep(2)   # wait for Arduino to reset after USB connect
        print(f"[OK] Opened {port} at {baud} baud")
        return s
    except ImportError:
        print("[ERROR] pyserial not installed. Run: pip install pyserial")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Could not open {port}: {e}")
        print("       Check Device Manager for the correct COM port.")
        sys.exit(1)


def find_port():
    """Auto-detect the first Arduino-like port on Windows."""
    try:
        import serial.tools.list_ports
        candidates = list(serial.tools.list_ports.comports())
        for p in candidates:
            desc = (p.description or "").lower()
            if "arduino" in desc or "ch340" in desc or "usb serial" in desc:
                print(f"[AUTO] Detected port: {p.device} ({p.description})")
                return p.device
        if candidates:
            print(f"[AUTO] No Arduino detected, using first port: {candidates[0].device}")
            return candidates[0].device
    except ImportError:
        pass
    print("[WARN] Could not auto-detect port. Use --port COM5 (or similar).")
    return None

# ── Backend polling ────────────────────────────────────────────────────────────

def get_current_event(backend: str) -> dict | None:
    """
    Try the live event store first (/events). Each event in the store has
    route_state and matched_facility_name. Fall back to replay status.
    """
    try:
        resp = requests.get(f"{backend}/events", timeout=4)
        if resp.ok:
            events = resp.json()
            if events:
                # Return the most-recently updated event
                return events[-1]
    except Exception:
        pass
    return None


def should_trigger(event: dict, facility_substr: str) -> bool:
    route = event.get("route_state") or event.get("decision", {}).get("route_state", "")
    facility = (
        event.get("facility_name")
        or event.get("matched_facility_name")
        or event.get("matched_facility")
        or ""
    )
    is_critical = route == "CRITICAL"
    facility_match = facility_substr.lower() in facility.lower()
    return is_critical and facility_match


# ── Main loop ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Jvalyx → Arduino CRITICAL relay trigger")
    parser.add_argument("--port", default=None, help="Arduino COM port (e.g. COM5, /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=9600, help="Serial baud rate (default 9600)")
    parser.add_argument("--backend", default=DEFAULT_BACKEND, help="Jvalyx backend base URL")
    parser.add_argument("--facility", default=DEFAULT_DEMO_FACILITY,
                        help="Facility name substring to watch (case-insensitive)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print trigger decisions without opening serial port")
    args = parser.parse_args()

    port = args.port or (None if args.dry_run else find_port())
    arduino = None if args.dry_run else (open_serial(port) if port else None)

    if not arduino and not args.dry_run:
        print("[WARN] No serial port available. Running in dry-run mode.")
        args.dry_run = True

    print(f"[CONFIG] Backend : {args.backend}")
    print(f"[CONFIG] Facility: '{args.facility}' (substring match, case-insensitive)")
    print(f"[CONFIG] Mode    : {'DRY RUN' if args.dry_run else f'LIVE → {port}'}")
    print("[INFO] Polling every", POLL_INTERVAL, "s. Ctrl+C to stop.\n")

    last_state: str | None = None

    while True:
        try:
            event = get_current_event(args.backend)
            if event is None:
                print("[POLL] No events from backend (backend may be offline or no scenario loaded)")
                time.sleep(POLL_INTERVAL)
                continue

            trigger = should_trigger(event, args.facility)
            route = (event.get("route_state") or event.get("decision", {}).get("route_state", "?"))
            facility = (event.get("facility_name") or event.get("matched_facility_name") or "unknown")

            if trigger and last_state != "CRITICAL":
                print(f"[ALERT] CRITICAL — {facility} | Sending 'C' to Arduino")
                if not args.dry_run and arduino:
                    arduino.write(b'C')
                last_state = "CRITICAL"

            elif not trigger and last_state == "CRITICAL":
                print(f"[RESET] Route={route}, facility='{facility}' | Sending 'N' to Arduino")
                if not args.dry_run and arduino:
                    arduino.write(b'N')
                last_state = route

            else:
                print(f"[POLL] Route={route}, facility='{facility}', trigger={trigger}")

        except KeyboardInterrupt:
            print("\n[STOP] Interrupted. Sending N to reset LED.")
            if not args.dry_run and arduino:
                arduino.write(b'N')
            break
        except Exception as e:
            print(f"[ERR] {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
