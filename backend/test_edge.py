import asyncio, edge_tts
async def test():
  async for c in edge_tts.Communicate(" Hello\, \en-US-ChristopherNeural\).stream(): print(c[\type\])
asyncio.run(test())
