#!/usr/bin/env python3
"""
Fix nginx WebSocket support untuk workspace.magsikastudio.com.
Pakai 'nginx -T' untuk dump seluruh config aktif → cari file yang benar.
"""
import os, re, subprocess, sys

# ── Dump SELURUH nginx config aktif ──────────────────────
print("\n=== nginx -T (full config dump) ===")
result = subprocess.run(["nginx", "-T"], capture_output=True, text=True)
full_dump = result.stdout + result.stderr
print(full_dump[:8000])   # Tampilkan 8000 karakter pertama

# ── Parse: cari file yang berisi workspace.magsikastudio.com ─
# nginx -T menampilkan: # configuration file /path/to/file:
# lalu isi file tersebut di bawahnya
target_file = None
current_file = None

for line in full_dump.splitlines():
    m = re.match(r'#\s*configuration file\s+(.+):', line)
    if m:
        current_file = m.group(1).strip()
    if "workspace.magsikastudio.com" in line and current_file:
        target_file = current_file
        print(f"\n✅ Config workspace ditemukan di: {target_file}")
        break

if not target_file:
    print("\n⚠️  Tidak ditemukan workspace.magsikastudio.com dalam nginx -T")
    print("Mencoba fallback ke file admin-dashboard / workspace...")
    for candidate in [
        "/etc/nginx/sites-enabled/admin-dashboard",
        "/etc/nginx/sites-available/admin-dashboard",
        "/etc/nginx/sites-enabled/workspace",
        "/etc/nginx/conf.d/workspace.conf",
    ]:
        if os.path.exists(candidate):
            target_file = candidate
            print(f"Fallback: {target_file}")
            break

    if not target_file:
        print("ERROR: Tidak bisa menemukan nginx config workspace!")
        print("Tulis config baru dari awal...")

        # Cari SSL cert path
        ssl_path = None
        for p in [
            "/etc/nginx/ssl/workspace.magsikastudio.com",
            "/etc/letsencrypt/live/workspace.magsikastudio.com",
            "/etc/ssl/workspace.magsikastudio.com",
        ]:
            if os.path.exists(p):
                ssl_path = p
                break

        if not ssl_path:
            print("ERROR: SSL cert untuk workspace.magsikastudio.com tidak ditemukan!")
            print("Cari manual di VPS: find /etc -name '*.pem' 2>/dev/null")
            sys.exit(1)

        print(f"SSL cert path: {ssl_path}")

        # Tulis config baru
        new_conf = f"""server {{
    listen 80;
    server_name workspace.magsikastudio.com;
    return 301 https://$host$request_uri;
}}

server {{
    listen 443 ssl;
    server_name workspace.magsikastudio.com;

    ssl_certificate {ssl_path}/fullchain.pem;
    ssl_certificate_key {ssl_path}/privkey.pem;

    root /root/admin-dashboard/frontend/dist;
    index index.html;

    # WebSocket proxy (notifikasi + live stream)
    location ~ ^/api/(ws.*)$ {{
        proxy_pass http://127.0.0.1:8001/$1$is_args$args;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }}

    location /api/ {{
        proxy_pass http://127.0.0.1:8001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }}

    location / {{
        try_files $uri $uri/ /index.html;
    }}
}}
"""
        target_file = "/etc/nginx/sites-available/workspace-magsika"
        with open(target_file, "w") as f:
            f.write(new_conf)

        link = "/etc/nginx/sites-enabled/workspace-magsika"
        if not os.path.exists(link):
            os.symlink(target_file, link)

        print(f"Config baru ditulis ke: {target_file}")

# ── Baca file target ──────────────────────────────────────
with open(target_file) as f:
    original = f.read()

print(f"\n=== Isi {target_file} ===")
print(original)
print("=" * 60)

# ── Cek apakah WebSocket sudah ada ───────────────────────
if "proxy_http_version" in original:
    print("\n✅ WebSocket support sudah ada di config ini. Selesai.")
    sys.exit(0)

print("\n⚠️  WebSocket headers belum ada — menambahkan...")

# ── Tambahkan WebSocket location block ───────────────────
ws_block = """\n    # WebSocket proxy (notifikasi + live stream)
    location ~ ^/api/(ws.*)$ {
        proxy_pass http://127.0.0.1:8001/$1$is_args$args;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }\n"""

# Insert sebelum 'location /api/'
new_conf = re.sub(
    r'(\n[ \t]+location\s+/api[/ ])',
    ws_block + r'\n\1',
    original,
    count=1,
)

if new_conf == original:
    # Fallback: inject headers langsung ke dalam proxy_pass block
    print("Tidak bisa insert block terpisah, inject headers ke proxy_pass block...")
    new_conf = re.sub(
        r'(proxy_pass\s+http://127\.0\.0\.1:\d+[^;]*;)',
        r'\1\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_read_timeout 3600;',
        original,
        count=1,
    )

if new_conf == original:
    print("ERROR: Tidak bisa patch config! Lihat isi file di atas dan update manual.")
    sys.exit(1)

# ── Tulis, test, reload ───────────────────────────────────
backup = target_file + ".bak"
with open(backup, "w") as f:
    f.write(original)
print(f"Backup disimpan: {backup}")

with open(target_file, "w") as f:
    f.write(new_conf)

print("\nConfig baru:")
print(new_conf)

r = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
print("nginx -t:", r.stdout.strip(), r.stderr.strip())

if r.returncode != 0:
    print("ERROR: Nginx test gagal! Mengembalikan backup...")
    with open(target_file, "w") as f:
        f.write(original)
    sys.exit(1)

subprocess.run(["systemctl", "reload", "nginx"])
print("\n✅ BERHASIL! Nginx di-reload dengan WebSocket support.")
print("Test: wss://workspace.magsikastudio.com/api/ws")
print("Test: wss://workspace.magsikastudio.com/api/ws/rtc")
