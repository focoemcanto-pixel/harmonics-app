import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * ⚠️ SERVER-SIDE ONLY
 * Use este helper apenas em Server Components ou API Routes
 * Para client-side, use get-contract-template.js
 */

function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

export async function getContractTemplateServer(templateId) {
  if (!templateId) throw new Error('[Contract Builder] templateId is required');

  try {
    const supabase = getSupabaseServer();

    const { data: template, error: templateError } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single();

    if (templateError) throw new Error(`Failed to fetch template: ${templateError.message}`);
    if (!template) throw new Error(`Template ${templateId} not found or inactive`);

    const { data: blocks, error: blocksError } = await supabase
      .from('contract_template_blocks')
      .select('*')
      .eq('template_id', templateId)
      .eq('is_enabled', true)
      .order('order_index', { ascending: true });

    if (blocksError) throw new Error(`Failed to fetch blocks: ${blocksError.message}`);

    const { data: variables, error: variablesError } = await supabase
      .from('contract_template_variables')
      .select('*')
      .eq('template_id', templateId);

    if (variablesError) console.warn('[Contract Builder] Failed to fetch variables:', variablesError);

    return {
      template,
      blocks: blocks || [],
      variables: variables || [],
    };
  } catch (error) {
    console.error('[Contract Builder] Error in getContractTemplateServer:', error);
    throw error;
  }
}
