"""
prompt_extraction.py
Advanced prompt engineering module with constraint extraction, versioning, and embeddings.
Uses LLM to parse user briefs and extract structured design constraints.
"""
import os
import json
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

# Attempt to import spacy for NER (optional)
try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    spacy = None


class DesignConstraints(BaseModel):
    """Structured design constraints extracted from brief."""
    dimensions: Optional[Dict[str, float]] = Field(default_factory=dict, description="Extracted dimensions (length, width, height in mm)")
    material: Optional[str] = Field(None, description="Preferred material name")
    load_conditions: Optional[List[str]] = Field(default_factory=list, description="Load descriptions (e.g., '10N vertical', '5kg suspended')")
    manufacturing_method: Optional[str] = Field(None, description="Preferred method (e.g., 'FDM', 'SLA', 'CNC')")
    aesthetic_preferences: Optional[List[str]] = Field(default_factory=list, description="Style keywords")
    functional_requirements: Optional[List[str]] = Field(default_factory=list, description="Must-have features")
    constraints: Optional[List[str]] = Field(default_factory=list, description="Hard constraints (e.g., 'max weight 200g')")
    target_cost: Optional[float] = Field(None, description="Target cost in currency units")


class PromptVersion(BaseModel):
    """Versioned prompt metadata."""
    prompt_id: str
    version: int
    prompt_text: str
    extracted_constraints: Optional[DesignConstraints] = None
    embedding: Optional[List[float]] = None  # 384-dim or 768-dim vector
    created_at: str
    diff_from_previous: Optional[str] = None


def extract_constraints_with_llm(brief: str, llm_client=None) -> DesignConstraints:
    """
    Extract structured constraints from user brief using LLM.
    
    Args:
        brief: User input text
        llm_client: Mistral or similar LLM client (optional)
    
    Returns:
        DesignConstraints with parsed fields
    """
    # Fallback regex-based extraction if no LLM available
    constraints = DesignConstraints()
    
    # Extract dimensions (look for patterns like "100mm", "10cm", "5 inches")
    dimension_pattern = r'(\d+(?:\.\d+)?)\s?(mm|cm|m|inch|inches|in)'
    matches = re.findall(dimension_pattern, brief.lower())
    if matches:
        dims = {}
        for idx, (value, unit) in enumerate(matches[:3]):  # Take first 3
            key = ["length", "width", "height"][idx] if idx < 3 else f"dim_{idx}"
            # Normalize to mm
            val_mm = float(value)
            if unit in ["cm"]:
                val_mm *= 10
            elif unit in ["m"]:
                val_mm *= 1000
            elif unit in ["inch", "inches", "in"]:
                val_mm *= 25.4
            dims[key] = val_mm
        constraints.dimensions = dims
    
    # Extract material mentions
    material_keywords = ["pla", "abs", "petg", "nylon", "steel", "aluminum", "aluminium", "resin", "wood", "plastic"]
    for mat in material_keywords:
        if mat in brief.lower():
            constraints.material = mat.upper() if mat in ["pla", "abs", "petg"] else mat.capitalize()
            break
    
    # Extract load conditions (look for "load", "force", "weight")
    load_pattern = r'(\d+(?:\.\d+)?)\s?(n|kg|g|lb|lbs|newton|newtons)'
    load_matches = re.findall(load_pattern, brief.lower())
    if load_matches:
        constraints.load_conditions = [f"{val}{unit}" for val, unit in load_matches]
    
    # Extract manufacturing method
    mfg_keywords = ["fdm", "sla", "sls", "cnc", "milling", "turning", "3d print", "additive", "injection"]
    for mfg in mfg_keywords:
        if mfg in brief.lower():
            constraints.manufacturing_method = mfg.upper() if len(mfg) <= 3 else mfg.title()
            break
    
    # Extract aesthetic keywords (simple heuristic: adjectives)
    aesthetic_keywords = ["modern", "minimalist", "organic", "industrial", "sleek", "rugged", "elegant", "compact", "streamlined"]
    constraints.aesthetic_preferences = [kw for kw in aesthetic_keywords if kw in brief.lower()]
    
    # Extract functional requirements (sentences with "must", "should", "need")
    functional_sentences = re.findall(r'[^.!?]*(?:must|should|need|require)[^.!?]*[.!?]', brief, re.IGNORECASE)
    constraints.functional_requirements = [s.strip() for s in functional_sentences[:5]]
    
    # Extract hard constraints (sentences with "max", "min", "no more than")
    constraint_sentences = re.findall(r'[^.!?]*(?:max|min|maximum|minimum|no more than|at least)[^.!?]*[.!?]', brief, re.IGNORECASE)
    constraints.constraints = [s.strip() for s in constraint_sentences[:5]]
    
    # Extract target cost
    cost_pattern = r'(?:budget|cost|price).*?(\d+(?:\.\d+)?)\s?(?:usd|eur|dollar|euro|\$|€)'
    cost_match = re.search(cost_pattern, brief.lower())
    if cost_match:
        constraints.target_cost = float(cost_match.group(1))
    
    # If LLM client provided, use it for better extraction
    if llm_client:
        try:
            llm_prompt = f"""Extract design constraints from this brief in JSON format:

Brief: {brief}

Return JSON with fields:
- dimensions: {{"length": float, "width": float, "height": float}} in mm
- material: string (e.g., "PLA", "Steel")
- load_conditions: list of strings
- manufacturing_method: string
- aesthetic_preferences: list of keywords
- functional_requirements: list of must-have features
- constraints: list of hard constraints
- target_cost: float or null

JSON:"""
            # Assuming llm_client has a .chat() or similar method
            if hasattr(llm_client, 'chat'):
                response = llm_client.chat(messages=[{"role": "user", "content": llm_prompt}])
                json_text = response.choices[0].message.content.strip()
                # Extract JSON from markdown code block if present
                if "```json" in json_text:
                    json_text = json_text.split("```json")[1].split("```")[0].strip()
                elif "```" in json_text:
                    json_text = json_text.split("```")[1].split("```")[0].strip()
                
                llm_data = json.loads(json_text)
                # Merge LLM results with regex fallback (LLM takes priority)
                for key, value in llm_data.items():
                    if value is not None and value != [] and value != {}:
                        setattr(constraints, key, value)
        except Exception as e:
            print(f"Warning: LLM constraint extraction failed: {e}")
            # Fall back to regex extraction (already done)
    
    return constraints


