'use client';

import { useEffect, useRef } from 'react';

// Entrada suave ao rolar a página. Renderiza visível (sem JS, o conteúdo aparece normalmente);
// depois de montar, só os blocos ainda fora da tela ficam ocultos até entrarem na viewport.
export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    if (node.getBoundingClientRect().top <= window.innerHeight) return undefined;
    node.dataset.visible = 'false';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.dataset.visible = 'true';
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} style={delay ? { transitionDelay: `${delay}ms` } : undefined} className={`landing-reveal ${className}`}>
      {children}
    </Tag>
  );
}
