-- Migration 2: Adicionar campos de snapshot e convite à tabela escalas
-- Executar no Supabase SQL Editor

-- Campos de snapshot (copiados de contacts no momento da escala)
ALTER TABLE escalas ADD COLUMN IF NOT EXISTS musician_name TEXT;
ALTER TABLE escalas ADD COLUMN IF NOT EXISTS musician_email TEXT;
ALTER TABLE escalas ADD COLUMN IF NOT EXISTS musician_phone TEXT;

-- Campos de convite (para fase futura)
ALTER TABLE escalas ADD COLUMN IF NOT EXISTS invite_token UUID UNIQUE DEFAULT gen_random_uuid();
ALTER TABLE escalas ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP;
ALTER TABLE escalas ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;

-- Comentários
COMMENT ON COLUMN escalas.musician_name IS 'Snapshot do nome do músico no momento da escala';
COMMENT ON COLUMN escalas.musician_email IS 'Snapshot do email do músico (base para convites)';
COMMENT ON COLUMN escalas.musician_phone IS 'Snapshot do WhatsApp do músico';
COMMENT ON COLUMN escalas.invite_token IS 'Token único para link público de confirmação (/escala/[token])';
COMMENT ON COLUMN escalas.invite_sent_at IS 'Data/hora do envio do convite';
COMMENT ON COLUMN escalas.responded_at IS 'Data/hora da resposta do músico ao convite';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_escalas_invite_token ON escalas(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escalas_musician_email ON escalas(musician_email) WHERE musician_email IS NOT NULL;
