// 확정 완료 이메일 발송 (Resend)
// 트리거: sql/02_confirmation_email.sql의 DB 트리거가 requests.status가 'confirmed'로
// 바뀔 때 pg_net으로 이 함수를 비동기 호출한다. 실패해도 확정 트랜잭션 자체는 영향받지 않는다.
//
// 필요한 환경변수 (supabase secrets set 으로 설정, 저장소 파일에 넣지 않음):
//   RESEND_API_KEY        - Resend 계정의 API 키
//   EDGE_FUNCTION_SECRET   - DB 트리거와 이 함수만 아는 공유 비밀값 (임의 문자열)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 Supabase가 자동으로 주입한다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EDGE_FUNCTION_SECRET = Deno.env.get('EDGE_FUNCTION_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TIME_LABELS: Record<string, string> = {
  am: '오전 09:00',
  pm: '오후 13:00',
  evening: '저녁 18:00',
};

Deno.serve(async (req: Request) => {
  if (req.headers.get('Authorization') !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let requestId: string | undefined;
  try {
    const body = await req.json();
    requestId = body.requestId;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!requestId) {
    return new Response('Missing requestId', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: request } = await supabase
    .from('requests')
    .select('id, status, confirmed_slot_id')
    .eq('id', requestId)
    .maybeSingle();

  if (!request || request.status !== 'confirmed' || !request.confirmed_slot_id) {
    // 확정 상태가 아니면 조용히 종료 (경쟁 조건으로 상태가 다시 바뀐 경우 포함)
    return new Response('Request not confirmed', { status: 200 });
  }

  const { data: info } = await supabase
    .from('customer_info')
    .select('name, email')
    .eq('request_id', requestId)
    .maybeSingle();

  if (!info?.email) {
    return new Response('No customer email on file', { status: 200 });
  }

  const { data: slot } = await supabase
    .from('slots')
    .select('date, time_label')
    .eq('id', request.confirmed_slot_id)
    .maybeSingle();

  const slotText = slot ? `${slot.date} ${TIME_LABELS[slot.time_label] || slot.time_label}` : '확정된 일정';

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'cal.dudu-works.com <onboarding@resend.dev>',
      to: [info.email],
      subject: '일정 확정이 완료되었습니다',
      text: `${info.name ? `${info.name}님, ` : ''}일정 확정이 완료되었습니다.\n\n확정 일시: ${slotText}\n\n감사합니다.`,
    }),
  });

  if (!emailRes.ok) {
    console.error('Resend error:', await emailRes.text());
    return new Response('Email send failed', { status: 502 });
  }

  return new Response('OK', { status: 200 });
});
