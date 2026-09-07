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

## 📊 오늘 기능 구현 MoSCoW 우선순위 분류표

| MoSCoW 구분 | 기능 ID 및 이름 | 상세 설명 및 구현 상태 |
|---|---|---|
| **Must Have (필수)** | • S6-02: 내 신청 상태 바로보기 **(완)**<br>• S6-05: 관리자 기한 배지 **(완)**<br>• S6-08: 점주에게 받을 자료 메모 **(완)**<br>• S1-08 / S5-08: 신청 전 접수/확정 안내 **(완)** | • 메인 진입 즉시 신청 요약 카드로 상태 표시 **(완)**<br>• 어드민 신청 목록 D-Day 기한 배지 표시 **(완)**<br>• 대기 중 인수인계 서류 체크리스트 및 메모장 **(완)**<br>• 제출 전 접수/수동 확정 규칙 파란색 안내 박스 **(완)** |
| **Should Have (권장)** | • S6-01: 확정 시 고객 알림 **(완)**<br>• S6-10: 미확정 일정 메모 **(완)**<br>• S4-03 / S4-08: 시간대 필터 **(완)**<br>• S1-06: 희망 순위 순서 변경 **(완)**<br>• S2-04: 마지막 갱신 시각 & 새로고침 **(완)** | • 어드민 확정 시 인앱 축하 알림 배너 **(완)**<br>• 미확정 대기 중 개인 일정 오해 방지 안내 **(완)**<br>• 슬롯 표 상단 시간대별(전체/오전/오후/저녁) 필터 **(완)**<br>• 선택한 슬롯 ▲/▼ 버튼으로 희망 순위 조정 **(완)**<br>• 상태 조회 시각 표시 및 🔄 지금 다시 확인 버튼 **(완)** |
| **Could Have (선택)** | • S6-03: 알림 수신 여부 표시 **(완)**<br>• S6-09: 확정되면 할 일 목록 **(완)**<br>• S6-07: 어드민 점검 필터 **(완)**<br>• S3-04: 재선택하기 한곳에 모으기 **(완)** | • 확정 알림 수신 동의 상태 표시 토글 **(완)**<br>• 확정 성공 시 3단계 진행 가이드 체크리스트 **(완)**<br>• 어드민 신청 목록 상태별 필터 버튼 **(완)**<br>• 재선택 필요 시 경고 및 직관적 재선택 버튼 **(완)** |
| **Won't Have (제외)** | • S6-04: 정해 둔 시각에 확인 알림<br>• S6-06: 오래 기다린 신청 Slack 알림<br>• 외부 이메일/SMS 발송 인프라 | • 백그라운드 타임 타이머 알림 (시간/복잡도로 제외)<br>• AGENTS.md 규정상 외부 Slack/Edge Function 제한<br>• 외부 메일 서버 대신 인앱 알림 배너로 대체 구현 |

---

## ⚡ 9️⃣ Service Blueprint As-Is Highlights (수정 및 개선 포인트)

| 계층 | As-Is 기존 상태 (Problem) | To-Be 수정 및 개선 (Highlight) |
|---|---|---|
| **Physical Evidence** | 단순 텍스트 상태 표시, 알림 및 가이드 부재 | **상태 요약 카드(S6-02)** + **확정 알림 배너(S6-01)** + **상담 준비 메모장(S6-08)** |
| **User Actions** | 확정 여부 확인을 위한 앱 무한 반복 재접속 (불안감) | 진입 즉시 **요약 확인** 및 대기 시간 활용 **자료/질문 준비 메모 작성** |
| **Front Stage** | 상태 조회 탭 단순 text ('접수됨') 표시 | `StatusSummaryCard` (시각적 배지 & 미확정 일정 라벨) & `PreparationMemoCard` 렌더링 |
| **Back Stage** | 어드민 수동 확정 시 고객 기한/우선순위 정보 미비 | 어드민 대기 목록 **D-Day / 최단 후보 기한 배지(S6-05)** 자동 계산 및 시각화 |

---

## ✨ 🔟 Service Blueprint To-Be 구조도 (Service Flow & Matrix)

### To-Be 서비스 흐름 구조도 (Flowchart)
```
[1. 고객 신청 제출] ──> [2. 대기 & 자료 준비 (S6-02, S6-08)] ──> [3. 어드민 수동 확정 (S6-05)] ──> [4. 확정 완료 알림 (S6-01)]
 (Status: 'received')       (상태 요약 카드 + 메모장)              (D-Day 기한 배지 확인)             (앱 내 확정 알림 배너 노출)
```

### To-Be Service Blueprint 매트릭스
- **Physical Evidence**: 상태 요약 카드 (`StatusSummaryCard`), 확정 축하 배너, 상담 준비 체크리스트 (`PreparationMemoCard`), 기한 D-Day 배지
- **User Actions**: 진입 시 상태 바로 확인 ➔ 대기 중 인수인계 자료/질문 작성 ➔ 확정 시 확정 일정 및 가이드 확인
- **Front Stage**: React `StatusSummaryCard` 및 `PreparationMemoCard` 통합 컴포넌트 (`localStorage` 연동)
- **Back Stage**: 어드민 신청 목록 내 고객의 가장 빠른 후보 날짜 D-Day 배지 산출 및 `⏰ 기한 대기` 표시
- **Support Processes**: 기존 DB 제약, 멱등성 및 원자적 슬롯 점유 유지

---

## 💡 11. 의사결정 이유 및 근거 (Satisficing 원칙)

> **Satisficing Rationale (충족화 의사결정):**
> 1. **제한된 시간 및 규정 제약**: ~15:50 발표 타임라인 및 외부 알림 API/Edge Function 사용 금지 규정(`AGENTS.md`)을 준수하기 위해 외부 이메일/Slack API 연동 대신 앱 내 직관적인 UI 구조를 채택하였습니다.
> 2. **충분히 만족스러운 대안 채택**: 외부 서버 구축 대신 **앱 내 상단 상태 요약 카드(S6-02)**와 **확정 알림 배너(S6-01)**, **대기 중 메모장(S6-08)** 및 **어드민 기한 배지(S6-05)**를 순수 React UI로 구현하여 고객의 통제감과 만족을 극대화하였습니다.
> 3. **점진적 해결**: 외부 인프라 의존성 없는 안정한 인앱 솔루션으로 100% 동작을 보장하며, 제한된 시간 내에 핵심 문제(Step 6 Painpoint)를 점진적·완벽하게 해결하였습니다.

---

## 결론

**cal.dudu As-Is & To-Be 진화:**
- 🎓 **교육용**: 기본 개념 학습 (예약, 신청, 확정)
- 🔀 **이중 모드**: 로컬 테스트 + 실제 멀티유저
- 🔒 **안전성**: 트랜잭션, 멱등성, RLS
- 📊 **감사**: 모든 작업 기록 (operation_logs)
- 🚀 **To-Be 사용자 경험**: Step 6 확정대기 불편 완벽 해소 (상태 바로보기, 준비 메모, 기한 배지, 확정 알림)

