-- The Apply work (applications, alerts, browser helper). Everything here is also at the end of
-- newpage.sql; this file is the same statements on their own, to paste into the Supabase SQL
-- editor after schema.sql and newpage.sql. Safe to run more than once.

-- ── Applications ──
-- What a member has applied for and what came back. title, company, url,
-- job_description and notes are sealed with the member's key (newpage-vault.js);
-- status, board, dates, fit and source stay plain so the Today card and the
-- crons can filter on them.
CREATE TABLE IF NOT EXISTS newpage_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES newpage_members(id) ON DELETE CASCADE,
  title text NOT NULL,
  company text,
  board text CHECK (board IN ('seek','indeed','linkedin','jora','employer','other')),
  url text,
  job_description text,
  resume_doc_id uuid REFERENCES newpage_docs(id) ON DELETE SET NULL,
  cover_doc_id uuid REFERENCES newpage_docs(id) ON DELETE SET NULL,
  fit jsonb,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('saved','applied','viewed','screening','interview','offer','rejected','withdrawn','no_reply')),
  applied_at date,
  status_at timestamptz DEFAULT now(),
  notes text,
  source text DEFAULT 'member' CHECK (source IN ('member','alert','extension')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS newpage_applications_member_idx ON newpage_applications (member_id, applied_at DESC);
ALTER TABLE newpage_applications ENABLE ROW LEVEL SECURITY;

-- ── Early alerts ──
-- New listings that fit, found through Adzuna's licensed API or (later) captured from
-- the member's own browser. One row per member per listing. title, company, location,
-- snippet and url stay plain: they are the job board's public text, not the member's.
CREATE TABLE IF NOT EXISTS newpage_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES newpage_members(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text, company text, location text, salary text,
  url text NOT NULL,
  board text,
  posted_at timestamptz,
  snippet text,
  fit jsonb,
  state text NOT NULL DEFAULT 'new' CHECK (state IN ('new','seen','opened','dismissed','applied')),
  dismiss_reason text,
  source text DEFAULT 'adzuna' CHECK (source IN ('adzuna','capture')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (member_id, external_id)
);
CREATE INDEX IF NOT EXISTS newpage_alerts_member_idx ON newpage_alerts (member_id, state, created_at DESC);
ALTER TABLE newpage_alerts ENABLE ROW LEVEL SECURITY;

-- ── Fit checks and the browser helper ──
ALTER TABLE newpage_usage DROP CONSTRAINT IF EXISTS newpage_usage_kind_check;
ALTER TABLE newpage_usage ADD CONSTRAINT newpage_usage_kind_check CHECK (kind IN ('messages','resumes','tailored','covers','fit','answers','ext'));

-- Pairing tokens for the browser helper (extension). Only a hash is stored; the token
-- itself is shown to the member's browser once. Rotated on every refresh, revocable
-- from the app, gone when the member signs out everywhere or deletes their data.
CREATE TABLE IF NOT EXISTS newpage_extension_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES newpage_members(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  device text,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS newpage_extension_tokens_member_idx ON newpage_extension_tokens (member_id);
ALTER TABLE newpage_extension_tokens ENABLE ROW LEVEL SECURITY;
