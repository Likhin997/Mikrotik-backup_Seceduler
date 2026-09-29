# MikroTik Auto Backup Manager (Docker Guide)

Aplikasi otomatisasi backup konfigurasi MikroTik RouterOS (`.rsc` dan `.backup`) siap pakai dengan container Docker & Docker Compose.

---

## 🚀 Cara Install Siap Pakai (Quick Start)

### Metode 1: Menggunakan Script Otomatis (1 Langkah)
Jalankan perintah berikut di terminal server Linux (Ubuntu, Debian, CentOS, Rocky, dll.):

```bash
chmod +x install.sh
./install.sh
```

---

### Metode 2: Menggunakan Docker Compose (Manual)

#### 1. Jalankan Container
Pastikan Anda berada di direktori project, lalu jalankan:

```bash
docker compose up -d --build
```
*(atau `docker-compose up -d --build` untuk versi Docker lama)*

#### 2. Buka Aplikasi di Browser
Buka browser dan akses alamat IP server atau localhost:
```
http://IP_SERVER:3000
```
*(Contoh: `http://192.168.1.100:3000` atau `http://localhost:3000`)*

---

### Metode 3: Menggunakan Docker CLI Biasa (Tanpa Compose)

```bash
# 1. Build image docker
docker build -t mikrotik-backup-manager:latest .

# 2. Buat folder untuk penyimpanan file konfigurasi permanen
mkdir -p $(pwd)/data/backups

# 3. Jalankan container
docker run -d \
  --name mikrotik-backup-app \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  mikrotik-backup-manager:latest
```

---

## 📂 Lokasi Penyimpanan Data & Konfigurasi

Semua data tersimpan otomatis di host pada folder `./data`:
- `./data/database.json`: Daftar router, jadwal, dan riwayat backup
- `./data/backups/`: Folder fisik tempat semua file `.rsc` dan `.backup` tersimpan aman di server host. Data tidak akan hilang meskipun container di-restart atau di-update.

---

## 🛠️ Perintah Berguna (Maintenance)

| Tugas | Perintah |
|---|---|
| **Cek status container** | `docker ps -f name=mikrotik-backup-app` |
| **Lihat live log** | `docker logs -f mikrotik-backup-app` |
| **Restart aplikasi** | `docker compose restart` |
| **Stop aplikasi** | `docker compose down` |
| **Update aplikasi terbaru** | `docker compose up -d --build` |

---

## ⚙️ Cara Menghubungkan ke MikroTik RouterOS

1. Buka Web Dashboard di `http://IP_SERVER:3000`.
2. Klik tombol **Tambah Router** dan isi nama serta IP router MikroTik Anda.
3. Klik tombol **Skrip RouterOS** pada kartu router.
4. Salin skrip yang disediakan.
5. Buka **WinBox** -> buka **New Terminal** -> **Paste** skrip tersebut lalu tekan **Enter**.
6. Router Anda sekarang akan otomatis mengekspor konfigurasi dan mengunggahnya ke server Docker ini sesuai jadwal!
