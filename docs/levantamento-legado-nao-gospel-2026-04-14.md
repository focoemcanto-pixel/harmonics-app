# Levantamento — catálogo validado NÃO gospel no legado

Data da auditoria: 2026-04-14.

## Fonte consultada (legado)
Os blocos foram localizados no histórico Git, no commit `fe19964` ("Remove local suggestions fallback and add catalog loading states"), onde o array hardcoded de `songs` foi removido de `components/cliente/ClienteHome.js`.

Comando usado para localizar:

```bash
git show fe19964 -- components/cliente/ClienteHome.js
```

## 1) Músicas NÃO gospel encontradas

Foram encontradas **5 músicas não-gospel** no bloco legado validado:

1. A Thousand Years — Christina Perri
2. Perfect — Ed Sheeran
3. Canon in D — Pachelbel
4. Hallelujah — Instrumental
5. All of Me — John Legend

> Observação: não foram encontrados itens de catálogo não-gospel com gênero `MPB` nem com momento `Receptivo` nesse bloco legado específico.

## 2) Arquivo e trecho

Trecho do legado (no diff do commit `fe19964`) com os itens não-gospel:

```diff
-  {
-    id: '1',
-    title: 'A Thousand Years',
-    artist: 'Christina Perri',
-    genre: 'Romântico',
-    moment: 'Entrada',
-    youtubeId: 'rtOvBOTyX00',
-    thumbnailUrl: 'https://img.youtube.com/vi/rtOvBOTyX00/hqdefault.jpg',
-    description: 'Uma das músicas mais escolhidas para entrada da noiva.',
-    featured: true,
-    tags: ['entrada', 'romantica', 'noiva'],
-  },
-  {
-    id: '2',
-    title: 'Perfect',
-    artist: 'Ed Sheeran',
-    genre: 'Pop',
-    moment: 'Entrada',
-    youtubeId: '2Vv-BfVoq4g',
-    thumbnailUrl: 'https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg',
-    description: 'Muito usada em versões acústicas e elegantes.',
-    featured: true,
-    tags: ['entrada', 'romantica', 'pop'],
-  },
-  {
-    id: '3',
-    title: 'Canon in D',
-    artist: 'Pachelbel',
-    genre: 'Clássico',
-    moment: 'Cortejo',
-    youtubeId: 'NlprozGcs80',
-    thumbnailUrl: 'https://img.youtube.com/vi/NlprozGcs80/hqdefault.jpg',
-    description: 'Clássico muito presente em cerimônias elegantes.',
-    featured: false,
-    tags: ['classico', 'cortejo', 'instrumental'],
-  },
-  {
-    id: '4',
-    title: 'Hallelujah',
-    artist: 'Instrumental',
-    genre: 'Instrumental',
-    moment: 'Cerimônia',
-    youtubeId: '0VqTwnAuHws',
-    thumbnailUrl: 'https://img.youtube.com/vi/0VqTwnAuHws/hqdefault.jpg',
-    description: 'Boa escolha para momentos emocionantes da cerimônia.',
-    featured: true,
-    tags: ['cerimonia', 'emocionante', 'instrumental'],
-  },
-  {
-    id: '5',
-    title: 'All of Me',
-    artist: 'John Legend',
-    genre: 'Romântico',
-    moment: 'Saída',
-    youtubeId: '450p7goxZqg',
-    thumbnailUrl: 'https://img.youtube.com/vi/450p7goxZqg/hqdefault.jpg',
-    description: 'Muito escolhida para saída dos noivos.',
-    featured: false,
-    tags: ['saida', 'romantica'],
-  },
```

## 3) Array único consolidado

```json
[
  {
    "title": "A Thousand Years",
    "artist": "Christina Perri",
    "genre": "Romântico",
    "moment": "Entrada",
    "youtubeId": "rtOvBOTyX00",
    "thumbnailUrl": "https://img.youtube.com/vi/rtOvBOTyX00/hqdefault.jpg",
    "description": "Uma das músicas mais escolhidas para entrada da noiva.",
    "featured": true,
    "tags": ["entrada", "romantica", "noiva"]
  },
  {
    "title": "Perfect",
    "artist": "Ed Sheeran",
    "genre": "Pop",
    "moment": "Entrada",
    "youtubeId": "2Vv-BfVoq4g",
    "thumbnailUrl": "https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg",
    "description": "Muito usada em versões acústicas e elegantes.",
    "featured": true,
    "tags": ["entrada", "romantica", "pop"]
  },
  {
    "title": "Canon in D",
    "artist": "Pachelbel",
    "genre": "Clássico",
    "moment": "Cortejo",
    "youtubeId": "NlprozGcs80",
    "thumbnailUrl": "https://img.youtube.com/vi/NlprozGcs80/hqdefault.jpg",
    "description": "Clássico muito presente em cerimônias elegantes.",
    "featured": false,
    "tags": ["classico", "cortejo", "instrumental"]
  },
  {
    "title": "Hallelujah",
    "artist": "Instrumental",
    "genre": "Instrumental",
    "moment": "Cerimônia",
    "youtubeId": "0VqTwnAuHws",
    "thumbnailUrl": "https://img.youtube.com/vi/0VqTwnAuHws/hqdefault.jpg",
    "description": "Boa escolha para momentos emocionantes da cerimônia.",
    "featured": true,
    "tags": ["cerimonia", "emocionante", "instrumental"]
  },
  {
    "title": "All of Me",
    "artist": "John Legend",
    "genre": "Romântico",
    "moment": "Saída",
    "youtubeId": "450p7goxZqg",
    "thumbnailUrl": "https://img.youtube.com/vi/450p7goxZqg/hqdefault.jpg",
    "description": "Muito escolhida para saída dos noivos.",
    "featured": false,
    "tags": ["saida", "romantica"]
  }
]
```

## 4) SQL para `suggestion_songs`

SQL gerado em:

- `supabase/sql/20260414_seed_nao_gospel_legado.sql`

Ele faz:
- resolve `genre_id` e `moment_id` por nome;
- aplica `source_type='admin'` e `is_active=true`;
- faz `UPSERT` idempotente por `youtube_id`.
