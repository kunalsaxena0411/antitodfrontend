import api from '../client';
import { API_ENDPOINTS } from '../../config/config';

// ============================================
// Enums / Literal Types
// ============================================

export type AgentStatus = 'pending' | 'online' | 'offline' | 'error';
export type ServerAgentStatus = 'none' | 'pending' | 'online' | 'offline';
export type DeploymentStatus = 'deploying' | 'active' | 'stopped' | 'error' | 'removed';
export type TemplateCategory = 'honeypot' | 'utility' | 'monitoring';

// ============================================
// Server Overview Types
// ============================================

export interface ServerOverviewItem {
    ServerId: string;
    Hostname: string;
    PublicIp: string;
    PrivateIp: string | null;
    Region: string;
    Provider: string;
    Os: string | null;
    DockerVersion: string | null;
    AgentStatus: ServerAgentStatus;
    CreatedAt: string;
    agent: {
        isRegistered: true;
        agentId: string;
        status: AgentStatus;
        lastHeartbeat: string;
    } | { isRegistered: false };
    shipper: {
        isRegistered: true;
        shipperId: string;
        allowedIp: string;
        active: boolean;
    } | { isRegistered: false };
    deployments: {
        active: number;
        total: number;
    };
}

export interface ServersOverviewResponse {
    message: string;
    count: number;
    servers: ServerOverviewItem[];
}

export interface AgentRecord {
    isRegistered: true;
    AgentId: string;
    ServerId: string;
    PortainerEndpointId: number;
    Status: AgentStatus;
    LastHeartbeat: string;
    AgentVersion: string;
    DockerVersion: string;
    CreatedAt: string;
}

export interface ShipperRecord {
    isRegistered: true;
    ShipperId: string;
    ServerId: string;
    AllowedIp: string;
    Active: boolean;
    CreatedAt: string;
}

export interface DeploymentRecord {
    DeploymentId: string;
    TemplateId: string;
    StackName: string;
    Status: DeploymentStatus;
    PortainerStackId: number | null;
    CreatedAt: string;
    UpdatedAt?: string;
    templateName?: string;
    templateCategory?: TemplateCategory;
}

export interface ServerDetailResponse {
    server: {
        ServerId: string;
        Hostname: string;
        PublicIp: string;
        PrivateIp: string | null;
        Region: string;
        Provider: string;
        Os: string | null;
        DockerVersion: string | null;
        AgentStatus: ServerAgentStatus;
        CreatedAt: string;
    };
    agent: (AgentRecord & { EdgeKey?: string; EdgeId?: string }) | { isRegistered: false };
    shipper: ShipperRecord | { isRegistered: false };
    deployments: DeploymentRecord[];
}

// ============================================
// Agent Management Types
// ============================================

export interface RegisterAgentRequest {
    ServerId: string;
}

export interface RegisterAgentResponse {
    message: string;
    agent: {
        AgentId: string;
        ServerId: string;
        PortainerEndpointId: number;
        Status: AgentStatus;
        EdgeId: string;
    };
    installCommand: string;
    instructions: string[];
}

export interface AgentListItem {
    AgentId: string;
    ServerId: string;
    PortainerEndpointId: number;
    Status: AgentStatus;
    LastHeartbeat: string;
    AgentVersion: string;
    DockerVersion: string;
    CreatedAt: string;
    server: {
        Hostname: string;
        PublicIp: string;
        Region: string;
        Provider: string;
    };
}

export interface ListAgentsResponse {
    message: string;
    count: number;
    agents: AgentListItem[];
}

export interface AgentSnapshot {
    dockerVersion: string;
    runningContainers: number;
    stoppedContainers: number;
    totalCPU: number;
    totalMemory: number;
    imageCount: number;
    os?: string;
}

