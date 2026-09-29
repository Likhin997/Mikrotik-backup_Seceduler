# MikroTik Auto Backup Manager (Docker & GitHub Guide)

Aplikasi otomatisasi backup konfigurasi MikroTik RouterOS (`.rsc` dan `.backup`) siap pakai dengan container Docker & Docker Compose pada port **3003**.

---

## 🐙 Cara Kirim (Push) File ke GitHub

Jika Anda ingin menyimpan kode sumber ini ke akun GitHub Anda:

### 1. Buat Repository Baru di GitHub
1. Buka [github.com/new](https://github.com/new).
2. Beri nama repository (contoh: `mikrotik-auto-backup`).
3. Pilih **Public** atau **Private**, lalu klik **Create repository** (jangan centang *Initialize with README* karena file sudah tersedia di proyek ini).

### 2. Upload / Push dari Terminal Komputer Anda
Buka terminal di folder project ini, lalu jalankan perintah berikut:

```bash
# 1. Inisialisasi Git lokal
git init

# 2. Tambahkan semua file (.gitignore otomatis mengamankan file backup & credential)
git add .

# 3. Buat commit pertama
git commit -m "feat: initial commit mikrotik auto backup manager"

# 4. Atur branch utama ke main
git branch -M main

# 5. Hubungkan ke repository GitHub Anda (ganti USERNAME dan NAMA_REPO dengan milik Anda)
git remote add origin https://github.com/USERNAME/NAMA_REPO.git

# 6. Kirim (push) file ke GitHub
git push -u origin main
```

---

## 🚀 Cara Install dari GitHub di Server / VPS Siap Pakai

Setelah repository berada di GitHub, Anda dapat menginstalnya di server/VPS Linux dengan 3 langkah cepat:

### Langkah 1: Clone Repository
```bash
git clone https://github.com/USERNAME/NAMA_REPO.git
cd NAMA_REPO
```

### Langkah 2: Jalankan Instalasi Otomatis
```bash
chmod +x install.sh
./install.sh
```
*Script ini otomatis menginstal Docker & Docker Compose (jika belum ada), membuat folder volume host persistent `./data`, mem-build image, dan menjalankan container pada port 3003.*

### Langkah 3: Buka Dashboard di Browser
Akses:
👉 **`http://IP_SERVER:3003`** atau **`http://localhost:3003`**

---

## 🐳 Cara Install Manual Menggunakan Docker Compose (Alternatif)

### 1. Jalankan Container
Pastikan Anda berada di direktori project, lalu jalankan:

```bash
docker compose up -d --build
```
*(atau `docker-compose up -d --build` untuk versi Docker lama)*

#### 2. Buka Aplikasi di Browser
Buka browser dan akses alamat IP server atau localhost:
```
http://IP_SERVER:3003
```
*(Contoh: `http://192.168.1.100:3003` atau `http://localhost:3003`)*

---

### Metode 3: Menggunakan Docker CLI Biasa (Tanpa Compose)

```bash
# 1. Build image docker
docker build -t mikrotik-backup-manager:latest .

# 2. Buat folder untuk penyimpanan file konfigurasi permanen
mkdir -p $(pwd)/data/backups

# 3. Jalankan container pada port 3003
docker run -d \
  --name mikrotik-backup-app \
  --restart unless-stopped \
  -p 3003:3000 \
  -v $(pwd)/data:/app/data \
  mikrotik-backup-manager:latest
```

---

## 📂 Lokasi Penyimpanan Data & Konfigurasi

Semua data tersimpan otomatis di host pada folder `./data`:
- `./data/database.json`: Daftar router, jadwal, dan riwayat backup
- `./data/backups/`: Folder fisik tempat semua file `.rsc` dan `.backup` tersimpan aman di server host. Data tidak akan hilang meskipun container di-restart atau di-update.

---

## 🔄 Cara Update Source Code (Aplikasi)

Jika ada pembaruan kode di GitHub atau perbaikan file:

### Cara 1: Menggunakan Script Otomatis (Rekomendasi)
Di dalam folder proyek di server, cukup jalankan:
```bash
chmod +x update.sh
./update.sh
```
*Script ini otomatis menarik update dari git (`git pull`), mem-build ulang image Docker, dan me-restart container. Semua data konfigurasi router dan file backup di `./data` tetap aman 100%.*

### Cara 2: Cara Manual
```bash
git pull origin main
docker compose up -d --build
```

---

## 🛠️ Perintah Berguna (Maintenance)

| Tugas | Perintah |
|---|---|
| **Update source code aplikasi** | `./update.sh` atau `git pull && docker compose up -d --build` |
| **Cek status container** | `docker ps -f name=mikrotik-backup-app` |
| **Lihat live log** | `docker logs -f mikrotik-backup-app` |
| **Restart aplikasi** | `docker compose restart` |
| **Stop aplikasi** | `docker compose down` |

---

## ⚙️ Cara Menghubungkan ke MikroTik RouterOS

1. Buka Web Dashboard di `http://IP_SERVER:3003`.
2. Klik tombol **Tambah Router** dan isi nama serta IP router MikroTik Anda.
3. Klik tombol **Skrip RouterOS** pada kartu router.
4. Salin skrip yang disediakan.
5. Buka **WinBox** -> buka **New Terminal** -> **Paste** skrip tersebut lalu tekan **Enter**.
6. Router Anda sekarang akan otomatis mengekspor konfigurasi dan mengunggahnya ke server Docker ini sesuai jadwal!
