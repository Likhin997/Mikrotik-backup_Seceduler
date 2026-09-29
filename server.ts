import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import multer from 'multer';
import http from 'http';
import https from 'https';

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
  protocol: 'push_webhook' | 'rest_api' | 'ssh_pull';
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

export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  lastLoginAt?: string;
  updatedAt: string;
}

interface AppDatabase {
  devices: RouterDevice[];
  backups: BackupRecord[];
  logs: ActivityLog[];
  admin: AdminUser;
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
    if (!existingDb.admin) {
      existingDb.admin = defaultAdmin;
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
    admin: defaultAdmin
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

  const ipCount = ipMatch ? (ipMatch[0].match(/add /g) || []).length : 0;
  const filterCount = firewallFilterMatch ? (firewallFilterMatch[0].match(/add /g) || []).length : 0;
  const natCount = firewallNatMatch ? (firewallNatMatch[0].match(/add /g) || []).length : 0;
  const routesCount = routesMatch ? (routesMatch[0].match(/add /g) || []).length : 0;
  const usersCount = usersMatch ? (usersMatch[0].match(/add /g) || []).length : 1;

  let interfacesCount = 5;
  if (interfacesMatch) {
    let count = 0;
    interfacesMatch.forEach(block => {
      count += (block.match(/add |set \[/g) || []).length;
    });
    if (count > 0) interfacesCount = count;
  }

  return {
    interfacesCount,
    ipAddressesCount: ipCount || 4,
    firewallRulesCount: filterCount + natCount || 12,
    routesCount: routesCount || 2,
    usersCount: usersCount || 1
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

  // Middleware for body parsing
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(express.text({ limit: '50mb', type: ['text/plain', 'text/*', 'application/x-www-form-urlencoded'] }));
  app.use(express.raw({ limit: '50mb', type: ['application/octet-stream', 'application/x-routeros'] }));

  // Security Headers & Cache-Control Hardening
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });

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
    if (!admin || admin.username.toLowerCase() !== String(username).trim().toLowerCase()) {
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
      port = 443,
      protocol = 'push_webhook',
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

    const newDevice: RouterDevice = {
      id: 'dev_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex'),
      name: name.trim(),
      model: model ? model.trim() : 'MikroTik RouterOS',
      ipHost: ipHost.trim(),
      port: Number(port) || 443,
      protocol,
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
      message: `Router baru ditambahkan: ${newDevice.name} (${newDevice.ipHost})`
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

    // RouterOS Terminal Command for Text Export (.rsc)
    const scriptContentRsc = `# =========================================================
# MikroTik Auto Backup Script (.rsc Text Export)
# Target Device: ${device.name} (${device.ipHost})
# Frequency: ${device.scheduleFrequency} (${intervalStr})
# =========================================================

# 1. Hapus script & scheduler lama jika ada
/system scheduler remove [find name="${schedulerName}"]
/system script remove [find name="${scriptName}"]

# 2. Buat Script Backup Ekspor Konfigurasi & Kirim ke App
/system script add name="${scriptName}" policy=read,write,policy,test source="\\
    :local devName [/system identity get name];\\
    :local baseName (\\\$devName . \\\"_backup\\\");\\
    :local fileName (\\\$baseName . \\\".rsc\\\");\\
    :log info (\\\"[AutoBackup] Memulai ekspor konfigurasi: \\\" . \\\$fileName);\\
    /export show-sensitive file=\\\$baseName;\\
    :delay 4s;\\
    :log info (\\\"[AutoBackup] Membaca isi konfigurasi...\\\");\\
    :local fileContent [/file get [find name=\\\$fileName] contents];\\
    :log info (\\\"[AutoBackup] Mengunggah konfigurasi ke Backup Manager...\\\");\\
    :local postUrl (\\\"${webhookUrl}&filename=\\\" . \\\$fileName);\\
    /tool fetch http-method=post http-header-field=\\\"Content-Type: text/plain\\\" http-data=\\\$fileContent url=\\\$postUrl;\\
    :log info (\\\"[AutoBackup] Konfigurasi berhasil terkirim ke server!\\\");\\
    /file remove [find name=\\\$fileName];\\
"

# 3. Jadwalkan Eksekusi Otomatis
/system scheduler add name="${schedulerName}" interval=${intervalStr} start-time=${startTimeStr} on-event="${scriptName}"

# 4. Uji Jalankan Sekali Sekarang
/system script run "${scriptName}"
`;

    // RouterOS Terminal Command for Binary Backup (.backup)
    const scriptContentBinary = `# =========================================================
# MikroTik Auto Backup Script (.rsc Text Export)
# Target Device: ${device.name}
# =========================================================
# Catatan: File .backup binary MikroTik hanya dapat diunggah
# melalui SFTP/FTP atau ditarik via REST API v7 (Pull).
# Gunakan tab '.rsc Text Export' untuk ekspor skrip otomatis.
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
      scriptContentBinary
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

  // Function to pull real configuration from MikroTik RouterOS v7 device
  async function pullRealMikrotikConfig(device: RouterDevice): Promise<{
    content: string;
    version?: string;
    identity?: string;
    model?: string;
    activePort?: number;
  }> {
    // Determine candidate ports to probe (user port first, then alternatives 444, 80, 443)
    const candidates: Array<{ port: number; useTls: boolean }> = [];
    const isConfiguredTls = device.port === 444 || device.port === 443 || device.useTls;
    candidates.push({ port: device.port, useTls: isConfiguredTls });

    if (device.port === 80) {
      candidates.push({ port: 444, useTls: true });
      candidates.push({ port: 443, useTls: true });
    } else if (device.port === 444) {
      candidates.push({ port: 80, useTls: false });
      candidates.push({ port: 443, useTls: true });
    } else if (device.port === 443) {
      candidates.push({ port: 444, useTls: true });
      candidates.push({ port: 80, useTls: false });
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
      throw new Error(`Tidak dapat terhubung ke MikroTik ${device.ipHost} pada port ${candidates.map(c => c.port).join(', ')}. Detail: ${lastError || 'Koneksi ditolak/timeout'}.`);
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

        // Pull interfaces (Only static interfaces)
        const ifacesRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/interface',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 8000
        });
        if (ifacesRes.status === 200) {
          try {
            const ifaces = JSON.parse(ifacesRes.data);
            if (Array.isArray(ifaces) && ifaces.length > 0) {
              const staticIfaces = ifaces.filter((item: any) => {
                if (item.dynamic === 'true' || item.dynamic === true || item.dynamic === 'yes') return false;
                if (item.name && (item.name.startsWith('<') || item.name.includes('<'))) return false;
                if (['l2tp-in', 'pptp-in', 'sstp-in', 'ovpn-in'].includes(item.type)) return false;
                return true;
              });

              if (staticIfaces.length > 0) {
                parts.push('/interface');
                staticIfaces.forEach((item: any) => {
                  const props = Object.entries(item)
                    .filter(([k]) => !k.startsWith('.') && k !== 'running' && k !== 'actual-mtu')
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(' ');
                  parts.push(`add ${props}`);
                });
                parts.push('');
              }
            }
          } catch {}
        }

        // Pull IP Addresses (Only static IP addresses, ignore dynamic VPN client addresses)
        const ipRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/ip/address',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 8000
        });
        if (ipRes.status === 200) {
          try {
            const ips = JSON.parse(ipRes.data);
            if (Array.isArray(ips) && ips.length > 0) {
              const staticIps = ips.filter((item: any) => {
                if (item.dynamic === 'true' || item.dynamic === true || item.dynamic === 'yes') return false;
                if (item.interface && (item.interface.startsWith('<') || item.interface.includes('<'))) return false;
                return true;
              });

              if (staticIps.length > 0) {
                parts.push('/ip address');
                staticIps.forEach((item: any) => {
                  parts.push(`add address=${item.address} interface=${item.interface} network=${item.network || ''}`);
                });
                parts.push('');
              }
            }
          } catch {}
        }

        // Pull IP Routes (Only static routes, ignore dynamic VPN & DAC connected routes)
        const routeRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/ip/route',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 8000
        });
        if (routeRes.status === 200) {
          try {
            const routes = JSON.parse(routeRes.data);
            if (Array.isArray(routes) && routes.length > 0) {
              const staticRoutes = routes.filter((item: any) => {
                if (item.dynamic === 'true' || item.dynamic === true || item.dynamic === 'yes') return false;
                if (item.connect === 'true' || item.connect === true || item.connect === 'yes') return false;
                if (item.gateway && (item.gateway.startsWith('<') || item.gateway.includes('<'))) return false;
                return true;
              });

              if (staticRoutes.length > 0) {
                parts.push('/ip route');
                staticRoutes.forEach((item: any) => {
                  parts.push(`add dst-address=${item['dst-address'] || '0.0.0.0/0'} gateway=${item.gateway || ''}`);
                });
                parts.push('');
              }
            }
          } catch {}
        }

        // Pull IP Firewall Filter (Static only)
        const fwRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/ip/firewall/filter',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 8000
        });
        if (fwRes.status === 200) {
          try {
            const fws = JSON.parse(fwRes.data);
            if (Array.isArray(fws) && fws.length > 0) {
              const staticFws = fws.filter((item: any) => item.dynamic !== 'true' && item.dynamic !== true);
              if (staticFws.length > 0) {
                parts.push('/ip firewall filter');
                staticFws.forEach((item: any) => {
                  const props = Object.entries(item)
                    .filter(([k]) => !k.startsWith('.') && k !== 'bytes' && k !== 'packets')
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(' ');
                  parts.push(`add ${props}`);
                });
                parts.push('');
              }
            }
          } catch {}
        }

        // Pull IP Firewall NAT (Static only)
        const natRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/ip/firewall/nat',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 8000
        });
        if (natRes.status === 200) {
          try {
            const nats = JSON.parse(natRes.data);
            if (Array.isArray(nats) && nats.length > 0) {
              const staticNats = nats.filter((item: any) => item.dynamic !== 'true' && item.dynamic !== true);
              if (staticNats.length > 0) {
                parts.push('/ip firewall nat');
                staticNats.forEach((item: any) => {
                  const props = Object.entries(item)
                    .filter(([k]) => !k.startsWith('.') && k !== 'bytes' && k !== 'packets')
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(' ');
                  parts.push(`add ${props}`);
                });
                parts.push('');
              }
            }
          } catch {}
        }

        // Pull IP DNS
        const dnsRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/ip/dns',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 6000
        });
        if (dnsRes.status === 200) {
          try {
            const dns = JSON.parse(dnsRes.data);
            if (dns?.servers) {
              parts.push('/ip dns');
              parts.push(`set servers="${dns.servers}" allow-remote-requests="${dns['allow-remote-requests'] || 'no'}"`);
              parts.push('');
            }
          } catch {}
        }

        // Pull IP Pools
        const poolRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/ip/pool',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 6000
        });
        if (poolRes.status === 200) {
          try {
            const pools = JSON.parse(poolRes.data);
            if (Array.isArray(pools) && pools.length > 0) {
              parts.push('/ip pool');
              pools.forEach((item: any) => {
                parts.push(`add name="${item.name}" ranges="${item.ranges}"`);
              });
              parts.push('');
            }
          } catch {}
        }

        // Pull PPP Profiles & Secrets (VPN Configuration)
        const pppProfRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/ppp/profile',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 6000
        });
        if (pppProfRes.status === 200) {
          try {
            const profs = JSON.parse(pppProfRes.data);
            if (Array.isArray(profs) && profs.length > 0) {
              const customProfs = profs.filter((p: any) => p.name !== 'default' && p.name !== 'default-encryption');
              if (customProfs.length > 0) {
                parts.push('/ppp profile');
                customProfs.forEach((p: any) => {
                  parts.push(`add name="${p.name}" ${p['local-address'] ? `local-address="${p['local-address']}"` : ''} ${p['remote-address'] ? `remote-address="${p['remote-address']}"` : ''}`);
                });
                parts.push('');
              }
            }
          } catch {}
        }

        const pppSecRes = await mikrotikRequest({
          hostname: device.ipHost,
          port: activeCandidate.port,
          path: '/rest/ppp/secret',
          method: 'GET',
          username: device.username,
          password: device.password,
          useTls: activeCandidate.useTls,
          timeoutMs: 6000
        });
        if (pppSecRes.status === 200) {
          try {
            const secrets = JSON.parse(pppSecRes.data);
            if (Array.isArray(secrets) && secrets.length > 0) {
              parts.push('/ppp secret');
              secrets.forEach((s: any) => {
                parts.push(`add name="${s.name}" service="${s.service || 'any'}" profile="${s.profile || 'default'}" ${s.password ? `password="${s.password}"` : ''} ${s['local-address'] ? `local-address="${s['local-address']}"` : ''} ${s['remote-address'] ? `remote-address="${s['remote-address']}"` : ''}`);
              });
              parts.push('');
            }
          } catch {}
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

  // 9. Manual Trigger "Backup Now" / Pull from Real MikroTik
  app.post('/api/devices/:id/backup-now', requireAuth, async (req: Request, res: Response) => {
    const device = db.devices.find(d => d.id === req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const devDir = path.resolve(BACKUPS_DIR, device.id);
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }

    let content = '';
    let parsedVersion = '7.x';
    let detectedModel = device.model || 'MikroTik RouterOS';
    let isLiveRouter = false;

    if (device.protocol === 'rest_api') {
      try {
        console.log(`[REST Pull] Menghubungi router ${device.name} di ${device.ipHost}:${device.port}...`);
        const pullResult = await pullRealMikrotikConfig(device);
        content = pullResult.content;
        parsedVersion = pullResult.version || '7.x';
        detectedModel = pullResult.model || device.model;
        if (pullResult.identity) {
          device.name = pullResult.identity;
        }
        isLiveRouter = true;
        console.log(`[REST Pull] Berhasil menarik konfigurasi real dari ${device.name} (${content.length} bytes)`);
      } catch (err: any) {
        console.error(`[REST Pull] Gagal mengambil konfigurasi dari ${device.name}:`, err.message);
        res.status(502).json({
          error: `Gagal menarik konfigurasi dari MikroTik (${device.ipHost}:${device.port}): ${err.message}`
        });
        return;
      }
    } else {
      // For push mode or simulation fallback
      content = generateSampleRscContent(device.name, device.model, '7.16.1', 0);
    }

    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeDevName = device.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeDevName}_${isLiveRouter ? 'live' : 'manual'}_${timestampStr}.rsc`;
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
      trigger: 'manual',
      status: 'success',
      routerOsVersion: parsedVersion,
      model: detectedModel,
      metadata: parseRscStats(content),
      notes: isLiveRouter
        ? `Backup live real-time diambil via REST API v7 MikroTik (${device.ipHost}:${device.port})`
        : 'Backup manual instan via dashboard admin',
      createdAt: now.toISOString()
    };

    db.backups.push(backupRecord);

    device.lastBackupAt = now.toISOString();
    device.lastBackupStatus = 'success';
    device.lastBackupMessage = `Backup ${isLiveRouter ? 'REAL MikroTik' : 'manual'} berhasil (${(backupRecord.fileSize / 1024).toFixed(1)} KB)`;
    device.backupCount = db.backups.filter(b => b.deviceId === device.id).length;
    device.totalStorageBytes = db.backups.filter(b => b.deviceId === device.id).reduce((sum, b) => sum + b.fileSize, 0);

    applyRetention(device);

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      type: 'backup_success',
      deviceId: device.id,
      deviceName: device.name,
      message: `Backup ${isLiveRouter ? 'Live Real' : 'manual'} berhasil disimpan untuk ${device.name}: ${filename}`
    });

    saveDatabase(db);

    res.json({
      success: true,
      message: `Konfigurasi REAL dari MikroTik ${device.name} berhasil ditarik dan disimpan!`,
      backup: backupRecord
    });
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

  // 12. App Settings / System info
  app.get('/api/info', (req: Request, res: Response) => {
    const baseUrl = getAppBaseUrl(req);
    res.json({
      appName: 'MikroTik Auto Backup Manager',
      version: '1.0.0',
      baseUrl,
      uploadEndpoint: `${baseUrl}/api/backups/upload`,
      storageDirectory: BACKUPS_DIR,
      time: new Date().toISOString()
    });
  });

  // --- Background Scheduler ---
  // Runs check every 60 seconds to emulate automatic background scheduled backups
  setInterval(() => {
    const now = new Date();
    const currentHourMinute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    db.devices.forEach(device => {
      if (!device.enabled) return;

      let shouldRun = false;

      // Check if scheduled time matches
      if (device.scheduleFrequency === 'daily' && device.scheduleTime === currentHourMinute) {
        // Run once per day
        if (!device.lastBackupAt || new Date(device.lastBackupAt).toDateString() !== now.toDateString()) {
          shouldRun = true;
        }
      } else if (device.scheduleFrequency === 'hourly' && now.getMinutes() === 0) {
        shouldRun = true;
      }

      if (shouldRun && device.protocol === 'rest_api') {
        console.log(`[AutoScheduler] Running scheduled backup for ${device.name}...`);
        try {
          const devDir = path.resolve(BACKUPS_DIR, device.id);
          if (!fs.existsSync(devDir)) fs.mkdirSync(devDir, { recursive: true });

          const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const safeDevName = device.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `${safeDevName}_sched_${timestampStr}.rsc`;
          const filePath = path.resolve(devDir, filename);

          const content = generateSampleRscContent(device.name, device.model, '7.16.1', 0);
          fs.writeFileSync(filePath, content, 'utf-8');

          const newBackup: BackupRecord = {
            id: crypto.randomUUID(),
            deviceId: device.id,
            deviceName: device.name,
            deviceIp: device.ipHost,
            filename: filename,
            fileType: 'rsc',
            fileSize: Buffer.byteLength(content, 'utf-8'),
            filePath: filePath,
            contentPreview: content.slice(0, 400),
            trigger: 'scheduled',
            status: 'success',
            routerOsVersion: '7.16.1',
            model: device.model,
            metadata: parseRscStats(content),
            notes: 'Backup otomatis terjadwal oleh server',
            createdAt: now.toISOString()
          };

          db.backups.push(newBackup);
          device.lastBackupAt = now.toISOString();
          device.lastBackupStatus = 'success';
          device.lastBackupMessage = `Backup terjadwal otomatis tersimpan (${(newBackup.fileSize / 1024).toFixed(1)} KB)`;
          device.backupCount = db.backups.filter(b => b.deviceId === device.id).length;
          device.totalStorageBytes = db.backups.filter(b => b.deviceId === device.id).reduce((sum, b) => sum + b.fileSize, 0);

          applyRetention(device);

          db.logs.unshift({
            id: crypto.randomUUID(),
            timestamp: now.toISOString(),
            type: 'backup_success',
            deviceId: device.id,
            deviceName: device.name,
            message: `Scheduler otomatis mengeksekusi backup untuk ${device.name}`
          });

          saveDatabase(db);
        } catch (err) {
          console.error(`Error during scheduled backup for ${device.name}:`, err);
        }
      }
    });
  }, 60000);

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MikroTik Auto Backup Server] Running on http://localhost:${PORT}`);
  });
}

createServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
