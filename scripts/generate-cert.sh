#!/bin/bash
# Generate a self-signed TLS certificate for local HTTPS

CERT_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/server.key" ] && [ -f "$CERT_DIR/server.cert" ]; then
  echo "Certificates already exist in $CERT_DIR. Delete them to regenerate."
  exit 0
fi

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.cert" \
  -days 365 \
  -subj "/CN=cvpolisher/O=Local/C=GB" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Self-signed certificate generated in $CERT_DIR"
