from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from api.dependencies import get_current_user, get_admin_user
from core.dataloaders import api_key_loader, user_loader
from core.llm_provider.registry import MODELS

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request Models ──

class CreateKeyRequest(BaseModel):
    key_name: str
    model_name: str
    api_key: str

class UpdateKeyRequest(BaseModel):
    key_name: Optional[str] = None
    api_key: Optional[str] = None

class AssignKeyRequest(BaseModel):
    username: str
    key_id: str


# ── Helpers ──

def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "****"
    return api_key[:4] + "..." + api_key[-4:]


# ── Admin: Key Management ──

@router.get("/keys")
async def list_keys(admin: str = Depends(get_admin_user)):
    keys = api_key_loader.list_keys()
    # Mask api_key values
    masked = []
    for k in keys:
        masked.append({**k, "api_key": mask_api_key(k.get("api_key", ""))})
    return {"keys": masked}


@router.post("/keys")
async def create_key(req: CreateKeyRequest, admin: str = Depends(get_admin_user)):
    # Validate model_name exists in registry
    if req.model_name not in MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown model '{req.model_name}'")

    # Validate key_name unique
    if api_key_loader.key_name_exists(req.key_name):
        raise HTTPException(status_code=400, detail=f"Key name '{req.key_name}' already exists")

    provider = MODELS[req.model_name].provider
    key = api_key_loader.save_key({
        "key_name": req.key_name,
        "model_name": req.model_name,
        "provider": provider,
        "api_key": req.api_key,
        "created_by": admin,
    })
    return {"key": {**key, "api_key": mask_api_key(key["api_key"])}}


@router.patch("/keys/{key_id}")
async def update_key(key_id: str, req: UpdateKeyRequest, admin: str = Depends(get_admin_user)):
    existing = api_key_loader.get_key(key_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Key not found")

    update_data = {"key_id": key_id}
    if req.key_name is not None:
        # Check uniqueness if name is changing
        if req.key_name != existing["key_name"] and api_key_loader.key_name_exists(req.key_name):
            raise HTTPException(status_code=400, detail=f"Key name '{req.key_name}' already exists")
        update_data["key_name"] = req.key_name
    if req.api_key is not None:
        update_data["api_key"] = req.api_key

    updated = api_key_loader.save_key(update_data)
    return {"key": {**updated, "api_key": mask_api_key(updated["api_key"])}}


@router.delete("/keys/{key_id}")
async def delete_key(key_id: str, admin: str = Depends(get_admin_user)):
    if not api_key_loader.delete_key(key_id):
        raise HTTPException(status_code=404, detail="Key not found")
    return {"status": "deleted"}


# ── Admin: Assignments ──

@router.get("/assignments")
async def list_assignments(admin: str = Depends(get_admin_user)):
    return {"assignments": api_key_loader.list_assignments()}


@router.post("/assignments")
async def assign_key(req: AssignKeyRequest, admin: str = Depends(get_admin_user)):
    # Validate user exists
    if not user_loader.user_exists(req.username):
        raise HTTPException(status_code=404, detail=f"User '{req.username}' not found")
    # Validate key exists
    if not api_key_loader.get_key(req.key_id):
        raise HTTPException(status_code=404, detail="Key not found")

    api_key_loader.assign_key(req.username, req.key_id)
    return {"status": "assigned"}


@router.delete("/assignments/{username}/{key_id}")
async def unassign_key(username: str, key_id: str, admin: str = Depends(get_admin_user)):
    if not api_key_loader.unassign_key(username, key_id):
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"status": "unassigned"}


# ── User-facing ──

@router.get("/my-keys")
async def get_my_keys(username: str = Depends(get_current_user)):
    keys = api_key_loader.get_user_keys(username)
    # Return only safe fields
    return {"keys": [
        {"key_name": k["key_name"], "model_name": k["model_name"], "provider": k["provider"]}
        for k in keys
    ]}


@router.get("/models")
async def list_models(admin: str = Depends(get_admin_user)):
    models = []
    for name, config in MODELS.items():
        models.append({
            "model_name": name,
            "provider": config.provider,
            "display_name": config.display_name,
        })
    return {"models": models}
