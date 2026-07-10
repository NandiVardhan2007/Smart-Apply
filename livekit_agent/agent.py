import os
import asyncio
import logging
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, JobProcess, WorkerOptions, cli, llm, AgentSession
from livekit.agents.voice import Agent as VoicePipelineAgent
from livekit.plugins import cartesia, openai, silero, deepgram
import aiohttp
import time
import base64
import json
from PIL import Image

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

async def analyze_frame(img_b64: str) -> dict:
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta/llama-3.2-90b-vision-instruct",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Analyze this candidate's face. Return a JSON object with 'focus' (integer 0-100), 'expression' (string, e.g. 'Engaged'), 'posture' (string, e.g. 'Upright'). Only output valid JSON."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                ]
            }
        ],
        "max_tokens": 100,
        "temperature": 0.3
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as resp:
            data = await resp.json()
            if 'choices' in data:
                text = data['choices'][0]['message']['content']
                if text.startswith("```json"):
                    text = text.split("```json")[1].split("```")[0].strip()
                return json.loads(text)
    return {}

async def process_video(video_stream: rtc.VideoStream, room: rtc.Room):
    last_process_time = 0
    async for frame_event in video_stream:
        now = time.time()
        # Analyze every 5 seconds
        if now - last_process_time > 5.0:
            last_process_time = now
            try:
                frame = frame_event.frame
                argb = frame.convert(rtc.VideoBufferType.RGBA)
                
                # Create PIL Image
                image = Image.frombuffer("RGBA", (argb.width, argb.height), bytes(argb.data), "raw", "RGBA", 0, 1)
                
                # Convert to JPEG
                import io
                buf = io.BytesIO()
                image.convert("RGB").save(buf, format="JPEG", quality=60)
                img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                
                # Analyze
                result = await analyze_frame(img_b64)
                if result:
                    # Send via Data Channel
                    payload = json.dumps(result).encode('utf-8')
                    await room.local_participant.publish_data(
                        payload=payload,
                        topic="facial_analysis"
                    )
                    logging.info(f"Published facial analysis: {result}")
            except Exception as e:
                logging.warning(f"Failed to process video frame: {e}")

async def entrypoint(ctx: JobContext):
    # Use Silero for Voice Activity Detection
    vad = silero.VAD.load()

    room_name = ctx.room.name
    theme = "HR"
    if "-Technical" in room_name:
        theme = "Technical"
    elif "-Behavioral" in room_name:
        theme = "Behavioral"
    elif "-Executive" in room_name:
        theme = "Executive"
    elif "-Creative" in room_name:
        theme = "Creative"

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
    elif theme == "Executive":
        voice_id = "5c5318e0-73ce-450b-801b-c6b75ebf91b7" # Assertive Female
        instructions = (
            "You are a stern, high-level executive conducting a leadership interview. "
            "You expect data-driven answers, challenge the candidate on strategy, and demand business impact. "
            "Keep your responses very direct, probing, and slightly intimidating."
        )
    elif theme == "Creative":
        voice_id = "c45a8cb6-4556-42db-ab25-3b1a20b72ea9" # Energetic Male
        instructions = (
            "You are an enthusiastic and casual creative director for a design agency. "
            "You are energetic, use informal language, and ask imaginative, out-of-the-box questions. "
            "Keep your responses lively, conversational, and highly enthusiastic."
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
