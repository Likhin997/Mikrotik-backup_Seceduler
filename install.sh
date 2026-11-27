#!/bin/bash
# ========================================================
# Script Instalasi Cepat MikroTik Auto Backup Manager
# ========================================================

set -e

echo "========================================================"
echo "  Instalasi MikroTik Auto Backup Manager via Docker    "
echo "========================================================"

# Pastikan Docker terinstall
if ! command -v docker &> /dev/null; then
    echo "[!] Docker tidak ditemukan. Menginstall Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm -f get-docker.sh
    echo "[✓] Docker berhasil diinstall."
fi

# Pastikan Docker Compose tersedia
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "[!] Docker Compose plugin tidak ditemukan. Menginstall compose plugin..."
    apt-get update && apt-get install -y docker-compose-plugin || true
fi

# Buat direktori data untuk volume persistent dengan izin ketat (bukan 777)
echo "[*] Menyiapkan folder penyimpanan data ./data..."
mkdir -p data/backups
chown -R 1000:1000 data 2>/dev/null || true
chmod -R 750 data 2>/dev/null || chmod -R 770 data

# Build dan jalankan container
echo "[*] Memulai build image Docker dan menjalankan service..."
if docker compose version &> /dev/null; then
    docker compose down || true
    docker compose up -d --build
else
    docker-compose down || true
    docker-compose up -d --build
fi

echo ""
echo "========================================================"
echo "  [✓] Sukses! Aplikasi Berjalan dalam Mode AMAN!        "
echo "========================================================"
echo "🔒 Port di-bind HANYA ke 127.0.0.1:3003 (Anti-Shodan)"
echo "   Port TIDAK terekspos langsung ke internet publik!"
echo ""
echo "Cara akses dashboard secara aman:"
echo "  1. Lokal / Reverse Proxy (Nginx/Caddy) : http://127.0.0.1:3003"
echo "  2. SSH Tunnel dari laptop Anda         : ssh -L 3003:127.0.0.1:3003 user@IP_SERVER"
echo "  3. Cloudflare Tunnel (Zero Open Port)  : CLOUDFLARE_TUNNEL_TOKEN=... docker compose --profile tunnel up -d"
echo "  4. Tailscale/LAN saja (non-publik)     : BIND_IP=<IP_TAILSCALE_ATAU_LAN> docker compose up -d"
echo ""
echo "Untuk melihat log: docker logs -f mikrotik-backup-app"
echo "Untuk menghentikan: docker compose down"
echo "========================================================"
