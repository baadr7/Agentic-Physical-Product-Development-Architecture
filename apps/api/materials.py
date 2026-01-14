"""
materials.py
Material database CRUD operations and endpoints.
Provides interface to materials table for FEM/scoring realism.
"""
import os
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, validator


class MaterialBase(BaseModel):
    """Base material model."""
    name: str = Field(..., min_length=1, max_length=100)
    density: float = Field(..., gt=0, description="Density in kg/m³")
    youngs_modulus: float = Field(..., gt=0, description="Young's modulus in GPa")
    poisson_ratio: float = Field(..., ge=0, le=0.5, description="Poisson's ratio (dimensionless)")
    cost_per_kg: float = Field(..., ge=0, description="Cost per kg in currency units")
    carbon_factor: float = Field(..., ge=0, description="Carbon footprint kg CO2/kg material")


class MaterialCreate(MaterialBase):
    """Material creation model."""
    pass


class MaterialUpdate(BaseModel):
    """Material update model (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    density: Optional[float] = Field(None, gt=0)
    youngs_modulus: Optional[float] = Field(None, gt=0)
    poisson_ratio: Optional[float] = Field(None, ge=0, le=0.5)
    cost_per_kg: Optional[float] = Field(None, ge=0)
    carbon_factor: Optional[float] = Field(None, ge=0)


class MaterialOut(MaterialBase):
    """Material output model."""
    id: str
    tenant_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# Supabase helpers for materials CRUD
def create_material_supabase(
    supabase_client,
    material: MaterialCreate,
    tenant_id: str
) -> Dict[str, Any]:
    """Insert material into Supabase materials table."""
    payload = {
        "name": material.name,
        "density": material.density,
        "youngs_modulus": material.youngs_modulus,
        "poisson_ratio": material.poisson_ratio,
        "cost_per_kg": material.cost_per_kg,
        "carbon_factor": material.carbon_factor,
        "tenant_id": tenant_id
    }
    resp = supabase_client.table("materials").insert(payload).execute()
    if not resp.data:
        raise Exception("Failed to create material in Supabase")
    return resp.data[0]


def list_materials_supabase(
    supabase_client,
    tenant_id: str,
    limit: int = 100,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """List materials filtered by tenant_id."""
    resp = (
        supabase_client.table("materials")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("name")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return resp.data or []


def get_material_supabase(
    supabase_client,
    material_id: str,
    tenant_id: str
) -> Optional[Dict[str, Any]]:
    """Fetch single material by ID with tenant isolation."""
    resp = (
        supabase_client.table("materials")
        .select("*")
        .eq("id", material_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def update_material_supabase(
    supabase_client,
    material_id: str,
    tenant_id: str,
    updates: MaterialUpdate
) -> Optional[Dict[str, Any]]:
    """Update material fields (partial update)."""
    payload = {k: v for k, v in updates.dict(exclude_unset=True).items() if v is not None}
    if not payload:
        # No fields to update, fetch current state
        return get_material_supabase(supabase_client, material_id, tenant_id)
    
    resp = (
        supabase_client.table("materials")
        .update(payload)
        .eq("id", material_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def delete_material_supabase(
    supabase_client,
    material_id: str,
    tenant_id: str
) -> bool:
    """Delete material (hard delete). Returns True if deleted."""
    resp = (
        supabase_client.table("materials")
        .delete()
        .eq("id", material_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    return bool(resp.data)


# Seed materials for initial setup
SEED_MATERIALS = [
    MaterialCreate(
        name="PLA",
        density=1240.0,  # kg/m³
        youngs_modulus=3.5,  # GPa
        poisson_ratio=0.36,
        cost_per_kg=20.0,  # USD/kg
        carbon_factor=2.7  # kg CO2/kg
    ),
    MaterialCreate(
        name="ABS",
        density=1050.0,
        youngs_modulus=2.3,
        poisson_ratio=0.35,
        cost_per_kg=18.0,
        carbon_factor=3.4
    ),
    MaterialCreate(
        name="PETG",
        density=1270.0,
        youngs_modulus=2.1,
        poisson_ratio=0.38,
        cost_per_kg=22.0,
        carbon_factor=3.1
    ),
    MaterialCreate(
        name="Nylon",
        density=1140.0,
        youngs_modulus=2.7,
        poisson_ratio=0.39,
        cost_per_kg=50.0,
        carbon_factor=5.2
    ),
    MaterialCreate(
        name="Steel",
        density=7850.0,
        youngs_modulus=200.0,
        poisson_ratio=0.30,
        cost_per_kg=2.0,
        carbon_factor=1.8
    ),
    MaterialCreate(
        name="Aluminum",
        density=2700.0,
        youngs_modulus=69.0,
        poisson_ratio=0.33,
        cost_per_kg=4.0,
        carbon_factor=8.5
    ),
]


def seed_materials_if_empty(supabase_client, tenant_id: str):
    """Seed initial materials if none exist for tenant."""
    existing = list_materials_supabase(supabase_client, tenant_id, limit=1)
    if not existing:
        for mat in SEED_MATERIALS:
            try:
                create_material_supabase(supabase_client, mat, tenant_id)
            except Exception as e:
                print(f"Warning: Failed to seed material {mat.name}: {e}")
