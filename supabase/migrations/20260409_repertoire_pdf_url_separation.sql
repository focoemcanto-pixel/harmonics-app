alter table if exists public.repertoire_config
  add column if not exists repertoire_pdf_url text;
