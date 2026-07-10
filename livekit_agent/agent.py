import os
import asyncio
import logging
from dotenv import load_dotenv

from livekit.agents import AutoSubscribe, JobContext, JobProcess, WorkerOptions, cli, llm, AgentSession
from livekit.agents.voice import Agent as VoicePipelineAgent
from livekit.plugins import cartesia, openai, silero
import aiohttp

async def get_working_cartesia_key() -> str:
    keys_str = os.environ.get("CARTESIA_API_KEYS", "")
    keys = [k.strip() for k in keys_str.split(",") if k.strip()]
    if not keys:
        return os.environ.get("CARTESIA_API_KEY", "")
    
    async with aiohttp.ClientSession() as session:
        for key in keys:
            try:
                headers = {"X-API-Key": key, "Cartesia-Version": "2024-06-10"}
                async with session.get("https://api.cartesia.ai/voices", headers=headers) as resp:
                    if resp.status == 200:
                        logging.info(f"Using Cartesia key: {key[:12]}...")
                        return key
                    else:
                        logging.warning(f"Cartesia key {key[:12]}... failed with status {resp.status}")
            except Exception as e:
                logging.warning(f"Error checking Cartesia key {key[:12]}... : {e}")
    
    return keys[0] if keys else ""

load_dotenv()
logging.basicConfig(level=logging.INFO)

async def entrypoint(ctx: JobContext):
    # Use Silero for Voice Activity Detection
    vad = silero.VAD.load()

    # Use Cartesia TTS for ultra-fast, realistic cloud voices
    # Automatically rotate and check API keys
    cartesia_key = await get_working_cartesia_key()
    tts = cartesia.TTS(api_key=cartesia_key)

    # Use OpenAI plugin for LLM (You can point this to NVIDIA NIM by setting OPENAI_BASE_URL)
    # Default is OpenAI if OPENAI_BASE_URL is not set
    # Ensure you have OPENAI_API_KEY set in your .env
    llm_instance = openai.LLM(model="meta/llama-3.1-70b-instruct")

    instructions = (
        "You are a friendly and professional AI interviewer. "
        "You are conducting a job interview with a candidate. "
        "Keep your responses concise and conversational."
    )

    agent = VoicePipelineAgent(
        instructions=instructions,
        stt=openai.STT(), # Using OpenAI Whisper for Speech-to-Text (can be swapped)
        llm=llm_instance,
        tts=tts,
    )

    logger = logging.getLogger("livekit.agents")
    logger.info(f"connecting to room {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = AgentSession(vad=vad)
    
    await session.start(
        room=ctx.room,
        agent=agent,
    )
    
    await asyncio.sleep(1)
    await session.say("Hello! I am your AI interviewer. Shall we begin the interview?", allow_interruptions=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8081))
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        port=port
    ))
