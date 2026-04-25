'use client';

import { useConfirm as useConfirmContext } from '@/components/ui/ConfirmDialogProvider';

export function useConfirm() {
  return useConfirmContext();
}
