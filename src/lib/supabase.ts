import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'Admin' | 'Owner' | 'Team_Leader' | 'Executor';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  role_id?: string;
  auth_user_id?: string;
  mapped_floor?: string;
  mapped_salesman?: string;
  active: boolean;
}
