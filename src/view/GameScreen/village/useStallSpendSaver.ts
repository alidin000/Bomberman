import { useEffect } from 'react';
import { EngineSelector, EngineStore, useEngineSelector } from '../../../hooks/engineStore';
import { recordStallSpend } from '../../../story/hubEconomy';
import { stallSpendKey } from '../../../story/villageVisit';
import { storeVillageEmbers } from '../../ConfigScreen/launchGame';

type StallSpend = { key: string; amount: number; visitEmbers: number } | null;

const selectStallSpend: EngineSelector<StallSpend> = (state, previous) => {
  const visit = state?.config.village;
  const stageId = state?.campaign?.stageId;
  if (!state || !visit || !stageId) return null;
  const key = stallSpendKey(stageId, state.config.seed ?? 0);
  const amount = state.campaign?.village?.embersSpent ?? 0;
  if (previous && previous.key === key && previous.amount === amount) return previous;
  return { key, amount, visitEmbers: visit.embers };
};

/**
 * Saves what the village stall took the moment the match state shows it, so
 * a reload or a quit keeps the deduction (the way a deployed pack stays
 * spent). The mission's settlement catches up anything this missed.
 */
export function useStallSpendSaver(store: EngineStore): void {
  const spend = useEngineSelector(store, selectStallSpend);
  useEffect(() => {
    if (!spend || spend.amount <= 0) return;
    const progress = recordStallSpend({ key: spend.key, amount: spend.amount });
    storeVillageEmbers(Math.min(spend.visitEmbers - spend.amount, progress.currency));
  }, [spend]);
}
