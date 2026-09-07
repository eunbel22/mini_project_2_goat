import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerPage } from '../components/CustomerPage';
import { AdminPage } from '../components/AdminPage';
import { AuthPage } from '../components/AuthPage';
import { DatabaseManager } from '../utils/database';
import { REFERENCE_TIME } from '../utils/constants';
import { getCurrentSession, signOut, getAdminStatus } from '../utils/supabase';

const SupabaseModePage: React.FC = () => {
  const navigate = useNavigate();
  const [db] = useState(() => new DatabaseManager());
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);
  const mode = 'supabase';

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data } = await getCurrentSession();
    if (data?.session) {
      setUserId(data.session.user.id);
      setUserEmail(data.session.user.email || '');
      await checkAdminStatus();
    }
    setAuthLoading(false);
  };

  const checkAdminStatus = async () => {
    const isAdminUser = await getAdminStatus();
    setIsAdmin(isAdminUser);
    console.log('Admin status:', isAdminUser);
  };

  const handleAuthSuccess = async (newUserId: string, newEmail: string) => {
    setUserId(newUserId);
    setUserEmail(newEmail);
    setAuthError('');
    await checkAdminStatus();
  };

  const handleSignOut = async () => {
    await signOut();
    setUserId('');
    setUserEmail('');
    setIsAdmin(false);
    setAuthError('');
  };

  if (authLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (!userId) {
    return (
      <AuthPage
        onAuthSuccess={handleAuthSuccess}
        onError={setAuthError}
      />
    );
  }

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
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>역할</span>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
              {isAdmin ? '어드민' : '고객'} ({userEmail})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '20px' }}>
            <span className={`mode-badge ${mode}`}>Supabase 모드</span>
            <button
              className="btn btn-secondary"
              onClick={handleSignOut}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              로그아웃
            </button>
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

      {authError && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          <strong>오류:</strong> {authError}
        </div>
      )}

      <div className="alert alert-success">
        <strong>Supabase 모드:</strong> 실제 데이터베이스와 인증이 적용됩니다.
      </div>

      {isAdmin ? (
        <AdminPage db={db} mode={mode} userId={userId} />
      ) : (
        <CustomerPage db={db} mode={mode} userId={userId} />
      )}

      <hr style={{ margin: '40px 0', borderColor: '#ddd' }} />
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', paddingBottom: '20px' }}>
        <p>cal.dudu-works.com v1.0 - 수업용 기본 실습 앱</p>
        <p>기본값: 42슬롯(14일 × 3시간대), 고객 1-3개 희망, 어드민 수동 확정</p>
      </div>
    </div>
  );
};

export default SupabaseModePage;
