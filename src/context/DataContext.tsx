import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import type { ConditionMaster, ConditionStatus, PurchaseOrder } from '../types';
import { CONDITION_MASTER, SEED_POS } from '../data/seed';

const LS_KEY_CONDITIONS = 'poc.conditionMaster.v1';
const LS_KEY_POS = 'poc.purchaseOrders.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

interface DataContextValue {
  conditionMasters: ConditionMaster[];
  purchaseOrders: PurchaseOrder[];
  upsertConditionMaster: (cm: ConditionMaster) => void;
  setConditionMasterStatus: (id: string, status: ConditionStatus) => void;
  markConditionMasterUsed: (id: string) => void;
  deleteConditionMasterPermanently: (id: string) => void;
  upsertPO: (po: PurchaseOrder) => void;
  resetDemoData: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [conditionMasters, setConditionMasters] = useState<ConditionMaster[]>(() =>
    load(LS_KEY_CONDITIONS, CONDITION_MASTER)
  );
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => load(LS_KEY_POS, SEED_POS));

  const upsertConditionMaster = useCallback((cm: ConditionMaster) => {
    setConditionMasters((prev) => {
      const idx = prev.findIndex((c) => c.id === cm.id);
      const next = idx === -1 ? [...prev, cm] : prev.map((c) => (c.id === cm.id ? cm : c));
      save(LS_KEY_CONDITIONS, next);
      return next;
    });
  }, []);

  const setConditionMasterStatus = useCallback((id: string, status: ConditionStatus) => {
    setConditionMasters((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, status } : c));
      save(LS_KEY_CONDITIONS, next);
      return next;
    });
  }, []);

  // Flips the one-way "has this ever been applied to a PO" flag that gates permanent delete (ADR-005).
  const markConditionMasterUsed = useCallback((id: string) => {
    setConditionMasters((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1 || prev[idx].usedOnAnyPo) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], usedOnAnyPo: true };
      save(LS_KEY_CONDITIONS, next);
      return next;
    });
  }, []);

  // Irreversible. Only ever removes a record that is Inactive AND was never applied to a PO (ADR-005) —
  // the guard lives here, not just in the UI, so the API itself can't be misused into a real hard-delete.
  const deleteConditionMasterPermanently = useCallback((id: string) => {
    setConditionMasters((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target || target.status !== 'Inactive' || target.usedOnAnyPo) return prev;
      const next = prev.filter((c) => c.id !== id);
      save(LS_KEY_CONDITIONS, next);
      return next;
    });
  }, []);

  const upsertPO = useCallback((po: PurchaseOrder) => {
    setPurchaseOrders((prev) => {
      const idx = prev.findIndex((p) => p.id === po.id);
      const next = idx === -1 ? [...prev, po] : prev.map((p) => (p.id === po.id ? po : p));
      save(LS_KEY_POS, next);
      return next;
    });
  }, []);

  const resetDemoData = useCallback(() => {
    localStorage.removeItem(LS_KEY_CONDITIONS);
    localStorage.removeItem(LS_KEY_POS);
    setConditionMasters(CONDITION_MASTER);
    setPurchaseOrders(SEED_POS);
  }, []);

  const value = useMemo(
    () => ({
      conditionMasters,
      purchaseOrders,
      upsertConditionMaster,
      setConditionMasterStatus,
      markConditionMasterUsed,
      deleteConditionMasterPermanently,
      upsertPO,
      resetDemoData,
    }),
    [
      conditionMasters,
      purchaseOrders,
      upsertConditionMaster,
      setConditionMasterStatus,
      markConditionMasterUsed,
      deleteConditionMasterPermanently,
      upsertPO,
      resetDemoData,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
