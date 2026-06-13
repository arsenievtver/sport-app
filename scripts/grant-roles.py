#!/usr/bin/env python3
"""Grant coach and/or athlete role to an existing user (by phone).

Usage:
  python scripts/grant-roles.py 79106492742 "Иван" --coach
  python scripts/grant-roles.py 79106492742 "Иван" --coach --athlete
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.core.database import async_session_factory
from app.core.security import validate_phone
from app.models.enums import UserRole
from app.services.auth import AuthService


async def main() -> None:
    parser = argparse.ArgumentParser(description="Grant roles to user by phone")
    parser.add_argument("phone")
    parser.add_argument("display_name")
    parser.add_argument("--coach", action="store_true")
    parser.add_argument("--athlete", action="store_true")
    args = parser.parse_args()

    roles: list[UserRole] = []
    if args.coach:
        roles.append(UserRole.coach)
    if args.athlete:
        roles.append(UserRole.athlete)
    if not roles:
        print("Specify at least one of --coach or --athlete")
        sys.exit(1)

    phone = validate_phone(args.phone)
    display_name = args.display_name.strip()
    if not display_name:
        print("display_name is required")
        sys.exit(1)

    async with async_session_factory() as session:
        service = AuthService(session)
        user, added = await service.grant_roles(phone, roles, display_name)
        await session.commit()

        if not added:
            current = ", ".join(r.value for r in user.roles)
            print(f"User {phone} already has requested roles ({current})")
            sys.exit(0)

        added_names = ", ".join(r.value for r in added)
        all_roles = ", ".join(r.value for r in user.roles)
        print(f"Granted [{added_names}] → {phone} (now: {all_roles})")


if __name__ == "__main__":
    asyncio.run(main())
