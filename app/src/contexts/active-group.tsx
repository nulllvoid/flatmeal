import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { useMyGroups, type GroupSummary } from '@/hooks/use-my-groups';
import { useSession } from '@/hooks/use-session';
import { setMealTypes } from '@/lib/groups-stub';
import type { MealType } from '@/types/domain';

interface ActiveGroupValue {
  groups: GroupSummary[] | undefined; // undefined = loading
  activeGroup: GroupSummary | null;
  setActiveGroupId: (id: string) => void;
  setGroupMeals: (id: string, meals: MealType[]) => Promise<void>;
  reloadGroups: () => Promise<void>;
}

const ActiveGroupContext = createContext<ActiveGroupValue | null>(null);

// Which of the user's groups the meal screens (Today, grocery list,
// who-is-eating, cook message preview) are scoped to. Defaults to the first
// group in meal order; selection is in-memory only.
export function ActiveGroupProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const { groups, reload } = useMyGroups(session);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const activeGroup = groups?.find((g) => g.id === activeGroupId) ?? groups?.[0] ?? null;

  const setGroupMeals = useCallback(
    async (id: string, meals: MealType[]) => {
      if (meals.length === 0) return; // a group must cover at least one meal
      await setMealTypes(id, meals);
      await reload();
    },
    [reload]
  );

  return (
    <ActiveGroupContext.Provider
      value={{ groups, activeGroup, setActiveGroupId, setGroupMeals, reloadGroups: reload }}>
      {children}
    </ActiveGroupContext.Provider>
  );
}

export function useActiveGroup(): ActiveGroupValue {
  const value = useContext(ActiveGroupContext);
  if (!value) throw new Error('useActiveGroup must be used inside ActiveGroupProvider');
  return value;
}
