# Diagnóstico forense — Persistência/Reidratação do Repertório do Cliente

## Resumo executivo

O fluxo atual não persiste/reidrata todos os blocos a partir da mesma fonte.

- **SAÍDA** reaparece porque a UI reidrata primariamente de `repertoire_config` (`exit_*`).
- **RECEPTIVO** reaparece porque a UI reidrata primariamente de `repertoire_config` (`reception_*`).
- **CORTEJO** e **CERIMÔNIA** dependem de `repertoire_items`; se `repertoire_items` vier vazio/incompleto, a UI cai em defaults.
- **ANTESALA** está dividida entre `repertoire_config`, `repertoire_items` e `events`; há fonte múltipla e possível inconsistência entre flags.

A primeira divergência estrutural do fluxo é: **a leitura da UI usa fontes diferentes por bloco**.

## Mapa real por bloco

### Antesala
- **Tabelas (escrita)**
  - `repertoire_config`: `has_ante_room`, `ante_room_style`, `ante_room_notes`.
  - `events`: `has_antesala`, `antesala_enabled`, `antesala_requested_by_client`, `antesala_request_status`, `antesala_price_increment`, `antesala_duration_minutes`.
  - `repertoire_items` (somente se `querAntessala === true`): seção `antessala`, incluindo item principal e referências.
- **Leitura na carga**
  - `querAntessala` vem de `config.has_ante_room`.
  - `antessala.estilo`/`observacao` priorizam `repertoire_config`.
  - `antessala.generos`/`artistas` e referências vêm de `repertoire_items`.
  - `requestedByClient` e dados de solicitação vêm de `events`.
- **Risco observado**
  - Estado dividido em 3 fontes com precedência distinta.

### Cortejo
- **Tabela (escrita)**
  - `repertoire_items` com `section='cortejo'`.
- **Leitura na carga**
  - Exclusivamente `repertoire_items` via `mapItemsToInitialState`.
- **Risco observado**
  - Se `repertoire_items` faltar/incompleto, cai em defaults.

### Cerimônia
- **Tabela (escrita)**
  - `repertoire_items` com `section='cerimonia'`.
- **Leitura na carga**
  - Exclusivamente `repertoire_items` via `mapItemsToInitialState`.
- **Risco observado**
  - Se `repertoire_items` faltar/incompleto, cai em defaults.

### Saída
- **Tabela (escrita)**
  - `repertoire_config`: `exit_song`, `exit_reference`, `exit_notes`, `exit_reference_*`.
  - também pode existir item em `repertoire_items` seção `saida`.
- **Leitura na carga**
  - Primariamente de `repertoire_config` (não depende de `repertoire_items` para reaparecer).
- **Motivo de permanecer após refresh**
  - Fonte de leitura robusta em `repertoire_config`.

### Receptivo
- **Tabela (escrita)**
  - `repertoire_config`: `has_reception`, `reception_duration`, `reception_genres`, `reception_artists`, `reception_notes`.
  - também pode existir item em `repertoire_items` seção `receptivo`.
- **Leitura na carga**
  - Primariamente de `repertoire_config` com fallback para `repertoire_items`.
- **Motivo de permanecer após refresh**
  - Fonte primária de leitura em `repertoire_config`.

## Primeira divergência real

A primeira divergência objetiva está na **camada de leitura/reidratação**:

- `saida` e `receptivo` são reconstruídos a partir de `repertoire_config`.
- `cortejo` e `cerimonia` dependem exclusivamente de `repertoire_items`.
- `antessala` mistura `repertoire_config` + `events` + `repertoire_items`.

Assim, um problema apenas em `repertoire_items` afeta cortejo/cerimônia (e parte de antesala), mas não necessariamente saída/receptivo.

## Arquivos-chave do problema

1. `app/cliente/[token]/repertorio/page.js`
   - Define a leitura em múltiplas fontes e a precedência na montagem do `initialState`.
2. `components/cliente/ClienteHome.js`
   - Define montagem de payload por bloco (`buildConfigPayload`, `buildItemsPayload`).
3. `app/api/cliente/repertorio/route.js`
   - Faz persistência em `repertoire_config`, `events` e `repertoire_items` (delete + insert).

## Patch mínimo recomendado (sem refactor amplo)

1. **Congelar contrato de fonte por bloco** (sem mudar rotas/auth):
   - manter `saida`/`receptivo` em `repertoire_config` como já está.
   - manter `cortejo`/`cerimonia` em `repertoire_items`.
   - para `antessala`, definir uma única fonte de verdade para status de solicitação (`events`) e não depender de inferência paralela.
2. **Proteção contra overwrite destrutivo de itens por seção**:
   - antes de `delete+insert`, validar presença esperada por seção crítica (`cortejo`, `cerimonia`) quando houve edição nessas etapas no cliente.
3. **Reidratação defensiva**:
   - quando `repertoire_items` vier vazio e houver histórico/config indicando repertório preenchido, não substituir imediatamente por defaults silenciosos sem sinalização.

Esse patch é mínimo, localizado e não altera rotas/auth.
