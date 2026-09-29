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

# 3. Dapatkan IP host
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "========================================================"
echo "  [✓] Sukses! Source code berhasil diupdate!           "
echo "========================================================"
echo "Akses dashboard di browser:"
echo "👉 http://${LOCAL_IP}:3003 atau http://localhost:3003"
echo ""
echo "Catatan: Semua data backup & konfigurasi di ./data tetap aman."
echo "Untuk melihat log: docker logs -f mikrotik-backup-app"
echo "========================================================"
