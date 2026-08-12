"""Generate VAPID key pair for Web Push.

Usage:
  cd backend && .venv/bin/python scripts/generate_vapid_keys.py

Outputs docker-friendly single-line keys for infra/prod/.env.
"""

from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    # Raw 32-byte private key — preferred by pywebpush Vapid.from_string
    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
    private_b64 = base64.urlsafe_b64encode(private_raw).decode("ascii").rstrip("=")

    public_raw = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    public_b64 = base64.urlsafe_b64encode(public_raw).decode("ascii").rstrip("=")

    print("# Add to /opt/sport-app/infra/prod/.env (single-line values, no quotes needed):")
    print(f"VAPID_PUBLIC_KEY={public_b64}")
    print(f"VAPID_PRIVATE_KEY={private_b64}")
    print("VAPID_SUBJECT=mailto:admin@athlete-app.ru")
    print()
    print("# After changing keys: restart api+worker, then re-enable notifications in athlete PWA.")


if __name__ == "__main__":
    main()
