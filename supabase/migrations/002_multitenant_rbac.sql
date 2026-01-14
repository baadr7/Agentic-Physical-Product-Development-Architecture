-- Multitenant & RBAC extension migration
-- Tenants table: isolates customer data segments
CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- User roles per tenant: maps a Supabase auth user to a role within a tenant scope
CREATE TABLE IF NOT EXISTS user_roles (
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin','designer','engineer','reviewer','reader')),
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

-- Index to accelerate queries by user
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles(user_id);
-- Index to accelerate queries by tenant
CREATE INDEX IF NOT EXISTS user_roles_tenant_idx ON user_roles(tenant_id);
