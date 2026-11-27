import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import multer from 'multer';
import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Ensure data directories exist
const DATA_DIR = path.resolve(__dirname, 'data');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Data models
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
  scheduleTime?: string; // HH:mm for daily
  retentionCount: number; // e.g. 10 or 30
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
    ipServicesCount?: number;
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

export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  lastLoginAt?: string;
  updatedAt: string;
}

export interface SecuritySettings {
  blockScanners: boolean;
  silentDropUnauthorized: boolean;
  ipAllowlistEnabled: boolean;
  allowedIps: string[];
  allowRegisteredDeviceIps: boolean;
  rateLimitPerMinute: number;
  hideServerFingerprint: boolean;
  updatedAt: string;
}

interface AppDatabase {
  devices: RouterDevice[];
  backups: BackupRecord[];
  logs: ActivityLog[];
  admin: AdminUser;
  security?: SecuritySettings;
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  blockScanners: process.env.BLOCK_SCANNERS !== 'false',
  silentDropUnauthorized: process.env.STEALTH_DROP !== 'false',
  ipAllowlistEnabled: Boolean(process.env.ALLOWED_IPS && process.env.ALLOWED_IPS.trim().length > 0),
  allowedIps: process.env.ALLOWED_IPS
    ? process.env.ALLOWED_IPS.split(',').map(s => s.trim()).filter(Boolean)
    : ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10'],
  allowRegisteredDeviceIps: true,
  rateLimitPerMinute: 120,
  hideServerFingerprint: true,
  updatedAt: new Date().toISOString()
};

function normalizeIp(rawIp: string | undefined | null): string {
  if (!rawIp) return '';
  let ip = rawIp.trim();
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  // Strip IPv4 port if present (e.g. 1.2.3.4:54321)
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }
  return ip;
}

function getClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) return normalizeIp(cfIp);
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) return normalizeIp(xff);
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) return normalizeIp(realIp);
  }
  return normalizeIp(req.socket.remoteAddress || req.ip || '');
}

function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.startsWith('127.');
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

function isValidIpOrCidr(entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed || trimmed.length > 64) return false;
  if (trimmed === '::1') return true;
  if (trimmed.includes('/')) {
    const [base, prefixStr] = trimmed.split('/');
    if (!base || !prefixStr || !/^\d+$/.test(prefixStr)) return false;
    const prefix = parseInt(prefixStr, 10);
    if (ipv4ToInt(base) !== null && prefix >= 0 && prefix <= 32) return true;
    return false;
  }
  if (ipv4ToInt(trimmed) !== null) return true;
  return net.isIP(trimmed) !== 0;
}

function ipMatchesEntry(clientIp: string, entry: string): boolean {
  const target = entry.trim();
  if (!target) return false;
  if (clientIp === target) return true;
  if (target.includes('/')) {
    const [base, prefixStr] = target.split('/');
    const prefix = parseInt(prefixStr, 10);
    const ipInt = ipv4ToInt(clientIp);
    const baseInt = ipv4ToInt(base);
    if (ipInt === null || baseInt === null || isNaN(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  }
  return false;
}

const KNOWN_SCANNER_UA_PATTERNS: RegExp[] = [
  /shodan/i,
  /censys/i,
  /zoomeye/i,
  /binaryedge/i,
  /masscan/i,
  /zgrab/i,
  /nmap/i,
  /nikto/i,
  /sqlmap/i,
  /nuclei/i,
  /internetmeasurement/i,
  /expanse/i,
  /palo\s*alto\s*networks/i,
  /netcraft/i,
  /stretchoid/i,
  /onyphe/i,
  /criminalip/i,
  /leakix/i,
  /fofa/i,
  /modat/i,
  /driftnet/i,
  /shadowserver/i,
  /scans\.io/i,
  /l9explore/i,
  /l9tcpid/i,
  /gobuster/i,
  /dirbuster/i,
  /ffuf/i,
  /wpscan/i
];

const KNOWN_SCANNER_PROBE_PATHS: RegExp[] = [
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/wp-login\.php/i,
  /^\/wp-admin/i,
  /^\/xmlrpc\.php/i,
  /^\/phpmyadmin/i,
  /^\/pma/i,
  /^\/actuator/i,
  /^\/solr/i,
  /^\/cgi-bin/i,
  /^\/boaform/i,
  /^\/hnap1/i,
  /^\/sdk\/weblanguage/i,
  /^\/geoserver/i,
  /^\/vendor\/phpunit/i
];

function detectScannerProbe(req: Request): string | null {
  const ua = String(req.headers['user-agent'] || '');
  for (const rx of KNOWN_SCANNER_UA_PATTERNS) {
    if (rx.test(ua)) return `Scanner UA (${ua.slice(0, 60)})`;
  }
  const reqPath = req.path || '/';
  for (const rx of KNOWN_SCANNER_PROBE_PATHS) {
    if (rx.test(reqPath)) return `Probe Path (${reqPath.slice(0, 60)})`;
  }
  return null;
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// Initial database seeding if empty
function loadDatabase(): AppDatabase {
  let existingDb: AppDatabase | null = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      existingDb = JSON.parse(content);
    } catch (err) {
      console.error('Error reading database.json, initializing fresh db:', err);
    }
  }

  const defaultSalt = crypto.randomBytes(16).toString('hex');
  const defaultAdmin: AdminUser = {
    id: 'admin_likhin',
    username: 'likhin',
    passwordSalt: defaultSalt,
    passwordHash: hashPassword('11013009', defaultSalt),
    updatedAt: new Date().toISOString()
  };

  if (existingDb) {
    let changed = false;
    if (!existingDb.admin) {
      existingDb.admin = defaultAdmin;
      changed = true;
    }
    if (!existingDb.security) {
      existingDb.security = { ...DEFAULT_SECURITY_SETTINGS, updatedAt: new Date().toISOString() };
      changed = true;
    }
    if (changed) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(existingDb, null, 2), 'utf-8');
      } catch (e) {}
    }
    return existingDb;
  }

  // Initial seed with sample realistic MikroTik devices
  const initialDevices: RouterDevice[] = [
    {
      id: 'dev_gateway_core',
      name: 'RB4011 Core Gateway',
      model: 'MikroTik RB4011iGS+5HacQ2HnD',
      ipHost: '192.168.88.1',
      port: 443,
      protocol: 'push_webhook',
      useTls: true,
      webhookToken: crypto.randomBytes(16).toString('hex'),
      scheduleFrequency: 'daily',
      scheduleTime: '02:00',
      retentionCount: 15,
      enabled: true,
      lastBackupAt: new Date(Date.now() - 3600 * 4 * 1000).toISOString(),
      lastBackupStatus: 'success',
      lastBackupMessage: 'Backup otomatis via RouterOS scheduler berhasil diterima',
      backupCount: 2,
      totalStorageBytes: 15840,
      createdAt: new Date(Date.now() - 3600 * 24 * 7 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'dev_ccr_datacenter',
      name: 'CCR2004 Datacenter Edge',
      model: 'MikroTik CCR2004-1G-12S+2XS',
      ipHost: '10.100.0.1',
      port: 443,
      protocol: 'rest_api',
      username: 'admin_backup',
      password: '',
      useTls: true,
      webhookToken: crypto.randomBytes(16).toString('hex'),
      scheduleFrequency: 'hourly',
      retentionCount: 30,
      enabled: true,
      lastBackupAt: new Date(Date.now() - 3600 * 1 * 1000).toISOString(),
      lastBackupStatus: 'success',
      lastBackupMessage: 'Export konfigurasi RouterOS v7 berhasil ditarik',
      backupCount: 1,
      totalStorageBytes: 9420,
      createdAt: new Date(Date.now() - 3600 * 24 * 3 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'dev_branch_office',
      name: 'Branch Office hAP ax3',
      model: 'MikroTik C53UiG+5HPaxD2HPaxD',
      ipHost: '192.168.10.1',
      port: 80,
      protocol: 'push_webhook',
      useTls: false,
      webhookToken: crypto.randomBytes(16).toString('hex'),
      scheduleFrequency: 'daily',
      scheduleTime: '03:30',
      retentionCount: 10,
      enabled: true,
      lastBackupAt: new Date(Date.now() - 3600 * 20 * 1000).toISOString(),
      lastBackupStatus: 'success',
      lastBackupMessage: 'Webhook fetch upload export script diterima',
      backupCount: 1,
      totalStorageBytes: 8120,
      createdAt: new Date(Date.now() - 3600 * 24 * 2 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const db: AppDatabase = {
    devices: initialDevices,
    backups: [],
    logs: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'device_added',
        message: 'Sistem backup otomatis MikroTik dimulai'
      }
    ],
    admin: defaultAdmin,
    security: { ...DEFAULT_SECURITY_SETTINGS, updatedAt: new Date().toISOString() }
  };

  saveDatabase(db);
  // Seed sample realistic backups
  seedSampleBackups(db);
  return db;
}

function saveDatabase(db: AppDatabase) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database.json:', err);
  }
}

// Function to generate realistic sample RouterOS .rsc configuration
function generateSampleRscContent(deviceName: string, model: string, version: string = '7.16.1', variation: number = 0): string {
  const dateStr = new Date(Date.now() - variation * 86400000).toISOString().split('T')[0];
  const timeStr = new Date(Date.now() - variation * 86400000).toTimeString().split(' ')[0];

  return `# MikroTik RouterOS ${version}
# software id = 4K9J-XZ21
# model = ${model}
# serial number = H4D90FA410E7
# generated by Auto-Backup System on ${dateStr} ${timeStr}

/interface bridge
add admin-mac=DC:2C:6E:40:11:01 auto-mac=no comment="LAN Bridge with Hardware Offloading" name=bridge1 vlan-filtering=yes

/interface ethernet
set [ find default-name=ether1 ] comment="WAN 1 - Dedicated Fiber ISP" name=ether1-wan1
set [ find default-name=ether2 ] comment="WAN 2 - Backup Broadband" name=ether2-wan2
set [ find default-name=ether3 ] comment="Trunk to Core Switch SW1" name=ether3-trunk
set [ find default-name=ether4 ] comment="Access Point AP-North" name=ether4-ap
set [ find default-name=ether5 ] comment="Management Port" name=ether5-mgmt

/interface vlan
add interface=bridge1 name=vlan10-mgmt vlan-id=10
add interface=bridge1 name=vlan20-staff vlan-id=20
add interface=bridge1 name=vlan30-guest vlan-id=30
add interface=bridge1 name=vlan40-cctv vlan-id=40

/interface list
add comment=defconf name=WAN
add comment=defconf name=LAN

/interface list member
add interface=ether1-wan1 list=WAN
add interface=ether2-wan2 list=WAN
add interface=bridge1 list=LAN
add interface=vlan10-mgmt list=LAN
add interface=vlan20-staff list=LAN

/ip pool
add name=pool-staff ranges=192.168.20.100-192.168.20.250
add name=pool-guest ranges=172.16.30.10-172.16.30.250
add name=pool-cctv ranges=192.168.40.10-192.168.40.50

/ip dhcp-server
add address-pool=pool-staff interface=vlan20-staff lease-time=12h name=dhcp-staff
add address-pool=pool-guest interface=vlan30-guest lease-time=2h name=dhcp-guest
add address-pool=pool-cctv interface=vlan40-cctv lease-time=3d name=dhcp-cctv

/ip address
add address=192.168.88.1/24 comment="Default Management IP" interface=bridge1 network=192.168.88.0
add address=192.168.20.1/24 comment="Staff Gateway" interface=vlan20-staff network=192.168.20.0
add address=172.16.30.1/24 comment="Guest Gateway" interface=vlan30-guest network=172.16.30.0
add address=192.168.40.1/24 comment="CCTV Subnet" interface=vlan40-cctv network=192.168.40.0
${variation === 0 ? 'add address=10.200.0.1/30 comment="Inter-Router Link" interface=ether5-mgmt network=10.200.0.0' : ''}

/ip dns
set allow-remote-requests=yes cache-size=8192KiB servers=1.1.1.1,8.8.8.8,1.0.0.1

/ip firewall filter
add action=accept chain=input comment="defconf: accept established,related,untracked" connection-state=established,related,untracked
add action=drop chain=input comment="defconf: drop invalid" connection-state=invalid
add action=accept chain=input comment="defconf: accept ICMP" protocol=icmp
add action=accept chain=input comment="allow management from trusted VLAN" in-interface=vlan10-mgmt
${variation === 0 ? 'add action=accept chain=input comment="allow secure backup agent" dst-port=443 protocol=tcp' : ''}
add action=drop chain=input comment="defconf: drop all not coming from LAN" in-interface-list=!LAN
add action=fasttrack-connection chain=forward comment="defconf: fasttrack" connection-state=established,related hw-offload=yes
add action=accept chain=forward comment="defconf: accept established,related, untracked" connection-state=established,related,untracked
add action=drop chain=forward comment="defconf: drop invalid" connection-state=invalid
add action=drop chain=forward comment="isolate guest from staff network" in-interface=vlan30-guest out-interface=vlan20-staff
add action=drop chain=forward comment="defconf: drop all from WAN not DSTNATed" connection-nat-state=!dstnat connection-state=new in-interface-list=WAN

/ip firewall nat
add action=masquerade chain=srcnat comment="NAT WAN 1 Primary" out-interface=ether1-wan1
add action=masquerade chain=srcnat comment="NAT WAN 2 Failover" out-interface=ether2-wan2
add action=dst-nat chain=dstnat comment="Port Forward NVR CCTV" dst-port=8000 in-interface=ether1-wan1 protocol=tcp to-addresses=192.168.40.10 to-ports=8000

/routing table
add fib name=to-WAN1
add fib name=to-WAN2

/ip service
set telnet disabled=yes
set ftp disabled=yes
set www disabled=no port=80
set ssh disabled=no port=22
set www-ssl disabled=yes port=443
set api disabled=no port=8728
set winbox disabled=no port=8291
set api-ssl disabled=yes port=8729

/system identity
set name="${deviceName.replace(/[^a-zA-Z0-9_-]/g, '_')}"

/system clock
set time-zone-name=Asia/Jakarta

/system ntp client
set enabled=yes
/system ntp client servers
add address=id.pool.ntp.org

# --- Auto Backup Scheduler Script Configured by Backup Manager ---
/system script
add dont-require-permissions=no name=auto-backup-rsc owner=admin policy=read,write,policy,test source=\
    ":local devName [/system identity get name];\\
    \\n:local sysDate [/system clock get date];\\
    \\n:local fileName (\$devName . \"_\" . \$sysDate . \".rsc\");\\
    \\n/export show-sensitive file=\$fileName;\\
    \\n:delay 2s;\\
    \\n/tool fetch http-method=post http-data=\"\" upload=yes src-path=\$fileName url=\"AUTO_BACKUP_URL\";\\
    \\n:log info (\"Auto backup exported and uploaded: \" . \$fileName);"
`;
}

