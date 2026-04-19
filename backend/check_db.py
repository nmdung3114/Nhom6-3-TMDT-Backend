import sys
from sqlalchemy import text
from app.database import engine

def check():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SHOW COLUMNS FROM users;"))
            columns = [row[0] for row in result]
            print("Columns in users:")
            print("\n".join(columns))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
