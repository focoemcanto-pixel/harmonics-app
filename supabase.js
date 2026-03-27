import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xsmdnbovjovfvdgnncje.supabase.co';
const supabaseKey = 'sb_publishable_BaK7e95s9d4oE3fb2-h5Rg_fVu_7N49';

export const supabase = createClient(supabaseUrl, supabaseKey);
