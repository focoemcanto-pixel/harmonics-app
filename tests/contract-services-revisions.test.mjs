import test from "node:test";
import assert from "node:assert/strict";
import {
  getServiceSpecs,
  normalizeServiceSpecs,
  legacyServiceProjection,
  servicesText,
} from "../lib/contracts/service-specs.mjs";
import {
  revisionSnapshot,
  revisionDiff,
} from "../lib/contracts/revision-model.mjs";
import { buildContractTemplateData } from "../lib/contracts/buildContractTemplateData.js";
import { renderContractHtmlWithTemplateData } from "../lib/contracts/resolveContractHtmlSource.js";
import {
  prepareRevision,
  signRevision,
  validSignerCpf,
} from "../lib/contracts/revisions.js";
import { generateHtmlSha256 } from "../lib/contracts/premiumSignature.js";
const old = {
  id: "pre",
  workspace_id: "w",
  event_id: "event",
  contact_id: "contact",
  public_token: "same",
  event_date: "2027-10-20",
  formation: "Duo",
  instruments: "Voz, Teclado",
  duration_min: 60,
  agreed_amount: 1200,
};
const specs = [
  {
    id: "primary",
    kind: "primary",
    label: "Cerimônia",
    formation: "Trio",
    roles: ["Voz", "Violino", "Teclado"],
    duration_minutes: 60,
  },
  {
    id: "reception",
    kind: "reception",
    label: "Receptivo",
    formation: "Quarteto",
    roles: ["Voz", "Violino", "Cajón", "Violão"],
    duration_minutes: 120,
  },
];
test("A,C,G structured services normalize roles, duration and preserve distinct formations", () => {
  const normalized = normalizeServiceSpecs(specs);
  assert.equal(normalized[1].duration_minutes, 120);
  const projection = legacyServiceProjection(normalized);
  assert.equal(projection.formation, "Trio");
  assert.equal(projection.reception_formation, "Quarteto");
  assert.equal(projection.reception_hours, 2);
  assert.match(
    servicesText(normalized),
    /Receptivo: Quarteto · Voz, Violino, Cajón, Violão · 2h/,
  );
  const extra = normalizeServiceSpecs([
    ...specs,
    {
      id: "cocktail",
      label: "Coquetel",
      formation: "Solo",
      roles: ["Saxofone"],
      duration_minutes: 45,
    },
  ]);
  assert.equal(extra.length, 3);
});
test("D legacy contract reads without mutation; null opts into fallback and empty array intentionally means none", () => {
  const before = structuredClone(old);
  assert.equal(getServiceSpecs(old)[0].formation, "Duo");
  assert.deepEqual(old, before);
  assert.equal(getServiceSpecs({ ...old, service_specs: null }).length, 1);
  assert.equal(getServiceSpecs({ ...old, service_specs: [] }).length, 0);
  const data = buildContractTemplateData({ precontract: old });
  assert.equal(
    renderContractHtmlWithTemplateData("<p>{{formation}}</p>", data),
    "<p>Duo</p>",
  );
});
test("H template, custom content, new service placeholder and automatic legacy-template section agree", () => {
  const pre = revisionSnapshot(old, { service_specs: specs });
  const data = buildContractTemplateData({
    precontract: pre,
    event: { formation: "STALE", instruments: "STALE" },
  });
  assert.equal(data.formation, "Trio");
  assert.equal(data.reception_formation, "Quarteto");
  const html = renderContractHtmlWithTemplateData(
    "<p>{{formation}}</p><p>{{services_text}}</p>",
    data,
  );
  assert.match(html, /Voz, Violino, Cajón, Violão/);
  assert.doesNotMatch(html, /STALE/);
  assert.equal((html.match(/Receptivo:/g) || []).length, 1);
  const legacy = renderContractHtmlWithTemplateData(
    "<p>{{formation}}</p>",
    data,
  );
  assert.match(legacy, /data-contract-services/);
  assert.match(legacy, /2h/);
});
test("B,E,F revision draft preloads all data, preserves identities and does not mutate current signed terms", () => {
  const baseline = structuredClone(old);
  const after = revisionSnapshot(old, {
    id: "ATTACK",
    event_id: "DUPLICATE",
    contact_id: "DUPLICATE",
    public_token: "BAD",
    formation: "ignored",
    service_specs: specs,
    agreed_amount: 2000,
  });
  for (const key of ["id", "event_id", "contact_id", "public_token"])
    assert.equal(after[key], old[key]);
  assert.deepEqual(old, baseline);
  const diff = revisionDiff(old, after);
  assert.ok(
    diff.some(
      (d) =>
        d.field === "Cerimônia" &&
        d.before.includes("Duo") &&
        d.after.includes("Trio"),
    ),
  );
  assert.ok(
    diff.some((d) => d.field === "Receptivo" && d.before === "Não contratado"),
  );
  assert.ok(diff.some((d) => d.field === "Valor"));
});
test("invalid services, duplicate IDs, invalid amount, invalid CPF are rejected", () => {
  assert.throws(() =>
    normalizeServiceSpecs([{ label: "X", duration_minutes: -1 }]),
  );
  assert.throws(() =>
    normalizeServiceSpecs([
      { id: "x", label: "a" },
      { id: "x", label: "b" },
    ]),
  );
  assert.throws(() => revisionSnapshot(old, { agreed_amount: -1 }));
  assert.equal(validSignerCpf("11111111111"), false);
  assert.equal(validSignerCpf("52998224725"), true);
});
test("revision rendering freezes a sanitized individual source, reads no global template when personalized", async () => {
  const pre = { ...old, custom_contract_rich_html: "<p>{{formation}}</p>" };
  const supabase = {
    from() {
      throw new Error("unexpected template read");
    },
  };
  const prepared = await prepareRevision({
    supabase,
    precontract: pre,
    contract: {
      raw_payload: { client_form: { full_name: "Cliente fictício" } },
    },
    changes: { service_specs: specs },
    sourceHtml: "<script>alert(1)</script><p>{{formation}}</p>",
  });
  assert.match(prepared.html, /Trio/);
  assert.doesNotMatch(prepared.source, /script/);
  assert.match(prepared.html, /Quarteto/);
  assert.equal(pre.custom_contract_rich_html, "<p>{{formation}}</p>");
});
test("stale signature, missing acceptance and PDF error cannot promote a pending revision", async () => {
  let rpcCalls = 0;
  const supabase = {
    rpc() {
      rpcCalls++;
      throw Error("unexpected");
    },
  };
  const revision = {
    id: "r",
    status: "pending",
    preview_html: "<p>Frozen</p>",
    contract_id: "c",
    public_token: "abc",
    snapshot: old,
  };
  const headers = new Headers();
  const base = {
    signer_name: "Cliente fictício",
    signer_cpf: "52998224725",
    accepted_terms: true,
    content_hash: generateHtmlSha256(revision.preview_html),
  };
  await assert.rejects(
    signRevision({
      supabase,
      revision,
      form: { ...base, content_hash: "stale" },
      headers,
    }),
    /Conteúdo mudou/,
  );
  await assert.rejects(
    signRevision({
      supabase,
      revision,
      form: { ...base, accepted_terms: false },
      headers,
    }),
    /aceite/,
  );
  assert.equal(rpcCalls, 0);
});

