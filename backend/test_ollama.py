import asyncio
import os
from ollama import AsyncClient

async def test():
    client = AsyncClient(
        host='https://ollama.com',
        headers={'Authorization': 'Bearer 5efc471b722143dc873d016ab3ad2b1f.MhFcGC4SUoUPyBW431fImdwS'}
    )
    print('Sending request...')
    try:
        res = await client.chat(
            model='kimi-k2.6:cloud',
            messages=[{'role': 'user', 'content': 'Hello! Can you write a small <h1>Hello</h1> HTML?'}]
        )
        print(res['message']['content'])
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test())
