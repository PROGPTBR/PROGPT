-- Sub-projeto 22 — Logo do usuário
-- Adds two nullable columns to profiles so the user can attach a company
-- logo that gets embedded into RFP documents (.docx + .xlsx). Bytes live
-- in Storage bucket `user-logos`; this table just remembers the path.

alter table profiles
  add column if not exists logo_path text,
  add column if not exists logo_mime text;

-- We accept only the two image formats the docx/xlsx renderers handle
-- natively. SVG is rejected (docx ImageRun + exceljs need raster).
alter table profiles
  drop constraint if exists profiles_logo_mime_check;
alter table profiles
  add constraint profiles_logo_mime_check
  check (logo_mime is null or logo_mime in ('image/png', 'image/jpeg'));
