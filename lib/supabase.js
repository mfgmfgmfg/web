import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lfxpistrnaemhzipvzvw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmeHBpc3RybmFlbWh6aXB2enZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNzQ2NzUsImV4cCI6MjA2Mzc1MDY3NX0.oLtb-GDUfrtTsX30rhyIi1Ur0iSZM8_Wh0s_FTZjI24';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
