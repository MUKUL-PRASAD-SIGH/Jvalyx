"""Loading and validation for committed replay scenario files."""

import json
from pathlib import Path

from backend.models import ReplayScenario


DEFAULT_REPLAY_DIRECTORY = Path(__file__).parents[2] / "data" / "replay"


class ScenarioCatalog:
    """Read-only catalog of valid, versioned scenario definitions."""

    def __init__(self, replay_directory: Path = DEFAULT_REPLAY_DIRECTORY) -> None:
        self._replay_directory = replay_directory
        self._scenarios = self._load_scenarios()

    def list(self) -> list[ReplayScenario]:
        return list(self._scenarios.values())

    def get(self, scenario_id: str) -> ReplayScenario:
        try:
            return self._scenarios[scenario_id]
        except KeyError as error:
            raise KeyError(f"Unknown replay scenario: {scenario_id}") from error

    def _load_scenarios(self) -> dict[str, ReplayScenario]:
        scenarios: dict[str, ReplayScenario] = {}
        for scenario_path in sorted(self._replay_directory.glob("*.json")):
            with scenario_path.open(encoding="utf-8") as scenario_file:
                scenario = ReplayScenario.model_validate(json.load(scenario_file))
            if scenario.scenario_id in scenarios:
                raise ValueError(f"Duplicate replay scenario ID: {scenario.scenario_id}")
            scenarios[scenario.scenario_id] = scenario

        if not scenarios:
            raise ValueError(f"No replay scenarios found in {self._replay_directory}")
        return scenarios
