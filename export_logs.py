import subprocess
try:
    result = subprocess.run(['docker', 'logs', '--tail', '200', 'elearning_backend'], capture_output=True, text=True, encoding='utf-8')
    with open('backend_logs.txt', 'w', encoding='utf-8') as f:
        f.write("STDOUT:\n")
        f.write(result.stdout)
        f.write("\nSTDERR:\n")
        f.write(result.stderr)
    print("Logs exported successfully.")
except Exception as e:
    print(f"Error: {e}")
