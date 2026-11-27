#!/bin/bash
# ========================================================
# Script Update Otomatis MikroTik Auto Backup Manager
# ========================================================

set -e

echo "========================================================"
echo "  Update MikroTik Auto Backup Manager (Source Code)     "
echo "========================================================"

# 1. Ambil perubahan terbaru dari GitHub
echo "[*] Mengambil update source code terbaru dari GitHub (git pull)..."
git pull origin main || git pull

# 2. Rebuild dan restart container Docker
echo "[*] Mem-build ulang image dan me-restart container Docker..."
if docker compose version &> /dev/null; then
    docker compose down
    docker compose up -d --build
else
    docker-compose down
    docker-compose up -d --build
fi

echo ""
echo "========================================================"
echo "  [✓] Sukses! Source code berhasil diupdate!           "
echo "========================================================"
echo "🔒 Aplikasi berjalan di 127.0.0.1:3003 (Anti-Shodan)"
echo "   Akses melalui Reverse Proxy / Cloudflare Tunnel / SSH Tunnel / VPN."
echo ""
echo "Catatan: Semua data backup & konfigurasi di ./data tetap aman."
echo "Untuk melihat log: docker logs -f mikrotik-backup-app"
echo "========================================================"
