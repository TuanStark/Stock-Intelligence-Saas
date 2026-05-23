'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { Check, Loader2, Sparkles, Key, TrendingUp, CreditCard, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { authApi } from '@/lib/api/auth.api';

export default function PricingPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();

  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const currentTier = (session?.user as any)?.tier || 'FREE';
  const token = (session as any)?.accessToken;

  const handleOpenCheckout = (tier: string) => {
    if (!session) {
      router.push(`/login?callbackUrl=/pricing`);
      return;
    }
    setCheckoutTier(tier);
    setPaymentSuccess(false);
  };

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutTier || !token) return;

    setSubmittingPayment(true);

    try {
      // Call NestJS subscription upgrade endpoint using central Axios helper
      const result = await authApi.upgradeSubscription(checkoutTier);

      if (result.success) {
        setPaymentSuccess(true);
        
        // Dynamically update NextAuth session
        await updateSession({ tier: checkoutTier });
        
        setTimeout(() => {
          setCheckoutTier(null);
          setCardNumber('');
          setCardHolder('');
          setExpiry('');
          setCvv('');
          setSubmittingPayment(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Payment simulation error:', err);
    } finally {
      if (!paymentSuccess) {
        setSubmittingPayment(false);
      }
    }
  };

  const tiers = [
    {
      id: 'FREE',
      icon: <TrendingUp size={24} style={{ color: 'var(--text-secondary)' }} />,
      name: t('pricing.tiers.free.name'),
      price: t('pricing.tiers.free.price'),
      desc: t('pricing.tiers.free.desc'),
      features: t('pricing.tiers.free.features').split(','),
      color: 'var(--text-secondary)'
    },
    {
      id: 'PRO',
      icon: <Sparkles size={24} style={{ color: 'var(--color-warning)' }} />,
      name: t('pricing.tiers.pro.name'),
      price: t('pricing.tiers.pro.price'),
      desc: t('pricing.tiers.pro.desc'),
      features: t('pricing.tiers.pro.features').split(','),
      recommended: true,
      color: 'var(--color-warning)'
    },
    {
      id: 'API',
      icon: <Key size={24} style={{ color: 'var(--color-accent)' }} />,
      name: t('pricing.tiers.api.name'),
      price: t('pricing.tiers.api.price'),
      desc: t('pricing.tiers.api.desc'),
      features: t('pricing.tiers.api.features').split(','),
      color: 'var(--color-accent)'
    }
  ];

  return (
    <div className="app-container" style={{ minHeight: '100vh', padding: '40px 24px', position: 'relative' }}>
      {/* Floating Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
        </Link>

        {/* Dynamic language switch floating at top right */}
        <div style={{ display: 'flex', gap: '8px' }}>
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
      </div>

      {/* Main Title */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 className="font-outfit title-gradient" style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '16px' }}>
          {t('pricing.title')}
        </h1>
        <p className="font-inter" style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          {t('pricing.description')}
        </p>
      </div>

      {/* Tiers Grid */}
      <div className="font-inter" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '32px',
        maxWidth: '1200px',
        margin: '0 auto',
        paddingBottom: '60px'
      }}>
        {tiers.map((tier) => {
          const isCurrent = currentTier === tier.id;
          return (
            <div 
              key={tier.id}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '40px',
                borderRadius: 'var(--radius-lg)',
                border: tier.recommended ? '2px solid var(--color-accent)' : '1px solid var(--border-color)',
                position: 'relative',
                boxShadow: tier.recommended ? '0 8px 32px -8px hsla(220, 90%, 56%, 0.15)' : 'none',
                transform: tier.recommended ? 'scale(1.02)' : 'none',
                zIndex: tier.recommended ? 10 : 1
              }}
            >
              {tier.recommended && (
                <span style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  RECOMMENDED
                </span>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {tier.icon}
                </div>
                <div>
                  <h3 className="font-outfit" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{tier.name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tier.desc}</p>
                </div>
              </div>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '32px' }}>
                <span className="font-outfit" style={{ fontSize: '48px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ${tier.price}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>/mo</span>
              </div>

              {/* Feature Title */}
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>
                {t('pricing.featuresTitle')}
              </p>

              {/* Features List */}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1, marginBottom: '40px' }}>
                {tier.features.map((feature, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    <Check size={16} style={{ color: 'var(--color-bullish)', marginTop: '2px', flexShrink: 0 }} />
                    <span>{feature.trim()}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Action button */}
              {isCurrent ? (
                <div style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-hover)',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: '1px solid var(--border-color)'
                }}>
                  ✓ {t('pricing.currentPlan')}
                </div>
              ) : (
                <button 
                  onClick={() => handleOpenCheckout(tier.id)}
                  className={tier.recommended ? 'btn-primary' : 'btn-secondary'}
                  style={{ width: '100%', padding: '14px', fontWeight: 700, fontSize: '14px' }}
                >
                  {t('pricing.subscribeBtn')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Checkout Modal */}
      {checkoutTier && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 8, 16, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="glass-panel font-inter" style={{
            width: '100%',
            maxWidth: '440px',
            padding: '32px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color-active)',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <h3 className="font-outfit" style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-primary)' }}>
              {t('pricing.checkoutTitle')}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
              {t('pricing.checkoutSub')}{' '}
              <strong style={{ color: 'var(--color-accent)' }}>{checkoutTier}</strong>
            </p>

            {paymentSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <span style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--color-bullish-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto'
                }}>
                  <Check size={28} style={{ color: 'var(--color-bullish)' }} />
                </span>
                <h4 style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Transaction Approved!
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {t('pricing.successMsg')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSimulatePayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('pricing.cardHolder')}
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder="John Doe"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {t('pricing.cardNumber')}
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      required 
                      maxLength={19}
                      placeholder="4111 2222 3333 4444"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px 10px 40px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                        width: '100%'
                      }}
                    />
                    <CreditCard size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('pricing.expiry')}
                    </label>
                    <input 
                      type="text" 
                      required 
                      maxLength={5}
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('pricing.cvv')}
                    </label>
                    <input 
                      type="password" 
                      required 
                      maxLength={3}
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button 
                    type="button"
                    onClick={() => setCheckoutTier(null)}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '12px' }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={submittingPayment}
                    className="btn-primary"
                    style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {submittingPayment && <Loader2 size={16} className="pulse" />}
                    {submittingPayment ? t('pricing.processing') : 'Approve Sandbox'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
