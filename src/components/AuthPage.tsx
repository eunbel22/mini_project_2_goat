import React, { useState } from 'react';
import { signIn, signUp } from '../utils/supabase';

interface AuthPageProps {
  onAuthSuccess: (userId: string, email: string) => void;
  onError: (error: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess, onError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      onError('이메일과 비밀번호를 입력하세요');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await signIn(email, password);
      console.log('SignIn result:', { data, error });

      if (error) {
        console.error('SignIn error:', error);
        onError(error.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        console.log('SignIn success:', data.user);
        onAuthSuccess(data.user.id, data.user.email || '');
      } else {
        onError('로그인 실패');
      }
    } catch (err: any) {
      console.error('SignIn exception:', err);
      onError(err.message || '로그인 중 오류 발생');
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!email || !password || !customerId) {
      onError('모든 필드를 입력하세요');
      return;
    }

    setLoading(true);
    const { data, error } = await signUp(email, password, customerId);

    if (error) {
      onError(error.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      onAuthSuccess(data.user.id, data.user.email || '');
    } else {
      onError('가입 실패');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ddd' }}>
      <h2>{mode === 'signin' ? 'Supabase 로그인' : 'Supabase 가입'}</h2>

      <div style={{ marginBottom: '15px' }}>
        <label>이메일:</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
          placeholder="example@email.com"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>비밀번호:</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
        />
      </div>

      {mode === 'signup' && (
        <div style={{ marginBottom: '15px' }}>
          <label>고객 코드:</label>
          <input
            type="text"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
            placeholder="C01, C02 등"
          />
        </div>
      )}

      <button
        onClick={mode === 'signin' ? handleSignIn : handleSignUp}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '10px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {loading ? '처리 중...' : mode === 'signin' ? '로그인' : '가입'}
      </button>

      <button
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setEmail('');
          setPassword('');
          setCustomerId('');
        }}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {mode === 'signin' ? '가입하기' : '로그인하기'}
      </button>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p>테스트 계정:</p>
        <p>이메일: test@example.com</p>
        <p>비밀번호: Test@123</p>
      </div>
    </div>
  );
};
