import React, { useState } from 'react';
import type { Slot } from '../types';
import { TIME_SLOTS, getAllDates } from '../utils/constants';

interface SlotTableProps {
  slots: Record<string, Slot>;
  selectedSlots: string[];
  onToggle: (slotId: string) => void;
  maxSelect?: number;
  mode: 'view' | 'select';
}

export const SlotTable: React.FC<SlotTableProps> = ({
  slots,
  selectedSlots,
  onToggle,
  maxSelect = 3,
  mode = 'view',
}) => {
  const dates = getAllDates();
  const [filterTime, setFilterTime] = useState<'all' | 'am' | 'pm' | 'evening'>('all');

  const visibleTimeSlots = filterTime === 'all' 
    ? TIME_SLOTS 
    : TIME_SLOTS.filter(t => t.label === filterTime);

  return (
    <div className="table-container">
      {/* S4-03 · 오전·오후·저녁 시간대 필터 */}
      <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555' }}>🕒 시간대 필터 (S4-03):</span>
        <button
          className={`btn ${filterTime === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '3px 10px', fontSize: '12px' }}
          onClick={() => setFilterTime('all')}
        >
          전체 보기
        </button>
        {TIME_SLOTS.map(t => (
          <button
            key={t.label}
            className={`btn ${filterTime === t.label ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '3px 10px', fontSize: '12px' }}
            onClick={() => setFilterTime(t.label as any)}
          >
            {t.displayLabel}
          </button>
        ))}
      </div>

      <table className="slots-table">
        <thead>
          <tr>
            <th style={{ width: '120px' }}>날짜</th>
            {visibleTimeSlots.map(slot => (
              <th key={slot.label} style={{ width: '140px' }}>
                {slot.displayLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map(date => (
            <tr key={date}>
              <td>{date}</td>
              {visibleTimeSlots.map(timeSlot => {
                const slotId = `${date}:${timeSlot.label}`;
                const slot = slots[slotId];
                const isSelected = selectedSlots.includes(slotId);
                const isConfirmed = slot?.status === 'confirmed';

                return (
                  <td key={slotId}>
                    {mode === 'view' ? (
                      <span className={`slot-status ${slot?.status || 'available'}`}>
                        {slot?.status === 'confirmed' ? '마감' : '가능'}
                      </span>
                    ) : (
                      <>
                        <input
                          type="checkbox"
                          className="slot-checkbox"
                          checked={isSelected}
                          onChange={() => onToggle(slotId)}
                          disabled={isConfirmed || (!isSelected && selectedSlots.length >= maxSelect)}
                          title={isConfirmed ? '마감됨' : ''}
                        />
                        <span style={{ marginLeft: '6px', fontSize: '12px' }}>
                          {isConfirmed ? '마감' : '가능'}
                        </span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
