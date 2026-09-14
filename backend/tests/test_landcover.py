"""Land cover: the only post-model rule is no wildfire/mine/stubble on water or snow."""

import pytest

from backend.pipeline.landcover import apply_landcover_rules, landcover_rule_for, tile_name_for

STUBBLE_HEAVY = {1: 0.02, 2: 0.08, 3: 0.02, 4: 0.85, 5: 0.03}


def _top(probs: dict[int, float]) -> int:
    return max(probs, key=probs.get)


@pytest.mark.parametrize("code", ["80", "80.0", "70"])
def test_no_wildfire_mine_or_stubble_on_water_or_snow(code: str) -> None:
    probs, rule = apply_landcover_rules(STUBBLE_HEAVY, code)
    assert rule == "no_land_fire"
    assert probs[2] == probs[3] == probs[4] == 0.0
    assert sum(probs.values()) == pytest.approx(1.0)
    # Remaining classes keep the model's own ratio (0.02 : 0.03) - nothing is boosted.
    assert probs[5] / probs[1] == pytest.approx(0.03 / 0.02)


def test_all_mass_on_impossible_classes_splits_evenly() -> None:
    probs, _ = apply_landcover_rules({1: 0.0, 2: 0.5, 3: 0.0, 4: 0.5, 5: 0.0}, "80")
    assert probs[1] == pytest.approx(0.5) and probs[5] == pytest.approx(0.5)


@pytest.mark.parametrize("code", ["10", "20", "30", "40", "50", "60", "90", "95", None, "0"])
def test_every_other_land_cover_leaves_the_model_untouched(code) -> None:
    probs, rule = apply_landcover_rules(STUBBLE_HEAVY, code)
    assert rule is None and probs == STUBBLE_HEAVY
    assert landcover_rule_for(code) is None


def test_worldcover_tile_names() -> None:
    assert tile_name_for(15.3, 76.1) == "N15E075"
    assert tile_name_for(-0.5, -1.0) == "S03W003"
