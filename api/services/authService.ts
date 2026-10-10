import api from '../client';
import { API_ENDPOINTS } from '../../config/config';

export interface LoginCredentials {
    AdminEmail: string;
    AdminPassword: string;
}

export interface AuthGroup {
    GroupId: string;
    Name: string;
    Description: string;
}

/** Password step succeeded — OTP email sent; no session token yet. */
export interface MfaChallengeResponse {
    message: string;
    mfaRequired: true;
    AdminID: string;
    AdminEmail: string;
    otpExpiresInSeconds?: number;
}

export interface LoginResponse {
    message: string;
    token: string;
    expiresAt?: string;
    expiresInSeconds?: number;
    admin?: { AdminID: string; AdminEmail: string; CustomerID?: string | null };
    groups?: AuthGroup[];
    permissions?: string[];
    mfaRequired?: false;
}

export type AdminLoginResult = MfaChallengeResponse | LoginResponse;

export interface VerifyOtpCredentials {
    AdminID: string;
    AdminEmail?: string;
    OtpCode: string;
}

export interface MeResponse {
    admin: { AdminID: string; AdminEmail: string; CustomerID?: string | null };
    groups: AuthGroup[];
    permissions: string[];
}

export interface VerifyTokenResponse {
    message: string;
    admin?: { AdminID: string; AdminEmail: string; CustomerID?: string | null };
    permissions?: string[];
}

export const authService = {
    /**
     * Step 1: Admin login with email + password. Returns MFA challenge when email OTP is required.
     */
    async login(credentials: LoginCredentials): Promise<AdminLoginResult> {
        const response = await api.post<AdminLoginResult>(
            API_ENDPOINTS.ADMIN_LOGIN,
            credentials
        );
        return response.data;
    },

    /**
     * Step 2: Verify 6-digit email OTP. Returns JWT session token, expiration, and user permissions.
     */
    async verifyOtp(credentials: VerifyOtpCredentials): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>(
            API_ENDPOINTS.ADMIN_VERIFY_OTP,
            credentials
        );
        return response.data;
    },

    /**
     * Restore admin identity, tenant customerId, and permissions for the active session.
     */
    async me(): Promise<MeResponse> {
        const response = await api.get<MeResponse>(API_ENDPOINTS.ADMIN_ME);
        return response.data;
    },

    /**
     * Verify admin auth token validity.
     */
    async verifyToken(): Promise<VerifyTokenResponse> {
        const response = await api.post<VerifyTokenResponse>(
            API_ENDPOINTS.VERIFY_ADMIN_TOKEN
        );
        return response.data;
    },

    /**
     * Logout client-side trigger.
     */
    logout(): void {
        console.log('[AuthService] Logout called');
    },
};
