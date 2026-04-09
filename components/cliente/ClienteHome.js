'use client';
import { useToast } from '../ui/ToastProvider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReferenceSearchInput from '../repertorio/ReferenceSearchInput';
import {
  formatDateBR,
  formatLongDateBR,
  getRepertorioDeadline,
  getRepertorioProgress,
  getRepertorioUiState,
} from '../../lib/cliente/repertorio';
import { getYoutubeVideoId } from '../../lib/youtube/getYoutubeVideoId';

const REPERTORIO_DRAFT_LOCAL_STORAGE_KEY = 'repertorio_draft_local';


function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function toReferenceMeta(item = {}) {
  const url = item?.referencia || item?.reference_link || '';
  const videoId =
    item?.referenceMeta?.videoId ||
    item?.reference_video_id ||
    getYoutubeVideoId(url);

  return {
    videoId: videoId || '',
    title: item?.referenceMeta?.title || item?.reference_title || '',
    channelTitle:
      item?.referenceMeta?.channelTitle || item?.reference_channel || '',
    thumbnail:
      item?.referenceMeta?.thumbnail || item?.reference_thumbnail || '',
  };
}

function normalizeSuggestionSection(section = '') {
  const normalized = String(section || '')
    .trim()
    .toLowerCase();

  if (normalized.startsWith('cerim')) return 'cerimonia';
  if (normalized.startsWith('sa')) return 'saida';
  if (normalized.startsWith('ante')) return 'antessala';
  if (normalized.startsWith('recep')) return 'receptivo';
  return 'cortejo';
}

function buildSuggestionPayload(song, payload = {}) {
  const normalizedSection = normalizeSuggestionSection(payload.section);
  const youtubeVideoId = String(song?.youtubeId || '').trim();
  const referenceLink = youtubeVideoId
    ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
    : '';
  const fallbackMoment =
    normalizedSection === 'saida'
      ? 'Saída'
      : normalizedSection === 'cerimonia'
      ? 'Cerimônia'
      : normalizedSection === 'antessala'
      ? 'Antessala'
      : normalizedSection === 'receptivo'
      ? 'Receptivo'
      : 'Entrada';

  return {
    song_name: String(song?.title || '').trim(),
    reference_link: referenceLink,
    reference_title: String(song?.title || '').trim(),
    reference_channel: String(song?.artist || '').trim(),
    reference_thumbnail: String(song?.thumbnailUrl || '').trim(),
    reference_video_id: youtubeVideoId,
    notes: String(payload?.notes || '').trim(),
    who_enters: String(payload?.label || '').trim(),
    moment: fallbackMoment,
    section: normalizedSection,
  };
}

function normalizeCompareText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function hasFilledField(value) {
  return String(value || '').trim().length > 0;
}

function hasInitialRepertorioFromBackend(initialState = {}) {
  const hasCortejo = Array.isArray(initialState.cortejo) && initialState.cortejo.length > 0;
  const hasCerimonia = Array.isArray(initialState.cerimonia) && initialState.cerimonia.length > 0;
  const hasSaida =
    !!initialState.saida &&
    (hasFilledField(initialState.saida.musica) ||
      hasFilledField(initialState.saida.referencia) ||
      hasFilledField(initialState.saida.observacao));
  const hasAntessala =
    !!initialState.antessala &&
    (hasFilledField(initialState.antessala.estilo) ||
      hasFilledField(initialState.antessala.generos) ||
      hasFilledField(initialState.antessala.artistas) ||
      hasFilledField(initialState.antessala.observacao));
  const hasReceptivo =
    !!initialState.receptivo &&
    (hasFilledField(initialState.receptivo.duracao) ||
      hasFilledField(initialState.receptivo.generos) ||
      hasFilledField(initialState.receptivo.artistas) ||
      hasFilledField(initialState.receptivo.observacao));

  return hasCortejo || hasCerimonia || hasSaida || hasAntessala || hasReceptivo;
}

function getItemDestinationKey(item = {}) {
  const section = normalizeSuggestionSection(item.section || '');
  const moment = normalizeCompareText(item.moment || '');
  return `${section}::${moment}`;
}

function areEquivalentRepertoireItems(existingItem = {}, candidateItem = {}) {
  if (getItemDestinationKey(existingItem) !== getItemDestinationKey(candidateItem)) {
    return false;
  }

  const existingVideoId = String(existingItem.reference_video_id || '').trim();
  const candidateVideoId = String(candidateItem.reference_video_id || '').trim();
  if (existingVideoId && candidateVideoId && existingVideoId === candidateVideoId) {
    return true;
  }

  const existingReferenceLink = normalizeCompareText(existingItem.reference_link || '');
  const candidateReferenceLink = normalizeCompareText(candidateItem.reference_link || '');
  if (existingReferenceLink && candidateReferenceLink && existingReferenceLink === candidateReferenceLink) {
    return true;
  }

  const existingSongName = normalizeCompareText(existingItem.song_name || '');
  const candidateSongName = normalizeCompareText(candidateItem.song_name || '');
  if (existingSongName && candidateSongName && existingSongName === candidateSongName) {
    return true;
  }

  return false;
}

function mergeUniqueRepertoireItems(baseItems = [], incomingItems = []) {
  const mergedItems = [...baseItems];

  incomingItems.forEach((item) => {
    const alreadyExists = mergedItems.some((existingItem) =>
      areEquivalentRepertoireItems(existingItem, item)
    );

    if (!alreadyExists) {
      mergedItems.push(item);
    }
  });

  return mergedItems;
}

function buildRepertorioSnapshot({
  querAntessala,
  temReceptivo,
  antessala,
  cortejo,
  cerimonia,
  saida,
  receptivo,
}) {
  return {
    querAntessala,
    temReceptivo,
    antessala,
    cortejo,
    cerimonia,
    saida,
    receptivo,
  };
}

function applySuggestionToRepertorioState(state, suggestionItem = {}) {
  const nextState = {
    ...state,
    cortejo: Array.isArray(state.cortejo) ? [...state.cortejo] : [],
    cerimonia: Array.isArray(state.cerimonia) ? [...state.cerimonia] : [],
    saida: { ...(state.saida || {}) },
    antessala: { ...(state.antessala || {}) },
    receptivo: { ...(state.receptivo || {}) },
  };

  const section = normalizeSuggestionSection(suggestionItem.section || suggestionItem.targetSection);
  const songName = String(suggestionItem.song_name || suggestionItem.title || '').trim();
  const referenceLink = String(suggestionItem.reference_link || '').trim();
  const notes = String(suggestionItem.notes || '').trim();
  const referenceMeta = toReferenceMeta({
    referencia: referenceLink,
    reference_title: suggestionItem.reference_title || suggestionItem.title || '',
    reference_channel: suggestionItem.reference_channel || suggestionItem.artist || '',
    reference_thumbnail: suggestionItem.reference_thumbnail || suggestionItem.thumbnailUrl || '',
    reference_video_id: suggestionItem.reference_video_id || '',
  });

  if (section === 'cortejo') {
    const label = String(suggestionItem.who_enters || suggestionItem.targetLabel || 'Entrada').trim();
    const alreadyExists = nextState.cortejo.some((item) => {
      const sameLabel = normalizeCompareText(item.label) === normalizeCompareText(label);
      const sameSong = normalizeCompareText(item.musica) === normalizeCompareText(songName);
      const sameVideoId =
        String(item.reference_video_id || '').trim() &&
        String(item.reference_video_id || '').trim() === String(referenceMeta.videoId || '').trim();
      return sameLabel && (sameSong || sameVideoId);
    });

    if (!alreadyExists) {
      nextState.cortejo.push({
        label,
        musica: songName,
        referencia: referenceLink,
        observacao: notes,
        referenceMeta,
        reference_title: suggestionItem.reference_title || '',
        reference_channel: suggestionItem.reference_channel || '',
        reference_thumbnail: suggestionItem.reference_thumbnail || '',
        reference_video_id: suggestionItem.reference_video_id || '',
      });
    }
  } else if (section === 'cerimonia') {
    const label = String(suggestionItem.who_enters || suggestionItem.targetLabel || suggestionItem.moment || 'Cerimônia').trim();
    const alreadyExists = nextState.cerimonia.some((item) => {
      const sameLabel = normalizeCompareText(item.label) === normalizeCompareText(label);
      const sameSong = normalizeCompareText(item.musica) === normalizeCompareText(songName);
      const sameVideoId =
        String(item.reference_video_id || '').trim() &&
        String(item.reference_video_id || '').trim() === String(referenceMeta.videoId || '').trim();
      return sameLabel && (sameSong || sameVideoId);
    });

    if (!alreadyExists) {
      nextState.cerimonia.push({
        label,
        musica: songName,
        referencia: referenceLink,
        observacao: notes,
        referenceMeta,
        reference_title: suggestionItem.reference_title || '',
        reference_channel: suggestionItem.reference_channel || '',
        reference_thumbnail: suggestionItem.reference_thumbnail || '',
        reference_video_id: suggestionItem.reference_video_id || '',
      });
    }
  } else if (section === 'saida') {
    nextState.saida = {
      ...nextState.saida,
      musica: songName || nextState.saida.musica || '',
      referencia: referenceLink || nextState.saida.referencia || '',
      observacao: notes || nextState.saida.observacao || '',
      referenceMeta: referenceMeta.videoId ? referenceMeta : nextState.saida.referenceMeta || null,
      reference_title:
        suggestionItem.reference_title || nextState.saida.reference_title || '',
      reference_channel:
        suggestionItem.reference_channel || nextState.saida.reference_channel || '',
      reference_thumbnail:
        suggestionItem.reference_thumbnail || nextState.saida.reference_thumbnail || '',
      reference_video_id:
        suggestionItem.reference_video_id || nextState.saida.reference_video_id || '',
    };
  } else if (section === 'antessala') {
    nextState.querAntessala = true;
    nextState.antessala = {
      ...nextState.antessala,
      estilo: songName || nextState.antessala.estilo || '',
      observacao: notes || nextState.antessala.observacao || '',
    };
  } else if (section === 'receptivo') {
    nextState.temReceptivo = true;
    nextState.receptivo = {
      ...nextState.receptivo,
      generos: suggestionItem.genre || nextState.receptivo.generos || '',
      artistas: suggestionItem.artist || nextState.receptivo.artistas || '',
      observacao: notes || nextState.receptivo.observacao || '',
    };
  }

  return nextState;
}

function StatusPill({ label, tone = 'neutral' }) {
  const toneMap = {
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accent: 'bg-violet-50 text-violet-700 border-violet-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]',
        toneMap[tone]
      )}
    >
      {label}
    </span>
  );
}

function SectionCard({ children, className }) {
  return (
    <section
      className={classNames(
        'rounded-[24px] border border-[#eadfd6] bg-white p-5 shadow-[0_10px_30px_rgba(36,26,20,0.06)]',
        className
      )}
    >
      {children}
    </section>
  );
}

function RowInfo({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-[#faf7f3] px-4 py-3">
      <div className="pt-0.5 text-base">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          {label}
        </div>
        <div className="mt-1 break-words text-[15px] font-bold text-[#241a14]">
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ title, status }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={classNames(
          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-black',
          status === 'done' && 'bg-emerald-100 text-emerald-700',
          status === 'current' && 'bg-violet-100 text-violet-700',
          status === 'upcoming' && 'bg-zinc-100 text-zinc-400'
        )}
      >
        {status === 'done' ? '✓' : status === 'current' ? '●' : '○'}
      </div>
      <div
        className={classNames(
          'text-[14px] font-semibold',
          status === 'done' && 'text-[#241a14]',
          status === 'current' && 'text-violet-700',
          status === 'upcoming' && 'text-zinc-400'
        )}
      >
        {title}
      </div>
    </div>
  );
}

