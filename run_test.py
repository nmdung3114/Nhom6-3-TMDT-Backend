import subprocess

try:
    print("Testing API from inside Docker via Python:")
    cmd = """
import urllib.request, json
try:
    req = urllib.request.Request('http://backend:8000/api/admin/author-applications?page_size=50')
    import pymysql
    conn = pymysql.connect(host='mysql', user='root', password='root123', db='elearning')
    with conn.cursor() as cur: cur.execute("SELECT email FROM users WHERE role='admin' LIMIT 1")
    admin_email = cur.fetchone()[0]
    # Correct login POST format: It's form-urlencoded, the error 422 meant we needed to properly encode the body
    import urllib.parse
    login_data = urllib.parse.urlencode({'username': admin_email, 'password': 'admin123'}).encode('utf-8')
    login_req = urllib.request.Request('http://backend:8000/api/auth/login', data=login_data, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    token = json.loads(urllib.request.urlopen(login_req).read())['access_token']
    
    req.add_header('Authorization', f'Bearer {token}')
    print(urllib.request.urlopen(req).read().decode())
except Exception as e:
    print("ERROR:", e)
"""
    result = subprocess.run(['docker', 'exec', 'elearning_backend', 'python', '-c', cmd], capture_output=True, text=True, encoding='utf-8')
    print("STDOUT:")
    print(result.stdout)
    print("STDERR:")
    print(result.stderr)
except Exception as e:
    print(e)
