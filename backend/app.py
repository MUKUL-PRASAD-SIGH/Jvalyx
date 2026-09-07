"""FastAPI application entrypoint for the Jvalyx backend."""

from fastapi import FastAPI
from pydantic import BaseModel

from backend.config import load_config


class HealthResponse(BaseModel):
    status: str
    service: str
    model_version: str
    policy_version: str


def create_app() -> FastAPI:
    config = load_config()
    app = FastAPI(title="Jvalyx Backend", version="0.1.0")

    @app.get("/health", response_model=HealthResponse, tags=["system"])
    async def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service="jvalyx-backend",
            model_version=config.versions.model_version,
            policy_version=config.versions.policy_version,
        )

    return app


app = create_app()
