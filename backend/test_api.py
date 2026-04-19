import urllib.request
import json
import urllib.parse
import pymysql

try:
    conn = pymysql.connect(host='mysql', user='root', password='root123', db='elearning')
    with conn.cursor() as cur:
        cur.execute("SELECT email FROM users WHERE role='admin' LIMIT 1")
        admin_email = cur.fetchone()[0]
    
    login_data = urllib.parse.urlencode({'username': admin_email, 'password': 'admin123'}).encode('utf-8')
    login_req = urllib.request.Request('http://backend:8000/api/auth/login', data=login_data, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    resp = urllib.request.urlopen(login_req)
    token = json.loads(resp.read())['access_token']
    
    req = urllib.request.Request('http://backend:8000/api/admin/author-applications?page_size=50')
    req.add_header('Authorization', f'Bearer {token}')
    app_resp = urllib.request.urlopen(req)
    out = {"status": app_resp.status, "body": json.loads(app_resp.read().decode())}
    with open('/app/api_out.json', 'w') as f:
        json.dump(out, f)

except Exception as e:
    err = str(e)
    if hasattr(e, 'read'):
        err += e.read().decode()
    with open('/app/api_out.json', 'w') as f:
        json.dump({"error": err}, f)