def extract_constraints_with_spacy(brief: str, nlp_model) -> DesignConstraints:
    """
    Extract constraints using spaCy NER (requires trained model).
    
    Args:
        brief: User input text
        nlp_model: Loaded spaCy model (e.g., en_core_web_sm)
    
    Returns:
        DesignConstraints with parsed entities
    """
    if not SPACY_AVAILABLE or not nlp_model:
        return extract_constraints_with_llm(brief, llm_client=None)
    
    doc = nlp_model(brief)
    constraints = DesignConstraints()
    
    # Extract quantities and their contexts
    for ent in doc.ents:
        if ent.label_ == "QUANTITY":
            # Check if it's a dimension
            context = brief[max(0, ent.start_char - 20):min(len(brief), ent.end_char + 20)].lower()
            if any(kw in context for kw in ["length", "width", "height", "diameter", "size"]):
                # Parse dimension
                num_match = re.search(r'(\d+(?:\.\d+)?)', ent.text)
                if num_match:
                    val = float(num_match.group(1))
                    unit = "mm"  # Default
                    if "cm" in ent.text.lower():
                        val *= 10
                    elif "m" in ent.text.lower() and "mm" not in ent.text.lower():
                        val *= 1000
                    
                    if "length" in context:
                        constraints.dimensions["length"] = val
                    elif "width" in context:
                        constraints.dimensions["width"] = val
                    elif "height" in context:
                        constraints.dimensions["height"] = val
                    else:
                        constraints.dimensions[f"dim_{len(constraints.dimensions)}"] = val
        
        elif ent.label_ == "PRODUCT":
            # Potential material or manufacturing method
            if any(mat in ent.text.lower() for mat in ["pla", "abs", "steel", "aluminum"]):
                constraints.material = ent.text
    
    # Fallback to regex for fields spaCy didn't catch
    if not constraints.dimensions:
        fallback = extract_constraints_with_llm(brief, llm_client=None)
        constraints.dimensions = fallback.dimensions
    if not constraints.material:
        fallback = extract_constraints_with_llm(brief, llm_client=None)
        constraints.material = fallback.material
    
    return constraints


