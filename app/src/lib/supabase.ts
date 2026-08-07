import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env and fill in your Supabase project values.'
  );
}

// AsyncStorage reaches for browser/RN globals on import, which crashes
// Expo Router's web build during SSR (Node has no `window`). On web, use
// `localStorage` client-side and a no-op store during server rendering.
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const authStorage =
  Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.localStorage : noopStorage) : AsyncStorage;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Email magic links redirect back with the session token in the URL —
    // only meaningful on web; native has no browser URL to inspect.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
