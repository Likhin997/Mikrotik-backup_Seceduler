export interface RouterDevice {
  id: string;
  name: string;
  model: string;
  ipHost: string;
  port: number;
  protocol: 'push_webhook' | 'rest_api' | 'ssh_pull' | 'api_binary';
  osVersion?: 'v7' | 'v6';
  username?: string;
  password?: string;
  useTls: boolean;
  webhookToken: string;
  scheduleFrequency: 'hourly' | '6hours' | 'daily' | 'weekly' | 'manual';
  scheduleTime?: string;
  retentionCount: number;
  enabled: boolean;
  lastBackupAt?: string;
  lastBackupStatus?: 'success' | 'failed' | 'never';
  lastBackupMessage?: string;
  backupCount: number;
  totalStorageBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackupRecord {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceIp: string;
  filename: string;
  fileType: 'rsc' | 'backup';
  fileSize: number;
  filePath: string;
  contentPreview?: string;
  content?: string;
  trigger: 'scheduled' | 'manual' | 'webhook_push' | 'rest_api';
  status: 'success' | 'failed';
  routerOsVersion?: string;
  model?: string;
  metadata?: {
    interfacesCount?: number;
    vlansCount?: number;
    dhcpCount?: number;
    ipAddressesCount?: number;
    firewallRulesCount?: number;
    routesCount?: number;
    usersCount?: number;
  };
  notes?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'backup_success' | 'backup_failed' | 'device_added' | 'device_updated' | 'device_deleted' | 'restore_viewed' | 'cleaned_retention';
  deviceId?: string;
  deviceName?: string;
  message: string;
}

export interface SystemStats {
  totalDevices: number;
  activeDevices: number;
  totalBackups: number;
  totalSizeBytes: number;
  latestBackupTime: string | null;
  recentBackups: BackupRecord[];
}

export interface DiffLine {
  type: 'same' | 'added' | 'removed' | 'modified';
  oldLine?: number;
  newLine?: number;
  text: string;
}

export interface DiffResponse {
  backup1: {
    id: string;
    filename: string;
    createdAt: string;
  };
  backup2: {
    id: string;
    filename: string;
    createdAt: string;
  };
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
    totalLines: number;
  };
  diffLines: DiffLine[];
}

export interface ScriptResponse {
  deviceId: string;
  deviceName: string;
  webhookUrl: string;
  scriptName: string;
  schedulerName: string;
  interval: string;
  startTime: string;
  scriptContentRsc: string;
  scriptContentBinary: string;
  scriptContentRscV6?: string;
  scriptContentBinaryV6?: string;
}

export interface AppInfo {
  appName: string;
  version: string;
  baseUrl: string;
  uploadEndpoint: string;
  storageDirectory: string;
  time: string;
}

export interface AuthUser {
  username: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}
