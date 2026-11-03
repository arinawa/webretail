# YanzahNet Billing + Duitku callback starter

Domain: https://yanzahnet.vercel.app
Callback: https://yanzahnet.vercel.app/api/duitku/callback

## Isi paket
- Website statis asli (`index.html`) tetap dipertahankan.
- MySQL schema awal di `database/schema.sql`.
- Vercel Node.js callback di `api/duitku/callback.js`.
- MySQL pool di `api/_lib/db.js`.
- Environment template di `.env.example`.

## 1. Buat database MySQL
Gunakan MySQL 8.0+ dari provider yang dapat diakses dari Vercel (misalnya layanan managed MySQL). Buat database dan user khusus aplikasi dengan hak minimum. Jalankan isi `database/schema.sql` melalui phpMyAdmin, MySQL Workbench, atau CLI.

## 2. Deploy ke Vercel
Import/redeploy folder proyek ini ke project Vercel yang sama. Framework preset: Other. Build command kosong. Output directory kosong/default. Vercel akan mendeteksi fungsi di folder `api/`.

## 3. Environment Variables di Vercel
Tambahkan semua variable dari `.env.example` di Project Settings > Environment Variables. `DB_SSL=true` hanya jika provider MySQL menyediakan TLS yang valid. Isi host/user/password/database dari provider MySQL. Jangan commit `.env` atau API key.

## 4. Duitku
Gunakan credential merchant dari dashboard Duitku. Mulai di sandbox bila akun menyediakan sandbox, lalu pindah ke production setelah pengujian. Daftarkan callback URL persis:
`https://yanzahnet.vercel.app/api/duitku/callback`

Kode callback memakai HMAC-SHA256, memverifikasi ulang status transaksi ke endpoint transactionStatus Duitku, mencocokkan order ID dan nominal dengan record lokal, memakai transaksi SQL + row lock, dan idempotent untuk callback berulang.

## PENTING - belum siap menerima pembayaran pelanggan
Website sumber awal adalah website statis tanpa login pelanggan/admin. Paket ini menyiapkan schema MySQL dan callback, tetapi belum menyediakan API pembuatan invoice/payment atau autentikasi pelanggan/admin. Jangan mengaktifkan tombol pembayaran publik atau menganggap sistem billing sudah operasional sebelum alur tersebut dibuat. Callback hanya akan menerima order yang sudah tercatat di tabel `payments` dengan status PENDING.

## Struktur record yang dibutuhkan callback
`payments`: invoice_id, merchant_order_id, amount, status='PENDING'.
`invoices`: customer_id, status, due_date, amount.
`customers`: is_isolated, updated_at.

## Uji sebelum production
1. Buat satu customer dan invoice uji secara manual di database.
2. Buat payment PENDING dengan merchant_order_id unik dan amount sama dengan invoice.
3. Jalankan pembayaran sandbox Duitku.
4. Pastikan callback diterima dan status berubah menjadi PAID satu kali.
5. Kirim ulang callback dan pastikan tidak ada pembayaran ganda.
6. Uji nominal salah, signature salah, order tidak dikenal, transaksi gagal, dan tunggakan lain yang masih jatuh tempo.

Jangan menyimpan data kartu, API key, atau password database di frontend.
