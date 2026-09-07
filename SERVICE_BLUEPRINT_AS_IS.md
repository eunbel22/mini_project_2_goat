# cal.dudu Service Blueprint (As-Is)

## 서비스 개요
**cal.dudu-works.com v1.0** - 예약 시스템 기본 실습 앱
- 42개 슬롯 (14일 × 3시간대): 09:00, 13:00, 18:00
- 예약 기간: 2026-09-09 ~ 2026-09-22
- 이중 모드: 로컬 (Demo) / Supabase (Production)

---

## 1️⃣ CUSTOMER JOURNEY (고객 여정)

### 로컬 모드 (Classroom Demo)
```
[입장] → [역할 선택] → [슬롯 조회] → [희망 신청] → [확인 제출]
         ↓                                        ↓
      고객/어드민                           로컬 스토리지 저장
         ↓
    [내 신청 조회] → [상태 확인] → [재선택 필요 시 재신청]
```

### Supabase 모드 (Production)
```
[회원가입/로그인] → [Auth 인증] → [역할 판정] → [슬롯 조회]
      ↓                           ↓
  이메일/비밀번호        admin/customer
   [희망 신청] → [RPC 호출] → [Supabase DB 저장]
      ↓
  [내 신청 조회] → [상태 확인] → [재선택 필요 시 재신청]
```

---

## 2️⃣ CUSTOMER ACTIONS (고객 행동)

### 고객 (Customer)
| 단계 | 행동 | 장소 |
|------|------|------|
| 1 | 서비스 접속 | 로컬 URL (/) 또는 Supabase URL (/supabase) |
| 2 | 인증 | 로컬: 역할 버튼 / Supabase: 이메일 로그인 |
| 3 | 슬롯 조회 | 42개 슬롯 표 (14일 × 3시간) |
| 4 | 희망 선택 | 1~3개 슬롯 선택 (드래그 또는 클릭) |
| 5 | 순위 확인 | 선택 목록에서 우선순위 확인 |
| 6 | 최종 제출 | "신청" 버튼 클릭 |
| 7 | 상태 조회 | "내 신청" 탭에서 확인 |
| 8 | 재선택 (필요시) | 모든 희망이 마감되면 재신청 |

### 어드민 (Admin)
| 단계 | 행동 | 장소 |
|------|------|------|
| 1 | 서비스 접속 | 로컬: 어드민 역할 선택 / Supabase: admin 계정 로그인 |
| 2 | 신청 목록 조회 | 모든 고객의 신청 순서대로 표시 |
| 3 | 고객 선택 | 신청 ID 클릭 |
| 4 | 희망 슬롯 확인 | 해당 고객의 1~3순위 슬롯 표시 |
| 5 | 슬롯 선택 | 1순위부터 수동 선택 |
| 6 | 확정 | "확정" 버튼 클릭 |
| 7 | 결과 확인 | 영향받은 고객 수 표시 (재선택 필요) |
| 8 | 기록 조회 | 실행 로그 (작업 ID, 요청 ID, 결과 등) |

---

## 3️⃣ TOUCHPOINTS (서비스 접점)

### Front Stage (고객이 보는 부분)
| 접점 | 로컬 모드 | Supabase 모드 |
|------|---------|--------------|
| **진입점** | `http://localhost:5187/` | `https://miniproject2goat.vercel.app/supabase` |
| **인증** | 역할 버튼 (고객/어드민) | 이메일 로그인 폼 |
| **슬롯 표시** | SlotTable 컴포넌트 (14행 × 3열) | 동일 |
| **신청 폼** | 선택 목록 + 제출 버튼 | RPC 호출 |
| **상태 조회** | localStorage 읽음 | Supabase 쿼리 |
| **오류 표시** | 빨간 alert | 빨간 alert + console 로그 |
| **성공 메시지** | 초록 alert | 초록 alert |

### Back Stage (고객이 안 보는 부분)
| 계층 | 로컬 모드 | Supabase 모드 |
|------|---------|--------------|
| **저장소** | `localStorage` (브라우저) | Supabase PostgreSQL |
| **인증** | In-memory (role state) | Supabase Auth (JWT) |
| **비즈니스 로직** | `operations.ts` (메모리) | `supabaseOperations.ts` (RPC 호출) |
| **판정 로직** | `decide.ts` (메모리) | SQL 함수 |
| **트랜잭션** | `db.beginTransaction()` | Supabase RPC (자동) |
| **동시성 제어** | JSON 깊은 복사 | DB 잠금 (Unique constraint) |

---

## 4️⃣ PHYSICAL EVIDENCE (물리적 증거)

### 로컬 모드
- **UI**: 기본 HTML 폼, 버튼, 표
- **데이터**: localStorage (JSON)
- **로그**: 콘솔 (DevTools)
- **상태**: 페이지 새로고침 후 유지

### Supabase 모드
- **UI**: 동일 HTML, 추가 로그인 폼
- **데이터**: Supabase 대시보드에서 조회 가능
- **로그**: operation_logs 테이블 + console
- **상태**: DB에 영구 저장

