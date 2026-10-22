import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Building,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { authService } from '../../api/services';
import { handleApiError } from '../../api/client';

interface SignupViewProps {
  onNavigateToLogin?: () => void;
}

export const SignupView: React.FC<SignupViewProps> = ({ onNavigateToLogin }) => {
  const [accountName, setAccountName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<'basic' | 'pro'>('basic');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unverified confirmation state after signup
  const [isSuccessUnverified, setIsSuccessUnverified] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Live password validation criteria (Task 100)
  const passwordCriteria = {
    length: password.length >= 12,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const handleResendVerification = async () => {
    if (!email.trim() || resendCooldown > 0) return;
    setIsResending(true);
    setResendStatus(null);
    try {
      const res = await authService.resendVerification(email.trim());
      setResendStatus(res.message || 'Verification email sent. Please check your inbox.');
      setResendCooldown(60);
    } catch (err) {
      setResendStatus(handleApiError(err));
    } finally {
      setIsResending(false);
    }
  };

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError(
        'Password does not meet requirements: at least 12 characters with upper case, lower case, number and symbol.'
      );
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await authService.signup({
        AccountName: accountName.trim(),
        AdminEmail: email.trim(),
        AdminPassword: password,
        Plan: plan,
      });

      // Show the unverified email state on successful registration
      setIsSuccessUnverified(true);
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[#0a0a0a] flex flex-col items-center py-6 sm:py-10 px-4 custom-scrollbar">
      {/* Cyber grid background */}
      <div className="cyber-grid-bg fixed inset-0 pointer-events-none"></div>

      {/* Scanlines overlay */}
      <div className="scanlines pointer-events-none fixed inset-0 z-50 opacity-5 mix-blend-overlay"></div>

      {/* Ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neutral-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        ></div>
      </div>

      <div className="relative z-10 w-full max-w-lg my-auto py-2">
        {/* Brand header */}
        <div className="text-center mb-5 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-2.5 bg-red-600 rounded-2xl shadow-lg shadow-red-500/25">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-cyber font-bold text-white tracking-wider mb-1">ANTITODE</h1>
          <p className="text-neutral-400 font-mono text-xs">
            Cyber Threat &amp; Honeypot Operations Platform
          </p>
        </div>

        {/* Main signup card */}
        <div className="bg-[#111]/90 backdrop-blur-md border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl animate-slide-in-up">
          {isSuccessUnverified ? (
            /* Confirm your email first screen state (Task 100) */
            <div className="space-y-6 text-center animate-fade-in font-mono">
              <div className="w-16 h-16 mx-auto bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400">
                <Mail className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white font-cyber tracking-wide">
                  Confirm your email first
                </h2>
                <p className="text-xs text-neutral-400">
                  Account created successfully! We sent a confirmation link to:
                </p>
                <p className="text-xs font-bold text-amber-400 bg-neutral-900/90 p-2.5 rounded-lg border border-neutral-800 break-all select-all">
                  {email}
                </p>
                <p className="text-[11px] text-neutral-500 pt-1">
                  Please verify your address before logging in to access live honeypot telemetry.
                </p>
              </div>

              {resendStatus && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    resendStatus.toLowerCase().includes('sent')
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/40 border-red-500/40 text-red-300'
                  }`}
                >
                  {resendStatus}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isResending || resendCooldown > 0}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold py-3 px-4 rounded-lg border border-neutral-700 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Dispatching verification link...</span>
                    </>
                  ) : resendCooldown > 0 ? (
                    <span>Resend available in {resendCooldown}s</span>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 text-amber-400" />
                      <span>Resend verification email</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={goToLogin}
                  className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  <span>Proceed to Sign In →</span>
                </button>
              </div>
            </div>
          ) : (
            /* Signup registration form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-cyber tracking-wide">
                  <ShieldCheck className="w-5 h-5 text-red-500 shrink-0" />
                  <span>Create Platform Account</span>
                </h2>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider bg-neutral-900/90 px-2 py-0.5 rounded border border-neutral-800">
                  Self-Serve Setup
                </span>
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-2.5 animate-shake font-mono text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Organization name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
                  Organization / Team Name
                </label>
                <div className="relative group">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-red-500 transition-colors pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Acme Corp Cyber SOC"
                    disabled={isLoading}
                    className="w-full bg-neutral-950/80 border border-neutral-700/80 hover:border-neutral-600 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-neutral-500 font-mono text-xs focus:outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Admin Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
                  Administrator Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-red-500 transition-colors pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    disabled={isLoading}
                    className="w-full bg-neutral-950/80 border border-neutral-700/80 hover:border-neutral-600 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-neutral-500 font-mono text-xs focus:outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password with live rule verification */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
                  Master Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-red-500 transition-colors pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isLoading}
                    className="w-full bg-neutral-950/80 border border-neutral-700/80 hover:border-neutral-600 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-neutral-500 font-mono text-xs focus:outline-none transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors cursor-pointer p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password rule helper (Task 100) */}
                <div className="p-2.5 bg-neutral-950/60 border border-neutral-800/80 rounded-lg space-y-1.5 text-[11px] font-mono">
                  <div className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] flex items-center justify-between">
                    <span>Complexity requirements (12+ chars):</span>
                    <span className={isPasswordValid ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}>
                      {Object.values(passwordCriteria).filter(Boolean).length}/5 met
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.length ? 'text-emerald-400 font-medium' : 'text-neutral-500'
                      }`}
                    >
                      {passwordCriteria.length ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <XCircle size={12} className="shrink-0" />}
                      12+ Characters
                    </span>
                    <span
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasUpper ? 'text-emerald-400 font-medium' : 'text-neutral-500'
                      }`}
                    >
                      {passwordCriteria.hasUpper ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <XCircle size={12} className="shrink-0" />}
                      Uppercase (A-Z)
                    </span>
                    <span
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasLower ? 'text-emerald-400 font-medium' : 'text-neutral-500'
                      }`}
                    >
                      {passwordCriteria.hasLower ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <XCircle size={12} className="shrink-0" />}
                      Lowercase (a-z)
                    </span>
                    <span
                      className={`flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasNumber ? 'text-emerald-400 font-medium' : 'text-neutral-500'
                      }`}
                    >
                      {passwordCriteria.hasNumber ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <XCircle size={12} className="shrink-0" />}
                      Number (0-9)
                    </span>
                    <span
                      className={`col-span-2 flex items-center gap-1.5 transition-colors ${
                        passwordCriteria.hasSymbol ? 'text-emerald-400 font-medium' : 'text-neutral-500'
                      }`}
                    >
                      {passwordCriteria.hasSymbol ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <XCircle size={12} className="shrink-0" />}
                      Special Symbol (!@#$%...)
                    </span>
                  </div>
                </div>
              </div>

              {/* Initial subscription tier */}
              <div className="space-y-1.5 pt-0.5">
                <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
                  Select Subscription Plan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPlan('basic')}
                    className={`p-3 rounded-lg border text-left transition-all font-mono cursor-pointer ${
                      plan === 'basic'
                        ? 'border-red-500/80 bg-red-950/30 text-white shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/40'
                        : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>Basic Plan</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">$69/mo</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1 leading-snug">
                      15 Honeypots • 1 seat • CSV export
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlan('pro')}
                    className={`p-3 rounded-lg border text-left transition-all font-mono cursor-pointer ${
                      plan === 'pro'
                        ? 'border-amber-500/80 bg-amber-950/30 text-white shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/40'
                        : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span className="flex items-center gap-1 text-amber-400">
                        <Sparkles size={12} /> Pro Tier
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">$155/mo</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1 leading-snug">
                      35 Honeypots • 3 Team seats • JSON export
                    </div>
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || !isPasswordValid || !email || !accountName}
                className="w-full mt-2 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600 font-mono text-xs cursor-pointer active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Create Account &amp; Continue</span>
                  </>
                )}
              </button>

              {/* Already have an account link */}
              <div className="pt-2 text-center border-t border-neutral-800/80 font-mono text-xs text-neutral-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={goToLogin}
                  className="text-red-400 hover:text-red-300 font-bold hover:underline cursor-pointer"
                >
                  Sign in here →
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignupView;
