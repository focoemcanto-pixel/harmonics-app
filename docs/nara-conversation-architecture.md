# Nara conversational commerce

## Findings

The previous simulator and WhatsApp service had different decision trees. Simulator branches could return canned responses without invoking the model and reported nominal tool names in those branches. WhatsApp could replace the generated response with another formation offer or a regional-pricing deferral. The system prompt simultaneously required date/local before an initial quote and allowed city-only pricing. Short replies were interpreted by keyword/regex rules rather than the preceding offer. A venue/city correction did not invalidate derived address/quote memory. Human-transfer tools previously returned success before durable work was recorded.

## Implementation

Both surfaces now use `runCommercialTurn`. The existing model performs a semantic `conduzir_atendimento` function call, supplying intent, newly confirmed facts and the next useful action. The server applies memory first and then executes domain tools. There is no separate intent-classification model. The existing bounded function-call loop remains limited to four tool rounds and the existing model, output-token cap and workspace spend limits remain unchanged.

Corrections replace facts and invalidate stale address/quote information. City-only changes do not inherit the previous venue. Only customer fields can be supplied by the model; the last calculated quote cannot be written by a customer-memory tool. A negative sound preference is preserved.

Tool outputs are projected through a commercial allowlist. Raw error codes, administrative guidance and internal cost/margin objects do not reach the conversation model. Initial prices use approved regional rules; exact price blocks are rendered by code with the model's contextual introduction. Closing requires the missing mandatory facts, including the precise address. Contract approval, ownership claims, kill switches and outbox safeguards remain in force.

Unsupported regional pricing registers a deduplicated review request. Human transfer requires a successful durable approval record before reporting success. The structured reply declares whether it claims a registered or simulated action; unmatched claims fail closed. A request registered in the panel is not represented as an external notification.

The simulator uses the same prompt, semantic turn and domain tools, backed by an in-memory store with no network or production-write capability. Only approved commercial reference tables are loaded. All action receipts are explicitly simulated. No client/contact/event data are loaded for simulation. Free public venue lookup remains available; no new paid search is enabled.

## Validation

145 focused AI, memory, geographical and conversation tests passed locally. New multi-turn tests run the real Responses function-call loop with a scripted synthetic transport and real domain executors. They validate correction-before-pricing, consent execution, waiting without fabricated work, precise closing prerequisites, public tool projections, handoff failure and simulation isolation. These tests verify code contracts; they do not claim to measure a live model's semantic accuracy. Live-model preview and production checks must be recorded separately.

## Models and cost

Production remains `gpt-4.1-mini`. Published standard token prices per million tokens, checked on 2026-11-10:

| Model | Input USD | Output USD | Assessment |
| --- | ---: | ---: | --- |
| gpt-4.1-mini | 0.40 | 1.60 | Current low-latency baseline; architecture defects must be removed before attributing failures to model capacity. |
| gpt-4.1 | 2.00 | 8.00 | Candidate for a controlled quality comparison; five times the baseline token rates. No production switch. |
| gpt-5.4-mini | 0.75 | 4.50 | More recent candidate with configurable reasoning. Requires model-specific request options and live latency/quality evaluation; no production switch. |

Sources: https://developers.openai.com/api/docs/models/gpt-4.1-mini , https://developers.openai.com/api/docs/models/gpt-4.1 , https://developers.openai.com/api/docs/models/gpt-5.4-mini . No numeric latency comparison is asserted without a controlled benchmark. The semantic tool changes per-turn token usage; preserving model and spend ceilings does not guarantee identical per-turn cost. The simulator exposes actual token/cost estimates for review. Search lookup and provider charges are distinct from model-token estimates.

## Outstanding business input

An approved regional price rule is required before numbers can be quoted for any unpriced city. Do not infer or copy a base-city tariff. This implementation intentionally does not invent regional prices, change the production model, enable paid search, or alter spending ceilings.
