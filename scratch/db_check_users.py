import urllib.parse
import psycopg2

db_url = "postgresql://neondb_owner:npg_Papo5FOfeDx3@ep-ancient-night-aojl1cz9-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT id, email, name, role, company_id, password FROM users;")
    rows = cur.fetchall()
    print(f"Total Users: {len(rows)}")
    for r in rows:
        print(f"ID: {r[0]}, Email: {r[1]}, Name: {r[2]}, Role: {r[3]}, CompanyID: {r[4]}, PassHashPrefix: {r[5][:20] if r[5] else 'NULL'}")
    cur.close()
    conn.close()
except Exception as e:
    print("Error connecting/querying DB:", e)
