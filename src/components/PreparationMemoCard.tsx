import React, { useState, useEffect } from 'react';

interface PreparationMemoCardProps {
  customerId: string;
}

export const PreparationMemoCard: React.FC<PreparationMemoCardProps> = ({ customerId }) => {
  const storageKey = `prep_memo_${customerId}`;
  const [memoText, setMemoText] = useState<string>('');
  const [checklist, setChecklist] = useState<{ id: string; text: string; done: boolean }[]>([
    { id: '1', text: '기존 서점 재고 목록 엑셀 정리', done: false },
    { id: '2', text: '최근 6개월 주문/매출 기록 자료 준비', done: false },
    { id: '3', text: '인수인계 기한 및 양수 일정 확인', done: false },
    { id: '4', text: '상담 시 점주에게 물어볼 질문 목록 작성', done: false },
  ]);
  const [savedMsg, setSavedMsg] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.memoText !== undefined) setMemoText(parsed.memoText);
        if (parsed.checklist !== undefined) setChecklist(parsed.checklist);
      } catch (e) {
        console.error('Failed to parse saved prep memo:', e);
      }
    }
  }, [customerId]);

  const handleSave = () => {
    const data = { memoText, checklist };
    localStorage.setItem(storageKey, JSON.stringify(data));
    setSavedMsg('메모가 저장되었습니다!');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const toggleCheck = (id: string) => {
    setChecklist(prev =>
      prev.map(item => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  return (
    <div style={{
      padding: '16px',
      marginBottom: '16px',
      borderRadius: '6px',
      border: '1px solid #cce5ff',
      backgroundColor: '#f8f9fa',
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#004085' }}>
        📝 상담 준비 및 전달 자료 메모 (S6-08)
      </h4>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
        상담 확정을 기다리는 동안 서점 인수인계 관련 자료와 준비사항을 미리 체크하고 남겨두세요.
      </p>

      <div style={{ marginBottom: '12px' }}>
        <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          필수 인수인계 자료 체크리스트
        </strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {checklist.map(item => (
            <label key={item.id} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleCheck(item.id)}
              />
              <span style={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#888' : '#333' }}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
          상담 시 질의사항 / 추가 메모
        </label>
        <textarea
          rows={3}
          value={memoText}
          onChange={e => setMemoText(e.target.value)}
          placeholder="인수인계 관련 문의사항이나 전달할 자료 세부사항을 기록하세요..."
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          className="btn btn-secondary"
          onClick={handleSave}
          style={{ fontSize: '12px', padding: '4px 12px' }}
        >
          메모 저장
        </button>
        {savedMsg && <span style={{ fontSize: '12px', color: '#28a745', fontWeight: 'bold' }}>{savedMsg}</span>}
      </div>
    </div>
  );
};
