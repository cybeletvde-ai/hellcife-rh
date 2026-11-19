import { createClient } from '@supabase/supabase-js';

const RAW_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkbGxxaHd6aXRvbmVtc2hqbHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MTA1NTAsImV4cCI6MjExMDA4NjU1MH0.oRYHxof4hF5Nn6USO1KYHXkMQo8J4je8Uvx6d1XZB4A';

function resolveSupabaseUrl(rawUrl: string, anonKey: string): string {
  const cleaned = rawUrl.trim().replace(/\/+$/, '');
  if (cleaned === 'https://supabase.co' || cleaned === 'http://supabase.co') {
    try {
      const parts = anonKey.split('.');
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64)) as { ref?: string };
        if (payload.ref) {
          return `https://${payload.ref}.supabase.co`;
        }
      }
    } catch {
      // Mantém a URL informada caso a chave não contenha payload JWT
    }
  }
  return cleaned;
}

export const SUPABASE_URL = resolveSupabaseUrl(RAW_SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