export interface AgentDetailResponse {
    message: string;
    agent: {
        AgentId: string;
        ServerId: string;
        PortainerEndpointId: number;
        EdgeKey: string;
        EdgeId: string;
        Status: AgentStatus;
        LastHeartbeat: string;
        AgentVersion: string;
        DockerVersion: string;
        CreatedAt: string;
    };
    server: {
        ServerId: string;
        Hostname: string;
        PublicIp: string;
        PrivateIp: string | null;
        Region: string;
        Provider: string;
        Os: string | null;
        DockerVersion: string | null;
    };
    portainer: {
        status: string;
        lastCheckIn: string;
        snapshots: AgentSnapshot;
    };
    deployments: DeploymentRecord[];
}

export interface AgentStatusResponse {
    agentId: string;
    status: AgentStatus;
    portainerEndpointId: number;
    lastCheckIn: string;
    snapshot: {
        dockerVersion: string;
        runningContainers: number;
        stoppedContainers: number;
        totalCPU: number;
        totalMemoryMB: number;
        imageCount: number;
        os: string;
    };
}

export interface AgentInstallScriptResponse {
    agentId: string;
    serverId: string;
    hostname: string;
    scriptType: string;
    script: string;
}

// ============================================
// Container Management Types
// ============================================

export interface ContainerPort {
    hostPort: number;
    containerPort: number;
    type: string;
}

export interface ContainerSummary {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    created: string;
    ports: ContainerPort[];
    labels: Record<string, string>;
    isXyberah: boolean;
    xyberahType: string | null;
}

export interface ListContainersResponse {
    agentId: string;
    serverId: string;
    count: number;
    containers: ContainerSummary[];
}

export interface ContainerLogsResponse {
    agentId: string;
    containerId: string;
    tail: number;
    logs: string;
}

// ============================================
// Template Types
// ============================================

export interface EnvTemplateField {
    description: string;
    default: string;
    required: boolean;
}

