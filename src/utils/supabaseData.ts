import { submitRequestRPC, resubmitRequestRPC, confirmRequestRPC, fetchSlots, fetchCustomerRequests, fetchCandidates } from './supabaseOperations';
import { supabase } from './supabase';
import type { Slot, Candidate } from '../types';

export async function loadSlotsFromSupabase(): Promise<Record<string, Slot>> {
  const { slots, error } = await fetchSlots();
  if (error) {
    console.error('Failed to fetch slots:', error);
    return {};
  }

  const slotMap: Record<string, Slot> = {};
  slots.forEach((slot: any) => {
    slotMap[slot.id] = {
      id: slot.id,
      date: slot.date,
      timeLabel: slot.time_label,
      status: slot.status,
      confirmedBy: slot.confirmed_by,
      confirmedAt: slot.confirmed_at,
    };
  });
  return slotMap;
}

export async function loadCustomerDataFromSupabase(customerId: string) {
  const { requests, error: requestError } = await fetchCustomerRequests(customerId);
  if (requestError) {
    console.error('Failed to fetch requests:', requestError);
    return { requests: [], candidates: [] };
  }

  const candidates: Candidate[] = [];
  for (const req of requests as any[]) {
    const { candidates: cands, error: candError } = await fetchCandidates(req.id);
    if (!candError && cands) {
      candidates.push(
        ...cands.map((c: any) => ({
          id: c.id,
          requestId: c.request_id,
          slotId: c.slot_id,
          priority: c.priority,
          version: c.version,
          queueSeq: c.queue_seq,
        }))
      );
    }
  }

  const mappedRequests = (requests as any[]).map((r: any) => ({
    id: r.id,
    customerId: r.customer_id,
    version: r.version,
    createdAt: r.created_at,
    status: r.status,
    confirmedSlotId: r.confirmed_slot_id,
    confirmedAt: r.confirmed_at,
  }));

  return { requests: mappedRequests, candidates };
}

export async function submitToSupabase(customerId: string, slotIds: string[]) {
  const operationId = `submit-${customerId}-${Date.now()}`;
  const result = await submitRequestRPC(customerId, slotIds, operationId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, requestId: result.requestId };
}

export async function resubmitToSupabase(customerId: string, requestId: string, newSlotIds: string[]) {
  const operationId = `resubmit-${customerId}-${Date.now()}`;
  const result = await resubmitRequestRPC(customerId, requestId, newSlotIds, operationId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, requestId: result.requestId };
}

export async function loadAdminDataFromSupabase() {
  const { slots, error: slotsError } = await fetchSlots();
  const { data: requests, error: requestsError } = await supabase.from('requests').select('*').order('created_at', { ascending: true }) as any;

  if (slotsError || requestsError) {
    console.error('Failed to fetch admin data:', slotsError || requestsError);
    return { slots: {}, requests: [], candidates: [] };
  }

  const slotMap: Record<string, Slot> = {};
  slots.forEach((slot: any) => {
    slotMap[slot.id] = {
      id: slot.id,
      date: slot.date,
      timeLabel: slot.time_label,
      status: slot.status,
      confirmedBy: slot.confirmed_by,
      confirmedAt: slot.confirmed_at,
    };
  });

  const candidates: Candidate[] = [];
  for (const req of requests as any[]) {
    const { candidates: cands } = await fetchCandidates(req.id);
    if (cands) {
      candidates.push(
        ...cands.map((c: any) => ({
          id: c.id,
          requestId: c.request_id,
          slotId: c.slot_id,
          priority: c.priority,
          version: c.version,
          queueSeq: c.queue_seq,
        }))
      );
    }
  }

  const mappedRequests = (requests as any[]).map((r: any) => ({
    id: r.id,
    customerId: r.customer_id,
    version: r.version,
    createdAt: r.created_at,
    status: r.status,
    confirmedSlotId: r.confirmed_slot_id,
    confirmedAt: r.confirmed_at,
  }));

  return { slots: slotMap, requests: mappedRequests, candidates };
}

export async function confirmToSupabase(requestId: string, slotId: string, adminId: string) {
  const operationId = `confirm-${requestId}-${slotId}-${Date.now()}`;
  const result = await confirmRequestRPC(requestId, slotId, adminId, operationId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, affectedRequests: result.affectedRequests || [] };
}
