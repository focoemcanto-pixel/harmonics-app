'use client';

export function getContratosSummary(contratos) {
  const total = contratos.length;
  const assinados = contratos.filter((item) => item.statusKey === 'ASSINADO').length;
  const pendentes = contratos.filter((item) => item.statusKey !== 'ASSINADO').length;
  const naoVisualizados = contratos.filter((item) => !item.visualizado).length;
  const visualizados = contratos.filter((item) => item.visualizado).length;

  return {
    total,
    assinados,
    pendentes,
    naoVisualizados,
    visualizados,
  };
}
