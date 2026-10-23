ALTER TABLE public.precontracts ADD COLUMN IF NOT EXISTS expires_at timestamptz;
COMMENT ON COLUMN public.precontracts.expires_at IS 'Explicit public link deadline; null preserves legacy created_at-based expiration.';
