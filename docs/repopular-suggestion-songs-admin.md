# Repopular `suggestion_songs` com catálogo validado (source_type=`admin`)

Este fluxo converte blocos antigos (`GOSPEL CERIMÔNIA`, `GOSPEL MODERNO`, `featuredCollections`, `songs`, `filters`) em:

1. array consolidado;
2. relatório de deduplicação;
3. SQL idempotente de UPSERT para `public.suggestion_songs`.

## Comando

```bash
npm run seed:editorial-catalog -- \
  --input /caminho/catalogo-legado.txt \
  --out-json /tmp/catalogo-consolidado.json \
  --out-sql /tmp/catalogo-consolidado.sql
```

Também aceita `STDIN`:

```bash
cat /caminho/catalogo-legado.txt | npm run seed:editorial-catalog -- --out-sql /tmp/catalogo-consolidado.sql
```

## Regras aplicadas

- Campos normalizados:
  - `youtubeId` → `youtube_id`
  - `youtubeUrl` → `youtube_url`
  - `thumbnailUrl` → `thumbnail_url`
  - `featured` → `is_featured`
- Força:
  - `source_type = 'admin'`
  - `is_active = true`
- Fallbacks automáticos:
  - `youtube_url`: `https://www.youtube.com/watch?v={youtube_id}`
  - `thumbnail_url`: `https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg`
- Deduplicação:
  1. por `youtube_id`;
  2. por `title + artist` normalizados.
- SQL faz resolução de gênero/momento com `LEFT JOIN` em `suggestion_genres` e `suggestion_moments`.
  - Sem match: `genre_id`/`moment_id` permanecem nulos.
  - Valores legados (`original_genre`, `original_moment`) permanecem no payload para auditoria.

## Observações

- O script **não escreve direto no banco**. Ele gera SQL pronto para execução no Supabase.
- O SQL tenta inserir nomes de tags em `suggestion_tags`, mas não cria vínculos em `suggestion_song_tags` nesta etapa.
- O output JSON em `stdout` traz `consolidated`, `summary` e `sql` para revisão.
