import os
import asyncio
import logging
from dotenv import load_dotenv

from livekit.agents import AutoSubscribe, JobContext, JobProcess, WorkerOptions, cli, llm, AgentSession
from livekit.agents.voice import Agent as VoicePipelineAgent
from livekit.plugins import cartesia, openai, silero, deepgram
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

    room_name = ctx.room.name
    theme = "HR"
    if "-Technical" in room_name:
        theme = "Technical"
    elif "-Behavioral" in room_name:
        theme = "Behavioral"

    # Define voices and instructions based on theme
    if theme == "Technical":
        voice_id = "694f9389-aac1-45b6-b726-9d9369183238" # Deep Male
        instructions = (
            "You are a strict and highly technical engineering interviewer. "
            "You are conducting a technical interview with a candidate. "
            "Ask challenging technical questions, evaluate their problem-solving skills, and be direct. "
            "Keep your responses concise."
        )
    elif theme == "Behavioral":
        voice_id = "79a125e8-cd45-4c13-8a67-188112f4dd22" # Professional British
        instructions = (
            "You are a professional behavioral interviewer evaluating leadership and cultural fit. "
            "Ask situational questions like 'Tell me about a time when...' and dig deep into their reasoning. "
            "Keep your responses concise and analytical."
        )
    else: # HR
        voice_id = "a0e99841-438c-4a64-b679-ae501e7d6091" # Friendly Female
        instructions = (
            "You are a friendly and welcoming HR recruiter. "
            "You are conducting an initial phone screen with a candidate. "
            "Be enthusiastic, ask about their background, and make them feel comfortable. "
            "Keep your responses concise and conversational."
        )

    # Use Cartesia TTS for ultra-fast, realistic cloud voices
    # Automatically rotate and check API keys
    cartesia_key = await get_working_cartesia_key()
    tts = cartesia.TTS(api_key=cartesia_key, voice=voice_id)

    # Use OpenAI plugin for LLM (You can point this to NVIDIA NIM by setting OPENAI_BASE_URL)
    # Default is OpenAI if OPENAI_BASE_URL is not set
    # Ensure you have OPENAI_API_KEY set in your .env
    llm_instance = openai.LLM(
        model="meta/llama-3.1-70b-instruct",
        base_url=os.environ.get("OPENAI_BASE_URL"),
        api_key=os.environ.get("OPENAI_API_KEY")
    )

    agent = VoicePipelineAgent(
        instructions=instructions,
        stt=deepgram.STT(), # Deepgram is ultra-fast and purpose-built for speech
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
