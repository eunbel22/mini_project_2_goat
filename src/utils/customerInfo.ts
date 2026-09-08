// P08 · 사전질문 폼 + 고객 정보 저장/조회 (로컬 모드)
// 주의: 보호 대상 파일(types.ts, decide.ts, database.ts)은 건드리지 않고
// 별도 스토리지 키에 저장한다. 신청(Request)의 확정 판정 로직과는 무관하다.

export interface Guest {
  name: string;
  email: string;
}

export const MEETING_GOALS = [
  '매출/재무 현황 점검',
  '인수인계 절차 안내',
  '계약서/서류 검토',
  '운영 노하우 전달',
  '기타 문의',
] as const;

export interface CustomerInfo {
  requestId: string; // 로컬 모드에서는 제출 직후 발급된 request.id
  customerId: string;
  name: string;
  email: string;
  company?: string;
  purpose: string; // 상담 목적/과제
  note?: string; // 추가 참고 사항
  guests: Guest[]; // 최대 5명
  goals: string[]; // MEETING_GOALS 중 복수 선택
  goalsOther?: string;
  updatedAt: string; // ISO 8601
}

export const MAX_GUESTS = 5;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// P08 형식 검증: 이름/이메일 필수, 이메일 형식, 게스트 인원/형식
export function validateCustomerInfoInput(input: {
  name: string;
  email: string;
  purpose: string;
  guests: Guest[];
}): string | null {
  if (!input.name.trim()) {
    return '이름을 입력하세요';
  }
  if (!input.email.trim()) {
    return '이메일을 입력하세요';
  }
  if (!isValidEmail(input.email)) {
    return '이메일 형식이 올바르지 않습니다';
  }
  if (!input.purpose.trim()) {
    return '상담 목적/과제를 입력하세요';
  }
  if (input.guests.length > MAX_GUESTS) {
    return `게스트는 최대 ${MAX_GUESTS}명까지 추가할 수 있습니다`;
  }
  for (const guest of input.guests) {
    if (!guest.name.trim()) {
      return '게스트 이름을 입력하세요';
    }
    if (!isValidEmail(guest.email)) {
      return '게스트 이메일 형식이 올바르지 않습니다';
    }
  }
  return null;
}

const STORAGE_KEY = 'cal_dudu_customer_info';

function loadAll(): Record<string, CustomerInfo> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (e) {
    // localStorage 오류 무시
  }
  return {};
}

function saveAll(data: Record<string, CustomerInfo>): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    // localStorage 오류 무시
  }
}

export function saveCustomerInfoLocal(info: CustomerInfo): void {
  const all = loadAll();
  all[info.requestId] = info;
  saveAll(all);
}

export function getCustomerInfoLocal(requestId: string): CustomerInfo | undefined {
  return loadAll()[requestId];
}

// 재신청 시 자동 입력: 같은 고객의 가장 최근 저장 정보
export function getLatestCustomerInfoByCustomerId(customerId: string): CustomerInfo | undefined {
  const all = Object.values(loadAll()).filter(info => info.customerId === customerId);
  if (all.length === 0) return undefined;
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

// 어드민 조회용
export function getAllCustomerInfoLocal(): CustomerInfo[] {
  return Object.values(loadAll());
}
