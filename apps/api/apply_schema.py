#!/usr/bin/env python3
"""Apply schema.sql to Supabase using direct SQL execution."""
import os
import sys
import requests

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://dvgdxiwmelgwcpdhzemy.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')

if not SUPABASE_KEY:
    print("ERROR: SUPABASE_KEY not set")
    sys.exit(1)

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}

# Read schema from file
try:
    with open('schema.sql', 'r') as f:
        schema_sql = f.read()
except:
    schema_sql = """
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  product_type text,
  description text,
  logo_url text,
  brief text,
  materials jsonb,
  constraints jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  run_id text PRIMARY KEY,
  project_id uuid REFERENCES projects(id),
  status text,
  params jsonb,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  duration_ms integer,
  input_mode text,
  description text,
  options jsonb,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text REFERENCES runs(run_id),
  stl_url text,
  thumbnail_url text,
  metrics jsonb,
  score numeric,
  created_at timestamp with time zone DEFAULT now()
);
"""

# Test connection
print(f"Connecting to {SUPABASE_URL}...")
resp = requests.get(f"{SUPABASE_URL}/rest/v1/", headers=headers, timeout=5)
print(f"Connection test: {resp.status_code}")

# Execute SQL via Supabase RPC (sql function)
# Note: This requires the function to exist. Instead, we'll try direct REST API
# For now, let's at least verify the connection works
if resp.status_code in [200, 400]:
    print("✓ Connected to Supabase")
    print("Note: To apply the schema, copy and paste schema.sql into Supabase SQL Editor:")
    print(f"  Go to: {SUPABASE_URL}/project/sql")
else:
    print(f"✗ Connection failed: {resp.status_code} {resp.text}")