export interface DeploymentTemplate {
    TemplateId: string;
    Name: string;
    Description: string;
    Category: TemplateCategory;
    StackFileContent: string;
    EnvTemplate: Record<string, EnvTemplateField>;
    IsActive: boolean;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface ListTemplatesResponse {
    message: string;
    count: number;
    templates: DeploymentTemplate[];
}

export interface CreateTemplateRequest {
    Name: string;
    Description?: string;
    Category?: TemplateCategory;
    StackFileContent: string;
    EnvTemplate?: Record<string, EnvTemplateField>;
}

// ============================================
// Deployment Types
// ============================================

export interface DeployStackRequest {
    TemplateId: string;
    envVars?: Record<string, string>;
    stackName?: string;
}

export interface DeployStackResponse {
    message: string;
    deployment: {
        DeploymentId: string;
        ServerId: string;
        AgentId: string;
        TemplateId: string;
        StackName: string;
        PortainerStackId: number;
        Status: DeploymentStatus;
        EnvVars: Record<string, string>;
        CreatedAt: string;
    };
}

export interface ListDeploymentsResponse {
    agentId: string;
    serverId: string;
    count: number;
    deployments: (DeploymentRecord & {
        ServerId: string;
        AgentId: string;
        EnvVars: Record<string, string>;
        ErrorMessage: string | null;
        UpdatedAt: string;
    })[];
}

// ============================================
// Metrics Types
// ============================================

export interface AgentMetrics {
    serverId: string;
    agentId: string;
    agentStatus: AgentStatus;
    lastHeartbeat: string;
    docker: {
        version: string;
        os: string | null;
        architecture: string | null;
        kernelVersion: string | null;
    };
    resources: {
        cpuCount: number;
        memoryTotalBytes: number;
        memoryTotalMB: number;
    };
    containers: {
        total: number;
        running: number;
        stopped: number;
        paused: number;
    };
    storage: {
        images: number;
        volumes: number;
    };
    note?: string;
}

export interface PortainerHealthResponse {
    status: 'healthy' | 'unhealthy';
    portainerVersion?: string;
    instanceId?: string;
    message?: string;
}

export interface DeleteAgentHardResponse {
    message: string;
    deleted: {
        agentId: string;
        serverId: string;
        deployments: number;
    };
}

// ============================================
// Agent Service
// ============================================

const r = (template: string, params: Record<string, string>) =>
    Object.entries(params).reduce((acc, [k, v]) => acc.replace(`:${k}`, encodeURIComponent(v)), template);

export const agentService = {
    // ── Server Overview ──────────────────────────────────────────────────
    async getServersOverview(): Promise<ServersOverviewResponse> {
        const res = await api.get<ServersOverviewResponse>(API_ENDPOINTS.SERVERS_OVERVIEW);
        return res.data;
    },

    async getServerOverview(serverId: string): Promise<ServerDetailResponse> {
        const endpoint = r(API_ENDPOINTS.SERVER_OVERVIEW, { serverId });
        const res = await api.get<ServerDetailResponse>(endpoint);
        return res.data;
    },

    // ── Agent Management ─────────────────────────────────────────────────
    async listAgents(): Promise<ListAgentsResponse> {
        const res = await api.get<ListAgentsResponse>(API_ENDPOINTS.AGENTS_LIST);
        return res.data;
    },

    async registerAgent(data: RegisterAgentRequest): Promise<RegisterAgentResponse> {
        const res = await api.post<RegisterAgentResponse>(API_ENDPOINTS.AGENT_REGISTER, data);
        return res.data;
    },

    async getAgentDetail(agentId: string): Promise<AgentDetailResponse> {
        const endpoint = r(API_ENDPOINTS.AGENT_DETAIL, { agentId });
        const res = await api.get<AgentDetailResponse>(endpoint);
        return res.data;
    },

    async deleteAgent(agentId: string): Promise<{ message: string }> {
        const endpoint = r(API_ENDPOINTS.AGENT_DELETE, { agentId });
        const res = await api.delete<{ message: string }>(endpoint);
        return res.data;
    },

    async hardDeleteAgent(agentId: string): Promise<DeleteAgentHardResponse> {
        const endpoint = r(API_ENDPOINTS.AGENT_HARD_DELETE, { agentId });
        const res = await api.delete<DeleteAgentHardResponse>(endpoint);
        return res.data;
    },

    async getAgentStatus(agentId: string): Promise<AgentStatusResponse> {
        const endpoint = r(API_ENDPOINTS.AGENT_STATUS, { agentId });
        const res = await api.get<AgentStatusResponse>(endpoint);
        return res.data;
    },

    async getInstallScript(agentId: string, full = false): Promise<AgentInstallScriptResponse> {
        const endpoint = r(API_ENDPOINTS.AGENT_INSTALL_SCRIPT, { agentId });
        const res = await api.get<AgentInstallScriptResponse>(endpoint, { params: { full } });
        return res.data;
    },

    // ── Container Management ─────────────────────────────────────────────
    async listContainers(agentId: string, all = true, signal?: AbortSignal): Promise<ListContainersResponse> {
        const endpoint = r(API_ENDPOINTS.AGENT_CONTAINERS, { agentId });
        const res = await api.get<ListContainersResponse>(endpoint, { params: { all }, signal });
        return res.data;
    },

    async containerAction(
        agentId: string,
        containerId: string,
        action: 'start' | 'stop' | 'restart'
    ): Promise<{ message: string }> {
        const templateMap: Record<string, string> = {
            start: API_ENDPOINTS.AGENT_CONTAINER_START,
            stop: API_ENDPOINTS.AGENT_CONTAINER_STOP,
            restart: API_ENDPOINTS.AGENT_CONTAINER_RESTART,
        };
        const endpoint = r(templateMap[action], { agentId, containerId });
        const res = await api.post<{ message: string }>(endpoint);
        return res.data;
    },

    async removeContainer(agentId: string, containerId: string): Promise<{ message: string }> {
        const endpoint = r(API_ENDPOINTS.AGENT_CONTAINER_REMOVE, { agentId, containerId });
        const res = await api.delete<{ message: string }>(endpoint);
        return res.data;
    },

    async getContainerLogs(agentId: string, containerId: string, tail = 200): Promise<ContainerLogsResponse> {
        const endpoint = r(API_ENDPOINTS.AGENT_CONTAINER_LOGS, { agentId, containerId });
        const res = await api.get<ContainerLogsResponse>(endpoint, { params: { tail } });
        return res.data;
    },

    // ── Templates ────────────────────────────────────────────────────────
    async listTemplates(params?: { category?: TemplateCategory; active?: boolean }): Promise<ListTemplatesResponse> {
        const res = await api.get<ListTemplatesResponse>(API_ENDPOINTS.TEMPLATES_LIST, { params });
        return res.data;
    },

    async getTemplate(templateId: string): Promise<{ template: DeploymentTemplate }> {
        const endpoint = r(API_ENDPOINTS.TEMPLATE_DETAIL, { templateId });
        const res = await api.get<{ template: DeploymentTemplate }>(endpoint);
        return res.data;
    },

    async createTemplate(data: CreateTemplateRequest): Promise<{ message: string; template: DeploymentTemplate }> {
        const res = await api.post<{ message: string; template: DeploymentTemplate }>(API_ENDPOINTS.TEMPLATE_CREATE, data);
        return res.data;
    },

    async updateTemplate(templateId: string, data: Partial<DeploymentTemplate>): Promise<{ message: string; template: DeploymentTemplate }> {
        const endpoint = r(API_ENDPOINTS.TEMPLATE_UPDATE, { templateId });
        const res = await api.put<{ message: string; template: DeploymentTemplate }>(endpoint, data);
        return res.data;
    },

    async deleteTemplate(templateId: string): Promise<{ message: string }> {
        const endpoint = r(API_ENDPOINTS.TEMPLATE_DELETE, { templateId });
        const res = await api.delete<{ message: string }>(endpoint);
        return res.data;
    },

    // ── Deployments ──────────────────────────────────────────────────────
    async deployStack(agentId: string, data: DeployStackRequest): Promise<DeployStackResponse> {
        const endpoint = r(API_ENDPOINTS.AGENT_DEPLOY, { agentId });
        const res = await api.post<DeployStackResponse>(endpoint, data);
        return res.data;
    },

    async listDeployments(agentId: string): Promise<ListDeploymentsResponse> {
        const endpoint = r(API_ENDPOINTS.AGENT_DEPLOYMENTS, { agentId });
        const res = await api.get<ListDeploymentsResponse>(endpoint);
        return res.data;
    },

    async deploymentAction(deploymentId: string, action: 'start' | 'stop'): Promise<{ message: string }> {
        const templateMap: Record<string, string> = {
            start: API_ENDPOINTS.DEPLOYMENT_START,
            stop: API_ENDPOINTS.DEPLOYMENT_STOP,
        };
        const endpoint = r(templateMap[action], { deploymentId });
        const res = await api.post<{ message: string }>(endpoint);
        return res.data;
    },

    async removeDeployment(deploymentId: string): Promise<{ message: string }> {
        const endpoint = r(API_ENDPOINTS.DEPLOYMENT_REMOVE, { deploymentId });
        const res = await api.delete<{ message: string }>(endpoint);
        return res.data;
    },

    // ── Metrics & Health ─────────────────────────────────────────────────
    async getMetrics(agentId: string): Promise<AgentMetrics> {
        const endpoint = r(API_ENDPOINTS.AGENT_METRICS, { agentId });
        const res = await api.get<AgentMetrics>(endpoint);
        return res.data;
    },

    async getPortainerHealth(): Promise<PortainerHealthResponse> {
        const res = await api.get<PortainerHealthResponse>(API_ENDPOINTS.PORTAINER_HEALTH);
        return res.data;
    },
};
