import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthPage } from '../components/AuthPage';
import { REFERENCE_TIME } from '../utils/constants';

interface SupabaseAuthPageProps {
  mode?: 'signin' | 'signup';
}

const SupabaseAuthPage: React.FC<SupabaseAuthPageProps> = ({ mode = 'signin' }) => {
  const navigate = useNavigate();

  const handleAuthSuccess = (_userId: string, email: string) => {
    // 관리자 확인 (실제로는 Supabase에서 app_metadata 확인됨)
    // 임시로 test@example.com만 admin 처리
    const isAdmin = email === 'test@example.com';

    if (isAdmin) {
      navigate('/supabase/admin');
    } else {
      navigate('/supabase/customer');
    }
  };

  const handleError = (error: string) => {
    console.error('Auth error:', error);
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>cal.dudu-works.com</h1>
          <div className="reference-time">
            기준 시각: {REFERENCE_TIME.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (고정)
          </div>
        </div>

        <div className="role-selector">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className="mode-badge supabase">Supabase 모드</span>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/')}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              로컬 모드
            </button>
          </div>
        </div>
      </div>

      <div className="alert alert-success">
        <strong>Supabase 모드:</strong> 실제 데이터베이스와 인증이 적용됩니다.
      </div>

      <AuthPage
        initialMode={mode}
        onAuthSuccess={handleAuthSuccess}
        onError={handleError}
      />

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>cal.dudu-works.com v1.0 - 수업용 기본 실습 앱</p>
        <p>기본값: 42슬롯(14일 × 3시간대), 고객 1-3개 희망, 어드민 수동 확정</p>
      </div>
    </div>
  );
};

export default SupabaseAuthPage;
