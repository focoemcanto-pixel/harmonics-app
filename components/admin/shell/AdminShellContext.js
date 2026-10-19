'use client';

import { createContext, useContext } from 'react';

// Liga cada página ao frame persistente do admin: a página informa título/ações e o frame
// (menu, topo, navegação mobile) continua montado entre as trocas de tela.
export const AdminShellContext = createContext(null);

export function useAdminShell() {
  return useContext(AdminShellContext);
}
