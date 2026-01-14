"""
scoring_normalization.py
Scoring normalization framework with reference baselines for reproducible DfX scoring.
Provides 0-1 scaling based on product-type-specific reference ranges.
"""
import os
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class ProductType(str, Enum):
    """Supported product types for baseline normalization."""
    BRACKET = "bracket"
    ENCLOSURE = "enclosure"
    CONNECTOR = "connector"
    LEVER = "lever"
    FRAME = "frame"
    GEAR = "gear"
    HOUSING = "housing"
    GENERIC = "generic"


class NormalizationBaseline(BaseModel):
    """Reference baseline for a specific metric and product type."""
    product_type: ProductType
    metric_name: str
    min_value: float = Field(..., description="Minimum expected value (maps to score 0)")
    max_value: float = Field(..., description="Maximum expected value (maps to score 1)")
    optimal_value: Optional[float] = Field(None, description="Optimal target value (maps to score 1)")
    invert: bool = Field(False, description="If True, lower values are better (e.g., stress, mass)")
    
    def normalize(self, raw_value: float) -> float:
        """
        Normalize raw metric value to 0-1 scale.
        
        Args:
            raw_value: Raw metric value
        
        Returns:
            Normalized score between 0 and 1
        """
        if self.optimal_value is not None:
            # Distance-based normalization (closer to optimal is better)
            distance = abs(raw_value - self.optimal_value)
            max_distance = max(
                abs(self.min_value - self.optimal_value),
                abs(self.max_value - self.optimal_value)
            )
            if max_distance == 0:
                return 1.0
            return max(0.0, 1.0 - (distance / max_distance))
        
        # Linear scaling
        if self.max_value == self.min_value:
            return 0.5  # Undefined range
        
        normalized = (raw_value - self.min_value) / (self.max_value - self.min_value)
        
        if self.invert:
            normalized = 1.0 - normalized
        
        # Clamp to [0, 1]
        return max(0.0, min(1.0, normalized))


# Default baselines for common product types and metrics
DEFAULT_BASELINES = {
    # Support volume ratio (lower is better)
    ("bracket", "support_volume_ratio"): NormalizationBaseline(
        product_type=ProductType.BRACKET,
        metric_name="support_volume_ratio",
        min_value=0.0,
        max_value=0.5,
        invert=True
    ),
    ("enclosure", "support_volume_ratio"): NormalizationBaseline(
        product_type=ProductType.ENCLOSURE,
        metric_name="support_volume_ratio",
        min_value=0.0,
        max_value=0.3,
        invert=True
    ),
    
    # Part count (lower is better for most types)
    ("bracket", "part_count"): NormalizationBaseline(
        product_type=ProductType.BRACKET,
        metric_name="part_count",
        min_value=1.0,
        max_value=5.0,
        optimal_value=1.0,
        invert=True
    ),
    ("enclosure", "part_count"): NormalizationBaseline(
        product_type=ProductType.ENCLOSURE,
        metric_name="part_count",
        min_value=2.0,
        max_value=20.0,
        optimal_value=5.0,
        invert=True
    ),
    
    # Max von Mises stress (lower is better, normalized to material yield strength)
    ("bracket", "max_von_mises_mpa"): NormalizationBaseline(
        product_type=ProductType.BRACKET,
        metric_name="max_von_mises_mpa",
        min_value=0.0,
        max_value=100.0,  # Typical for PLA ~50-60 MPa yield
        invert=True
    ),
    ("generic", "max_von_mises_mpa"): NormalizationBaseline(
        product_type=ProductType.GENERIC,
        metric_name="max_von_mises_mpa",
        min_value=0.0,
        max_value=150.0,
        invert=True
    ),
    
    # Max deflection (lower is better)
    ("bracket", "max_deflection_mm"): NormalizationBaseline(
        product_type=ProductType.BRACKET,
        metric_name="max_deflection_mm",
        min_value=0.0,
        max_value=5.0,
        invert=True
    ),
    ("enclosure", "max_deflection_mm"): NormalizationBaseline(
        product_type=ProductType.ENCLOSURE,
        metric_name="max_deflection_mm",
        min_value=0.0,
        max_value=10.0,
        invert=True
    ),
    
    # Mass (context-dependent; typically lower is better for sustainability)
    ("bracket", "mass_kg"): NormalizationBaseline(
        product_type=ProductType.BRACKET,
        metric_name="mass_kg",
        min_value=0.05,
        max_value=2.0,
        optimal_value=0.2,
        invert=True
    ),
    ("enclosure", "mass_kg"): NormalizationBaseline(
        product_type=ProductType.ENCLOSURE,
        metric_name="mass_kg",
        min_value=0.1,
        max_value=5.0,
        optimal_value=0.5,
        invert=True
    ),
    
    # Build time (lower is better)
    ("bracket", "build_time_minutes"): NormalizationBaseline(
        product_type=ProductType.BRACKET,
        metric_name="build_time_minutes",
        min_value=30.0,
        max_value=300.0,
        invert=True
    ),
    ("enclosure", "build_time_minutes"): NormalizationBaseline(
        product_type=ProductType.ENCLOSURE,
        metric_name="build_time_minutes",
        min_value=60.0,
        max_value=600.0,
        invert=True
    ),
    
    # Safety factor (higher is better, but diminishing returns above 3.0)
    ("generic", "safety_factor"): NormalizationBaseline(
        product_type=ProductType.GENERIC,
        metric_name="safety_factor",
        min_value=1.0,
        max_value=3.0,
        optimal_value=2.0
    ),
    
    # Smoothness score (aesthetic; higher is better)
    ("generic", "smoothness_score"): NormalizationBaseline(
        product_type=ProductType.GENERIC,
        metric_name="smoothness_score",
        min_value=0.0,
        max_value=10.0
    ),
}


