'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { analyzeTemplateQuality } from '@/lib/contracts/analyzeTemplateQuality';
import { getMockContractTagValues } from '@/lib/contracts/contractTagsRegistry';

const ContractEditorContext = createContext(null);

function replaceTagsWithMockValues(content = '') {
  const values = getMockContractTagValues();
  let output = String(content || '');

  Object.entries(values).forEach(([tag, example]) => {
    output = output.split(tag).join(example);
  });

  return output;
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function ContractEditorProvider({ children, initialHtml = '' }) {
  const [html, setHtml] = useState(String(initialHtml || ''));
  const [lastInsertedTag, setLastInsertedTag] = useState('');

  const value = useMemo(() => {
    const analysis = analyzeTemplateQuality(html);
    const preview = stripHtml(replaceTagsWithMockValues(html));

    return {
      html,
      setHtml,
      analysis,
      preview,
      lastInsertedTag,
      setLastInsertedTag,
    };
  }, [html, lastInsertedTag]);

  return (
    <ContractEditorContext.Provider value={value}>
      {children}
    </ContractEditorContext.Provider>
  );
}

export function useContractEditor() {
  const context = useContext(ContractEditorContext);
  if (!context) {
    return null;
  }
  return context;
}

export function useRequiredContractEditor() {
  const context = useContext(ContractEditorContext);
  if (!context) {
    throw new Error('useRequiredContractEditor must be used inside ContractEditorProvider');
  }
  return context;
}
