# Auditoria — fonte real da aba **Sugestões** do painel do cliente

Data: 2026-04-14

## 1) Componente exato da aba Sugestões (cliente)

- A aba é renderizada dentro de `ClienteHome`.
- O componente específico é a função `SugestoesTab` no arquivo:
  - `components/cliente/ClienteHome.js`

Pontos de referência no arquivo:
- Definição do componente: `function SugestoesTab(...)`
- Fetch responsável: `fetch('/api/suggestions/songs', { cache: 'no-store' })`
- Uso na navegação da aba: `activeTab === 'sugestoes'` renderizando `<SugestoesTab />`

## 2) Fonte real dos dados

A fonte **real** da aba Sugestões do cliente é:

1. **API route interna do Next**: `GET /api/suggestions/songs`
2. Essa rota chama **Supabase (admin client)**
3. A consulta vai para a tabela **`public.suggestion_songs`**
4. Com filtro de origem em `source_type`:
   - `source_type = 'admin'`
   - `source_type = 'imported'`
   - `source_type IS NULL`

Ou seja: não vem de `repertoire_items` diretamente no fluxo da aba Sugestões do cliente.

## 3) Query/fetch exato usado pela aba Sugestões do cliente

### Front-end (cliente)
- Arquivo: `components/cliente/ClienteHome.js`
- Trecho:

```js
const response = await fetch('/api/suggestions/songs', { cache: 'no-store' });
```

### API route
- Arquivo: `app/api/suggestions/songs/route.js`
- Trecho principal:

```js
const songs = await fetchClientSuggestionsCatalog(supabase);
```

### Consulta Supabase efetiva
- Arquivo: `lib/sugestoes/client-suggestions-catalog.js`
- Tabela e filtro:

```js
.from('suggestion_songs')
...
.or('source_type.eq.admin,source_type.eq.imported,source_type.is.null')
```

## 4) Fallback hardcoded/local no fluxo

Não há fallback local/hardcoded de músicas no carregamento da aba Sugestões.

Quando falha o fetch:
- `songs` é setado para `[]`
- Exibe estado de erro de UI (`songsError`)
- Botão de retry apenas repete o mesmo fetch para `/api/suggestions/songs`

Portanto, não existe lista local “backup” de canções nesse fluxo.

## 5) Observação de auditoria (importante)

Existe uma inconsistência de naming no admin:
- A rota `app/api/admin/suggestions/client-panel-songs/route.js` **também** chama `fetchClientSuggestionsCatalog(...)`.
- Na prática, ela está retornando catálogo editorial da `suggestion_songs`, não uma coleta independente das escolhas do cliente.

Isso explica por que o nome “client-panel-songs” pode induzir a leitura errada da origem.

## 6) Resumo do fluxo completo

1. Cliente abre aba Sugestões no painel.
2. `SugestoesTab` dispara `GET /api/suggestions/songs`.
3. Rota chama `fetchClientSuggestionsCatalog`.
4. Helper consulta Supabase na tabela `suggestion_songs` com filtro de `source_type` (`admin/imported/null`).
5. Resultado volta para o cliente e é exibido na aba.
6. Em erro, não há fallback de músicas; apenas UI de falha + retry.
