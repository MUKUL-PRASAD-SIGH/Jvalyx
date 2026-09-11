"""Pipeline components shared by the replay worker and API."""

from .arbitration import arbitrate, risk_score, which_rule_fired
from .evidence import build_evidence_cards
from .features import derive_features
from .fusion import build_fused_event, fusion_state
from .inference import active_model_version, catboost_inference, get_inference_engine
from .inference_stub import stub_inference
from .orchestrator import process_frame
from .plume import generate_plume_corridor
from .quality import quality_score
from .replay import ReplayEngine, ReplayStatus
from .scenario_loader import ScenarioCatalog

__all__ = [
    "ReplayEngine",
    "active_model_version",
    "catboost_inference",
    "get_inference_engine",
    "ReplayStatus",
    "ScenarioCatalog",
    "arbitrate",
    "build_evidence_cards",
    "build_fused_event",
    "derive_features",
    "fusion_state",
    "generate_plume_corridor",
    "process_frame",
    "quality_score",
    "risk_score",
    "stub_inference",
    "which_rule_fired",
]
