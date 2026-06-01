'use client';

import React, { useState, useEffect } from 'react';
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
  const [selectedProvider, setSelectedProvider] = useState<'PAYOS' | 'SEPAY'>('PAYOS');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paymentStep, setPaymentStep] = useState<'SELECT_PROVIDER' | 'SHOW_QR'>('SELECT_PROVIDER');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const currentTier = (session?.user as any)?.tier || 'FREE';
  const token = (session as any)?.accessToken;

  // Auto-open modal after guest logging in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get('tier');
      const providerParam = params.get('provider');
      if (tierParam && session) {
        setCheckoutTier(tierParam);
        if (providerParam === 'PAYOS' || providerParam === 'SEPAY') {
          setSelectedProvider(providerParam);
        }
        setPaymentStep('SELECT_PROVIDER');
        
        // Clean query parameters from URL
        const newUrl = window.location.pathname;
        router.replace(newUrl);
      }
    }
  }, [session, router]);

  const handleOpenCheckout = (tier: string) => {
    setCheckoutTier(tier);
    setSelectedProvider('PAYOS');
    setPaymentData(null);
    setPaymentStep('SELECT_PROVIDER');
    setPaymentSuccess(false);
  };

  const handleInitializePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutTier) return;

    // Guest checkout redirect flow
    if (!session) {
      router.push(`/login?callbackUrl=/pricing?tier=${checkoutTier}&provider=${selectedProvider}`);
      return;
    }

    if (!token) {
      console.error('Session active but accessToken is missing');
      return;
    }

    setSubmittingPayment(true);

    try {
      const result = await authApi.upgradeSubscription(checkoutTier, selectedProvider);

      if (result.success && result.data) {
        setPaymentData(result.data);
        setPaymentStep('SHOW_QR');
      }
    } catch (err) {
      console.error('Payment initialization error:', err);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!checkoutTier || !paymentData?.referenceCode) return;
    setSubmittingPayment(true);
    try {
      // 1. First, check if payment is already auto-processed via webhook/BullMQ in the database
      const statusCheck = await authApi.checkTransactionStatus(paymentData.referenceCode);

      if (statusCheck.success && statusCheck.status === 'SUCCESS') {
        // Payment verified automatically!
        setPaymentSuccess(true);
        await updateSession({ tier: checkoutTier });

        setTimeout(() => {
          setCheckoutTier(null);
          setPaymentData(null);
          setPaymentStep('SELECT_PROVIDER');
          setPaymentSuccess(false);
          setSubmittingPayment(false);
        }, 2500);
        return;
      }

      // 2. If not processed automatically yet, try Dev Mode Direct Upgrade (works ONLY in development/sandbox)
      try {
        const directUpgradeResult = await authApi.directUpgrade(checkoutTier);
        if (directUpgradeResult.success) {
          setPaymentSuccess(true);
          await updateSession({ tier: checkoutTier });

          setTimeout(() => {
            setCheckoutTier(null);
            setPaymentData(null);
            setPaymentStep('SELECT_PROVIDER');
            setPaymentSuccess(false);
            setSubmittingPayment(false);
          }, 2500);
        }
      } catch (directUpgradeError) {
        // Direct upgrade is disabled in production. Show a user-friendly message.
        alert(
          locale === 'vi' 
            ? 'Hệ thống chưa nhận được khoản thanh toán của bạn. Vui lòng chờ 1-2 phút hoặc đảm bảo bạn đã chuyển khoản chính xác nội dung.' 
            : 'Payment not received yet. Please wait 1-2 minutes or ensure you transferred with the correct memo.'
        );
        setSubmittingPayment(false);
      }
    } catch (err) {
      console.error('Confirm transfer error:', err);
      setSubmittingPayment(false);
    }
  };

  const tiers = [
    {
      id: 'FREE',
      icon: <TrendingUp size={24} className="text-text-secondary" />,
      name: t('pricing.tiers.free.name'),
      price: t('pricing.tiers.free.price'),
      desc: t('pricing.tiers.free.desc'),
      features: (Array.isArray(t('pricing.tiers.free.features'))
        ? t('pricing.tiers.free.features')
        : typeof t('pricing.tiers.free.features') === 'string'
          ? t('pricing.tiers.free.features').split(',')
          : []) as string[],
      color: 'var(--text-secondary)'
    },
    {
      id: 'PRO',
      icon: <Sparkles size={24} className="text-warning" />,
      name: t('pricing.tiers.pro.name'),
      price: t('pricing.tiers.pro.price'),
      desc: t('pricing.tiers.pro.desc'),
      features: (Array.isArray(t('pricing.tiers.pro.features'))
        ? t('pricing.tiers.pro.features')
        : typeof t('pricing.tiers.pro.features') === 'string'
          ? t('pricing.tiers.pro.features').split(',')
          : []) as string[],
      recommended: true,
      color: 'var(--color-warning)'
    },
    {
      id: 'API',
      icon: <Key size={24} className="text-accent" />,
      name: t('pricing.tiers.api.name'),
      price: t('pricing.tiers.api.price'),
      desc: t('pricing.tiers.api.desc'),
      features: (Array.isArray(t('pricing.tiers.api.features'))
        ? t('pricing.tiers.api.features')
        : typeof t('pricing.tiers.api.features') === 'string'
          ? t('pricing.tiers.api.features').split(',')
          : []) as string[],
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
            className={`py-1 px-2.5 rounded-[6px] text-xs font-semibold cursor-pointer border transition-colors ${locale === 'vi'
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-board-border bg-transparent text-text-secondary hover:text-text-primary'
              }`}
          >
            VI
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`py-1 px-2.5 rounded-[6px] text-xs font-semibold cursor-pointer border transition-colors ${locale === 'en'
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
        {/* <p className="font-inter text-text-secondary text-base max-w-[600px] mx-auto leading-relaxed">
          {t('pricing.description')}
        </p> */}
      </div>

      {/* Tiers Grid */}
      <div className="font-inter grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-8 max-w-[1200px] mx-auto pb-[60px]">
        {tiers.map((tier) => {
          const isCurrent = currentTier === tier.id;
          return (
            <div
              key={tier.id}
              className={`glass-panel flex flex-col p-10 rounded-2xl relative transition-all duration-300 ${tier.recommended
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
              <div className="flex items-baseline gap-1 mb-8">
                <span className="font-outfit text-[38px] font-extrabold text-text-primary">
                  {tier.price}
                </span>
                <span className="font-inter text-text-primary text-xl font-bold ml-1">
                  {locale === 'vi' ? 'đ' : ' VND'}
                </span>
                <span className="text-text-secondary text-sm ml-1.5">
                  {locale === 'vi' ? '/tháng' : '/mo'}
                </span>
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
      </div>      {/* Checkout Modal */}
      {checkoutTier && (
        <div className="fixed inset-0 bg-[#050810]/85 backdrop-blur-md flex items-center justify-center z-[1000] p-6">
          <div className="glass-panel font-inter w-full max-w-[480px] p-8 rounded-2xl border border-board-border-active shadow-2xl relative overflow-hidden">
            {/* Glowing background highlights */}
            <div className="absolute top-0 left-1/4 w-40 h-40 bg-accent/10 rounded-full blur-[80px]" />
            <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-warning/5 rounded-full blur-[80px]" />

            <h3 className="font-outfit text-[22px] font-extrabold mb-1 text-text-primary">
              {paymentStep === 'SELECT_PROVIDER' 
                ? (locale === 'vi' ? 'Chọn Cổng Thanh Toán' : 'Select Payment Gateway')
                : (locale === 'vi' ? 'Thông Tin Chuyển Khoản' : 'Bank Transfer Instructions')}
            </h3>
            <p className="text-text-secondary text-xs mb-6">
              {locale === 'vi' ? 'Nâng cấp gói tài khoản ' : 'Upgrading account tier to '}
              <strong className="text-accent">{checkoutTier}</strong>
            </p>

            {paymentSuccess ? (
              <div className="text-center py-10 relative z-10">
                <span className="w-16 h-16 rounded-full bg-bullish/10 flex items-center justify-center mx-auto mb-5 shadow-[0_0_24px_-4px_rgba(34,197,94,0.2)]">
                  <Check size={32} className="text-bullish" />
                </span>
                <h4 className="font-extrabold text-lg text-text-primary mb-2">
                  {locale === 'vi' ? 'Giao Giao Dịch Đã Được Duyệt!' : 'Transaction Approved!'}
                </h4>
                <p className="text-text-secondary text-sm max-w-[320px] mx-auto leading-relaxed">
                  {t('pricing.successMsg')}
                </p>
              </div>
            ) : paymentStep === 'SELECT_PROVIDER' ? (
              <form onSubmit={handleInitializePayment} className="flex flex-col gap-5 relative z-10">
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    {locale === 'vi' ? 'Phương thức thanh toán tự động' : 'Automatic payment method'}
                  </label>
                  
                  {/* PayOS Option */}
                  <div 
                    onClick={() => setSelectedProvider('PAYOS')}
                    className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all border ${
                      selectedProvider === 'PAYOS' 
                        ? 'border-accent bg-accent/5 shadow-[0_0_16px_-4px_rgba(59,130,246,0.15)]' 
                        : 'border-board-border bg-surface hover:border-text-secondary/50'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-board-border flex items-center justify-center mt-0.5 shrink-0">
                      {selectedProvider === 'PAYOS' && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-text-primary">
                        {locale === 'vi' ? 'Thanh toán PayOS (Mã VietQR)' : 'PayOS gateway (VietQR)'}
                      </h4>
                      <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                        {locale === 'vi' ? 'Quét mã VietQR điền sẵn số tiền và nội dung chuyển khoản qua ứng dụng ngân hàng.' : 'Scan VietQR code with pre-filled amount and content.'}
                      </p>
                    </div>
                  </div>

                  {/* SePay Option */}
                  <div 
                    onClick={() => setSelectedProvider('SEPAY')}
                    className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all border ${
                      selectedProvider === 'SEPAY' 
                        ? 'border-accent bg-accent/5 shadow-[0_0_16px_-4px_rgba(59,130,246,0.15)]' 
                        : 'border-board-border bg-surface hover:border-text-secondary/50'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-board-border flex items-center justify-center mt-0.5 shrink-0">
                      {selectedProvider === 'SEPAY' && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-text-primary">
                        {locale === 'vi' ? 'Chuyển khoản trực tiếp (SePay)' : 'Direct Bank Transfer (SePay)'}
                      </h4>
                      <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                        {locale === 'vi' ? 'Tự động kiểm soát giao dịch qua cú pháp chuyển khoản ngân hàng chính xác.' : 'Track payment automatically via exact transfer syntax.'}
                      </p>
                    </div>
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
                    {locale === 'vi' ? 'Tiếp Tục' : 'Continue'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-5 relative z-10">
                {/* QR Code Container */}
                {paymentData?.qrUrl && (
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-3 rounded-xl inline-block shadow-lg border border-board-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={paymentData.qrUrl} 
                        alt="Payment QR Code" 
                        className="w-48 h-48 block object-contain"
                      />
                    </div>
                    <p className="text-text-muted text-[10px] mt-2 italic text-center max-w-[280px]">
                      {locale === 'vi' ? '* Quét mã QR bằng ứng dụng ngân hàng (Mobile Banking) để tự động điền thông tin' : '* Scan QR with your Mobile Banking app to prefill transaction info'}
                    </p>
                  </div>
                )}

                {/* Transfer Info */}
                <div className="bg-surface border border-board-border rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">{locale === 'vi' ? 'Cổng thanh toán:' : 'Gateway:'}</span>
                    <span className="font-bold text-accent text-right uppercase">{paymentData?.provider}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-board-border/40 pt-2">
                    <span className="text-text-muted">{locale === 'vi' ? 'Số tiền:' : 'Amount:'}</span>
                    <span className="font-extrabold text-bullish text-right text-sm">
                      {paymentData?.amount?.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-board-border/40 pt-2">
                    <span className="text-text-muted">{locale === 'vi' ? 'Nội dung chuyển khoản:' : 'Syntax/Memo:'}</span>
                    <span className="font-mono font-extrabold text-warning bg-surface-hover border border-board-border px-2 py-0.5 rounded text-right tracking-wider select-all cursor-pointer" title={locale === 'vi' ? 'Bấm để chọn' : 'Click to select'}>
                      {paymentData?.referenceCode}
                    </span>
                  </div>
                </div>

                {/* Instructions */}
                <p className="text-xs text-text-secondary leading-relaxed bg-accent/5 border border-accent/20 rounded-xl p-3.5">
                  <strong>{locale === 'vi' ? 'Hướng dẫn:' : 'Instructions:'}</strong> {paymentData?.transferInstructions}
                </p>

                {/* Direct Gateway Link */}
                {paymentData?.paymentUrl && (
                  <div className="text-center">
                    <a 
                      href={paymentData.paymentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-accent hover:text-accent-hover font-bold inline-flex items-center gap-1.5 no-underline transition-colors"
                    >
                      {locale === 'vi' ? 'Mở trang thanh toán cổng ' : 'Open payment link on '}{paymentData.provider} &rarr;
                    </a>
                  </div>
                )}

                <div className="flex gap-3 mt-2 border-t border-board-border/30 pt-4">
                  <button 
                    type="button"
                    onClick={() => setPaymentStep('SELECT_PROVIDER')}
                    className="btn-secondary flex-1 py-3"
                  >
                    {locale === 'vi' ? 'Quay Lại' : 'Back'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleConfirmTransfer}
                    disabled={submittingPayment}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    {submittingPayment && <Loader2 size={16} className="pulse text-white" />}
                    {locale === 'vi' ? 'Tôi Đã Chuyển Khoản' : 'I Have Transferred'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
