import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://ivlwxzhuwoqcxiftlyhr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_g8UBqwb_NOl4wNLrFF9mKg_fLrLcUzr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
