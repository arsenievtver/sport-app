#!/usr/bin/env python3
"""Create admin user: python scripts/create_admin.py 79106492742 123456 "Admin Name"."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.security import hash_pin, validate_phone, validate_pin
from app.models.enums import UserRole
from app.models.user import User


async def main() -> None:
    if len(sys.argv) != 4:
        print("Usage: create_admin.py <phone> <pin> <display_name>")
        sys.exit(1)

    phone = validate_phone(sys.argv[1])
    pin = validate_pin(sys.argv[2])
    display_name = sys.argv[3]

    async with async_session_factory() as session:
        existing = await session.execute(select(User).where(User.phone == phone))
        if existing.scalar_one_or_none():
            print(f"User with phone {phone} already exists")
            sys.exit(1)

        user = User(
            phone=phone,
            password_hash=hash_pin(pin),
            role=UserRole.admin,
        )
        session.add(user)
        await session.commit()
        print(f"Admin created: {phone}")


if __name__ == "__main__":
    asyncio.run(main())
