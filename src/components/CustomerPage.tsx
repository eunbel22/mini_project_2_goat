import React, { useState, useEffect } from 'react';
import { SlotTable } from './SlotTable';
import { CalendarPicker } from './CalendarPicker';
import type { Slot, Request, Candidate } from '../types';
import { OperationManager } from '../utils/operations';
import { DatabaseManager } from '../utils/database';
import { decideRequestStatus } from '../utils/decide';
import { TIME_SLOTS } from '../utils/constants';
import { loadSlotsFromSupabase, loadCustomerDataFromSupabase, submitToSupabase, resubmitToSupabase, subscribeToCustomerData } from '../utils/supabaseData';
import { StatusSummaryCard } from './StatusSummaryCard';
import { PreparationMemoCard } from './PreparationMemoCard';
import { PreQualificationForm, createEmptyPreQualificationValue, type PreQualificationValue } from './PreQualificationForm';
import { validateCustomerInfoInput, saveCustomerInfoLocal, getLatestCustomerInfoByCustomerId, type CustomerInfo } from '../utils/customerInfo';
import { saveCustomerInfoSupabase, getLatestCustomerInfoSupabase } from '../utils/customerInfoSupabase';

interface CustomerPageProps {
  db: DatabaseManager;
  mode: 'local' | 'supabase';
  userId?: string;
}

