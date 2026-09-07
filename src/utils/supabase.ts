import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export async function signUp(email: string, password: string, customerId: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        customer_id: customerId,
      },
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  return { data, error };
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  return { data, error };
}

export async function getAdminStatus() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return false;
  }

  const user = data.user;
  const appMetadata = user.app_metadata || {};
  return appMetadata.role === 'admin';
}
