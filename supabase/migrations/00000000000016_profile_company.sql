-- Sub-projeto 24 — Dados da empresa no perfil
-- Adds nullable company-data columns to profiles. These feed the RFP
-- generator as {{empresa_*}} placeholders, so users don't re-type
-- their company info on every RFP.
--
-- All fields nullable. Length CHECKs keep abuse bounded; validation
-- (email format, CNPJ format) lives at the API zod layer where it
-- can surface user-friendly errors.

alter table profiles
  add column if not exists company_name text,
  add column if not exists company_legal_name text,
  add column if not exists company_cnpj text,
  add column if not exists company_email text,
  add column if not exists company_phone text,
  add column if not exists company_address text,
  add column if not exists company_description text;

-- Drop any prior CHECKs (idempotent re-runs) and add length caps.
alter table profiles
  drop constraint if exists profiles_company_name_check,
  drop constraint if exists profiles_company_legal_name_check,
  drop constraint if exists profiles_company_cnpj_check,
  drop constraint if exists profiles_company_email_check,
  drop constraint if exists profiles_company_phone_check,
  drop constraint if exists profiles_company_address_check,
  drop constraint if exists profiles_company_description_check;

alter table profiles
  add constraint profiles_company_name_check
    check (company_name is null or char_length(company_name) between 1 and 200),
  add constraint profiles_company_legal_name_check
    check (company_legal_name is null or char_length(company_legal_name) between 1 and 200),
  add constraint profiles_company_cnpj_check
    check (company_cnpj is null or char_length(company_cnpj) between 1 and 32),
  add constraint profiles_company_email_check
    check (company_email is null or char_length(company_email) between 1 and 320),
  add constraint profiles_company_phone_check
    check (company_phone is null or char_length(company_phone) between 1 and 32),
  add constraint profiles_company_address_check
    check (company_address is null or char_length(company_address) between 1 and 500),
  add constraint profiles_company_description_check
    check (company_description is null or char_length(company_description) between 1 and 1000);
