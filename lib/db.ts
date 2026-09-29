import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://cdocwnjzxclpjibrmvfa.supabase.co';

const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);