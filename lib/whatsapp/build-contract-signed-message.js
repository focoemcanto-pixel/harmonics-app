export function buildContractSignedMessage({
  clientName,
  clientPanelUrl,
}) {
  const saudacao = clientName?.trim()
    ? `Olá, ${clientName.trim()}! ✅`
    : 'Olá! ✅';

  return `${saudacao}

Seu contrato foi assinado com sucesso.

Seu painel do cliente já está liberado:
${clientPanelUrl}

Por lá você poderá acompanhar as informações do seu evento e os próximos passos da sua experiência conosco.

Qualquer dúvida, estou à disposição.`;
}
