import api from '../client';
import { API_ENDPOINTS } from '../../config/config';

// ============================================
// Server Management Types
// ============================================

export interface Server {
    ServerId: string;
    Hostname: string;
    PublicIp: string;
    PrivateIp?: string;
    Region: string;
    Provider: string;
    Os?: string;
    AgentStatus?: string;
    CreatedAt: string;
}

export interface RegisterServerRequest {
    ServerId: string;
    Hostname: string;
    PublicIp: string;
    PrivateIp?: string;
    Region: string;
    Provider?: string;
    Os?: string;
}

export interface RegisterServerResponse {
    message: string;
    server: Server;
}

export interface ListServersResponse {
    message: string;
    count: number;
    servers: Server[];
}

// ============================================
// Shipper Management Types
// ============================================

export interface Shipper {
    ShipperId: string;
    ServerId: string;
    AllowedIp: string;
    Active: boolean;
    CreatedAt: string;
    LastSeenAt?: string;
}

export interface RegisterShipperRequest {
    ServerId: string;
    AllowedIp: string;
}

export interface RegisterShipperResponse {
    message: string;
    shipper: {
        ShipperId: string;
        ServerId: string;
        AllowedIp: string;
        Token: string;
    };
    deployment: {
        installCommand: string;
        installScriptUrl: string;
        shipperBundleUrl: string;
        backendUrl: string;
    };
    instructions: string[];
    warning: string;
}

export interface ListShippersResponse {
    message: string;
    count: number;
    shippers: Shipper[];
}

export interface DeactivateShipperRequest {
    ShipperId: string;
}

export interface DeactivateShipperResponse {
    message: string;
}

export interface ReactivateShipperRequest {
    ShipperId: string;
}

export interface ReactivateShipperResponse {
    message: string;
}

export interface DeleteServerResponse {
    message: string;
    deleted: {
        server: string;
        agents: number;
        shippers: number;
        deployments: number;
    };
}

export interface DeleteShipperResponse {
    message: string;
    deleted: {
        shipperId: string;
        serverId: string;
    };
}

// ============================================
// Admin Service
// ============================================

export const adminService = {
    /**
     * Register a new honeypot server
     */
    async registerServer(data: RegisterServerRequest): Promise<RegisterServerResponse> {
        const response = await api.post<RegisterServerResponse>(
            API_ENDPOINTS.REGISTER_SERVER,
            data
        );
        return response.data;
    },

    /**
     * List all registered servers
     */
    async listServers(): Promise<ListServersResponse> {
        const response = await api.get<ListServersResponse>(
            API_ENDPOINTS.LIST_SERVERS
        );
        return response.data;
    },

    /**
     * Register a new log shipper for a server
     */
    async registerShipper(data: RegisterShipperRequest): Promise<RegisterShipperResponse> {
        const response = await api.post<RegisterShipperResponse>(
            API_ENDPOINTS.REGISTER_SHIPPER,
            data
        );
        return response.data;
    },

    /**
     * List all registered shippers
     */
    async listShippers(): Promise<ListShippersResponse> {
        const response = await api.get<ListShippersResponse>(
            API_ENDPOINTS.LIST_SHIPPERS
        );
        return response.data;
    },

    /**
     * Deactivate a shipper (block from sending logs)
     */
    async deactivateShipper(data: DeactivateShipperRequest): Promise<DeactivateShipperResponse> {
        const response = await api.post<DeactivateShipperResponse>(
            API_ENDPOINTS.DEACTIVATE_SHIPPER,
            data
        );
        return response.data;
    },

    /**
     * Reactivate a shipper
     */
    async reactivateShipper(data: ReactivateShipperRequest): Promise<ReactivateShipperResponse> {
        const response = await api.post<ReactivateShipperResponse>(
            API_ENDPOINTS.REACTIVATE_SHIPPER,
            data
        );
        return response.data;
    },

    /**
     * Hard-delete a server and cascade-delete all related shippers, agents, and deployments
     */
    async deleteServer(serverId: string): Promise<DeleteServerResponse> {
        const endpoint = API_ENDPOINTS.DELETE_SERVER.replace(':serverId', encodeURIComponent(serverId));
        const response = await api.delete<DeleteServerResponse>(endpoint);
        return response.data;
    },

    /**
     * Permanently delete a shipper record from the database
     */
    async deleteShipper(shipperId: string): Promise<DeleteShipperResponse> {
        const endpoint = API_ENDPOINTS.DELETE_SHIPPER.replace(':shipperId', encodeURIComponent(shipperId));
        const response = await api.delete<DeleteShipperResponse>(endpoint);
        return response.data;
    },
};