test("PDF failure leaves active version untouched; success promotes only after unique storage upload; signed retries are idempotent", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.CONTRACT_SERVICE_URL;
  process.env.CONTRACT_SERVICE_URL = "https://pdf.test";
  const revision = {
    id: "r",
    workspace_id: "w",
    status: "pending",
    version: 2,
    preview_html: "<p>Trio</p>",
    contract_id: "c",
    public_token: "1234567890abcdef1234567890abcdef",
    snapshot: { ...old, service_specs: specs },
    client_form: {},
    changes: [],
  };
  const form = {
    signer_name: "Cliente QA",
    signer_cpf: "52998224725",
    accepted_terms: true,
    content_hash: generateHtmlSha256(revision.preview_html),
  };
  let called = 0,
    uploaded = false;
  const supabase = {
    storage: {
      from() {
        return {
          async upload(path, buffer, options) {
            assert.match(
              path,
              /workspaces\/w\/contracts\/c\/revisions\/r\/.*\.pdf/,
            );
            assert.equal(options.upsert, false);
            assert.ok(buffer.length);
            uploaded = true;
            return { error: null };
          },
          getPublicUrl() {
            return { data: { publicUrl: "https://storage.test/new.pdf" } };
          },
        };
      },
    },
    async rpc(name, args) {
      called++;
      assert.equal(name, "complete_contract_revision");
      assert.equal(uploaded, true);
      assert.match(args.p_signed_html, /Trio/);
      assert.equal(args.p_expected_html, revision.preview_html);
      assert.equal(revision.status, "pending");
      return {
        data: {
          ...revision,
          status: "signed",
          signed_html: args.p_signed_html,
          pdf_url: args.p_pdf_url,
        },
        error: null,
      };
    },
  };
  try {
    globalThis.fetch = async (url) =>
      String(url).includes("qrserver")
        ? new Response(new Uint8Array([1, 2, 3]), {
            headers: { "Content-Type": "image/png" },
          })
        : new Response("PDF unavailable", { status: 503 });
    await assert.rejects(
      signRevision({ supabase, revision, form, headers: new Headers() }),
      /PDF unavailable/,
    );
    assert.equal(called, 0);
    assert.equal(uploaded, false);
    assert.equal(revision.status, "pending");
    globalThis.fetch = async (url) =>
      String(url).includes("qrserver")
        ? new Response(new Uint8Array([1, 2, 3]), {
            headers: { "Content-Type": "image/png" },
          })
        : new Response("%PDF-1.4 fake unit-test bytes", {
            headers: { "Content-Type": "application/pdf" },
          });
    const result = await signRevision({
      supabase,
      revision,
      form,
      headers: new Headers(),
    });
    assert.equal(result.status, "signed");
    assert.equal(called, 1);
    const retry = await signRevision({
      supabase,
      revision: {
        ...revision,
        status: "signed",
        signed_html: "signed",
        pdf_url: "pdf",
      },
      form: {},
      headers: new Headers(),
    });
    assert.equal(retry.status, "signed");
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.CONTRACT_SERVICE_URL;
    else process.env.CONTRACT_SERVICE_URL = originalUrl;
  }
});

