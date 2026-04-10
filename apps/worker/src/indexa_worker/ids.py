"""ID generators matching Prisma defaults."""

from __future__ import annotations

import uuid

from cuid2 import Cuid

_cuid = Cuid(length=25)


def new_cuid() -> str:
  return _cuid.generate()


def new_uuid() -> str:
  return str(uuid.uuid4())
