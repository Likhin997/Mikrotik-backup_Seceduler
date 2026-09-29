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

# Buat direktori data untuk volume persistent
echo "[*] Menyiapkan folder penyimpanan data ./data..."
mkdir -p data/backups
chmod -R 777 data

# Build dan jalankan container
echo "[*] Memulai build image Docker dan menjalankan service..."
if docker compose version &> /dev/null; then
    docker compose down || true
    docker compose up -d --build
else
    docker-compose down || true
    docker-compose up -d --build
fi

# Dapatkan IP host lokal
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "========================================================"
echo "  [✓] Sukses! Aplikasi MikroTik Backup Berjalan!       "
echo "========================================================"
echo "Akses web dashboard di browser:"
echo "👉 http://${LOCAL_IP}:3000 atau http://localhost:3000"
echo ""
echo "Untuk melihat log: docker logs -f mikrotik-backup-app"
echo "Untuk menghentikan: docker compose down"
echo "========================================================"
