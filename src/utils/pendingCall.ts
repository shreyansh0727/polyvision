import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pending_call_data';

type CallData = Record<string, string>;

export const pendingCall = {
  set: (data: CallData): void => {
    AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(e =>
      console.warn('[pendingCall] set failed:', e),
    );
  },

  get: async (): Promise<CallData | null> => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CallData;
    } catch {
      return null;
    }
  },

  clear: (): void => {
    AsyncStorage.removeItem(KEY).catch(e =>
      console.warn('[pendingCall] clear failed:', e),
    );
  },
};