create extension if not exists pgcrypto;

create table if not exists public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null,
  anonymous_id text,
  posthog_distinct_id text,
  title text not null default '',
  industry text not null default '',
  score_before integer not null default 0,
  score_after integer not null default 0,
  label text not null default '',
  has_resume boolean not null default false,
  jd_chars integer not null default 0,
  resume_chars integer not null default 0,
  jd_preview text not null default '',
  source text not null default 'model',
  persona jsonb not null default '{}'::jsonb,
  rewrite jsonb not null default '{}'::jsonb,
  page_url text,
  user_agent text
);

create index if not exists analysis_sessions_created_at_idx
  on public.analysis_sessions (created_at desc);

create index if not exists analysis_sessions_anonymous_id_idx
  on public.analysis_sessions (anonymous_id);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null,
  steps text[] not null default '{}',
  reproducible boolean,
  error_text text,
  message text,
  contact text,
  rating numeric(2, 1),
  page text,
  status text not null default 'open',
  user_agent text
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

create index if not exists feedback_type_idx
  on public.feedback (type);

alter table public.analysis_sessions enable row level security;
alter table public.feedback enable row level security;

-- MVP 阶段所有读写都通过 Next.js 服务端的 service_role key 完成。
-- 不创建 anon 访问 policy，避免浏览器直接读取业务数据。
