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

class AssistantFnc(llm.FunctionContext):
    def __init__(self, tts: cartesia.TTS, room: rtc.Room):
        super().__init__()
        self.tts = tts
        self.room = room

    @llm.ai_callable(description="Change the AI interviewer's voice to a specific gender if the user asks you to change your voice to male or female.")
    async def change_voice(self, gender: str = llm.TypeInfo(description="The gender to switch to. Must be 'male' or 'female'")):
        if gender.lower() == "male":
            voice_id = os.environ.get("VOICE_ID_TECHNICAL_MALE", "638efaaa-4d0c-442e-b701-3fae16aad012")
            self.tts.update_options(voice=voice_id)
            return "Voice changed to male."
        elif gender.lower() == "female":
            voice_id = os.environ.get("VOICE_ID_TECHNICAL_FEMALE", "7ea5e9c2-b719-4dc3-b870-5ba5f14d31d8")
            self.tts.update_options(voice=voice_id)
            return "Voice changed to female."
        return "Unknown gender."

    @llm.ai_callable(description="Open the live code editor on the user's screen. Call this tool immediately when you ask the candidate a coding question.")
    async def open_code_editor(self):
        await self.room.local_participant.publish_data(
            payload=b'open',
            topic="open_code_editor"
        )
        return "Editor opened successfully on the user's screen."

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

    logger = logging.getLogger("livekit.agents")
    logger.info(f"connecting to room {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant_name = "Candidate"
    try:
        participant = await ctx.wait_for_participant()
        participant_name = participant.name or "Candidate"
    except Exception as e:
        logging.warning(f"Failed to get participant name: {e}")

    # Define voices and instructions based on theme
    base_rule = (
        f"You are interviewing {participant_name}. Greet them by name and start with a brief self intro. "
        "CRITICAL RULE: You must ask ONLY ONE short question at a time. "
        "Do NOT ask multi-part questions. Keep your responses under 2 sentences. "
        "Wait for the user to answer before asking the next question."
    )

    if theme == "Technical":
        voice_id = os.environ.get("VOICE_ID_TECHNICAL", "7ea5e9c2-b719-4dc3-b870-5ba5f14d31d8")
        instructions = (
            "You are a strict and highly technical engineering interviewer. "
            "You are conducting a technical interview with a candidate. "
            "Ask challenging technical questions, evaluate their problem-solving skills, and be direct. "
            "Ask the candidate to write a solution to a coding question in their live editor. "
            "Use the open_code_editor tool to instantly pop up the editor on their screen when you ask them to code. "
            "When they submit code, evaluate it for correctness, time complexity, and readability. "
            "If the user asks you to change your voice to male or female, use the change_voice tool. "
            f"{base_rule}"
        )
    elif theme == "Behavioral":
        voice_id = os.environ.get("VOICE_ID_BEHAVIORAL", "79a125e8-cd45-4c13-8a67-188112f4dd22")
        instructions = (
            "You are a professional behavioral interviewer evaluating leadership and cultural fit. "
            "Ask situational questions like 'Tell me about a time when...' and dig deep into their reasoning. "
            f"{base_rule}"
        )
    elif theme == "Executive":
        voice_id = os.environ.get("VOICE_ID_EXECUTIVE", "5c5318e0-73ce-450b-801b-c6b75ebf91b7")
        instructions = (
            "You are a stern, high-level executive conducting a leadership interview. "
            "You expect data-driven answers, challenge the candidate on strategy, and demand business impact. "
            f"{base_rule}"
        )
    elif theme == "Creative":
        voice_id = os.environ.get("VOICE_ID_CREATIVE", "c45a8cb6-4556-42db-ab25-3b1a20b72ea9")
        instructions = (
            "You are an enthusiastic and casual creative director for a design agency. "
            "You are energetic, use informal language, and ask imaginative, out-of-the-box questions. "
            f"{base_rule}"
        )
    else: # HR
        voice_id = os.environ.get("VOICE_ID_HR", "a0e99841-438c-4a64-b679-ae501e7d6091")
        instructions = (
            "You are a friendly and welcoming HR recruiter. "
            "You are conducting an initial phone screen with a candidate. "
            "Be enthusiastic, ask about their background, and make them feel comfortable. "
            f"{base_rule}"
        )

    # Use Cartesia TTS for ultra-fast, realistic cloud voices
    # Automatically rotate and check API keys
    cartesia_key = await get_working_cartesia_key()
    tts = cartesia.TTS(api_key=cartesia_key, voice=voice_id)
    fnc_ctx = AssistantFnc(tts=tts, room=ctx.room)

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
        fnc_ctx=fnc_ctx,
    )

    session = AgentSession(vad=vad)
    
    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        if data.topic == "code_submission":
            try:
                code_text = data.data.decode('utf-8')
                logging.info(f"Received code submission:\n{code_text}")
                msg = llm.ChatMessage(role="user", content=f"I have submitted my code:\n\n```\n{code_text}\n```\nPlease evaluate it.")
                agent.chat_ctx.messages.append(msg)
                asyncio.create_task(session.say("I have received your code submission.", allow_interruptions=True))
            except Exception as e:
                logging.error(f"Error processing code submission: {e}")
                
    await session.start(
        room=ctx.room,
        agent=agent,
    )
    
    await asyncio.sleep(1)
    await session.say(f"Hello {participant_name}! I am your AI interviewer. Shall we begin?", allow_interruptions=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8081))
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        port=port
    ))
