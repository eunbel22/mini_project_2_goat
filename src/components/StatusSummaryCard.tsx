import React, { useState } from 'react';
import type { Request, Candidate, Slot } from '../types';
import { TIME_SLOTS } from '../utils/constants';

interface StatusSummaryCardProps {
  request: Request;
  candidates: Candidate[];
  slots: Record<string, Slot>;
  onRefresh?: () => void;
}

export const StatusSummaryCard: React.FC<StatusSummaryCardProps> = ({ request, candidates, slots, onRefresh }) => {
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(true);
  const [lastUpdated] = useState<string>(new Date().toLocaleTimeString());

  const confirmedSlot = request.confirmedSlotId ? slots[request.confirmedSlotId] : null;

  return (
    <div style={{
      padding: '16px',
      marginBottom: '16px',
      borderRadius: '6px',
      border: request.status === 'confirmed' ? '2px solid #28a745' : '1px solid #ccc',
      backgroundColor: request.status === 'confirmed' ? '#f4fbf6' : '#ffffff',
    }}>
      {/* S6-01 · 확정 시 고객 알림 배너 */}
      {request.status === 'confirmed' && confirmedSlot && (
        <div className="alert alert-success" style={{ marginBottom: '12px', fontSize: '15px' }}>
          <strong>🎉 예약 확정 안내 (S6-01)</strong>
          <br />
          요청하신 상담이 <strong>{confirmedSlot.date} {TIME_SLOTS.find(t => t.label === confirmedSlot.timeLabel)?.displayLabel}</strong> 슬롯으로 확정되었습니다!
        </div>
      )}

      {/* S6-09 · 확정되면 할 일 목록 */}
      {request.status === 'confirmed' && (
        <div style={{ padding: '10px 14px', backgroundColor: '#e2f0d9', border: '1px solid #c5e1a5', borderRadius: '4px', marginBottom: '12px', fontSize: '13px' }}>
          <strong style={{ color: '#2e7d32', display: 'block', marginBottom: '6px' }}>📋 확정 후 진행 가이드 (S6-09)</strong>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#333' }}>
            <li>1단계: 상담 10분 전 서점 위치 및 교통편 재확인</li>
            <li>2단계: 작성해 둔 자료/질문 메모장 (S6-08) 검토</li>
            <li>3단계: 상담 종료 후 점주와 양도/인수인계 일정 최종 협의</li>
          </ul>
        </div>
      )}

      {/* S6-02 · 내 신청 상태 바로보기 & S2-04 마지막 갱신 시각 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <h4 style={{ margin: 0, display: 'inline-block' }}>내 신청 상태 요약 (v{request.version})</h4>
          <span style={{ fontSize: '11px', color: '#777', marginLeft: '8px' }}>
            (S2-04 조회 시각: {lastUpdated})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onRefresh && (
            <button
              className="btn btn-secondary"
              onClick={onRefresh}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              title="최신 상태 갱신"
            >
              🔄 지금 다시 확인 (S2-04)
            </button>
          )}
          <span style={{
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#fff',
            backgroundColor: request.status === 'confirmed' ? '#28a745' : request.status === 'needs_reselection' ? '#dc3545' : '#17a2b8',
          }}>
            {request.status === 'confirmed' ? '확정됨' : request.status === 'needs_reselection' ? '재선택 필요' : '확정 대기 중'}
          </span>
        </div>
      </div>

      {/* S6-03 · 알림 수신 여부 표시 */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>확정 알림 수신 상태 (S6-03):</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={notifyEnabled}
            onChange={e => setNotifyEnabled(e.target.checked)}
          />
          {notifyEnabled ? '알림 수신 켜짐' : '알림 수신 꺼짐'}
        </label>
      </div>

      {/* S6-10 · 아직 미확정이라는 일정 메모 */}
      {request.status === 'received' && (
        <div style={{ padding: '8px 12px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: '4px', fontSize: '13px', marginBottom: '12px' }}>
          ℹ️ <strong>일정 참고 (S6-10):</strong> 신청한 후보 슬롯은 <em>'확정 대기'</em> 상태이며, 아직 예약이 확정되지 않았습니다. 관리자 확정 전까지 개인 일정을 조율해 주세요.
        </div>
      )}

      <div style={{ fontSize: '13px', color: '#444' }}>
        <strong>신청 희망 후보 ({candidates.length}개):</strong>
        <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
          {candidates.map((c, idx) => {
            const slot = slots[c.slotId];
            const isConfirmedThis = request.confirmedSlotId === c.slotId;
            return (
              <li key={c.id} style={{ fontWeight: isConfirmedThis ? 'bold' : 'normal', color: isConfirmedThis ? '#28a745' : 'inherit' }}>
                {idx + 1}순위: {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                {isConfirmedThis && ' ★ (확정된 슬롯)'}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
