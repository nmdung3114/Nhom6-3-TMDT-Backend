from typing import TypeVar, Generic, List, Optional
from sqlalchemy.orm import Query

T = TypeVar("T")


def paginate(query: Query, page: int, page_size: int):
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total
