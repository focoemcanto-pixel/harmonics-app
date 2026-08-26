import fs from 'node:fs';

function patch(path, mutate) {
  let source = fs.readFileSync(path, 'utf8');
  const before = source;
  source = mutate(source);
  if (source !== before) fs.writeFileSync(path, source);
  console.log(`[member repertoire key] ${path}: ${source !== before ? 'atualizado' : 'já aplicado'}`);
}

patch('app/membro/page.js', (source) => {
  if (!source.includes("'musical_key',")) {
    source = source.replace("  'artists',\n].join(', ');", "  'artists',\n  'musical_key',\n].join(', ');");
  }
  return source;
});

patch('app/api/membro/global-dashboard/route.js', (source) => {
  if (!source.includes("'musical_key',")) {
    source = source.replace("  'artists',\n].join(', ');", "  'artists',\n  'musical_key',\n].join(', ');");
  }
  return source;
});

patch('lib/membro/membro-invites.js', (source) => {
  if (!source.includes('repertoire_item_id: item?.id || null')) {
    source = source.replace(
      "  const mapped = ordered.map((item, index) => ({\n    ordem: Number(item?.item_order ?? index) + 1,",
      "  const mapped = ordered.map((item, index) => ({\n    id: item?.id || null,\n    repertoire_item_id: item?.id || null,\n    musicalKey: item?.musical_key || '',\n    musical_key: item?.musical_key || '',\n    ordem: Number(item?.item_order ?? index) + 1,"
    );
  }
  return source;
});

patch('components/membro/MembroRepertorioResumoModal.js', (source) => {
  if (!source.includes("import EditableMusicalKey from './EditableMusicalKey';")) {
    source = source.replace(
      "import { useEffect, useMemo } from 'react';",
      "import { useEffect, useMemo } from 'react';\nimport EditableMusicalKey from './EditableMusicalKey';"
    );
  }

  const oldButton = '<button type="button" onClick={() => openLyricsSearch(title)} aria-label={`Buscar letra de ${title}`} title="Abrir letra" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-violet-300/20 bg-violet-400/10 text-[17px] text-violet-100 transition active:scale-95">♫</button>';
  const newStack = '<div className="flex shrink-0 flex-col items-end gap-2"><button type="button" onClick={() => openLyricsSearch(title)} aria-label={`Buscar letra de ${title}`} title="Abrir letra" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-violet-300/20 bg-violet-400/10 text-[17px] text-violet-100 transition active:scale-95">♫</button><EditableMusicalKey row={row} /></div>';

  if (!source.includes('<EditableMusicalKey row={row} />') && source.includes(oldButton)) {
    source = source.replace(oldButton, newStack);
  }

  if (!source.includes('<EditableMusicalKey row={row} />')) {
    throw new Error('[member repertoire key] Não foi possível inserir controle de tom no modal.');
  }

  return source;
});

console.log('[member repertoire key] patch concluído');
