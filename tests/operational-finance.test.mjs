import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  today,
  eventSummary,
  excludeCost,
  restoreCost,
  describeReception,
  dashboard,
  monthlyCommitments,
  activeEntries,
  suggestedCosts,
} from "../lib/operational-finance/model.mjs";
const e = {
  id: "e",
  event_date: "2026-11-15",
  agreed_amount: 4700,
  paid_amount: 999999,
  musician_cost: 999999,
};
const settings = { opening_on: "2026-10-13", opening_cents: 1000000 };
const sheet = {
  event_id: "e",
  status: "checked",
  contract_cents: 470000,
  costs: [
    { id: "c", category: "musician", amount_cents: 130000 },
    { id: "t", category: "transporte", amount_cents: 20000 },
    { id: "s", category: "som", amount_cents: 100000 },
    { id: "o", category: "operacional", amount_cents: 15000 },
  ],
};
const entry = (patch = {}) => ({
  id: "r",
  event_id: "e",
  kind: "receipt",
  amount_cents: 100000,
  occurred_on: "2026-10-13",
  in_opening: false,
  ...patch,
});
const calc = (s = [sheet], l = [], events = [e]) =>
  dashboard(events, s, l, settings, "2026-10-13");
test("moeda brasileira e centavos exatos", () => {
  assert.equal(cents("R$ 1.000,50"), 100050);
  assert.equal(cents("1000"), 100000);
  assert.equal(cents("10.50"), 1050);
  assert.throws(() => cents("-1"));
  assert.throws(() => cents("1.999"));
});
test("data local em formato ISO", () =>
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/));
test("evento sem financeiro legado inicia não conferido", () => {
  const s = eventSummary(e, null, []);
  assert.equal(s.checked, false);
  assert.equal(s.received, 0);
  assert.equal(s.total, 0);
  assert.equal(s.contract, 470000);
});
test("registro manual de R$ 1000", () =>
  assert.equal(eventSummary(e, sheet, [entry()]).received, 100000));
test("dois recebimentos preservam soma", () => {
  const s = eventSummary(e, sheet, [
    entry(),
    entry({ id: "r2", amount_cents: 150000 }),
  ]);
  assert.equal(s.received, 250000);
  assert.equal(s.open, 220000);
});
test("quitação e excesso separados", () => {
  const s = eventSummary(e, sheet, [entry({ amount_cents: 480000 })]);
  assert.equal(s.open, 0);
  assert.equal(s.overpayment, 10000);
});
test("estorno preserva original e remove efeito", () => {
  const l = [entry(), entry({ id: "rev", kind: "reversal", reverses_id: "r" })];
  assert.equal(activeEntries(l).length, 0);
  assert.equal(l.length, 2);
  assert.equal(eventSummary(e, sheet, l).received, 0);
});
test("correção por estorno e novo recebimento", () => {
  const l = [
    entry(),
    entry({ id: "rev", kind: "reversal", reverses_id: "r" }),
    entry({ id: "r2", amount_cents: 80000 }),
  ];
  assert.equal(eventSummary(e, sheet, l).received, 80000);
});
test("cachê específico não muda ficha anterior", () => {
  const other = structuredClone(sheet);
  other.costs[0].amount_cents = 50000;
  assert.equal(sheet.costs[0].amount_cents, 130000);
  assert.equal(eventSummary(e, other, []).total, 185000);
});
test("pagamento parcial do músico", () => {
  const s = eventSummary(e, sheet, [
    entry({ kind: "payment", cost_id: "c", amount_cents: 50000 }),
  ]);
  assert.equal(s.costs[0].paid, 50000);
  assert.equal(s.costs[0].open, 80000);
});
test("pagamento total do músico", () =>
  assert.equal(
    eventSummary(e, sheet, [
      entry({ kind: "payment", cost_id: "c", amount_cents: 130000 }),
    ]).costs[0].open,
    0,
  ));
