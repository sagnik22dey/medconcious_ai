import requests
res = requests.get("http://localhost:8000/health-check/")

print(res.text)