function parseRscStats(content: string) {
  const interfacesMatch = content.match(/\/interface (bridge|ethernet|vlan|list|wireguard)[^/]+/g);
  const ipMatch = content.match(/\/ip address[\s\S]*?(?=\/[a-z]|$)/);
  const firewallFilterMatch = content.match(/\/ip firewall filter[\s\S]*?(?=\/[a-z]|$)/);
  const firewallNatMatch = content.match(/\/ip firewall nat[\s\S]*?(?=\/[a-z]|$)/);
  const routesMatch = content.match(/\/ip route[\s\S]*?(?=\/[a-z]|$)/);
  const usersMatch = content.match(/\/user[\s\S]*?(?=\/[a-z]|$)/);
  const ipServicesMatch = content.match(/\/ip service[\s\S]*?(?=\/[a-z]|$)/);

  const ipCount = ipMatch ? (ipMatch[0].match(/add /g) || []).length : 0;
  const filterCount = firewallFilterMatch ? (firewallFilterMatch[0].match(/add /g) || []).length : 0;
  const natCount = firewallNatMatch ? (firewallNatMatch[0].match(/add /g) || []).length : 0;
  const routesCount = routesMatch ? (routesMatch[0].match(/add /g) || []).length : 0;
  const usersCount = usersMatch ? (usersMatch[0].match(/add /g) || []).length : 1;
  const ipServicesCount = ipServicesMatch ? (ipServicesMatch[0].match(/set /g) || []).length : 0;

  let interfacesCount = 5;
  if (interfacesMatch) {
    let count = 0;
    interfacesMatch.forEach(block => {
      count += (block.match(/add |set \[/g) || []).length;
    });
    if (count > 0) interfacesCount = count;
  }

  // Count VLANs
  const vlanBlocks = content.match(/\/interface (bridge\s+vlan|vlan)[\s\S]*?(?=\/[a-z]|$)/g);
  let vlansCount = 0;
  if (vlanBlocks) {
    vlanBlocks.forEach(b => {
      vlansCount += (b.match(/add /g) || []).length;
    });
  }

  // Count DHCP servers and networks
  const dhcpBlocks = content.match(/\/ip dhcp-server[\s\S]*?(?=\/[a-z]|$)/g);
  let dhcpCount = 0;
  if (dhcpBlocks) {
    dhcpBlocks.forEach(b => {
      dhcpCount += (b.match(/add /g) || []).length;
    });
  }

  return {
    interfacesCount,
    vlansCount,
    dhcpCount,
    ipAddressesCount: ipCount || 4,
    firewallRulesCount: filterCount + natCount || 12,
    routesCount: routesCount || 2,
    usersCount: usersCount || 1,
    ipServicesCount: ipServicesCount || 8
  };
}

function seedSampleBackups(db: AppDatabase) {
  // Seed sample backups for dev_gateway_core
  const coreDevice = db.devices.find(d => d.id === 'dev_gateway_core');
  if (coreDevice) {
    const devDir = path.resolve(BACKUPS_DIR, coreDevice.id);
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }

    // Backup 1 (Latest)
    const content1 = generateSampleRscContent(coreDevice.name, coreDevice.model, '7.16.1', 0);
    const filename1 = `${coreDevice.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_2026-09-29_02-00.rsc`;
    const filePath1 = path.resolve(devDir, filename1);
    fs.writeFileSync(filePath1, content1, 'utf-8');

    const backup1: BackupRecord = {
      id: crypto.randomUUID(),
      deviceId: coreDevice.id,
      deviceName: coreDevice.name,
      deviceIp: coreDevice.ipHost,
      filename: filename1,
      fileType: 'rsc',
      fileSize: Buffer.byteLength(content1, 'utf-8'),
      filePath: filePath1,
      contentPreview: content1.slice(0, 400),
      trigger: 'scheduled',
      status: 'success',
      routerOsVersion: '7.16.1',
      model: coreDevice.model,
      metadata: parseRscStats(content1),
      notes: 'Backup rutin terjadwal via RouterOS script /tool fetch',
      createdAt: new Date(Date.now() - 3600 * 4 * 1000).toISOString()
    };

    // Backup 2 (Previous day - for diffing!)
    const content2 = generateSampleRscContent(coreDevice.name, coreDevice.model, '7.16.1', 1);
    const filename2 = `${coreDevice.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_2026-09-28_02-00.rsc`;
    const filePath2 = path.resolve(devDir, filename2);
    fs.writeFileSync(filePath2, content2, 'utf-8');

    const backup2: BackupRecord = {
      id: crypto.randomUUID(),
      deviceId: coreDevice.id,
      deviceName: coreDevice.name,
      deviceIp: coreDevice.ipHost,
      filename: filename2,
      fileType: 'rsc',
      fileSize: Buffer.byteLength(content2, 'utf-8'),
      filePath: filePath2,
      contentPreview: content2.slice(0, 400),
      trigger: 'scheduled',
      status: 'success',
      routerOsVersion: '7.16.1',
      model: coreDevice.model,
      metadata: parseRscStats(content2),
      notes: 'Backup sebelumnya sebelum perubahan IP Link',
      createdAt: new Date(Date.now() - 3600 * 28 * 1000).toISOString()
    };

    db.backups.push(backup1, backup2);
  }

  // Seed sample backup for dev_ccr_datacenter
  const ccrDevice = db.devices.find(d => d.id === 'dev_ccr_datacenter');
  if (ccrDevice) {
    const devDir = path.resolve(BACKUPS_DIR, ccrDevice.id);
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }

    const content = generateSampleRscContent(ccrDevice.name, ccrDevice.model, '7.15.3', 0);
    const filename = `${ccrDevice.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_2026-09-29_01-45.rsc`;
    const filePath = path.resolve(devDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');

    const backup: BackupRecord = {
      id: crypto.randomUUID(),
      deviceId: ccrDevice.id,
      deviceName: ccrDevice.name,
      deviceIp: ccrDevice.ipHost,
      filename: filename,
      fileType: 'rsc',
      fileSize: Buffer.byteLength(content, 'utf-8'),
      filePath: filePath,
      contentPreview: content.slice(0, 400),
      trigger: 'rest_api',
      status: 'success',
      routerOsVersion: '7.15.3',
      model: ccrDevice.model,
      metadata: parseRscStats(content),
      notes: 'Tarik otomatis melalui REST API /rest/system/backup/export',
      createdAt: new Date(Date.now() - 3600 * 1 * 1000).toISOString()
    };

    db.backups.push(backup);
  }

  // Seed sample backup for dev_branch_office
  const branchDevice = db.devices.find(d => d.id === 'dev_branch_office');
  if (branchDevice) {
    const devDir = path.resolve(BACKUPS_DIR, branchDevice.id);
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }

    const content = generateSampleRscContent(branchDevice.name, branchDevice.model, '7.16.0', 0);
    const filename = `${branchDevice.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_2026-09-28_03-30.rsc`;
    const filePath = path.resolve(devDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');

    const backup: BackupRecord = {
      id: crypto.randomUUID(),
      deviceId: branchDevice.id,
      deviceName: branchDevice.name,
      deviceIp: branchDevice.ipHost,
      filename: filename,
      fileType: 'rsc',
      fileSize: Buffer.byteLength(content, 'utf-8'),
      filePath: filePath,
      contentPreview: content.slice(0, 400),
      trigger: 'webhook_push',
      status: 'success',
      routerOsVersion: '7.16.0',
      model: branchDevice.model,
      metadata: parseRscStats(content),
      notes: 'Push backup dari kantor cabang',
      createdAt: new Date(Date.now() - 3600 * 20 * 1000).toISOString()
    };

    db.backups.push(backup);
  }

  saveDatabase(db);
}

// Multer storage for uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

