-- supabase/migrations/20260404052058_create_contract_template_blocks.sql

CREATE TABLE IF NOT EXISTS contract_template_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  block_key TEXT NOT NULL,
  content TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'standard',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  conditions_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: block_key único por template
  CONSTRAINT unique_block_key_per_template UNIQUE (template_id, block_key),

  -- Validação de formato snake_case
  CONSTRAINT block_key_format_check CHECK (block_key ~ '^[a-z][a-z0-9_]*$')
);

-- Índices para performance
CREATE INDEX idx_contract_template_blocks_template_id ON contract_template_blocks(template_id);
CREATE INDEX idx_contract_template_blocks_order_index ON contract_template_blocks(order_index);
CREATE INDEX idx_contract_template_blocks_is_enabled ON contract_template_blocks(is_enabled);
CREATE INDEX idx_contract_template_blocks_block_type ON contract_template_blocks(block_type);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contract_template_blocks_updated_at
  BEFORE UPDATE ON contract_template_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE contract_template_blocks ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ler blocos de templates ativos
CREATE POLICY "Authenticated users can read blocks of active templates"
  ON contract_template_blocks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contract_templates
      WHERE contract_templates.id = contract_template_blocks.template_id
      AND contract_templates.is_active = true
    )
  );

-- Política: Admins podem fazer tudo
CREATE POLICY "Admins can do everything on template blocks"
  ON contract_template_blocks
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
COMMENT ON TABLE contract_template_blocks IS 'Blocos/cláusulas de cada template de contrato';
COMMENT ON COLUMN contract_template_blocks.template_id IS 'Referência ao template pai';
COMMENT ON COLUMN contract_template_blocks.title IS 'Título do bloco (ex: "Cláusula de Pagamento")';
COMMENT ON COLUMN contract_template_blocks.block_key IS 'Identificador único do bloco dentro do template (formato: snake_case, ex: "payment_terms", "transport_clause")';
COMMENT ON COLUMN contract_template_blocks.content IS 'Conteúdo do bloco com variáveis {{tag}}';
COMMENT ON COLUMN contract_template_blocks.block_type IS 'Tipo do bloco (standard, header, footer, conditional, optional)';
COMMENT ON COLUMN contract_template_blocks.order_index IS 'Ordem de exibição do bloco no contrato final';
COMMENT ON COLUMN contract_template_blocks.is_required IS 'Se o bloco é obrigatório no contrato';
COMMENT ON COLUMN contract_template_blocks.is_enabled IS 'Se o bloco está ativo';
COMMENT ON COLUMN contract_template_blocks.conditions_json IS 'Condições para exibir o bloco (JSON com regras lógicas)';
