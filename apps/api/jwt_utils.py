"""Simple JWT helper for tests and utilities.

This helper centralizes creation of HS256 JWTs using the `SUPABASE_JWT_SECRET`
environment variable so tests and utilities can consistently generate tokens.
"""
from __future__ import annotations

import os
import jwt
from typing import Dict, Any


def create_jwt(payload: Dict[str, Any] | None = None, role: str = 'designer', tenant: str = 'public') -> str:
    """Return an HS256-signed JWT using `SUPABASE_JWT_SECRET`.

    If `payload` is provided, it's merged with default claims (`sub`, `role`, `tenant`).
    """
    secret = os.getenv('SUPABASE_JWT_SECRET')
    if not secret:
        raise RuntimeError('SUPABASE_JWT_SECRET not configured')
    p = {'sub': 'test-user', 'role': role, 'tenant': tenant}
    if payload:
        p.update(payload)
    token = jwt.encode(p, secret, algorithm='HS256')
    return token
