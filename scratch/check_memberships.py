import psycopg2

db_url = "postgresql://neondb_owner:npg_Papo5FOfeDx3@ep-ancient-night-aojl1cz9-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT id, user_id, company_id, role, status FROM organization_memberships;")
    rows = cur.fetchall()
    print(f"Total Organization Memberships: {len(rows)}")
    for r in rows:
        print(f"ID: {r[0]}, UserID: {r[1]}, CompanyID: {r[2]}, Role: {r[3]}, Status: {r[4]}")
    cur.close()
    conn.close()
except Exception as e:
    print("Error checking memberships:", e)
