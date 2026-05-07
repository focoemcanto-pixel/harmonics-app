-- supabase/migrations/20260404052057_create_contract_templates.sql

CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contract_templates_is_active ON contract_templates(is_active);
CREATE INDEX idx_contract_templates_category ON contract_templates(category);
CREATE INDEX idx_contract_templates_created_by ON contract_templates(created_by);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ler templates ativos
CREATE POLICY "Authenticated users can read active templates"
  ON contract_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Política: Admins podem fazer tudo
CREATE POLICY "Admins can do everything on templates"
  ON contract_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Comentários de documentação
COMMENT ON TABLE contract_templates IS 'Templates de contratos modulares';
COMMENT ON COLUMN contract_templates.name IS 'Nome do template (ex: "Contrato Musical Padrão")';
COMMENT ON COLUMN contract_templates.category IS 'Categoria do template (ex: "musical", "corporativo", "particular")';
COMMENT ON COLUMN contract_templates.description IS 'Descrição opcional do template';
COMMENT ON COLUMN contract_templates.is_active IS 'Se o template está ativo e disponível para uso';
COMMENT ON COLUMN contract_templates.created_by IS 'UUID do usuário que criou o template';
