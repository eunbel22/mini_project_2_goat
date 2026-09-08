-- cal.dudu-works.com 확장 설치 스크립트: 확정 완료 이메일 발송 트리거
-- 00_supabase.sql, 01_customer_info.sql 실행 완료 후 적용.
-- 사전 조건 (SQL Editor 실행 전에 완료해야 함, START_HERE.md 7번 참고):
--   1. supabase/functions/send-confirmation-email Edge Function 배포
--   2. Edge Function 시크릿 RESEND_API_KEY, EDGE_FUNCTION_SECRET 설정
--
-- Supabase 호스팅 환경은 ALTER DATABASE ... SET app.settings.*를 프로젝트 소유자에게도 허용하지
-- 않으므로(permission denied), URL/시크릿은 별도 설정 테이블에 저장하고 트리거에서 조회한다.
-- 이 테이블은 RLS만 켜고 정책을 두지 않아 anon/authenticated는 접근할 수 없고,
-- SECURITY DEFINER 함수(소유자 postgres, RLS 우회)만 읽을 수 있다.
--
-- 이 트리거는 requests.status가 'confirmed'로 바뀔 때만 pg_net으로 비동기 HTTP 호출을 하고
-- 응답을 기다리지 않는다 (이메일 실패가 확정 트랜잭션을 막지 않음). 재실행해도 기존 데이터에는 영향 없음.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS notification_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notification_config FROM authenticated, anon, PUBLIC;

-- 아래 두 값을 본인 프로젝트 값으로 바꿔서 이 INSERT 문만 먼저 실행해도 되고,
-- 파일 전체를 한 번에 실행해도 된다 (재실행 시 값이 갱신됨).
INSERT INTO notification_config (key, value, updated_at) VALUES
  ('confirmation_email_function_url', 'https://<project-ref>.supabase.co/functions/v1/send-confirmation-email', NOW()),
  ('edge_function_secret', '<EDGE_FUNCTION_SECRET과 동일한 값>', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

CREATE OR REPLACE FUNCTION public.notify_confirmation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT value INTO v_url FROM notification_config WHERE key = 'confirmation_email_function_url';
    SELECT value INTO v_secret FROM notification_config WHERE key = 'edge_function_secret';

    IF v_url IS NOT NULL AND v_url != '' THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_secret, '')
        ),
        body := jsonb_build_object('requestId', NEW.id::text)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_confirmation_email ON requests;
CREATE TRIGGER trg_notify_confirmation_email
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_confirmation_email();
