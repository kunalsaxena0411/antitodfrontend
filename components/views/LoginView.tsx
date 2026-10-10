import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../api/services";
import { handleApiError } from "../../api/client";
import {
  ShieldCheck,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
} from "lucide-react";

export const LoginView: React.FC = () => {
  const { saveToken, isAuthenticated } = useAuth();
  const [step, setStep] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [adminId, setAdminId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated]);

  // Countdown timer when on OTP step
  useEffect(() => {
    if (step !== "otp") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await authService.login({
        AdminEmail: email,
        AdminPassword: password,
      });

      if ("mfaRequired" in response && response.mfaRequired) {
        setAdminId(response.AdminID);
        setTimeLeft(response.otpExpiresInSeconds ?? 300);
        setStep("otp");
      } else if ("token" in response && response.token) {
        saveToken(response.token, {
          expiresAt: response.expiresAt,
          admin: response.admin,
          groups: response.groups,
          permissions: response.permissions,
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 300);
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error("[Login] Password error:", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId) {
      setError("Session expired. Please log in again.");
      setStep("password");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await authService.verifyOtp({
        AdminID: adminId,
        AdminEmail: email,
        OtpCode: otp.trim(),
      });

      saveToken(response.token, {
        expiresAt: response.expiresAt,
        admin: response.admin,
        groups: response.groups,
        permissions: response.permissions,
      });

      // Redirect to main app
      setTimeout(() => {
        window.location.href = "/";
      }, 300);
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error("[Login] OTP error:", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await authService.login({
        AdminEmail: email,
        AdminPassword: password,
      });
      if ("mfaRequired" in response && response.mfaRequired) {
        setAdminId(response.AdminID);
        setTimeLeft(response.otpExpiresInSeconds ?? 300);
        setOtp("");
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="min-h-screen bg-[#111] relative overflow-hidden flex items-center justify-center">
      {/* Cyber grid background */}
      <div className="cyber-grid-bg"></div>

      {/* Scanlines effect */}
      <div className="scanlines pointer-events-none fixed inset-0 z-50 opacity-5 mix-blend-overlay"></div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neutral-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      {/* Login container */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo and branding */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4 bg-red-600 rounded-2xl shadow-lg shadow-red-500/20">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-cyber font-bold text-white mb-2">
            ANTITODE
          </h1>
          <p className="text-neutral-400 font-mono text-sm">
            Cyber Threat & Honeypot Operations
          </p>
        </div>

        {/* Login card */}
        <div className="bg-[#111]/60 backdrop-blur-md border border-neutral-800 rounded-2xl p-8 shadow-2xl animate-slide-in-up">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            {step === "password" ? (
              <>
                <Lock className="w-6 h-6 text-red-500" />
                Admin Login
              </>
            ) : (
              <>
                <KeyRound className="w-6 h-6 text-red-500" />
                Verify Identity
              </>
            )}
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-200 text-sm font-mono">{error}</p>
              </div>
            </div>
          )}

          {step === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              {/* Email field */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-bold text-neutral-300 uppercase tracking-wide"
                >
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-red-500 transition-colors" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full bg-[#111]/50 border border-neutral-700 rounded-lg pl-12 pr-4 py-3 text-white font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="admin@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-bold text-neutral-300 uppercase tracking-wide"
                >
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-red-500 transition-colors" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full bg-[#111]/50 border border-neutral-700 rounded-lg pl-12 pr-12 py-3 text-white font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-red-500/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Continue to MFA</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-lg space-y-1">
                <p className="text-xs text-neutral-400 font-mono">
                  6-digit verification code dispatched to:
                </p>
                <p className="text-sm text-red-400 font-mono font-bold truncate">
                  {email}
                </p>
                <div className="flex items-center justify-between text-xs text-neutral-500 font-mono pt-1">
                  <span>Expires in: {formatTimer(timeLeft)}</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" /> Resend
                  </button>
                </div>
              </div>

              {/* OTP field */}
              <div className="space-y-2">
                <label
                  htmlFor="otp"
                  className="block text-sm font-bold text-neutral-300 uppercase tracking-wide"
                >
                  One-Time Passcode
                </label>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-red-500 transition-colors" />
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                    autoFocus
                    disabled={isLoading}
                    className="w-full bg-[#111]/50 border border-neutral-700 rounded-lg pl-12 pr-4 py-3 text-white font-mono text-xl tracking-[0.4em] focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="000000"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || otp.length !== 6 || timeLeft === 0}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Verify &amp; Sign In</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setStep("password");
                  setOtp("");
                  setAdminId(null);
                  setError(null);
                }}
                className="w-full text-sm text-neutral-500 hover:text-red-400 font-mono transition-colors text-center block"
              >
                ← Back to password
              </button>
            </form>
          )}

          {/* Additional info */}
          <div className="mt-6 pt-6 border-t border-neutral-800">
            <p className="text-center text-xs text-neutral-500 font-mono">
              Secure admin access only • MFA via email OTP
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-neutral-600 font-mono">
            © 2026 ANTITODE Security Platform • v2.0
          </p>
        </div>
      </div>
    </div>
  );
};
