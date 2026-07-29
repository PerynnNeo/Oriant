-- 0001_integration_credentials.sql
--
-- Real OAuth token storage (item 6). integration_manifests.config is
-- explicitly non-secret metadata; tokens live here instead, encrypted at
-- the application layer (AES-256-GCM, see lib/server/b/crypto.ts) with a
-- server-only key (INTEGRATION_TOKEN_ENCRYPTION_KEY) that never leaves the
-- server and is never returned in any API response. This table only ever
-- stores ciphertext.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor).

create table if not exists integration_credentials (
  id uuid primary key default gen_random_uuid(),
  integration_manifest_id uuid not null references integration_manifests(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_type text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_credentials_manifest_unique unique (integration_manifest_id)
);

create index if not exists integration_credentials_org_idx
  on integration_credentials (organization_id);

-- Keep updated_at current on every write (token refresh, re-connect, etc).
create or replace function integration_credentials_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists integration_credentials_updated_at on integration_credentials;
create trigger integration_credentials_updated_at
  before update on integration_credentials
  for each row execute function integration_credentials_set_updated_at();