test("custo extra muda margem", () => {
  const s = eventSummary(e, sheet, []);
  assert.equal(s.total, 265000);
  assert.equal(s.margin, 205000);
});
test("retirada reduz caixa sem mudar margem", () => {
  const s = calc(undefined, [
    entry({ kind: "withdrawal", event_id: null, amount_cents: 150000 }),
  ]);
  assert.equal(s.cash, 850000);
  assert.equal(s.margin, 205000);
});
test("caixa livre e projeção sem somar margem novamente", () => {
  const s = calc();
  assert.equal(s.free, 735000);
  assert.equal(s.projected, 1205000);
});
test("pagamento reduz caixa e dívida na mesma medida", () => {
  const before = calc(),
    after = calc(undefined, [
      entry({ kind: "payment", cost_id: "c", amount_cents: 50000 }),
    ]);
  assert.equal(after.cash, before.cash - 50000);
  assert.equal(after.musician, before.musician - 50000);
  assert.equal(after.free, before.free);
  assert.equal(after.projected, before.projected);
});
test("recebimento reduz contas a receber sem duplicar projeção", () => {
  const before = calc(),
    after = calc(undefined, [entry()]);
  assert.equal(after.cash, before.cash + 100000);
  assert.equal(after.receivable, before.receivable - 100000);
  assert.equal(after.projected, before.projected);
});
test("histórico incluído no saldo inicial não aumenta caixa", () => {
  const s = calc(undefined, [entry({ in_opening: true })]);
  assert.equal(s.cash, 1000000);
  assert.equal(s.receivable, 370000);
});
test("data anterior ao marco zero não movimenta caixa", () =>
  assert.equal(
    calc(undefined, [entry({ occurred_on: "2026-08-05" })]).cash,
    1000000,
  ));
test("pagamento histórico reduz compromisso sem debitar caixa", () => {
  const s = calc(undefined, [
    entry({
      kind: "payment",
      cost_id: "c",
      amount_cents: 50000,
      in_opening: true,
    }),
  ]);
  assert.equal(s.cash, 1000000);
  assert.equal(s.musician, 80000);
});
test("evento não conferido não apresenta custos como confirmados", () => {
  const s = calc([{ ...sheet, status: "draft" }]);
  assert.equal(s.committed, 0);
  assert.equal(s.receivable, 0);
  assert.equal(s.margin, 0);
  assert.equal(s.unchecked, 1);
});
test("movimento real em ficha não conferida afeta caixa", () =>
  assert.equal(calc([], [entry()]).cash, 1100000));
test("novo evento conferido amplia margem futura", () => {
  const e2 = { ...e, id: "e2" },
    s2 = { ...sheet, event_id: "e2" };
  assert.equal(calc([sheet, s2], [], [e, e2]).margin, 410000);
});
test("evento passado com dívida continua em compromissos", () => {
  const past = { ...e, event_date: "2026-09-01" };
  const s = calc([sheet], [], [past]);
  assert.equal(s.committed, 265000);
  assert.equal(s.margin, 0);
});
test("déficit é exibido com sinal negativo", () => {
  const huge = {
    ...sheet,
    costs: [{ id: "c", category: "musician", amount_cents: 1300000 }],
  };
  assert.equal(calc([huge]).free, -300000);
  assert.equal(calc([huge]).projected, 170000);
});
test("legado não contamina dashboard", () => {
  const changed = {
    ...e,
    paid_amount: 1e12,
    net_amount: 1e12,
    open_amount: 1e12,
    profit_amount: 1e12,
  };
  assert.deepEqual(calc(undefined, [], [changed]), calc());
});
test("regressão: cálculo de pagamentos legado preservado", async () => {
  const { calculateEventFinance } =
    await import("../lib/finance/event-finance.js");
  assert.deepEqual(
    calculateEventFinance({
      agreedAmount: 4700,
      payments: [
        { amount: 1000, status: "paid" },
        { amount: 1000, status: "pending" },
      ],
    }),
    {
      agreedAmount: 4700,
      paidAmount: 1000,
      openAmount: 3700,
      paymentStatus: "partial",
    },
  );
});