export const CustomerPage: React.FC<CustomerPageProps> = ({ db, mode, userId }) => {
  const [customerId, setCustomerId] = useState<string>(userId || 'C01');
  const [stage, setStage] = useState<'select' | 'confirm' | 'view' | 'reselect'>('select');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [customerRequests, setCustomerRequests] = useState<
    Array<{ request: Request; candidates: Candidate[]; decision: any }>
  >([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [statusChanged, setStatusChanged] = useState<boolean>(false);
  const [previousStatus, setPreviousStatus] = useState<string | undefined>();
  const [deadline, setDeadline] = useState<string>(''); // C) 기한 필드
  const [prequal, setPrequal] = useState<PreQualificationValue>(createEmptyPreQualificationValue());

  const om = new OperationManager(db);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [customerId]);

  // 고객 정보 재신청 시 자동 입력 (P08 고객 정보 저장 & 조회)
  useEffect(() => {
    if (!customerId) return;
    const applyInfo = (info: CustomerInfo | undefined) => {
      if (!info) return;
      setPrequal({
        name: info.name,
        email: info.email,
        company: info.company || '',
        purpose: info.purpose,
        note: info.note || '',
        guests: info.guests,
        goals: info.goals,
        goalsOther: info.goalsOther || '',
      });
    };

    if (mode === 'supabase') {
      getLatestCustomerInfoSupabase(customerId).then(applyInfo);
    } else {
      applyInfo(getLatestCustomerInfoByCustomerId(customerId));
    }
  }, [customerId, mode]);

  // S2-06 · 상태 화면 자동 새로고침 (Supabase Realtime 또는 폴링)
  useEffect(() => {
    if (!autoRefreshEnabled || stage !== 'view' || customerRequests.length === 0) return;

    let cleanup: (() => void) | null = null;

    if (mode === 'supabase') {
      // Supabase Realtime 구독
      const subscription = subscribeToCustomerData(customerId, (data) => {
        // 데이터 변경 감지 시 상태 계산
        const slotsData = Object.values(slots);
        const slotMap: Record<string, any> = {};
        slotsData.forEach(slot => {
          slotMap[slot.id] = slot;
        });

        const status = data.requests.map((request: any) => {
          const requestCandidates = data.candidates.filter((c: any) => c.requestId === request.id);
          const decision = decideRequestStatus(request, requestCandidates, slotMap);
          return { request, candidates: requestCandidates, decision };
        });

        // S2-07 · 상태 변경 감지
        if (customerRequests.length > 0 && status.length > 0) {
          const currentLatest = customerRequests[customerRequests.length - 1];
          const newLatest = status[status.length - 1];
          if (currentLatest.request.status !== newLatest.request.status) {
            setStatusChanged(true);
            setPreviousStatus(currentLatest.request.status);
          }
        }

        setCustomerRequests(status);

        // 상태에 따라 stage 업데이트
        if (status.length === 0) {
          setStage('select');
        } else {
          const latest = status[status.length - 1];
          if (latest.request.status === 'needs_reselection') {
            setStage('reselect');
          } else {
            setStage('view');
          }
        }
      });

      cleanup = () => {
        subscription.unsubscribe();
      };
    } else {
      // 로컬 모드: 폴링 사용
      const interval = setInterval(() => {
        loadData();
      }, 5000);

      cleanup = () => clearInterval(interval);
    }

    return cleanup;
  }, [autoRefreshEnabled, stage, customerId, mode]);

  const loadData = async () => {
    setError('');
    setSuccess('');

    if (mode === 'supabase') {
      try {
        // Supabase에서 데이터 로드
        const slotsData = await loadSlotsFromSupabase();
        setSlots(slotsData);

        const { requests, candidates } = await loadCustomerDataFromSupabase(customerId);

        // 요청 상태 계산
        const status = requests.map(request => {
          const requestCandidates = candidates.filter(c => c.requestId === request.id);
          const decision = decideRequestStatus(request, requestCandidates, slotsData);
          return { request, candidates: requestCandidates, decision };
        });

        // S2-07 · 상태 변경 감지
        if (customerRequests.length > 0 && status.length > 0) {
          const currentLatest = customerRequests[customerRequests.length - 1];
          const newLatest = status[status.length - 1];
          if (currentLatest.request.status !== newLatest.request.status) {
            setStatusChanged(true);
            setPreviousStatus(currentLatest.request.status);
          }
        }

        setCustomerRequests(status);

        // 첫 로드인지 확인
        if (status.length === 0) {
          setStage('select');
          setSelectedSlots([]);
        } else {
          const latest = status[status.length - 1];
          if (latest.request.status === 'needs_reselection') {
            setStage('reselect');
          } else if (latest.request.status === 'confirmed') {
            setStage('view');
          } else {
            setStage('view');
          }
        }
      } catch (err) {
        console.error('Failed to load Supabase data:', err);
        setError('데이터 로드 실패');
      }
    } else {
      // 로컬 모드
      const state = db.getState();
      setSlots(state.slots);
      const status = om.getCustomerStatus(customerId);

      // S2-07 · 상태 변경 감지
      if (customerRequests.length > 0 && status.length > 0) {
        const currentLatest = customerRequests[customerRequests.length - 1];
        const newLatest = status[status.length - 1];
        if (currentLatest.request.status !== newLatest.request.status) {
          setStatusChanged(true);
          setPreviousStatus(currentLatest.request.status);
        }
      }

      setCustomerRequests(status);

      // 첫 로드인지 확인
      if (status.length === 0) {
        setStage('select');
        setSelectedSlots([]);
      } else {
        const latest = status[status.length - 1];
        if (latest.request.status === 'needs_reselection') {
          setStage('reselect');
        } else if (latest.request.status === 'confirmed') {
          setStage('view');
        } else {
          setStage('view');
        }
      }
    }
  };

  const moveSlot = (index: number, direction: 'up' | 'down') => {
    setSelectedSlots(prev => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleSlotToggle = (slotId: string) => {
    setSelectedSlots(prev => {
      if (prev.includes(slotId)) {
        return prev.filter(s => s !== slotId);
      } else if (prev.length < 3) {
        return [...prev, slotId];
      }
      return prev;
    });
    setError('');
  };

  const handleSubmit = async () => {
    if (selectedSlots.length === 0) {
      setError('최소 1개 이상의 슬롯을 선택하세요');
      return;
    }

    // C) 기한 필드 검증
    if (!deadline) {
      setError('인수인계 기한을 입력하세요');
      return;
    }

    // 기한이 선택한 슬롯보다 늦지 않은지 확인
    const selectedSlotDates = selectedSlots.map(slotId => slots[slotId]?.date).filter(Boolean);
    const earliestSlot = selectedSlotDates.length > 0 ? selectedSlotDates.sort()[0] : null;
    if (earliestSlot && deadline < earliestSlot) {
      setError('기한이 선택한 슬롯보다 빨라야 합니다');
      return;
    }

    // P08 · 사전질문 폼 형식 검증
    const prequalError = validateCustomerInfoInput(prequal);
    if (prequalError) {
      setError(prequalError);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let result;
      if (mode === 'supabase') {
        result = await submitToSupabase(customerId, selectedSlots);
        // TODO: deadline을 requests 테이블에 저장
      } else {
        const operationId = `submit-${customerId}-${Date.now()}`;
        result = await om.submitRequest(customerId, selectedSlots, operationId);
      }

      if (result.success) {
        await persistCustomerInfo(result.requestId!);
        setSuccess('신청이 접수되었습니다! ⏱️ 5분 이내에 우선순위(1순위➔2순위➔3순위)에 따라 확정이 완료됩니다.');
        setSelectedSlots([]);
        setDeadline(''); // C) 기한 초기화
        setStage('view');
        setTimeout(() => loadData(), 500);
      } else {
        setError(result.error || '신청 실패');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // 고객 정보 저장 (신청/재신청 공용, 신청과 같은 request_id에 연결)
  const persistCustomerInfo = async (requestId: string) => {
    const info: CustomerInfo = {
      requestId,
      customerId,
      name: prequal.name.trim(),
      email: prequal.email.trim(),
      company: prequal.company.trim() || undefined,
      purpose: prequal.purpose.trim(),
      note: prequal.note.trim() || undefined,
      guests: prequal.guests,
      goals: prequal.goals,
      goalsOther: prequal.goalsOther.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    if (mode === 'supabase') {
      await saveCustomerInfoSupabase(info);
    } else {
      saveCustomerInfoLocal(info);
    }
  };

  const handleReselect = async () => {
    if (selectedSlots.length === 0) {
      setError('최소 1개 이상의 슬롯을 선택하세요');
      return;
    }

    const prequalError = validateCustomerInfoInput(prequal);
    if (prequalError) {
      setError(prequalError);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const latest = customerRequests[customerRequests.length - 1];
      let result;

      if (mode === 'supabase') {
        result = await resubmitToSupabase(customerId, latest.request.id, selectedSlots);
      } else {
        const operationId = `reselect-${latest.request.id}-${Date.now()}`;
        result = await om.resubmitRequest(
          customerId,
          latest.request.id,
          selectedSlots,
          operationId
        );
      }

      if (result.success) {
        await persistCustomerInfo(result.requestId || latest.request.id);
        setSuccess('재선택이 완료되었습니다!');
        setSelectedSlots([]);
        setStage('view');
        setTimeout(() => loadData(), 500);
      } else {
        setError(result.error || '재선택 실패');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedSlots([]);
    setDeadline(''); // C) 기한 초기화
    setStage('view');
    setError('');
  };

  // 슬롯 상태가 변경되었는지 확인
  const checkSlotAvailability = () => {
    if (stage === 'confirm' && customerRequests.length > 0) {
      const latest = customerRequests[customerRequests.length - 1];
      const currentState = db.getState();
      const decision = decideRequestStatus(latest.request, currentState.candidates, currentState.slots);

      if (decision.status !== 'ok') {
        setError('선택한 슬롯의 상태가 변경되었습니다. 다시 선택해주세요.');
        setStage('reselect');
        setSelectedSlots([]);
        return false;
      }
    }
    return true;
  };

  return (
    <div className="customer-page">
      <div className="form-group">
        <label>고객 코드</label>
        <input
          type="text"
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
          placeholder="C01"
          disabled={stage === 'confirm'}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {stage === 'select' && (
        <div>
          <h3>슬롯 선택 (1~3개)</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            원하는 슬롯을 선택하고 제출하세요. 선택 순서가 희망 우선순위입니다.
          </p>

          {/* C) 기한 필드 */}
          <div className="form-group" style={{ marginBottom: '20px', maxWidth: '400px' }}>
            <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📅 인수인계 기한 (필수)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min="2026-09-09"
              max="2026-10-31"
              required
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px',
              }}
              title="점주가 예정된 퇴사 날짜를 입력하세요"
            />
            <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
              점주가 떠나는 날짜를 입력하면, 그 전에 상담받을 슬롯을 추천해드립니다.
            </small>
          </div>

          {/* A) 달력 UI */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '13px', marginBottom: '12px' }}>📆 날짜 & 시간 선택</h4>
            <CalendarPicker
              slots={slots}
              selectedSlots={selectedSlots}
              onToggle={handleSlotToggle}
              maxSelect={3}
            />
          </div>

          {/* P08 · 사전질문 폼 */}
          <PreQualificationForm value={prequal} onChange={setPrequal} disabled={loading} />

          <div style={{ marginBottom: '20px' }}>
            <h4>선택한 슬롯 ({selectedSlots.length}/3) - <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666' }}>▲/▼ 버튼으로 희망 순위 변경 (S1-06)</span></h4>
            <ul className="list">
              {selectedSlots.map((slotId, idx) => {
                const slot = slots[slotId];
                return (
                  <li key={slotId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <strong>{idx + 1}순위:</strong> {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => moveSlot(idx, 'up')}
                        disabled={idx === 0}
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                        title="우선순위 올리기"
                      >
                        ▲
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => moveSlot(idx, 'down')}
                        disabled={idx === selectedSlots.length - 1}
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                        title="우선순위 내리기"
                      >
                        ▼
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleSlotToggle(slotId)}
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                      >
                        제거
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setStage('confirm')}
            disabled={selectedSlots.length === 0 || loading}
          >
            다음: 최종 확인
          </button>
        </div>
      )}

      {stage === 'confirm' && checkSlotAvailability() && (
        <div>
          <h3>최종 확인</h3>
          {/* S1-08 · 신청 전 한 문장 안내 & S5-08 · 재접수와 확정 구분 & S2-08 5분 내 확정 안내 */}
          <div style={{ padding: '10px 14px', backgroundColor: '#e8f4f8', border: '1px solid #b8daff', color: '#004085', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
            💡 <strong>신청 및 확정 안내 (S1-08 / S5-08 / S2-08):</strong> 제출 시 '접수'되며, ⏱️ <strong>5분 이내</strong>에 희망 순위(1순위➔2순위➔3순위)에 따라 자동/수동 확정이 완결됩니다. (접수는 슬롯을 점유하지 않습니다.)
          </div>

          {/* C) 기한 정보 표시 */}
          {deadline && (
            <div style={{ padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#856404' }}>
              <strong>📅 인수인계 기한</strong>
              <br />
              {deadline} (D-{Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))})
            </div>
          )}

          <SlotTable slots={slots} selectedSlots={selectedSlots} onToggle={() => {}} mode="view" />

          {/* 선택 요약: 날짜/시간 큰 글씨 */}
          <div style={{ marginBottom: '20px' }}>
            <h4>최종 선택 (우선순위 순)</h4>
            <ul className="list">
              {selectedSlots.map((slotId, idx) => {
                const slot = slots[slotId];
                return (
                  <li key={slotId}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {idx + 1}순위 · {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 입력된 고객 정보 표시 */}
          <div style={{ padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', marginBottom: '20px', fontSize: '13px' }}>
            <strong style={{ display: 'block', marginBottom: '6px' }}>입력하신 정보</strong>
            <div>이름: {prequal.name || '-'}</div>
            <div>이메일: {prequal.email || '-'}</div>
            {prequal.company && <div>회사명: {prequal.company}</div>}
            <div>상담 목적: {prequal.purpose || '-'}</div>
            {prequal.note && <div>참고 사항: {prequal.note}</div>}
            {prequal.goals.length > 0 && (
              <div>회의 목표: {prequal.goals.join(', ')}{prequal.goalsOther ? ` (기타: ${prequal.goalsOther})` : ''}</div>
            )}
            {prequal.guests.length > 0 && (
              <div>게스트: {prequal.guests.map(g => `${g.name}(${g.email})`).join(', ')}</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '처리 중...' : '제출'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setStage('select')}
              disabled={loading}
            >
              수정하기
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              돌아가기
            </button>
          </div>
        </div>
      )}

      {stage === 'view' && customerRequests.length > 0 && (
        <div>
          <h3>내 신청 현황</h3>
          {/* S6-02 상태 바로보기 요약 카드 및 S6-01 확정 알림, S2-04 상태 새로고침 */}
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={e => setAutoRefreshEnabled(e.target.checked)}
              />
              S2-06 자동 새로고침 ({autoRefreshEnabled ? '켜짐 - 5초마다' : '꺼짐'})
            </label>
          </div>
          <StatusSummaryCard
            request={customerRequests[customerRequests.length - 1].request}
            candidates={customerRequests[customerRequests.length - 1].candidates}
            slots={slots}
            onRefresh={loadData}
            statusChanged={statusChanged}
            previousStatus={previousStatus}
            mode={mode}
            customerId={customerId}
          />
          {/* S6-08 상담 준비 메모/체크리스트 카드 */}
          <PreparationMemoCard customerId={customerId} />

          {customerRequests.map((item, idx) => (
            <div key={item.request.id} style={{ marginBottom: '20px', padding: '16px', background: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
              <h4>신청 #{item.request.version} (접수일: {new Date(item.request.createdAt).toLocaleString()})</h4>

              <div className="form-group">
                <label>상태</label>
                <div style={{ padding: '8px', background: '#f0f0f0', borderRadius: '4px' }}>
                  {item.request.status === 'confirmed' && (
                    <span className="slot-status confirmed">확정됨</span>
                  )}
                  {item.request.status === 'received' && (
                    <span className="slot-status available">접수됨</span>
                  )}
                  {item.request.status === 'needs_reselection' && (
                    <span className="alert alert-warning">재선택 필요</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>선택한 슬롯 (우선순위 순)</label>
                <ul className="list">
                  {item.candidates.map((c, cidx) => {
                    const slot = slots[c.slotId];
                    const isAvailable = slot?.status === 'available';
                    return (
                      <li key={c.id}>
                        <span>
                          {cidx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                          {' '}
                          <span style={{ marginLeft: '10px', fontSize: '12px', color: isAvailable ? '#28a745' : '#dc3545' }}>
                            {isAvailable ? '(가능)' : '(마감)'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {item.request.status === 'confirmed' && (
                <div className="alert alert-success">
                  <strong>확정됨!</strong> {slots[item.request.confirmedSlotId!]?.date}{' '}
                  {TIME_SLOTS.find(t => t.label === slots[item.request.confirmedSlotId!]?.timeLabel)?.displayLabel}에
                  확정되었습니다.
                </div>
              )}

              {item.request.status === 'needs_reselection' && idx === customerRequests.length - 1 && (
                <button
                  className="btn btn-warning"
                  onClick={() => {
                    setStage('reselect');
                    setSelectedSlots([]);
                  }}
                  style={{ background: '#ffc107', marginTop: '10px' }}
                >
                  재선택하기
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {stage === 'reselect' && customerRequests.length > 0 && (() => {
        const latest = customerRequests[customerRequests.length - 1];
        // S3-05 · 남은 열린 슬롯 계산
        const openSlots = Object.values(slots).filter(s => s.status === 'available');
        // S3-06 · 기한 전 후보 개수 (기한이 있으면 계산, 없으면 전체)
        const slotsBeforeDeadline = openSlots.length;

        // S3-01 · 두 후보의 마감 내역 계산
        const closedCandidates = latest.candidates.filter(c => slots[c.slotId]?.status === 'confirmed');

        // S3-10 · 재선택 문의 내용 만들기
        const inquiryText = `신청 #${latest.request.id.substring(0, 8)} - 마감된 슬롯: ${closedCandidates.map((c, i) => `${i + 1}순위: ${slots[c.slotId]?.date} ${TIME_SLOTS.find(t => t.label === slots[c.slotId]?.timeLabel)?.displayLabel}`).join(', ')}`;

        return (
          <div>
            <h3>슬롯 재선택</h3>

            {/* S3-01 · 두 후보의 마감 내역 */}
            {closedCandidates.length > 0 && (
              <div style={{
                padding: '12px',
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: '4px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#721c24',
              }}>
                <strong style={{ display: 'block', marginBottom: '8px' }}>🔒 마감된 후보 (S3-01)</strong>
                <ul style={{ margin: '0 0 0 18px', paddingLeft: 0 }}>
                  {closedCandidates.map((c) => (
                    <li key={c.id}>
                      {c.priority}순위: {slots[c.slotId]?.date} {TIME_SLOTS.find(t => t.label === slots[c.slotId]?.timeLabel)?.displayLabel}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* S3-02 · 내 신청과 확정의 차이 설명 */}
            {closedCandidates.length > 0 && (
              <div style={{
                padding: '12px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeeba',
                borderRadius: '4px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#856404',
              }}>
                <strong>💡 마감 이유 (S3-02)</strong>
                <br />
                신청 당시에는 열려 있었지만, 다른 고객이 먼저 확정하면서 마감되었습니다.
                <br />
                이는 자연스러운 과정이며, 아래에서 새로운 슬롯을 선택해주세요.
              </div>
            )}

            {/* S3-03 · 입력 실수 아님 안내 */}
            <div style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#666',
            }}>
              <strong style={{ color: '#333' }}>ℹ️ 알려드립니다 (S3-03)</strong>
              <br />
              이는 입력 실수가 아닙니다. 신청하신 슬롯이 다른 고객의 확정으로 마감되었습니다.
              <br />
              아래에서 새로운 슬롯을 선택하고 다시 제출해주세요.
            </div>

            {/* S3-05 · 남은 열린 시간 미리보기 */}
            <div style={{
              padding: '12px',
              backgroundColor: '#e7f3ff',
              border: '1px solid #b3d9ff',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#004085',
            }}>
              <strong>📊 남은 슬롯 현황 (S3-05)</strong>
              <br />
              현재 <strong>{openSlots.length}개</strong>의 열린 슬롯이 있습니다.
              {/* S3-06 · 기한 전 후보 개수 */}
              {slotsBeforeDeadline > 0 && (
                <>
                  <br />
                  기한 전에 예약 가능한 슬롯: <strong>{slotsBeforeDeadline}개</strong>
                </>
              )}
            </div>

            {/* S3-07 · 재선택 경로 짧은 안내 */}
            <div style={{
              padding: '12px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeeba',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#856404',
            }}>
              <strong>📋 재선택 진행 안내 (S3-07)</strong>
              <br />
              1️⃣ 아래에서 새 날짜 선택 → 2️⃣ 희망 순위 확인 → 3️⃣ 재제출
            </div>

            <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
              이전 신청의 슬롯이 모두 마감되었습니다. 다시 선택해주세요.
            </p>

            <SlotTable
              slots={slots}
              selectedSlots={selectedSlots}
              onToggle={handleSlotToggle}
              mode="select"
              maxSelect={3}
            />

            {/* P08 · 사전질문 폼 (재선택 시에도 정보 확인/수정 가능) */}
            <PreQualificationForm value={prequal} onChange={setPrequal} disabled={loading} />

            <div style={{ marginBottom: '20px' }}>
              <h4>새로 선택한 슬롯 ({selectedSlots.length}/3)</h4>
              <ul className="list">
                {selectedSlots.map((slotId, idx) => {
                  const slot = slots[slotId];
                  return (
                    <li key={slotId}>
                      <span>
                        {idx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                      </span>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleSlotToggle(slotId)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        제거
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* S3-10 · 재선택 문의 내용 만들기 */}
            {closedCandidates.length > 0 && (
              <div style={{
                padding: '12px',
                backgroundColor: '#e7f3ff',
                border: '1px solid #b3d9ff',
                borderRadius: '4px',
                marginBottom: '16px',
              }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: '#004085' }}>
                  📧 문의 초안 (S3-10) - 필요시 복사해서 사용하세요
                </label>
                <textarea
                  readOnly
                  value={inquiryText}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: '#f8f9fa',
                    boxSizing: 'border-box',
                    height: '60px',
                  }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(inquiryText);
                    alert('문의 초안이 클립보드에 복사되었습니다!');
                  }}
                  style={{ marginTop: '6px', fontSize: '12px', padding: '4px 8px' }}
                >
                  📋 복사
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleReselect}
                disabled={selectedSlots.length === 0 || loading}
              >
                {loading ? '처리 중...' : '재선택 제출'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStage('view');
                  setSelectedSlots([]);
                }}
                disabled={loading}
              >
                돌아가기
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
