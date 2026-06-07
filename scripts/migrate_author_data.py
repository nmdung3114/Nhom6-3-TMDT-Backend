import os
import sys

# Get absolute path to backend directory
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(os.path.dirname(current_dir), "backend")
sys.path.insert(0, backend_dir)

from sqlalchemy import text # type: ignore
from app.database import engine # type: ignore

def migrate():
    print("Connecting to database...")
    with engine.connect() as conn:
        print("Adding author_application_data column to users table...")
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN author_application_data TEXT NULL;"))
            conn.commit()
            print("Successfully added author_application_data column.")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("Column 'author_application_data' already exists.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    migrate()
