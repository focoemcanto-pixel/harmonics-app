-- supabase/migrations/20260404052059_create_contract_template_variables.sql

CREATE TABLE IF NOT EXISTS contract_template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
  variable_key TEXT NOT NULL,
  label TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'direct',
  source_path TEXT,
  fallback_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: variable_key único por template
  CONSTRAINT unique_variable_key_per_template UNIQUE (template_id, variable_key)
);

-- Índices para performance
CREATE INDEX idx_contract_template_variables_template_id ON contract_template_variables(template_id);
CREATE INDEX idx_contract_template_variables_variable_key ON contract_template_variables(variable_key);
CREATE INDEX idx_contract_template_variables_source_type ON contract_template_variables(source_type);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contract_template_variables_updated_at
  BEFORE UPDATE ON contract_template_variables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE contract_template_variables ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ler variáveis de templates ativos
CREATE POLICY "Authenticated users can read variables of active templates"
  ON contract_template_variables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contract_templates
      WHERE contract_templates.id = contract_template_variables.template_id
      AND contract_templates.is_active = true
    )
  );

-- Política: Admins podem fazer tudo
CREATE POLICY "Admins can do everything on template variables"
  ON contract_template_variables
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
COMMENT ON TABLE contract_template_variables IS 'Variáveis/tags usadas nos templates de contrato';
COMMENT ON COLUMN contract_template_variables.template_id IS 'Referência ao template pai';
COMMENT ON COLUMN contract_template_variables.variable_key IS 'Chave da variável (ex: "client_name" para usar como {{client_name}})';
COMMENT ON COLUMN contract_template_variables.label IS 'Rótulo legível da variável (ex: "Nome do Cliente")';
COMMENT ON COLUMN contract_template_variables.source_type IS 'Tipo de fonte dos dados (direct, computed, conditional, formatted)';
COMMENT ON COLUMN contract_template_variables.source_path IS 'Caminho do dado na fonte (ex: "client.name", "event.date")';
COMMENT ON COLUMN contract_template_variables.fallback_value IS 'Valor padrão se a variável não for encontrada';
