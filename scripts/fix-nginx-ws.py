#!/usr/bin/env python3
"""
Tulis ulang nginx location untuk WebSocket workspace.magsikastudio.com.
Pakai prefix location (bukan regex) agar lebih reliable untuk WS proxying.
"""
import re, subprocess, sys

CONF_PATH = "/etc/nginx/sites-enabled/admin-dashboard"

with open(CONF_PATH) as f:
    original = f.read()

print(f"=== Config sebelum perubahan ({CONF_PATH}) ===")
print(original)
print("=" * 60)

# ── Hapus regex WS block lama (kalau ada) ────────────────
# Block yang ditulis script sebelumnya: location ~ ^/api/(ws.*)$
new_conf = re.sub(
    r'\n\s*#.*?WebSocket.*?\n\s*location\s*~\s*\^/api/\(ws\.\*\)[^\{]*\{[^}]+\}\n?',
    '\n',
    original,
    flags=re.DOTALL,
)

# ── Juga bersihkan kalau formatnya sedikit beda ──────────
new_conf = re.sub(
    r'\n\s*location\s*~\s*\^/api/\(ws\.\*\)[^\{]*\{[^}]+\}\n?',
    '\n',
    new_conf,
    flags=re.DOTALL,
)

# ── Definisikan WS location baru (prefix, bukan regex) ───
WS_BLOCK = """\n    # WebSocket proxy — prefix location (reliable untuk WS)
    # Menangani /api/ws (notifikasi) DAN /api/ws/rtc (live stream)
    location /api/ws {
        proxy_pass http://127.0.0.1:8001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }\n"""

# ── Insert sebelum location /api/ ────────────────────────
if "/api/ws" in new_conf and "proxy_http_version" in new_conf:
    print("Location /api/ws prefix sudah ada dengan header yang benar.")
    # Pastikan tetap ada proxy_http_version
    print("Tidak perlu update.")
else:
    # Hapus /api/ws block lama kalau ada tapi tanpa proxy_http_version
    new_conf = re.sub(
        r'\n\s*location\s+/api/ws\s*\{[^}]+\}\n?',
        '\n',
        new_conf,
        flags=re.DOTALL,
    )

    # Insert sebelum location /api/
    inserted = re.sub(
        r'(\n[ \t]+location\s+/api/?\s*\{)',
        WS_BLOCK + r'\n\1',
        new_conf,
        count=1,
    )
    if inserted == new_conf:
        print("ERROR: Tidak bisa insert sebelum /api/ location!")
        print("Isi config saat ini:")
        print(new_conf)
        sys.exit(1)
    new_conf = inserted

print("\n=== Config setelah perubahan ===")
print(new_conf)
print("=" * 60)

# ── Tulis, test, reload ───────────────────────────────────
with open(CONF_PATH + ".bak", "w") as f:
    f.write(original)

with open(CONF_PATH, "w") as f:
    f.write(new_conf)

r = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
print("nginx -t:", r.stdout.strip())
print(r.stderr.strip())

if r.returncode != 0:
    print("ERROR: nginx test gagal! Mengembalikan backup...")
    with open(CONF_PATH, "w") as f:
        f.write(original)
    sys.exit(1)

subprocess.run(["systemctl", "reload", "nginx"])
print("\n✅ Nginx berhasil di-reload!")
print("WebSocket sekarang di-proxy via prefix location (bukan regex).")
print("Path: /api/ws → http://127.0.0.1:8001/ws")
print("Path: /api/ws/rtc → http://127.0.0.1:8001/ws/rtc")
