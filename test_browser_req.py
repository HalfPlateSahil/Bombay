import httpx

headers = {
    "Origin": "http://localhost:3000",
    "Referer": "http://localhost:3000/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
}
url = "http://localhost:8000/api/v1/floodmap/12/2876/1826?elev=4"
with httpx.Client() as client:
    resp = client.get(url, headers=headers)
    print("Status:", resp.status_code)
    if resp.status_code == 500:
        print(resp.text)