def compute_prompt_diff(old_text: str, new_text: str) -> str:
    """
    Compute a simple diff between two prompt texts.
    
    Returns:
        String describing changes (e.g., "Added 'load condition', removed 'aesthetic'")
    """
    old_lines = set(old_text.split('\n'))
    new_lines = set(new_text.split('\n'))
    
    added = new_lines - old_lines
    removed = old_lines - new_lines
    
    changes = []
    if added:
        changes.append(f"Added: {', '.join(list(added)[:3])}")
    if removed:
        changes.append(f"Removed: {', '.join(list(removed)[:3])}")
    
    return "; ".join(changes) if changes else "No changes"


def generate_prompt_embedding(prompt_text: str, embedding_model=None) -> Optional[List[float]]:
    """
    Generate embedding vector for prompt text (for RAG/similarity search).
    
    Args:
        prompt_text: Input text
        embedding_model: sentence-transformers model or similar
    
    Returns:
        List of floats (embedding vector) or None
    """
    if not embedding_model:
        return None
    
    try:
        if hasattr(embedding_model, 'encode'):
            # sentence-transformers style
            embedding = embedding_model.encode(prompt_text, convert_to_numpy=True)
            return embedding.tolist()
        else:
            return None
    except Exception as e:
        print(f"Warning: Embedding generation failed: {e}")
        return None


# Supabase helpers for prompt versioning
def store_prompt_version_supabase(
    supabase_client,
    prompt_id: str,
    version: int,
    prompt_text: str,
    constraints: DesignConstraints,
    embedding: Optional[List[float]],
    diff_from_previous: Optional[str],
    tenant_id: str
) -> Dict[str, Any]:
    """
    Store prompt version in prompts table or separate prompt_versions table.
    For now, update prompts table with version metadata.
    """
    # Option 1: Update prompts table with versioning metadata
    # (Assumes prompts table has version, constraints_json, embedding, diff columns)
    
    # Option 2: Create separate prompt_versions table (recommended for full history)
    # For this implementation, we'll store in a prompt_versions table if it exists,
    # otherwise fall back to updating prompts table
    
    payload = {
        "prompt_id": prompt_id,
        "version": version,
        "prompt_text": prompt_text,
        "constraints_json": constraints.dict(),
        "embedding": embedding,
        "diff_from_previous": diff_from_previous,
        "tenant_id": tenant_id
    }
    
    # Try to insert into prompt_versions table
    try:
        resp = supabase_client.table("prompt_versions").insert(payload).execute()
        return resp.data[0] if resp.data else {}
    except Exception as e:
        # Fallback: update prompts table with latest version metadata
        print(f"Warning: prompt_versions table not found, falling back to prompts table: {e}")
        try:
            resp = (
                supabase_client.table("prompts")
                .update({
                    "version": version,
                    "constraints_json": constraints.dict(),
                    "embedding": embedding,
                    "diff_from_previous": diff_from_previous
                })
                .eq("id", prompt_id)
                .execute()
            )
            return resp.data[0] if resp.data else {}
        except Exception as e2:
            print(f"Error storing prompt version: {e2}")
            return {}


def get_prompt_versions_supabase(
    supabase_client,
    prompt_id: str,
    tenant_id: str
) -> List[Dict[str, Any]]:
    """Retrieve all versions of a prompt."""
    try:
        resp = (
            supabase_client.table("prompt_versions")
            .select("*")
            .eq("prompt_id", prompt_id)
            .eq("tenant_id", tenant_id)
            .order("version", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception:
        # Fallback: return single version from prompts table
        resp = (
            supabase_client.table("prompts")
            .select("*")
            .eq("id", prompt_id)
            .execute()
        )
        return resp.data or []
