'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { markOnboardingStepClient } from '@/lib/onboarding/markOnboardingStepClient';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';
import { useOnboardingFlow } from '@/components/onboarding/OnboardingFlowProvider';

const GUIDE_ID = 'template';
const NEXT_GUIDE_HREF = '/eventos/tipos?guide=event-types';

const STEPS = [
  {
    key: 'start',
    title: 'Comece criando o template',
    description: 'Vou abrir a área de criação para você montar o modelo-base do contrato.',
    selector: '[data-tour="template-new-button"]',
    texts: ['Novo template', 'Criar template'],
    button: true,
    autoClick: true,
  },
  {
    key: 'name',
    title: 'Dê um nome claro ao modelo',
    description: 'Use um nome operacional. Exemplo: Contrato Casamento Premium. O identificador interno será gerado automaticamente a partir desse nome.',
    selector: '[data-tour="template-name-input"]',
    texts: ['Nome', 'Contrato padrão casamento'],
    requiresValue: true,
    hint: 'Digite um nome para o template antes de avançar.',
    focus: true,
  },
  {
    key: 'editor',
    title: 'Cole ou escreva o contrato',
    description: 'Insira o texto base do contrato e já deixe os campos importantes preparados no próprio modelo.',
    selector: '[data-tour="template-editor"]',
    texts: ['Texto do contrato', 'Cole aqui o contrato'],
    requiresValue: true,
    hint: 'Cole ou escreva o texto do contrato antes de avançar.',
    focus: true,
  },
  {
    key: 'save_template',
    title: 'Salve seu template',
    description: 'Clique em salvar para registrar este modelo e liberar a criação dos tipos de evento.',
    selector: '[data-guide="save_contract_template"]',
    dataGuide: 'save_contract_template',
    texts: ['Salvar template', 'Criar template', 'Salvar modelo', 'Salvar alterações'],
    button: true,
    hint: 'Salve o template para continuar para a próxima etapa.',
  },
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function textOf(el) {
  return normalize(el?.getAttribute?.('placeholder') || el?.getAttribute?.('aria-label') || el?.textContent || el?.value || '');
}

function findByText(texts, selector) {
  const needles = (texts || []).map(normalize).filter(Boolean);
  if (!needles.length) return null;

  const elements = Array.from(document.querySelectorAll(selector));
  return elements.find((el) => isVisible(el) && needles.some((needle) => textOf(el).includes(needle))) || null;
}

function findByDataGuide(dataGuide) {
  if (!dataGuide) return null;
  const exact = document.querySelector(`[data-guide="${dataGuide}"]`);
  if (exact && isVisible(exact)) return exact;
  return null;
}

function setAnchor(el, name) {
  if (el && name && !el.getAttribute('data-tour')) el.setAttribute('data-tour', name);
  return el;
}

function ensureAnchors() {
  const buttonSelector = 'button, [role="button"], a';
  const inputSelector = 'input, textarea, [contenteditable="true"]';

  setAnchor(findByText(['Novo template'], buttonSelector) || findByText(['Criar template'], buttonSelector), 'template-new-button');

  const formFields = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]')).filter(isVisible);
  const visibleInputs = formFields.filter((field) => {
    const placeholder = normalize(field.getAttribute?.('placeholder') || '');
    return !placeholder.includes('buscar por nome') && !placeholder.includes('buscar');
  });

  setAnchor(
    document.querySelector('input[placeholder*="Contrato padrão" i]') ||
      visibleInputs.find((field) => normalize(field.getAttribute?.('placeholder') || '').includes('contrato')) ||
      findByText(['Nome'], 'label')?.querySelector?.('input'),
    'template-name-input'
  );

  setAnchor(
    document.querySelector('[contenteditable="true"]') ||
      document.querySelector('[data-contract-rich-editor="true"]') ||
      findByText(['Texto do contrato'], inputSelector),
    'template-editor'
  );

  setAnchor(findByText(['Preparar campos dinâmicos'], buttonSelector), 'template-dynamic-fields');
  setAnchor(findByDataGuide('save_contract_template') || findByText(['Salvar template', 'Criar template', 'Salvar modelo', 'Salvar alterações'], buttonSelector), 'template-save-button');
}

function findTarget(step) {
  const dataGuideTarget = findByDataGuide(step.dataGuide);
  if (dataGuideTarget) return dataGuideTarget;

  ensureAnchors();
  const explicit = document.querySelector(step.selector);
  if (explicit && isVisible(explicit)) return explicit;
  const selector = step.button ? 'button, [role="button"], a' : 'input, textarea, [contenteditable="true"], label, button, [role="button"]';
  return findByText(step.texts, selector);
}

function hasValue(el) {
  if (!el) return false;
  if ('value' in el) return String(el.value || '').trim().length > 0;
  return String(el.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0;
}

function findFocusable(el) {
  if (!el) return null;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return el;
  return el.querySelector?.('input, textarea, [contenteditable="true"]') || null;
}

function clearGuideQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('guide');
  url.searchParams.delete('onboarding');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSpotlightBox(rect) {
  if (!rect) return null;
  const padding = 14;
  return {
    left: Math.max(8, rect.left - padding),
    top: Math.max(8, rect.top - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function getDesiredCenterY(key, vh) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    if (key === 'name') return vh * 0.72;
    if (key === 'editor') return vh * 0.76;
    return vh * 0.68;
  }

  if (key === 'name') return vh * 0.46;
  if (key === 'editor') return vh * 0.43;
  return vh * 0.5;
}

function centerTargetComfortably(target, stepKey) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const desiredCenterY = getDesiredCenterY(stepKey, window.innerHeight);
  const currentCenterY = rect.top + rect.height / 2;
  const delta = currentCenterY - desiredCenterY;

  if (Math.abs(delta) < 56) return;

  const root = document.scrollingElement || document.documentElement;
  root.scrollTo({ top: root.scrollTop + delta, behavior: 'auto' });
}

function getTooltipPosition(rect, vw, vh, tooltipWidth, tooltipHeight = 300) {
  const isMobile = vw < 768;

  if (!rect) {
    return {
      left: 16,
      top: isMobile ? 24 : 120,
    };
  }

  if (isMobile) {
    return {
      left: 16,
      top: 20,
    };
  }

  const gap = 24;
  const spaceRight = vw - rect.right;
  const spaceLeft = rect.left;
  const canFitRight = spaceRight >= tooltipWidth + gap + 16;
  const canFitLeft = spaceLeft >= tooltipWidth + gap + 16;

  let left;
  if (canFitRight) {
    left = rect.right + gap;
  } else if (canFitLeft) {
    left = rect.left - tooltipWidth - gap;
  } else {
    left = clamp(rect.left + rect.width / 2 - tooltipWidth / 2, 16, vw - tooltipWidth - 16);
  }

  const targetCenterY = rect.top + rect.height / 2;
  let top = targetCenterY - tooltipHeight / 2;

  if (rect.bottom > vh * 0.68) {
    top = rect.top - tooltipHeight - gap;
  }

  if (top < 18) {
    top = rect.bottom + gap;
  }

  return {
    left: clamp(left, 16, vw - tooltipWidth - 16),
    top: clamp(top, 18, vh - tooltipHeight - 18),
  };
}

export default function TemplateCreationGuideStable() { return null }
