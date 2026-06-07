"""Migration: Add accessed_at column to user_access table"""
import sys
sys.path.insert(0, '/app')

from app.database import engine
from sqlalchemy import text, inspect

insp = inspect(engine)
cols = [c['name'] for c in insp.get_columns('user_access')]

if 'accessed_at' not in cols:
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE user_access ADD COLUMN accessed_at TIMESTAMP NULL DEFAULT NULL'))
        conn.commit()
    print('✅ Column accessed_at added successfully')
else:
    print('ℹ️  Column accessed_at already exists, skipping')
