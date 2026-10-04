export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return (
      new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(d) + ' WIB'
    );
  } catch {
    return dateString;
  }
}

export function formatTimeOnly(dateString?: string | Date): string {
  if (!dateString) return '-';
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(d.getTime())) return '-';
    return (
      new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(d) + ' WIB'
    );
  } catch {
    return String(dateString);
  }
}

export function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Belum pernah';
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${Math.max(1, diffSec)} detik lalu`;
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDay < 30) return `${diffDay} hari lalu`;
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}

export function getFrequencyLabel(frequency: string, time?: string): string {
  switch (frequency) {
    case 'hourly':
      return 'Tiap 1 Jam';
    case '6hours':
      return 'Tiap 6 Jam';
    case 'daily':
      return `Harian (pkl. ${time || '02:00'} WIB)`;
    case 'weekly':
      return 'Mingguan (Tiap Senin)';
    case 'manual':
      return 'Manual Saja';
    default:
      return frequency;
  }
}
