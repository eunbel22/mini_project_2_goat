-- cal.dudu-works.com 확장 설치 스크립트: 확정 완료 이메일 발송 트리거
-- 00_supabase.sql, 01_customer_info.sql 실행 완료 후 적용.
-- 사전 조건 (SQL Editor 실행 전에 완료해야 함, START_HERE.md 7번 참고):
--   1. supabase/functions/send-confirmation-email Edge Function 배포
--   2. Edge Function 시크릿 RESEND_API_KEY, EDGE_FUNCTION_SECRET 설정
--   3. 아래 두 ALTER DATABASE 명령을 본인 프로젝트 값으로 바꿔 먼저 실행
--
-- ALTER DATABASE postgres SET app.settings.confirmation_email_function_url =
--   'https://<project-ref>.supabase.co/functions/v1/send-confirmation-email';
-- ALTER DATABASE postgres SET app.settings.edge_function_secret = '<EDGE_FUNCTION_SECRET과 동일한 값>';
--
-- 이 트리거는 requests.status가 'confirmed'로 바뀔 때만 pg_net으로 비동기 HTTP 호출을 하고
-- 응답을 기다리지 않는다 (이메일 실패가 확정 트랜잭션을 막지 않음). 재실행해도 기존 데이터에는 영향 없음.

CREATE EXTENSION IF NOT EXISTS pg_net;

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
    v_url := current_setting('app.settings.confirmation_email_function_url', true);
    v_secret := current_setting('app.settings.edge_function_secret', true);

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
