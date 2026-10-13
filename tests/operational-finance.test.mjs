import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  today,
  eventSummary,
  dashboard,
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
    [],
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
    suggestedCosts(e, [], [musician], ds, () => "id")[0].amount_cents,
    50000,
  );
  assert.equal(
    suggestedCosts(e, [], [musician], ds.slice(0, -1), () => "id")[0]
      .amount_cents,
    40000,
  );
});
test("prefill: padrão zero específico não herda valor geral", () =>
  assert.equal(
    suggestedCosts(
      e,
      [],
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
    suggestedCosts(e, [], [musician], standards, () => "id").length,
    1,
  ));
test("prefill: reabrir a ficha não duplica os custos padrão", () => {
  const event = { ...e, has_sound: true, has_transport: true };
  const c = suggestedCosts(event, [], [musician], standards, () => "id");
  assert.equal(
    suggestedCosts(event, c, [musician], standards, () => "id").length,
    3,
  );
});
