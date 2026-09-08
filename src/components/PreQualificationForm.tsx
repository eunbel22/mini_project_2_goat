import React from 'react';
import { MEETING_GOALS, MAX_GUESTS, type Guest } from '../utils/customerInfo';

export interface PreQualificationValue {
  name: string;
  email: string;
  company: string;
  purpose: string;
  note: string;
  guests: Guest[];
  goals: string[];
  goalsOther: string;
}

interface PreQualificationFormProps {
  value: PreQualificationValue;
  onChange: (value: PreQualificationValue) => void;
  disabled?: boolean;
}

export const PreQualificationForm: React.FC<PreQualificationFormProps> = ({ value, onChange, disabled }) => {
  const update = (patch: Partial<PreQualificationValue>) => onChange({ ...value, ...patch });

  const toggleGoal = (goal: string) => {
    const has = value.goals.includes(goal);
    update({ goals: has ? value.goals.filter(g => g !== goal) : [...value.goals, goal] });
  };

  const addGuest = () => {
    if (value.guests.length >= MAX_GUESTS) return;
    update({ guests: [...value.guests, { name: '', email: '' }] });
  };

  const updateGuest = (idx: number, patch: Partial<Guest>) => {
    const guests = value.guests.map((g, i) => (i === idx ? { ...g, ...patch } : g));
    update({ guests });
  };

  const removeGuest = (idx: number) => {
    update({ guests: value.guests.filter((_, i) => i !== idx) });
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ fontSize: '13px', marginBottom: '12px' }}>사전질문 (P08)</h4>

      <div className="form-group">
        <label>이름 (필수)</label>
        <input
          type="text"
          value={value.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="홍길동"
          disabled={disabled}
        />
      </div>

      <div className="form-group">
        <label>이메일 (필수)</label>
        <input
          type="email"
          value={value.email}
          onChange={e => update({ email: e.target.value })}
          placeholder="example@email.com"
          disabled={disabled}
        />
      </div>

      <div className="form-group">
        <label>회사명 (선택)</label>
        <input
          type="text"
          value={value.company}
          onChange={e => update({ company: e.target.value })}
          placeholder="회사명"
          disabled={disabled}
        />
      </div>

      <div className="form-group">
        <label>상담 목적/과제 (필수)</label>
        <textarea
          value={value.purpose}
          onChange={e => update({ purpose: e.target.value })}
          placeholder="상담받고 싶은 내용을 적어주세요"
          disabled={disabled}
          rows={3}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
      </div>

      <div className="form-group">
        <label>추가 참고 사항 (선택)</label>
        <textarea
          value={value.note}
          onChange={e => update({ note: e.target.value })}
          placeholder="참고할 내용이 있다면 적어주세요"
          disabled={disabled}
          rows={2}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
      </div>

      <div className="form-group">
        <label>회의 목표 (복수 선택 가능)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {MEETING_GOALS.map(goal => (
            <label key={goal} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={value.goals.includes(goal)}
                onChange={() => toggleGoal(goal)}
                disabled={disabled}
              />
              {goal}
            </label>
          ))}
        </div>
        {value.goals.includes('기타 문의') && (
          <input
            type="text"
            value={value.goalsOther}
            onChange={e => update({ goalsOther: e.target.value })}
            placeholder="기타 내용을 입력하세요"
            disabled={disabled}
            style={{ marginTop: '6px' }}
          />
        )}
      </div>

      <div className="form-group">
        <label>게스트 추가 (선택, 최대 {MAX_GUESTS}명)</label>
        {value.guests.map((guest, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
            <input
              type="text"
              value={guest.name}
              onChange={e => updateGuest(idx, { name: e.target.value })}
              placeholder="게스트 이름"
              disabled={disabled}
              style={{ flex: 1 }}
            />
            <input
              type="email"
              value={guest.email}
              onChange={e => updateGuest(idx, { email: e.target.value })}
              placeholder="게스트 이메일"
              disabled={disabled}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => removeGuest(idx)}
              disabled={disabled}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              제거
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addGuest}
          disabled={disabled || value.guests.length >= MAX_GUESTS}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        >
          + 게스트 추가 ({value.guests.length}/{MAX_GUESTS})
        </button>
      </div>
    </div>
  );
};

export function createEmptyPreQualificationValue(): PreQualificationValue {
  return { name: '', email: '', company: '', purpose: '', note: '', guests: [], goals: [], goalsOther: '' };
}
