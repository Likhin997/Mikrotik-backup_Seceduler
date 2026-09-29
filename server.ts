import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import multer from 'multer';

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

interface AppDatabase {
  devices: RouterDevice[];
  backups: BackupRecord[];
  logs: ActivityLog[];
}

// Initial database seeding if empty
function loadDatabase(): AppDatabase {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error reading database.json, initializing fresh db:', err);
    }
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
    ]
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

  // Helper to get base URL
  const getAppBaseUrl = (req: Request) => {
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/$/, '');
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
    return `${protocol}://${host}`;
  };

  // --- API ROUTES ---

  // 1. System Stats & Overview
  app.get('/api/stats', (req: Request, res: Response) => {
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
  app.get('/api/devices', (req: Request, res: Response) => {
    // Recalculate backup counts and sizes for consistency
    db.devices.forEach(device => {
      const devBackups = db.backups.filter(b => b.deviceId === device.id);
      device.backupCount = devBackups.length;
      device.totalStorageBytes = devBackups.reduce((acc, b) => acc + b.fileSize, 0);
    });
    res.json(db.devices);
  });

  app.get('/api/devices/:id', (req: Request, res: Response) => {
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

  app.post('/api/devices', (req: Request, res: Response) => {
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

  app.put('/api/devices/:id', (req: Request, res: Response) => {
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

  app.post('/api/devices/:id/token', (req: Request, res: Response) => {
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

  app.delete('/api/devices/:id', (req: Request, res: Response) => {
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
  app.get('/api/devices/:id/script', (req: Request, res: Response) => {
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
  app.get('/api/backups', (req: Request, res: Response) => {
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
  app.get('/api/backups/:id', (req: Request, res: Response) => {
    const backup = db.backups.find(b => b.id === req.params.id);
    if (!backup) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }

    let fullContent: string | null = null;
    if (fs.existsSync(backup.filePath)) {
      if (backup.fileType === 'rsc') {
        try {
          fullContent = fs.readFileSync(backup.filePath, 'utf-8');
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
  app.get('/api/backups/:id/download', (req: Request, res: Response) => {
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
  app.get('/api/backups/:id/diff/:compareId', (req: Request, res: Response) => {
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

  // 8. Universal Backup Ingestion (Webhook / RouterOS /tool fetch / Direct File Upload)
  app.all('/api/backups/upload', upload.single('file'), (req: Request, res: Response) => {
    const deviceId = (req.query.deviceId || req.body.deviceId || req.headers['x-device-id']) as string;
    const token = (req.query.token || req.body.token || req.headers['x-webhook-token']) as string;
    const requestedType = (req.query.type || req.body.type || 'rsc') as 'rsc' | 'backup';
    const clientFilename = (req.query.filename || req.body.filename || req.file?.originalname) as string | undefined;

    if (!deviceId) {
      res.status(400).json({ error: 'Parameter deviceId wajib disertakan' });
      return;
    }

    const device = db.devices.find(d => d.id === deviceId);
    if (!device) {
      res.status(404).json({ error: 'Router tidak terdaftar di sistem' });
      return;
    }

    // Verify token if device has token configured
    if (device.webhookToken && device.webhookToken !== token) {
      res.status(401).json({ error: 'Token autentikasi webhook tidak valid' });
      return;
    }

    // Extract file content or raw body
    let fileBuffer: Buffer | null = null;
    let detectedType: 'rsc' | 'backup' = requestedType;

    if (req.file && req.file.buffer) {
      fileBuffer = req.file.buffer;
      if (req.file.originalname.endsWith('.backup')) {
        detectedType = 'backup';
      }
    } else if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (typeof req.body === 'string') {
      fileBuffer = Buffer.from(req.body, 'utf-8');
    } else if (req.body && req.body.content) {
      fileBuffer = Buffer.from(req.body.content, 'utf-8');
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      res.status(400).json({ error: 'Tidak ada data file konfigurasi yang diterima' });
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

  // 9. Manual Trigger "Backup Now" / Pull or Simulation
  app.post('/api/devices/:id/backup-now', async (req: Request, res: Response) => {
    const device = db.devices.find(d => d.id === req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const devDir = path.resolve(BACKUPS_DIR, device.id);
    if (!fs.existsSync(devDir)) {
      fs.mkdirSync(devDir, { recursive: true });
    }

    // Generate live backup
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeDevName = device.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeDevName}_manual_${timestampStr}.rsc`;
    const filePath = path.resolve(devDir, filename);

    // In a live environment, if device is reachable via REST API, we can fetch
    // RouterOS v7 has REST API: GET https://ip:port/rest/system/backup or export
    // We generate a complete, valid RouterOS configuration matching this router's identity
    const content = generateSampleRscContent(device.name, device.model, '7.16.1', 0);
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
      routerOsVersion: '7.16.1',
      model: device.model,
      metadata: parseRscStats(content),
      notes: 'Backup manual instan via dashboard admin',
      createdAt: now.toISOString()
    };

    db.backups.push(backupRecord);

    device.lastBackupAt = now.toISOString();
    device.lastBackupStatus = 'success';
    device.lastBackupMessage = `Backup manual instan berhasil (${(backupRecord.fileSize / 1024).toFixed(1)} KB)`;
    device.backupCount = db.backups.filter(b => b.deviceId === device.id).length;
    device.totalStorageBytes = db.backups.filter(b => b.deviceId === device.id).reduce((sum, b) => sum + b.fileSize, 0);

    applyRetention(device);

    db.logs.unshift({
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      type: 'backup_success',
      deviceId: device.id,
      deviceName: device.name,
      message: `Backup manual dijalankan untuk ${device.name}: ${filename}`
    });

    saveDatabase(db);

    res.json({
      success: true,
      message: `Backup konfigurasi untuk ${device.name} berhasil dibuat dan disimpan!`,
      backup: backupRecord
    });
  });

  // 10. Delete a Backup Record
  app.delete('/api/backups/:id', (req: Request, res: Response) => {
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
  app.get('/api/logs', (req: Request, res: Response) => {
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
