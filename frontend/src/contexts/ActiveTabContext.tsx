import { createContext, useContext } from 'react';

const ActiveTabContext = createContext<string>('analysis');

export const ActiveTabProvider = ActiveTabContext.Provider;

export function useIsActiveTab(tabId: string): boolean {
  const activeTab = useContext(ActiveTabContext);
  return activeTab === tabId;
}
