# Caixa vivo — regras fechadas

- Marco zero é o caixa inicial da Harmonics.
- Movimento com `in_opening=true` é histórico e não movimenta o caixa novamente.
- Recebimento novo aumenta o caixa real e reduz o saldo a receber do evento.
- Busca de recebimentos é global por cliente, data ou local; mês é apenas referência analítica.
- Custos de músicos e demais custos operacionais previstos contam como custos futuros até a data do evento.
- Ao passar a data do evento, esses custos deixam automaticamente de ser obrigação futura; não há baixa manual músico por músico.
- Caixa projetado = caixa real + saldo ainda a receber - custos futuros.
- Retirada reduz caixa e caixa projetado, mas não reduz margem econômica dos eventos.
- Retirada pode ser classificada como Empréstimo, Distribuição/Lucro, Pró-labore ou Outros.
- Preservar histórico, estornos, conferência, configurações, eventos e controles avançados existentes.
