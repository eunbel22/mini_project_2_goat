// P08 · 고객 정보 저장/조회 (Supabase 모드)
// sql/01_customer_info.sql의 save_customer_info / get_latest_customer_info RPC와 customer_info
// SELECT 정책(본인 또는 어드민)만 사용한다. 직접 테이블 쓰기는 SQL에서 막혀 있다.
import { supabase } from './supabase';
import type { CustomerInfo, Guest } from './customerInfo';

function mapRow(row: any): CustomerInfo {
  return {
    requestId: row.request_id,
    customerId: row.customer_id,
    name: row.name,
    email: row.email,
    company: row.company || undefined,
    purpose: row.purpose,
    note: row.note || undefined,
    guests: (row.guests || []) as Guest[],
    goals: (row.goals || []) as string[],
    goalsOther: row.goals_other || undefined,
    updatedAt: row.updated_at,
  };
}

export async function saveCustomerInfoSupabase(info: CustomerInfo): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('save_customer_info', {
    p_request_id: info.requestId,
    p_customer_id: info.customerId,
    p_name: info.name,
    p_email: info.email,
    p_company: info.company || null,
    p_purpose: info.purpose,
    p_note: info.note || null,
    p_guests: info.guests,
    p_goals: info.goals,
    p_goals_other: info.goalsOther || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  if (!data?.success) {
    return { success: false, error: data?.error || '고객 정보 저장 실패' };
  }
  return { success: true };
}

export async function getLatestCustomerInfoSupabase(customerId: string): Promise<CustomerInfo | undefined> {
  const { data, error } = await supabase.rpc('get_latest_customer_info', {
    p_customer_id: customerId,
  });

  if (error || !data?.success || !data.info) {
    return undefined;
  }
  return mapRow(data.info);
}

export async function getCustomerInfoByRequestIdSupabase(requestId: string): Promise<CustomerInfo | undefined> {
  const { data, error } = await supabase
    .from('customer_info')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }
  return mapRow(data);
}

// 어드민 전용: RLS가 어드민에게만 전체 행을 허용한다
export async function getAllCustomerInfoSupabase(): Promise<Record<string, CustomerInfo>> {
  const { data, error } = await supabase.from('customer_info').select('*');
  if (error || !data) {
    return {};
  }
  const result: Record<string, CustomerInfo> = {};
  (data as any[]).forEach(row => {
    result[row.request_id] = mapRow(row);
  });
  return result;
}