---

## 5️⃣ 핵심 프로세스 (Core Processes)

### 신청 프로세스 (Submit Request)
```
고객 선택 (1~3개)
    ↓
검증 (개수, 중복, 마감 여부)
    ↓
로컬: createRequest() 호출
Supabase: submit_request RPC 호출
    ↓
저장 (localStorage / DB)
    ↓
후보 저장 (version=1, priority 포함)
    ↓
성공 메시지 + 상태 갱신
```

### 확정 프로세스 (Confirm Request)
```
어드민이 고객의 희망 슬롯 선택
    ↓
검증 (요청 존재, 슬롯 유효, 이미 확정 아님)
    ↓
로컬: updateSlot() + updateRequest()
Supabase: confirm_request RPC 호출
    ↓
슬롯 마감 (status='confirmed')
    ↓
다른 고객의 후보 확인
  - 모든 희망이 마감 → 'needs_reselection'
  - 남은 희망 있음 → 'received' 유지
    ↓
기록 저장 (requestId, slotId, adminId 등)
    ↓
결과 메시지 + 로그 표시
```

### 재선택 프로세스 (Resubmit Request)
```
고객이 'needs_reselection' 상태 확인
    ↓
새 슬롯 선택 (1~3개)
    ↓
검증 (개수, 중복, 마감 여부)
    ↓
로컬: version++ + 새 후보 추가
Supabase: resubmit_request RPC 호출
    ↓
저장 (version=2, 이전 이력 보존)
    ↓
상태 → 'received'
    ↓
성공 메시지
```

---

## 6️⃣ 주요 특징 (Key Features)

### ✅ 구현됨
- **42개 고정 슬롯**: 14일 × 3시간대
- **이중 모드**: 로컬 (오프라인) / Supabase (온라인)
- **역할 기반 접근**: 고객 vs 어드민
- **1~3개 희망 신청**: 순위 지정
- **수동 확정**: 어드민이 일일이 확정
- **자동 재선택 판정**: 모든 희망 마감 시 자동 알림
- **버전 관리**: 재선택 시 version++ (이력 보존)
- **멱등성**: operationId로 중복 제출 방지
- **트랜잭션**: 한 확정의 모든 작업은 하나의 트랜잭션

### ❌ 미구현 (기본 범위 밖)
- 자동 확정
- 대기 (Waitlist)
- 알림 (이메일/SMS)
- 취소 기능
- RAG/Agent
- 결제
- 다중 서비스 관리

---

## 7️⃣ 에러 처리 & 안정성

| 상황 | 로컬 모드 | Supabase 모드 |
|------|---------|--------------|
| **신청 실패** | alert 표시 + 로그 | alert + console |
| **네트워크 오류** | N/A | "요청 실패" 메시지 |
| **동시 확정** | JSON 복사로 격리 | DB 제약 (Unique) |
| **조회 후 마감** | 제출 거절 + 재선택 | 제출 거절 + 재선택 |
| **Rate Limit** | N/A | 429 오류 표시 |
| **권한 없음** | N/A | 401 오류 + 로그아웃 |

---

## 8️⃣ 데이터 플로우

### 로컬 모드
```
Customer Browser
  ↓
localStorage (in-memory JSON)
  ↓
App.tsx (React State)
  ↓
DatabaseManager (in-memory copy)
  ↓
OperationManager (비즈니스 로직)
  ↓
localStorage (persist)
```

### Supabase 모드
```
Customer Browser
  ↓
Supabase Auth (JWT)
  ↓
Supabase API
  ↓
PostgreSQL (RPC 함수)
  ↓
submit_request / confirm_request / resubmit_request
  ↓
tables: slots, requests, candidates, confirmations, operation_logs
  ↓
Response (JSON)
  ↓
React State 갱신 + UI 업데이트
```

---

## 📍 Service Blueprint 매트릭스

```
┌─────────────────┬──────────────┬──────────────┐
│  레이어         │ 로컬 모드    │ Supabase 모드 │
├─────────────────┼──────────────┼──────────────┤
│ 사용자 진입점   │ localhost:5187/ │ /supabase  │
│ 인증            │ 버튼         │ Auth        │
│ UI             │ 동일         │ 동일        │
│ 데이터 저장소   │ localStorage  │ PostgreSQL  │
│ 트랜잭션        │ JSON 복사     │ RPC + DB    │
│ 동시성 처리     │ 메모리 격리   │ DB 제약     │
│ 오류 복구       │ 사용자 재시도 │ API 재시도  │
└─────────────────┴──────────────┴──────────────┘
```

---

## 결론

**cal.dudu As-Is는:**
- 🎓 **교육용**: 기본 개념 학습 (예약, 신청, 확정)
- 🔀 **이중 모드**: 로컬 테스트 + 실제 멀티유저
- 🔒 **안전성**: 트랜잭션, 멱등성, RLS
- 📊 **감사**: 모든 작업 기록 (operation_logs)
- 🎯 **범위 명확**: 기본값 고정, 커스텀만 가능
