import { supabase } from '@/lib/supabase';

/**
 * ⚠️ CLIENT-SIDE ONLY
 * Use este helper apenas em componentes client-side ('use client')
 * Para server-side, use get-contract-template-server.js
 */

export async function getContractTemplate(templateId) {
  if (!templateId) {
    throw new Error('[Contract Builder] templateId is required');
  }

  if (typeof window === 'undefined') {
    throw new Error(
      '[Contract Builder] getContractTemplate() is client-side only. Use getContractTemplateServer() for server-side.'
    );
  }

  try {
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
    console.error('[Contract Builder] Error in getContractTemplate:', error);
    throw error;
  }
}

export async function getAllActiveTemplates() {
  try {
    const { data, error } = await supabase
      .from('contract_templates')
      .select('id, name, category, description')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
    return data || [];
  } catch (error) {
    console.error('[Contract Builder] Error in getAllActiveTemplates:', error);
    throw error;
  }
}

export async function getTemplatesByCategory(category) {
  if (!category) throw new Error('[Contract Builder] category is required');

  try {
    const { data, error } = await supabase
      .from('contract_templates')
      .select('id, name, description')
      .eq('category', category)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
    return data || [];
  } catch (error) {
    console.error('[Contract Builder] Error in getTemplatesByCategory:', error);
    throw error;
  }
}
