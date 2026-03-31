'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Badge from '../../../components/ui/Badge';

const CONTRACT_TEMPLATE_DOC_ID = '1dUmmVKIR6S31A_-mTyeN0X5H7XdfHk-DExtC8oT0D7A';
const CONTRACTS_DRIVE_FOLDER_ID = '1W_pv5Do3uj3riMK41OcWnGBqHTx1fv45';

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function maskPhone(value) {
  const digits = cleanDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCpf(value) {
  const digits = cleanDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function maskCep(value) {
  const digits = cleanDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function maskDate(value) {
  const digits = cleanDigits(value).slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskTime(value) {
  const digits = cleanDigits(value).slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function convertDateToInput(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);

  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return String(value);

  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function convertDateToBr(value) {
  if (!value) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(value))) return String(value);

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);

  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}

function isValidCpf(value) {
  const cpf = cleanDigits(value);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }

  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10) firstDigit = 0;
  if (firstDigit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }

  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10) secondDigit = 0;

  return secondDigit === Number(cpf[10]);
}

function isValidPhone(value) {
  const digits = cleanDigits(value);
  return digits.length >= 10 && digits.length <= 11;
}

function isValidCep(value) {
  return cleanDigits(value).length === 8;
}

function isValidDateBr(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(value || ''))) return false;

  const [dd, mm, yyyy] = String(value).split('/').map(Number);
  const date = new Date(yyyy, mm - 1, dd);

  return (
    date.getFullYear() === yyyy &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd
  );
}

function isValidTime(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return false;

  const [hh, mm] = String(value).split(':').map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function getAddressComponent(components, type) {
  if (!Array.isArray(components)) return '';
  const found = components.find(
    (item) => Array.isArray(item.types) && item.types.includes(type)
  );
  return found?.long_name || '';
}

function getAddressComponentShort(components, type) {
  if (!Array.isArray(components)) return '';
  const found = components.find(
    (item) => Array.isArray(item.types) && item.types.includes(type)
  );
  return found?.short_name || found?.long_name || '';
}

function extractAddressDataFromPlace(place) {
  const components = place?.address_components || [];

  const neighborhood =
    getAddressComponent(components, 'sublocality_level_1') ||
    getAddressComponent(components, 'sublocality') ||
    getAddressComponent(components, 'neighborhood');

  const city =
    getAddressComponent(components, 'administrative_area_level_2') ||
    getAddressComponent(components, 'locality');

  const state = getAddressComponentShort(
    components,
    'administrative_area_level_1'
  );

  const cep = maskCep(getAddressComponent(components, 'postal_code'));

  return {
    formattedAddress: place?.formatted_address || '',
    neighborhood: neighborhood || '',
    city: city || '',
    state: state || '',
    cep: cep || '',
  };
}

function getInitialForm() {
  return {
    full_name: '',
    marital_status: '',
    profession: '',
    cpf: '',
    rg: '',
    whatsapp: '',

    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_cep: '',
    address_city: '',
    address_state: '',

    event_date: '',
    event_time: '',
    event_location_name: '',
    event_location_address: '',

    adjustment_request: '',

    signer_name: '',
    signer_cpf: '',
    accepted_terms: false,
  };
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value || '-'}
      </p>
    </div>
  );
}

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-slate-900">{children}</h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

function FieldFeedback({ error, success }) {
  if (error) {
    return <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>;
  }

  if (success) {
    return <p className="mt-2 text-xs font-semibold text-emerald-600">{success}</p>;
  }

  return null;
}

function getInputTone(error, success) {
  if (error) {
    return 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100';
  }

  if (success) {
    return 'border-emerald-300 bg-emerald-50 focus:border-emerald-400 focus:ring-emerald-100';
  }

  return '';
}

