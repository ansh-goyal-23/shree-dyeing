import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uqgrgbqgcpqpdgemehdq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZ3JnYnFnY3BxcGRnZW1laGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTYzMDcsImV4cCI6MjA4OTQ5MjMwN30._v14o55LXtTBFJx8tkp2_Xqku_w5U4J5b1LBvB2xoR0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
