-- Sub-projeto 16 — open taxonomy with admin curation
-- Drops the closed CHECK constraint from sub-projeto 13 (only 11 themes allowed)
-- and adds theme_status so the classifier can propose new themes that admins
-- then promote to canonical. Anti-proliferation: candidate themes stay
-- visually separated in the admin UI until promoted.

alter table articles
  drop constraint if exists articles_theme_check;

-- theme_status: 'canonical' = one of the curated set; 'candidate' = LLM-proposed,
-- awaiting admin promotion. Default 'canonical' keeps inserts of existing
-- canonical names working with no code change.
alter table articles
  add column if not exists theme_status text not null default 'canonical'
    check (theme_status in ('canonical', 'candidate'));

-- Backfill: existing rows where theme is in the original 11-theme set become
-- canonical (default already handles this); any pre-existing rows with themes
-- outside the set (shouldn't exist due to the dropped CHECK, but safe) become
-- candidates so admin can see them in the candidates panel.
update articles
set theme_status = 'candidate'
where theme not in (
  'Kraljic',
  'Sourcing Estratégico',
  'SRM',
  'TCO',
  'Sustentabilidade',
  'Risco / Resiliência',
  'Negociação / Contratos',
  'Performance / KPIs',
  'Digital / Tecnologia',
  'Setor Público',
  'Outros'
);

-- Length guard at DB level — keeps a malformed classifier response from
-- inserting 5000-char "themes" that explode the admin sidebar.
alter table articles
  add constraint articles_theme_length_check
    check (char_length(theme) between 1 and 50);

create index if not exists articles_theme_status_idx on articles (theme_status);
