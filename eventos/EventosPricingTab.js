'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Field, Input } from './EventFormPrimitives';

export default function EventosPricingTab({
  pricing,
  setPricing,
  salvarPricing,
  salvando,
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <AdminSectionTitle
        title="Preços automáticos"
        subtitle="Configure formações, som e receptivo para preencher os eventos automaticamente."
      />

      <div className="grid grid-cols-1 gap-5">
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-700">
            Formações e som
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Solo">
              <Input
                value={pricing.price_solo}
                onChange={(e) =>
                  setPricing({ ...pricing, price_solo: e.target.value })
                }
              />
            </Field>

            <Field label="Duo">
              <Input
                value={pricing.price_duo}
                onChange={(e) =>
                  setPricing({ ...pricing, price_duo: e.target.value })
                }
              />
            </Field>

            <Field label="Trio">
              <Input
                value={pricing.price_trio}
                onChange={(e) =>
                  setPricing({ ...pricing, price_trio: e.target.value })
                }
              />
            </Field>

            <Field label="Quarteto">
              <Input
                value={pricing.price_quarteto}
                onChange={(e) =>
                  setPricing({ ...pricing, price_quarteto: e.target.value })
                }
              />
            </Field>

            <Field label="Quinteto">
              <Input
                value={pricing.price_quinteto}
                onChange={(e) =>
                  setPricing({ ...pricing, price_quinteto: e.target.value })
                }
              />
            </Field>

            <Field label="Sexteto">
              <Input
                value={pricing.price_sexteto}
                onChange={(e) =>
                  setPricing({ ...pricing, price_sexteto: e.target.value })
                }
              />
            </Field>

            <Field label="Septeto">
              <Input
                value={pricing.price_septeto}
                onChange={(e) =>
                  setPricing({ ...pricing, price_septeto: e.target.value })
                }
              />
            </Field>

            <Field label="Som">
              <Input
                value={pricing.sound_price}
                onChange={(e) =>
                  setPricing({ ...pricing, sound_price: e.target.value })
                }
              />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-700">
            Receptivo
          </p>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Formação
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    1h
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    2h
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    3h
                  </th>
                </tr>
              </thead>

              <tbody>
                {[
                  ['Duo', 'reception_duo_1h', 'reception_duo_2h', 'reception_duo_3h'],
                  ['Trio', 'reception_trio_1h', 'reception_trio_2h', 'reception_trio_3h'],
                  ['Quarteto', 'reception_quarteto_1h', 'reception_quarteto_2h', 'reception_quarteto_3h'],
                  ['Quinteto', 'reception_quinteto_1h', 'reception_quinteto_2h', 'reception_quinteto_3h'],
                  ['Sexteto', 'reception_sexteto_1h', 'reception_sexteto_2h', 'reception_sexteto_3h'],
                  ['Septeto', 'reception_septeto_1h', 'reception_septeto_2h', 'reception_septeto_3h'],
                ].map(([nome, k1, k2, k3]) => (
                  <tr key={nome} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {nome}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-violet-500"
                        value={pricing[k1]}
                        onChange={(e) =>
                          setPricing({ ...pricing, [k1]: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-violet-500"
                        value={pricing[k2]}
                        onChange={(e) =>
                          setPricing({ ...pricing, [k2]: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-violet-500"
                        value={pricing[k3]}
                        onChange={(e) =>
                          setPricing({ ...pricing, [k3]: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={salvarPricing}
            disabled={salvando}
            className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar preços automáticos'}
          </button>
        </div>
      </div>
    </section>
  );
}