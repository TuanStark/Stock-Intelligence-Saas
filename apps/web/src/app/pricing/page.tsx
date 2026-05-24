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
      const result = await authApi.upgradeSubscription(checkoutTier);

      if (result.success) {
        setPaymentSuccess(true);
        
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
      icon: <TrendingUp size={24} className="text-text-secondary" />,
      name: t('pricing.tiers.free.name'),
      price: t('pricing.tiers.free.price'),
      desc: t('pricing.tiers.free.desc'),
      features: t('pricing.tiers.free.features').split(','),
      color: 'var(--text-secondary)'
    },
    {
      id: 'PRO',
      icon: <Sparkles size={24} className="text-warning" />,
      name: t('pricing.tiers.pro.name'),
      price: t('pricing.tiers.pro.price'),
      desc: t('pricing.tiers.pro.desc'),
      features: t('pricing.tiers.pro.features').split(','),
      recommended: true,
      color: 'var(--color-warning)'
    },
    {
      id: 'API',
      icon: <Key size={24} className="text-accent" />,
      name: t('pricing.tiers.api.name'),
      price: t('pricing.tiers.api.price'),
      desc: t('pricing.tiers.api.desc'),
      features: t('pricing.tiers.api.features').split(','),
      color: 'var(--color-accent)'
    }
  ];

  return (
    <div className="app-container min-h-screen py-10 px-6 relative">
      {/* Floating Header */}
      <div className="flex justify-between items-center mb-12">
        <Link href="/" className="no-underline">
          <button className="btn-secondary flex items-center gap-2 py-2 px-4">
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
        </Link>

        {/* Dynamic language switch floating at top right */}
        <div className="flex gap-2">
          <button 
            onClick={() => setLocale('vi')} 
            className={`py-1 px-2.5 rounded-[6px] text-xs font-semibold cursor-pointer border transition-colors ${
              locale === 'vi' 
                ? 'border-accent bg-accent/15 text-accent' 
                : 'border-board-border bg-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            VI
          </button>
          <button 
            onClick={() => setLocale('en')} 
            className={`py-1 px-2.5 rounded-[6px] text-xs font-semibold cursor-pointer border transition-colors ${
              locale === 'en' 
                ? 'border-accent bg-accent/15 text-accent' 
                : 'border-board-border bg-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Main Title */}
      <div className="text-center mb-[60px]">
        <h1 className="font-outfit title-gradient text-[40px] font-extrabold tracking-tight mb-4">
          {t('pricing.title')}
        </h1>
        <p className="font-inter text-text-secondary text-base max-w-[600px] mx-auto leading-relaxed">
          {t('pricing.description')}
        </p>
      </div>

      {/* Tiers Grid */}
      <div className="font-inter grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-8 max-w-[1200px] mx-auto pb-[60px]">
        {tiers.map((tier) => {
          const isCurrent = currentTier === tier.id;
          return (
            <div 
              key={tier.id}
              className={`glass-panel flex flex-col p-10 rounded-2xl relative transition-all duration-300 ${
                tier.recommended 
                  ? 'border-2 border-accent shadow-[0_8px_32px_-8px_hsla(220,90%,56%,0.15)] scale-[1.02] z-10' 
                  : 'border border-board-border z-1'
              }`}
            >
              {tier.recommended && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-white text-[11px] font-extrabold py-1 px-3 rounded-[6px] tracking-wider uppercase">
                  RECOMMENDED
                </span>
              )}

              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-lg bg-surface border border-board-border flex items-center justify-center">
                  {tier.icon}
                </div>
                <div>
                  <h3 className="font-outfit text-lg font-extrabold text-text-primary">{tier.name}</h3>
                  <p className="text-xs text-text-muted">{tier.desc}</p>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1.5 mb-8">
                <span className="font-outfit text-[48px] font-extrabold text-text-primary">
                  ${tier.price}
                </span>
                <span className="text-text-secondary text-sm">/mo</span>
              </div>

              {/* Feature Title */}
              <p className="text-[13px] font-bold text-text-secondary uppercase tracking-wider mb-5">
                {t('pricing.featuresTitle')}
              </p>

              {/* Features List */}
              <ul className="list-none p-0 m-0 flex flex-col gap-3.5 flex-grow mb-10">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-text-secondary leading-relaxed">
                    <Check size={16} className="text-bullish mt-0.5 shrink-0" />
                    <span>{feature.trim()}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Action button */}
              {isCurrent ? (
                <div className="w-full py-3.5 rounded-lg bg-surface-hover text-text-secondary text-center font-bold text-sm border border-board-border">
                  ✓ {t('pricing.currentPlan')}
                </div>
              ) : (
                <button 
                  onClick={() => handleOpenCheckout(tier.id)}
                  className={`${tier.recommended ? 'btn-primary' : 'btn-secondary'} w-full py-3.5 font-bold text-sm`}
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
        <div className="fixed inset-0 bg-[#050810]/85 backdrop-blur-md flex items-center justify-center z-[1000] p-6">
          <div className="glass-panel font-inter w-full max-w-[440px] p-8 rounded-2xl border border-board-border-active shadow-2xl">
            <h3 className="font-outfit text-[22px] font-extrabold mb-1 text-text-primary">
              {t('pricing.checkoutTitle')}
            </h3>
            <p className="text-text-secondary text-xs mb-6">
              {t('pricing.checkoutSub')}{' '}
              <strong className="text-accent">{checkoutTier}</strong>
            </p>

            {paymentSuccess ? (
              <div className="text-center py-10">
                <span className="w-14 h-14 rounded-full bg-bullish/10 flex items-center justify-center mx-auto mb-5">
                  <Check size={28} className="text-bullish" />
                </span>
                <h4 className="font-extrabold text-base text-text-primary mb-2">
                  Transaction Approved!
                </h4>
                <p className="text-text-secondary text-xs">
                  {t('pricing.successMsg')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSimulatePayment} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase">
                    {t('pricing.cardHolder')}
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder="John Doe"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="bg-surface border border-board-border rounded-[6px] py-2.5 px-3.5 text-text-primary text-sm outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase">
                    {t('pricing.cardNumber')}
                  </label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      required 
                      maxLength={19}
                      placeholder="4111 2222 3333 4444"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="bg-surface border border-board-border rounded-[6px] py-2.5 pl-10 pr-3.5 text-text-primary text-sm outline-none focus:border-accent transition-colors w-full"
                    />
                    <CreditCard size={16} className="absolute left-3.5 text-text-muted" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase">
                      {t('pricing.expiry')}
                    </label>
                    <input 
                      type="text" 
                      required 
                      maxLength={5}
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      className="bg-surface border border-board-border rounded-[6px] py-2.5 px-3.5 text-text-primary text-sm outline-none focus:border-accent transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase">
                      {t('pricing.cvv')}
                    </label>
                    <input 
                      type="password" 
                      required 
                      maxLength={3}
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      className="bg-surface border border-board-border rounded-[6px] py-2.5 px-3.5 text-text-primary text-sm outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    type="button"
                    onClick={() => setCheckoutTier(null)}
                    className="btn-secondary flex-1 py-3"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={submittingPayment}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    {submittingPayment && <Loader2 size={16} className="pulse text-white" />}
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
