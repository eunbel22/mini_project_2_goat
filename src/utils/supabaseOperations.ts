import { supabase } from './supabase';

export async function submitRequestRPC(
  customerId: string,
  slotIds: string[],
  operationId: string
) {
  const { data, error } = await supabase.rpc('submit_request', {
    p_customer_id: customerId,
    p_slot_ids: slotIds,
    p_operation_id: operationId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: false, error: 'Unknown error' };
}

export async function confirmRequestRPC(
  requestId: string,
  slotId: string,
  adminId: string,
  operationId: string
) {
  const { data, error } = await supabase.rpc('confirm_request', {
    p_request_id: requestId,
    p_slot_id: slotId,
    p_admin_id: adminId,
    p_operation_id: operationId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: false, error: 'Unknown error' };
}

export async function resubmitRequestRPC(
  customerId: string,
  requestId: string,
  newSlotIds: string[],
  operationId: string
) {
  const { data, error } = await supabase.rpc('resubmit_request', {
    p_customer_id: customerId,
    p_request_id: requestId,
    p_slot_ids: newSlotIds,
    p_operation_id: operationId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data || { success: false, error: 'Unknown error' };
}

export async function fetchSlots() {
  const { data, error } = await supabase.from('slots').select('*');
  if (error) {
    return { slots: [], error: error.message };
  }
  return { slots: data || [], error: null };
}

export async function fetchCustomerRequests(customerId: string) {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .eq('customer_id', customerId);

  if (error) {
    return { requests: [], error: error.message };
  }
  return { requests: data || [], error: null };
}

export async function fetchCandidates(requestId: string) {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('request_id', requestId)
    .order('priority', { ascending: true });

  if (error) {
    return { candidates: [], error: error.message };
  }
  return { candidates: data || [], error: null };
}

export async function fetchAllRequests() {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return { requests: [], error: error.message };
  }
  return { requests: data || [], error: null };
}

export async function fetchOperationLogs() {
  const { data, error } = await supabase
    .from('operation_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { logs: [], error: error.message };
  }
  return { logs: data || [], error: null };
}
