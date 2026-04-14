# Auditoria cirúrgica — catálogo validado de Sugestões

Data: 2026-04-14

## Escopo da busca global

Busca feita por:
- `"GOSPEL CERIMÔNIA"`, `"GOSPEL MODERNO"`, `"featuredCollections"`, `"songs"`,
- `"youtubeId"`, `"youtubeVideoId"`, `"thumbnailUrl"`,
- `"isFavorite"`, `"isAdded"`, `"isAddedToRepertoire"`,
- títulos: `"A Dois"`, `"Escolhi Te Esperar"`, `"Eles Se Amam"`, `"De Olhos Abertos"`, `"Tantos Mares"`, `"Nós Dois"`.

Resultado:
- **não há arrays hardcoded** com esse catálogo validado no código atual;
- **não há ocorrência** dos títulos citados;
- o fluxo ativo depende de **`public.suggestion_songs`**.

## Onde a fonte real está hoje

### UI cliente (aba Sugestões)
- Arquivo: `components/cliente/ClienteHome.js`
- Componente: `SugestoesTab`
- Fluxo:
  1. chama `GET /api/suggestions/songs`;
  2. mapeia payload para shape de UI (`id`, `title`, `artist`, `genre`, `moment`, `youtubeId`, `thumbnailUrl`, `description`, `featured`, `tags`, `isFavorite`, `isAdded`).

### API intermediária
- Arquivo: `app/api/suggestions/songs/route.js`
- `GET` chama `fetchClientSuggestionsCatalog(supabase)`.

### Fonte de dados (catálogo editorial)
- Arquivo: `lib/sugestoes/client-suggestions-catalog.js`
- Consulta em `suggestion_songs` com filtro:
  - `source_type = 'admin'`
  - `is_active = true`
- Inclui relacionamentos de:
  - `suggestion_genres`
  - `suggestion_moments`
  - `suggestion_song_tags` / `suggestion_tags`
  - `suggestion_collection_songs` / `suggestion_collections`

## O que vem do banco vs hardcoded

A) Vem do banco:
- catálogo da aba Sugestões (`suggestion_songs` + relacionamentos),
- dados de gênero/momento/tags/coleções.

B) Vem hardcoded:
- apenas opções visuais de filtros rápidos na UI (ex.: listas default de gêneros/momentos para chips), **não** o catálogo de músicas.

C) Quebra/perda identificada:
- o catálogo validado antigo (blocos como `GOSPEL CERIMÔNIA (VALIDADO)` etc.) **não existe mais no repositório atual**;
- portanto, não há fonte local para “recarregar” exatamente o conjunto antigo sem uma cópia externa (backup/commit antigo/planilha).

## Risco de mistura com repertório

- O carregamento da aba Sugestões do cliente **não consulta** `repertoire_items`.
- A mistura pode acontecer apenas em etapas de importação/admin se dados forem classificados incorretamente em `source_type`.
- A proteção atual para o cliente ficou restrita a `source_type='admin'` e `is_active=true`.

## Estratégia recomendada

### Curto prazo (restauração imediata)
1. Usar `suggestion_songs` como fonte única da aba Sugestões.
2. Repopular o catálogo editorial com a lista validada oficial.
3. Garantir `source_type='admin'`, `is_active=true`.

### Médio prazo (governança)
1. Migrar/normalizar a lista validada para `suggestion_songs` (não para `repertoire_items`).
2. Resolver `genre`/`moment` por `suggestion_genres` e `suggestion_moments`.
3. Opcionalmente associar `tags` em `suggestion_song_tags`.

Script template entregue em:
- `supabase/sql/20260414_editorial_catalog_seed_template.sql`

