import { redirect } from "next/navigation";

// Endereço antigo: o financeiro agora é uma experiência única em /pagamentos/operacional.
export default function LegacyFinanceRoute() {
  redirect("/pagamentos/operacional");
}
