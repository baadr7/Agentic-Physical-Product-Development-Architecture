-- Supabase schema for prototype generation
-- Tables: runs, variants, variant_assets

-- Runs table
create table if not exists public.runs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    status text not null default 'queued',
    prompt text,
    metadata jsonb,
    user_id uuid
);

-- Variants table
create table if not exists public.variants (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.runs(id) on delete cascade,
    index_in_run int not null,
    score numeric,
    created_at timestamptz not null default now(),
    data jsonb
);

create index if not exists variants_run_id_idx on public.variants(run_id);

-- Variant assets table
create table if not exists public.variant_assets (
    id uuid primary key default gen_random_uuid(),
    variant_id uuid not null references public.variants(id) on delete cascade,
    kind text not null, -- e.g., 'image', 'mesh', 'pdf'
    path text not null, -- storage path
    signed_url text,    -- cached signed url for convenience
    created_at timestamptz not null default now()
);

create index if not exists variant_assets_variant_id_idx on public.variant_assets(variant_id);

-- Enable Row Level Security
alter table public.runs enable row level security;
alter table public.variants enable row level security;
alter table public.variant_assets enable row level security;

-- Policies: Allow anon read; restrict writes to service role
-- Note: Service role bypasses RLS automatically; these policies focus on anon/client reads.

-- Runs policies
create policy if not exists runs_select_anon
    on public.runs for select
    to anon
    using (true);

-- Variants policies
create policy if not exists variants_select_anon
    on public.variants for select
    to anon
    using (true);

-- Variant assets policies
create policy if not exists variant_assets_select_anon
    on public.variant_assets for select
    to anon
    using (true);

-- Optional: allow authenticated users to see their own runs
create policy if not exists runs_select_auth_own
    on public.runs for select
    to authenticated
    using (user_id = auth.uid());

-- Optional: allow authenticated to see variants linked to their runs
create policy if not exists variants_select_auth_own
    on public.variants for select
    to authenticated
    using (exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid()));

-- Optional: allow authenticated to see assets linked to their variants
create policy if not exists variant_assets_select_auth_own
    on public.variant_assets for select
    to authenticated
    using (exists (
        select 1 from public.variants v
        join public.runs r on r.id = v.run_id
        where v.id = variant_id and r.user_id = auth.uid()
    ));
