# ZMT Spin Giveaway System

Sistem spin wheel giveaway berbasis web menggunakan HTML, CSS, Vanilla JS, dan Firebase Realtime Database.

## Struktur Folder

```
spinwheel/
  index.html     - Halaman utama (semua halaman dalam satu file)
  style.css      - Semua styling (tema biru modern, dark mode)
  script.js      - Semua logika aplikasi + Firebase
  README.md      - Dokumentasi ini
```

## Cara Menjalankan (Lokal)

1. Download atau clone semua file ke satu folder
2. Buka `index.html` langsung di browser Chrome/Firefox/Edge
   - Tidak butuh server khusus (koneksi internet diperlukan untuk Firebase)
3. Login sebagai user biasa atau admin/owner

## Cara Deploy

### Option 1: GitHub Pages (Gratis)
1. Upload semua file ke repositori GitHub
2. Pergi ke Settings > Pages > Source: main branch / root
3. Akses via `https://username.github.io/repo-name`

### Option 2: Netlify (Gratis, Mudah)
1. Buka [netlify.com](https://netlify.com)
2. Drag & drop folder `spinwheel/` ke dashboard Netlify
3. Otomatis live dengan domain Netlify

### Option 3: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Pilih project zmtspin, set public folder = .
firebase deploy
```

### Option 4: Vercel
```bash
npm install -g vercel
cd spinwheel
vercel
```

## Akun & Role System

| Role  | Cara Login | Key |
|-------|-----------|-----|
| User  | Username + Password (auto-register jika baru) | - |
| Admin | Username + Password + Admin Key | Key dari owner |
| Owner | Username + Password + Key | `zmtxxx` |

## Fitur Lengkap

- Login/Register otomatis user
- Admin/Owner login dengan key
- Spin Wheel animasi dengan Canvas
- Sound efek saat spin + menang
- Confetti animasi saat pemenang
- Global chat realtime (teks + gambar)
- Chat khusus pemenang
- Countdown event realtime
- Admin panel: kelola user, ban/unban/hapus
- Owner: tambah/hapus admin key
- Clear all database dengan satu tombol
- Responsive mobile
- Tema biru modern, dark background

## Firebase Rules (Opsional)

Untuk production, set Firebase Rules agar lebih aman:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> Catatan: Rules di atas terbuka untuk testing. Untuk production gunakan autentikasi Firebase.
