import api from '../client';
import { API_ENDPOINTS } from '../../config/config';

export interface LoginCredentials {
    AdminEmail: string;
    AdminPassword: string;
}

export interface LoginResponse {
    message: string;
    token: string;
}

export interface VerifyTokenResponse {
    message: string;
}

export const authService = {
    /**
     * Admin login
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        // Mock login to bypass backend
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    message: "Mock login successful",
                    token: "mock-token-12345"
                });
            }, 500);
        });
    },

    /**
     * Verify admin token
     */
    async verifyToken(): Promise<VerifyTokenResponse> {
        const response = await api.post<VerifyTokenResponse>(
            API_ENDPOINTS.VERIFY_ADMIN_TOKEN
        );
        return response.data;
    },

    /**
     * Logout (client-side only)
     */
    logout(): void {
        // Token removal is handled by AuthContext
        console.log('[AuthService] Logout called');
    },
};
