import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://maqqzcawbdhhfqxoabyq.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcXF6Y2F3YmRoaGZxeG9hYnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDUzNzksImV4cCI6MjEwNjIyMTM3OX0.o35exqFEzfbL58avn8KuVtGkN2uo61ZYh_nmziT1IUY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
