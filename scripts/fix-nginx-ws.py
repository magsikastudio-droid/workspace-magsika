#!/usr/bin/env python3
"""
Pastikan nginx punya WebSocket support untuk path /api/ws*.
Dipanggil otomatis dari deploy.yml setiap deploy.
"""
import os, re, subprocess, sys

# ── Tampilkan status backend ──────────────────────────────
print("\n=== Backend service status ===")
r = subprocess.run(["systemctl", "is-active", "admin-dashboard"], capture_output=True, text=True)
print("State:", r.stdout.strip())

print("\n=== Backend recent logs (last 30 lines) ===")
r = subprocess.run(
    ["journalctl", "-u", "admin-dashboard", "--no-pager", "-n", "30"],
    capture_output=True, text=True,
)
print(r.stdout)

# ── Cari nginx config yang aktif ─────────────────────────
enabled_dir = "/etc/nginx/sites-enabled"
try:
    configs = [f for f in os.listdir(enabled_dir) if f != "default" and not f.startswith(".")]
except FileNotFoundError:
    print("ERROR: /etc/nginx/sites-enabled tidak ditemukan")
    sys.exit(1)

if not configs:
    print("ERROR: Tidak ada nginx site config selain default")
    sys.exit(1)

# Prefer domain-based config, fallback to first
conf_name = next((c for c in configs if "magsika" in c or "workspace" in c), configs[0])
conf_path = f"{enabled_dir}/{conf_name}"

with open(conf_path) as f:
    original = f.read()

print(f"\n=== Nginx config: {conf_path} ===")
print(original)
print("=" * 60)

# ── Cek apakah WebSocket header sudah ada ────────────────
if "proxy_http_version" in original:
    print("\n✅ WebSocket support sudah ada — tidak perlu update.")
    sys.exit(0)

print("\n⚠️  WebSocket headers belum ada — menambahkan sekarang...")

# ── Tambahkan WS location sebelum /api/ atau /api location ─
ws_block = '''
    # WebSocket proxy — ditambah otomatis oleh deploy script
    # Menangani /api/ws dan /api/ws/rtc dengan Upgrade headers
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
'''

# Coba insert sebelum location /api (dengan variasi whitespace)
new_conf = re.sub(
    r'(\n[ \t]+location\s+/api)',
    ws_block + r'\n\1',
    original,
    count=1,
)

if new_conf == original:
    # Fallback: tambahkan WebSocket header ke dalam location /api/ yang ada
    print("Tidak bisa insert block baru — menambahkan headers ke /api/ location...")
    new_conf = re.sub(
        r'(proxy_pass\s+http://127\.0\.0\.1:\d+[/;])',
        r'\1\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_read_timeout 3600;',
        original,
        count=1,
    )

if new_conf == original:
    print("ERROR: Tidak bisa menemukan location /api untuk dimodifikasi.")
    print("Silakan update nginx config manual dan tambahkan:")
    print("  proxy_http_version 1.1;")
    print("  proxy_set_header Upgrade $http_upgrade;")
    print("  proxy_set_header Connection \"upgrade\";")
    sys.exit(1)

# ── Tulis config baru dan test ───────────────────────────
with open(conf_path, "w") as f:
    f.write(new_conf)

result = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
print("Nginx test output:", result.stdout, result.stderr)

if result.returncode != 0:
    print("ERROR: Nginx test gagal! Mengembalikan config lama...")
    with open(conf_path, "w") as f:
        f.write(original)
    sys.exit(1)

subprocess.run(["systemctl", "reload", "nginx"])
print("\n✅ Nginx berhasil di-update dengan WebSocket support!")
print("Path yang sekarang didukung: /api/ws dan /api/ws/rtc")
