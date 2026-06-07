"""
Migration: Add instructor feature fields
- users.author_application_status
- products.rejection_reason
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.database import engine  # type: ignore
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        # Add author_application_status to users
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN author_application_status VARCHAR(20) NULL"))
            print("✅ Added users.author_application_status")
        except Exception as e:
            if "Duplicate column" in str(e) or "already exists" in str(e):
                print("⏭  users.author_application_status already exists")
            else:
                print(f"⚠️  {e}")

        # Add rejection_reason to products
        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN rejection_reason TEXT NULL"))
            print("✅ Added products.rejection_reason")
        except Exception as e:
            if "Duplicate column" in str(e) or "already exists" in str(e):
                print("⏭  products.rejection_reason already exists")
            else:
                print(f"⚠️  {e}")

        conn.commit()
        print("\n🎉 Migration hoàn tất!")

if __name__ == "__main__":
    run()
