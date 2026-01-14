-- Patch existing tables to expected columns
-- Safe, additive changes only

-- runs
alter table if exists public.runs
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists status text not null default 'queued',
    add column if not exists prompt text,
    add column if not exists metadata jsonb,
    add column if not exists user_id uuid;

-- variants
alter table if exists public.variants
    add column if not exists run_id uuid,
    add column if not exists index_in_run int,
    add column if not exists score numeric,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists data jsonb;

-- FKs (if missing)
do $$ begin
    if not exists (
        select 1 from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        where t.relname = 'variants' and c.contype = 'f'
    ) then
        alter table public.variants
            add constraint variants_run_id_fkey foreign key (run_id) references public.runs(id) on delete cascade;
    end if;
end $$;

-- variant_assets
alter table if exists public.variant_assets
    add column if not exists variant_id uuid,
    add column if not exists kind text,
    add column if not exists path text,
    add column if not exists signed_url text,
    add column if not exists created_at timestamptz not null default now();

do $$ begin
    if not exists (
        select 1 from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        where t.relname = 'variant_assets' and c.contype = 'f'
    ) then
        alter table public.variant_assets
            add constraint variant_assets_variant_id_fkey foreign key (variant_id) references public.variants(id) on delete cascade;
    end if;
end $$;

-- Enable RLS
alter table if exists public.runs enable row level security;
alter table if exists public.variants enable row level security;
alter table if exists public.variant_assets enable row level security;

-- Policies (idempotent)
create policy if not exists runs_select_anon on public.runs for select to anon using (true);
create policy if not exists variants_select_anon on public.variants for select to anon using (true);
create policy if not exists variant_assets_select_anon on public.variant_assets for select to anon using (true);