function FooterNav({ activeTab, setActiveTab }) {
  const items = [
    { key: 'inicio', icon: '🏠', label: 'Início' },
    { key: 'repertorio', icon: '🎼', label: 'Repertório' },
    { key: 'sugestoes', icon: '✨', label: 'Sugestões' },
    { key: 'financeiro', icon: '💰', label: 'Financeiro' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#eadfd6] bg-[rgba(248,244,239,0.94)] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-10px_30px_rgba(36,26,20,0.06)] backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-[520px] grid-cols-4 gap-2">
        {items.map((item) => {
          const active = activeTab === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={classNames(
                'flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition',
                active
  ? 'bg-violet-100 text-violet-700 shadow-[0_6px_18px_rgba(124,58,237,0.10)]'
  : 'text-[#9b8576]'
              )}
            >
              <span className="text-[20px] leading-none">{item.icon}</span>
              <span className="mt-1 text-[11px] font-black">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function RepertorioCard({ data }) {
  const uiState = getRepertorioUiState({
    status: data.repertorio.status,
    eventDate: data.dataEvento,
    liberadoParaEdicao: data.repertorio.liberadoParaEdicao,
  });

  const progress = getRepertorioProgress({
    status: data.repertorio.status,
    etapasPreenchidas: data.repertorio.etapasPreenchidas,
    totalEtapas: data.repertorio.totalEtapas,
  });

  const deadline = getRepertorioDeadline(data.dataEvento);
  const [showLateModal, setShowLateModal] = useState(false);

  useEffect(() => {
    if (uiState !== 'atrasado') return;

    const key = `cliente_repertorio_late_modal_${data.token}`;
    const alreadyShown = sessionStorage.getItem(key);

    if (!alreadyShown) {
      setShowLateModal(true);
      sessionStorage.setItem(key, '1');
    }
  }, [uiState, data.token]);

  const stateMeta = useMemo(() => {
    switch (uiState) {
      case 'rascunho':
        return {
          pill: <StatusPill label="Em rascunho" tone="warning" />,
          title: 'Seu repertório já foi iniciado.',
          text: 'Você pode continuar de onde parou ou finalizar o envio quando estiver tudo certo.',
          deadlineText: deadline
            ? `Prazo para envio: ${formatDateBR(deadline)}`
            : 'Defina seu repertório com antecedência.',
          primaryLabel: 'Continuar preenchimento',
          primaryHref: data.repertorio.linkPreenchimento || '#',
          secondaryLabel: 'Finalizar envio',
          secondaryHref: data.repertorio.linkPreenchimento || '#',
          note: 'Após o envio, o repertório ficará travado para edição.',
        };
      case 'enviado':
        return {
          pill: <StatusPill label="Enviado" tone="success" />,
          title: 'Seu repertório foi enviado com sucesso.',
          text: 'A equipe Harmonics já recebeu suas escolhas e seguirá com o alinhamento do evento.',
          deadlineText: data.repertorio.enviadoEm
            ? `Enviado em ${formatDateBR(data.repertorio.enviadoEm)}`
            : 'Repertório finalizado.',
          primaryLabel: data.repertorio.podeSolicitarCorrecao ? 'Solicitar correção' : 'Ver repertório enviado',
          primaryHref: data.repertorio.linkVisualizacao || data.repertorio.linkPreenchimento || '#',
          secondaryLabel: data.repertorio.linkVisualizacao ? 'Visualizar repertório' : '',
          secondaryHref: data.repertorio.linkVisualizacao || '#',
          note: 'Após o envio final, alterações só podem ser feitas se a equipe liberar correção.',
        };
      case 'liberado':
        return {
          pill: <StatusPill label="Liberado para ajuste" tone="accent" />,
          title: 'Seu repertório foi liberado para correção.',
          text: 'Faça os ajustes solicitados e envie novamente quando estiver tudo certo.',
          deadlineText: deadline
            ? `Prazo operacional: ${formatDateBR(deadline)}`
            : 'Faça os ajustes o quanto antes.',
          primaryLabel: 'Editar repertório',
          primaryHref: data.repertorio.linkPreenchimento || '#',
          secondaryLabel: 'Enviar novamente',
          secondaryHref: data.repertorio.linkPreenchimento || '#',
          note: 'Depois do novo envio, o repertório volta a ficar travado.',
        };
      case 'atrasado':
        return {
          pill: <StatusPill label="Atrasado" tone="danger" />,
          title: 'O prazo de envio do repertório já foi atingido.',
          text: 'Envie o quanto antes para mantermos tudo alinhado para o seu evento.',
          deadlineText: deadline
            ? `Prazo encerrado em ${formatDateBR(deadline)}`
            : 'Prazo encerrado.',
          primaryLabel:
            String(data.repertorio.status || '').toUpperCase() === 'RASCUNHO'
              ? 'Continuar preenchimento'
              : 'Começar repertório',
          primaryHref: data.repertorio.linkPreenchimento || '#',
          secondaryLabel:
            String(data.repertorio.status || '').toUpperCase() === 'RASCUNHO'
              ? 'Finalizar envio'
              : '',
          secondaryHref: data.repertorio.linkPreenchimento || '#',
          note: 'Caso precise, salve em rascunho e finalize assim que concluir.',
        };
      case 'nao_iniciado':
      default:
        return {
          pill: <StatusPill label="Não iniciado" tone="neutral" />,
          title: 'Você ainda não enviou seu repertório.',
          text: 'Preencha aos poucos e finalize quando estiver tudo certo.',
          deadlineText: deadline
            ? `Prazo para envio: ${formatDateBR(deadline)}`
            : 'Defina seu repertório com antecedência.',
          primaryLabel: 'Começar repertório',
          primaryHref: data.repertorio.linkPreenchimento || '#',
          secondaryLabel: '',
          secondaryHref: '#',
          note: 'Você pode salvar como rascunho antes do envio final.',
        };
    }
  }, [uiState, data.repertorio, deadline]);

  return (
    <>
      <SectionCard className="border-violet-100 bg-[linear-gradient(180deg,#ffffff_0%,#fcfbff_100%)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[20px] font-black text-[#241a14]">Repertório do evento</div>
            <div className="mt-1 text-[14px] font-medium text-[#7e6d61]">
              Monte a trilha sonora da sua cerimônia
            </div>
          </div>
          <div className="shrink-0">{stateMeta.pill}</div>
        </div>

        <div className="mt-5 rounded-[20px] bg-[#faf7f3] px-4 py-4">
          <div className="text-[16px] font-black text-[#241a14]">{stateMeta.title}</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">{stateMeta.text}</div>
        </div>

        <div
          className={classNames(
            'mt-4 rounded-[18px] border px-4 py-3',
            uiState === 'atrasado'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-[#eadfd6] bg-white text-[#7e6d61]'
          )}
        >
          <div className="flex items-center gap-2 text-[13px] font-bold">
            <span>📅</span>
            <span>{stateMeta.deadlineText}</span>
          </div>
        </div>

        {(uiState === 'rascunho' || uiState === 'atrasado') && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              <span>Progresso do preenchimento</span>
              <span>
                {progress.preenchidas} de {progress.total}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-[#eee6de]">
              <div
                className={classNames(
                  'h-full rounded-full transition-all duration-500',
                  uiState === 'atrasado'
                    ? 'bg-[linear-gradient(90deg,#ef4444_0%,#f97316_100%)]'
                    : 'bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)]'
                )}
                style={{ width: `${progress.percentual}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <a
            href={stateMeta.primaryHref}
            className={classNames(
              'flex w-full items-center justify-center rounded-[18px] px-4 py-4 text-center text-[15px] font-black shadow-sm transition active:scale-[0.99]',
              uiState === 'atrasado'
                ? 'bg-[linear-gradient(135deg,#dc2626_0%,#ef4444_100%)] text-white'
                : 'bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] text-white'
            )}
          >
            {stateMeta.primaryLabel}
          </a>

          {stateMeta.secondaryLabel ? (
            <a
              href={stateMeta.secondaryHref}
              className="flex w-full items-center justify-center rounded-[18px] border border-[#e6d8ff] bg-white px-4 py-4 text-center text-[15px] font-black text-violet-700 transition active:scale-[0.99]"
            >
              {stateMeta.secondaryLabel}
            </a>
          ) : null}
        </div>

        <div className="mt-4 text-[13px] leading-5 text-[#8e7d71]">{stateMeta.note}</div>
      </SectionCard>

      {showLateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,14,12,0.35)] p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[28px] border border-red-100 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.20)]">
            <div className="text-2xl">⚠️</div>
            <div className="mt-3 text-[20px] font-black text-[#241a14]">Atenção ao repertório</div>
            <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
              O prazo de envio já foi atingido. Envie o quanto antes para mantermos tudo
              alinhado para o seu evento.
            </div>

            <div className="mt-5 space-y-3">
              <a
                href={data.repertorio.linkPreenchimento || '#'}
                className="flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-center text-[15px] font-black text-white"
              >
                Enviar agora
              </a>

              <button
                type="button"
                onClick={() => setShowLateModal(false)}
                className="flex w-full items-center justify-center rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-center text-[15px] font-black text-[#241a14]"
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-[18px] font-black text-[#241a14]">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-[13px] leading-5 text-[#7a6a5e]">{subtitle}</div>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
function TabHero({ badge, title, text, children }) {
  return (
    <SectionCard className="bg-[linear-gradient(180deg,#ffffff_0%,#fcfbff_100%)]">
      {badge ? (
        <div className="inline-flex rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
          {badge}
        </div>
      ) : null}

      <div className="mt-4 text-[22px] font-black text-[#241a14]">{title}</div>

      {text ? (
        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">{text}</div>
      ) : null}

      {children ? <div className="mt-5">{children}</div> : null}
    </SectionCard>
  );
}


function InicioTab({ data, setActiveTab, selectedSongs }) {
  return (
    <div className="space-y-4">
        <TabHero
  badge="Visão geral"
  title="Tudo do seu evento em um só lugar"
  text="Acompanhe repertório, sugestões, financeiro e informações importantes de forma organizada."
/>
      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo do evento</div>

        <div className="grid grid-cols-1 gap-3">
          <RowInfo icon="📅" label="Data" value={formatDateBR(data.dataEvento)} />
          <RowInfo icon="🕒" label="Horário" value={data.horarioEvento || '—'} />
          <RowInfo icon="📍" label="Local" value={data.localEvento || '—'} />
          <RowInfo icon="🎻" label="Formação" value={data.formacao || '—'} />
          <RowInfo icon="🎶" label="Instrumentos" value={data.instrumentos || '—'} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionCard>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
            Repertório
          </div>
          <div className="mt-2 text-[18px] font-black text-[#241a14]">
            {data.repertorio.status || 'Aguardando'}
          </div>
          <div className="mt-2 text-[14px] text-[#6f5d51]">
            Acompanhe o preenchimento e finalize quando estiver tudo certo.
          </div>
          {selectedSongs.length > 0 ? (
  <div className="mt-3 rounded-[14px] bg-violet-50 px-3 py-2 text-[12px] font-black text-violet-700">
    {selectedSongs.length} música(s) já vieram da aba Sugestões
  </div>
) : null}
          <button
            type="button"
            onClick={() => setActiveTab('repertorio')}
            className="mt-4 w-full rounded-[18px] border border-[#e6d8ff] bg-violet-50 px-4 py-3 text-[14px] font-black text-violet-700"
          >
            Abrir repertório
          </button>
        </SectionCard>

        <SectionCard>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
            Financeiro
          </div>
          <div className="mt-2 text-[18px] font-black text-[#241a14]">Acompanhar pagamentos</div>
          <div className="mt-2 text-[14px] text-[#6f5d51]">
            Consulte saldo, comprovantes e andamento financeiro do evento.
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('financeiro')}
            className="mt-4 w-full rounded-[18px] border border-[#eadfd6] bg-[#faf7f3] px-4 py-3 text-[14px] font-black text-[#241a14]"
          >
            Abrir financeiro
          </button>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">Andamento do evento</div>

        <div className="space-y-3">
          <TimelineItem title="Contrato assinado" status="done" />
          <TimelineItem title="Evento confirmado" status="done" />
          <TimelineItem
            title={
              ['ENVIADO', 'ENVIADO_TRANCADO', 'FINALIZADO', 'CONCLUIDO'].includes(
                String(data.repertorio.status || '').toUpperCase()
              )
                ? 'Repertório concluído'
                : 'Repertório em andamento'
            }
            status="current"
          />
          <TimelineItem title="Ajustes finais" status="upcoming" />
          <TimelineItem title="Dia do evento" status="upcoming" />
        </div>
      </SectionCard>

      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">Informações importantes</div>

        <div className="space-y-3">
          <RowInfo icon="⏰" label="Chegada da equipe" value={data.horarioChegada || 'A definir'} />
          <RowInfo
            icon="📌"
            label="Observações"
            value={data.observacoes || 'Nenhuma observação no momento.'}
          />
        </div>
      </SectionCard>

      <SectionCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fff9_100%)]">
        <div className="text-[18px] font-black text-[#241a14]">Precisa de ajuda?</div>
        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          Fale com nossa equipe pelo WhatsApp para qualquer dúvida ou alinhamento.
        </div>

        <a
          href={
            data.suporteWhatsapp
              ? `https://wa.me/${String(data.suporteWhatsapp).replace(/\D/g, '')}`
              : '#'
          }
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#16a34a_0%,#22c55e_100%)] px-4 py-4 text-center text-[15px] font-black text-white shadow-[0_10px_24px_rgba(34,197,94,0.22)]"
        >
          Falar no WhatsApp
        </a>
      </SectionCard>
    </div>
  );
}
function InputField({ label, placeholder, value, onChange, textarea = false, rows = 3, disabled = false }) {
  if (textarea) {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          {label}
        </label>
        <textarea
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="min-h-[100px] w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none disabled:cursor-not-allowed disabled:bg-[#f4efea] disabled:text-[#a59588]"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none disabled:cursor-not-allowed disabled:bg-[#f4efea] disabled:text-[#a59588]"
      />
    </div>
  );
}

function LockedSectionCard({ title, text }) {
  return (
    <SectionCard className="border-dashed bg-[#fbf8f4]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-200 text-lg">
          🔒
        </div>
        <div>
          <div className="text-[17px] font-black text-[#241a14]">{title}</div>
          <div className="mt-2 text-[14px] leading-6 text-[#7a6a5e]">{text}</div>
        </div>
      </div>
    </SectionCard>
  );
}

function QuickOrderPill({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[#eadfd6] bg-white px-4 py-2 text-[12px] font-black text-[#6f5d51] transition active:scale-[0.97]"
    >
      {label}
    </button>
  );
}

function EntryCard({
  index,
  title,
  subtitle,
  item,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  disabled = false,
}) {
  return (
    <div className="rounded-[22px] border border-[#eadfd6] bg-white p-4 shadow-[0_8px_24px_rgba(36,26,20,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            {title} {index + 1}
          </div>
          {subtitle ? (
            <div className="mt-2 text-[13px] font-semibold text-[#8b786b]">{subtitle}</div>
          ) : null}
        </div>

        {!disabled ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMoveUp}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-[#faf7f3] text-sm"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadfd6] bg-[#faf7f3] text-sm"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-sm text-red-600"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <InputField
          label="Quem entra / momento"
          placeholder="Ex: Padrinhos, Noiva, Alianças..."
          value={item.label}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
          disabled={disabled}
        />
        <InputField
          label="Música"
          placeholder="Nome da música"
          value={item.musica}
          onChange={(e) => onChange({ ...item, musica: e.target.value })}
          disabled={disabled}
        />
        <ReferenceSearchInput
          searchValue={item.musica || ''}
          referenceValue={item.referencia || ''}
          selectedReference={item.referenceMeta || null}
          disabled={disabled}
          onSearchValueChange={(value) => onChange({ ...item, musica: value })}
          onReferenceValueChange={(e) =>
            onChange({
              ...item,
              referencia: e.target.value,
              referenceMeta: null,
              reference_title: '',
              reference_channel: '',
              reference_thumbnail: '',
              reference_video_id: '',
            })
          }
          onSelectResult={(result) =>
            onChange({
              ...item,
              referencia: result.url,
              musica: item.musica || result.title || '',
              reference_title: result.title || '',
              reference_channel: result.channelTitle || '',
              reference_thumbnail: result.thumbnail || '',
              reference_video_id: result.videoId || '',
              referenceMeta: {
                videoId: result.videoId || '',
                title: result.title || '',
                channelTitle: result.channelTitle || '',
                thumbnail: result.thumbnail || '',
              },
            })
          }
          onClearReference={() =>
            onChange({
              ...item,
              referencia: '',
              referenceMeta: null,
              reference_title: '',
              reference_channel: '',
              reference_thumbnail: '',
              reference_video_id: '',
            })
          }
        />
        <InputField
          label="Observações"
          placeholder="Continuação da anterior, só instrumental, versão específica..."
          value={item.observacao}
          onChange={(e) => onChange({ ...item, observacao: e.target.value })}
          textarea
          rows={2}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function MiniStep({
  step,
  title,
  active,
  done,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'min-w-[110px] rounded-[18px] border px-4 py-3 text-left transition',
        active && 'border-violet-200 bg-violet-50',
        done && !active && 'border-emerald-200 bg-emerald-50',
        !active && !done && 'border-[#eadfd6] bg-white',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
        Etapa {step}
      </div>
      <div className="mt-1 text-[13px] font-black text-[#241a14]">{title}</div>
    </button>
  );
}

function RepertorioTab({ data, selectedSongs, onSaved }) {
    const { showToast } = useToast();
  const travado = ['ENVIADO', 'ENVIADO_TRANCADO', 'FINALIZADO', 'CONCLUIDO'].includes(
    String(data.repertorio.status || '').toUpperCase()
  );
  

  const [step, setStep] = useState(1);

  const initialState = data?.repertorio?.initialState || {};
  const hasBackendRepertorio = hasInitialRepertorioFromBackend(initialState);
  const initialCortejo = Array.isArray(initialState.cortejo)
    ? initialState.cortejo.map((item) => ({
        ...item,
        referenceMeta: toReferenceMeta(item),
      }))
    : null;
  const initialCerimonia = Array.isArray(initialState.cerimonia)
    ? initialState.cerimonia.map((item) => ({
        ...item,
        referenceMeta: toReferenceMeta(item),
      }))
    : null;
  const initialSaida = initialState.saida
    ? {
        ...initialState.saida,
        referenceMeta: toReferenceMeta(initialState.saida),
      }
    : null;

const [querAntessala, setQuerAntessala] = useState(
  data.repertorio.temAntessala
    ? (initialState.querAntessala ?? null)
    : false
);

const [temReceptivo, setTemReceptivo] = useState(!!data.repertorio.temReceptivo);

const [antessala, setAntessala] = useState(
  initialState.antessala || {
    estilo: '',
    generos: '',
    artistas: '',
    observacao: '',
  }
);

const [cortejo, setCortejo] = useState(
  initialCortejo || [
    {
      label: 'Padrinhos',
      musica: '',
      referencia: '',
      observacao: '',
      referenceMeta: null,
      reference_title: '',
      reference_channel: '',
      reference_thumbnail: '',
      reference_video_id: '',
    },
    {
      label: 'Noiva',
      musica: '',
      referencia: '',
      observacao: '',
      referenceMeta: null,
      reference_title: '',
      reference_channel: '',
      reference_thumbnail: '',
      reference_video_id: '',
    },
  ]
);

const [cerimonia, setCerimonia] = useState(
  initialCerimonia || [
    {
      label: 'Alianças',
      musica: '',
      referencia: '',
      observacao: '',
      referenceMeta: null,
      reference_title: '',
      reference_channel: '',
      reference_thumbnail: '',
      reference_video_id: '',
    },
  ]
);

const [saida, setSaida] = useState(
  initialSaida || {
    musica: '',
    referencia: '',
    observacao: '',
    referenceMeta: null,
    reference_title: '',
    reference_channel: '',
    reference_thumbnail: '',
    reference_video_id: '',
  }
);

const [receptivo, setReceptivo] = useState(
  initialState.receptivo || {
    duracao: '1h',
    generos: '',
    artistas: '',
    observacao: '',
  }
);
  const [showLocalDraftBanner, setShowLocalDraftBanner] = useState(false);
  const [savingMode, setSavingMode] = useState('');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const firstAutosaveLoggedRef = useRef(false);
  const hadLocalDraftOnHydrationRef = useRef(false);
  const repertorioStateRef = useRef(
    buildRepertorioSnapshot({
      querAntessala,
      temReceptivo,
      antessala,
      cortejo,
      cerimonia,
      saida,
      receptivo,
    })
  );
  const appliedSuggestionKeysRef = useRef(new Set());

  useEffect(() => {
    repertorioStateRef.current = buildRepertorioSnapshot({
      querAntessala,
      temReceptivo,
      antessala,
      cortejo,
      cerimonia,
      saida,
      receptivo,
    });
  }, [querAntessala, temReceptivo, antessala, cortejo, cerimonia, saida, receptivo]);

  const applyLocalDraft = useCallback((parsed) => {
    const restoredState = {
      querAntessala: parsed?.querAntessala ?? null,
      temReceptivo: parsed?.temReceptivo ?? !!data.repertorio.temReceptivo,
      cortejo: Array.isArray(parsed?.cortejo) ? parsed.cortejo : [],
      cerimonia: Array.isArray(parsed?.cerimonia) ? parsed.cerimonia : [],
      saida:
        parsed?.saida || {
          musica: '',
          referencia: '',
          observacao: '',
          referenceMeta: null,
          reference_title: '',
          reference_channel: '',
          reference_thumbnail: '',
          reference_video_id: '',
        },
      antessala:
        parsed?.antessala || {
          estilo: '',
          generos: '',
          artistas: '',
          observacao: '',
        },
      receptivo:
        parsed?.receptivo || {
          duracao: '1h',
          generos: '',
          artistas: '',
          observacao: '',
        },
    };

    console.log('[REPERTORIO_AUTOSAVE] estados restaurados no draft local:', restoredState);

    setQuerAntessala(restoredState.querAntessala);
    setTemReceptivo(restoredState.temReceptivo);
    setCortejo(restoredState.cortejo);
    setCerimonia(restoredState.cerimonia);
    setSaida(
      restoredState.saida
    );
    setAntessala(
      restoredState.antessala
    );
    setReceptivo(
      restoredState.receptivo
    );
  }, [data.repertorio.temReceptivo]);

  useEffect(() => {
    let hasSavedLocalDraft = false;

    try {
      const savedDraftRaw = localStorage.getItem(REPERTORIO_DRAFT_LOCAL_STORAGE_KEY);
      hasSavedLocalDraft = !!savedDraftRaw;
      hadLocalDraftOnHydrationRef.current = hasSavedLocalDraft;
      console.log('[REPERTORIO_AUTOSAVE] conteúdo lido do localStorage:', savedDraftRaw);

      if (!hasBackendRepertorio && savedDraftRaw) {
        const parsed = JSON.parse(savedDraftRaw);
        applyLocalDraft(parsed);
        setShowLocalDraftBanner(false);
      } else {
        setShowLocalDraftBanner(!hasBackendRepertorio && hasSavedLocalDraft);
      }
    } catch (error) {
      console.error('[REPERTORIO_AUTOSAVE] falha ao hidratar draft local:', error);
      setShowLocalDraftBanner(false);
    } finally {
      setDraftHydrated(true);
      setAutosaveReady(true);
    }
  }, [applyLocalDraft, hasBackendRepertorio]);

  useEffect(() => {
    if (!draftHydrated) return;

    if (hasBackendRepertorio) {
      setShowLocalDraftBanner(false);
      return;
    }

    const savedDraftRaw = localStorage.getItem(REPERTORIO_DRAFT_LOCAL_STORAGE_KEY);
    setShowLocalDraftBanner(!!savedDraftRaw);
  }, [hasBackendRepertorio, draftHydrated]);

  function handleRestoreLocalDraft() {
    const savedDraftRaw = localStorage.getItem(REPERTORIO_DRAFT_LOCAL_STORAGE_KEY);
    if (!savedDraftRaw) {
      setShowLocalDraftBanner(false);
      return;
    }

    try {
      const parsed = JSON.parse(savedDraftRaw);
      applyLocalDraft(parsed);
      setShowLocalDraftBanner(false);
      showToast('Rascunho local restaurado com sucesso.', 'success');
    } catch (error) {
      console.error('Não foi possível restaurar rascunho local do repertório:', error);
      showToast('Não foi possível restaurar o rascunho local.', 'error');
    }
  }

  function handleDiscardLocalDraft() {
    localStorage.removeItem(REPERTORIO_DRAFT_LOCAL_STORAGE_KEY);
    setShowLocalDraftBanner(false);
    showToast('Rascunho local descartado.', 'default');
  }

  useEffect(() => {
    if (!autosaveReady) {
      console.log('[REPERTORIO_AUTOSAVE] proteção de hidratação ativa: autosave bloqueado antes da hidratação inicial.');
      return;
    }

    const draftPayload = {
      querAntessala,
      temReceptivo,
      antessala,
      cortejo,
      cerimonia,
      saida,
      receptivo,
    };

    localStorage.setItem(
      REPERTORIO_DRAFT_LOCAL_STORAGE_KEY,
      JSON.stringify(draftPayload)
    );

    if (!firstAutosaveLoggedRef.current) {
      firstAutosaveLoggedRef.current = true;
      console.log('[REPERTORIO_AUTOSAVE] primeiro save no localStorage:', draftPayload);

      if (
        hadLocalDraftOnHydrationRef.current &&
        !hasInitialRepertorioFromBackend(draftPayload)
      ) {
        console.warn(
          '[REPERTORIO_AUTOSAVE] possível sobrescrita precoce detectada: existia draft local e o primeiro save está vazio.'
        );
      }
    }
  }, [autosaveReady, querAntessala, temReceptivo, antessala, cortejo, cerimonia, saida, receptivo]);

  useEffect(() => {
    if (!Array.isArray(selectedSongs) || selectedSongs.length === 0) return;

    const pendingSuggestions = selectedSongs.filter((item) => {
      const key = `${item.songId}::${normalizeSuggestionSection(item.section || item.targetSection)}::${normalizeCompareText(item.who_enters || item.targetLabel || item.moment || '')}`;
      return !appliedSuggestionKeysRef.current.has(key);
    });

    if (pendingSuggestions.length === 0) return;

    let nextSnapshot = repertorioStateRef.current;

    pendingSuggestions.forEach((item) => {
      const songLike = {
        title: item.title,
        artist: item.artist,
        genre: item.genre,
        thumbnailUrl: item.thumbnailUrl,
        youtubeId: item.reference_video_id,
      };
      const payloadLike = {
        section: item.section || item.targetSection,
        label: item.who_enters || item.targetLabel,
        notes: item.notes,
      };
      const suggestionPayload = buildSuggestionPayload(songLike, payloadLike);
      const key = `${item.songId}::${normalizeSuggestionSection(item.section || item.targetSection)}::${normalizeCompareText(item.who_enters || item.targetLabel || item.moment || '')}`;

      console.log('[SUGESTOES->REPERTORIO] destino escolhido:', payloadLike.section);
      console.log('[SUGESTOES->REPERTORIO] item montado por buildSuggestionPayload:', suggestionPayload);
      console.log('[SUGESTOES->REPERTORIO] estado do repertório antes da inserção:', nextSnapshot);

      nextSnapshot = applySuggestionToRepertorioState(nextSnapshot, {
        ...item,
        ...suggestionPayload,
      });

      console.log('[SUGESTOES->REPERTORIO] estado do repertório depois da inserção:', nextSnapshot);
      appliedSuggestionKeysRef.current.add(key);
    });

    setQuerAntessala(nextSnapshot.querAntessala);
    setTemReceptivo(nextSnapshot.temReceptivo);
    setAntessala(nextSnapshot.antessala);
    setCortejo(nextSnapshot.cortejo);
    setCerimonia(nextSnapshot.cerimonia);
    setSaida(nextSnapshot.saida);
    setReceptivo(nextSnapshot.receptivo);
  }, [selectedSongs]);

  const renderedRepertorioItems = useMemo(() => {
    const cortejoItems = cortejo
      .filter((item) => item?.musica || item?.referencia)
      .map((item, index) => ({
        key: `cortejo-${index}`,
        section: 'Cortejo',
        label: item?.label || 'Entrada',
        title: item?.musica || 'Sem música definida',
        subtitle: item?.reference_channel || '',
        notes: item?.observacao || '',
      }));

    const cerimoniaItems = cerimonia
      .filter((item) => item?.musica || item?.referencia)
      .map((item, index) => ({
        key: `cerimonia-${index}`,
        section: 'Cerimônia',
        label: item?.label || 'Momento da cerimônia',
        title: item?.musica || 'Sem música definida',
        subtitle: item?.reference_channel || '',
        notes: item?.observacao || '',
      }));

    const saidaItems = saida?.musica || saida?.referencia
      ? [
          {
            key: 'saida',
            section: 'Saída',
            label: 'Saída dos noivos',
            title: saida?.musica || 'Sem música definida',
            subtitle: saida?.reference_channel || '',
            notes: saida?.observacao || '',
          },
        ]
      : [];

    return [...cortejoItems, ...cerimoniaItems, ...saidaItems];
  }, [cortejo, cerimonia, saida]);

  useEffect(() => {
    console.log('[SUGESTOES->REPERTORIO][RENDER] fonte visual atual da aba Repertório:', {
      cortejo,
      cerimonia,
      saida,
      renderedRepertorioItems,
    });
  }, [cortejo, cerimonia, saida, renderedRepertorioItems]);

  function normalizeReferenceFields(reference = {}) {
    const referenceLink = String(reference.referencia || '').trim();
    const referenceVideoId = getYoutubeVideoId(referenceLink);

    if (!referenceLink) {
      return {
        reference_link: '',
        reference_title: '',
        reference_channel: '',
        reference_thumbnail: '',
        reference_video_id: '',
      };
    }

    const selectedVideoId = String(reference.reference_video_id || '').trim();
    const metadataMatchesLink =
      !referenceVideoId ||
      !selectedVideoId ||
      selectedVideoId === referenceVideoId;

    return {
      reference_link: referenceLink,
      reference_title: metadataMatchesLink
        ? String(reference.reference_title || '').trim()
        : '',
      reference_channel: metadataMatchesLink
        ? String(reference.reference_channel || '').trim()
        : '',
      reference_thumbnail: metadataMatchesLink
        ? String(reference.reference_thumbnail || '').trim()
        : '',
      reference_video_id: referenceVideoId || selectedVideoId || '',
    };
  }

  const quickCortejo = [
    'Padrinhos',
    'Madrinhas',
    'Mademoiselles',
    'Segurança das Alianças',
    'Noivinhos',
    'Daminha / Florista',
    'Entrada da Bíblia',
    'Celebrante',
    'Pais dos Noivos',
    'Noiva 👰',
  ];

  const visibleSteps = [
    { id: 1, label: 'Boas-vindas' },
    { id: 2, label: 'Antessala', locked: !data.repertorio.temAntessala },
    { id: 3, label: 'Cortejo' },
    { id: 4, label: 'Cerimônia' },
    { id: 5, label: 'Saída' },
    { id: 6, label: 'Receptivo', locked: !data.repertorio.temReceptivo },
    { id: 7, label: 'Revisão' },
  ];

  const progresso = Math.round((step / visibleSteps.length) * 100);
function buildItemsPayload() {
  const items = [];

  if (querAntessala === true) {
    items.push({
      section: 'antessala',
      item_order: 0,
      who_enters: '',
      moment: 'Antessala',
      song_name: antessala.estilo || '',
      reference_link: '',
      notes: antessala.observacao || '',
      type: 'ante_room',
      group_name: '',
      label: 'Antessala',
      genres: antessala.generos || '',
      artists: antessala.artistas || '',
    });
  }

  cortejo.forEach((item, index) => {
    const referenceFields = normalizeReferenceFields(item);

    items.push({
      section: 'cortejo',
      item_order: index,
      who_enters: item.label || '',
      moment: 'Entrada',
      song_name: item.musica || '',
      reference_link: referenceFields.reference_link,
      reference_title: referenceFields.reference_title,
      reference_channel: referenceFields.reference_channel,
      reference_thumbnail: referenceFields.reference_thumbnail,
      reference_video_id: referenceFields.reference_video_id,
      notes: item.observacao || '',
      type: 'entrada',
      group_name: '',
      label: item.label || '',
      genres: '',
      artists: '',
    });
  });

  cerimonia.forEach((item, index) => {
    const referenceFields = normalizeReferenceFields(item);

    items.push({
      section: 'cerimonia',
      item_order: index,
      who_enters: '',
      moment: item.label || 'Cerimônia',
      song_name: item.musica || '',
      reference_link: referenceFields.reference_link,
      reference_title: referenceFields.reference_title,
      reference_channel: referenceFields.reference_channel,
      reference_thumbnail: referenceFields.reference_thumbnail,
      reference_video_id: referenceFields.reference_video_id,
      notes: item.observacao || '',
      type: 'cerimonia',
      group_name: '',
      label: item.label || '',
      genres: '',
      artists: '',
    });
  });

  if (saida.musica || saida.referencia || saida.observacao) {
    const exitReferenceFields = normalizeReferenceFields(saida);

    items.push({
      section: 'saida',
      item_order: 0,
      who_enters: 'Saída dos noivos',
      moment: 'Saída',
      song_name: saida.musica || '',
      reference_link: exitReferenceFields.reference_link,
      reference_title: exitReferenceFields.reference_title,
      reference_channel: exitReferenceFields.reference_channel,
      reference_thumbnail: exitReferenceFields.reference_thumbnail,
      reference_video_id: exitReferenceFields.reference_video_id,
      notes: saida.observacao || '',
      type: 'saida',
      group_name: '',
      label: 'Saída dos noivos',
      genres: '',
      artists: '',
    });
  }

  if (temReceptivo) {
    items.push({
      section: 'receptivo',
      item_order: 0,
      who_enters: '',
      moment: 'Receptivo',
      song_name: '',
      reference_link: '',
      notes: receptivo.observacao || '',
      type: 'reception',
      group_name: '',
      label: 'Receptivo',
      genres: receptivo.generos || '',
      artists: receptivo.artistas || '',
    });
  }

  const suggestedItems = selectedSongs.map((item, index) => {
    const section = normalizeSuggestionSection(item.section || item.targetSection);
    const isSaida = section === 'saida';
    const isCerimonia = section === 'cerimonia';
    const isReceptivo = section === 'receptivo';
    const isAntessala = section === 'antessala';
    const normalizedMoment = String(item.moment || '').trim();
    const fallbackMoment = isSaida
      ? 'Saída'
      : isCerimonia
      ? 'Cerimônia'
      : isAntessala
      ? 'Antessala'
      : isReceptivo
      ? 'Receptivo'
      : 'Entrada';
    const moment = normalizedMoment || fallbackMoment;

    return {
      section,
      item_order: isSaida ? 0 : 1000 + index,
      who_enters: isSaida
        ? 'Saída dos noivos'
        : String(item.who_enters || item.targetLabel || '').trim(),
      moment,
      song_name: String(item.song_name || item.title || '').trim(),
      reference_link: String(item.reference_link || '').trim(),
      reference_title: String(item.reference_title || '').trim(),
      reference_channel: String(item.reference_channel || '').trim(),
      reference_thumbnail: String(item.reference_thumbnail || '').trim(),
      reference_video_id: String(item.reference_video_id || '').trim(),
      notes: String(item.notes || '').trim(),
      type: isSaida
        ? 'saida'
        : isCerimonia
        ? 'cerimonia'
        : isAntessala
        ? 'ante_room'
        : isReceptivo
        ? 'reception'
        : 'entrada',
      group_name: '',
      label: isSaida
        ? 'Saída dos noivos'
        : String(item.targetLabel || item.who_enters || '').trim(),
      genres: String(item.genre || '').trim(),
      artists: String(item.artist || '').trim(),
    };
  });

  if (suggestedItems.length > 0) {
    console.log('[SUGESTOES->REPERTORIO] payload de sugestões mapeado:', suggestedItems);
    const mergedItems = mergeUniqueRepertoireItems(items, suggestedItems);
    items.splice(0, items.length, ...mergedItems);
  }

  return items;
}

function buildConfigPayload() {
  const exitReferenceFields = normalizeReferenceFields(saida);

  return {
    has_ante_room: querAntessala === true,
    ante_room_style: antessala.estilo || '',
    ante_room_notes: antessala.observacao || '',
    has_reception: temReceptivo,
    reception_duration: temReceptivo ? receptivo.duracao || '' : '',
    reception_genres: temReceptivo ? receptivo.generos || '' : '',
    reception_artists: temReceptivo ? receptivo.artistas || '' : '',
    reception_notes: temReceptivo ? receptivo.observacao || '' : '',
    exit_song: saida.musica || '',
    exit_reference: exitReferenceFields.reference_link,
    exit_reference_title: exitReferenceFields.reference_title,
    exit_reference_channel: exitReferenceFields.reference_channel,
    exit_reference_thumbnail: exitReferenceFields.reference_thumbnail,
    exit_reference_video_id: exitReferenceFields.reference_video_id,
    exit_notes: saida.observacao || '',
    desired_songs: '',
    general_notes: '',
  };
}

async function saveRepertorio(mode = 'draft') {
  try {
    setSavingMode(mode);
    const payload = {
      token: data.repertorio?.repertoireToken || data.token,
      repertoireToken: data.repertorio?.repertoireToken || '',
      clientToken: data.token || '',
      mode,
      config: buildConfigPayload(),
      items: buildItemsPayload(),
    };

    console.log(
      '[SUGESTOES->REPERTORIO] payload final enviado para persistência:',
      payload.items
    );

    console.log('[CLIENTE REPERTORIO] token URL (/cliente/[token]):', data.token);
    console.log('[CLIENTE REPERTORIO] token enviado no payload.token:', payload.token);
    console.log(
      '[CLIENTE REPERTORIO] repertoireToken enviado explicitamente:',
      payload.repertoireToken || '(vazio)'
    );
    console.log(
      '[CLIENTE REPERTORIO] clientToken enviado explicitamente:',
      payload.clientToken || '(vazio)'
    );

    const response = await fetch('/api/cliente/repertorio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'Não foi possível salvar o repertório.');
    }

    showToast(
      mode === 'final'
        ? 'Repertório finalizado com sucesso 💜'
        : 'Rascunho salvo com sucesso 💾',
      'success'
    );

    localStorage.removeItem(REPERTORIO_DRAFT_LOCAL_STORAGE_KEY);

    onSaved?.({
      mode,
      result,
    });

    if (mode === 'final') {
      window.location.reload();
    }
  } catch (error) {
    console.error('Erro ao salvar repertório:', error);
    showToast(
      error?.message || 'Não foi possível salvar o repertório.',
      'error'
    );
  } finally {
    setSavingMode('');
  }
}

  function updateListItem(list, setter, index, value) {
    setter(list.map((item, i) => (i === index ? value : item)));
  }

  function moveItem(list, setter, index, dir) {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= list.length) return;
    const clone = [...list];
    const temp = clone[index];
    clone[index] = clone[nextIndex];
    clone[nextIndex] = temp;
    setter(clone);
  }

  function removeItem(list, setter, index) {
    setter(list.filter((_, i) => i !== index));
  }

  function addCortejo(label = '') {
    setCortejo([
      ...cortejo,
      {
        label,
        musica: '',
        referencia: '',
        observacao: '',
        referenceMeta: null,
        reference_title: '',
        reference_channel: '',
        reference_thumbnail: '',
        reference_video_id: '',
      },
    ]);
  }

  function addCerimonia(label = '') {
    setCerimonia([
      ...cerimonia,
      {
        label,
        musica: '',
        referencia: '',
        observacao: '',
        referenceMeta: null,
        reference_title: '',
        reference_channel: '',
        reference_thumbnail: '',
        reference_video_id: '',
      },
    ]);
  }

  function renderResumoCortejo() {
    if (!cortejo.length) {
      return (
        <EmptyStateCard
  title="Nenhuma entrada adicionada"
  text="Use os atalhos ou crie entradas personalizadas para montar a ordem do cortejo."
/>
      );
    }

    return (
      <div className="space-y-3">
        {cortejo.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4"
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
              Entrada {index + 1}
            </div>
            <div className="mt-1 text-[15px] font-black text-[#241a14]">
              {item.label || 'Sem identificação'}
            </div>
            <div className="mt-2 text-[14px] font-semibold text-[#6f5d51]">
              {item.musica || 'Sem música definida'}
            </div>
            {item.observacao ? (
              <div className="mt-2 text-[13px] leading-5 text-[#8a796d]">
                {item.observacao}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasBackendRepertorio && showLocalDraftBanner ? (
        <section className="overflow-hidden rounded-[24px] border border-violet-200 bg-[linear-gradient(135deg,#f7f2ff_0%,#ffffff_58%,#f3ecff_100%)] p-4 shadow-[0_12px_30px_rgba(91,33,182,0.12)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg">
              💾
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
                Rascunho local disponível
              </div>
              <div className="mt-1 text-[16px] font-black text-[#241a14]">
                Encontramos um rascunho local não salvo
              </div>
              <div className="mt-1 text-[13px] leading-5 text-[#6f5d51]">
                Você prefere restaurar esse conteúdo para continuar de onde parou ou descartar esse rascunho?
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRestoreLocalDraft}
                  className="rounded-[14px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-2 text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(109,40,217,0.28)] transition hover:opacity-95"
                >
                  Restaurar
                </button>
                <button
                  type="button"
                  onClick={handleDiscardLocalDraft}
                  className="rounded-[14px] border border-[#dbcff5] bg-white px-4 py-2 text-[13px] font-bold text-[#5b3f85] transition hover:bg-[#f7f1ff]"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <TabHero
  badge="Repertório"
  title="Monte a trilha sonora do seu evento"
  text="Preencha com calma, revise tudo antes do envio final e acompanhe o que já veio das sugestões."
>
  {!travado ? (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
        <span>Progresso</span>
        <span>{progresso}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eee6de]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)] transition-all duration-500"
          style={{ width: `${progresso}%` }}
        />
      </div>
    </div>
  ) : (
    <div className="rounded-[18px] bg-emerald-50 px-4 py-4 text-[14px] font-bold text-emerald-700">
      Repertório finalizado e travado para edição.
    </div>
  )}
</TabHero>
<SectionCard>
  <div className="flex gap-3 overflow-x-auto pb-1">
    {visibleSteps.map((item) => (
      <MiniStep
        key={item.id}
        step={item.id}
        title={item.label}
        active={step === item.id}
        done={step > item.id}
        onClick={() => setStep(item.id)}
        disabled={false}
      />
    ))}
  </div>
</SectionCard>

      {!travado && step === 1 && (
        <SectionCard>
          <div className="text-[22px] font-black text-[#241a14]">Bem-vindo! 💒</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Aqui você monta a trilha sonora da sua cerimônia. Preencha cada etapa com facilidade e revise tudo antes de enviar.
          </div>

          <div className="mt-5 rounded-[22px] border border-[#eadfd6] bg-[#faf7f3] p-4">
            <div className="text-[15px] font-black text-[#241a14]">Como funciona</div>
            <div className="mt-3 space-y-2 text-[14px] font-semibold text-[#6f5d51]">
              <div>📝 Preencha cada etapa com as músicas desejadas</div>
              <div>🔗 Cole links do YouTube ou Spotify como referência</div>
              <div>💾 Salve como rascunho a qualquer momento</div>
              <div>✅ Quando estiver pronto, finalize o envio</div>
              <div>🔒 Depois do envio, o repertório ficará travado</div>
            </div>
          </div>
        </SectionCard>
      )}

     {!travado && step === 2 && (
  <>
    {data.repertorio.temAntessala ? (
      <SectionCard>
        <div className="text-[22px] font-black text-[#241a14]">Antessala 🎶</div>
        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          A antessala é a música ambiente para recepcionar os convidados antes do início da cerimônia.
        </div>

        <div className="mt-5 rounded-[22px] border border-[#eadfd6] bg-[#faf7f3] p-4">
          <div className="text-[15px] font-black text-[#241a14]">
            No seu contrato está incluso antessala (música para recepcionar os convidados)?
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setQuerAntessala(true)}
              className={classNames(
                'flex-1 rounded-[18px] border px-4 py-4 text-[15px] font-black transition',
                querAntessala === true
                  ? 'border-violet-200 bg-violet-50 text-violet-700'
                  : 'border-[#eadfd6] bg-white text-[#241a14]'
              )}
            >
              Sim
            </button>

            <button
              type="button"
              onClick={() => setQuerAntessala(false)}
              className={classNames(
                'flex-1 rounded-[18px] border px-4 py-4 text-[15px] font-black transition',
                querAntessala === false
                  ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
                  : 'border-[#eadfd6] bg-white text-[#241a14]'
              )}
            >
              Não
            </button>
          </div>
        </div>

        {querAntessala === true && (
          <div className="mt-5 space-y-4">
            <InputField
              label="Estilo desejado"
              placeholder="Ex: instrumental suave, romântico, elegante..."
              value={antessala.estilo}
              onChange={(e) =>
                setAntessala({ ...antessala, estilo: e.target.value })
              }
            />
            <InputField
              label="Gêneros"
              placeholder="Ex: MPB, clássico, bossa nova, gospel..."
              value={antessala.generos || ''}
              onChange={(e) =>
                setAntessala({ ...antessala, generos: e.target.value })
              }
            />
            <InputField
              label="Artistas desejados"
              placeholder="Ex: Ludovico Einaudi, Ana Vilela, Coldplay..."
              value={antessala.artistas || ''}
              onChange={(e) =>
                setAntessala({ ...antessala, artistas: e.target.value })
              }
            />
            <InputField
              label="Observações"
              placeholder="Algo específico para esse momento?"
              value={antessala.observacao}
              onChange={(e) =>
                setAntessala({ ...antessala, observacao: e.target.value })
              }
              textarea
              rows={3}
            />
          </div>
        )}

        {querAntessala === false && (
          <div className="mt-5 rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[14px] leading-6 text-[#7a6a5e]">
            Tudo bem. Seguiremos sem antessala neste evento.
          </div>
        )}
      </SectionCard>
    ) : (
      <LockedSectionCard
        title="Antessala não incluída"
        text="Essa etapa está bloqueada porque não consta no contrato deste evento."
      />
    )}
  </>
)}

      {!travado && step === 3 && (
        <SectionCard>
          <div className="text-[22px] font-black text-[#241a14]">Cortejo 💒</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Monte a ordem das entradas com facilidade. Use os atalhos abaixo ou crie entradas personalizadas.
          </div>

          <div className="mt-5">
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Atalhos de ordem
            </div>
            <div className="flex flex-wrap gap-2">
              {quickCortejo.map((item) => (
                <QuickOrderPill
                  key={item}
                  label={item}
                  onClick={() => addCortejo(item)}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {cortejo.map((item, index) => (
              <EntryCard
                key={`cortejo-${index}`}
                index={index}
                title="Entrada"
                subtitle="Personalize música, referência e observações"
                item={item}
                onChange={(value) => updateListItem(cortejo, setCortejo, index, value)}
                onMoveUp={() => moveItem(cortejo, setCortejo, index, -1)}
                onMoveDown={() => moveItem(cortejo, setCortejo, index, 1)}
                onRemove={() => removeItem(cortejo, setCortejo, index)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => addCortejo('')}
            className="mt-5 w-full rounded-[20px] border-2 border-dashed border-[#d9c8f7] bg-[#fcfbff] px-4 py-4 text-[15px] font-black text-violet-700"
          >
            + Adicionar entrada personalizada
          </button>
        </SectionCard>
      )}

      {!travado && step === 4 && (
        <SectionCard>
          <div className="text-[22px] font-black text-[#241a14]">Cerimônia ⛪</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Cadastre os momentos musicais internos da cerimônia.
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {['Alianças', 'Assinatura', 'Momento de Gratidão', 'Comunhão'].map((item) => (
              <QuickOrderPill
                key={item}
                label={item}
                onClick={() => addCerimonia(item)}
              />
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {cerimonia.map((item, index) => (
              <EntryCard
                key={`cerimonia-${index}`}
                index={index}
                title="Momento"
                subtitle="Escolha a música e detalhe a referência"
                item={item}
                onChange={(value) => updateListItem(cerimonia, setCerimonia, index, value)}
                onMoveUp={() => moveItem(cerimonia, setCerimonia, index, -1)}
                onMoveDown={() => moveItem(cerimonia, setCerimonia, index, 1)}
                onRemove={() => removeItem(cerimonia, setCerimonia, index)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => addCerimonia('')}
            className="mt-5 w-full rounded-[20px] border-2 border-dashed border-[#d9c8f7] bg-[#fcfbff] px-4 py-4 text-[15px] font-black text-violet-700"
          >
            + Adicionar momento personalizado
          </button>
        </SectionCard>
      )}

      {!travado && step === 5 && (
        <SectionCard>
          <div className="text-[22px] font-black text-[#241a14]">Saída dos noivos 🎉</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
            Defina a música da saída e observações gerais do repertório.
          </div>

          <div className="mt-5 space-y-4">
            <InputField
              label="Música da saída"
              placeholder="Ex: Signed, Sealed, Delivered"
              value={saida.musica}
              onChange={(e) => setSaida({ ...saida, musica: e.target.value })}
            />
            <ReferenceSearchInput
              searchValue={saida.musica || ''}
              referenceValue={saida.referencia || ''}
              selectedReference={saida.referenceMeta || null}
              onSearchValueChange={(value) => setSaida({ ...saida, musica: value })}
              onReferenceValueChange={(e) =>
                setSaida({
                  ...saida,
                  referencia: e.target.value,
                  referenceMeta: null,
                  reference_title: '',
                  reference_channel: '',
                  reference_thumbnail: '',
                  reference_video_id: '',
                })
              }
              onSelectResult={(result) =>
                setSaida({
                  ...saida,
                  referencia: result.url,
                  musica: saida.musica || result.title || '',
                  reference_title: result.title || '',
                  reference_channel: result.channelTitle || '',
                  reference_thumbnail: result.thumbnail || '',
                  reference_video_id: result.videoId || '',
                  referenceMeta: {
                    videoId: result.videoId || '',
                    title: result.title || '',
                    channelTitle: result.channelTitle || '',
                    thumbnail: result.thumbnail || '',
                  },
                })
              }
              onClearReference={() =>
                setSaida({
                  ...saida,
                  referencia: '',
                  referenceMeta: null,
                  reference_title: '',
                  reference_channel: '',
                  reference_thumbnail: '',
                  reference_video_id: '',
                })
              }
            />
            <InputField
              label="Observações"
              placeholder="Algo especial para esse momento?"
              value={saida.observacao}
              onChange={(e) => setSaida({ ...saida, observacao: e.target.value })}
              textarea
              rows={3}
            />
          </div>
        </SectionCard>
      )}

      {!travado && step === 6 && (
        <>
          {data.repertorio.temReceptivo ? (
            <SectionCard>
              <div className="text-[22px] font-black text-[#241a14]">Receptivo 🎤</div>
              <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
                Personalize o repertório do momento de recepção, se este serviço estiver incluído.
              </div>

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
                    Duração
                  </label>
                  <div className="flex gap-2">
                    {['1h', '2h', '3h'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setReceptivo({ ...receptivo, duracao: item })}
                        className={classNames(
                          'flex-1 rounded-[16px] border px-4 py-4 text-[14px] font-black',
                          receptivo.duracao === item
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : 'border-[#eadfd6] bg-white text-[#241a14]'
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <InputField
                  label="Gêneros preferidos"
                  placeholder="Ex: MPB, Bossa Nova, Pop Internacional..."
                  value={receptivo.generos}
                  onChange={(e) =>
                    setReceptivo({ ...receptivo, generos: e.target.value })
                  }
                />
                <InputField
                  label="Artistas de referência"
                  placeholder="Ex: Marisa Monte, Michael Bublé, Tim Maia..."
                  value={receptivo.artistas}
                  onChange={(e) =>
                    setReceptivo({ ...receptivo, artistas: e.target.value })
                  }
                  textarea
                  rows={3}
                />
                <InputField
                  label="Observações"
                  placeholder="Preferências, restrições ou clima desejado..."
                  value={receptivo.observacao}
                  onChange={(e) =>
                    setReceptivo({ ...receptivo, observacao: e.target.value })
                  }
                  textarea
                  rows={3}
                />
              </div>
            </SectionCard>
          ) : (
            <LockedSectionCard
              title="Receptivo não incluído"
              text="Essa etapa está bloqueada porque não consta no contrato deste evento."
            />
          )}
        </>
      )}

      {!travado && step === 7 && (
        <div className="space-y-4">
          <SectionCard>
            <div className="text-[22px] font-black text-[#241a14]">Revisão final 📋</div>
            <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
              Confira tudo com calma antes do envio definitivo. Após finalizar, o repertório ficará travado.
            </div>
          </SectionCard>

          <SectionCard>
            <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo do cortejo</div>
            {renderResumoCortejo()}
          </SectionCard>

          <SectionCard>
            <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo geral</div>
            <div className="space-y-3">
             <RowInfo
  icon="🎶"
  label="Antessala"
  value={
    data.repertorio.temAntessala
      ? querAntessala === true
        ? 'Sim, com preenchimento'
        : querAntessala === false
        ? 'Não utilizar'
        : 'Não definido'
      : 'Não incluída no contrato'
  }
/>
              <RowInfo icon="💒" label="Entradas no cortejo" value={String(cortejo.length)} />
              <RowInfo icon="⛪" label="Momentos da cerimônia" value={String(cerimonia.length)} />
              <RowInfo icon="🎉" label="Música da saída" value={saida.musica || 'Não definida'} />
              <RowInfo icon="🎤" label="Receptivo" value={temReceptivo ? 'Incluído' : 'Não incluído'} />
              <RowInfo icon="✨" label="Músicas no repertório" value={String(renderedRepertorioItems.length)} />
            </div>
          </SectionCard>

          <div className="space-y-3">
            <button
  type="button"
  onClick={() => saveRepertorio('draft')}
  disabled={savingMode !== ''}
  className="w-full rounded-[20px] border border-[#f1ddb1] bg-[#fff7e8] px-4 py-4 text-[15px] font-black text-[#9b6a17] disabled:cursor-not-allowed disabled:opacity-60"
>
  {savingMode === 'draft' ? 'Salvando rascunho...' : '💾 Salvar rascunho'}
</button>

            <button
  type="button"
  onClick={() => saveRepertorio('final')}
  disabled={savingMode !== ''}
  className="w-full rounded-[20px] bg-[linear-gradient(135deg,#16a34a_0%,#22c55e_100%)] px-4 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
>
  {savingMode === 'final' ? 'Finalizando repertório...' : '✨ Finalizar repertório'}
</button>
          </div>
        </div>
      )}

      {travado && (
        <div className="space-y-4">
          <SectionCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fff9_100%)]">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl">
                ✅
              </div>
              <div>
                <div className="text-[22px] font-black text-[#241a14]">Repertório finalizado</div>
                <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
                  Seu repertório já foi enviado e agora está travado para edição. Caso precise ajustar algo, solicite revisão.
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="mb-4 text-[18px] font-black text-[#241a14]">Resumo do cortejo</div>
            {renderResumoCortejo()}
          </SectionCard>
          {renderedRepertorioItems.length > 0 && (
  <SectionCard>
    <div className="mb-4 text-[18px] font-black text-[#241a14]">
      Músicas no repertório
    </div>

    <div className="space-y-3">
      {renderedRepertorioItems.map((item) => (
        <div
          key={item.key}
          className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4"
        >
          <div className="text-[15px] font-black text-[#241a14]">
            {item.title}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-[#7a6a5e]">
            {item.subtitle || item.section}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#faf7f3] px-2 py-1 text-[10px] font-black text-[#7a6a5e]">
              {item.section}
            </span>
            {item.label ? (
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">
                {item.label}
              </span>
            ) : null}
          </div>
          {item.notes ? (
            <div className="mt-2 text-[13px] leading-5 text-[#8a796d]">
              {item.notes}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  </SectionCard>
)}

          <div className="space-y-3">
            <a
              href={data.repertorio.pdfUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center rounded-[20px] border border-[#e6d8ff] bg-violet-50 px-4 py-4 text-center text-[15px] font-black text-violet-700"
            >
              📄 Baixar PDF do repertório
            </a>

            <button
              type="button"
              className="w-full rounded-[20px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white"
            >
              Solicitar revisão
            </button>
          </div>
        </div>
      )}

      {!travado && (
  <div className="flex gap-3">
    <button
      type="button"
      onClick={() => setStep((prev) => Math.max(1, prev - 1))}
      className="flex-1 rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-black text-[#241a14]"
    >
      ← Voltar
    </button>

    {step < 7 ? (
      <button
        type="button"
        onClick={() => setStep((prev) => Math.min(7, prev + 1))}
        className="flex-1 rounded-[18px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white"
      >
        Próximo →
      </button>
    ) : null}
  </div>
)}
    </div>
  );
}

function extractYoutubeEmbedUrl(videoId) {
  if (!videoId) return '';
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
}

function SuggestionChipBar({ items, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const selected = active === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={classNames(
              'whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-black transition',
              selected
                ? 'bg-violet-100 text-violet-700'
                : 'border border-[#eadfd6] bg-white text-[#6f5d51]'
            )}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
function getEditorialBadges(item) {
  const badges = [];

  if (item.isAdded) {
    badges.push({
      label: 'Já adicionada',
      tone: 'success',
    });
  }

  if (item.isFavorite) {
    badges.push({
      label: 'Favorita',
      tone: 'favorite',
    });
  }

  if (item.featured) {
    badges.push({
      label: 'Muito escolhida',
      tone: 'highlight',
    });
  }

  if (item.genre === 'Gospel') {
    badges.push({
      label: 'Gospel nacional',
      tone: 'gospel',
    });
  }

  if (item.genre === 'Gospel Instrumental' || item.genre === 'Instrumental') {
    badges.push({
      label: 'Instrumental elegante',
      tone: 'soft',
    });
  }

  if (
    item.moment === 'Entrada' &&
    (item.tags || []).some((tag) =>
      ['noiva', 'entrada', 'romantica', 'emocionante'].includes(
        String(tag).toLowerCase()
      )
    )
  ) {
    badges.push({
      label: 'Entrada perfeita',
      tone: 'romantic',
    });
  }

  if (
    (item.tags || []).some((tag) =>
      ['moderno', 'casamento', 'adoracao'].includes(String(tag).toLowerCase())
    )
  ) {
    badges.push({
      label: 'Em alta',
      tone: 'trend',
    });
  }

  return badges.slice(0, 3);
}

function EditorialBadge({ badge }) {
  const toneMap = {
    success: 'bg-emerald-500 text-white',
    favorite: 'bg-pink-100 text-pink-700',
    highlight: 'bg-amber-100 text-amber-800',
    gospel: 'bg-violet-100 text-violet-700',
    soft: 'bg-sky-100 text-sky-700',
    romantic: 'bg-rose-100 text-rose-700',
    trend: 'bg-[#241a14] text-white',
  };

  return (
    <span
      className={classNames(
        'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
        toneMap[badge.tone] || 'bg-zinc-100 text-zinc-700'
      )}
    >
      {badge.label}
    </span>
  );
}

function CollectionCard({ item, onPlay, onFav, onAdd }) {
      const editorialBadges = getEditorialBadges(item);
  return (
    <div className="min-w-[260px] overflow-hidden rounded-[26px] border border-[#eadfd6] bg-white shadow-[0_12px_30px_rgba(36,26,20,0.08)]">
      <div className="relative h-[156px] overflow-hidden bg-[#f3ece5]">
        <img
          src={item.thumbnailUrl || '/images/song-placeholder.jpg'}
          alt={item.title}
          className="h-full w-full object-cover transition duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,14,12,0.80)] via-[rgba(20,14,12,0.12)] to-transparent" />

        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#241a14] shadow-sm">
            {item.moment}
          </span>
        </div>

        <button
          type="button"
          onClick={onFav}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-[18px] shadow-sm transition active:scale-95"
        >
          {item.isFavorite ? '💜' : '🤍'}
        </button>

        {item.isAdded ? (
          <div className="absolute bottom-3 left-3">
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
              Adicionada
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <div className="line-clamp-1 text-[16px] font-black text-[#241a14]">
          {item.title}
        </div>

        <div className="mt-1 line-clamp-1 text-[13px] font-semibold text-[#7a6a5e]">
          {item.artist}
        </div>

        {item.description ? (
          <div className="mt-3 line-clamp-2 text-[13px] leading-5 text-[#8a796d]">
            {item.description}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
  <span className="rounded-full bg-[#faf7f3] px-2.5 py-1 text-[10px] font-black text-[#7a6a5e]">
    {item.genre}
  </span>
  <span className="rounded-full bg-[#f4efff] px-2.5 py-1 text-[10px] font-black text-violet-700">
    {item.moment}
  </span>

  {editorialBadges.map((badge) => (
    <EditorialBadge key={badge.label} badge={badge} />
  ))}
</div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPlay}
            className="rounded-[15px] bg-[#241a14] px-3 py-3 text-[12px] font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            ▶ Ouvir
          </button>

          <button
            type="button"
            onClick={onAdd}
            className="rounded-[15px] bg-violet-600 px-3 py-3 text-[12px] font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            {item.isAdded ? '✓ Adicionada' : '+ Repertório'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SongListCard({ item, onPlay, onFav, onAdd }) {
      const editorialBadges = getEditorialBadges(item);
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#eadfd6] bg-white shadow-[0_10px_26px_rgba(36,26,20,0.06)]">
      <div className="flex gap-4 p-4">
        <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[18px] bg-[#f3ece5]">
          <img
            src={item.thumbnailUrl || '/images/song-placeholder.jpg'}
            alt={item.title}
            className="h-full w-full object-cover"
          />

          {item.isAdded ? (
            <div className="absolute bottom-2 left-2">
              <span className="rounded-full bg-emerald-500 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
                Adicionada
              </span>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-1 text-[16px] font-black text-[#241a14]">
                {item.title}
              </div>
              <div className="mt-1 line-clamp-1 text-[13px] font-semibold text-[#7a6a5e]">
                {item.artist}
              </div>
            </div>

            <button
              type="button"
              onClick={onFav}
              className="shrink-0 rounded-full bg-[#faf7f3] p-2 text-[18px] transition active:scale-95"
            >
              {item.isFavorite ? '💜' : '🤍'}
            </button>
          </div>

         <div className="mt-3 flex flex-wrap gap-2">
  <span className="rounded-full bg-[#faf7f3] px-2.5 py-1 text-[10px] font-black text-[#7a6a5e]">
    {item.genre}
  </span>
  <span className="rounded-full bg-[#f4efff] px-2.5 py-1 text-[10px] font-black text-violet-700">
    {item.moment}
  </span>

  {editorialBadges.map((badge) => (
    <EditorialBadge key={badge.label} badge={badge} />
  ))}
</div>

          {item.description ? (
            <div className="mt-3 line-clamp-2 text-[13px] leading-5 text-[#8b786b]">
              {item.description}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[#f1e8e1] bg-[#fffdfa] px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onPlay}
            className="rounded-[14px] bg-[#241a14] px-3 py-3 text-[12px] font-black text-white transition active:scale-[0.98]"
          >
            ▶ Ouvir
          </button>

          <button
            type="button"
            onClick={onFav}
            className="rounded-[14px] border border-[#eadfd6] bg-white px-3 py-3 text-[12px] font-black text-[#241a14] transition active:scale-[0.98]"
          >
            {item.isFavorite ? 'Favorita' : 'Favoritar'}
          </button>

          <button
            type="button"
            onClick={onAdd}
            className={classNames(
              'rounded-[14px] px-3 py-3 text-[12px] font-black text-white transition active:scale-[0.98]',
              item.isAdded ? 'bg-emerald-600' : 'bg-violet-600'
            )}
          >
            {item.isAdded ? '✓ Adicionada' : '+ Repertório'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniMusicPlayer({ current, onClose, onExpand }) {
  if (!current) return null;

  return (
    <div className="fixed bottom-[96px] left-0 right-0 z-40 px-4">
      <div className="mx-auto max-w-[520px] overflow-hidden rounded-[24px] border border-white/30 bg-[rgba(255,255,255,0.88)] shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3 pb-2 pt-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[16px] bg-[#f3ece5]">
            <img
              src={current.thumbnailUrl}
              alt={current.title}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
                Tocando agora
              </span>
            </div>

            <div className="mt-1 line-clamp-1 text-[14px] font-black text-[#241a14]">
              {current.title}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-[#7a6a5e]">
              {current.artist}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExpand}
              className="rounded-[14px] bg-violet-50 px-3 py-2 text-[12px] font-black text-violet-700 transition active:scale-95"
            >
              Abrir
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-[14px] border border-[#eadfd6] bg-white px-3 py-2 text-[12px] font-black text-[#241a14] transition active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-3 pb-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-[#9b8576]">
            <span>Harmonics player</span>
            <span>YouTube interno</span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-[#ece4dc]">
            <div className="h-full w-[38%] rounded-full bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
function PlayerModal({ current, onClose, onFav, onAdd }) {
  if (!current) return null;
  const editorialBadges = current ? getEditorialBadges(current) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,14,12,0.52)] p-4 sm:items-center">
      <div className="w-full max-w-[560px] overflow-hidden rounded-[30px] border border-[#eadfd6] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
        <div className="relative h-[180px] overflow-hidden bg-[#f3ece5]">
          <img
            src={current.thumbnailUrl}
            alt={current.title}
            className="h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,14,12,0.84)] via-[rgba(20,14,12,0.18)] to-transparent" />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/92 px-3 py-2 text-[12px] font-black text-[#241a14] shadow-sm"
          >
            Fechar
          </button>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap gap-2">
  <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#241a14]">
    {current.genre}
  </span>
  <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#241a14]">
    {current.moment}
  </span>

  {editorialBadges.map((badge) => (
    <span
      key={badge.label}
      className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#241a14]"
    >
      {badge.label}
    </span>
  ))}
</div>

            <div className="mt-3 text-[22px] font-black leading-tight text-white">
              {current.title}
            </div>
            <div className="mt-1 text-[14px] font-semibold text-white/85">
              {current.artist}
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="overflow-hidden rounded-[22px] bg-black shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
            <div className="aspect-video w-full">
              <iframe
                title={current.title}
                src={extractYoutubeEmbedUrl(current.youtubeId)}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
                Tocando no painel
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-[#ece4dc]">
              <div className="h-full w-[52%] rounded-full bg-[linear-gradient(90deg,#7c3aed_0%,#a78bfa_100%)]" />
            </div>
          </div>

          {current.description ? (
            <div className="mt-5 rounded-[20px] bg-[#faf7f3] px-4 py-4 text-[14px] leading-6 text-[#6f5d51]">
              {current.description}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onFav}
              className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[14px] font-black text-[#241a14] transition active:scale-[0.98]"
            >
              {current.isFavorite ? '💜 Favorita' : '🤍 Favoritar'}
            </button>

            <button
              type="button"
              onClick={onAdd}
              className={classNames(
                'rounded-[18px] px-4 py-4 text-[14px] font-black text-white transition active:scale-[0.98]',
                current.isAdded ? 'bg-emerald-600' : 'bg-violet-600'
              )}
            >
              {current.isAdded ? '✓ Já adicionada' : '+ Adicionar ao repertório'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSongSheet({ music, onClose, onConfirm }) {
  const [section, setSection] = useState('Cortejo');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!music) {
      setSection('Cortejo');
      setLabel('');
      setNotes('');
    }
  }, [music]);

  if (!music) return null;

  const options = ['Cortejo', 'Cerimônia', 'Saída', 'Antessala', 'Receptivo'];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(20,14,12,0.35)]">
      <div className="w-full rounded-t-[28px] border border-[#eadfd6] bg-white p-5 shadow-[0_-20px_60px_rgba(0,0,0,0.18)]">
        <div className="text-[20px] font-black text-[#241a14]">Adicionar ao repertório</div>

        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          {music.title} — {music.artist}
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Onde deseja usar esta música?
            </div>

            <div className="grid grid-cols-2 gap-2">
              {options.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSection(item)}
                  className={classNames(
                    'rounded-[16px] border px-4 py-4 text-[13px] font-black',
                    section === item
                      ? 'border-violet-200 bg-violet-50 text-violet-700'
                      : 'border-[#eadfd6] bg-white text-[#241a14]'
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <InputField
            label="Momento / identificação"
            placeholder="Ex: Entrada da noiva, alianças, padrinhos..."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />

          <InputField
            label="Observações"
            placeholder="Algo específico sobre essa escolha?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            textarea
            rows={3}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4 text-[14px] font-black text-[#241a14]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => onConfirm({ section, label, notes })}
            className="rounded-[18px] bg-violet-600 px-4 py-4 text-[14px] font-black text-white"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

function SugestoesTab({
  selectedSongs,
  setSelectedSongs,
  favoriteSongIds,
  setFavoriteSongIds,
}) {
   const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('Todos');
  const [genreFilter, setGenreFilter] = useState('Todos');
  const [momentFilter, setMomentFilter] = useState('Todos');
  const hasActiveFilters =
  search.trim() !== '' ||
  quickFilter !== 'Todos' ||
  genreFilter !== 'Todos' ||
  momentFilter !== 'Todos';


  const [songs, setSongs] = useState([
    
  {
    id: '1',
    title: 'A Thousand Years',
    artist: 'Christina Perri',
    genre: 'Romântico',
    moment: 'Entrada',
    youtubeId: 'rtOvBOTyX00',
    thumbnailUrl: 'https://img.youtube.com/vi/rtOvBOTyX00/hqdefault.jpg',
    description: 'Uma das músicas mais escolhidas para entrada da noiva.',
    isFavorite: false,
    isAdded: false,
    featured: true,
    tags: ['entrada', 'romantica', 'noiva'],
  },
  {
    id: '2',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    genre: 'Pop',
    moment: 'Entrada',
    youtubeId: '2Vv-BfVoq4g',
    thumbnailUrl: 'https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg',
    description: 'Muito usada em versões acústicas e elegantes.',
    isFavorite: true,
    isAdded: false,
    featured: true,
    tags: ['entrada', 'romantica', 'pop'],
  },
  {
    id: '3',
    title: 'Canon in D',
    artist: 'Pachelbel',
    genre: 'Clássico',
    moment: 'Cortejo',
    youtubeId: 'NlprozGcs80',
    thumbnailUrl: 'https://img.youtube.com/vi/NlprozGcs80/hqdefault.jpg',
    description: 'Clássico muito presente em cerimônias elegantes.',
    isFavorite: false,
    isAdded: true,
    featured: false,
    tags: ['classico', 'cortejo', 'instrumental'],
  },
  {
    id: '4',
    title: 'Hallelujah',
    artist: 'Instrumental',
    genre: 'Instrumental',
    moment: 'Cerimônia',
    youtubeId: '0VqTwnAuHws',
    thumbnailUrl: 'https://img.youtube.com/vi/0VqTwnAuHws/hqdefault.jpg',
    description: 'Boa escolha para momentos emocionantes da cerimônia.',
    isFavorite: false,
    isAdded: false,
    featured: true,
    tags: ['cerimonia', 'emocionante', 'instrumental'],
  },
  {
    id: '5',
    title: 'All of Me',
    artist: 'John Legend',
    genre: 'Romântico',
    moment: 'Saída',
    youtubeId: '450p7goxZqg',
    thumbnailUrl: 'https://img.youtube.com/vi/450p7goxZqg/hqdefault.jpg',
    description: 'Muito escolhida para saída dos noivos.',
    isFavorite: true,
    isAdded: false,
    featured: false,
    tags: ['saida', 'romantica'],
  },

 // GOSPEL CERIMÔNIA (VALIDADO)
{
  id: '100',
  title: 'A Dois',
  artist: 'Paulo César Baruk',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: '_4LJTzAYGO4',
  thumbnailUrl: 'https://img.youtube.com/vi/_4LJTzAYGO4/hqdefault.jpg',
  description: 'Uma das mais usadas em casamentos cristãos no Brasil.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'casamento'],
},
{
  id: '101',
  title: 'Escolhi Te Esperar',
  artist: 'Marcela Taís',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'vZvtaen-bZY',
  thumbnailUrl: 'https://img.youtube.com/vi/vZvtaen-bZY/hqdefault.jpg',
  description: 'Muito conectada com propósito de relacionamento cristão.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'espera', 'casamento'],
},
{
  id: '102',
  title: 'Bondade de Deus',
  artist: 'Isaias Saad',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'mZ9yZYo9Mmk',
  thumbnailUrl: 'https://img.youtube.com/vi/mZ9yZYo9Mmk/hqdefault.jpg',
  description: 'Perfeita para momentos de gratidão e reverência.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'gratidao'],
},
{
  id: '103',
  title: 'Grande é o Senhor',
  artist: 'Adhemar de Campos',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: '4_rv9Jmgc78',
  thumbnailUrl: 'https://img.youtube.com/vi/4_rv9Jmgc78/hqdefault.jpg',
  description: 'Clássico muito usado em cerimônias cristãs.',
  isFavorite: false,
  isAdded: false,
  featured: false,
  tags: ['gospel', 'classico'],
},
{
  id: '104',
  title: 'Aleluia (Hallelujah)',
  artist: 'Gabriela Rocha',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'Ui1We7pUh9g',
  thumbnailUrl: 'https://img.youtube.com/vi/Ui1We7pUh9g/hqdefault.jpg',
  description: 'Versão gospel muito emocionante para cerimônias.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'emocionante'],
},
{
  id: '105',
  title: 'Meu Bem Querer',
  artist: 'Sérgio Saas feat. Jennifer Rocha',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'iI78MRnHR6Q',
  thumbnailUrl: 'https://img.youtube.com/vi/iI78MRnHR6Q/hqdefault.jpg',
  description: 'Romântica e muito usada em casamentos.',
  isFavorite: false,
  isAdded: false,
  featured: false,
  tags: ['gospel', 'romantico'],
},
{
  id: '106',
  title: 'Eu Te Vejo Em Tudo',
  artist: 'Casa Worship',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'SewS-INhP40',
  thumbnailUrl: 'https://img.youtube.com/vi/SewS-INhP40/hqdefault.jpg',
  description: 'Muito usada em casamentos cristãos mais modernos.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'moderno'],
},
{
  id: '107',
  title: 'Eu e Minha Casa',
  artist: 'Julliany Souza & Léo Brandão',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'BkJu5Qj6gpY',
  thumbnailUrl: 'https://img.youtube.com/vi/BkJu5Qj6gpY/hqdefault.jpg',
  description: 'Música muito alinhada com casamento e família cristã.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'familia'],
},
{
  id: '108',
  title: 'Eu Te Agradeço',
  artist: 'Preto no Branco',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'eiJ-9wg5W9g',
  thumbnailUrl: 'https://img.youtube.com/vi/eiJ-9wg5W9g/hqdefault.jpg',
  description: 'Ótima para momentos de gratidão no casamento.',
  isFavorite: false,
  isAdded: false,
  featured: false,
  tags: ['gospel', 'gratidao'],
},
{
  id: '109',
  title: 'Deus de Promessas',
  artist: 'Davi Sacer',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: '03QIkzzom1s',
  thumbnailUrl: 'https://img.youtube.com/vi/03QIkzzom1s/hqdefault.jpg',
  description: 'Clássica e muito forte em cerimônias cristãs.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'classico'],
},
{
  id: '110',
  title: 'Vai Ser Tão Lindo',
  artist: 'Pedro Henrique',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'C4gWwh_b3X8',
  thumbnailUrl: 'https://img.youtube.com/vi/C4gWwh_b3X8/hqdefault.jpg',
  description: 'Muito emocionante e atual para casamentos cristãos.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'emocionante'],
},
{
  id: '111',
  title: 'Seremos Um',
  artist: 'Mariana Aguiar',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'JwANpK-MWhk',
  thumbnailUrl: 'https://img.youtube.com/vi/JwANpK-MWhk/hqdefault.jpg',
  description: 'Fala diretamente sobre união e casamento.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'casamento'],
},
{
  id: '112',
  title: 'Que Bom Que Você Chegou',
  artist: 'Bruna Karla',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'Ht9V_g4O6uQ',
  thumbnailUrl: 'https://img.youtube.com/vi/Ht9V_g4O6uQ/hqdefault.jpg',
  description: 'Uma das mais usadas em casamento gospel no Brasil.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'casamento'],
},
{
  id: '113',
  title: 'Amar Você (Quando o Amor Toca o Coração)',
  artist: 'Fernanda Brum',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'A_jUny7lrWg',
  thumbnailUrl: 'https://img.youtube.com/vi/A_jUny7lrWg/hqdefault.jpg',
  description: 'Clássica e extremamente conhecida em casamentos cristãos.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'classico', 'romantico'],
},
{
  id: '114',
  title: 'Desde o Primeiro Momento',
  artist: 'Pamela',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'Kfn01PEANxw',
  thumbnailUrl: 'https://img.youtube.com/vi/Kfn01PEANxw/hqdefault.jpg',
  description: 'Muito usada em cerimônias cristãs com proposta romântica.',
  isFavorite: false,
  isAdded: false,
  featured: false,
  tags: ['gospel', 'romantico'],
},

// GOSPEL MODERNO (VALIDADO)
{
  id: '120',
  title: 'Eles Se Amam',
  artist: 'Vocal Livre',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'SxJGXR9cHgs',
  thumbnailUrl: 'https://img.youtube.com/vi/SxJGXR9cHgs/hqdefault.jpg',
  description: 'Muito usada em cerimônias modernas e emocionantes.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'casamento', 'emocionante'],
},
{
  id: '121',
  title: 'De Olhos Abertos',
  artist: 'Pedro Valença',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'ZRaAdudCcfM',
  thumbnailUrl: 'https://img.youtube.com/vi/ZRaAdudCcfM/hqdefault.jpg',
  description: 'Muito sensível e usada em momentos centrais da cerimônia.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'moderno'],
},
{
  id: '122',
  title: 'Tantos Mares',
  artist: 'Pedro Valença e Gabriella Stehling',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'ebFgUXAKAzc',
  thumbnailUrl: 'https://img.youtube.com/vi/ebFgUXAKAzc/hqdefault.jpg',
  description: 'Muito usada em casamentos com proposta mais intimista.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'romantico', 'moderno'],
},
{
  id: '123',
  title: 'Nós Dois',
  artist: 'Pedro Valença',
  genre: 'Gospel',
  moment: 'Cerimônia',
  youtubeId: 'l7e_NxisJ5E',
  thumbnailUrl: 'https://img.youtube.com/vi/l7e_NxisJ5E/hqdefault.jpg',
  description: 'Muito forte pra casamento, fala diretamente sobre união.',
  isFavorite: false,
  isAdded: false,
  featured: true,
  tags: ['gospel', 'casamento', 'romantico'],
},
]);
  const hydratedSongs = useMemo(() => {
    return songs.map((song) => ({
      ...song,
      isFavorite: favoriteSongIds.includes(song.id),
      isAdded: selectedSongs.some((item) => item.songId === song.id),
    }));
  }, [songs, favoriteSongIds, selectedSongs]);

  const [currentSong, setCurrentSong] = useState(null);
  const [expandedSong, setExpandedSong] = useState(null);
  const [sheetSong, setSheetSong] = useState(null);

  const quickFilters = ['Todos', 'Favoritas', 'Mais escolhidas', 'Já adicionadas'];
  const genres = [
  'Todos',
  'Gospel',
  'Gospel Instrumental',
  'Clássico',
  'Instrumental',
  'Romântico',
  'Pop',
];

const moments = [
  'Todos',
  'Entrada',
  'Cortejo',
  'Cerimônia',
  'Saída',
  'Antessala',
  'Receptivo',
];

    function toggleFavorite(songId) {
    const isFav = favoriteSongIds.includes(songId);

    if (isFav) {
      setFavoriteSongIds((prev) => prev.filter((id) => id !== songId));
      showToast('Removida das favoritas', 'default');
    } else {
      setFavoriteSongIds((prev) => [...prev, songId]);
      showToast('Adicionada às favoritas 💜', 'success');
    }
  }

  function markAdded(songId, payload) {
    const alreadyExists = selectedSongs.some((item) => item.songId === songId);

    if (alreadyExists) {
      showToast('Essa música já foi adicionada ao repertório', 'info');
      return;
    }

    const song = hydratedSongs.find((item) => item.id === songId);
    const suggestionPayload = buildSuggestionPayload(song, payload);

    console.log('[SUGESTOES] sugestão selecionada:', song);
    console.log('[SUGESTOES] momento escolhido:', payload);
    console.log('[SUGESTOES] payload criado:', suggestionPayload);
    setSelectedSongs((prev) => {
      console.log('[SUGESTOES] repertório antes da inserção:', prev);
      const next = [
        ...prev,
        {
          songId,
          title: song?.title || '',
          artist: song?.artist || '',
          genre: song?.genre || '',
          moment: song?.moment || '',
          thumbnailUrl: song?.thumbnailUrl || '',
          targetSection: payload.section,
          targetLabel: payload.label,
          notes: payload.notes,
          ...suggestionPayload,
        },
      ];
      console.log('[SUGESTOES] repertório depois da inserção:', next);
      return next;
    });

    showToast('Música adicionada ao repertório 🎶', 'success');
  }
const favoriteSongs = hydratedSongs.filter((song) => song.isFavorite);

const mostChosenSongs = [...hydratedSongs]
  .filter((song) => song.featured || song.isFavorite || song.isAdded)
  .sort((a, b) => {
    const scoreA =
      (a.featured ? 3 : 0) +
      (a.isFavorite ? 2 : 0) +
      (a.isAdded ? 1 : 0);

    const scoreB =
      (b.featured ? 3 : 0) +
      (b.isFavorite ? 2 : 0) +
      (b.isAdded ? 1 : 0);

    return scoreB - scoreA;
  });

function getPriorityScore(song) {
  let score = 0;

  if (song.genre === 'Gospel') score += 6;
  if (song.genre === 'Gospel Instrumental') score += 5;
  if (song.featured) score += 4;
  if (song.isFavorite) score += 3;
  if (song.isAdded) score += 2;
  if (song.moment === 'Entrada') score += 1;

  return score;
}
  const filteredSongs = hydratedSongs
  .filter((song) => {
    const q = search.trim().toLowerCase();
    

    const matchesSearch =
      !q ||
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q) ||
      song.genre.toLowerCase().includes(q) ||
      song.moment.toLowerCase().includes(q) ||
      (song.description || '').toLowerCase().includes(q) ||
      (song.tags || []).some((tag) => tag.toLowerCase().includes(q));

    const matchesQuick =
      quickFilter === 'Todos' ||
      (quickFilter === 'Favoritas' && song.isFavorite) ||
      (quickFilter === 'Mais escolhidas' && (song.featured || song.isFavorite || song.isAdded)) ||
      (quickFilter === 'Já adicionadas' && song.isAdded);

    const matchesGenre =
      genreFilter === 'Todos' || song.genre === genreFilter;

    const matchesMoment =
      momentFilter === 'Todos' || song.moment === momentFilter;

    return matchesSearch && matchesQuick && matchesGenre && matchesMoment;
  })
  .sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

  const featuredSongs = hydratedSongs.filter((song) => song.featured);
const brideEntranceSongs = hydratedSongs.filter((song) => song.moment === 'Entrada');
const ceremonySongs = hydratedSongs.filter((song) => song.moment === 'Cerimônia');
const gospelSongs = hydratedSongs.filter((song) =>
  ['Gospel', 'Gospel Instrumental'].includes(song.genre)
);
  
const gospelEntranceSongs = hydratedSongs.filter(
  (song) =>
    ['Gospel', 'Gospel Instrumental'].includes(song.genre) &&
    song.moment === 'Entrada'
);
  const gospelCeremonySongs = songs.filter(
  (song) =>
    ['Gospel', 'Gospel Instrumental'].includes(song.genre) &&
    song.moment === 'Cerimônia'
);

   function handleAddConfirm(payload) {
    console.log('[SUGESTOES] confirmação de adição recebida:', payload);
    if (sheetSong) {
      markAdded(sheetSong.id, payload);
    }

    setSheetSong(null);
  }
  return (
    <div className="space-y-4 pb-28">
      <TabHero
  badge="Curadoria Harmonics"
  title="Sugestões musicais"
  text="Explore músicas por estilo, momento e artista. Ouça, favorite e adicione ao seu repertório sem sair do painel."
>
  <div className="flex items-center gap-3 rounded-[18px] border border-[#eadfd6] bg-white px-4 py-4">
    <span className="text-base">🔎</span>
    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Buscar música, artista, gênero ou momento..."
      className="w-full bg-transparent text-[15px] font-semibold text-[#241a14] outline-none placeholder:text-[#a28f82]"
    />
  </div>
</TabHero>

      <SectionCard>
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          Filtros rápidos
        </div>
        <SuggestionChipBar
          items={quickFilters}
          active={quickFilter}
          onChange={setQuickFilter}
        />

        <div className="mb-3 mt-5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          Gêneros
        </div>
        <SuggestionChipBar
          items={genres}
          active={genreFilter}
          onChange={setGenreFilter}
        />

        <div className="mb-3 mt-5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
          Momentos
        </div>
        <SuggestionChipBar
          items={moments}
          active={momentFilter}
          onChange={setMomentFilter}
        />
      </SectionCard>
     {!hasActiveFilters && (
  <>
    {favoriteSongs.length > 0 && (
      <SectionCard>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-black text-[#241a14]">Suas favoritas</div>
            <div className="mt-1 text-[13px] leading-5 text-[#7a6a5e]">
              As músicas que você marcou e pode revisar rapidamente.
            </div>
          </div>

          <div className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
            {favoriteSongs.length} favorita(s)
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {favoriteSongs.map((song) => (
            <CollectionCard
              key={song.id}
              item={song}
              onPlay={() => {
                setCurrentSong(song);
                setExpandedSong(song);
              }}
              onFav={() => toggleFavorite(song.id)}
              onAdd={() => setSheetSong(song)}
            />
          ))}
        </div>
      </SectionCard>
    )}

    <SectionCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[18px] font-black text-[#241a14]">Mais escolhidas</div>
          <div className="mt-1 text-[13px] leading-5 text-[#7a6a5e]">
            Ranking dinâmico com destaque para as músicas mais fortes da curadoria.
          </div>
        </div>

        <div className="rounded-full bg-[#faf7f3] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#7a6a5e]">
          Top {Math.min(mostChosenSongs.length, 10)}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {mostChosenSongs.slice(0, 10).map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Para entrada da noiva</div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {brideEntranceSongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Gospel para casamento</div>
      <div className="mb-4 text-[13px] leading-5 text-[#7a6a5e]">
        Seleção pensada para cerimônias cristãs e momentos de adoração no casamento.
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {gospelSongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Gospel para entrada</div>
      <div className="mb-4 text-[13px] leading-5 text-[#7a6a5e]">
        Músicas e instrumentais com atmosfera forte para entrada da noiva e momentos marcantes.
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {gospelEntranceSongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Gospel para cerimônia</div>
      <div className="mb-4 text-[13px] leading-5 text-[#7a6a5e]">
        Sugestões cristãs para momentos centrais da cerimônia, oração, aliança e gratidão.
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {gospelCeremonySongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4 text-[18px] font-black text-[#241a14]">Cerimônia</div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {ceremonySongs.map((song) => (
          <CollectionCard
            key={song.id}
            item={song}
            onPlay={() => {
              setCurrentSong(song);
              setExpandedSong(song);
            }}
            onFav={() => toggleFavorite(song.id)}
            onAdd={() => setSheetSong(song)}
          />
        ))}
      </div>
    </SectionCard>
  </>
)}

<SectionCard>
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="text-[18px] font-black text-[#241a14]">
      {hasActiveFilters ? 'Resultados da busca' : 'Todas as músicas'}
    </div>
    <div className="text-[12px] font-black text-[#9b8576]">
      {filteredSongs.length} resultado(s)
    </div>
  </div>

  <div className="space-y-3">
    {filteredSongs.length ? (
      filteredSongs.map((song) => (
        <SongListCard
          key={song.id}
          item={song}
          onPlay={() => {
            setCurrentSong(song);
            setExpandedSong(song);
          }}
          onFav={() => toggleFavorite(song.id)}
          onAdd={() => setSheetSong(song)}
        />
      ))
    ) : (
      <EmptyStateCard
        title="Nenhuma música encontrada"
        text="Tente ajustar os filtros ou buscar por outro nome, artista, gênero ou momento."
      />
    )}
  </div>
</SectionCard>

      <MiniMusicPlayer
        current={currentSong}
        onClose={() => setCurrentSong(null)}
        onExpand={() => setExpandedSong(currentSong)}
      />

      <PlayerModal
        current={expandedSong}
        onClose={() => setExpandedSong(null)}
        onFav={() => toggleFavorite(expandedSong.id)}
        onAdd={() => {
          setSheetSong(expandedSong);
          setExpandedSong(null);
        }}
      />

      <AddSongSheet
        music={sheetSong}
        onClose={() => setSheetSong(null)}
        onConfirm={handleAddConfirm}
      />
    </div>
  );
}
function FinanceSummaryCard({ label, value, tone = 'default' }) {
  const toneMap = {
    default: 'bg-white text-[#241a14] border-[#eadfd6]',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    accent: 'bg-violet-50 text-violet-700 border-violet-200',
  };

  return (
    <div
      className={classNames(
        'rounded-[22px] border p-4 shadow-[0_8px_22px_rgba(36,26,20,0.04)]',
        toneMap[tone]
      )}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-80">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-black">{value}</div>
    </div>
  );
}

function PaymentStatusPill({ status }) {
  const s = String(status || '').trim().toUpperCase();

  const map = {
    PAGO: 'bg-emerald-100 text-emerald-700',
    PENDENTE: 'bg-amber-100 text-amber-800',
    VENCIDO: 'bg-red-100 text-red-700',
    ENVIADO: 'bg-violet-100 text-violet-700',
    EM_ANALISE: 'bg-sky-100 text-sky-700',
  };

  return (
    <span
      className={classNames(
        'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
        map[s] || 'bg-zinc-100 text-zinc-700'
      )}
    >
      {status || '—'}
    </span>
  );
}

function PaymentTimelineItem({
  title,
  dueDate,
  amount,
  status,
  description,
}) {
  return (
    <div className="rounded-[22px] border border-[#eadfd6] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-black text-[#241a14]">{title}</div>
          <div className="mt-1 text-[13px] font-semibold text-[#7a6a5e]">
            Vencimento: {dueDate || '—'}
          </div>
        </div>

        <PaymentStatusPill status={status} />
      </div>

      <div className="mt-3 text-[18px] font-black text-[#241a14]">
        {amount || '—'}
      </div>

      {description ? (
        <div className="mt-2 text-[13px] leading-5 text-[#8b786b]">
          {description}
        </div>
      ) : null}
    </div>
  );
}

function PaymentHistoryItem({ item }) {
  return (
    <div className="rounded-[20px] border border-[#eadfd6] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-black text-[#241a14]">
            {item.label || 'Pagamento'}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-[#7a6a5e]">
            {item.date || '—'}
          </div>
        </div>

        <PaymentStatusPill status={item.status} />
      </div>

      <div className="mt-3 text-[18px] font-black text-[#241a14]">
        {item.amount || '—'}
      </div>

      {item.note ? (
        <div className="mt-2 text-[13px] leading-5 text-[#8b786b]">
          {item.note}
        </div>
      ) : null}

      {item.fileName ? (
        <div className="mt-3 rounded-[14px] bg-[#faf7f3] px-3 py-2 text-[12px] font-bold text-[#6f5d51]">
          📎 {item.fileName}
        </div>
      ) : null}
    </div>
  );
}

function FinanceiroTab({ data, paymentHistory, setPaymentHistory }) {
  const [paymentValue, setPaymentValue] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentFile, setPaymentFile] = useState(null);
  const { showToast } = useToast();

  const financeiro = data.financeiro || {};

  const resumo = financeiro.resumo || {
    valorTotal: 'R$ 4.000,00',
    valorPago: 'R$ 2.000,00',
    saldo: 'R$ 2.000,00',
    status: 'Em aberto',
  };

  const vencimentos = financeiro.vencimentos || [
    {
      title: 'Primeiro pagamento',
      dueDate: '05/09/2026',
      amount: 'R$ 2.000,00',
      status: 'PAGO',
      description: '50% do valor total até 14 dias antes do evento.',
    },
    {
      title: 'Pagamento final',
      dueDate: '17/09/2026',
      amount: 'R$ 2.000,00',
      status: 'PENDENTE',
      description: 'Saldo final até 48h antes do evento.',
    },
  ];

  const historico =
  paymentHistory && paymentHistory.length
    ? paymentHistory
    : [
    {
      label: 'Sinal recebido',
      date: '01/09/2026',
      amount: 'R$ 2.000,00',
      status: 'PAGO',
      note: 'Pagamento confirmado com sucesso.',
      fileName: 'comprovante-pix-setembro.pdf',
    },
  ];

  return (
    <div className="space-y-4 pb-24">
      <TabHero
  badge="Financeiro do evento"
  title="Acompanhe seus pagamentos"
  text="Consulte valores, vencimentos, histórico e envie comprovantes de forma simples e organizada."
/>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FinanceSummaryCard label="Valor total" value={resumo.valorTotal} />
        <FinanceSummaryCard label="Valor pago" value={resumo.valorPago} tone="success" />
        <FinanceSummaryCard label="Saldo" value={resumo.saldo} tone="warning" />
        <FinanceSummaryCard label="Situação" value={resumo.status} tone="accent" />
      </div>

      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">
          Próximos vencimentos
        </div>

        <div className="space-y-3">
          {vencimentos.map((item, index) => (
            <PaymentTimelineItem
              key={`${item.title}-${index}`}
              title={item.title}
              dueDate={item.dueDate}
              amount={item.amount}
              status={item.status}
              description={item.description}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard className="bg-[#fffaf0] border-[#f3e1b7]">
        <div className="text-[16px] font-black text-[#8b5a14]">
          Regras financeiras do evento
        </div>

        <div className="mt-3 space-y-2 text-[14px] leading-6 text-[#7b5d2d]">
          <div>• 50% do valor deve ser quitado até 14 dias antes do evento.</div>
          <div>• O saldo final deve ser quitado até 48 horas antes da data do evento.</div>
          <div>• Após enviar um comprovante, ele ficará em análise até a confirmação.</div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="text-[18px] font-black text-[#241a14]">
          Enviar comprovante
        </div>

        <div className="mt-2 text-[14px] leading-6 text-[#6f5d51]">
          Preencha os dados abaixo e anexe seu comprovante para análise.
        </div>

        <div className="mt-5 space-y-4">
          <InputField
            label="Valor pago"
            placeholder="Ex: 2000,00"
            value={paymentValue}
            onChange={(e) => setPaymentValue(e.target.value)}
          />

          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Data do pagamento
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-[16px] border border-[#eadfd6] bg-white px-4 py-4 text-[15px] font-semibold text-[#241a14] outline-none"
            />
          </div>

          <InputField
            label="Observação"
            placeholder="Ex: pagamento referente ao sinal"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            textarea
            rows={3}
          />

          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b8576]">
              Comprovante
            </label>

            <label className="flex cursor-pointer items-center justify-center rounded-[18px] border-2 border-dashed border-[#d9c8f7] bg-[#fcfbff] px-4 py-5 text-center text-[14px] font-bold text-violet-700">
              <input
                type="file"
                className="hidden"
                onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
              />
              {paymentFile ? `📎 ${paymentFile.name}` : 'Selecionar comprovante'}
            </label>
          </div>

          <button
  type="button"
  onClick={() => {
    if (!paymentValue || !paymentDate) {
      showToast('Preencha valor e data antes de enviar', 'warning');
      return;
    }

    const novoItem = {
      label: 'Comprovante enviado',
      date: paymentDate,
      amount: `R$ ${paymentValue}`,
      status: 'EM_ANALISE',
      note: paymentNote || 'Aguardando conferência da equipe.',
      fileName: paymentFile?.name || 'comprovante-anexado',
    };

    setPaymentHistory((prev) => [novoItem, ...prev]);

    setPaymentValue('');
    setPaymentDate('');
    setPaymentNote('');
    setPaymentFile(null);

    showToast('Comprovante enviado com sucesso', 'success');
  }}
  className="w-full rounded-[20px] bg-[linear-gradient(135deg,#6d28d9_0%,#8b5cf6_100%)] px-4 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)]"
>
  Enviar comprovante
</button>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="mb-4 text-[18px] font-black text-[#241a14]">
          Histórico de pagamentos
        </div>

        <div className="space-y-3">
          {historico.length ? (
            historico.map((item, index) => (
              <PaymentHistoryItem key={`${item.label}-${index}`} item={item} />
            ))
          ) : (
            <EmptyStateCard
  title="Nenhum pagamento registrado"
  text="Assim que um comprovante for enviado, ele aparecerá aqui para acompanhamento."
/>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
function ClienteLoadingScreen() {
  return (
    <main className="min-h-screen bg-[#f8f4ef] px-4 py-6">
      <div className="mx-auto max-w-[520px]">
        <div className="overflow-hidden rounded-[30px] border border-[#eadfd6] bg-white p-6 shadow-[0_16px_40px_rgba(36,26,20,0.06)]">
          <div className="h-4 w-28 animate-pulse rounded-full bg-[#ece4dc]" />
          <div className="mt-5 h-8 w-3/4 animate-pulse rounded-full bg-[#ece4dc]" />
          <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-[#f2ebe4]" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-[#f2ebe4]" />

          <div className="mt-8 grid grid-cols-1 gap-3">
            <div className="h-20 animate-pulse rounded-[22px] bg-[#f7f2ed]" />
            <div className="h-20 animate-pulse rounded-[22px] bg-[#f7f2ed]" />
            <div className="h-20 animate-pulse rounded-[22px] bg-[#f7f2ed]" />
          </div>
        </div>
      </div>
    </main>
  );
}

function ClienteBlockedScreen() {
  return (
    <main className="min-h-screen bg-[#f8f4ef] px-4 py-6">
      <div className="mx-auto max-w-[520px]">
        <SectionCard className="text-center">
          <div className="text-4xl">🔒</div>
          <div className="mt-4 text-[24px] font-black text-[#241a14]">
            Painel ainda não liberado
          </div>
          <div className="mt-3 text-[14px] leading-6 text-[#6f5d51]">
            Assim que as etapas anteriores forem concluídas, este painel ficará disponível para acompanhamento.
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function ClienteInvalidScreen() {
  return (
    <main className="min-h-screen bg-[#f8f4ef] px-4 py-6">
      <div className="mx-auto max-w-[520px]">
        <SectionCard className="text-center">
          <div className="text-4xl">😕</div>
          <div className="mt-4 text-[24px] font-black text-[#241a14]">
            Link inválido
          </div>
          <div className="mt-3 text-[14px] leading-6 text-[#6f5d51]">
            Este acesso não foi encontrado ou não está mais disponível.
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function EmptyStateCard({ title, text }) {
  return (
    <div className="rounded-[20px] bg-[#faf7f3] px-4 py-5 text-center">
      <div className="text-[16px] font-black text-[#241a14]">{title}</div>
      <div className="mt-2 text-[14px] leading-6 text-[#7a6a5e]">{text}</div>
    </div>
  );
}

export default function ClienteHome({ data, initialTab = 'inicio' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [favoriteSongIds, setFavoriteSongIds] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState(
    data?.financeiro?.historico || []
  );

    useEffect(() => {
    setActiveTab(initialTab || 'inicio');
  }, [initialTab]);

  if (!data) {
    return <ClienteLoadingScreen />;
  }

  if (data.invalid) {
    return <ClienteInvalidScreen />;
  }

  if (data.blocked) {
    return <ClienteBlockedScreen />;
  }

  return (
    <main className="min-h-screen bg-[#f8f4ef] text-[#241a14]">
      <div className="mx-auto w-full max-w-[520px] px-4 pb-32 pt-4">
        <section className="overflow-hidden rounded-[30px] border border-[#2f2231] bg-[linear-gradient(135deg,#1e1723_0%,#2d1c4b_52%,#5b21b6_100%)] px-5 py-6 text-white shadow-[0_16px_50px_rgba(37,25,52,0.24)]">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/90">
            Painel do cliente
          </div>

          <div className="mt-4 text-[28px] font-black leading-tight">
            {data.eventoTitulo || 'Seu evento'}
          </div>

          <div className="mt-2 text-[15px] font-medium leading-6 text-white/80">
            Acompanhe tudo de forma organizada e tenha as informações principais do seu evento em um só lugar.
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StatusPill label={data.statusContrato || 'Em andamento'} tone="success" />
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-bold text-white/90">
              📅 {formatLongDateBR(data.dataEvento)}
            </div>
          </div>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/8 p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/70">
              Cliente
            </div>
            <div className="mt-1 text-[18px] font-black">{data.clienteNome}</div>
          </div>
        </section>

        <div className="mt-4">
          {activeTab === 'inicio' && (
            <InicioTab
              data={data}
              setActiveTab={setActiveTab}
              selectedSongs={selectedSongs}
            />
          )}

          {activeTab === 'repertorio' && (
            <RepertorioTab
              data={data}
              selectedSongs={selectedSongs}
              onSaved={({ mode }) => {
                if (mode === 'final') return;
              }}
            />
          )}

          {activeTab === 'sugestoes' && (
            <SugestoesTab
              selectedSongs={selectedSongs}
              setSelectedSongs={setSelectedSongs}
              favoriteSongIds={favoriteSongIds}
              setFavoriteSongIds={setFavoriteSongIds}
            />
          )}

          {activeTab === 'financeiro' && (
            <FinanceiroTab
              data={data}
              paymentHistory={paymentHistory}
              setPaymentHistory={setPaymentHistory}
            />
          )}
        </div>
      </div>

      <FooterNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </main>
  );
}
