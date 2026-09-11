"""Shared test configuration.

The trained CatBoost classifier is the runtime default, but the pipeline/replay/API
suites assert the *deterministic* contract (routing rules, replay mechanics, response
shapes) and must not move whenever the model artifact is retrained. They therefore run
against the hand-authored stub. The trained path has its own explicit coverage in
``test_inference_catboost.py``, which selects the engine directly rather than via env.
"""

import pytest


@pytest.fixture(autouse=True)
def pin_stub_inference(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JVALYX_INFERENCE", "stub")
