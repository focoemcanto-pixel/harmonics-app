-- Migration 1: Adicionar contact_type à tabela contacts
-- Executar no Supabase SQL Editor

-- Adicionar coluna contact_type
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'musician';

-- Atualizar contatos existentes
UPDATE contacts SET contact_type = 'musician' WHERE contact_type IS NULL;

-- Adicionar constraint
ALTER TABLE contacts 
ADD CONSTRAINT contacts_contact_type_check 
CHECK (contact_type IN ('musician', 'staff', 'vendor', 'client'));

-- Comentário
COMMENT ON COLUMN contacts.contact_type IS 'Tipo de contato: musician (músico), staff (técnico/prestador), vendor (fornecedor), client (cliente)';
