#!/usr/bin/env python3
"""
Tambahkan WebSocket support ke nginx config workspace.magsikastudio.com.
Dipanggil otomatis dari deploy.yml setiap deploy.
"""
import os, re, subprocess, sys

# ── Tampilkan status backend ──────────────────────────────
print("\n=== Backend service status ===")
r = subprocess.run(["systemctl", "is-active", "admin-dashboard"], capture_output=True, text=True)
print("State:", r.stdout.strip())

print("\n=== Backend recent logs (last 15 lines) ===")
r = subprocess.run(
    ["journalctl", "-u", "admin-dashboard", "--no-pager", "-n", "15"],
    capture_output=True, text=True,
)
print(r.stdout)

# ── List semua nginx config ───────────────────────────────
enabled_dir = "/etc/nginx/sites-enabled"
try:
    all_configs = [f for f in os.listdir(enabled_dir) if not f.startswith(".")]
except FileNotFoundError:
    print("ERROR: /etc/nginx/sites-enabled tidak ditemukan"); sys.exit(1)

print(f"\n=== Semua nginx configs di {enabled_dir} ===")
for c in sorted(all_configs):
    print(" -", c)

# ── Cari config yang punya workspace.magsikastudio.com ───
target_path = None
for conf_name in sorted(all_configs):
    conf_path = f"{enabled_dir}/{conf_name}"
    try:
        with open(conf_path) as f:
            content = f.read()
        if "workspace.magsikastudio.com" in content:
            target_path = conf_path
            print(f"\n✅ Ditemukan workspace config: {conf_path}")
            break
    except Exception:
        pass

# Fallback: cari config 'admin-dashboard' jika tidak ketemu dari server_name
if not target_path:
    for candidate in ["admin-dashboard", "workspace", "workspace.magsikastudio.com"]:
        p = f"{enabled_dir}/{candidate}"
        if os.path.exists(p):
            target_path = p
            print(f"\n⚠️  Tidak ada server_name match — pakai fallback: {target_path}")
            break

if not target_path:
    print("\nERROR: Tidak bisa menemukan nginx config untuk workspace.magsikastudio.com!")
    print("Config yang tersedia:", all_configs)
    sys.exit(1)

with open(target_path) as f:
    original = f.read()

print(f"\n=== Isi nginx config ({target_path}) ===")
print(original)
print("=" * 60)

# ── Cek apakah sudah ada WebSocket support di config ini ─
if "proxy_http_version" in original:
    print("\n✅ WebSocket support sudah ada di config ini.")

    # Tapi cek apakah /api/ws sudah punya location block sendiri
    if "/ws/rtc" not in original and "location ~ ^/api/(ws" not in original:
        print("⚠️  Tapi belum ada location khusus untuk /ws/rtc — menambahkan...")
        # Lanjut ke proses penambahan di bawah
    else:
        print("Location /ws/rtc sudah ada. Selesai.")
        sys.exit(0)

# ── Buat WebSocket location block ────────────────────────
ws_block = """
    # WebSocket proxy — ditambah otomatis oleh deploy script
    # Menangani /api/ws (notifikasi) dan /api/ws/rtc (stream)
    location ~ ^/api/(ws.*)$ {
        proxy_pass http://127.0.0.1:8001/$1$is_args$args;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }
"""

# ── Coba insert sebelum location /api/ ───────────────────
new_conf = re.sub(
    r'(\n[ \t]+location\s+/api[/ ])',
    ws_block + r'\n\1',
    original,
    count=1,
)

if new_conf == original:
    # Fallback: tambahkan WebSocket headers ke dalam location /api/ yang ada
    print("Tidak bisa insert block terpisah — menambahkan headers ke dalam /api/ block...")
    new_conf = re.sub(
        r'(proxy_pass\s+http://127\.0\.0\.1:\d+[^;]*;)',
        r'\1\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_read_timeout 3600;',
        original,
        count=1,
    )

if new_conf == original:
    print("ERROR: Tidak bisa menemukan lokasi yang tepat untuk menambahkan WebSocket support!")
    print("Tambahkan manual ke nginx config:")
    print('  proxy_http_version 1.1;')
    print('  proxy_set_header Upgrade $http_upgrade;')
    print('  proxy_set_header Connection "upgrade";')
    sys.exit(1)

# ── Tulis, test, reload ───────────────────────────────────
with open(target_path, "w") as f:
    f.write(new_conf)

result = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
print("\nNginx test:", result.stdout.strip(), result.stderr.strip())

if result.returncode != 0:
    print("ERROR: Nginx test gagal! Mengembalikan config lama...")
    with open(target_path, "w") as f:
        f.write(original)
    sys.exit(1)

subprocess.run(["systemctl", "reload", "nginx"])
print("\n✅ Nginx berhasil di-update dengan WebSocket support!")
print("WebSocket path yang sekarang didukung:")
print("  - wss://workspace.magsikastudio.com/api/ws      (notifikasi)")
print("  - wss://workspace.magsikastudio.com/api/ws/rtc  (live stream)")