async function upsertContactFromSignature({
  supabase,
  precontract,
  form,
}) {
  const email = String(precontract?.client_email || '').trim() || null;
  const phone = cleanDigits(form.whatsapp) || null;
  const name = String(form.full_name || '').trim();

  let existing = null;

  if (email) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    existing = data || null;
  }

  if (!existing && phone) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    existing = data || null;
  }

  const payload = {
    name: name || null,
    email,
    phone,
    tag: 'cliente',
    notes: [
      'Criado/atualizado automaticamente após assinatura.',
      precontract?.event_type ? `Tipo: ${precontract.event_type}` : '',
      precontract?.formation ? `Formação: ${precontract.formation}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
    is_active: true,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from('contacts')
      .update(payload)
      .eq('id', existing.id);

    if (error) throw error;

    return existing.id;
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert([payload])
    .select('id')
    .single();

  if (error) throw error;

  return data.id;
}

async function upsertEventFromSignature({
  supabase,
  precontract,
  contactId,
  form,
}) {
  let existing = null;

  const legacyId = String(precontract?.legacy_id || '').trim();
  if (legacyId) {
    const { data } = await supabase
      .from('events')
      .select('id')
      .eq('legacy_id', legacyId)
      .maybeSingle();

    existing = data || null;
  }

  const payload = {
    client_contact_id: contactId || null,
    client_name: String(form.full_name || precontract?.client_name || '').trim() || null,

    event_type: precontract?.event_type || null,
    event_date: convertDateToInput(form.event_date) || precontract?.event_date || null,
    event_time: form.event_time || precontract?.event_time || null,
    duration_min: Number(precontract?.duration_min || 60),

    location_name:
      String(form.event_location_name || precontract?.location_name || '').trim() || null,
    location_address:
      String(form.event_location_address || precontract?.location_address || '').trim() || null,

    formation: precontract?.formation || null,
    instruments: precontract?.instruments || null,

    has_sound: !!precontract?.has_sound,
    reception_hours: Number(precontract?.reception_hours || 0),
    has_transport: !!precontract?.has_transport,

    transport_cost: Number(precontract?.add_transport || 0),
    base_amount: Number(precontract?.base_amount || 0),

    agreed_amount: Number(precontract?.agreed_amount || 0),
    gross_amount: Number(precontract?.agreed_amount || 0),
    net_amount: Number(precontract?.agreed_amount || 0),

    whatsapp_name: String(form.full_name || '').trim() || null,
    whatsapp_phone: cleanDigits(form.whatsapp) || null,

    observations: String(form.adjustment_request || '').trim() || null,
    notes: [
      'Criado/atualizado automaticamente após assinatura.',
      precontract?.notes || '',
    ]
      .filter(Boolean)
      .join('\n\n'),

    status: 'Confirmado',
    legacy_id: legacyId || null,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', existing.id);

    if (error) throw error;

    return existing.id;
  }

  const { data, error } = await supabase
    .from('events')
    .insert([payload])
    .select('id')
    .single();

  if (error) throw error;

  return data.id;
}

export default function ContratoPublicoPage() {
  const params = useParams();
  const token = params?.token;
  const [previewAberto, setPreviewAberto] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [precontract, setPrecontract] = useState(null);
  const [contract, setContract] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [solicitandoAjuste, setSolicitandoAjuste] = useState(false);

  const [form, setForm] = useState(getInitialForm());
  const [resultadoFinal, setResultadoFinal] = useState({
    pdfUrl: '',
    docUrl: '',
    clientPanelUrl: '',
  });

  const addressStreetRef = useRef(null);
  const eventAddressRef = useRef(null);

  const [mapsApiKey, setMapsApiKey] = useState('');
  const [mapsReady, setMapsReady] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [addressValidation, setAddressValidation] = useState({
    clientAddressConfirmed: false,
    eventAddressConfirmed: false,
  });

  function abrirPreviewContrato() {
    if (!token) {
      alert('Token do contrato não encontrado.');
      return;
    }

    setPreviewError('');
    setPreviewLoading(true);
    setPreviewAberto(true);
  }

  useEffect(() => {
    let mounted = true;

    async function loadMapsKey() {
      try {
        const response = await fetch('/api/google/maps-key', {
          cache: 'no-store',
        });

        const json = await response.json();

        if (!mounted) return;

        setMapsApiKey(String(json?.apiKey || ''));
      } catch (error) {
        console.error('Erro ao carregar chave do Google Maps:', error);
      }
    }

    loadMapsKey();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function carregar() {
      if (!token) return;

      try {
        setCarregando(true);

        const { data: preData, error: preError } = await supabase
          .from('precontracts')
          .select('*')
          .eq('public_token', token)
          .single();

        if (preError) throw preError;
        setPrecontract(preData || null);

        if (preData?.id) {
          const { data: contractData, error: contractError } = await supabase
            .from('contracts')
            .select('*')
            .eq('precontract_id', preData.id)
            .maybeSingle();

          if (contractError) throw contractError;
          setContract(contractData || null);

          const saved = contractData?.raw_payload?.client_form || {};

          setForm({
            full_name: saved.full_name || preData.client_name || '',
            marital_status: saved.marital_status || '',
            profession: saved.profession || '',
            cpf: saved.cpf ? maskCpf(saved.cpf) : '',
            rg: saved.rg || '',
            whatsapp: saved.whatsapp ? maskPhone(saved.whatsapp) : '',

            address_street: saved.address_street || '',
            address_number: saved.address_number || '',
            address_complement: saved.address_complement || '',
            address_neighborhood: saved.address_neighborhood || '',
            address_cep: saved.address_cep ? maskCep(saved.address_cep) : '',
            address_city: saved.address_city || '',
            address_state: saved.address_state || '',

            event_date: convertDateToBr(saved.event_date || preData.event_date || ''),
            event_time: saved.event_time || preData.event_time || '',
            event_location_name: saved.event_location_name || preData.location_name || '',
            event_location_address:
              saved.event_location_address || preData.location_address || '',

            adjustment_request: saved.adjustment_request || '',

            signer_name: saved.signer_name || '',
            signer_cpf: saved.signer_cpf ? maskCpf(saved.signer_cpf) : '',
            accepted_terms: !!saved.accepted_terms,
          });

          setAddressValidation({
            clientAddressConfirmed: !!saved.address_street,
            eventAddressConfirmed: !!saved.event_location_address,
          });
        }

        if (preData?.status === 'link_generated') {
          await supabase
            .from('precontracts')
            .update({ status: 'client_filling' })
            .eq('id', preData.id);

          setPrecontract((prev) =>
            prev ? { ...prev, status: 'client_filling' } : prev
          );
        }
      } catch (error) {
        console.error('Erro ao carregar contrato público:', error);
        setPrecontract(null);
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [token]);
    useEffect(() => {
    if (!mapsReady) return;
    if (typeof window === 'undefined') return;
    if (!window.google?.maps?.places) return;

    let clientAutocomplete = null;
    let eventAutocomplete = null;

    if (addressStreetRef.current) {
      clientAutocomplete = new window.google.maps.places.Autocomplete(
        addressStreetRef.current,
        {
          componentRestrictions: { country: 'br' },
          fields: ['formatted_address', 'address_components'],
          types: ['address'],
        }
      );

      clientAutocomplete.addListener('place_changed', () => {
        const place = clientAutocomplete.getPlace();
        const data = extractAddressDataFromPlace(place);

        setForm((prev) => ({
          ...prev,
          address_street: data.formattedAddress || prev.address_street,
          address_neighborhood: data.neighborhood || prev.address_neighborhood,
          address_cep: data.cep || prev.address_cep,
          address_city: data.city || prev.address_city,
          address_state: data.state || prev.address_state,
        }));

        setAddressValidation((prev) => ({
          ...prev,
          clientAddressConfirmed: !!data.formattedAddress,
        }));

        setFieldErrors((prev) => ({
          ...prev,
          address_street: '',
          address_neighborhood: '',
          address_cep: '',
          address_city: '',
          address_state: '',
        }));
      });
    }

    if (eventAddressRef.current) {
      eventAutocomplete = new window.google.maps.places.Autocomplete(
        eventAddressRef.current,
        {
          componentRestrictions: { country: 'br' },
          fields: ['formatted_address'],
          types: ['address'],
        }
      );

      eventAutocomplete.addListener('place_changed', () => {
        const place = eventAutocomplete.getPlace();
        const formattedAddress = place?.formatted_address || '';

        setForm((prev) => ({
          ...prev,
          event_location_address:
            formattedAddress || prev.event_location_address,
        }));

        setAddressValidation((prev) => ({
          ...prev,
          eventAddressConfirmed: !!formattedAddress,
        }));

        setFieldErrors((prev) => ({
          ...prev,
          event_location_address: '',
        }));
      });
    }

    return () => {
      if (clientAutocomplete) {
        window.google.maps.event.clearInstanceListeners(clientAutocomplete);
      }
      if (eventAutocomplete) {
        window.google.maps.event.clearInstanceListeners(eventAutocomplete);
      }
    };
  }, [mapsReady]);

  function handleChange(field, value) {
    let nextValue = value;

    if (field === 'cpf' || field === 'signer_cpf') {
      nextValue = maskCpf(value);
    }

    if (field === 'whatsapp') {
      nextValue = maskPhone(value);
    }

    if (field === 'address_cep') {
      nextValue = maskCep(value);
    }

    if (field === 'event_date') {
      nextValue = maskDate(value);
    }

    if (field === 'event_time') {
      nextValue = maskTime(value);
    }

    setForm((prev) => ({
      ...prev,
      [field]: nextValue,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [field]: '',
    }));

    if (field === 'address_street') {
      setAddressValidation((prev) => ({
        ...prev,
        clientAddressConfirmed: false,
      }));
    }

    if (field === 'event_location_address') {
      setAddressValidation((prev) => ({
        ...prev,
        eventAddressConfirmed: false,
      }));
    }
  }

  const resumo = useMemo(() => {
    if (!precontract) return null;

    return {
      clientName: precontract.client_name || '',
      eventType: precontract.event_type || '',
      eventDate: precontract.event_date || '',
      eventTime: precontract.event_time || '',
      formation: precontract.formation || '',
      instruments: precontract.instruments || '',
      locationName: precontract.location_name || '',
      locationAddress: precontract.location_address || '',
      receptionHours: precontract.reception_hours || 0,
      hasSound: !!precontract.has_sound,
      hasTransport: !!precontract.has_transport,
      agreedAmount: precontract.agreed_amount || 0,
      notes: precontract.notes || '',
      status: precontract.status || 'draft',
    };
  }, [precontract]);

  const contratoFinalizado =
    contract?.status === 'signed' ||
    precontract?.status === 'signed';

  function validateFormFields() {
    const errors = {};

    if (!form.full_name.trim()) errors.full_name = 'Informe o nome completo.';
    if (!form.marital_status.trim()) errors.marital_status = 'Informe o estado civil.';
    if (!form.profession.trim()) errors.profession = 'Informe a profissão.';
    if (!form.rg.trim()) errors.rg = 'Informe o RG.';

    if (!form.cpf.trim()) {
      errors.cpf = 'Informe o CPF.';
    } else if (!isValidCpf(form.cpf)) {
      errors.cpf = 'CPF inválido.';
    }

    if (!form.whatsapp.trim()) {
      errors.whatsapp = 'Informe o WhatsApp.';
    } else if (!isValidPhone(form.whatsapp)) {
      errors.whatsapp = 'WhatsApp inválido.';
    }

    if (!form.address_street.trim()) {
      errors.address_street = 'Informe o endereço.';
    }

    if (!form.address_neighborhood.trim()) {
      errors.address_neighborhood = 'Informe o bairro.';
    }

    if (!form.address_cep.trim()) {
      errors.address_cep = 'Informe o CEP.';
    } else if (!isValidCep(form.address_cep)) {
      errors.address_cep = 'CEP inválido.';
    }

    if (!form.address_city.trim()) {
      errors.address_city = 'Informe a cidade.';
    }

    if (!form.address_state.trim()) {
      errors.address_state = 'Informe o estado.';
    }

    if (!form.event_date.trim()) {
      errors.event_date = 'Informe a data do evento.';
    } else if (!isValidDateBr(form.event_date)) {
      errors.event_date = 'Data inválida.';
    }

    if (!form.event_time.trim()) {
      errors.event_time = 'Informe o horário do evento.';
    } else if (!isValidTime(form.event_time)) {
      errors.event_time = 'Horário inválido.';
    }

    if (!form.event_location_name.trim()) {
      errors.event_location_name = 'Informe o nome do local.';
    }

    if (!form.event_location_address.trim()) {
      errors.event_location_address = 'Informe o endereço do evento.';
    }

    if (!addressValidation.clientAddressConfirmed) {
      errors.address_street =
        errors.address_street || 'Selecione um endereço válido nas sugestões do Google.';
    }

    if (!addressValidation.eventAddressConfirmed) {
      errors.event_location_address =
        errors.event_location_address ||
        'Selecione um endereço válido do evento nas sugestões do Google.';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstMessage = Object.values(errors)[0];
      alert(firstMessage);
      return false;
    }

    return true;
  }

  function validateMainFields() {
    return validateFormFields();
  }

  async function upsertContract(statusOverride = 'client_filling') {
    if (!precontract?.id) throw new Error('Pré-contrato não encontrado.');

    const assinaturaEm = new Date().toISOString();

    const clientForm = {
      full_name: form.full_name.trim() || null,
      marital_status: form.marital_status.trim() || null,
      profession: form.profession.trim() || null,
      cpf: cleanDigits(form.cpf) || null,
      rg: form.rg.trim() || null,
      whatsapp: cleanDigits(form.whatsapp) || null,

      address_street: form.address_street.trim() || null,
      address_number: form.address_number.trim() || null,
      address_complement: form.address_complement.trim() || null,
      address_neighborhood: form.address_neighborhood.trim() || null,
      address_cep: cleanDigits(form.address_cep) || null,
      address_city: form.address_city.trim() || null,
      address_state: form.address_state.trim() || null,

      event_date: convertDateToInput(form.event_date) || null,
      event_time: form.event_time || null,
      event_location_name: form.event_location_name.trim() || null,
      event_location_address: form.event_location_address.trim() || null,

      adjustment_request: form.adjustment_request.trim() || null,

      signer_name: form.signer_name.trim() || null,
      signer_cpf: cleanDigits(form.signer_cpf) || null,
      accepted_terms: !!form.accepted_terms,
      signed_at: statusOverride === 'signed' ? assinaturaEm : null,
    };

    const contractPayload = {
      precontract_id: precontract.id,
      public_token: precontract.public_token || token,
      status: statusOverride,
      signed_at: statusOverride === 'signed' ? assinaturaEm : null,
      signature_name:
        statusOverride === 'signed' ? form.signer_name.trim() || null : null,
      raw_payload: {
        precontract_snapshot: precontract,
        client_form: clientForm,
        contract_template_doc_id: CONTRACT_TEMPLATE_DOC_ID,
        contracts_drive_folder_id: CONTRACTS_DRIVE_FOLDER_ID,
      },
    };

    const { data: existingContract, error: existingError } = await supabase
      .from('contracts')
      .select('id')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingContract?.id) {
      const { error } = await supabase
        .from('contracts')
        .update(contractPayload)
        .eq('id', existingContract.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('contracts')
        .insert([contractPayload]);

      if (error) throw error;
    }
  }

  async function solicitarAjuste() {
    if (!validateMainFields()) return;

    if (!form.adjustment_request.trim()) {
      alert('Descreva o ajuste que deseja solicitar.');
      return;
    }

    if (!precontract?.id) {
      alert('Pré-contrato não encontrado.');
      return;
    }

    try {
      setSolicitandoAjuste(true);

      await upsertContract('client_filling');

      const contactId = await upsertContactFromSignature({
        supabase,
        precontract,
        form,
      });

      const eventId = await upsertEventFromSignature({
        supabase,
        precontract,
        contactId,
        form,
      });

      const { data: contractRow } = await supabase
        .from('contracts')
        .select('id')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractRow?.id) {
        const { error: contractLinkError } = await supabase
          .from('contracts')
          .update({
            contact_id: contactId,
            event_id: eventId,
          })
          .eq('id', contractRow.id);

        if (contractLinkError) throw contractLinkError;
      }

      const { error: precontractLinkError } = await supabase
        .from('precontracts')
        .update({
          contact_id: contactId,
          event_id: eventId,
        })
        .eq('id', precontract.id);

      if (precontractLinkError) throw precontractLinkError;

      const notesAtualizadas = [
        precontract.notes || '',
        '',
        '--- SOLICITAÇÃO DE AJUSTE DO CLIENTE ---',
        form.adjustment_request.trim(),
      ]
        .filter(Boolean)
        .join('\n');

      const { error } = await supabase
        .from('precontracts')
        .update({
          status: 'client_filling',
          client_name: form.full_name.trim() || precontract.client_name || null,
          client_email: precontract.client_email || null,
          client_phone: cleanDigits(form.whatsapp) || precontract.client_phone || null,
          event_date: convertDateToInput(form.event_date) || precontract.event_date || null,
          event_time: form.event_time || precontract.event_time || null,
          location_name: form.event_location_name.trim() || precontract.location_name || null,
          location_address:
            form.event_location_address.trim() || precontract.location_address || null,
          notes: notesAtualizadas,
        })
        .eq('id', precontract.id);

      if (error) throw error;

      alert('Seu ajuste foi enviado com sucesso.');
    } catch (error) {
      console.error('Erro ao solicitar ajuste:', error);
      alert(`Erro ao solicitar ajuste: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setSolicitandoAjuste(false);
    }
  }

  async function assinarContrato() {
    if (!validateMainFields()) return;

    if (!form.signer_name.trim()) {
      alert('Digite seu nome na assinatura.');
      return;
    }

    if (!form.signer_cpf.trim()) {
      alert('Digite o CPF da assinatura.');
      return;
    }

    if (!isValidCpf(form.signer_cpf)) {
      alert('CPF da assinatura inválido.');
      return;
    }

    if (!form.accepted_terms) {
      alert('Você precisa aceitar os termos para continuar.');
      return;
    }

    if (!precontract?.id) {
      alert('Pré-contrato não encontrado.');
      return;
    }

    try {
      setSalvando(true);

      await upsertContract('signed');

      const contactId = await upsertContactFromSignature({
        supabase,
        precontract,
        form,
      });

      const eventId = await upsertEventFromSignature({
        supabase,
        precontract,
        contactId,
        form,
      });

      const { data: contractRow, error: contractRowError } = await supabase
        .from('contracts')
        .select('id')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractRowError) throw contractRowError;

      if (contractRow?.id) {
        const { error: contractLinkError } = await supabase
          .from('contracts')
          .update({
            contact_id: contactId,
            event_id: eventId,
          })
          .eq('id', contractRow.id);

        if (contractLinkError) throw contractLinkError;
      }

      const { error: preError } = await supabase
        .from('precontracts')
        .update({
          contact_id: contactId,
          event_id: eventId,
        })
        .eq('id', precontract.id);

      if (preError) throw preError;
            const generateRes = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precontractId: precontract.id,
        }),
      });

      const generateJson = await generateRes.json();

      if (!generateJson?.ok) {
        throw new Error(generateJson?.message || 'Erro ao gerar contrato final.');
      }

      const { data: contractAtualizado, error: contractReloadError } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractReloadError) throw contractReloadError;

      setContract(contractAtualizado || null);

      const pdfUrlFinal =
        contractAtualizado?.pdf_url ||
        generateJson?.pdfUrl ||
        '';

      const docUrlFinal =
        contractAtualizado?.doc_url ||
        generateJson?.docUrl ||
        '';

      setResultadoFinal({
        pdfUrl: pdfUrlFinal,
        docUrl: docUrlFinal,
        clientPanelUrl: `${window.location.origin}/cliente/${token}`,
      });

      const notesAtualizadas = [
        precontract.notes || '',
        '',
        '--- DADOS FINAIS ENVIADOS PELO CLIENTE ---',
        `Nome completo: ${form.full_name || '-'}`,
        `Estado civil: ${form.marital_status || '-'}`,
        `Profissão: ${form.profession || '-'}`,
        `CPF: ${form.cpf || '-'}`,
        `RG: ${form.rg || '-'}`,
        `WhatsApp: ${form.whatsapp || '-'}`,
        `Rua: ${form.address_street || '-'}`,
        `Número: ${form.address_number || '-'}`,
        `Complemento: ${form.address_complement || '-'}`,
        `Bairro: ${form.address_neighborhood || '-'}`,
        `CEP: ${form.address_cep || '-'}`,
        `Cidade: ${form.address_city || '-'}`,
        `Estado: ${form.address_state || '-'}`,
        `Data do evento: ${form.event_date || '-'}`,
        `Horário do evento: ${form.event_time || '-'}`,
        `Local do evento: ${form.event_location_name || '-'}`,
        `Endereço do evento: ${form.event_location_address || '-'}`,
        `Solicitação de ajuste: ${form.adjustment_request || '-'}`,
        `Assinatura: ${form.signer_name || '-'}`,
        `CPF da assinatura: ${form.signer_cpf || '-'}`,
      ]
        .filter(Boolean)
        .join('\n');

      const { error: precontractUpdateError } = await supabase
        .from('precontracts')
        .update({
          status: 'signed',
          client_name: form.full_name.trim() || precontract.client_name || null,
          client_email: precontract.client_email || null,
          client_phone: cleanDigits(form.whatsapp) || precontract.client_phone || null,
          event_date: convertDateToInput(form.event_date) || precontract.event_date || null,
          event_time: form.event_time || precontract.event_time || null,
          location_name: form.event_location_name.trim() || precontract.location_name || null,
          location_address:
            form.event_location_address.trim() || precontract.location_address || null,
          notes: notesAtualizadas,
        })
        .eq('id', precontract.id);

      if (precontractUpdateError) throw precontractUpdateError;

      setEnviado(true);
    } catch (error) {
      console.error('Erro ao assinar contrato:', error);
      alert(`Erro ao assinar: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }

  function preencherAssinaturaComDados() {
    setForm((prev) => ({
      ...prev,
      signer_name: prev.full_name || '',
      signer_cpf: prev.cpf || '',
    }));
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Card>
            <p className="text-center text-slate-500">Carregando contrato...</p>
          </Card>
        </div>
      </main>
    );
  }

  if (!precontract) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Card>
            <div className="py-10 text-center">
              <p className="text-xl font-bold text-slate-900">
                Link de contrato inválido
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Esse link pode ter expirado, estar incorreto ou não existir.
              </p>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (enviado || contratoFinalizado) {
    const pdfUrl = resultadoFinal.pdfUrl || contract?.pdf_url || '';
    const painelUrl =
      resultadoFinal.clientPanelUrl ||
      `${window.location.origin}/cliente/${token}`;

    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Card>
            <div className="space-y-5 py-8 text-center">
              <p className="text-sm font-semibold tracking-wide text-emerald-600">
                HARMONICS
              </p>

              <h1 className="text-3xl font-bold text-slate-900">
                Contrato assinado com sucesso
              </h1>

              <p className="mx-auto max-w-2xl text-sm text-slate-500 md:text-base">
                Seu contrato foi concluído com sucesso. Abaixo você já pode acessar
                o PDF do contrato e também o seu painel do cliente, onde poderá
                acompanhar informações importantes do seu evento, financeiro e as
                próximas etapas.
              </p>

              <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
                {pdfUrl ? (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex"
                  >
                    <Button>Abrir PDF do contrato</Button>
                  </a>
                ) : (
                  <Button disabled>PDF ainda indisponível</Button>
                )}

                <a
                  href={painelUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex"
                >
                  <Button variant="secondary">Abrir painel do cliente</Button>
                </a>
              </div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <>
      {mapsApiKey ? (
        <Script
          id="google-maps-places"
          src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places`}
          strategy="afterInteractive"
          onLoad={() => setMapsReady(true)}
        />
      ) : null}

      <main className="min-h-screen bg-slate-100 px-3 py-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold tracking-wide text-violet-600">
                    Harmonics
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    Confirmação do contrato
                  </h1>
                  <p className="text-sm text-slate-500 md:text-base">
                    Revise tudo com cuidado, confira os dados e só assine quando
                    estiver tudo correto.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone="purple">
                    {resumo?.status === 'signed' ? 'Assinado' : 'Em andamento'}
                  </Badge>
                  <Badge tone="default">
                    Token: {String(token).slice(0, 8)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryItem label="Tipo" value={resumo?.eventType} />
                <SummaryItem label="Data" value={formatDateBR(resumo?.eventDate)} />
                <SummaryItem
                  label="Hora"
                  value={
                    resumo?.eventTime
                      ? String(resumo.eventTime).slice(0, 5)
                      : '--:--'
                  }
                />
                <SummaryItem label="Formação" value={resumo?.formation} />
                <SummaryItem label="Instrumentos" value={resumo?.instruments} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card title="Dados já combinados">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SummaryItem label="Cliente de referência" value={resumo?.clientName} />
                  <SummaryItem label="Endereço do evento" value={resumo?.locationAddress} />
                  <SummaryItem
                    label="Receptivo"
                    value={resumo?.receptionHours ? `${resumo.receptionHours}h` : 'Não'}
                  />
                  <SummaryItem label="Som" value={resumo?.hasSound ? 'Sim' : 'Não'} />
                  <SummaryItem
                    label="Transporte"
                    value={resumo?.hasTransport ? 'Sim' : 'Não'}
                  />
                </div>
              </Card>

              <Card>
  <SectionTitle subtitle="Preencha os dados do contratante exatamente como deseja que constem no contrato.">
    Dados do contratante
  </SectionTitle>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <Input
        label="Nome completo"
        value={form.full_name}
        onChange={(e) => handleChange('full_name', e.target.value)}
        className={getInputTone(fieldErrors.full_name)}
      />
      <FieldFeedback error={fieldErrors.full_name} />
    </div>

    <div>
      <Input
        label="Estado civil"
        value={form.marital_status}
        onChange={(e) => handleChange('marital_status', e.target.value)}
        className={getInputTone(fieldErrors.marital_status)}
      />
      <FieldFeedback error={fieldErrors.marital_status} />
    </div>

    <div>
      <Input
        label="Profissão"
        value={form.profession}
        onChange={(e) => handleChange('profession', e.target.value)}
        className={getInputTone(fieldErrors.profession)}
      />
      <FieldFeedback error={fieldErrors.profession} />
    </div>

    <div>
      <Input
        label="CPF"
        value={form.cpf}
        onChange={(e) => handleChange('cpf', e.target.value)}
        placeholder="000.000.000-00"
        inputMode="numeric"
        className={getInputTone(fieldErrors.cpf)}
      />
      <FieldFeedback error={fieldErrors.cpf} />
    </div>

    <div>
      <Input
        label="RG"
        value={form.rg}
        onChange={(e) => handleChange('rg', e.target.value)}
        className={getInputTone(fieldErrors.rg)}
      />
      <FieldFeedback error={fieldErrors.rg} />
    </div>

    <div>
      <Input
        label="WhatsApp"
        value={form.whatsapp}
        onChange={(e) => handleChange('whatsapp', e.target.value)}
        placeholder="(71) 99999-9999"
        inputMode="numeric"
        className={getInputTone(fieldErrors.whatsapp)}
      />
      <FieldFeedback error={fieldErrors.whatsapp} />
    </div>
  </div>
</Card>

<Card>
  <SectionTitle subtitle="Comece digitando e selecione um endereço válido do Google.">
    Endereço do contratante
  </SectionTitle>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <Input
        ref={addressStreetRef}
        label="Endereço completo"
        value={form.address_street}
        onChange={(e) => handleChange('address_street', e.target.value)}
        placeholder="Digite e selecione nas sugestões"
        autoComplete="street-address"
        className={getInputTone(
          fieldErrors.address_street,
          addressValidation.clientAddressConfirmed
        )}
      />
      <FieldFeedback
        error={fieldErrors.address_street}
        success={
          addressValidation.clientAddressConfirmed
            ? 'Endereço confirmado'
            : ''
        }
      />
    </div>

    <div>
      <Input
        label="Número"
        value={form.address_number}
        onChange={(e) => handleChange('address_number', e.target.value)}
      />
    </div>

    <div>
      <Input
        label="Complemento"
        value={form.address_complement}
        onChange={(e) => handleChange('address_complement', e.target.value)}
      />
    </div>

    <div>
      <Input
        label="Bairro"
        value={form.address_neighborhood}
        onChange={(e) => handleChange('address_neighborhood', e.target.value)}
        className={getInputTone(fieldErrors.address_neighborhood)}
      />
      <FieldFeedback error={fieldErrors.address_neighborhood} />
    </div>

    <div>
      <Input
        label="CEP"
        value={form.address_cep}
        onChange={(e) => handleChange('address_cep', e.target.value)}
        placeholder="00000-000"
        inputMode="numeric"
        autoComplete="postal-code"
        className={getInputTone(fieldErrors.address_cep)}
      />
      <FieldFeedback error={fieldErrors.address_cep} />
    </div>

    <div>
      <Input
        label="Cidade"
        value={form.address_city}
        onChange={(e) => handleChange('address_city', e.target.value)}
        className={getInputTone(fieldErrors.address_city)}
      />
      <FieldFeedback error={fieldErrors.address_city} />
    </div>

    <div>
      <Input
        label="Estado"
        value={form.address_state}
        onChange={(e) => handleChange('address_state', e.target.value)}
        placeholder="UF"
        className={getInputTone(fieldErrors.address_state)}
      />
      <FieldFeedback error={fieldErrors.address_state} />
    </div>
  </div>
</Card>

<Card>
  <SectionTitle subtitle="Confirme com atenção os dados do evento.">
    Dados do evento
  </SectionTitle>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <Input
        label="Data do evento"
        value={form.event_date}
        onChange={(e) => handleChange('event_date', e.target.value)}
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        className={getInputTone(fieldErrors.event_date)}
      />
      <FieldFeedback error={fieldErrors.event_date} />
    </div>

    <div>
      <Input
        label="Horário do evento"
        value={form.event_time}
        onChange={(e) => handleChange('event_time', e.target.value)}
        placeholder="hh:mm"
        inputMode="numeric"
        className={getInputTone(fieldErrors.event_time)}
      />
      <FieldFeedback error={fieldErrors.event_time} />
    </div>

    <div>
      <Input
        label="Nome do local"
        value={form.event_location_name}
        onChange={(e) =>
          handleChange('event_location_name', e.target.value)
        }
        className={getInputTone(fieldErrors.event_location_name)}
      />
      <FieldFeedback error={fieldErrors.event_location_name} />
    </div>

    <div>
      <Input
        ref={eventAddressRef}
        label="Endereço do evento"
        value={form.event_location_address}
        onChange={(e) =>
          handleChange('event_location_address', e.target.value)
        }
        placeholder="Digite e selecione nas sugestões"
        autoComplete="street-address"
        className={getInputTone(
          fieldErrors.event_location_address,
          addressValidation.eventAddressConfirmed
        )}
      />
      <FieldFeedback
        error={fieldErrors.event_location_address}
        success={
          addressValidation.eventAddressConfirmed
            ? 'Endereço confirmado'
            : ''
        }
      />
    </div>
  </div>
</Card>

              <Card>
                <SectionTitle subtitle="Caso precise corrigir alguma informação antes da assinatura, descreva abaixo.">
                  Solicitar ajuste
                </SectionTitle>

                <textarea
                  value={form.adjustment_request}
                  onChange={(e) =>
                    handleChange('adjustment_request', e.target.value)
                  }
                  className="min-h-[110px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  placeholder="Descreva aqui o ajuste que deseja solicitar..."
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={solicitarAjuste}
                    disabled={solicitandoAjuste}
                  >
                    {solicitandoAjuste ? 'Enviando ajuste...' : 'Solicitar ajuste'}
                  </Button>

                  <Button
                    variant="soft"
                    onClick={() => handleChange('adjustment_request', '')}
                  >
                    Limpar texto
                  </Button>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card title="Valor acordado">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    Total
                  </p>
                  <p className="mt-1 text-3xl font-bold text-emerald-700">
                    {formatMoney(resumo?.agreedAmount)}
                  </p>
                </div>
              </Card>

              <Card title="Leitura do contrato">
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Leia o contrato completo antes da assinatura. A prévia será aberta aqui na própria página.
                  </p>

                  <Button variant="secondary" onClick={abrirPreviewContrato}>
                    Ler contrato
                  </Button>

                  {previewError ? (
                    <p className="text-sm text-red-600">{previewError}</p>
                  ) : null}
                </div>
              </Card>

              <Card title="Assinatura eletrônica">
                <div className="space-y-4">
                  <Input
                    label="Nome na assinatura"
                    value={form.signer_name}
                    onChange={(e) => handleChange('signer_name', e.target.value)}
                  />

                  <Input
                    label="CPF da assinatura"
                    value={form.signer_cpf}
                    onChange={(e) => handleChange('signer_cpf', e.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />

                  <Button variant="soft" onClick={preencherAssinaturaComDados}>
                    Usar dados acima
                  </Button>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      checked={form.accepted_terms}
                      onChange={(e) =>
                        handleChange('accepted_terms', e.target.checked)
                      }
                      className="mt-1 h-5 w-5"
                    />
                    <span className="text-sm text-slate-700">
                      Declaro que li atentamente, conferi os dados e concordo com
                      os termos para continuidade e formalização do contrato.
                    </span>
                  </label>

                  <Button onClick={assinarContrato} disabled={salvando}>
                    {salvando ? 'Assinando...' : 'Assinar contrato'}
                  </Button>
                </div>
              </Card>

              <Card title="Importante">
                <p className="text-sm text-slate-600">
                  Leia tudo com atenção e confira os dados com cuidado.
                  Informe sempre corretamente o horário de início da cerimônia ou
                  evento. Há cláusulas específicas sobre atraso no contrato final.
                </p>
              </Card>
            </div>
          </div>
        </div>

        {previewAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
            <div className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Prévia do contrato</p>
                  <p className="text-xs text-slate-500">
                    Confira o documento com atenção antes de assinar.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setPreviewAberto(false);
                    setPreviewLoading(false);
                    setPreviewError('');
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              <div className="relative flex-1 bg-slate-100">
                {previewLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                    <p className="text-sm text-slate-600">Gerando prévia do contrato...</p>
                  </div>
                )}

                <iframe
                  src={`/api/contracts/preview-html/${token}`}
                  title="Prévia do contrato"
                  className="h-full w-full"
                  onLoad={() => setPreviewLoading(false)}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
