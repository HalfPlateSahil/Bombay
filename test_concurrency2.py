import asyncio
import httpx

async def fetch_tile(z, x, y):
    url = f"http://localhost:8000/api/v1/floodmap/{z}/{x}/{y}?elev=4"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            if resp.status_code == 500:
                print(f"500 ERROR TEXT: {resp.text}")
    except Exception as e:
        pass

async def main():
    tasks = []
    for x in range(2870, 2890):
        for y in range(1820, 1840):
            tasks.append(fetch_tile(12, x, y))
    await asyncio.gather(*tasks)

asyncio.run(main())
