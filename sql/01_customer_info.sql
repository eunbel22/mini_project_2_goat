-- cal.dudu-works.com 확장 설치 스크립트: P08 사전질문 폼 + 고객 정보 저장
-- 00_supabase.sql 실행 완료 후 적용. 기존 requests/candidates/slots 데이터를 변경하지 않는다.
-- 재실행해도 기존 customer_info 행을 삭제하지 않는다 (CREATE TABLE IF NOT EXISTS).

-- 1. 고객 정보 테이블 (신청 1건당 최대 1행, request 소유자만 upsert 가능)
CREATE TABLE IF NOT EXISTS customer_info (
  request_id UUID PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  purpose TEXT NOT NULL,
  note TEXT,
  guests JSONB NOT NULL DEFAULT '[]'::jsonb,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  goals_other TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_info_customer ON customer_info(customer_id);

ALTER TABLE customer_info ENABLE ROW LEVEL SECURITY;

-- 고객 식별 정보이므로 본인과 어드민만 조회 가능 (공개 슬롯 조회와 분리)
DROP POLICY IF EXISTS "Customers can view own info" ON customer_info;
CREATE POLICY "Customers can view own info"
  ON customer_info
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid()::text);

DROP POLICY IF EXISTS "Admins can view all customer info" ON customer_info;
CREATE POLICY "Admins can view all customer info"
  ON customer_info
  FOR SELECT
  USING (
    CASE
      WHEN (auth.jwt()::jsonb->'app_metadata'->>'role')::text IS NOT NULL
           AND (auth.jwt()::jsonb->'app_metadata'->>'role')::text = 'admin'
      THEN true
      ELSE false
    END
  );

-- 직접 테이블 쓰기로 소유권 검증을 우회하지 못하도록 닫고 RPC로만 저장
REVOKE INSERT, UPDATE, DELETE ON customer_info FROM authenticated, anon, PUBLIC;

-- 2. RPC: 고객 정보 저장 (신규 저장/재신청 시 갱신 겸용, upsert)
CREATE OR REPLACE FUNCTION public.save_customer_info(
  p_request_id UUID,
  p_customer_id TEXT,
  p_name TEXT,
  p_email TEXT,
  p_company TEXT,
  p_purpose TEXT,
  p_note TEXT,
  p_guests JSONB,
  p_goals JSONB,
  p_goals_other TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_request RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_customer_id != auth.uid()::text THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer ID mismatch');
  END IF;

  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.customer_id != auth.uid()::text THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not request owner');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name required');
  END IF;

  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email');
  END IF;

  IF p_purpose IS NULL OR trim(p_purpose) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purpose required');
  END IF;

  IF jsonb_typeof(COALESCE(p_guests, '[]'::jsonb)) != 'array'
     OR jsonb_array_length(COALESCE(p_guests, '[]'::jsonb)) > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid guest list (max 5)');
  END IF;

  INSERT INTO customer_info (
    request_id, customer_id, name, email, company, purpose, note, guests, goals, goals_other, updated_at
  )
  VALUES (
    p_request_id, p_customer_id, trim(p_name), trim(p_email), p_company, trim(p_purpose), p_note,
    COALESCE(p_guests, '[]'::jsonb), COALESCE(p_goals, '[]'::jsonb), p_goals_other, NOW()
  )
  ON CONFLICT (request_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    company = EXCLUDED.company,
    purpose = EXCLUDED.purpose,
    note = EXCLUDED.note,
    guests = EXCLUDED.guests,
    goals = EXCLUDED.goals,
    goals_other = EXCLUDED.goals_other,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_customer_info FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_customer_info TO authenticated;

-- 3. RPC: 가장 최근 고객 정보 조회 (재신청 자동 입력용, 본인 것만)
CREATE OR REPLACE FUNCTION public.get_latest_customer_info(
  p_customer_id TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_customer_id != auth.uid()::text THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer ID mismatch');
  END IF;

  SELECT to_jsonb(ci) INTO v_result
  FROM customer_info ci
  WHERE ci.customer_id = p_customer_id
  ORDER BY ci.updated_at DESC
  LIMIT 1;

  RETURN jsonb_build_object('success', true, 'info', v_result);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_latest_customer_info FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_customer_info TO authenticated;
