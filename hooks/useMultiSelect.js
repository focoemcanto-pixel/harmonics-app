'use client';

import { useMemo, useState } from 'react';

export function useMultiSelect() {
  const [selectedIds, setSelectedIds] = useState([]);

  const selectedSet = useMemo(() => new Set(selectedIds.map((id) => String(id))), [selectedIds]);

  function toggle(id) {
    const normalized = String(id || '').trim();
    if (!normalized) return;

    setSelectedIds((prev) => {
      const set = new Set(prev.map((item) => String(item)));
      if (set.has(normalized)) set.delete(normalized);
      else set.add(normalized);
      return Array.from(set);
    });
  }

  function clear() {
    setSelectedIds([]);
  }

  function selectMany(ids = []) {
    const normalized = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
    setSelectedIds(normalized);
  }

  function toggleAll(ids = []) {
    const normalized = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
    if (normalized.length === 0) {
      clear();
      return;
    }

    const allSelected = normalized.every((id) => selectedSet.has(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !normalized.includes(String(id))));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev.map(String), ...normalized])));
  }

  return {
    selectedIds,
    selectedSet,
    setSelectedIds,
    toggle,
    clear,
    selectMany,
    toggleAll,
  };
}
