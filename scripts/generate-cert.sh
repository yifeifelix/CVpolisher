#!/bin/bash
# Generate a self-signed TLS certificate for local HTTPS (including LAN access)

CERT_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/server.key" ] && [ -f "$CERT_DIR/server.cert" ]; then
  echo "Certificates already exist in $CERT_DIR. Delete them to regenerate."
  exit 0
fi

# Auto-detect LAN IPv4 addresses
SAN="DNS:localhost,IP:127.0.0.1"
if command -v hostname &>/dev/null && hostname -I &>/dev/null 2>&1; then
  for ip in $(hostname -I); do
    SAN="$SAN,IP:$ip"
  done
else
  # Windows / Git Bash: parse ipconfig output
  for ip in $(ipconfig 2>/dev/null | sed -n 's/.*IPv4[^:]*: *\([0-9.]*\)/\1/p'); do
    SAN="$SAN,IP:$ip"
  done
fi

echo "Generating cert with SAN: $SAN"

# MSYS_NO_PATHCONV prevents Git Bash from mangling /CN=... into a Windows path
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.cert" \
  -days 365 \
  -subj "/CN=cvpolisher/O=Local/C=GB" \
  -addext "subjectAltName=$SAN"

echo "Self-signed certificate generated in $CERT_DIR"
