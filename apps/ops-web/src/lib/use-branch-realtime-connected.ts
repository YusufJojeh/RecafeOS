import { createContext, useContext } from 'react';

export const BranchRealtimeConnectedContext = createContext(false);

export function useBranchRealtimeConnected(): boolean {
  return useContext(BranchRealtimeConnectedContext);
}