test("revised date/location overrides saved client form without reusing prior acceptance or signature date", async () => {
  const pre = {
    ...old,
    custom_contract_rich_html:
      "<p>{{DATA_EVENTO}} {{LOCAL_EVENTO}} {{ACEITE_DATAHORA}}</p>",
  };
  const contract = {
    signed_at: "2026-01-01T00:00:00Z",
    signature_ip: "old-ip",
    raw_payload: {
      client_form: {
        full_name: "Cliente QA",
        cpf: "52998224725",
        event_date: "2027-10-20",
        event_location_name: "Local antigo",
        accepted_terms: true,
        signed_at: "2026-01-01T00:00:00Z",
      },
    },
  };
  const prepared = await prepareRevision({
    supabase: {
      from() {
        throw Error("unexpected");
      },
    },
    contract,
    precontract: pre,
    changes: { event_date: "2027-11-21", location_name: "Local revisado" },
  });
  assert.match(prepared.html, /21\/11\/2027/);
  assert.match(prepared.html, /Local revisado/);
  assert.doesNotMatch(prepared.html, /2026-01-01|Local antigo/);
  assert.equal(prepared.snapshot.revision_client_form.cpf, "52998224725");
  assert.equal(prepared.snapshot.revision_client_form.accepted_terms, false);
  assert.equal(contract.raw_payload.client_form.accepted_terms, true);
  assert.throws(() => revisionSnapshot(old, { event_date: "2027-02-30" }));
});

test("admin revision endpoint rejects unauthenticated creation before reading contractual data", async () => {
  const { readFileSync } = await import("node:fs");
  let source = readFileSync(
    new URL("../app/api/contracts/[id]/revisions/route.js", import.meta.url),
    "utf8",
  )
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "")
    .replace(/export /g, "");
  let touched = false;
  const post = new Function(
    "NextResponse",
    "getSupabaseAdmin",
    "requireWorkspaceAdmin",
    "revisionContext",
    `${source};return POST;`,
  )(
    { json: (body, options) => Response.json(body, options) },
    () => ({}),
    async () => ({ ok: false, status: 401, error: "Sessão necessária" }),
    () => {
      touched = true;
    },
  );
  const result = await post(
    new Request("https://test/api/contracts/c/revisions", {
      method: "POST",
      body: "{}",
    }),
    { params: Promise.resolve({ id: "c" }) },
  );
  assert.equal(result.status, 401);
  assert.equal(touched, false);
});

