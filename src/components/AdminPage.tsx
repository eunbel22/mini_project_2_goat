import React, { useState, useEffect } from 'react';
import { SlotTable } from './SlotTable';
import type { Slot, Request, Candidate, OperationLog } from '../types';
import { OperationManager } from '../utils/operations';
import { DatabaseManager } from '../utils/database';
import { TIME_SLOTS } from '../utils/constants';
import { loadAdminDataFromSupabase, confirmToSupabase } from '../utils/supabaseData';
import { decideRequestStatus } from '../utils/decide';

interface AdminPageProps {
  db: DatabaseManager;
  mode: 'local' | 'supabase';
  userId?: string;
}

export const AdminPage: React.FC<AdminPageProps> = ({ db, mode, userId }) => {
  const [adminId] = useState<string>(userId || 'ADMIN001');
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [requests, setRequests] = useState<
    Array<{ request: Request; candidates: Candidate[]; decision: any }>
  >([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [selectedSlotForConfirm, setSelectedSlotForConfirm] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'received' | 'confirmed' | 'needs_reselection'>('all');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const om = new OperationManager(db);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setError('');
    setSuccess('');

    if (mode === 'supabase') {
      try {
        const { slots: slotsData, requests: reqs, candidates } = await loadAdminDataFromSupabase();
        setSlots(slotsData);

        // 요청 상태 계산
        const adminReqs = reqs.map(request => {
          const requestCandidates = candidates.filter(c => c.requestId === request.id);
          const decision = decideRequestStatus(request, requestCandidates, slotsData);
          return { request, candidates: requestCandidates, decision };
        });

        setRequests(adminReqs);
        setLogs([]);
      } catch (err) {
        console.error('Failed to load admin data:', err);
        setError('데이터 로드 실패');
      }
    } else {
      // 로컬 모드
      const state = db.getState();
      setSlots(state.slots);
      setRequests(om.getAdminRequests());
      setLogs(state.logs || []);
    }
  };

  const handleConfirm = async () => {
    if (!selectedRequest || !selectedSlotForConfirm) {
      setError('요청과 슬롯을 선택하세요');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let result;
      if (mode === 'supabase') {
        result = await confirmToSupabase(selectedRequest, selectedSlotForConfirm, adminId);
      } else {
        const operationId = `confirm-${selectedRequest}-${selectedSlotForConfirm}-${Date.now()}`;
        result = await om.confirmRequest(
          selectedRequest,
          selectedSlotForConfirm,
          adminId,
          operationId
        );
      }

      if (result.success) {
        setSuccess(`확정되었습니다! 영향받은 요청: ${result.affectedRequests?.length || 0}건`);
        setSelectedRequest(null);
        setSelectedSlotForConfirm(null);
        setTimeout(() => loadData(), 500);
      } else {
        setError(result.error || '확정 실패');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const currentRequest = selectedRequest ? requests.find(r => r.request.id === selectedRequest) : null;

  const handleBatchAutoConfirm = async () => {
    // 접수 대기(received) 상태인 모든 요청을 선착순(createdAt 오름차순)으로 정렬
    const pendingReqs = requests
      .filter(r => r.request.status === 'received')
      .sort((a, b) => new Date(a.request.createdAt).getTime() - new Date(b.request.createdAt).getTime());

    if (pendingReqs.length === 0) {
      setError('현재 자동 확정할 대기 중인 접수 건이 없습니다.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    let successCount = 0;
    let failCount = 0;
    let currentSlots = { ...slots };

    for (const item of pendingReqs) {
      // 1~3순위 후보 중 현재 사용 가능한 슬롯 탐색 (FIFO 접수순)
      const sortedCandidates = [...item.candidates].sort((a, b) => a.priority - b.priority);
      const firstAvailable = sortedCandidates.find(c => currentSlots[c.slotId]?.status === 'available');

      if (firstAvailable) {
        try {
          let result;
          if (mode === 'supabase') {
            result = await confirmToSupabase(item.request.id, firstAvailable.slotId, adminId);
          } else {
            const operationId = `batch-confirm-${item.request.id}-${firstAvailable.slotId}-${Date.now()}`;
            result = await om.confirmRequest(
              item.request.id,
              firstAvailable.slotId,
              adminId,
              operationId
            );
          }

          if (result.success) {
            successCount++;
            // 슬롯 현황 갱신
            currentSlots = {
              ...currentSlots,
              [firstAvailable.slotId]: { ...currentSlots[firstAvailable.slotId], status: 'confirmed' }
            };
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      } else {
        failCount++;
      }
    }

    setSuccess(`⚡ 선착순 배치 자동 확정 완료! (성공: ${successCount}건 / 불가 또는 실패: ${failCount}건)`);
    setSelectedRequest(null);
    setSelectedSlotForConfirm(null);
    setTimeout(() => loadData(), 500);
    setLoading(false);
  };

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>어드민 패널</h2>
        <button
          className="btn btn-primary"
          onClick={handleBatchAutoConfirm}
          disabled={loading || requests.filter(r => r.request.status === 'received').length === 0}
          style={{ background: '#28a745', borderColor: '#28a745', fontWeight: 'bold', padding: '8px 16px', fontSize: '13px' }}
        >
          {loading ? '일괄 자동 처리 중...' : `⚡ 접수순 1순위 일괄 자동 확정 (대기 ${requests.filter(r => r.request.status === 'received').length}건)`}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="grid">
        {/* 요청 목록 */}
        <div>
          <h3>신청 목록 (총 {requests.length}건)</h3>
          {/* S6-07 · 후보 시작 전 / 상태별 관리자 점검 필터 */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <button
              className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '2px 6px' }}
              onClick={() => setFilterStatus('all')}
            >
              전체 ({requests.length})
            </button>
            <button
              className={`btn ${filterStatus === 'received' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '2px 6px' }}
              onClick={() => setFilterStatus('received')}
            >
              ⏳ 대기 중 ({requests.filter(r => r.request.status === 'received').length})
            </button>
            <button
              className={`btn ${filterStatus === 'confirmed' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '2px 6px' }}
              onClick={() => setFilterStatus('confirmed')}
            >
              확정됨 ({requests.filter(r => r.request.status === 'confirmed').length})
            </button>
            <button
              className={`btn ${filterStatus === 'needs_reselection' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '2px 6px' }}
              onClick={() => setFilterStatus('needs_reselection')}
            >
              재선택 필요 ({requests.filter(r => r.request.status === 'needs_reselection').length})
            </button>
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            <ul className="list" style={{ margin: 0 }}>
              {requests
                .filter(item => filterStatus === 'all' || item.request.status === filterStatus)
                .map((item, idx) => (
                <li
                  key={item.request.id}
                  onClick={() => {
                    setSelectedRequest(item.request.id);
                    setSelectedSlotForConfirm(null);
                  }}
                  style={{
                    cursor: 'pointer',
                    background: selectedRequest === item.request.id ? '#e7f3ff' : 'white',
                    borderColor: selectedRequest === item.request.id ? '#007bff' : '#ddd',
                    marginBottom: '0',
                    borderRadius: '0',
                    borderBottom: '1px solid #ddd',
                  }}
                >
                  <div>
                    <strong>#{idx + 1}</strong> {item.request.customerId} (v
                    {item.request.version})
                    <br />
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(item.request.createdAt).toLocaleString()}
                    </span>
                    <br />
                    <span className={`slot-status ${item.request.status === 'confirmed' ? 'confirmed' : 'available'}`}>
                      {item.request.status === 'confirmed'
                        ? '확정됨'
                        : item.request.status === 'needs_reselection'
                          ? '재선택필요'
                          : '접수됨'}
                    </span>
                    {/* S6-05 · 관리자 기한 배지 */}
                    {item.request.status === 'received' && item.candidates.length > 0 && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        backgroundColor: '#fff3cd',
                        color: '#856404',
                        border: '1px solid #ffeeba',
                        fontWeight: 'bold',
                      }}>
                        ⏰ 기한 대기 (최단: {slots[item.candidates[0]?.slotId]?.date || '미정'})
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 요청 상세 */}
        <div>
          <h3>요청 상세</h3>
          {currentRequest ? (
            <div style={{ padding: '16px', background: 'white', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div className="form-group">
                <label>고객 코드</label>
                <input type="text" value={currentRequest.request.customerId} disabled />
              </div>

              <div className="form-group">
                <label>상태</label>
                <input
                  type="text"
                  value={
                    currentRequest.request.status === 'confirmed'
                      ? '확정됨'
                      : currentRequest.request.status === 'needs_reselection'
                        ? '재선택필요'
                        : '접수됨'
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>희망 슬롯 (우선순위 순)</label>
                <ul className="list">
                  {currentRequest.candidates.map((c, idx) => {
                    const slot = slots[c.slotId];
                    const isAvailable = slot?.status === 'available';
                    return (
                      <li
                        key={c.id}
                        onClick={() => {
                          if (isAvailable && currentRequest.request.status !== 'confirmed') {
                            setSelectedSlotForConfirm(c.slotId);
                          }
                        }}
                        style={{
                          cursor: isAvailable && currentRequest.request.status !== 'confirmed' ? 'pointer' : 'default',
                          background:
                            selectedSlotForConfirm === c.slotId
                              ? '#d4edda'
                              : isAvailable
                                ? 'white'
                                : '#f8d7da',
                          borderColor: selectedSlotForConfirm === c.slotId ? '#28a745' : '#ddd',
                        }}
                      >
                        <span>
                          {idx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                          {' '}
                          <span style={{ marginLeft: '10px', fontSize: '12px' }}>
                            {isAvailable ? '(가능)' : '(마감)'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {currentRequest.request.status === 'confirmed' && currentRequest.request.confirmedSlotId && (
                <div className="alert alert-success">
                  <strong>확정 완료</strong>
                  <br />
                  {slots[currentRequest.request.confirmedSlotId]?.date}{' '}
                  {TIME_SLOTS.find(t => t.label === slots[currentRequest.request.confirmedSlotId!]?.timeLabel)?.displayLabel}
                  <br />
                  {new Date(currentRequest.request.confirmedAt!).toLocaleString()}
                </div>
              )}

              {currentRequest.request.status !== 'confirmed' && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleBatchAutoConfirm}
                    disabled={loading}
                    style={{ width: '100%', background: '#28a745', borderColor: '#28a745', fontWeight: 'bold' }}
                  >
                    {loading ? '처리 중...' : '🤖 1순위 우선 자동 확정 (Auto-Matching)'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleConfirm}
                    disabled={!selectedSlotForConfirm || loading}
                    style={{ width: '100%' }}
                  >
                    {loading ? '처리 중...' : '수동 확정 (선택한 슬롯)'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '16px', background: '#f0f0f0', borderRadius: '4px', color: '#666' }}>
              목록에서 요청을 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* 슬롯 현황 */}
      <div style={{ marginTop: '40px' }}>
        <h3>슬롯 현황 (표시용)</h3>
        <SlotTable slots={slots} selectedSlots={[]} onToggle={() => {}} mode="view" />
      </div>

      {/* 실행 기록 */}
      <div style={{ marginTop: '40px' }}>
        <h3>실행 기록 (최근 20건)</h3>
        <div className="table-container">
          <table className="slots-table">
            <thead>
              <tr>
                <th>시간</th>
                <th>행위</th>
                <th>요청ID</th>
                <th>슬롯</th>
                <th>결과</th>
                <th>오류</th>
              </tr>
            </thead>
            <tbody>
              {logs
                .slice()
                .reverse()
                .slice(0, 20)
                .map(log => (
                  <tr key={log.id} style={{ fontSize: '12px' }}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>{log.action}</td>
                    <td style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                      {log.requestId.substring(0, 8)}...
                    </td>
                    <td>{log.slotId ? log.slotId : '-'}</td>
                    <td>
                      <span style={{ color: log.status === 'success' ? '#28a745' : '#dc3545' }}>
                        {log.status === 'success' ? '성공' : '실패'}
                      </span>
                    </td>
                    <td style={{ color: '#dc3545' }}>{log.error ? log.error.substring(0, 30) : '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
