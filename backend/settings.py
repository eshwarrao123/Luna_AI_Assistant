# /backend/settings.py
from fastapi import APIRouter
from pydantic import BaseModel

from database import get_all_settings, set_settings

router = APIRouter()

DEFAULT_SETTINGS = {
    "onboarding_complete": "false",
    "user_name": "",
    "assistant_name": "Luna",
    "language": "English",
    "model": "qwen2.5:7b",
    "theme": "dark",
    "font_size": "md",
    "response_style": "balanced",
}


class SettingsPayload(BaseModel):
    user_name: str | None = None
    assistant_name: str | None = None
    language: str | None = None
    model: str | None = None
    theme: str | None = None
    font_size: str | None = None
    response_style: str | None = None
    onboarding_complete: bool | None = None


@router.get("/settings")
async def get_settings():
    stored = get_all_settings()
    merged = {**DEFAULT_SETTINGS, **stored}
    merged["onboarding_complete"] = merged.get("onboarding_complete") == "true"
    return merged


@router.post("/settings")
async def update_settings(payload: SettingsPayload):
    values = payload.model_dump(exclude_none=True)
    if "onboarding_complete" in values:
        values["onboarding_complete"] = "true" if values["onboarding_complete"] else "false"
    set_settings(values)
    stored = get_all_settings()
    merged = {**DEFAULT_SETTINGS, **stored}
    merged["onboarding_complete"] = merged.get("onboarding_complete") == "true"
    return merged


@router.post("/settings/reset-onboarding")
async def reset_onboarding():
    set_settings({"onboarding_complete": "false"})
    return {"onboarding_complete": False}