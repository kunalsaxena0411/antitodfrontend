import api from '../client';
import { API_ENDPOINTS } from '../../config/config';

export interface RbacPermission {
  PermissionId: string;
  Description: string;
  Module: string;
}

export interface RbacGroup {
  GroupId: string;
  Name: string;
  Description: string;
  permissionIds: string[];
}

export interface RbacUser {
  AdminID: string;
  AdminEmail: string;
  IsActive: boolean;
  groups: Array<{ GroupId: string; Name: string; Description: string }>;
  permissions: string[];
}

export interface RbacAuditLog {
  AuditId: string;
  Action: 'group.create' | 'group.update' | 'user.create' | 'user.update' | string;
  ActorAdminID: string;
  ActorEmail: string;
  TargetType: 'group' | 'user' | string;
  TargetId: string;
  TargetLabel: string;
  Summary: string;
  Before: Record<string, unknown> | null;
  After: Record<string, unknown> | null;
  Metadata: Record<string, unknown> | null;
  createdAt: string;
}

const path = (template: string, params: Record<string, string>) => {
  let p = template;
  for (const [k, v] of Object.entries(params)) {
    p = p.replace(`:${k}`, encodeURIComponent(v));
  }
  return p;
};

export const rbacService = {
  async listPermissions(): Promise<RbacPermission[]> {
    const res = await api.get<{ permissions: RbacPermission[] }>(API_ENDPOINTS.RBAC_PERMISSIONS);
    return res.data.permissions;
  },

  async listGroups(): Promise<RbacGroup[]> {
    const res = await api.get<{ groups: RbacGroup[] }>(API_ENDPOINTS.RBAC_GROUPS);
    return res.data.groups;
  },

  async createGroup(body: {
    Name: string;
    Description?: string;
    permissionIds?: string[];
  }): Promise<RbacGroup> {
    const res = await api.post<{ group: RbacGroup }>(API_ENDPOINTS.RBAC_GROUPS, body);
    return res.data.group;
  },

  async updateGroup(
    groupId: string,
    body: { Name?: string; Description?: string; permissionIds?: string[] }
  ): Promise<RbacGroup> {
    const res = await api.put<{ group: RbacGroup }>(
      path(API_ENDPOINTS.RBAC_GROUP, { groupId }),
      body
    );
    return res.data.group;
  },

  async listUsers(): Promise<RbacUser[]> {
    const res = await api.get<{ users: RbacUser[] }>(API_ENDPOINTS.RBAC_USERS);
    return res.data.users;
  },

  async createUser(body: {
    AdminEmail: string;
    AdminPassword: string;
    groupIds?: string[];
    IsActive?: boolean;
  }): Promise<RbacUser> {
    const res = await api.post<{ user: RbacUser }>(API_ENDPOINTS.RBAC_USERS, body);
    return res.data.user;
  },

  async updateUser(
    adminId: string,
    body: { AdminPassword?: string; IsActive?: boolean; groupIds?: string[] }
  ): Promise<RbacUser> {
    const res = await api.put<{ user: RbacUser }>(
      path(API_ENDPOINTS.RBAC_USER, { adminId }),
      body
    );
    return res.data.user;
  },

  async listAuditLogs(params?: {
    limit?: number;
    offset?: number;
    action?: string;
    targetType?: string;
  }): Promise<{ total: number; logs: RbacAuditLog[] }> {
    const res = await api.get<{ total: number; logs: RbacAuditLog[] }>(API_ENDPOINTS.RBAC_AUDIT, {
      params,
    });
    return res.data;
  },
};
