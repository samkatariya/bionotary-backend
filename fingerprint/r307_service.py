#!/usr/bin/env python3
"""
R307 serial bridge for BioNotary backend.

HTTP endpoints:
  GET  /health
  GET  /v1/list
  POST /v1/enroll      body: {"label":"optional"}
  POST /v1/verify      body: {}
  POST /v1/delete      body: {"template_id": 3}
"""

from __future__ import annotations

import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, Tuple

from pyfingerprint.pyfingerprint import PyFingerprint

SERIAL_PORT = os.getenv("FP_SERIAL_PORT", "/dev/ttyAMA0")
BAUD_RATE = int(os.getenv("FP_BAUD_RATE", "57600"))
SENSOR_ADDR = int(os.getenv("FP_SENSOR_ADDR", "0xFFFFFFFF"), 16)
SENSOR_PASS = int(os.getenv("FP_SENSOR_PASS", "0x00000000"), 16)
DB_FILE = os.getenv("FP_DB_FILE", "fingerprint_db.json")
HOST = os.getenv("FP_BIND", "127.0.0.1")
PORT = int(os.getenv("FP_PORT", "8765"))

_lock = threading.Lock()


def load_db() -> Dict[str, str]:
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def save_db(db: Dict[str, str]) -> None:
    with open(DB_FILE, "w", encoding="utf-8") as fh:
        json.dump(db, fh, indent=2)


def connect() -> PyFingerprint:
    sensor = PyFingerprint(SERIAL_PORT, BAUD_RATE, SENSOR_ADDR, SENSOR_PASS)
    if not sensor.verifyPassword():
        raise RuntimeError("Sensor password incorrect")
    return sensor


def enroll(sensor: PyFingerprint, label: str = "") -> Dict[str, object]:
    while not sensor.readImage():
        pass
    sensor.convertImage(0x01)
    time.sleep(1)
    while not sensor.readImage():
        pass
    sensor.convertImage(0x02)
    if sensor.compareCharacteristics() == 0:
        raise RuntimeError("Fingers did not match")
    sensor.createTemplate()
    # If the same fingerprint is already enrolled, reuse that slot instead of failing.
    existing_position, _existing_accuracy = sensor.searchTemplate()
    if existing_position >= 0:
        position = existing_position
    else:
        position = sensor.storeTemplate()

    db = load_db()
    resolved = label if label else f"User {position}"
    db[str(position)] = resolved
    save_db(db)
    return {
        "template_id": position,
        "label": resolved,
        "enrolled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def identify(sensor: PyFingerprint) -> Dict[str, object]:
    while not sensor.readImage():
        pass
    sensor.convertImage(0x01)
    position, accuracy = sensor.searchTemplate()
    if position == -1:
        return {"template_id": None, "matched": False, "accuracy_score": 0, "label": None}
    db = load_db()
    return {
        "template_id": position,
        "matched": True,
        "accuracy_score": accuracy,
        "label": db.get(str(position), f"Slot {position}"),
    }


def list_stored(sensor: PyFingerprint) -> Dict[str, object]:
    db = load_db()
    page0 = sensor.getTemplateIndex(0)
    templates = []
    for idx, occupied in enumerate(page0):
        if occupied:
            templates.append({"template_id": idx, "label": db.get(str(idx), "(no label)")})
    return {"template_count": len(templates), "templates": templates}


def delete_template(sensor: PyFingerprint, template_id: int) -> Dict[str, object]:
    sensor.deleteTemplate(template_id)
    db = load_db()
    removed = db.pop(str(template_id), None)
    save_db(db)
    return {"deleted": True, "template_id": template_id, "label": removed}


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Dict[str, object]) -> None:
        raw = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_body(self) -> Dict[str, object]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        data = self.rfile.read(length).decode("utf-8")
        if not data:
            return {}
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return {}

    def do_GET(self) -> None:
        try:
            if self.path == "/health":
                with _lock:
                    sensor = connect()
                    body = {
                        "ok": True,
                        "mode": "r307",
                        "template_capacity": sensor.getStorageCapacity(),
                        "template_count": sensor.getTemplateCount(),
                    }
                self._json(200, body)
                return
            if self.path == "/v1/list":
                with _lock:
                    sensor = connect()
                    self._json(200, list_stored(sensor))
                return
            self._json(404, {"error": "not_found"})
        except Exception as exc:  # pylint: disable=broad-except
            self._json(500, {"message": "sensor_error", "detail": str(exc)})

    def do_POST(self) -> None:
        try:
            body = self._read_body()
            with _lock:
                sensor = connect()
                if self.path == "/v1/enroll":
                    label = str(body.get("label", "")).strip()
                    self._json(200, enroll(sensor, label))
                    return
                if self.path == "/v1/verify":
                    self._json(200, identify(sensor))
                    return
                if self.path == "/v1/delete":
                    template_id = int(body.get("template_id", -1))
                    if template_id < 0:
                        self._json(400, {"message": "invalid_template_id"})
                        return
                    self._json(200, delete_template(sensor, template_id))
                    return
            self._json(404, {"error": "not_found"})
        except Exception as exc:  # pylint: disable=broad-except
            self._json(500, {"message": "sensor_error", "detail": str(exc)})

    def log_message(self, fmt: str, *args) -> None:
        print(f"[r307] {fmt % args}")


if __name__ == "__main__":
    print(f"Starting R307 service on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