class NormalizationConfig:
    """Manages normalization baselines for metrics."""
    
    def __init__(self, baselines: Optional[Dict[tuple, NormalizationBaseline]] = None):
        """
        Initialize with custom or default baselines.
        
        Args:
            baselines: Dict mapping (product_type, metric_name) to NormalizationBaseline
        """
        self.baselines = baselines if baselines is not None else DEFAULT_BASELINES.copy()
    
    def get_baseline(self, product_type: str, metric_name: str) -> Optional[NormalizationBaseline]:
        """
        Retrieve baseline for given product type and metric.
        Falls back to 'generic' product type if specific type not found.
        
        Args:
            product_type: Product type string
            metric_name: Metric name
        
        Returns:
            NormalizationBaseline or None if not found
        """
        # Try exact match
        key = (product_type.lower(), metric_name)
        if key in self.baselines:
            return self.baselines[key]
        
        # Try generic fallback
        generic_key = ("generic", metric_name)
        if generic_key in self.baselines:
            return self.baselines[generic_key]
        
        return None
    
    def normalize_metric(self, product_type: str, metric_name: str, raw_value: float) -> float:
        """
        Normalize a metric value using baseline.
        
        Args:
            product_type: Product type string
            metric_name: Metric name
            raw_value: Raw metric value
        
        Returns:
            Normalized score [0, 1], or raw_value if no baseline found
        """
        baseline = self.get_baseline(product_type, metric_name)
        if baseline:
            return baseline.normalize(raw_value)
        
        # No baseline found, return raw value (caller should handle)
        return raw_value
    
    def add_baseline(self, baseline: NormalizationBaseline):
        """Add or update a baseline."""
        key = (baseline.product_type.value, baseline.metric_name)
        self.baselines[key] = baseline
    
    def remove_baseline(self, product_type: str, metric_name: str) -> bool:
        """Remove a baseline. Returns True if removed."""
        key = (product_type.lower(), metric_name)
        if key in self.baselines:
            del self.baselines[key]
            return True
        return False
    
    def list_baselines(self, product_type: Optional[str] = None) -> List[NormalizationBaseline]:
        """
        List all baselines, optionally filtered by product type.
        
        Args:
            product_type: Optional filter by product type
        
        Returns:
            List of NormalizationBaseline objects
        """
        if product_type:
            return [
                b for (pt, _), b in self.baselines.items()
                if pt == product_type.lower()
            ]
        return list(self.baselines.values())


# Global normalization config (can be customized per tenant via tenant_settings)
_global_config = NormalizationConfig()


def get_normalization_config() -> NormalizationConfig:
    """Get global normalization configuration."""
    return _global_config


def normalize_metrics_dict(
    metrics: Dict[str, Any],
    product_type: str,
    config: Optional[NormalizationConfig] = None
) -> Dict[str, float]:
    """
    Normalize all metrics in a dict using baselines.
    
    Args:
        metrics: Raw metrics dict
        product_type: Product type for baseline selection
        config: Optional custom normalization config
    
    Returns:
        Dict with normalized values (keys suffixed with '_normalized')
    """
    if config is None:
        config = get_normalization_config()
    
    normalized = {}
    for metric_name, raw_value in metrics.items():
        if isinstance(raw_value, (int, float)):
            norm_value = config.normalize_metric(product_type, metric_name, float(raw_value))
            normalized[f"{metric_name}_normalized"] = norm_value
        else:
            # Non-numeric metrics pass through
            normalized[metric_name] = raw_value
    
    return normalized


# Supabase helpers for storing/retrieving custom baselines
def store_baseline_supabase(
    supabase_client,
    baseline: NormalizationBaseline,
    tenant_id: str
) -> Dict[str, Any]:
    """
    Store normalization baseline in tenant_settings as JSON.
    Key format: 'baseline_{product_type}_{metric_name}'
    """
    key = f"baseline_{baseline.product_type.value}_{baseline.metric_name}"
    value = baseline.dict()
    
    # Upsert into tenant_settings
    payload = {
        "tenant_id": tenant_id,
        "key": key,
        "value": value
    }
    
    # Check if exists
    existing = (
        supabase_client.table("tenant_settings")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("key", key)
        .execute()
    )
    
    if existing.data:
        # Update
        resp = (
            supabase_client.table("tenant_settings")
            .update({"value": value})
            .eq("tenant_id", tenant_id)
            .eq("key", key)
            .execute()
        )
    else:
        # Insert
        resp = supabase_client.table("tenant_settings").insert(payload).execute()
    
    return resp.data[0] if resp.data else {}


def load_baselines_supabase(
    supabase_client,
    tenant_id: str
) -> NormalizationConfig:
    """
    Load tenant-specific baselines from tenant_settings.
    Merges with default baselines.
    """
    config = NormalizationConfig()  # Start with defaults
    
    # Fetch all baseline_ keys for tenant
    resp = (
        supabase_client.table("tenant_settings")
        .select("key, value")
        .eq("tenant_id", tenant_id)
        .like("key", "baseline_%")
        .execute()
    )
    
    for row in (resp.data or []):
        try:
            baseline_data = row["value"]
            baseline = NormalizationBaseline(**baseline_data)
            config.add_baseline(baseline)
        except Exception as e:
            print(f"Warning: Failed to load baseline from key {row['key']}: {e}")
    
    return config


def delete_baseline_supabase(
    supabase_client,
    product_type: str,
    metric_name: str,
    tenant_id: str
) -> bool:
    """Delete custom baseline from tenant_settings."""
    key = f"baseline_{product_type.lower()}_{metric_name}"
    resp = (
        supabase_client.table("tenant_settings")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("key", key)
        .execute()
    )
    return bool(resp.data)