const musician = {
  id: "scale1",
  event_id: "e",
  musician_id: "m",
  role: "Tecladista",
  name: "Heber",
};
const standards = [
  { key: "general:musician", amount_cents: 35000 },
  { key: "cost:sonorização", amount_cents: 30000 },
  { key: "cost:transporte", amount_cents: 20000 },
];
test("prefill: cachê geral, som e transporte contratados", () => {
  const c = suggestedCosts(
    { ...e, has_sound: true, has_transport: true },
    undefined,
    [musician],
    standards,
    () => "id",
  );
  assert.deepEqual(
    c.map((x) => x.amount_cents),
    [35000, 30000, 20000],
  );
  assert.ok(c.every((x) => x.status === "predicted"));
});
test("prefill: função sobrescreve geral e músico sobrescreve função", () => {
  const ds = [
    ...standards,
    { key: "role:Tecladista", amount_cents: 40000 },
    { key: "musician:m", amount_cents: 50000 },
  ];
  assert.equal(
    suggestedCosts(e, undefined, [musician], ds, () => "id")[0].amount_cents,
    50000,
  );
  assert.equal(
    suggestedCosts(e, undefined, [musician], ds.slice(0, -1), () => "id")[0]
      .amount_cents,
    40000,
  );
});
test("prefill: padrão zero específico não herda valor geral", () =>
  assert.equal(
    suggestedCosts(
      e,
      undefined,
      [musician],
      [...standards, { key: "musician:m", amount_cents: 0 }],
      () => "id",
    )[0].amount_cents,
    0,
  ));
test("prefill: acordo salvo não é sobrescrito nem duplicado", () => {
  const saved = [
    { id: "c", scale_id: "scale1", category: "musician", amount_cents: 45000 },
  ];
  const c = suggestedCosts(e, saved, [musician], standards, () => "id");
  assert.equal(c.length, 1);
  assert.equal(c[0].amount_cents, 45000);
  assert.deepEqual(saved, [
    { id: "c", scale_id: "scale1", category: "musician", amount_cents: 45000 },
  ]);
});
test("prefill: não adiciona serviços que não foram contratados", () =>
  assert.equal(
    suggestedCosts(e, undefined, [musician], standards, () => "id").length,
    1,
  ));
test("prefill: reabrir a ficha não duplica os custos padrão", () => {
  const event = { ...e, has_sound: true, has_transport: true };
  const c = suggestedCosts(event, undefined, [musician], standards, () => "id");
  assert.equal(
    suggestedCosts(event, c, [musician], standards, () => "id").length,
    3,
  );
});

test("Joseane: receptivo de 3h aparece mesmo com flag legado false", () =>
  assert.equal(
    describeReception({
      has_reception: false,
      reception_hours: 3,
      reception_formation: "Trio",
    }),
    "Sim • 3h • Trio",
  ));
test("receptivo com duração textual positiva e instrumentos", () =>
  assert.equal(
    describeReception({
      has_reception: false,
      reception_hours: "3",
      reception_formation: "Trio",
      reception_instruments: "Voz, piano e violino",
    }),
    "Sim • 3h • Trio • Voz, piano e violino",
  ));
test("receptivo explícito sem duração exige conferência", () =>
  assert.equal(
    describeReception({ has_reception: true, reception_hours: 0 }),
    "Sim • Duração não informada",
  ));
test("sem duração nem receptivo não inventa serviço", () => {
  assert.equal(
    describeReception({ has_reception: false, reception_hours: 0 }),
    "Não",
  );
  assert.equal(describeReception({ reception_hours: null }), "Não informado");
});