export async function createServer() {
  const app = express();
  const db = loadDatabase();

  // Anti-Fingerprinting: hilangkan banner Express & ETag agar tidak mudah terdeteksi Shodan/Censys
  app.disable('x-powered-by');
  app.disable('etag');
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  let blockedScannerCount = 0;
  let blockedIpCount = 0;
  const recentBlockedEvents: Array<{ timestamp: string; ip: string; reason: string; path: string }> = [];
  const recordBlocked = (ip: string, reason: string, reqPath: string, kind: 'scanner' | 'ip') => {
    if (kind === 'scanner') blockedScannerCount += 1;
    else blockedIpCount += 1;
    recentBlockedEvents.unshift({
      timestamp: new Date().toISOString(),
      ip,
      reason,
      path: reqPath.slice(0, 80)
    });
    if (recentBlockedEvents.length > 50) recentBlockedEvents.length = 50;
  };

  // Loopback-only stealth healthcheck for Docker (never leaks app info to external scanners)
  app.get('/healthz', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!isLoopbackIp(ip)) {
      req.socket.destroy();
      return;
    }
    res.status(200).end();
  });

  // Block search engine & crawler indexing
  app.get('/robots.txt', (_req: Request, res: Response) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  // Per-IP sliding window rate limiter for /api/*
  const apiRateMap = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of apiRateMap.entries()) {
      if (v.resetAt <= now) apiRateMap.delete(k);
    }
  }, 60000);

  // Anti-Shodan, Scanner Blocker, IP Allowlist & Security Headers Middleware
  app.use((req, res, next) => {
    const sec = db.security || DEFAULT_SECURITY_SETTINGS;
    const clientIp = getClientIp(req);

    // 1. Always set anti-indexing and minimal security headers (no X-Powered-By / Server fingerprint)
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProd) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }

    // 2. Block known public internet scanners (Shodan, Censys, ZoomEye, Masscan, Nmap, probe paths)
    const blockScannersActive = process.env.BLOCK_SCANNERS === 'false' ? false : sec.blockScanners;
    if (blockScannersActive && !isLoopbackIp(clientIp)) {
      const detected = detectScannerProbe(req);
      if (detected) {
        recordBlocked(clientIp, detected, req.path, 'scanner');
        if (sec.silentDropUnauthorized) {
          req.socket.destroy();
        } else {
          res.status(404).end();
        }
        return;
      }
    }

    // 3. IP Allowlist enforcement (env ALLOWED_IPS or UI toggle)
    const envAllowedList = (process.env.ALLOWED_IPS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const allowlistActive = envAllowedList.length > 0 || sec.ipAllowlistEnabled;

    if (allowlistActive && !isLoopbackIp(clientIp)) {
      const effectiveList = envAllowedList.length > 0 ? envAllowedList : (sec.allowedIps || []);
      let allowed = effectiveList.some(entry => ipMatchesEntry(clientIp, entry));

      // Optionally allow registered MikroTik router IPs to push backups via webhook
      if (!allowed && sec.allowRegisteredDeviceIps && req.path.startsWith('/api/backups/upload')) {
        allowed = db.devices.some(d => normalizeIp(d.ipHost) === clientIp);
      }

      if (!allowed) {
        recordBlocked(clientIp, 'IP tidak ada di Allowlist', req.path, 'ip');
        if (sec.silentDropUnauthorized) {
          req.socket.destroy();
        } else {
          res.status(403).end();
        }
        return;
      }
    }

    // 4. Rate limiting for /api/* requests (protects against probing & brute-force)
    if (req.path.startsWith('/api/') && !isLoopbackIp(clientIp)) {
      const limit = Math.max(20, Math.min(1000, sec.rateLimitPerMinute || 120));
      const now = Date.now();
      const bucket = apiRateMap.get(clientIp);
      if (!bucket || bucket.resetAt <= now) {
        apiRateMap.set(clientIp, { count: 1, resetAt: now + 60000 });
      } else {
        bucket.count += 1;
        if (bucket.count > limit) {
          res.status(429).json({ error: 'Terlalu banyak permintaan dari IP ini. Coba lagi dalam 1 menit.' });
          return;
        }
      }
    }

    next();
  });

  // Middleware for body parsing
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(express.text({ limit: '50mb', type: ['text/plain', 'text/*', 'application/x-www-form-urlencoded'] }));
  app.use(express.raw({ limit: '50mb', type: ['application/octet-stream', 'application/x-routeros'] }));

  // Helper to get base URL
  const getAppBaseUrl = (req: Request) => {
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/$/, '');
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
    return `${protocol}://${host}`;
  };

  // --- SESSION & BRUTE-FORCE SECURITY MANAGEMENT ---
  interface AdminSession {
    token: string;
    userId: string;
    username: string;
    createdAt: number;
    lastActiveAt: number;
  }

  // 30 minutes idle inactivity auto-logout
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const activeSessions = new Map<string, AdminSession>();

  // Periodically purge expired idle sessions every 60 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [tok, sess] of activeSessions.entries()) {
      if (now - sess.lastActiveAt > SESSION_TIMEOUT_MS) {
        activeSessions.delete(tok);
      }
    }
  }, 60000);

  // Brute-force protection: IP or username tracking
  interface FailedAttempt {
    count: number;
    lockedUntil?: number;
  }
  const failedAttempts = new Map<string, FailedAttempt>();

  const recordFailedAttempt = (key: string): number => {
    const attempt = failedAttempts.get(key) || { count: 0 };
    attempt.count += 1;
    if (attempt.count >= 5) {
      attempt.lockedUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes after 5 failed attempts
    }
    failedAttempts.set(key, attempt);
    return attempt.count;
  };

  // Auth Middleware for protected admin API routes
  const requireAuth = (req: Request, res: Response, next: () => void) => {
    // Check Authorization header or query param (for file download)
    let token = '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.query.authToken && typeof req.query.authToken === 'string') {
      token = req.query.authToken.trim();
    }

    if (!token) {
      res.status(401).json({ error: 'Akses ditolak: Token autentikasi tidak ditemukan. Silakan login terlebih dahulu.' });
      return;
    }

    const session = activeSessions.get(token);
    if (!session) {
      res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
      return;
    }

    const now = Date.now();
    if (now - session.lastActiveAt > SESSION_TIMEOUT_MS) {
      activeSessions.delete(token);
      res.status(401).json({ error: 'Sesi telah kedaluwarsa karena tidak ada aktivitas selama 30 menit. Silakan login kembali.' });
      return;
    }

    // Sliding idle window: extend last active time on every request
    session.lastActiveAt = now;
    (req as any).user = session;
    next();
  };

  // Helper for safe constant-time hash comparison
  const safeCompareHashes = (a: string, b: string): boolean => {
    try {
      const bufA = Buffer.from(a, 'hex');
      const bufB = Buffer.from(b, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  };

  // --- AUTHENTICATION ROUTES ---

  // 0a. Login Route (likhin / 11013009)
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
    const lockKey = `${clientIp}_${String(username || '').toLowerCase()}`;

    const attempt = failedAttempts.get(lockKey);
    const now = Date.now();
    if (attempt && attempt.lockedUntil && attempt.lockedUntil > now) {
      const remainingSec = Math.ceil((attempt.lockedUntil - now) / 1000);
      res.status(429).json({
        error: `Terlalu banyak percobaan login gagal. Demi keamanan, akun terkunci sementara. Coba lagi dalam ${remainingSec} detik.`
      });
      return;
    }

    if (!username || !password) {
      res.status(400).json({ error: 'Username dan password wajib diisi.' });
      return;
    }

    const admin = db.admin;
    const reqUser = String(username).trim().toLowerCase();
    const adminUser = (admin?.username || 'admin').toLowerCase();
    const isUserMatch = admin && (adminUser === reqUser || reqUser === 'admin' || reqUser === 'likhin');

    if (!isUserMatch) {
      // Small delay to mitigate fast brute-force enumeration
      await new Promise(r => setTimeout(r, 400));
      recordFailedAttempt(lockKey);
      res.status(401).json({ error: 'Username atau password salah.' });
      return;
    }

    const computedHash = hashPassword(String(password), admin.passwordSalt);
    const isPasswordCorrect = safeCompareHashes(computedHash, admin.passwordHash);

    if (!isPasswordCorrect) {
      // Small delay to mitigate fast brute-force enumeration
      await new Promise(r => setTimeout(r, 400));
      const count = recordFailedAttempt(lockKey);
      const remaining = Math.max(0, 5 - count);
      res.status(401).json({
        error: `Username atau password salah.${remaining > 0 ? ` Sisa percobaan: ${remaining} kali.` : ' Akun terkunci selama 15 menit.'}`
      });
      return;
    }

    // Reset failed counter upon successful login
    failedAttempts.delete(lockKey);

    // Generate 256-bit cryptographically secure session token
    const token = crypto.randomBytes(32).toString('hex');
    const session: AdminSession = {
      token,
      userId: admin.id,
      username: admin.username,
      createdAt: now,
      lastActiveAt: now
    };
    activeSessions.set(token, session);

    admin.lastLoginAt = new Date().toISOString();
    saveDatabase(db);

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'backup_success',
      message: `Admin '${admin.username}' berhasil login (IP: ${clientIp})`
    });

    res.json({
      success: true,
      token,
      user: {
        username: admin.username,
        lastLoginAt: admin.lastLoginAt
      }
    });
  });

  // 0b. Current Session Check
  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    const session = (req as any).user as AdminSession;
    res.json({
      authenticated: true,
      user: {
        username: session.username,
        lastActiveAt: new Date(session.lastActiveAt).toISOString()
      }
    });
  });

  // 0c. Logout Route
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      activeSessions.delete(token);
    }
    res.json({ success: true, message: 'Berhasil logout' });
  });

  // 0d. Change Password Route
  app.post('/api/auth/change-password', requireAuth, (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: 'Password lama dan password baru wajib diisi.' });
      return;
    }

    if (String(newPassword).length < 8) {
      res.status(400).json({ error: 'Password baru minimal harus 8 karakter.' });
      return;
    }

    const admin = db.admin;
    const currentHash = hashPassword(String(oldPassword), admin.passwordSalt);
    const isOldCorrect = safeCompareHashes(currentHash, admin.passwordHash);

    if (!isOldCorrect) {
      res.status(400).json({ error: 'Password lama yang Anda masukkan salah.' });
      return;
    }

    if (oldPassword === newPassword) {
      res.status(400).json({ error: 'Password baru tidak boleh sama dengan password lama.' });
      return;
    }

    // Generate new salt and scrypt hash
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(String(newPassword), newSalt);

    admin.passwordSalt = newSalt;
    admin.passwordHash = newHash;
    admin.updatedAt = new Date().toISOString();
    saveDatabase(db);

    // Invalidate other active sessions to ensure previous tokens are revoked
    const currentToken = req.headers['authorization']?.slice(7).trim();
    for (const [tok] of activeSessions.entries()) {
      if (tok !== currentToken) {
        activeSessions.delete(tok);
      }
    }

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'device_updated',
      message: `Password akun admin '${admin.username}' berhasil diubah`
    });

    res.json({ success: true, message: 'Password berhasil diubah dengan aman!' });
  });

  // --- API ROUTES ---

  // 1. System Stats & Overview
  app.get('/api/stats', requireAuth, (req: Request, res: Response) => {
    const totalDevices = db.devices.length;
    const activeDevices = db.devices.filter(d => d.enabled).length;
    const totalBackups = db.backups.length;
    let totalSizeBytes = 0;
    db.backups.forEach(b => {
      totalSizeBytes += b.fileSize;
    });

    const recentBackups = [...db.backups]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const latestBackupTime = recentBackups.length > 0 ? recentBackups[0].createdAt : null;

    res.json({
      totalDevices,
      activeDevices,
      totalBackups,
      totalSizeBytes,
      latestBackupTime,
      recentBackups
    });
  });

  // 2. Devices CRUD
  app.get('/api/devices', requireAuth, (req: Request, res: Response) => {
    // Recalculate backup counts and sizes for consistency
    db.devices.forEach(device => {
      const devBackups = db.backups.filter(b => b.deviceId === device.id);
      device.backupCount = devBackups.length;
      device.totalStorageBytes = devBackups.reduce((acc, b) => acc + b.fileSize, 0);
    });
    res.json(db.devices);
  });

  app.get('/api/devices/:id', requireAuth, (req: Request, res: Response) => {
    const device = db.devices.find(d => d.id === req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    const devBackups = db.backups.filter(b => b.deviceId === device.id);
    res.json({
      ...device,
      backups: devBackups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    });
  });

  app.post('/api/devices', requireAuth, (req: Request, res: Response) => {
    const {
      name,
      model,
      ipHost,
      port,
      protocol = 'push_webhook',
      osVersion = 'v7',
      username = '',
      password = '',
      useTls = true,
      scheduleFrequency = 'daily',
      scheduleTime = '02:00',
      retentionCount = 15,
      enabled = true
    } = req.body;

    if (!name || !ipHost) {
      res.status(400).json({ error: 'Nama router dan IP/Host wajib diisi' });
      return;
    }

    const resolvedPort = Number(port) || (osVersion === 'v6' ? 8728 : 443);

    const newDevice: RouterDevice = {
      id: 'dev_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex'),
      name: name.trim(),
      model: model ? model.trim() : 'MikroTik RouterOS',
      ipHost: ipHost.trim(),
      port: resolvedPort,
      protocol: protocol || (osVersion === 'v6' ? 'api_binary' : 'rest_api'),
      osVersion: osVersion === 'v6' ? 'v6' : 'v7',
      username: username ? username.trim() : undefined,
      password: password ? password : undefined,
      useTls: Boolean(useTls),
      webhookToken: crypto.randomBytes(16).toString('hex'),
      scheduleFrequency,
      scheduleTime,
      retentionCount: Math.max(1, Number(retentionCount) || 15),
      enabled: Boolean(enabled),
      lastBackupStatus: 'never',
      backupCount: 0,
      totalStorageBytes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.devices.push(newDevice);
    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'device_added',
      deviceId: newDevice.id,
      deviceName: newDevice.name,
      message: `Router baru ditambahkan: ${newDevice.name} (${newDevice.ipHost}:${resolvedPort}) [${newDevice.osVersion?.toUpperCase()}]`
    });

    saveDatabase(db);
    res.status(201).json(newDevice);
  });

  app.put('/api/devices/:id', requireAuth, (req: Request, res: Response) => {
    const deviceIndex = db.devices.findIndex(d => d.id === req.params.id);
    if (deviceIndex === -1) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const current = db.devices[deviceIndex];
    const updateData = req.body;

    const updated: RouterDevice = {
      ...current,
      name: updateData.name !== undefined ? updateData.name.trim() : current.name,
      model: updateData.model !== undefined ? updateData.model.trim() : current.model,
      ipHost: updateData.ipHost !== undefined ? updateData.ipHost.trim() : current.ipHost,
      port: updateData.port !== undefined ? Number(updateData.port) : current.port,
      protocol: updateData.protocol !== undefined ? updateData.protocol : current.protocol,
      osVersion: updateData.osVersion !== undefined ? updateData.osVersion : current.osVersion,
      username: updateData.username !== undefined ? updateData.username.trim() : current.username,
      password: updateData.password !== undefined && updateData.password !== '' ? updateData.password : current.password,
      useTls: updateData.useTls !== undefined ? Boolean(updateData.useTls) : current.useTls,
      scheduleFrequency: updateData.scheduleFrequency !== undefined ? updateData.scheduleFrequency : current.scheduleFrequency,
      scheduleTime: updateData.scheduleTime !== undefined ? updateData.scheduleTime : current.scheduleTime,
      retentionCount: updateData.retentionCount !== undefined ? Math.max(1, Number(updateData.retentionCount)) : current.retentionCount,
      enabled: updateData.enabled !== undefined ? Boolean(updateData.enabled) : current.enabled,
      updatedAt: new Date().toISOString()
    };

    db.devices[deviceIndex] = updated;

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'device_updated',
      deviceId: updated.id,
      deviceName: updated.name,
      message: `Konfigurasi router diperbarui: ${updated.name}`
    });

    saveDatabase(db);
    res.json(updated);
  });

  app.post('/api/devices/:id/token', requireAuth, (req: Request, res: Response) => {
    const device = db.devices.find(d => d.id === req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    device.webhookToken = crypto.randomBytes(16).toString('hex');
    device.updatedAt = new Date().toISOString();
    saveDatabase(db);
    res.json({ webhookToken: device.webhookToken });
  });

  app.delete('/api/devices/:id', requireAuth, (req: Request, res: Response) => {
    const deviceIndex = db.devices.findIndex(d => d.id === req.params.id);
    if (deviceIndex === -1) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const device = db.devices[deviceIndex];

    // Remove backups files
    const devDir = path.resolve(BACKUPS_DIR, device.id);
    if (fs.existsSync(devDir)) {
      try {
        fs.rmSync(devDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to clean up backup dir:', err);
      }
    }

    // Remove backups from db
    db.backups = db.backups.filter(b => b.deviceId !== device.id);
    db.devices.splice(deviceIndex, 1);

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'device_deleted',
      deviceId: device.id,
      deviceName: device.name,
      message: `Router dihapus: ${device.name}`
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Device deleted' });
  });

  // 3. RouterOS Script Generator for MikroTik terminal
  app.get('/api/devices/:id/script', requireAuth, (req: Request, res: Response) => {
    const device = db.devices.find(d => d.id === req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const baseUrl = getAppBaseUrl(req);
    const webhookUrl = `${baseUrl}/api/backups/upload?deviceId=${device.id}&token=${device.webhookToken}`;

    // Determine interval for MikroTik scheduler
    let intervalStr = '1d';
    let startTimeStr = device.scheduleTime ? `${device.scheduleTime}:00` : '02:00:00';

    if (device.scheduleFrequency === 'hourly') {
      intervalStr = '1h';
      startTimeStr = '00:05:00';
    } else if (device.scheduleFrequency === '6hours') {
      intervalStr = '6h';
      startTimeStr = '00:05:00';
    } else if (device.scheduleFrequency === 'weekly') {
      intervalStr = '7d';
    }

    // Clean safe script name
    const scriptName = 'autobackup-push';
    const schedulerName = 'sched-autobackup';

    // RouterOS v7 Terminal Command for Text Export (.rsc)
    const scriptContentRsc = `# =========================================================
# MikroTik RouterOS v7 Auto Backup Script (.rsc Text Export)
# Target Device: ${device.name} (${device.ipHost})
# Frekuensi: ${device.scheduleFrequency} (Interval: ${intervalStr})
# Mengunggah seluruh konfigurasi (termasuk VLAN & DHCP) tanpa limit 4KB
# =========================================================

# 1. Hapus script & scheduler lama jika ada
/system scheduler remove [find name="${schedulerName}"]
/system script remove [find name="${scriptName}"]

# 2. Buat Script Backup Ekspor Konfigurasi & Kirim ke App (RouterOS v7)
/system script add name="${scriptName}" policy=read,write,policy,test source="\\
    :local devName [/system identity get name];\\
    :local baseName (\\\$devName . \\\"_backup\\\");\\
    :local fileName (\\\$baseName . \\\".rsc\\\");\\
    :log info (\\\"[AutoBackup v7] Memulai ekspor konfigurasi lengkap (.rsc): \\\" . \\\$fileName);\\
    /export show-sensitive file=\\\$baseName;\\
    :delay 5s;\\
    :log info (\\\"[AutoBackup v7] Mengunggah file ke Backup Manager...\\\");\\
    :local postUrl (\\\"${webhookUrl}&type=rsc&filename=\\\" . \\\$fileName);\\
    /tool fetch url=\\\$postUrl upload=yes src-path=\\\$fileName http-method=post;\\
    :delay 2s;\\
    :log info (\\\"[AutoBackup v7] Konfigurasi berhasil terkirim ke server!\\\");\\
    /file remove [find name=\\\$fileName];\\
"

# 3. Jadwalkan Eksekusi Otomatis
/system scheduler add name="${schedulerName}" interval=${intervalStr} start-time=${startTimeStr} on-event="${scriptName}"

# 4. Jalankan Tes Pertama Kali Sekarang
/system script run "${scriptName}"
`;

    // RouterOS v7 Terminal Command for Binary System Backup (.backup)
    const scriptContentBinary = `# =========================================================
# MikroTik RouterOS v7 Binary System Backup (.backup)
# Target Device: ${device.name} (${device.ipHost})
# =========================================================

/system scheduler remove [find name="${schedulerName}-bin"]
/system script remove [find name="${scriptName}-bin"]

/system script add name="${scriptName}-bin" policy=read,write,policy,test source="\\
    :local devName [/system identity get name];\\
    :local baseName (\\\$devName . \\\"_system\\\");\\
    :local fileName (\\\$baseName . \\\".backup\\\");\\
    :log info (\\\"[AutoBackup v7] Menyimpan binary backup sistem...\\\");\\
    /system backup save name=\\\$baseName;\\
    :delay 5s;\\
    :log info (\\\"[AutoBackup v7] Mengunggah file .backup ke Backup Manager...\\\");\\
    :local postUrl (\\\"${webhookUrl}&type=backup&filename=\\\" . \\\$fileName);\\
    /tool fetch url=\\\$postUrl upload=yes src-path=\\\$fileName http-method=post;\\
    :delay 2s;\\
    :log info (\\\"[AutoBackup v7] Binary backup berhasil terkirim ke server!\\\");\\
    /file remove [find name=\\\$fileName];\\
"

/system scheduler add name="${schedulerName}-bin" interval=${intervalStr} start-time=${startTimeStr} on-event="${scriptName}-bin"
/system script run "${scriptName}-bin"
`;

    // RouterOS v6 Terminal Command for Text Export (.rsc) - Legacy RouterOS 6.x
    const scriptContentRscV6 = `# =========================================================
# MikroTik RouterOS v6 Auto Backup Script (.rsc Text Export)
# Target Device: ${device.name} (${device.ipHost})
# Kompatibel untuk CCR, RB, dan RouterOS 6.40 s/d 6.49+
# Mengunggah seluruh konfigurasi (termasuk VLAN & DHCP) tanpa limit 4KB
# =========================================================

# 1. Hapus script & scheduler lama jika ada
/system scheduler remove [find name="${schedulerName}"]
/system script remove [find name="${scriptName}"]

# 2. Buat Script Ekspor Konfigurasi & Kirim ke App (RouterOS v6)
/system script add name="${scriptName}" policy=read,write,policy,test source="\\
    :local devName [/system identity get name];\\
    :local baseName (\\\$devName . \\\"_backup\\\");\\
    :local fileName (\\\$baseName . \\\".rsc\\\");\\
    :log info (\\\"[AutoBackup v6] Memulai ekspor konfigurasi RouterOS v6: \\\" . \\\$fileName);\\
    /export compact file=\\\$baseName;\\
    :delay 5s;\\
    :log info (\\\"[AutoBackup v6] Mengunggah konfigurasi langsung ke Backup Manager...\\\");\\
    :local postUrl (\\\"${webhookUrl}&type=rsc&filename=\\\" . \\\$fileName);\\
    /tool fetch url=\\\$postUrl upload=yes src-path=\\\$fileName mode=http;\\
    :delay 2s;\\
    :log info (\\\"[AutoBackup v6] Konfigurasi v6 berhasil terkirim ke server!\\\");\\
    /file remove [find name=\\\$fileName];\\
"

# 3. Jadwalkan Eksekusi Otomatis
/system scheduler add name="${schedulerName}" interval=${intervalStr} start-time=${startTimeStr} on-event="${scriptName}"

# 4. Jalankan Tes Pertama Kali Sekarang
/system script run "${scriptName}"
`;

    // RouterOS v6 Terminal Command for Binary System Backup (.backup)
    const scriptContentBinaryV6 = `# =========================================================
# MikroTik RouterOS v6 Binary System Backup (.backup)
# Target Device: ${device.name} (${device.ipHost})
# =========================================================

/system scheduler remove [find name="${schedulerName}-bin"]
/system script remove [find name="${scriptName}-bin"]

/system script add name="${scriptName}-bin" policy=read,write,policy,test source="\\
    :local devName [/system identity get name];\\
    :local baseName (\\\$devName . \\\"_system\\\");\\
    :local fileName (\\\$baseName . \\\".backup\\\");\\
    :log info (\\\"[AutoBackup v6] Menyimpan binary backup sistem v6...\\\");\\
    /system backup save name=\\\$baseName;\\
    :delay 5s;\\
    :log info (\\\"[AutoBackup v6] Mengunggah file .backup ke Backup Manager...\\\");\\
    :local postUrl (\\\"${webhookUrl}&type=backup&filename=\\\" . \\\$fileName);\\
    /tool fetch url=\\\$postUrl upload=yes src-path=\\\$fileName mode=http;\\
    :delay 2s;\\
    :log info (\\\"[AutoBackup v6] Binary backup v6 berhasil terkirim ke server!\\\");\\
    /file remove [find name=\\\$fileName];\\
"

/system scheduler add name="${schedulerName}-bin" interval=${intervalStr} start-time=${startTimeStr} on-event="${scriptName}-bin"
/system script run "${scriptName}-bin"
`;

    res.json({
      deviceId: device.id,
      deviceName: device.name,
      webhookUrl,
      scriptName,
      schedulerName,
      interval: intervalStr,
      startTime: startTimeStr,
      scriptContentRsc,
      scriptContentBinary,
      scriptContentRscV6,
      scriptContentBinaryV6
    });
  });

  // 4. Backups List & Filtering
  app.get('/api/backups', requireAuth, (req: Request, res: Response) => {
    const { deviceId, search, type } = req.query;
    let results = [...db.backups];

    if (deviceId && typeof deviceId === 'string') {
      results = results.filter(b => b.deviceId === deviceId);
    }

    if (type && (type === 'rsc' || type === 'backup')) {
      results = results.filter(b => b.fileType === type);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      results = results.filter(b =>
        b.filename.toLowerCase().includes(q) ||
        b.deviceName.toLowerCase().includes(q) ||
        b.deviceIp.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    }

    // Sort descending by creation date
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(results);
  });

  // 5. Get Backup Detail & Raw Text Content
  app.get('/api/backups/:id', requireAuth, (req: Request, res: Response) => {
    const backup = db.backups.find(b => b.id === req.params.id);
    if (!backup) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }

    let fullContent: string | null = null;
    if (fs.existsSync(backup.filePath)) {
      if (backup.fileType === 'rsc') {
        try {
          const raw = fs.readFileSync(backup.filePath, 'utf-8');
          fullContent = filterStaticOnlyRsc(raw);
          if (fullContent !== raw) {
            fs.writeFileSync(backup.filePath, fullContent, 'utf-8');
            backup.fileSize = Buffer.byteLength(fullContent, 'utf-8');
            backup.metadata = parseRscStats(fullContent);
            saveDatabase(db);
          }
        } catch (err) {
          console.error('Failed reading rsc file:', err);
        }
      }
    }

    res.json({
      ...backup,
      content: fullContent
    });
  });

  // 6. Download Backup File
  app.get('/api/backups/:id/download', requireAuth, (req: Request, res: Response) => {
    const backup = db.backups.find(b => b.id === req.params.id);
    if (!backup) {
      res.status(404).json({ error: 'Backup record not found' });
      return;
    }

    if (!fs.existsSync(backup.filePath)) {
      res.status(404).json({ error: 'File fisik backup tidak ditemukan di penyimpanan server' });
      return;
    }

    const contentType = backup.fileType === 'rsc' ? 'text/plain; charset=utf-8' : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);

    const fileStream = fs.createReadStream(backup.filePath);
    fileStream.pipe(res);
  });

  // 7. Compare / Diff two backups of the same device
  app.get('/api/backups/:id/diff/:compareId', requireAuth, (req: Request, res: Response) => {
    const backup1 = db.backups.find(b => b.id === req.params.id);
    const backup2 = db.backups.find(b => b.id === req.params.compareId);

    if (!backup1 || !backup2) {
      res.status(404).json({ error: 'One or both backup records not found' });
      return;
    }

    if (backup1.fileType !== 'rsc' || backup2.fileType !== 'rsc') {
      res.status(400).json({ error: 'Perbandingan visual (diff) hanya tersedia untuk file konfigurasi teks .rsc' });
      return;
    }

    if (!fs.existsSync(backup1.filePath) || !fs.existsSync(backup2.filePath)) {
      res.status(404).json({ error: 'File konfigurasi tidak ditemukan pada server' });
      return;
    }

    const text1 = fs.readFileSync(backup1.filePath, 'utf-8');
    const text2 = fs.readFileSync(backup2.filePath, 'utf-8');

    // Generate line-by-line diff
    const lines1 = text1.split(/\r?\n/);
    const lines2 = text2.split(/\r?\n/);

    interface DiffLine {
      type: 'same' | 'added' | 'removed' | 'modified';
      oldLine?: number;
      newLine?: number;
      text: string;
    }

    const diffLines: DiffLine[] = [];
    const maxLen = Math.max(lines1.length, lines2.length);

    // Simple line diff algorithm
    let i = 0;
    let j = 0;
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    while (i < lines1.length || j < lines2.length) {
      if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
        diffLines.push({
          type: 'same',
          oldLine: i + 1,
          newLine: j + 1,
          text: lines1[i]
        });
        unchanged++;
        i++;
        j++;
      } else {
        // Look ahead to check if deleted or added
        let matchJ = -1;
        let matchI = -1;

        for (let look = 1; look <= 5; look++) {
          if (j + look < lines2.length && lines1[i] === lines2[j + look]) {
            matchJ = j + look;
            break;
          }
          if (i + look < lines1.length && lines1[i + look] === lines2[j]) {
            matchI = i + look;
            break;
          }
        }

        if (matchJ !== -1) {
          // Lines in lines2 were added
          while (j < matchJ) {
            diffLines.push({
              type: 'added',
              newLine: j + 1,
              text: lines2[j]
            });
            additions++;
            j++;
          }
        } else if (matchI !== -1) {
          // Lines in lines1 were removed
          while (i < matchI) {
            diffLines.push({
              type: 'removed',
              oldLine: i + 1,
              text: lines1[i]
            });
            deletions++;
            i++;
          }
        } else {
          // Line changed
          if (i < lines1.length) {
            diffLines.push({
              type: 'removed',
              oldLine: i + 1,
              text: lines1[i]
            });
            deletions++;
            i++;
          }
          if (j < lines2.length) {
            diffLines.push({
              type: 'added',
              newLine: j + 1,
              text: lines2[j]
            });
            additions++;
            j++;
          }
        }
      }
    }

    res.json({
      backup1: {
        id: backup1.id,
        filename: backup1.filename,
        createdAt: backup1.createdAt
      },
      backup2: {
        id: backup2.id,
        filename: backup2.filename,
        createdAt: backup2.createdAt
      },
      stats: {
        additions,
        deletions,
        unchanged,
        totalLines: diffLines.length
      },
      diffLines
    });
  });

  // Helper for applying retention count
  const applyRetention = (device: RouterDevice) => {
    const devBackups = db.backups
      .filter(b => b.deviceId === device.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (devBackups.length > device.retentionCount) {
      const toRemove = devBackups.slice(device.retentionCount);
      toRemove.forEach(b => {
        if (fs.existsSync(b.filePath)) {
          try {
            fs.unlinkSync(b.filePath);
          } catch (e) {
            console.error('Failed to unlink expired backup:', e);
          }
        }
        db.backups = db.backups.filter(x => x.id !== b.id);
      });

      db.logs.unshift({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'cleaned_retention',
        deviceId: device.id,
        deviceName: device.name,
        message: `Membersihkan ${toRemove.length} backup lama sesuai kuota retensi (${device.retentionCount} file)`
      });
    }
  };

// Helper to filter out all dynamic runtime entries (VPN client bindings, dynamic routes, dynamic DHCP leases, etc.)
function filterStaticOnlyRsc(content: string): string {
  const lines = content.split('\n');
  const filteredLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Keep comments and section headers (like /ip address, /ip route, etc.)
    if (trimmed.startsWith('#') || (trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed === '') {
      filteredLines.push(line);
      continue;
    }

    // Filter out dynamic interface bindings: <l2tp-xxx>, <pptp-xxx>, <sstp-xxx>, <ovpn-xxx>, etc.
    if (
      line.includes('interface=<') ||
      line.includes('gateway=<') ||
      line.includes('<l2tp-') ||
      line.includes('<pptp-') ||
      line.includes('<sstp-') ||
      line.includes('<ovpn-') ||
      line.includes('<macvlan')
    ) {
      continue;
    }

    // Filter out explicit dynamic=yes or dynamic="true"
    if (
      line.includes('dynamic=yes') ||
      line.includes('dynamic="true"') ||
      line.includes('dynamic=true') ||
      line.includes('connect=yes') ||
      line.includes('connect="true"')
    ) {
      continue;
    }

    filteredLines.push(line);
  }

  // Remove empty section headers (e.g. if all entries in /ip route were dynamic VPN routes)
  const cleaned: string[] = [];
  for (let i = 0; i < filteredLines.length; i++) {
    const current = filteredLines[i];
    const trimmedCurrent = current.trim();

    if (trimmedCurrent.startsWith('/')) {
      // Look ahead to check if this section has at least one valid command (add, set, etc.)
      let hasCommands = false;
      for (let j = i + 1; j < filteredLines.length; j++) {
        const nextTrimmed = filteredLines[j].trim();
        if (nextTrimmed.startsWith('/')) break; // Next section reached
        if (nextTrimmed.startsWith('add ') || nextTrimmed.startsWith('set ') || (nextTrimmed.length > 0 && !nextTrimmed.startsWith('#'))) {
          hasCommands = true;
          break;
        }
      }
      if (!hasCommands) {
        continue; // Skip section with no static commands
      }
    }
    cleaned.push(current);
  }

  return cleaned.join('\n');
}

// 8. Universal Backup Ingestion (Webhook / RouterOS /tool fetch / Direct File Upload)
  app.all(['/api/backups/upload', '/api/backups/upload/:deviceId', '/api/backups/upload/:deviceId/:token'], upload.single('file'), async (req: Request, res: Response) => {
    const paramDeviceId = req.params?.deviceId;
    const paramToken = req.params?.token;

    let deviceId = (req.query.deviceId || req.body?.deviceId || req.headers['x-device-id'] || paramDeviceId) as string;
    let token = (req.query.token || req.body?.token || req.headers['x-webhook-token'] || paramToken) as string;
    const requestedType = (req.query.type || req.body?.type || 'rsc') as 'rsc' | 'backup';
    const clientFilename = (req.query.filename || req.body?.filename || req.file?.originalname) as string | undefined;

    // Auto-detect device if deviceId was omitted or malformed in RouterOS URL
    if (!deviceId) {
      const clientIp = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '').replace(/^.*:/, '');
      const matchDevice = db.devices.find(d => d.ipHost === clientIp);
      if (matchDevice) {
        deviceId = matchDevice.id;
        token = matchDevice.webhookToken;
        console.log(`[Upload API] Auto-detected router from IP ${clientIp}: ${matchDevice.name} (${matchDevice.id})`);
      } else if (db.devices.length === 1) {
        // If there's only one router configured in system, use it
        deviceId = db.devices[0].id;
        token = db.devices[0].webhookToken;
        console.log(`[Upload API] Auto-detected single router in database: ${db.devices[0].name}`);
      }
    }

    if (!deviceId) {
      console.warn('[Upload API] 400 Bad Request: Parameter deviceId tidak ditemukan', req.query);
      res.status(400).json({ error: 'Parameter deviceId wajib disertakan pada URL (?deviceId=...)' });
      return;
    }

    const device = db.devices.find(d => d.id === deviceId);
    if (!device) {
      console.warn(`[Upload API] 404 Device Not Found: ${deviceId}`);
      res.status(404).json({ error: 'Router tidak terdaftar di sistem' });
      return;
    }

    // Verify token if device has token configured and token was provided
    if (device.webhookToken && token && device.webhookToken !== token) {
      console.warn(`[Upload API] 401 Unauthorized: Invalid token for ${device.name}`);
      res.status(401).json({ error: 'Token autentikasi webhook tidak valid' });
      return;
    }

    // Extract file content or raw body with high tolerance
    let fileBuffer: Buffer | null = null;
    let detectedType: 'rsc' | 'backup' = requestedType;

    if (req.file && req.file.buffer && req.file.buffer.length > 0) {
      fileBuffer = req.file.buffer;
      if (req.file.originalname?.endsWith('.backup')) {
        detectedType = 'backup';
      }
    } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      fileBuffer = req.body;
    } else if (typeof req.body === 'string' && req.body.trim().length > 0) {
      fileBuffer = Buffer.from(req.body, 'utf-8');
    } else if (req.body && typeof req.body === 'object') {
      if (req.body.content && typeof req.body.content === 'string') {
        fileBuffer = Buffer.from(req.body.content, 'utf-8');
      } else if (req.body.data && typeof req.body.data === 'string') {
        fileBuffer = Buffer.from(req.body.data, 'utf-8');
      } else {
        // If express urlencoded parser converted the text into an object with empty value
        const keys = Object.keys(req.body);
        if (keys.length > 0) {
          const reconstructed = keys.map(k => (req.body[k] !== '' ? `${k}=${req.body[k]}` : k)).join('\n');
          if (reconstructed.trim().length > 0) {
            fileBuffer = Buffer.from(reconstructed, 'utf-8');
          }
        }
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      console.warn(`[Upload API] 400 Bad Request: Empty body received for device ${device.name}`);
      db.logs.unshift({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'backup_failed',
        deviceId: device.id,
        deviceName: device.name,
        message: `Upload backup gagal: Data yang dikirim dari router ${device.name} kosong (0 byte). Periksa ekspor file di MikroTik.`
      });
      saveDatabase(db);

      res.status(400).json({
        error: 'Tidak ada data file konfigurasi yang diterima (0 byte). Pastikan file konfigurasi di MikroTik tidak kosong.',
        deviceId: device.id,
        deviceName: device.name
      });
      return;
    }

    // Ensure device directory exists
    const devDir = path.resolve(BACKUPS_DIR, device.id);
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }

    // Generate filename
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeDevName = device.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = detectedType === 'backup' ? '.backup' : '.rsc';
    const finalFilename = clientFilename && clientFilename.endsWith(ext)
      ? `${timestampStr}_${clientFilename}`
      : `${safeDevName}_${timestampStr}${ext}`;

    const filePath = path.resolve(devDir, finalFilename);
    fs.writeFileSync(filePath, fileBuffer);

    // Parse stats if text .rsc
    let rscStats: any = undefined;
    let preview: string | undefined = undefined;
    let parsedVersion: string | undefined = undefined;

    if (detectedType === 'rsc') {
      try {
        const textContent = fileBuffer.toString('utf-8');
        preview = textContent.slice(0, 400);
        rscStats = parseRscStats(textContent);

        const vMatch = textContent.match(/MikroTik RouterOS (\d+\.\d+(\.\d+)?)/);
        if (vMatch) parsedVersion = vMatch[1];
      } catch (err) {
        console.error('Error parsing rsc content:', err);
      }
    }

    const backupRecord: BackupRecord = {
      id: crypto.randomUUID(),
      deviceId: device.id,
      deviceName: device.name,
      deviceIp: device.ipHost,
      filename: finalFilename,
      fileType: detectedType,
      fileSize: fileBuffer.length,
      filePath: filePath,
      contentPreview: preview,
      trigger: req.body?.trigger || 'webhook_push',
      status: 'success',
      routerOsVersion: parsedVersion || '7.x',
      model: device.model,
      metadata: rscStats,
      notes: req.body?.notes || 'Backup otomatis diterima dari RouterOS',
      createdAt: now.toISOString()
    };

    db.backups.push(backupRecord);

    // Update device status
    device.lastBackupAt = now.toISOString();
    device.lastBackupStatus = 'success';
    device.lastBackupMessage = `Backup ${detectedType.toUpperCase()} berhasil disimpan (${(fileBuffer.length / 1024).toFixed(1)} KB)`;
    device.backupCount = db.backups.filter(b => b.deviceId === device.id).length;
    device.totalStorageBytes = db.backups.filter(b => b.deviceId === device.id).reduce((sum, b) => sum + b.fileSize, 0);

    // Apply retention rule
    applyRetention(device);

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      type: 'backup_success',
      deviceId: device.id,
      deviceName: device.name,
      message: `Backup otomatis berhasil disimpan: ${finalFilename} (${(fileBuffer.length / 1024).toFixed(1)} KB)`
    });

    saveDatabase(db);

    res.json({
      success: true,
      message: 'Backup konfigurasi berhasil disimpan otomatis ke aplikasi',
      backup: backupRecord
    });
  });

  // Helper to perform HTTP/HTTPS request to MikroTik RouterOS REST API with redirect support
  function mikrotikRequest(options: {
    hostname: string;
    port: number;
    path: string;
    method: string;
    username?: string;
    password?: string;
    useTls: boolean;
    body?: any;
    timeoutMs?: number;
    redirectCount?: number;
  }): Promise<{ status: number; headers: http.IncomingHttpHeaders; data: string; finalPort: number; finalTls: boolean }> {
    const redirectCount = options.redirectCount || 0;
    if (redirectCount > 4) {
      return Promise.reject(new Error('Terlalu banyak redirect (max 4)'));
    }

    return new Promise((resolve, reject) => {
      const isHttps = options.useTls;
      const client = isHttps ? https : http;
      const authHeader = options.username
        ? 'Basic ' + Buffer.from(`${options.username}:${options.password || ''}`).toString('base64')
        : undefined;

      const postData = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined;

      const headers: Record<string, string> = {
        'User-Agent': 'MikroTik-AutoBackup/1.0',
        'Accept': 'application/json, text/plain, */*'
      };
      if (authHeader) headers['Authorization'] = authHeader;
      if (postData) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(postData).toString();
      }

      const req = client.request(
        {
          hostname: options.hostname,
          port: options.port,
          path: options.path,
          method: options.method,
          headers,
          rejectUnauthorized: false, // Bypasses self-signed SSL certs commonly used on RouterOS
          timeout: options.timeoutMs || 10000
        },
        res => {
          // Handle HTTP redirect (e.g. port 80 redirecting to port 444 HTTPS)
          if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
            const loc = res.headers.location;
            try {
              const parsedUrl = new URL(loc, `${isHttps ? 'https' : 'http'}://${options.hostname}:${options.port}`);
              const nextTls = parsedUrl.protocol === 'https:';
              const nextPort = parsedUrl.port ? Number(parsedUrl.port) : (nextTls ? 443 : 80);

              console.log(`[REST API] Following redirect (${res.statusCode}) from ${options.hostname}:${options.port} to ${parsedUrl.hostname}:${nextPort}${parsedUrl.pathname}`);

              mikrotikRequest({
                ...options,
                hostname: parsedUrl.hostname,
                port: nextPort,
                path: parsedUrl.pathname + parsedUrl.search,
                useTls: nextTls,
                redirectCount: redirectCount + 1
              }).then(resolve).catch(reject);
              return;
            } catch (e) {}
          }

          let raw = '';
          res.setEncoding('utf-8');
          res.on('data', chunk => {
            raw += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 0, headers: res.headers, data: raw, finalPort: options.port, finalTls: isHttps });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout (${options.timeoutMs || 10000}ms) saat menghubungi ${options.hostname}:${options.port}`));
      });

      req.on('error', err => {
        reject(err);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  // --- RouterOS API Protocol Implementation (Port 8728 / 8729) for MikroTik v6 & v7 ---
  function encodeSentence(words: string[]): Buffer {
    const parts: Buffer[] = [];
    for (const w of words) {
      const b = Buffer.from(w, 'utf-8');
      const len = b.length;
      let lenBuf: Buffer;
      if (len < 0x80) {
        lenBuf = Buffer.from([len]);
      } else if (len < 0x4000) {
        lenBuf = Buffer.from([(len >> 8) | 0x80, len & 0xff]);
      } else if (len < 0x200000) {
        lenBuf = Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
      } else if (len < 0x10000000) {
        lenBuf = Buffer.from([(len >> 24) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
      } else {
        lenBuf = Buffer.from([0xf0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
      }
      parts.push(lenBuf, b);
    }
    parts.push(Buffer.from([0])); // End of sentence
    return Buffer.concat(parts);
  }

  function parseSentencesFromBuffer(buffer: Buffer): { sentences: string[][]; remaining: Buffer } {
    const sentences: string[][] = [];
    let offset = 0;

    while (offset < buffer.length) {
      let tempOffset = offset;
      const words: string[] = [];
      let sentenceComplete = false;

      while (tempOffset < buffer.length) {
        const firstByte = buffer[tempOffset];
        if (firstByte === 0) {
          tempOffset += 1;
          sentenceComplete = true;
          break;
        }

        let wordLen = 0;
        let headerLen = 0;
        if ((firstByte & 0x80) === 0x00) {
          wordLen = firstByte;
          headerLen = 1;
        } else if ((firstByte & 0xc0) === 0x80) {
          if (tempOffset + 1 >= buffer.length) break;
          wordLen = ((firstByte & 0x3f) << 8) | buffer[tempOffset + 1];
          headerLen = 2;
        } else if ((firstByte & 0xe0) === 0xc0) {
          if (tempOffset + 2 >= buffer.length) break;
          wordLen = ((firstByte & 0x1f) << 16) | (buffer[tempOffset + 1] << 8) | buffer[tempOffset + 2];
          headerLen = 3;
        } else if ((firstByte & 0xf0) === 0xe0) {
          if (tempOffset + 3 >= buffer.length) break;
          wordLen = ((firstByte & 0x0f) << 24) | (buffer[tempOffset + 1] << 16) | (buffer[tempOffset + 2] << 8) | buffer[tempOffset + 3];
          headerLen = 4;
        } else {
          if (tempOffset + 4 >= buffer.length) break;
          wordLen = (buffer[tempOffset + 1] << 24) | (buffer[tempOffset + 2] << 16) | (buffer[tempOffset + 3] << 8) | buffer[tempOffset + 4];
          headerLen = 5;
        }

        if (tempOffset + headerLen + wordLen > buffer.length) {
          break; // Incomplete word in buffer
        }

        const word = buffer.toString('utf-8', tempOffset + headerLen, tempOffset + headerLen + wordLen);
        words.push(word);
        tempOffset += headerLen + wordLen;
      }

      if (sentenceComplete) {
        sentences.push(words);
        offset = tempOffset;
      } else {
        break;
      }
    }

    return { sentences, remaining: Buffer.from(buffer.subarray(offset)) };
  }

  async function queryRouterOsApiSingle(options: {
    hostname: string;
    port: number;
    username?: string;
    password?: string;
    timeoutMs?: number;
    useTls?: boolean;
    quickCheckOnly?: boolean;
  }): Promise<{
    success: boolean;
    content: string;
    version: string;
    identity: string;
    model: string;
    isTlsUsed: boolean;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      const port = options.port || 8728;
      const timeout = options.timeoutMs || 10000;
      const isTls = Boolean(options.useTls);
      let socket: any;

      try {
        socket = isTls
          ? tls.connect({ host: options.hostname, port, rejectUnauthorized: false })
          : net.createConnection({ host: options.hostname, port });
      } catch (err: any) {
        reject(new Error(`Gagal membuka soket ke ${options.hostname}:${port}: ${err.message}`));
        return;
      }

      let rxBuf: any = Buffer.alloc(0);
      let state: 'CONNECT' | 'LOGIN_SENT' | 'CHALLENGE_SENT' | 'COMMANDS' | 'DONE' = 'CONNECT';
      let currentCmdIndex = 0;

      const commandsToRun = options.quickCheckOnly
        ? [
            { cmd: '/system/identity/print', tag: 'identity' },
            { cmd: '/system/resource/print', tag: 'resource' }
          ]
        : [
            { cmd: '/system/resource/print', tag: 'resource' },
            { cmd: '/system/identity/print', tag: 'identity' },
            { cmd: '/interface/bridge/print', tag: 'bridge' },
            { cmd: '/interface/vlan/print', tag: 'vlan' },
            { cmd: '/interface/bridge/port/print', tag: 'bridge_port' },
            { cmd: '/interface/bridge/vlan/print', tag: 'bridge_vlan' },
            { cmd: '/interface/list/print', tag: 'iface_list' },
            { cmd: '/interface/list/member/print', tag: 'iface_member' },
            { cmd: '/interface/print', tag: 'interface' },
            { cmd: '/ip/pool/print', tag: 'pool' },
            { cmd: '/ip/dhcp-server/print', tag: 'dhcp_server' },
            { cmd: '/ip/dhcp-server/network/print', tag: 'dhcp_network' },
            { cmd: '/ip/dhcp-server/lease/print', tag: 'dhcp_lease' },
            { cmd: '/ip/dhcp-client/print', tag: 'dhcp_client' },
            { cmd: '/ip/address/print', tag: 'address' },
            { cmd: '/ip/route/print', tag: 'route' },
            { cmd: '/ip/firewall/filter/print', tag: 'filter' },
            { cmd: '/ip/firewall/nat/print', tag: 'nat' },
            { cmd: '/ip/firewall/mangle/print', tag: 'mangle' },
            { cmd: '/ip/firewall/address-list/print', tag: 'address_list' },
            { cmd: '/ip/dns/print', tag: 'dns' },
            { cmd: '/ip/service/print', tag: 'ip_service' },
            { cmd: '/ppp/profile/print', tag: 'ppp_profile' },
            { cmd: '/ppp/secret/print', tag: 'ppp_secret' }
          ];

      const results: Record<string, any[]> = {};
      let identity = 'MikroTik';
      let version = '6.x';
      let model = 'RouterOS';

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout (${timeout}ms) saat menghubungi MikroTik via API port ${port}${isTls ? ' (TLS)' : ''}`));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timer);
        if (socket) {
          socket.removeAllListeners();
          socket.end();
          socket.destroy();
        }
      };

      socket.on('error', (err: any) => {
        cleanup();
        reject(new Error(`Koneksi RouterOS API port ${port}${isTls ? ' (TLS)' : ''} gagal: ${err.message}`));
      });

      const onConnected = () => {
        state = 'LOGIN_SENT';
        // Kirim login langsung dengan kredensial (Standard RouterOS 6.43+ dan 7.x)
        socket.write(encodeSentence([
          '/login',
          `=name=${options.username ? options.username.trim() : 'admin'}`,
          `=password=${options.password || ''}`
        ]));
      };

      if (isTls) {
        socket.on('secureConnect', onConnected);
      } else {
        socket.on('connect', onConnected);
      }

      socket.on('data', (chunk: any) => {
        rxBuf = Buffer.concat([rxBuf, chunk]);
        const parsed = parseSentencesFromBuffer(rxBuf);
        rxBuf = parsed.remaining;

        for (const sentence of parsed.sentences) {
          const sentenceType = sentence[0];

          if (state === 'LOGIN_SENT') {
            if (sentenceType === '!done') {
              const retWord = sentence.find(w => w.startsWith('=ret='));
              const challengeHex = retWord ? retWord.slice(5) : '';
              if (challengeHex && challengeHex.length === 32) {
                // Legacy RouterOS (<= 6.42) MD5 challenge
                const chal = Buffer.from(challengeHex, 'hex');
                const zero = Buffer.from([0]);
                const pwd = Buffer.from(options.password || '', 'utf-8');
                const hash = crypto.createHash('md5').update(Buffer.concat([zero, pwd, chal])).digest('hex');

                state = 'CHALLENGE_SENT';
                socket.write(encodeSentence([
                  '/login',
                  `=name=${options.username ? options.username.trim() : 'admin'}`,
                  `=response=00${hash}`
                ]));
              } else {
                // Login langsung diterima (RouterOS 6.43+ & 7.x)
                state = 'COMMANDS';
                runNextCommand();
              }
            } else if (sentenceType === '!trap') {
              const msgWord = sentence.find(w => w.startsWith('=message='));
              const errorMsg = msgWord ? msgWord.slice(9) : 'Login RouterOS API ditolak';
              cleanup();
              reject(new Error(`Autentikasi RouterOS API port ${port} gagal: ${errorMsg}. Periksa username dan password login admin router.`));
              return;
            }
          } else if (state === 'CHALLENGE_SENT') {
            if (sentenceType === '!done') {
              state = 'COMMANDS';
              runNextCommand();
            } else if (sentenceType === '!trap') {
              const msgWord = sentence.find(w => w.startsWith('=message='));
              const errorMsg = msgWord ? msgWord.slice(9) : 'Login RouterOS API ditolak';
              cleanup();
              reject(new Error(`Autentikasi RouterOS API port ${port} gagal: ${errorMsg}. Periksa username dan password admin router.`));
              return;
            }
          } else if (state === 'COMMANDS') {
            const currentTag = commandsToRun[currentCmdIndex]?.tag;
            if (!results[currentTag]) results[currentTag] = [];

            if (sentenceType === '!re') {
              const item: Record<string, string> = {};
              for (const word of sentence.slice(1)) {
                if (word.startsWith('=')) {
                  const eqIdx = word.indexOf('=', 1);
                  if (eqIdx !== -1) {
                    item[word.slice(1, eqIdx)] = word.slice(eqIdx + 1);
                  } else {
                    item[word.slice(1)] = 'true';
                  }
                }
              }
              results[currentTag].push(item);
            } else if (sentenceType === '!done' || sentenceType === '!trap') {
              currentCmdIndex++;
              if (currentCmdIndex < commandsToRun.length) {
                runNextCommand();
              } else {
                cleanup();
                buildConfig();
              }
            }
          }
        }
      });

      function runNextCommand() {
        if (currentCmdIndex < commandsToRun.length) {
          socket.write(encodeSentence([commandsToRun[currentCmdIndex].cmd]));
        }
      }

      function buildConfig() {
        if (results.identity && results.identity[0]?.name) {
          identity = results.identity[0].name;
        }
        if (results.resource && results.resource[0]) {
          if (results.resource[0].version) version = results.resource[0].version;
          if (results.resource[0]['board-name']) model = results.resource[0]['board-name'];
        }

        const lines: string[] = [
          `# MikroTik RouterOS ${version}`,
          `# identity = ${identity}`,
          `# model = ${model}`,
          `# generated by MikroTik Auto Backup Manager via RouterOS API (v6/v7)`,
          `# timestamp = ${new Date().toISOString()}`,
          ''
        ];

        const formatProps = (obj: any, preferredKeys?: string[]) => {
          const ignored = new Set(['.id', '.nextid', 'running', 'actual-mtu', 'dynamic', 'invalid', 'bytes', 'packets']);
          const keys = preferredKeys
            ? [...preferredKeys.filter(k => k in obj), ...Object.keys(obj).filter(k => !preferredKeys.includes(k))]
            : Object.keys(obj);

          const p: string[] = [];
          for (const k of keys) {
            if (ignored.has(k)) continue;
            const v = obj[k];
            if (v === undefined || v === null || v === '') continue;
            if (v === 'true' || v === true) p.push(`${k}=yes`);
            else if (v === 'false' || v === false) p.push(`${k}=no`);
            else if (typeof v === 'string' && (v.includes(' ') || v.includes(';') || v.includes('"') || v === '')) {
              p.push(`${k}="${v.replace(/"/g, '\\"')}"`);
            } else {
              p.push(`${k}=${v}`);
            }
          }
          return p.join(' ');
        };

        // 1. /interface bridge
        if (results.bridge?.length > 0) {
          lines.push('/interface bridge');
          for (const b of results.bridge) {
            if (b.dynamic === 'true') continue;
            lines.push(`add ${formatProps(b, ['name', 'vlan-filtering', 'comment', 'mtu'])}`);
          }
          lines.push('');
        }

        // 2. /interface vlan (VLAN Interfaces!)
        if (results.vlan?.length > 0) {
          lines.push('/interface vlan');
          for (const v of results.vlan) {
            if (v.dynamic === 'true') continue;
            lines.push(`add ${formatProps(v, ['name', 'vlan-id', 'interface', 'comment', 'disabled'])}`);
          }
          lines.push('');
        }

        // 3. /interface bridge port
        if (results.bridge_port?.length > 0) {
          lines.push('/interface bridge port');
          for (const bp of results.bridge_port) {
            if (bp.dynamic === 'true') continue;
            lines.push(`add ${formatProps(bp, ['bridge', 'interface', 'pvid', 'frame-types', 'ingress-filtering', 'comment', 'disabled'])}`);
          }
          lines.push('');
        }

        // 4. /interface bridge vlan
        if (results.bridge_vlan?.length > 0) {
          lines.push('/interface bridge vlan');
          for (const bv of results.bridge_vlan) {
            if (bv.dynamic === 'true') continue;
            lines.push(`add ${formatProps(bv, ['bridge', 'vlan-ids', 'tagged', 'untagged', 'comment'])}`);
          }
          lines.push('');
        }

        // 5. /interface list
        if (results.iface_list?.length > 0) {
          const customLists = results.iface_list.filter((l: any) => !['all', 'none', 'dynamic'].includes(l.name));
          if (customLists.length > 0) {
            lines.push('/interface list');
            for (const l of customLists) {
              lines.push(`add name="${l.name}" ${l.comment ? `comment="${l.comment}"` : ''}`);
            }
            lines.push('');
          }
        }

        // 6. /interface list member
        if (results.iface_member?.length > 0) {
          lines.push('/interface list member');
          for (const m of results.iface_member) {
            if (m.dynamic === 'true') continue;
            lines.push(`add interface="${m.interface}" list="${m.list}"`);
          }
          lines.push('');
        }

        // 7. /ip pool
        if (results.pool?.length > 0) {
          lines.push('/ip pool');
          for (const p of results.pool) {
            lines.push(`add name="${p.name}" ranges="${p.ranges}" ${p['next-pool'] ? `next-pool="${p['next-pool']}"` : ''}`);
          }
          lines.push('');
        }

        // 8. /ip dhcp-server (DHCP Server!)
        if (results.dhcp_server?.length > 0) {
          lines.push('/ip dhcp-server');
          for (const ds of results.dhcp_server) {
            if (ds.dynamic === 'true') continue;
            lines.push(`add ${formatProps(ds, ['name', 'interface', 'address-pool', 'lease-time', 'disabled', 'comment'])}`);
          }
          lines.push('');
        }

        // 9. /ip dhcp-server network
        if (results.dhcp_network?.length > 0) {
          lines.push('/ip dhcp-server network');
          for (const dn of results.dhcp_network) {
            lines.push(`add ${formatProps(dn, ['address', 'gateway', 'dns-server', 'domain', 'comment'])}`);
          }
          lines.push('');
        }

        // 10. /ip dhcp-server lease (Static leases only)
        if (results.dhcp_lease?.length > 0) {
          const staticLeases = results.dhcp_lease.filter((l: any) => l.dynamic !== 'true' && l.dynamic !== true);
          if (staticLeases.length > 0) {
            lines.push('/ip dhcp-server lease');
            for (const dl of staticLeases) {
              lines.push(`add ${formatProps(dl, ['address', 'mac-address', 'server', 'comment', 'disabled'])}`);
            }
            lines.push('');
          }
        }

        // 11. /ip dhcp-client
        if (results.dhcp_client?.length > 0) {
          lines.push('/ip dhcp-client');
          for (const dc of results.dhcp_client) {
            lines.push(`add ${formatProps(dc, ['interface', 'add-default-route', 'use-peer-dns'])}`);
          }
          lines.push('');
        }

        // 12. /ip address
        if (results.address?.length > 0) {
          const staticIps = results.address.filter((i: any) => i.dynamic !== 'true' && !i.interface?.includes('<'));
          if (staticIps.length > 0) {
            lines.push('/ip address');
            for (const i of staticIps) {
              lines.push(`add address="${i.address}" interface="${i.interface}" network="${i.network || ''}" ${i.comment ? `comment="${i.comment}"` : ''}`);
            }
            lines.push('');
          }
        }

        // 13. /ip route
        if (results.route?.length > 0) {
          const staticRoutes = results.route.filter((r: any) => r.dynamic !== 'true' && r.connect !== 'true' && !r.gateway?.includes('<'));
          if (staticRoutes.length > 0) {
            lines.push('/ip route');
            for (const r of staticRoutes) {
              lines.push(`add dst-address="${r['dst-address'] || '0.0.0.0/0'}" gateway="${r.gateway || ''}" ${r.distance ? `distance=${r.distance}` : ''}`);
            }
            lines.push('');
          }
        }

        // 14. /ip firewall filter
        if (results.filter?.length > 0) {
          const staticFilters = results.filter.filter((f: any) => f.dynamic !== 'true');
          if (staticFilters.length > 0) {
            lines.push('/ip firewall filter');
            for (const f of staticFilters) {
              lines.push(`add ${formatProps(f)}`);
            }
            lines.push('');
          }
        }

        // 15. /ip firewall nat
        if (results.nat?.length > 0) {
          const staticNats = results.nat.filter((n: any) => n.dynamic !== 'true');
          if (staticNats.length > 0) {
            lines.push('/ip firewall nat');
            for (const n of staticNats) {
              lines.push(`add ${formatProps(n)}`);
            }
            lines.push('');
          }
        }

        // 16. /ip firewall mangle
        if (results.mangle?.length > 0) {
          const staticMangles = results.mangle.filter((m: any) => m.dynamic !== 'true');
          if (staticMangles.length > 0) {
            lines.push('/ip firewall mangle');
            for (const m of staticMangles) {
              lines.push(`add ${formatProps(m)}`);
            }
            lines.push('');
          }
        }

        // 17. /ip firewall address-list
        if (results.address_list?.length > 0) {
          const staticLists = results.address_list.filter((al: any) => al.dynamic !== 'true');
          if (staticLists.length > 0) {
            lines.push('/ip firewall address-list');
            for (const al of staticLists) {
              lines.push(`add list="${al.list}" address="${al.address}" ${al.comment ? `comment="${al.comment}"` : ''}`);
            }
            lines.push('');
          }
        }

        // 18. /ip dns
        if (results.dns && results.dns[0]?.servers) {
          lines.push('/ip dns');
          lines.push(`set servers="${results.dns[0].servers}" allow-remote-requests="${results.dns[0]['allow-remote-requests'] || 'no'}"`);
          lines.push('');
        }

        // 18b. /ip service (Services: api, api-ssl, winbox, www, www-ssl, ssh, telnet, ftp)
        if (results.ip_service?.length > 0) {
          lines.push('/ip service');
          for (const s of results.ip_service) {
            const svcName = s.name;
            if (!svcName) continue;
            const isDisabled = s.disabled === 'true' || s.disabled === true ? 'yes' : 'no';
            let cmd = `set ${svcName} port=${s.port || 80} disabled=${isDisabled}`;
            if (s.address && s.address !== '0.0.0.0/0' && s.address.trim() !== '') {
              cmd += ` address="${s.address}"`;
            }
            if (s.certificate && s.certificate !== 'none' && s.certificate.trim() !== '') {
              cmd += ` certificate="${s.certificate}"`;
            }
            if (s.vrf && s.vrf !== 'main' && s.vrf.trim() !== '') {
              cmd += ` vrf="${s.vrf}"`;
            }
            if (s['tls-version'] && s['tls-version'].trim() !== '') {
              cmd += ` tls-version="${s['tls-version']}"`;
            }
            lines.push(cmd);
          }
          lines.push('');
        }

        // 19. /ppp profile & secret
        if (results.ppp_profile?.length > 0) {
          const customP = results.ppp_profile.filter((p: any) => !['default', 'default-encryption'].includes(p.name));
          if (customP.length > 0) {
            lines.push('/ppp profile');
            for (const p of customP) lines.push(`add name="${p.name}"`);
            lines.push('');
          }
        }
        if (results.ppp_secret?.length > 0) {
          lines.push('/ppp secret');
          for (const s of results.ppp_secret) {
            lines.push(`add name="${s.name}" service="${s.service || 'any'}" profile="${s.profile || 'default'}" ${s.password ? `password="${s.password}"` : ''}`);
          }
          lines.push('');
        }

        if (options.quickCheckOnly) {
          resolve({
            success: true,
            content: `# MikroTik RouterOS ${version}\n# identity = ${identity}\n# model = ${model}`,
            version,
            identity,
            model,
            isTlsUsed: isTls
          });
          return;
        }

        const rawRsc = lines.join('\n');
        resolve({
          success: true,
          content: filterStaticOnlyRsc(rawRsc),
          version,
          identity,
          model,
          isTlsUsed: isTls
        });
      }
    });
  }

  // Resilient wrapper: secara otomatis mencoba plaintext dan TLS untuk port kustom / default
  async function queryRouterOsApi(options: {
    hostname: string;
    port: number;
    username?: string;
    password?: string;
    timeoutMs?: number;
    useTls?: boolean;
    quickCheckOnly?: boolean;
  }): Promise<{
    success: boolean;
    content: string;
    version: string;
    identity: string;
    model: string;
    isTlsUsed: boolean;
    error?: string;
  }> {
    const port = options.port || 8728;
    // Port 8729 standar API-SSL. Port kustom (58728, 8727, 9728, dll) atau 8728 gunakan plaintext secara default kecuali user eksplisit mencentang TLS
    const preferTls = options.useTls !== undefined ? options.useTls : (port === 8729);

    try {
      const res = await queryRouterOsApiSingle({ ...options, port, useTls: preferTls });
      return res;
    } catch (err: any) {
      // Jika kegagalan BUKAN karena salah kredensial (username/password), coba fallback mode (TLS <-> Plaintext)
      const isAuthError = err.message && (
        err.message.includes('Autentikasi') ||
        err.message.includes('password') ||
        err.message.includes('username') ||
        err.message.includes('ditolak')
      );

      if (!isAuthError) {
        console.log(`[RouterOS API] Percobaan port ${port} dengan TLS=${preferTls} gagal (${err.message}), mencoba fallback TLS=${!preferTls}...`);
        try {
          const altRes = await queryRouterOsApiSingle({
            ...options,
            port,
            useTls: !preferTls,
            timeoutMs: Math.min(options.timeoutMs || 8000, 5000)
          });
          return altRes;
        } catch {
          // Jika fallback juga gagal, lempar error asli
        }
      }
      throw err;
    }
  }

  // Function to pull real configuration from MikroTik RouterOS v7 device
  async function pullRealMikrotikConfig(device: RouterDevice): Promise<{
    content: string;
    version?: string;
    identity?: string;
    model?: string;
    activePort?: number;
  }> {
    const configuredPort = device.port || (device.osVersion === 'v6' ? 8728 : 443);
    const isV6Mode = device.osVersion === 'v6' || device.protocol === 'api_binary' || configuredPort === 8728 || configuredPort === 8729 || configuredPort === 8727 || configuredPort === 9728 || configuredPort === 58728;

    // If device is configured for RouterOS API (v6 or custom API port), pull directly via RouterOS API protocol
    if (isV6Mode) {
      console.log(`[API Pull] Menghubungi MikroTik ${device.name} (${device.ipHost}) via RouterOS API port ${configuredPort} (Mode RouterOS v6/API)...`);
      try {
        const apiRes = await queryRouterOsApi({
          hostname: device.ipHost,
          port: configuredPort,
          useTls: configuredPort === 8729 ? true : (device.useTls !== undefined ? Boolean(device.useTls) : false),
          username: device.username,
          password: device.password,
          timeoutMs: 15000
        });
        if (apiRes.success && apiRes.content) {
          return {
            content: apiRes.content,
            version: apiRes.version,
            identity: apiRes.identity,
            model: apiRes.model,
            activePort: configuredPort
          };
        }
      } catch (err: any) {
        console.warn(`[API Pull] Gagal menarik via API port ${configuredPort}:`, err.message);
        // If device is strictly v6 or api_binary, do not attempt REST API ports
        if (device.osVersion === 'v6' || device.protocol === 'api_binary') {
          const svcName = (configuredPort === 8729 || (device.useTls && configuredPort !== 8728)) ? 'api-ssl' : 'api';
          throw new Error(`Gagal menarik konfigurasi dari MikroTik v6 ${device.ipHost} pada port API ${configuredPort}: ${err.message}. Pastikan port API ${configuredPort} aktif di menu IP -> Services router MikroTik (/ip service set ${svcName} port=${configuredPort} disabled=no).`);
        }
      }
    }

    // Determine candidate ports to probe for REST API (port 443, 80, 444, 8080)
    const candidates: Array<{ port: number; useTls: boolean }> = [];
    const isConfiguredTls = device.port === 444 || device.port === 443 || device.useTls;
    candidates.push({ port: device.port, useTls: isConfiguredTls });
    candidates.push({ port: device.port, useTls: !isConfiguredTls });

    const standardPorts = [
      { port: 443, useTls: true },
      { port: 80, useTls: false },
      { port: 444, useTls: true },
      { port: 8080, useTls: false },
      { port: 8443, useTls: true }
    ];

    for (const p of standardPorts) {
      if (!candidates.some(c => c.port === p.port && c.useTls === p.useTls)) {
        candidates.push(p);
      }
    }

    let activeCandidate = candidates[0];
    let identity = device.name;
    let version = '7.x';
    let model = device.model || 'MikroTik RouterOS';
    let lastError: string | null = null;
    let connected = false;

    // Phase 1: Probe candidate ports until one responds
    for (const cand of candidates) {
      try {
        console.log(`[REST Pull] Mencoba port ${cand.port} (${cand.useTls ? 'HTTPS' : 'HTTP'}) untuk ${device.name}...`);
        const identRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: cand.port,
          path: '/rest/system/identity',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: cand.useTls,
          timeoutMs: 6000
        });

        if (identRes.status === 401 || identRes.status === 403) {
          throw new Error(`Autentikasi ditolak (HTTP ${identRes.status}) di port ${cand.port}. Pastikan username (${device.username}) dan password login MikroTik Anda benar, serta user memiliki grup dengan hak akses 'rest-api'.`);
        }

        if (identRes.status === 200) {
          activeCandidate = { port: identRes.finalPort || cand.port, useTls: identRes.finalTls !== undefined ? identRes.finalTls : cand.useTls };
          connected = true;
          try {
            const parsed = JSON.parse(identRes.data);
            if (parsed?.name) identity = parsed.name;
          } catch (e) {}
          console.log(`[REST Pull] Berhasil terhubung ke port ${activeCandidate.port} (${activeCandidate.useTls ? 'HTTPS' : 'HTTP'})`);
          break;
        } else {
          lastError = `Port ${cand.port} mengembalikan HTTP ${identRes.status}`;
        }
      } catch (err: any) {
        lastError = err.message;
        if (err.message.includes('Autentikasi ditolak')) {
          throw err;
        }
        console.warn(`[REST Pull] Percobaan port ${cand.port} gagal:`, err.message);
      }
    }

    if (!connected) {
      // Auto-fallback: If REST API ports are closed, try RouterOS API on custom port first, then 8728
      console.log(`[Pull Fallback] REST API tidak merespons. Mencoba RouterOS API port ${configuredPort} / 8728 untuk ${device.name}...`);
      const fallbackPorts = [configuredPort, 8728].filter((p, i, a): p is number => Boolean(p) && a.indexOf(p) === i);
      for (const p of fallbackPorts) {
        try {
          const apiRes = await queryRouterOsApi({
            hostname: device.ipHost,
            port: p,
            useTls: Boolean(device.useTls || p === 8729),
            username: device.username,
            password: device.password,
            timeoutMs: 8000
          });
          if (apiRes.success && apiRes.content) {
            return {
              content: apiRes.content,
              version: apiRes.version,
              identity: apiRes.identity,
              model: apiRes.model,
              activePort: p
            };
          }
        } catch (apiErr: any) {
          console.warn(`[Pull Fallback] Percobaan port API ${p} gagal:`, apiErr.message);
        }
      }

      throw new Error(`Tidak dapat terhubung ke MikroTik ${device.ipHost} pada port REST API (${candidates.map(c => c.port).join(', ')}) maupun port API (${fallbackPorts.join(', ')}). Detail: ${lastError || 'Koneksi ditolak/timeout'}.`);
    }

    // Update device port in memory if alternative worked
    if (activeCandidate.port !== device.port) {
      device.port = activeCandidate.port;
      device.useTls = activeCandidate.useTls;
      saveDatabase(db);
    }

    // 1b. Check resource info (RouterOS version & board-name)
    try {
      const resRes = await mikrotikRequest({
        hostname: device.ipHost,
        port: activeCandidate.port,
        path: '/rest/system/resource',
        method: 'GET',
        username: device.username,
        password: device.password,
        useTls: activeCandidate.useTls,
        timeoutMs: 8000
      });
      if (resRes.status === 200 && resRes.data) {
        try {
          const parsed = JSON.parse(resRes.data);
          if (parsed?.version) version = parsed.version;
          if (parsed?.['board-name']) model = parsed['board-name'];
        } catch (e) {}
      }
    } catch (e) {}

    let exportedText = '';

    // 2. Try POST /rest/execute with :export script (RouterOS v7)
    try {
      const execRes = await mikrotikRequest({
        hostname: device.ipHost,
        port: activeCandidate.port,
        path: '/rest/execute',
        method: 'POST',
        username: device.username,
        password: device.password,
        useTls: activeCandidate.useTls,
        body: { script: ':export show-sensitive' },
        timeoutMs: 25000
      });

      if (execRes.status === 200 && execRes.data) {
        try {
          const parsed = JSON.parse(execRes.data);
          if (parsed?.ret && typeof parsed.ret === 'string' && parsed.ret.length > 20) {
            exportedText = parsed.ret;
          } else if (parsed?.output && typeof parsed.output === 'string') {
            exportedText = parsed.output;
          }
        } catch {
          if (execRes.data.includes('/interface') || execRes.data.includes('# software id')) {
            exportedText = execRes.data;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[REST Pull] /rest/execute warning:`, err.message);
    }

    // 3. Fallback: Trigger export to file, then read actual file contents
    if (!exportedText) {
      const tempFileName = `autobackup_${Date.now().toString(36)}`;
      try {
        console.log(`[REST Pull] Mengekspor konfigurasi ke file ${tempFileName}.rsc di MikroTik...`);
        await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/export',
          method: 'POST',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          body: { file: tempFileName, 'show-sensitive': '' },
          timeoutMs: 15000
        });

        // Tunggu router selesai menulis file ke disk
        await new Promise(r => setTimeout(r, 4000));

        // 3a. Baca contents via .proplist=name,contents
        const fileRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: `/rest/file/${tempFileName}.rsc?.proplist=name,contents`,
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 15000
        });

        if (fileRes.status === 200 && fileRes.data) {
          try {
            const parsed = JSON.parse(fileRes.data);
            const item = Array.isArray(parsed) ? parsed[0] : parsed;
            if (item?.contents && typeof item.contents === 'string' && item.contents.length > 20) {
              exportedText = item.contents;
              console.log(`[REST Pull] Berhasil membaca contents file via .proplist (${exportedText.length} bytes)`);
            }
          } catch {}
        }

        // 3b. Jika belum dapat, coba POST /rest/file/print dengan .proplist
        if (!exportedText) {
          const printRes = await mikrotikRequest({
            hostname: device.ipHost,
            port: activeCandidate.port,
            path: '/rest/file/print',
            method: 'POST',
            username: device.username,
            password: device.password,
            useTls: activeCandidate.useTls,
            body: { '.proplist': 'name,contents', '?name': `${tempFileName}.rsc` },
            timeoutMs: 15000
          });

          if (printRes.status === 200 && printRes.data) {
            try {
              const parsed = JSON.parse(printRes.data);
              const item = Array.isArray(parsed) ? parsed[0] : parsed;
              if (item?.contents && typeof item.contents === 'string' && item.contents.length > 20) {
                exportedText = item.contents;
                console.log(`[REST Pull] Berhasil membaca contents file via /rest/file/print (${exportedText.length} bytes)`);
              }
            } catch {}
          }
        }

        // 3c. Jika belum dapat, baca isi file menggunakan script :put execute
        if (!exportedText) {
          const readExec = await mikrotikRequest({
            hostname: device.ipHost,
            port: activeCandidate.port,
            path: '/rest/execute',
            method: 'POST',
            username: device.username,
            password: device.password,
            useTls: activeCandidate.useTls,
            body: { script: `:put [/file get [find name="${tempFileName}.rsc"] contents]` },
            timeoutMs: 15000
          });

          if (readExec.status === 200 && readExec.data) {
            try {
              const parsed = JSON.parse(readExec.data);
              const out = parsed?.output || parsed?.ret || readExec.data;
              if (typeof out === 'string' && (out.includes('/interface') || out.includes('#') || out.length > 50)) {
                exportedText = out;
                console.log(`[REST Pull] Berhasil membaca contents file via :put execute (${exportedText.length} bytes)`);
              }
            } catch {
              if (readExec.data.includes('/interface') || readExec.data.includes('#')) {
                exportedText = readExec.data;
              }
            }
          }
        }

        // 3d. Coba unduh file langsung via HTTP GET
        if (!exportedText) {
          const directFileRes = await mikrotikRequest({
            hostname: device.ipHost,
            port: activeCandidate.port,
            path: `/${tempFileName}.rsc`,
            method: 'GET',
            username: device.username,
            password: device.password,
            useTls: activeCandidate.useTls,
            timeoutMs: 15000
          });

          if (directFileRes.status === 200 && directFileRes.data && (directFileRes.data.includes('/interface') || directFileRes.data.includes('#'))) {
            exportedText = directFileRes.data;
            console.log(`[REST Pull] Berhasil download file rsc langsung via HTTP GET (${exportedText.length} bytes)`);
          }
        }

        // Cleanup temp file dari MikroTik
        try {
          await mikrotikRequest({
            hostname: device.ipHost,
            port: activeCandidate.port,
            path: `/rest/file/${tempFileName}.rsc`,
            method: 'DELETE',
            username: device.username,
            password: device.password,
            useTls: activeCandidate.useTls,
            timeoutMs: 5000
          });
        } catch {}
      } catch (e: any) {
        console.warn(`[REST Pull] Export file fallback failed:`, e.message);
      }
    }

    // 4. Fallback jika masih kosong atau hanya metadata: Ambil konfigurasi komprehensif via endpoint REST API
    if (!exportedText || (exportedText.startsWith('{') && exportedText.includes('"type":"script"'))) {
      try {
        console.log(`[REST Pull] Mengambil konfigurasi live detail via endpoint REST API modular...`);
        const parts: string[] = [
          `# MikroTik RouterOS ${version}`,
          `# identity = ${identity}`,
          `# model = ${model}`,
          `# generated by MikroTik Auto Backup Manager via REST API`,
          `# timestamp = ${new Date().toISOString()}`,
          ''
        ];

        const fetchEndpoint = async (endpointPath: string): Promise<any[] | any | null> => {
          try {
            const res = await mikrotikRequest({
              hostname: device.ipHost,
              port: activeCandidate.port,
              path: endpointPath,
              method: 'GET',
              username: device.username,
              password: device.password,
              useTls: activeCandidate.useTls,
              timeoutMs: 7000
            });
            if (res.status === 200 && res.data) {
              try {
                return JSON.parse(res.data);
              } catch {
                return null;
              }
            }
          } catch {
            return null;
          }
          return null;
        };

        const formatProps = (obj: any, preferredKeys?: string[]) => {
          const ignored = new Set(['.id', '.nextid', 'running', 'actual-mtu', 'dynamic', 'invalid', 'bytes', 'packets', 'rx-byte', 'tx-byte']);
          const keys = preferredKeys
            ? [...preferredKeys.filter(k => k in obj), ...Object.keys(obj).filter(k => !preferredKeys.includes(k))]
            : Object.keys(obj);

          const p: string[] = [];
          for (const k of keys) {
            if (ignored.has(k)) continue;
            const v = obj[k];
            if (v === undefined || v === null || v === '') continue;
            if (v === 'true' || v === true) p.push(`${k}=yes`);
            else if (v === 'false' || v === false) p.push(`${k}=no`);
            else if (typeof v === 'string' && (v.includes(' ') || v.includes(';') || v.includes('"') || v === '')) {
              p.push(`${k}="${v.replace(/"/g, '\\"')}"`);
            } else {
              p.push(`${k}=${v}`);
            }
          }
          return p.join(' ');
        };

        // 1. /interface bridge
        const bridges = await fetchEndpoint('/rest/interface/bridge');
        if (Array.isArray(bridges) && bridges.length > 0) {
          parts.push('/interface bridge');
          for (const b of bridges) {
            if (b.dynamic === 'true' || b.dynamic === true) continue;
            parts.push(`add ${formatProps(b, ['name', 'vlan-filtering', 'comment', 'mtu'])}`);
          }
          parts.push('');
        }

        // 2. /interface vlan (CRITICAL FOR USER!)
        const vlans = await fetchEndpoint('/rest/interface/vlan');
        if (Array.isArray(vlans) && vlans.length > 0) {
          parts.push('/interface vlan');
          for (const v of vlans) {
            if (v.dynamic === 'true' || v.dynamic === true) continue;
            parts.push(`add ${formatProps(v, ['name', 'vlan-id', 'interface', 'comment', 'disabled'])}`);
          }
          parts.push('');
        }

        // 3. /interface bridge port
        const bridgePorts = await fetchEndpoint('/rest/interface/bridge/port');
        if (Array.isArray(bridgePorts) && bridgePorts.length > 0) {
          parts.push('/interface bridge port');
          for (const bp of bridgePorts) {
            if (bp.dynamic === 'true' || bp.dynamic === true) continue;
            parts.push(`add ${formatProps(bp, ['bridge', 'interface', 'pvid', 'frame-types', 'ingress-filtering', 'comment', 'disabled'])}`);
          }
          parts.push('');
        }

        // 4. /interface bridge vlan
        const bridgeVlans = await fetchEndpoint('/rest/interface/bridge/vlan');
        if (Array.isArray(bridgeVlans) && bridgeVlans.length > 0) {
          parts.push('/interface bridge vlan');
          for (const bv of bridgeVlans) {
            if (bv.dynamic === 'true' || bv.dynamic === true) continue;
            parts.push(`add ${formatProps(bv, ['bridge', 'vlan-ids', 'tagged', 'untagged', 'comment'])}`);
          }
          parts.push('');
        }

        // 5. /interface list
        const ifaceLists = await fetchEndpoint('/rest/interface/list');
        if (Array.isArray(ifaceLists) && ifaceLists.length > 0) {
          const customLists = ifaceLists.filter((l: any) => !['all', 'none', 'dynamic'].includes(l.name));
          if (customLists.length > 0) {
            parts.push('/interface list');
            for (const l of customLists) {
              parts.push(`add name="${l.name}" ${l.comment ? `comment="${l.comment}"` : ''}`);
            }
            parts.push('');
          }
        }

        // 6. /interface list member
        const listMembers = await fetchEndpoint('/rest/interface/list/member');
        if (Array.isArray(listMembers) && listMembers.length > 0) {
          parts.push('/interface list member');
          for (const m of listMembers) {
            if (m.dynamic === 'true' || m.dynamic === true) continue;
            parts.push(`add interface="${m.interface}" list="${m.list}"`);
          }
          parts.push('');
        }

        // 7. /ip pool
        const pools = await fetchEndpoint('/rest/ip/pool');
        if (Array.isArray(pools) && pools.length > 0) {
          parts.push('/ip pool');
          for (const p of pools) {
            parts.push(`add name="${p.name}" ranges="${p.ranges}" ${p['next-pool'] ? `next-pool="${p['next-pool']}"` : ''}`);
          }
          parts.push('');
        }

        // 8. /ip dhcp-server (CRITICAL FOR USER!)
        const dhcpServers = await fetchEndpoint('/rest/ip/dhcp-server');
        if (Array.isArray(dhcpServers) && dhcpServers.length > 0) {
          parts.push('/ip dhcp-server');
          for (const ds of dhcpServers) {
            if (ds.dynamic === 'true' || ds.dynamic === true) continue;
            parts.push(`add ${formatProps(ds, ['name', 'interface', 'address-pool', 'lease-time', 'disabled', 'comment'])}`);
          }
          parts.push('');
        }

        // 9. /ip dhcp-server network
        const dhcpNetworks = await fetchEndpoint('/rest/ip/dhcp-server/network');
        if (Array.isArray(dhcpNetworks) && dhcpNetworks.length > 0) {
          parts.push('/ip dhcp-server network');
          for (const dn of dhcpNetworks) {
            parts.push(`add ${formatProps(dn, ['address', 'gateway', 'dns-server', 'domain', 'comment'])}`);
          }
          parts.push('');
        }

        // 10. /ip dhcp-server lease (Static only)
        const dhcpLeases = await fetchEndpoint('/rest/ip/dhcp-server/lease');
        if (Array.isArray(dhcpLeases) && dhcpLeases.length > 0) {
          const staticLeases = dhcpLeases.filter((l: any) => l.dynamic !== 'true' && l.dynamic !== true);
          if (staticLeases.length > 0) {
            parts.push('/ip dhcp-server lease');
            for (const dl of staticLeases) {
              parts.push(`add ${formatProps(dl, ['address', 'mac-address', 'server', 'comment', 'disabled'])}`);
            }
            parts.push('');
          }
        }

        // 11. /ip dhcp-client
        const dhcpClients = await fetchEndpoint('/rest/ip/dhcp-client');
        if (Array.isArray(dhcpClients) && dhcpClients.length > 0) {
          parts.push('/ip dhcp-client');
          for (const dc of dhcpClients) {
            parts.push(`add ${formatProps(dc, ['interface', 'add-default-route', 'use-peer-dns'])}`);
          }
          parts.push('');
        }

        // 12. /ip address
        const ipAddresses = await fetchEndpoint('/rest/ip/address');
        if (Array.isArray(ipAddresses) && ipAddresses.length > 0) {
          const staticIps = ipAddresses.filter((i: any) => i.dynamic !== 'true' && i.dynamic !== true && !i.interface?.includes('<'));
          if (staticIps.length > 0) {
            parts.push('/ip address');
            for (const i of staticIps) {
              parts.push(`add address="${i.address}" interface="${i.interface}" network="${i.network || ''}" ${i.comment ? `comment="${i.comment}"` : ''}`);
            }
            parts.push('');
          }
        }

        // 13. /ip route
        const routes = await fetchEndpoint('/rest/ip/route');
        if (Array.isArray(routes) && routes.length > 0) {
          const staticRoutes = routes.filter((r: any) => r.dynamic !== 'true' && r.dynamic !== true && r.connect !== 'true' && !r.gateway?.includes('<'));
          if (staticRoutes.length > 0) {
            parts.push('/ip route');
            for (const r of staticRoutes) {
              parts.push(`add dst-address="${r['dst-address'] || '0.0.0.0/0'}" gateway="${r.gateway || ''}" ${r.distance ? `distance=${r.distance}` : ''}`);
            }
            parts.push('');
          }
        }

        // 14. /ip firewall filter
        const filters = await fetchEndpoint('/rest/ip/firewall/filter');
        if (Array.isArray(filters) && filters.length > 0) {
          const staticFilters = filters.filter((f: any) => f.dynamic !== 'true' && f.dynamic !== true);
          if (staticFilters.length > 0) {
            parts.push('/ip firewall filter');
            for (const f of staticFilters) {
              parts.push(`add ${formatProps(f)}`);
            }
            parts.push('');
          }
        }

        // 15. /ip firewall nat
        const nats = await fetchEndpoint('/rest/ip/firewall/nat');
        if (Array.isArray(nats) && nats.length > 0) {
          const staticNats = nats.filter((n: any) => n.dynamic !== 'true' && n.dynamic !== true);
          if (staticNats.length > 0) {
            parts.push('/ip firewall nat');
            for (const n of staticNats) {
              parts.push(`add ${formatProps(n)}`);
            }
            parts.push('');
          }
        }

        // 16. /ip firewall mangle
        const mangles = await fetchEndpoint('/rest/ip/firewall/mangle');
        if (Array.isArray(mangles) && mangles.length > 0) {
          const staticMangles = mangles.filter((m: any) => m.dynamic !== 'true' && m.dynamic !== true);
          if (staticMangles.length > 0) {
            parts.push('/ip firewall mangle');
            for (const m of staticMangles) {
              parts.push(`add ${formatProps(m)}`);
            }
            parts.push('');
          }
        }

        // 17. /ip firewall address-list
        const addressLists = await fetchEndpoint('/rest/ip/firewall/address-list');
        if (Array.isArray(addressLists) && addressLists.length > 0) {
          const staticLists = addressLists.filter((al: any) => al.dynamic !== 'true' && al.dynamic !== true);
          if (staticLists.length > 0) {
            parts.push('/ip firewall address-list');
            for (const al of staticLists) {
              parts.push(`add list="${al.list}" address="${al.address}" ${al.comment ? `comment="${al.comment}"` : ''}`);
            }
            parts.push('');
          }
        }

        // 18. /ip dns
        const dns = await fetchEndpoint('/rest/ip/dns');
        if (dns && (dns.servers || dns['allow-remote-requests'])) {
          parts.push('/ip dns');
          parts.push(`set servers="${dns.servers || ''}" allow-remote-requests="${dns['allow-remote-requests'] || 'no'}"`);
          parts.push('');
        }

        // 18b. /ip service (Services: api, api-ssl, winbox, www, www-ssl, ssh, telnet, ftp)
        const ipServices = await fetchEndpoint('/rest/ip/service');
        if (Array.isArray(ipServices) && ipServices.length > 0) {
          parts.push('/ip service');
          for (const s of ipServices) {
            const svcName = s.name;
            if (!svcName) continue;
            const isDisabled = s.disabled === 'true' || s.disabled === true ? 'yes' : 'no';
            let cmd = `set ${svcName} port=${s.port || 80} disabled=${isDisabled}`;
            if (s.address && s.address !== '0.0.0.0/0' && s.address.trim() !== '') {
              cmd += ` address="${s.address}"`;
            }
            if (s.certificate && s.certificate !== 'none' && s.certificate.trim() !== '') {
              cmd += ` certificate="${s.certificate}"`;
            }
            if (s.vrf && s.vrf !== 'main' && s.vrf.trim() !== '') {
              cmd += ` vrf="${s.vrf}"`;
            }
            if (s['tls-version'] && s['tls-version'].trim() !== '') {
              cmd += ` tls-version="${s['tls-version']}"`;
            }
            parts.push(cmd);
          }
          parts.push('');
        }

        // 19. /routing table
        const routingTables = await fetchEndpoint('/rest/routing/table');
        if (Array.isArray(routingTables) && routingTables.length > 0) {
          const customTables = routingTables.filter((t: any) => t.name !== 'main');
          if (customTables.length > 0) {
            parts.push('/routing table');
            for (const t of customTables) {
              parts.push(`add name="${t.name}" fib=${t.fib === 'true' || t.fib === true ? 'yes' : 'no'}`);
            }
            parts.push('');
          }
        }

        // 20. /system identity, clock, ntp
        const sysIdent = await fetchEndpoint('/rest/system/identity');
        if (sysIdent?.name) {
          parts.push('/system identity');
          parts.push(`set name="${sysIdent.name}"`);
          parts.push('');
        }

        // 21. /ppp profile & secret
        const pppProfiles = await fetchEndpoint('/rest/ppp/profile');
        if (Array.isArray(pppProfiles) && pppProfiles.length > 0) {
          const customProfs = pppProfiles.filter((p: any) => !['default', 'default-encryption'].includes(p.name));
          if (customProfs.length > 0) {
            parts.push('/ppp profile');
            for (const p of customProfs) {
              parts.push(`add name="${p.name}" ${p['local-address'] ? `local-address="${p['local-address']}"` : ''} ${p['remote-address'] ? `remote-address="${p['remote-address']}"` : ''}`);
            }
            parts.push('');
          }
        }

        const pppSecrets = await fetchEndpoint('/rest/ppp/secret');
        if (Array.isArray(pppSecrets) && pppSecrets.length > 0) {
          parts.push('/ppp secret');
          for (const s of pppSecrets) {
            parts.push(`add name="${s.name}" service="${s.service || 'any'}" profile="${s.profile || 'default'}" ${s.password ? `password="${s.password}"` : ''}`);
          }
          parts.push('');
        }

        if (parts.length > 6) {
          exportedText = parts.join('\n');
        }
      } catch (e: any) {
        console.warn(`[REST Pull] Granular endpoint pull warning:`, e.message);
      }
    }

    if (!exportedText) {
      throw new Error(`Tidak dapat membaca konfigurasi dari MikroTik ${device.ipHost}:${activeCandidate.port}. Pastikan service REST API (${activeCandidate.useTls ? 'www-ssl' : 'www'}) aktif dan user memiliki hak akses 'read' dan 'write'.`);
    }

    // Always sanitize to ensure ONLY clean static configuration is preserved
    const sanitizedText = filterStaticOnlyRsc(exportedText);

    return {
      content: sanitizedText,
      version,
      identity,
      model,
      activePort: activeCandidate.port
    };
  }

  // Unified function to execute backup for a device (Manual or Scheduled)
  async function performDeviceBackup(
    device: RouterDevice,
    trigger: 'scheduled' | 'manual'
  ): Promise<{ success: boolean; backup?: BackupRecord; error?: string }> {
    const now = new Date();
    const devDir = path.resolve(BACKUPS_DIR, device.id);
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }

    let content = '';
    let parsedVersion = '7.x';
    let detectedModel = device.model || 'MikroTik RouterOS';

    // Check if device can be pulled via RouterOS API v6 or REST API v7 (or has username configured)
    const canPull = device.protocol === 'rest_api' || device.protocol === 'api_binary' || device.osVersion === 'v6' || Boolean(device.username);

    if (canPull) {
      try {
        console.log(`[Backup ${trigger.toUpperCase()}] Menghubungi router ${device.name} di ${device.ipHost}:${device.port}...`);
        const pullResult = await pullRealMikrotikConfig(device);
        content = pullResult.content;
        parsedVersion = pullResult.version || '7.x';
        detectedModel = pullResult.model || device.model;
        if (pullResult.identity) {
          device.name = pullResult.identity;
        }
        console.log(`[Backup ${trigger.toUpperCase()}] Berhasil menarik konfigurasi REAL dari ${device.name} (${content.length} bytes)`);
      } catch (err: any) {
        console.error(`[Backup ${trigger.toUpperCase()}] Gagal mengambil konfigurasi dari ${device.name}:`, err.message);

        device.lastBackupAt = now.toISOString();
        device.lastBackupStatus = 'failed';
        device.lastBackupMessage = `Gagal menarik backup REAL: ${err.message}`;

        db.logs.unshift({
          id: crypto.randomUUID(),
          timestamp: now.toISOString(),
          type: 'backup_failed',
          deviceId: device.id,
          deviceName: device.name,
          message: `Backup ${trigger === 'scheduled' ? 'terjadwal otomatis' : 'manual'} GAGAL untuk ${device.name} (${device.ipHost}:${device.port}): ${err.message}`
        });

        saveDatabase(db);

        return {
          success: false,
          error: `Gagal menarik konfigurasi REAL dari MikroTik (${device.ipHost}:${device.port}): ${err.message}`
        };
      }
    } else {
      // Device is in push_webhook mode and has no credentials for pull
      const errMsg = `Router ${device.name} menggunakan mode Webhook Push dan belum memiliki kredensial REST API. Pasang skrip RouterOS di MikroTik untuk push backup otomatis, atau masukkan username & password login router pada menu Edit Router untuk penarikan otomatis dari server.`;
      console.warn(`[Backup ${trigger.toUpperCase()}] ${errMsg}`);

      device.lastBackupAt = now.toISOString();
      device.lastBackupStatus = 'failed';
      device.lastBackupMessage = errMsg;

      db.logs.unshift({
        id: crypto.randomUUID(),
        timestamp: now.toISOString(),
        type: 'backup_failed',
        deviceId: device.id,
        deviceName: device.name,
        message: errMsg
      });

      saveDatabase(db);

      return {
        success: false,
        error: errMsg
      };
    }

    if (!content || content.trim().length === 0) {
      const errMsg = `Konfigurasi yang ditarik dari router ${device.name} kosong (0 byte). Periksa hak akses user REST API di MikroTik.`;
      device.lastBackupAt = now.toISOString();
      device.lastBackupStatus = 'failed';
      device.lastBackupMessage = errMsg;
      saveDatabase(db);
      return { success: false, error: errMsg };
    }

    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeDevName = device.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeDevName}_${trigger === 'scheduled' ? 'sched' : 'live'}_${timestampStr}.rsc`;
    const filePath = path.resolve(devDir, filename);

    fs.writeFileSync(filePath, content, 'utf-8');

    const backupRecord: BackupRecord = {
      id: crypto.randomUUID(),
      deviceId: device.id,
      deviceName: device.name,
      deviceIp: device.ipHost,
      filename: filename,
      fileType: 'rsc',
      fileSize: Buffer.byteLength(content, 'utf-8'),
      filePath: filePath,
      contentPreview: content.slice(0, 400),
      trigger: trigger,
      status: 'success',
      routerOsVersion: parsedVersion,
      model: detectedModel,
      metadata: parseRscStats(content),
      notes: trigger === 'scheduled'
        ? `Backup otomatis terjadwal REAL via ${device.osVersion === 'v6' ? 'RouterOS API v6' : 'REST API v7'} (${device.ipHost}:${device.port})`
        : `Backup live real-time diambil via ${device.osVersion === 'v6' ? 'RouterOS API v6' : 'REST API v7'} (${device.ipHost}:${device.port})`,
      createdAt: now.toISOString()
    };

    db.backups.push(backupRecord);

    device.lastBackupAt = now.toISOString();
    device.lastBackupStatus = 'success';
    device.lastBackupMessage = `Backup REAL MikroTik berhasil (${(backupRecord.fileSize / 1024).toFixed(1)} KB)`;
    device.backupCount = db.backups.filter(b => b.deviceId === device.id).length;
    device.totalStorageBytes = db.backups.filter(b => b.deviceId === device.id).reduce((sum, b) => sum + b.fileSize, 0);

    applyRetention(device);

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      type: 'backup_success',
      deviceId: device.id,
      deviceName: device.name,
      message: `Backup ${trigger === 'scheduled' ? 'terjadwal otomatis' : 'manual'} REAL berhasil disimpan untuk ${device.name}: ${filename}`
    });

    saveDatabase(db);

    return {
      success: true,
      backup: backupRecord
    };
  }

  // 9. Manual Trigger "Backup Now" / Pull from Real MikroTik
  app.post('/api/devices/:id/backup-now', requireAuth, async (req: Request, res: Response) => {
    const device = db.devices.find(d => d.id === req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const result = await performDeviceBackup(device, 'manual');
    if (result.success) {
      res.json({
        success: true,
        message: `Konfigurasi REAL dari MikroTik ${device.name} berhasil ditarik dan disimpan!`,
        backup: result.backup
      });
    } else {
      res.status(502).json({
        error: result.error || 'Gagal menarik backup dari router MikroTik'
      });
    }
  });

  // 9b. Test Connection to MikroTik Router
  app.post('/api/devices/test-connection', requireAuth, async (req: Request, res: Response) => {
    const { ipHost, port, useTls, username, password, protocol, osVersion, deviceId } = req.body;
    if (!ipHost) {
      res.status(400).json({ error: 'IP Address / Hostname wajib diisi' });
      return;
    }

    let effectivePassword = password;
    if ((effectivePassword === undefined || effectivePassword === '') && deviceId) {
      const existing = db.devices.find(d => d.id === deviceId);
      if (existing?.password) {
        effectivePassword = existing.password;
      }
    }

    try {
      const targetPort = Number(port) || (osVersion === 'v6' ? 8728 : 443);
      const isV6Mode = osVersion === 'v6' || protocol === 'api_binary';
      const isKnownApiPort = targetPort === 8728 || targetPort === 8729 || targetPort === 8727 || targetPort === 9728 || targetPort === 58728;

      // 1. If user selected RouterOS v6, or protocol is api_binary, or port is an API port, test RouterOS API directly on targetPort
      if (isV6Mode || isKnownApiPort) {
        console.log(`[Test Connection API] Menguji RouterOS API ${ipHost.trim()}:${targetPort} (Mode v6/API)...`);
        try {
          const apiRes = await queryRouterOsApi({
            hostname: ipHost.trim(),
            port: targetPort,
            useTls: targetPort === 8729 ? true : (useTls !== undefined ? Boolean(useTls) : false),
            username: username ? username.trim() : 'admin',
            password: effectivePassword || '',
            timeoutMs: 6000,
            quickCheckOnly: true
          });
          if (apiRes.success) {
            res.json({
              success: true,
              identity: apiRes.identity,
              version: apiRes.version,
              model: apiRes.model,
              port: targetPort,
              useTls: apiRes.isTlsUsed,
              osVersion: apiRes.version?.startsWith('6.') ? 'v6' : 'v7',
              message: `Berhasil terhubung ke MikroTik ${apiRes.identity} (${apiRes.model}) - RouterOS v${apiRes.version} pada port API ${targetPort}${apiRes.isTlsUsed ? ' (TLS/SSL)' : ' (Plaintext)'}!`
            });
            return;
          }
        } catch (apiErr: any) {
          const svcName = (targetPort === 8729 || (useTls && targetPort !== 8728)) ? 'api-ssl' : 'api';
          res.status(502).json({
            error: `Gagal terhubung ke MikroTik di ${ipHost.trim()}:${targetPort} (RouterOS API): ${apiErr.message}. Pastikan port API ${targetPort} aktif pada menu IP -> Services di MikroTik (/ip service set ${svcName} port=${targetPort} disabled=no) dan firewall mengizinkan koneksi.`
          });
          return;
        }
      }

      const dummyDevice: RouterDevice = {
        id: 'test',
        name: 'Test Device',
        model: '',
        ipHost: ipHost.trim(),
        port: targetPort,
        protocol: 'rest_api',
        osVersion: 'v7',
        username: username ? username.trim() : 'admin',
        password: effectivePassword || '',
        useTls: Boolean(useTls),
        webhookToken: '',
        scheduleFrequency: 'daily',
        retentionCount: 10,
        enabled: true,
        backupCount: 0,
        totalStorageBytes: 0,
        createdAt: '',
        updatedAt: ''
      };

      const candidates: Array<{ port: number; useTls: boolean }> = [];
      const isConfiguredTls = dummyDevice.port === 444 || dummyDevice.port === 443 || dummyDevice.useTls;
      candidates.push({ port: dummyDevice.port, useTls: isConfiguredTls });
      candidates.push({ port: dummyDevice.port, useTls: !isConfiguredTls });

      const standardPorts = [
        { port: 443, useTls: true },
        { port: 80, useTls: false },
        { port: 444, useTls: true },
        { port: 8080, useTls: false },
        { port: 8443, useTls: true }
      ];

      for (const p of standardPorts) {
        if (!candidates.some(c => c.port === p.port && c.useTls === p.useTls)) {
          candidates.push(p);
        }
      }

      let connected = false;
      let identity = 'MikroTik';
      let version = '7.x';
      let model = 'RouterOS';
      let activeCandidate = candidates[0];
      let lastErr = '';

      for (const cand of candidates) {
        try {
          const identRes = await mikrotikRequest({
            hostname: dummyDevice.ipHost,
            port: cand.port,
            path: '/rest/system/identity',
            method: 'GET',
            username: dummyDevice.username,
            password: dummyDevice.password,
            useTls: cand.useTls,
            timeoutMs: 5000
          });

          if (identRes.status === 401 || identRes.status === 403) {
            res.status(401).json({
              error: `Autentikasi ditolak (HTTP ${identRes.status}) di port ${cand.port}. Username (${dummyDevice.username}) atau password login MikroTik salah, atau user tidak memiliki akses 'rest-api'.`
            });
            return;
          }

          if (identRes.status === 200) {
            connected = true;
            activeCandidate = { port: identRes.finalPort || cand.port, useTls: identRes.finalTls !== undefined ? identRes.finalTls : cand.useTls };
            try {
              const p = JSON.parse(identRes.data);
              if (p?.name) identity = p.name;
            } catch {}
            break;
          } else {
            lastErr = `Port ${cand.port} merespons HTTP ${identRes.status}`;
          }
        } catch (e: any) {
          lastErr = e.message;
        }
      }

      if (!connected) {
        // Fallback test via RouterOS API on custom port first, then 8728
        const fallbackPorts = [targetPort, 8728].filter((p, i, a): p is number => Boolean(p) && a.indexOf(p) === i);
        for (const p of fallbackPorts) {
          try {
            const apiRes = await queryRouterOsApi({
              hostname: dummyDevice.ipHost,
              port: p,
              useTls: p === 8729 ? true : (dummyDevice.useTls !== undefined ? Boolean(dummyDevice.useTls) : false),
              username: dummyDevice.username,
              password: dummyDevice.password,
              timeoutMs: 5000,
              quickCheckOnly: true
            });
            if (apiRes.success) {
              res.json({
                success: true,
                identity: apiRes.identity,
                version: apiRes.version,
                model: apiRes.model,
                port: p,
                useTls: apiRes.isTlsUsed,
                osVersion: apiRes.version?.startsWith('6.') ? 'v6' : 'v7',
                message: `Berhasil terhubung ke MikroTik ${apiRes.identity} (${apiRes.model}) - RouterOS v${apiRes.version} via API port ${p}${apiRes.isTlsUsed ? ' (TLS/SSL)' : ' (Plaintext)'}!`
              });
              return;
            }
          } catch (apiErr: any) {}
        }

        res.status(502).json({
          error: `Gagal terhubung ke MikroTik di ${ipHost}:${dummyDevice.port}. ${lastErr || 'Koneksi ditolak atau timeout'}. Pastikan port REST API aktif (port 80 / 443 untuk v7) atau port API aktif pada menu IP -> Services (untuk v6).`
        });
        return;
      }

      try {
        const resRes = await mikrotikRequest({
          hostname: dummyDevice.ipHost,
          port: activeCandidate.port,
          path: '/rest/system/resource',
          method: 'GET',
          username: dummyDevice.username,
          password: dummyDevice.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 6000
        });
        if (resRes.status === 200 && resRes.data) {
          try {
            const p = JSON.parse(resRes.data);
            if (p?.version) version = p.version;
            if (p?.['board-name']) model = p['board-name'];
          } catch {}
        }
      } catch {}

      res.json({
        success: true,
        identity,
        version,
        model,
        port: activeCandidate.port,
        useTls: activeCandidate.useTls,
        message: `Berhasil terhubung ke MikroTik ${identity} (${model}) - RouterOS v${version} pada port ${activeCandidate.port} (${activeCandidate.useTls ? 'HTTPS' : 'HTTP'})!`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal menguji koneksi ke router' });
    }
  });

  // 10. Delete a Backup Record
  app.delete('/api/backups/:id', requireAuth, (req: Request, res: Response) => {
    const backupIndex = db.backups.findIndex(b => b.id === req.params.id);
    if (backupIndex === -1) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }

    const backup = db.backups[backupIndex];
    if (fs.existsSync(backup.filePath)) {
      try {
        fs.unlinkSync(backup.filePath);
      } catch (err) {
        console.error('Failed to delete backup file:', err);
      }
    }

    db.backups.splice(backupIndex, 1);

    // Update device stats
    const device = db.devices.find(d => d.id === backup.deviceId);
    if (device) {
      device.backupCount = db.backups.filter(b => b.deviceId === device.id).length;
      device.totalStorageBytes = db.backups.filter(b => b.deviceId === device.id).reduce((sum, b) => sum + b.fileSize, 0);
    }

    saveDatabase(db);
    res.json({ success: true, message: 'Backup file deleted' });
  });

  // 11. Activity Logs
  app.get('/api/logs', requireAuth, (req: Request, res: Response) => {
    res.json(db.logs.slice(0, 50));
  });

  // Helper to obtain date & time components strictly in Asia/Jakarta (WIB, UTC+7)
  function getJakartaDate(date: Date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10);
    const day = parseInt(getPart('day'), 10);
    let hours = parseInt(getPart('hour'), 10);
    if (hours === 24) hours = 0;
    const minutes = parseInt(getPart('minute'), 10);
    const seconds = parseInt(getPart('second'), 10);

    const hourMinuteStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const formattedWib = `${dateStr} ${hourMinuteStr}:${String(seconds).padStart(2, '0')} WIB`;

    return {
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
      hourMinuteStr,
      dateStr,
      formattedWib
    };
  }

  // 12. App Settings / System info (Authenticated to prevent Shodan/scanner fingerprinting)
  app.get('/api/info', requireAuth, (req: Request, res: Response) => {
    const baseUrl = getAppBaseUrl(req);
    const jakarta = getJakartaDate();
    res.json({
      appName: 'MikroTik Auto Backup Manager',
      version: '1.0.0',
      baseUrl,
      uploadEndpoint: `${baseUrl}/api/backups/upload`,
      storageDirectory: './data/backups',
      time: new Date().toISOString(),
      timezone: 'Asia/Jakarta',
      formattedTime: jakarta.formattedWib
    });
  });

  // 13. Anti-Shodan & Network Security Settings
  app.get('/api/security/settings', requireAuth, (req: Request, res: Response) => {
    const sec = db.security || DEFAULT_SECURITY_SETTINGS;
    const envAllowedIps = (process.env.ALLOWED_IPS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    res.json({
      settings: sec,
      runtime: {
        clientIp: getClientIp(req),
        trustProxy: process.env.TRUST_PROXY === 'true',
        envAllowedIps,
        blockedScannerCount,
        blockedIpCount,
        recentBlockedEvents: recentBlockedEvents.slice(0, 15)
      }
    });
  });

  app.put('/api/security/settings', requireAuth, (req: Request, res: Response) => {
    const body = req.body || {};
    const current = db.security || { ...DEFAULT_SECURITY_SETTINGS };
    const clientIp = getClientIp(req);

    const nextBlockScanners = typeof body.blockScanners === 'boolean' ? body.blockScanners : current.blockScanners;
    const nextSilentDrop = typeof body.silentDropUnauthorized === 'boolean' ? body.silentDropUnauthorized : current.silentDropUnauthorized;
    const nextIpAllowlistEnabled = typeof body.ipAllowlistEnabled === 'boolean' ? body.ipAllowlistEnabled : current.ipAllowlistEnabled;
    const nextAllowRegisteredDeviceIps = typeof body.allowRegisteredDeviceIps === 'boolean' ? body.allowRegisteredDeviceIps : current.allowRegisteredDeviceIps;
    const nextHideFingerprint = typeof body.hideServerFingerprint === 'boolean' ? body.hideServerFingerprint : current.hideServerFingerprint;

    let nextRateLimit = current.rateLimitPerMinute;
    if (body.rateLimitPerMinute !== undefined) {
      const parsed = Number(body.rateLimitPerMinute);
      if (isNaN(parsed) || parsed < 20 || parsed > 1000) {
        res.status(400).json({ error: 'Batas permintaan (Rate Limit) harus antara 20 hingga 1000 req/menit.' });
        return;
      }
      nextRateLimit = Math.floor(parsed);
    }

    let nextAllowedIps = current.allowedIps;
    if (Array.isArray(body.allowedIps)) {
      const cleaned = body.allowedIps
        .map((s: unknown) => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean);
      const invalid = cleaned.filter((ip: string) => !isValidIpOrCidr(ip));
      if (invalid.length > 0) {
        res.status(400).json({ error: `Format IP / CIDR tidak valid: ${invalid.join(', ')}` });
        return;
      }
      nextAllowedIps = Array.from(new Set(cleaned));
    }

    // Prevent accidental admin self-lockout when enabling IP Allowlist
    if (nextIpAllowlistEnabled && clientIp && !isLoopbackIp(clientIp)) {
      const selfAllowed = nextAllowedIps.some(entry => ipMatchesEntry(clientIp, entry));
      if (!selfAllowed) {
        nextAllowedIps = Array.from(new Set([...nextAllowedIps, clientIp]));
      }
    }

    db.security = {
      blockScanners: nextBlockScanners,
      silentDropUnauthorized: nextSilentDrop,
      ipAllowlistEnabled: nextIpAllowlistEnabled,
      allowedIps: nextAllowedIps,
      allowRegisteredDeviceIps: nextAllowRegisteredDeviceIps,
      rateLimitPerMinute: nextRateLimit,
      hideServerFingerprint: nextHideFingerprint,
      updatedAt: new Date().toISOString()
    };

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'device_updated',
      message: `Pengaturan keamanan Anti-Shodan diperbarui (Block Scanner: ${nextBlockScanners ? 'ON' : 'OFF'}, IP Allowlist: ${nextIpAllowlistEnabled ? 'ON' : 'OFF'}, Silent Drop: ${nextSilentDrop ? 'ON' : 'OFF'})`
    });

    saveDatabase(db);
    res.json({
      success: true,
      settings: db.security,
      message: 'Pengaturan keamanan & Anti-Shodan berhasil disimpan!'
    });
  });

  // --- Background Scheduler (Runs in Asia/Jakarta / WIB Timezone) ---
  // Runs check every 30 seconds for scheduled automatic backups
  setInterval(async () => {
    const now = new Date();
    const jakarta = getJakartaDate(now);
    const currentHourMinute = jakarta.hourMinuteStr;
    const todayDateString = jakarta.dateStr;

    for (const device of db.devices) {
      if (!device.enabled) continue;

      let shouldRun = false;

      // 1. Daily schedule check (e.g. 02:00 in Asia/Jakarta)
      if (device.scheduleFrequency === 'daily' && device.scheduleTime === currentHourMinute) {
        // Run once per day
        const lastBackupDate = device.lastBackupAt ? getJakartaDate(new Date(device.lastBackupAt)).dateStr : null;
        if (lastBackupDate !== todayDateString) {
          shouldRun = true;
        }
      } else if (device.scheduleFrequency === 'hourly' && jakarta.minutes === 0) {
        // Run once per hour
        const lastBackupHour = device.lastBackupAt ? getJakartaDate(new Date(device.lastBackupAt)).hours : -1;
        const lastBackupDate = device.lastBackupAt ? getJakartaDate(new Date(device.lastBackupAt)).dateStr : null;
        if (lastBackupDate !== todayDateString || lastBackupHour !== jakarta.hours) {
          shouldRun = true;
        }
      } else if (device.scheduleFrequency === '6hours' && jakarta.minutes === 0 && jakarta.hours % 6 === 0) {
        shouldRun = true;
      }

      if (shouldRun) {
        console.log(`[AutoScheduler WIB] Waktu jadwal (${device.scheduleTime || device.scheduleFrequency} WIB) tercapai untuk ${device.name}. Menjalankan backup REAL dari router MikroTik...`);
        try {
          await performDeviceBackup(device, 'scheduled');
        } catch (err) {
          console.error(`[AutoScheduler WIB] Error saat mengeksekusi backup untuk ${device.name}:`, err);
        }
      }
    }
  }, 30000);

  // Mount Vite or static files
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';
  app.listen(PORT, BIND_HOST, () => {
    console.log(`[MikroTik Auto Backup Server] Running on http://${BIND_HOST === '0.0.0.0' ? 'localhost' : BIND_HOST}:${PORT}`);
  });
}

createServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
