"""Generate VAPID key pair for Web Push.

Usage:
  cd backend && .venv/bin/python scripts/generate_vapid_keys.py
"""

from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")
    private_oneline = private_pem.replace("\n", "\\n")

    public_raw = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    public_b64 = base64.urlsafe_b64encode(public_raw).decode("ascii").rstrip("=")

    print("# Add to backend/.env (and infra/prod/.env):")
    print(f"VAPID_PUBLIC_KEY={public_b64}")
    print(f'VAPID_PRIVATE_KEY="{private_oneline}"')
    print("VAPID_SUBJECT=mailto:admin@athlete-app.ru")


if __name__ == "__main__":
    main()