test("mensal: custos seguem mês do evento sem misturar outubro e novembro", () => {
  const nov = { ...e, id: "nov", event_date: "2026-11-15" },
    oct = { ...e, event_date: "2026-10-17" };
  const s = monthlyCommitments(
    [oct, nov],
    [sheet, { ...sheet, event_id: "nov" }],
    [],
    "2026-10-13",
  );
  assert.equal(s.months[0].month, "2026-10");
  assert.equal(s.months[0].total, 265000);
  assert.equal(s.months[1].total, 265000);
  assert.equal(s.months[1].cumulative, 530000);
});
test("mensal: data manual do cachê pode antecipar novembro para outubro", () => {
  const costs = [
    {
      id: "c",
      category: "musician",
      description: "Cachê",
      amount_cents: 50000,
      due_on: "2026-10-30",
    },
  ];
  const p = monthlyCommitments([e], [{ ...sheet, costs }], [], "2026-10-13");
  assert.equal(p.months[0].musician, 50000);
  assert.equal(p.months[0].items[0].date_source, "manual");
});
test("mensal: pagamento parcial reduz só o saldo a reservar", () => {
  const p = monthlyCommitments(
    [e],
    [sheet],
    [entry({ kind: "payment", cost_id: "c", amount_cents: 50000 })],
    "2026-10-13",
  );
  assert.equal(p.months.find((x) => x.month === "2026-11").musician, 80000);
  assert.equal(p.months.find((x) => x.month === "2026-11").total, 215000);
});
test("mensal: recebimento futuro não abate obrigação de músico", () => {
  const p = monthlyCommitments(
    [e],
    [sheet],
    [entry({ amount_cents: 470000 })],
    "2026-10-13",
  );
  assert.equal(p.months.find((x) => x.month === "2026-11").total, 265000);
});
test("mensal: pagamentos quitados não entram em reservas", () => {
  const costs = [{ id: "c", category: "musician", amount_cents: 50000 }];
  const p = monthlyCommitments(
    [e],
    [{ ...sheet, costs }],
    [entry({ kind: "payment", cost_id: "c", amount_cents: 50000 })],
    "2026-10-13",
  );
  assert.equal(p.months[0].total, 0);
  assert.equal(p.months[0].items.length, 0);
});
test("mensal: anteriores em aberto entram na necessidade acumulada", () => {
  const past = { ...e, event_date: "2026-09-20" };
  const p = monthlyCommitments([past], [sheet], [], "2026-10-13");
  assert.equal(p.arrearsTotal, 265000);
  assert.equal(p.months[0].cumulative, 265000);
  assert.equal(p.months[0].total, 0);
});
test("mensal: fichas não conferidas mostram incompletude sem custo fictício", () => {
  const p = monthlyCommitments(
    [e],
    [{ ...sheet, status: "draft" }],
    [],
    "2026-10-13",
  );
  const nov = p.months.find((x) => x.month === "2026-11");
  assert.equal(nov.unchecked, 1);
  assert.equal(nov.total, 0);
});
test("mensal: obrigações ordenadas por data de pagamento", () => {
  const costs = [
    {
      id: "a",
      category: "musician",
      amount_cents: 20000,
      due_on: "2026-10-30",
    },
    {
      id: "b",
      category: "transporte",
      amount_cents: 10000,
      due_on: "2026-10-20",
    },
  ];
  const p = monthlyCommitments([e], [{ ...sheet, costs }], [], "2026-10-13");
  assert.deepEqual(
    p.months[0].items.map((x) => x.cost_id),
    ["b", "a"],
  );
});

