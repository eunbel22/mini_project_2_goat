import React, { useState } from 'react';
import type { Slot } from '../types';
import { TIME_SLOTS } from '../utils/constants';

interface CalendarPickerProps {
  slots: Record<string, Slot>;
  selectedSlots: string[];
  onToggle: (slotId: string) => void;
  maxSelect?: number;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  slots,
  selectedSlots,
  onToggle,
  maxSelect = 3,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 9)); // 2026-09-09

  // 월간 달력 생성
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // 선택된 날짜의 슬롯들
  const selectedDate = selectedSlots.length > 0 ? slots[selectedSlots[0]]?.date : null;
  const selectedDateSlots = selectedDate
    ? Object.values(slots).filter(s => s.date === selectedDate)
    : [];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // 각 날짜별 슬롯 가용성 확인
  const getDateSlots = (day: number) => {
    const dateStr = formatDate(year, month, day);
    return Object.values(slots).filter(s => s.date === dateStr);
  };

  const getDateAvailability = (day: number) => {
    const dateSlots = getDateSlots(day);
    if (dateSlots.length === 0) return 'no-slots';
    const hasAvailable = dateSlots.some(s => s.status === 'available');
    return hasAvailable ? 'available' : 'closed';
  };

  return (
    <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
      {/* 달력 */}
      <div style={{ flex: '0 0 350px' }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button
              className="btn btn-secondary"
              onClick={prevMonth}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              ◀
            </button>
            <strong style={{ fontSize: '14px' }}>
              {year}년 {month + 1}월
            </strong>
            <button
              className="btn btn-secondary"
              onClick={nextMonth}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              ▶
            </button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
            {['일', '월', '화', '수', '목', '금', '토'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#666' }}>
                {day}
              </div>
            ))}
          </div>

          {/* 달력 날짜 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }

              const dateStr = formatDate(year, month, day);
              const availability = getDateAvailability(day);
              const isSelected = selectedDate === dateStr;

              return (
                <button
                  key={day}
                  onClick={() => {
                    const dateSlots = getDateSlots(day);
                    if (dateSlots.length > 0 && availability !== 'no-slots') {
                      // 이 날짜의 모든 슬롯을 선택 (기존 선택 유지)
                      const firstSlot = dateSlots.find(s => s.status === 'available');
                      if (firstSlot) {
                        onToggle(firstSlot.id);
                      }
                    }
                  }}
                  disabled={availability === 'no-slots' || availability === 'closed'}
                  style={{
                    padding: '8px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: isSelected ? '2px solid #007bff' : '1px solid #ddd',
                    background: isSelected ? '#e7f3ff' : availability === 'closed' ? '#f5f5f5' : '#ffffff',
                    color: availability === 'closed' ? '#999' : '#333',
                    cursor: availability !== 'no-slots' && availability !== 'closed' ? 'pointer' : 'default',
                    fontWeight: isSelected ? 'bold' : 'normal',
                  }}
                  title={`${dateStr} (${availability === 'available' ? '가능' : '마감'})`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 시간 버튼 */}
      <div style={{ flex: 1 }}>
        {selectedDateSlots.length > 0 ? (
          <div>
            <h4 style={{ marginBottom: '12px', fontSize: '13px' }}>
              {selectedDate} 시간 선택
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {selectedDateSlots
                .sort((a, b) => {
                  const timeOrder = { am: 1, pm: 2, evening: 3 };
                  return (timeOrder[a.timeLabel as keyof typeof timeOrder] || 0) -
                    (timeOrder[b.timeLabel as keyof typeof timeOrder] || 0);
                })
                .map(slot => {
                  const isSelected = selectedSlots.includes(slot.id);
                  const isAvailable = slot.status === 'available';
                  const timeDisplay = TIME_SLOTS.find(t => t.label === slot.timeLabel)?.displayLabel;

                  return (
                    <button
                      key={slot.id}
                      onClick={() => {
                        if (isAvailable) {
                          onToggle(slot.id);
                        }
                      }}
                      disabled={!isAvailable}
                      style={{
                        padding: '10px 12px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: isSelected ? '2px solid #28a745' : '1px solid #ddd',
                        background: isSelected
                          ? '#d4edda'
                          : isAvailable
                          ? '#ffffff'
                          : '#f5f5f5',
                        color: isAvailable ? '#333' : '#999',
                        cursor: isAvailable ? 'pointer' : 'default',
                        fontWeight: isSelected ? 'bold' : 'normal',
                      }}
                    >
                      {timeDisplay}
                      {isSelected && ' ✓'}
                    </button>
                  );
                })}
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#666' }}>
              선택됨: {selectedSlots.length}/{maxSelect}
            </div>
          </div>
        ) : (
          <div style={{ color: '#999', fontSize: '13px' }}>
            날짜를 선택하면 시간을 고를 수 있습니다
          </div>
        )}
      </div>
    </div>
  );
};
