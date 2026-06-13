#!/usr/bin/env python3
"""Grant roles to a user by phone (create user or extend existing).

Usage:
  python scripts/create_admin.py 79106492742 123456 "Иван" --coach --athlete
  python scripts/create_admin.py 79106492742 123456 "Иван"   # re-run adds missing roles
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.core.database import async_session_factory
from app.core.security import validate_phone, validate_pin
from app.models.enums import UserRole
from app.services.auth import AuthService


async def main() -> None:
    parser = argparse.ArgumentParser(description="Create or extend admin user by phone")
    parser.add_argument("phone")
    parser.add_argument("pin")
    parser.add_argument("display_name")
    parser.add_argument("--coach", action="store_true", help="Also grant coach role + profile")
    parser.add_argument("--athlete", action="store_true", help="Also grant athlete role + profile")
    parser.add_argument(
        "--update-pin",
        action="store_true",
        help="Update PIN if user already exists",
    )
    args = parser.parse_args()

    phone = validate_phone(args.phone)
    pin = validate_pin(args.pin)
    display_name = args.display_name.strip()
    if not display_name:
        print("display_name is required")
        sys.exit(1)

    roles = [UserRole.admin]
    if args.coach:
        roles.append(UserRole.coach)
    if args.athlete:
        roles.append(UserRole.athlete)

    async with async_session_factory() as session:
        service = AuthService(session)
        user, added = await service.grant_roles(
            phone,
            roles,
            display_name,
            pin,
            update_pin=args.update_pin,
        )
        await session.commit()

        all_roles = ", ".join(r.value for r in user.roles)
        if added:
            added_names = ", ".join(r.value for r in added)
            print(f"Granted [{added_names}] → {phone} (now: {all_roles})")
        else:
            print(f"No changes: {phone} already has [{all_roles}]")


if __name__ == "__main__":
    asyncio.run(main())