test("projeção mensal: entrada pendente entra no mês do evento", () => {
  const p = monthlyCommitments([e], [sheet], [], "2026-10-13");
  const nov = p.months.find((x) => x.month === "2026-11");
  assert.equal(nov.receivable, 470000);
  assert.equal(nov.projectedChange, 205000);
  assert.equal(nov.receipts[0].date_source, "event");
});
test("projeção mensal: previsão manual antecipa recebimento sem antecipar custo", () => {
  const p = monthlyCommitments(
    [e],
    [{ ...sheet, expected_receipt_on: "2026-10-20" }],
    [],
    "2026-10-13",
  );
  assert.equal(p.months[0].receivable, 470000);
  assert.equal(p.months[0].total, 0);
  assert.equal(p.months.find((x) => x.month === "2026-11").receivable, 0);
  assert.equal(
    p.months.find((x) => x.month === "2026-11").projectedChange,
    205000,
  );
});
test("projeção mensal: saldo transportado acumula entradas e pagamentos uma vez", () => {
  const oct = { ...e, id: "oct", event_date: "2026-10-17" },
    nov = { ...e, id: "nov", event_date: "2026-11-15" };
  const p = monthlyCommitments(
    [oct, nov],
    [
      { ...sheet, event_id: "oct" },
      { ...sheet, event_id: "nov" },
    ],
    [],
    "2026-10-13",
  );
  assert.equal(p.months[0].projectedChange, 205000);
  assert.equal(p.months[1].projectedChange, 410000);
});
test("projeção mensal: recebimento realizado sai da previsão e entra no caixa sem duplicar", () => {
  const before = monthlyCommitments([e], [sheet], [], "2026-10-13");
  const after = monthlyCommitments([e], [sheet], [entry()], "2026-10-13");
  const cashBefore = calc().cash,
    cashAfter = calc(undefined, [entry()]).cash;
  assert.equal(
    cashBefore + before.months.at(-1).projectedChange,
    cashAfter + after.months.at(-1).projectedChange,
  );
  assert.equal(after.months.at(-1).receivable, 370000);
});
test("projeção mensal: contrato quitado não aparece como entrada futura", () => {
  const p = monthlyCommitments(
    [e],
    [sheet],
    [entry({ amount_cents: 470000 })],
    "2026-10-13",
  );
  assert.equal(p.months.at(-1).receivable, 0);
  assert.equal(p.months.at(-1).receipts.length, 0);
});
test("projeção mensal: recebimentos de meses anteriores exigem reprogramação", () => {
  const p = monthlyCommitments(
    [e],
    [{ ...sheet, expected_receipt_on: "2026-09-20" }],
    [],
    "2026-10-13",
  );
  assert.equal(p.overdueReceipts.length, 1);
  assert.equal(
    p.months.reduce((n, m) => n + m.receivable, 0),
    0,
  );
});

test("remoção: sonorização não volta ao reabrir ficha salva", () => {
  const event = { ...e, has_sound: true };
  const initial = suggestedCosts(event, undefined, [musician], standards, () =>
    crypto.randomUUID(),
  );
  const saved = initial.filter((c) => c.category !== "sonorização");
  const reopened = suggestedCosts(event, saved, [musician], standards, () =>
    crypto.randomUUID(),
  );
  assert.ok(!reopened.some((c) => c.category === "sonorização"));
});
test("remoção: ficha salva vazia não recria custos de som ou transporte", () =>
  assert.equal(
    suggestedCosts(
      { ...e, has_sound: true, has_transport: true },
      [],
      [],
      standards,
      () => crypto.randomUUID(),
    ).length,
    0,
  ));
test("remoção: custo excluído persiste e fica fora da margem e compromissos", () => {
  const sound = {
    id: "s",
    category: "sonorização",
    amount_cents: 30000,
    default_key: "cost:sonorização",
    description: "Som",
    status: "predicted",
  };
  const removed = excludeCost(sound);
  const saved = { ...sheet, costs: [removed] };
  assert.equal(eventSummary(e, saved, []).total, 0);
  assert.equal(
    dashboard([e], [saved], [], settings, "2026-10-13").committed,
    0,
  );
  assert.equal(
    monthlyCommitments([e], [saved], [], "2026-10-13").months.at(-1).total,
    0,
  );
  assert.equal(removed.excluded_amount_cents, 30000);
  assert.equal(sound.amount_cents, 30000);
});
test("remoção: cachê removido não é recriado pela escala", () => {
  const cost = {
    id: "c",
    scale_id: musician.id,
    category: "musician",
    amount_cents: 45000,
  };
  const reopened = suggestedCosts(
    e,
    [excludeCost(cost)],
    [musician],
    standards,
    () => crypto.randomUUID(),
  );
  assert.equal(reopened.length, 1);
  assert.equal(reopened[0].excluded, true);
});
test("remoção: restaurar custo depende de ação explícita e recupera valor do evento", () => {
  const cost = {
    id: "s",
    category: "sonorização",
    amount_cents: 45000,
    default_cents: 30000,
  };
  const removed = excludeCost(cost);
  assert.deepEqual(excludeCost(removed), removed);
  assert.equal(restoreCost(removed).amount_cents, 45000);
  assert.equal(restoreCost(removed).excluded, undefined);
});
