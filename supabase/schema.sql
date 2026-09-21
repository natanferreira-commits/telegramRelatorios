-- Telegram Relatorios — schema completo.
-- Rode ISTO inteiro no SQL Editor do Supabase (projeto novo). Idempotente.

-- Donos dos canais (afiliado nosso ou concorrente). Agrupa canais nos filtros.
create table if not exists affiliates (
  id bigint generated always as identity primary key,
  nome text not null unique,
  nicho text,
  grupo text not null default 'proprio', -- 'proprio' | 'concorrente'
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Vinculo N:N dono <-> canal.
create table if not exists affiliate_channels (
  affiliate_id bigint not null references affiliates (id) on delete cascade,
  channel_id text not null,
  channel_title text,
  created_at timestamptz not null default now(),
  primary key (affiliate_id, channel_id)
);
create index if not exists idx_affch_channel on affiliate_channels (channel_id);

-- Canais/grupos que a conta do Telegram enxerga. O coletor preenche sozinho;
-- voce so liga (ativo) os que quer monitorar, na tela /fontes.
create table if not exists sources (
  channel_id text primary key,            -- formato "-100<id>" (igual Bot API)
  title text,
  username text,
  kind text not null default 'channel',   -- 'channel' | 'group'
  members int,
  ativo boolean not null default false,
  backfill_days int not null default 45,  -- quanto de historico puxar na 1a vez
  last_msg_id bigint not null default 0,  -- cursor: ultimo post coletado
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

-- Posts coletados.
create table if not exists posts (
  id bigint generated always as identity primary key,
  channel_id text not null,
  channel_title text,
  telegram_msg_id bigint,
  text text,
  media_type text,
  has_link boolean,
  album_size int,
  views int,
  forwards int,
  reactions int,
  posted_at timestamptz not null,
  created_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  -- categorizacao por IA (categorized_at null = pendente)
  cat_tipo text,
  cat_casa text,
  cat_modalidade text,
  cat_gatilho text,
  categorized_at timestamptz,
  unique (channel_id, telegram_msg_id)
);
create index if not exists idx_posts_channel on posts (channel_id, posted_at desc);
create index if not exists idx_posts_posted on posts (posted_at desc);
create index if not exists idx_posts_uncategorized on posts (categorized_at) where categorized_at is null;

-- Historico de execucoes do coletor (tambem serve de batimento: mantem o
-- projeto ativo no plano gratis do Supabase).
create table if not exists collector_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  origem text,            -- 'cron' | 'cli' | 'manual'
  fontes int,
  novos int,
  categorizados int,
  pendentes int,
  erro text
);
create index if not exists idx_runs_started on collector_runs (started_at desc);

-- So o servidor (service role) acessa. RLS ligado sem policy = anon nao le nada.
alter table affiliates enable row level security;
alter table affiliate_channels enable row level security;
alter table sources enable row level security;
alter table posts enable row level security;
alter table collector_runs enable row level security;

-- ===== Agregacoes (o Postgres conta; a API devolve ja somado) =====

-- Volume por bucket (dia/semana) x tipo. Janela: ~15 dias (dia) ou ~57 dias (semana).
create or replace function content_buckets(
  p_bucket text,
  p_channel_ids text[] default null
)
returns table(bucket_key text, cat_tipo text, cnt bigint)
language sql stable
as $$
  select
    case
      when p_bucket = 'week'
        then to_char(date_trunc('week', (posted_at at time zone 'America/Sao_Paulo')), 'YYYY-MM-DD')
      else to_char((posted_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')
    end as bucket_key,
    coalesce(cat_tipo, 'outro') as cat_tipo,
    count(*) as cnt
  from posts
  where posted_at >= now() - (case when p_bucket = 'week' then interval '57 days' else interval '15 days' end)
    and (p_channel_ids is null or channel_id = any (p_channel_ids))
  group by 1, 2;
$$;

create or replace function content_tipo_counts(
  p_channel_ids text[] default null,
  p_since_days int default 30
)
returns table(cat_tipo text, cnt bigint)
language sql stable
as $$
  select coalesce(cat_tipo, 'outro') as cat_tipo, count(*) as cnt
  from posts
  where posted_at >= now() - ((p_since_days || ' days')::interval)
    and (p_channel_ids is null or channel_id = any (p_channel_ids))
  group by 1;
$$;

create or replace function content_hour_counts(
  p_channel_ids text[] default null,
  p_since_days int default 30
)
returns table(hour int, cnt bigint)
language sql stable
as $$
  select extract(hour from (posted_at at time zone 'America/Sao_Paulo'))::int as hour, count(*) as cnt
  from posts
  where posted_at >= now() - ((p_since_days || ' days')::interval)
    and (p_channel_ids is null or channel_id = any (p_channel_ids))
  group by 1;
$$;

create or replace function content_tipo_counts_range(
  p_channel_ids text[] default null,
  p_from date default null,
  p_to date default null
)
returns table(cat_tipo text, cnt bigint)
language sql stable
as $$
  select coalesce(cat_tipo, 'outro') as cat_tipo, count(*) as cnt
  from posts
  where (p_from is null or (posted_at at time zone 'America/Sao_Paulo')::date >= p_from)
    and (p_to is null or (posted_at at time zone 'America/Sao_Paulo')::date <= p_to)
    and (p_channel_ids is null or channel_id = any (p_channel_ids))
  group by 1;
$$;

create or replace function content_hour_counts_range(
  p_channel_ids text[] default null,
  p_from date default null,
  p_to date default null
)
returns table(hour int, cnt bigint)
language sql stable
as $$
  select extract(hour from (posted_at at time zone 'America/Sao_Paulo'))::int as hour, count(*) as cnt
  from posts
  where (p_from is null or (posted_at at time zone 'America/Sao_Paulo')::date >= p_from)
    and (p_to is null or (posted_at at time zone 'America/Sao_Paulo')::date <= p_to)
    and (p_channel_ids is null or channel_id = any (p_channel_ids))
  group by 1;
$$;

create or replace function channel_list()
returns table(channel_id text, channel_title text, cnt bigint)
language sql stable
as $$
  select channel_id, max(channel_title) as channel_title, count(*) as cnt
  from posts
  group by channel_id;
$$;

-- Comparativo de periodos: volume, alcance e mix por dia, num intervalo.
-- E o relatorio "esses 5 dias x os mesmos 5 dias do mes passado".
create or replace function content_daily_range(
  p_channel_ids text[] default null,
  p_from date default null,
  p_to date default null
)
returns table(
  dia date,
  posts bigint,
  com_link bigint,
  tips bigint,
  analises bigint,
  cadastro_promo bigint,
  resultados bigint,
  interacao bigint,
  views_media numeric
)
language sql stable
as $$
  select
    (posted_at at time zone 'America/Sao_Paulo')::date as dia,
    count(*) as posts,
    count(*) filter (where has_link) as com_link,
    count(*) filter (where cat_tipo = 'tip') as tips,
    count(*) filter (where cat_tipo = 'analise') as analises,
    count(*) filter (where cat_tipo in ('cadastro', 'promo', 'reembolso')) as cadastro_promo,
    count(*) filter (where cat_tipo in ('green', 'red')) as resultados,
    count(*) filter (where cat_tipo in ('enquete', 'interacao', 'motivacional')) as interacao,
    round(avg(views) filter (where views is not null)) as views_media
  from posts
  where (p_from is null or (posted_at at time zone 'America/Sao_Paulo')::date >= p_from)
    and (p_to is null or (posted_at at time zone 'America/Sao_Paulo')::date <= p_to)
    and (p_channel_ids is null or channel_id = any (p_channel_ids))
  group by 1
  order by 1;
$$;
