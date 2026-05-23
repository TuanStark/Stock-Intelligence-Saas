'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' }}>
        <Loader2 size={40} className="pulse" style={{ color: 'var(--color-accent)' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale, setLocale } = useTranslation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setErrorMsg(t('auth.invalidCredentials'));
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      position: 'relative'
    }}>
      {/* Dynamic language switch floating at top right */}
      <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => setLocale('vi')} 
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: locale === 'vi' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
            background: locale === 'vi' ? 'var(--color-accent-bg)' : 'transparent',
            color: locale === 'vi' ? 'var(--color-accent)' : 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          VI
        </button>
        <button 
          onClick={() => setLocale('en')} 
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: locale === 'en' ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
            background: locale === 'en' ? 'var(--color-accent-bg)' : 'transparent',
            color: locale === 'en' ? 'var(--color-accent)' : 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          EN
        </button>
      </div>

      <div className="glass-panel font-inter" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-premium)'
      }}>
        {/* LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--color-accent) 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '20px',
            color: '#fff'
          }}>S</div>
          <h2 className="font-outfit" style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            STOCK<span style={{ color: 'var(--color-accent)' }}>INTEL</span>
          </h2>
        </div>

        <h3 className="font-outfit" style={{ fontSize: '24px', fontWeight: 800, textAlign: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>
          {t('auth.loginTitle')}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', lineHeight: 1.5, marginBottom: '32px' }}>
          {t('auth.loginSub')}
        </p>

        {errorMsg && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--color-bearish-bg)',
            border: '1px solid hsla(346, 80%, 55%, 0.15)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-bearish)',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '20px'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Email field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('auth.email')}
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              transition: 'var(--transition-smooth)'
            }}>
              <Mail size={16} style={{ color: 'var(--text-muted)' }} />
              <input 
                type="email" 
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  width: '100%'
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('auth.password')}
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              transition: 'var(--transition-smooth)'
            }}>
              <Lock size={16} style={{ color: 'var(--text-muted)' }} />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  width: '100%'
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{
              padding: '14px',
              fontSize: '14px',
              fontWeight: 600,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="pulse" />
                {t('common.loading')}
              </>
            ) : (
              <>
                {t('auth.loginBtn')}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {t('auth.noAccount')}{' '}
          <Link href="/register" style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}>
            {t('auth.signupPrompt')}
          </Link>
        </div>
      </div>
    </div>
  );
}
