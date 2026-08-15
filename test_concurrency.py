import asyncio
import httpx

async def fetch_tile(z, x, y):
    url = f"http://localhost:8000/api/v1/floodmap/{z}/{x}/{y}?elev=4"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            print(f"{x}/{y} - Status: {resp.status_code}")
    except Exception as e:
        print(f"{x}/{y} - Error: {e}")

async def main():
    tasks = []
    for x in range(2870, 2880):
        for y in range(1820, 1830):
            tasks.append(fetch_tile(12, x, y))
    await asyncio.gather(*tasks)

asyncio.run(main())
