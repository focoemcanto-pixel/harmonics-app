'use client';

import Pill from './EventPill';

export default function OperacaoContractInline({
  ev,
  contractStatus,
  contractInfo,
  onCreateOrEdit,
  onOpenLink,
}) {
  const hasLink = !!contractInfo?.link;
  const linkLabel =
    contractStatus.action === 'view'
      ? 'Abrir contrato'
      : contractStatus.action === 'edit'
      ? 'Continuar contrato'
      : 'Abrir link';

  return (
    <div className="mt-4 rounded-[18px] border border-violet-200 bg-violet-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[13px] font-bold text-violet-800">
            Contrato do evento
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone={contractStatus.tone || 'default'}>
              {`Contrato: ${contractStatus.label}`}
            </Pill>

            {hasLink ? (
              <Pill tone="blue">Link disponível</Pill>
            ) : (
              <Pill tone="amber">Sem link gerado</Pill>
            )}
          </div>

          <div className="mt-3 text-[13px] text-violet-900/80">
            {contractStatus.action === 'create' &&
              'Este evento ainda não possui contrato gerado. Abra o evento para preencher e iniciar o fluxo.'}

            {contractStatus.action === 'edit' &&
              'O contrato já foi iniciado, mas ainda não foi concluído. Você pode abrir o link atual ou continuar pelo evento.'}

            {contractStatus.action === 'view' &&
              'O contrato deste evento já está concluído. Você pode abrir o link para consultar o documento.'}
          </div>

          {hasLink ? (
            <div className="mt-3 rounded-[14px] border border-violet-100 bg-white/70 px-3 py-2 text-[12px] font-semibold text-violet-700 break-all">
              {contractInfo.link}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {hasLink ? (
            <button
              type="button"
              onClick={onOpenLink}
              className="rounded-[14px] border border-violet-200 bg-white px-4 py-2 text-[13px] font-black text-violet-700"
            >
              {linkLabel}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onCreateOrEdit}
            className={`rounded-[14px] px-4 py-2 text-[13px] font-black ${
              contractStatus.action === 'view'
                ? 'border border-[#dbe3ef] bg-white text-[#0f172a]'
                : 'bg-violet-600 text-white'
            }`}
          >
            {contractStatus.action === 'create' && 'Gerar contrato'}
            {contractStatus.action === 'edit' && 'Finalizar contrato'}
            {contractStatus.action === 'view' && 'Abrir evento'}
          </button>
        </div>
      </div>
    </div>
  );
}