test("P1 revisions keep signing-time source even if the global template or mutable precontract changed", async () => {
  const contract = {
    id: "c",
    workspace_id: "w",
    status: "signed",
    raw_payload: {
      contract_source_html: "<p>{{formation}}</p><p>Cláusula original</p>",
    },
  };
  const supabase = {
    from(table) {
      assert.equal(table, "contract_revisions");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          return { data: null, error: null };
        },
      };
    },
  };
  const prepared = await prepareRevision({
    supabase,
    contract,
    precontract: {
      ...old,
      custom_contract_rich_html: "<p>NOVA CLÁUSULA GLOBAL NÃO APROVADA</p>",
    },
    changes: { service_specs: specs },
  });
  assert.match(prepared.html, /Cláusula original/);
  assert.match(prepared.html, /Trio/);
  assert.doesNotMatch(prepared.html, /NOVA CLÁUSULA/);
  assert.equal(prepared.sourceMode, "frozen_source");
});

test("P1 legacy without editable source uses executed text, strips prior certificate, never uses latest template", async () => {
  const contract = {
    id: "c",
    workspace_id: "w",
    status: "signed",
    signed_html:
      '<p>Duo · Cláusula original</p><section class="signature-certificate"><p>ASSINATURA ANTERIOR</p></section>',
    raw_payload: {},
  };
  const supabase = {
    from(table) {
      assert.equal(table, "contract_revisions");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          return { data: null, error: null };
        },
      };
    },
  };
  const prepared = await prepareRevision({
    supabase,
    contract,
    precontract: { ...old, custom_contract_rich_html: "TEMPLATE NOVO" },
    changes: { service_specs: specs },
    sourceHtml: "<p>Trio · Cláusula original</p>",
  });
  assert.equal(prepared.sourceMode, "legacy_rendered");
  assert.match(prepared.html, /Cláusula original/);
  assert.doesNotMatch(prepared.html, /ASSINATURA ANTERIOR|TEMPLATE NOVO/);
  assert.ok(
    prepared.changes.some((x) => x.field === "Cláusulas personalizadas"),
  );
});

test("P2 legacy GAS failures still fall back to the internal PDF preview", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../app/api/contracts/preview/[token]/route.js", import.meta.url),
    "utf8",
  )
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "")
    .replace(/export /g, "");
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "HARMONICS_CONTRATO_GAS_EXEC_URL",
  ];
  const prior = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  const originalFetch = globalThis.fetch;
  let internalUsed = false;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-not-a-secret";
    process.env.HARMONICS_CONTRATO_GAS_EXEC_URL = "https://gas.test";
    globalThis.fetch = async () =>
      new Response("upstream unavailable", { status: 502 });
    const client = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return {
              data: {
                id: "pre",
                contract_mode: "docs",
                custom_contract_enabled: false,
                service_specs: null,
              },
              error: null,
            };
          },
        };
      },
    };
    const get = new Function(
      "NextResponse",
      "createClient",
      "generateContractDocument",
      "generatePdfBufferFromHtml",
      `${source};return GET;`,
    )(
      Response,
      () => client,
      async () => {
        internalUsed = true;
        return { ok: true, html: "<p>Contract</p>", ids: { contractId: "c" } };
      },
      async () => Buffer.from("%PDF-1.4 fallback"),
    );
    const result = await get(null, {
      params: Promise.resolve({ token: "legacy-token" }),
    });
    assert.equal(result.status, 200);
    assert.equal(internalUsed, true);
    assert.equal(result.headers.get("Content-Type"), "application/pdf");
  } finally {
    globalThis.fetch = originalFetch;
    for (const k of names) {
      if (prior[k] === undefined) delete process.env[k];
      else process.env[k] = prior[k];
    }
  }
});

test('P2 revision form loads signed terms rather than a precontract mutated after signing',async()=>{
 const {revisionContext}=await import('../lib/contracts/revisions.js');
 const signedPre={...old,client_name:'Original signed client'};
 const contract={id:'c',workspace_id:'w',precontract_id:old.id,status:'signed',raw_payload:{precontract_snapshot:signedPre,client_form:{full_name:'Original signed client',event_date:old.event_date}}};
 const mutable={...old,client_name:'MUTATED',formation:'Quinteto',event_date:'2029-01-01'};
 const client={from(table){return{select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},async single(){return{data:table==='contracts'?contract:mutable,error:null};},async maybeSingle(){return{data:null,error:null};}};}};
 const result=await revisionContext(client,'c','w');assert.equal(result.precontract.formation,'Duo');assert.equal(result.precontract.event_date,'2027-10-20');assert.equal(result.precontract.client_name,'Original signed client');assert.equal(result.precontract.event_id,old.event_id);
});
