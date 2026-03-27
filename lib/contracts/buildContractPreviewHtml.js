function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isTruthy(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return !(s === '' || s === 'false' || s === '0');
}

function renderContractTemplate(template, data) {
  let text = String(template || '');

  // resolve blocos condicionais {{#CHAVE}} ... {{/CHAVE}}
  const openRe = /\{\{#([A-Z0-9_]+)\}\}/g;
  let match;

  while ((match = openRe.exec(text)) !== null) {
    const key = match[1];
    const blockRe = new RegExp(
      `\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`,
      'g'
    );

    const keep = isTruthy(data[key]);

    text = text.replace(blockRe, (_, inner) => {
      return keep ? inner : '';
    });

    openRe.lastIndex = 0;
  }

  // substitui placeholders simples
  Object.entries(data).forEach(([key, value]) => {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    text = text.replace(re, escapeHtml(value ?? ''));
  });

  // limpa sobras
  text = text.replace(/\{\{#[^}]+\}\}/g, '');
  text = text.replace(/\{\{\/[^}]+\}\}/g, '');

  return text;
}

function paragraphize(text) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const blocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      // linhas que começam com bullet
      if (block.split('\n').every((line) => line.trim().startsWith('•'))) {
        const items = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<li>${line.replace(/^•\s*/, '')}</li>`)
          .join('');

        return `<ul class="contract-list">${items}</ul>`;
      }

      const html = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('<br/>');

      return `<p class="contract-p">${html}</p>`;
    })
    .join('');
}

export function buildContractPreviewHtml(templateData) {
  const template = `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS MUSICAIS PARA CERIMÔNIA

IDENTIFICAÇÃO DAS PARTES CONTRATANTES

CONTRATANTE:
{{NOME}}, brasileiro (a), {{ESTADO_CIVIL}}, {{PROFISSAO}}, inscrito(a) no CPF sob o nº {{CPF}} e no RG sob o nº {{RG}}, residente e domiciliado(a) no endereço: {{ENDERECO}}.

CONTRATADO:
MARCOS CRUZ, com sede em Salvador/BA, na Rua Recanto Bela Vista, nº 5, Mussurunga II, CEP 41480-390, inscrita no CNPJ sob nº 29.671.912/0001-77, neste ato representada por seu sócio proprietário MARCOS PERRELLA CRUZ, brasileiro, casado, músico, portador do RG nº 1482384833 e CPF nº 059.776.725-43, residente e domiciliado na Rua João José Rescala, nº 62, Imbuí, CEP 41720-000, Salvador/BA.

As partes acima identificadas têm, entre si, justo e contratado o presente Contrato de Prestação de Serviços Musicais para Cerimônia, que se regerá pelas cláusulas e condições abaixo.

DO OBJETO DO CONTRATO

Cláusula 1ª
O presente contrato tem como objeto a prestação de serviços musicais pelo CONTRATADO, por meio da Banda Harmonics, composta por {{FORMACAO}} {{INSTRUMENTOS}}, durante cerimônia de casamento a ser realizada no dia {{DATA_EVENTO}}, às {{HORA_EVENTO}}, no endereço {{LOCAL_EVENTO}}.
O serviço contratado compreende a execução musical durante a cerimônia conforme repertório previamente definido pelo CONTRATANTE.

DA CHEGADA DA BANDA E CONDIÇÕES DE ATRASO

Cláusula 2ª
O CONTRATADO compromete-se a chegar ao local da cerimônia com antecedência aproximada de até 2 (duas) horas do horário previsto para início do evento, a fim de realizar montagem de equipamentos, passagem de som e demais preparativos técnicos necessários.
Caso a cerimônia sofra atraso superior a 1 (uma) hora em relação ao horário previamente informado neste contrato, será cobrada taxa adicional correspondente a 30% (trinta por cento) do valor total do contrato por hora adicional ou fração de hora de espera.
O pagamento do valor adicional deverá ser realizado ao final da cerimônia.
Caso o atraso ultrapasse 2 (duas) horas do horário inicialmente previsto, o CONTRATADO reserva-se o direito de reduzir ou interromper a execução musical, sem que isso configure descumprimento contratual.

DOS EQUIPAMENTOS

Cláusula 3ª
O CONTRATADO será responsável por levar seus próprios instrumentos musicais necessários à realização da apresentação.
O sistema de sonorização da cerimônia poderá ser providenciado diretamente pelo CONTRATANTE ou contratado por intermédio do CONTRATADO, conforme acordado entre as partes.

DA ESTRUTURA E COBERTURA DO LOCAL

Cláusula 4ª
Nos casos em que o evento ou cerimônia seja realizado em área externa ou ambiente aberto, o CONTRATANTE compromete-se a providenciar estrutura adequada de cobertura, como toldo, tenda ou estrutura equivalente, capaz de proteger integralmente os músicos, instrumentos musicais, equipamentos eletrônicos e sistema de som contra chuva, sol excessivo, vento ou quaisquer outras intempéries.
A estrutura deverá garantir condições seguras para a realização da apresentação e preservar a integridade física dos profissionais e dos equipamentos.
Na ausência de cobertura adequada ou caso as condições climáticas representem risco aos músicos ou aos equipamentos, o CONTRATADO poderá suspender temporariamente ou interromper a apresentação, sem que isso configure descumprimento contratual.
Caso ocorra qualquer dano aos instrumentos, equipamentos ou sistema de som em decorrência da ausência da proteção prevista nesta cláusula, o CONTRATANTE será responsável pelo ressarcimento integral dos prejuízos causados.

DAS DESPESAS

Cláusula 5ª
As despesas relativas a alvarás, direitos autorais eventualmente exigidos por entidades arrecadadoras e quaisquer multas ou encargos decorrentes da realização do evento serão de responsabilidade exclusiva do CONTRATANTE.

Cláusula 6ª
Caso haja necessidade de deslocamento da banda para outra cidade ou localidade, as despesas com transporte, alimentação e hospedagem dos músicos correrão por conta do CONTRATANTE.

DAS CONDIÇÕES DE SEGURANÇA

Cláusula 7ª
O CONTRATANTE compromete-se a oferecer condições adequadas de segurança para a realização da apresentação, responsabilizando-se por qualquer situação que coloque em risco a integridade física dos músicos ou de terceiros.

DAS ALTERAÇÕES DO EVENTO

Cláusula 8ª
Qualquer alteração referente à data, horário ou endereço da cerimônia deverá ser comunicada ao CONTRATADO com antecedência mínima de 3 (três) dias.

DA NÃO TRANSFERÊNCIA

Cláusula 9ª
O presente contrato é personalíssimo, não podendo ser transferido ou cedido a terceiros por qualquer das partes sem prévia concordância da outra.

DO PAGAMENTO

Cláusula 10ª
O CONTRATANTE se compromete a pagar ao CONTRATADO a quantia de {{VALOR_TOTAL}} ({{VALOR_TOTAL_EXTENSO}}).

{{#EXTRAS}}
Incluem-se no valor contratado os seguintes serviços adicionais: {{EXTRAS_TEXTO}}.
{{/EXTRAS}}

O pagamento será realizado da seguinte forma:
• 50% do valor até {{DATA_SINAL}}
• 50% restantes até {{DATA_SALDO}}

{{#CARTAO}}
Caso o pagamento seja realizado por cartão, o valor total deverá ser quitado até {{DATA_CARTAO}}.
{{/CARTAO}}

Forma de pagamento via PIX:
Chave Pix: 71996987392
Titular: Tatiane Lorena Perrella Pinheiro Batista

DA RESCISÃO

Cláusula 11ª
O presente contrato poderá ser rescindido caso qualquer das partes descumpra as obrigações previstas neste instrumento.
Na hipótese de rescisão imotivada por uma das partes, será devida multa equivalente a 30% (trinta por cento) do valor total contratado.
Em casos de força maior ou caso fortuito, as partes poderão acordar nova data para realização do evento ou proceder à devolução dos valores pagos, descontadas eventuais despesas já realizadas.

DO FORO E DA ASSINATURA ELETRÔNICA

Cláusula 12ª
Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da Comarca de Salvador – BA, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
As partes concordam que o presente contrato poderá ser firmado por meio eletrônico, mediante aceite registrado no sistema Harmonics, sendo tal manifestação de vontade considerada válida, eficaz e plenamente vinculante para todos os fins de direito.
O aceite eletrônico do CONTRATANTE, acompanhado do registro de identificação do signatário, data e hora da assinatura e demais dados técnicos de autenticação, substitui a assinatura manuscrita e produz os mesmos efeitos jurídicos de um documento físico assinado.
O presente instrumento é gerado e armazenado em formato digital, sendo considerado via única válida para todos os fins legais.
Este documento possui validade jurídica nos termos da Medida Provisória nº 2.200-2/2001 e do Art. 107 do Código Civil Brasileiro.

ASSINATURA

CONTRATANTE
{{ASSINATURA}}
CPF: {{ACEITE_CPF}}
O CONTRATANTE declara que leu, compreendeu e concordou integralmente com todos os termos deste contrato, manifestando sua vontade por meio de aceite eletrônico registrado no sistema Harmonics.

CONTRATADO
BANDA HARMONICS
Representante: Marcos Perrella Cruz

CERTIFICAÇÃO DE ASSINATURA ELETRÔNICA
Este documento foi assinado eletronicamente através do sistema Harmonics, mediante confirmação de leitura e aceite do contratante.
{{CARIMBO_ASSINATURA}}
A manifestação de vontade foi registrada eletronicamente e vinculada a este documento por meio de registro técnico contendo identificação do signatário, data e hora da assinatura e endereço IP.
Nos termos da Medida Provisória nº 2.200-2/2001 e do Art. 107 do Código Civil Brasileiro, a assinatura eletrônica possui validade jurídica e produz os mesmos efeitos legais de uma assinatura manuscrita.
Este documento é considerado válido e eficaz para todos os fins de direito.

REGISTRO TÉCNICO DE ASSINATURA ELETRÔNICA

ID do Contrato: {{TOKEN_CONTRATO}}
Signatário: {{ACEITE_NOME}}
CPF do Signatário: {{ACEITE_CPF}}
Data e hora da assinatura: {{ACEITE_DATAHORA}}
Endereço IP do signatário: {{ACEITE_IP}}
Origem da assinatura: {{ACEITE_ORIGEM}}
Hash de integridade do documento: {{HASH_DOCUMENTO}}
  `;

  const renderedText = renderContractTemplate(template, templateData);
  const contentHtml = paragraphize(renderedText);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Prévia do Contrato</title>
  <style>
    :root {
      --bg: #f3f4f6;
      --paper: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --accent: #7c3aed;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .wrap {
      max-width: 960px;
      margin: 0 auto;
      padding: 16px;
    }

    .paper {
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
      padding: 22px 18px;
    }

    .head {
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }

    .eyebrow {
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: .08em;
      text-transform: uppercase;
      margin: 0 0 6px;
    }

    .title {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
      font-weight: 800;
    }

    .subtitle {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .contract-p {
      margin: 0 0 14px;
      font-size: 15px;
      line-height: 1.75;
      text-align: justify;
      white-space: normal;
    }

    .contract-list {
      margin: 0 0 14px 18px;
      padding: 0;
    }

    .contract-list li {
      margin-bottom: 8px;
      font-size: 15px;
      line-height: 1.7;
    }

    @media (max-width: 640px) {
      .wrap {
        padding: 10px;
      }

      .paper {
        border-radius: 18px;
        padding: 16px 14px;
      }

      .title {
        font-size: 20px;
      }

      .subtitle,
      .contract-p,
      .contract-list li {
        font-size: 14px;
        line-height: 1.7;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="paper">
      <div class="head">
        <p class="eyebrow">Harmonics</p>
        <h1 class="title">Prévia do contrato</h1>
        <p class="subtitle">
          Confira atentamente o conteúdo abaixo. A assinatura será feita separadamente na etapa seguinte.
        </p>
      </div>

      ${contentHtml}
    </div>
  </div>
</body>
</html>
  `;
}