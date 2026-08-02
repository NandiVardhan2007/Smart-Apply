import os
import asyncio
import logging
import json
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, JobProcess, WorkerOptions, cli, llm, AgentSession
from livekit.agents.voice import Agent as VoicePipelineAgent
import aiohttp
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ["/ping", "/healthz", "/health", "/"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = json.dumps({
                "status": "ok",
                "service": "livekit-agent",
                "message": "LiveKit Voice AI Agent worker is active and running"
            }).encode("utf-8")
            self.wfile.write(payload)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

def start_ping_server(port: int):
    try:
        server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
        logging.info(f"Ping HTTP server active on http://0.0.0.0:{port}/ping")
        server.serve_forever()
    except Exception as e:
        logging.warning(f"Could not start Ping HTTP server on port {port}: {e}")

_cached_cartesia_key = None
_cartesia_key_timestamp = 0

async def _check_cartesia_key(session: aiohttp.ClientSession, key: str) -> str | None:
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
    return None

async def get_working_cartesia_key() -> str:
    global _cached_cartesia_key, _cartesia_key_timestamp
    import time
    now = time.time()
    
    # Use cache if valid (5 minutes TTL)
    if _cached_cartesia_key and (now - _cartesia_key_timestamp < 300):
        return _cached_cartesia_key

    keys_str = os.environ.get("CARTESIA_API_KEYS", "")
    keys = [k.strip() for k in keys_str.split(",") if k.strip()]
    if not keys:
        return os.environ.get("CARTESIA_API_KEY", "")
    
    async with aiohttp.ClientSession() as session:
        tasks = [_check_cartesia_key(session, key) for key in keys]
        results = await asyncio.gather(*tasks)
        
        for res in results:
            if res is not None:
                _cached_cartesia_key = res
                _cartesia_key_timestamp = now
                return res
    
    return keys[0] if keys else ""

load_dotenv()
logging.basicConfig(level=logging.INFO)


import typing

class AssistantFnc(llm.ToolContext):
    def __init__(self, tts: cartesia.TTS, room: rtc.Room):
        super().__init__(tools=[])
        self.tts = tts
        self.room = room

    @llm.function_tool(description="ONLY call this tool if the candidate explicitly asks to change voice gender ('change voice', 'male voice', 'female voice'). DO NOT call for normal responses.")
    async def change_voice(self, gender: typing.Annotated[str, "The gender to switch to. Must be 'male' or 'female'"]):
        if gender.lower() == "male":
            voice_id = os.environ.get("VOICE_ID_TECHNICAL_MALE", "638efaaa-4d0c-442e-b701-3fae16aad012")
            self.tts.update_options(voice=voice_id)
            return "Voice changed to male. Now ask the candidate your next interview question."
        elif gender.lower() == "female":
            voice_id = os.environ.get("VOICE_ID_TECHNICAL_FEMALE", "7ea5e9c2-b719-4dc3-b870-5ba5f14d31d8")
            self.tts.update_options(voice=voice_id)
            return "Voice changed to female. Now ask the candidate your next interview question."
        return "Unknown gender. Now ask the candidate your next interview question."

    @llm.function_tool(description="ONLY call this tool in Technical interviews when presenting a coding problem for the candidate to write code on screen.")
    async def open_code_editor(
        self,
        question_title: typing.Annotated[str, "The title of the coding question"],
        question_description: typing.Annotated[str, "The full description of the coding question"],
        sample_input: typing.Annotated[str, "Sample input for the question"],
        sample_output: typing.Annotated[str, "Sample output for the question"]
    ):
        payload = json.dumps({
            "title": question_title,
            "description": question_description,
            "sample_input": sample_input,
            "sample_output": sample_output
        }).encode('utf-8')
        
        await self.room.local_participant.publish_data(
            payload=payload,
            topic="open_code_editor"
        )
        return "Editor opened on screen. Now verbally present the question to the candidate."

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
        # Check if candidate is already in room, otherwise wait
        if ctx.room.remote_participants:
            participant = next(iter(ctx.room.remote_participants.values()))
            participant_name = participant.name or "Candidate"
            logging.info(f"Candidate already in room: {participant_name}")
        else:
            logging.info("Waiting for candidate to join...")
            participant = await ctx.wait_for_participant()
            participant_name = participant.name or "Candidate"
            logging.info(f"Candidate joined room: {participant_name}")
    except Exception as e:
        logging.warning(f"Failed to get participant name: {e}")

    # Define voices and instructions based on theme
    base_rule = (
        f"You are conducting a live voice interview with {participant_name}. Greet them and ask your first question. "
        "CRITICAL MANDATORY RULE: On every single user input, you MUST immediately speak back with your next single question. "
        "Never stay silent. Do NOT ask multi-part questions. Keep your responses under 2 sentences. "
        "Wait for the candidate to answer before asking the next question."
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
        voice_id = os.environ.get("VOICE_ID_BEHAVIORAL", "92da9281-7cf3-4c61-be0f-face03a3312f")
        instructions = (
            "You are a professional behavioral interviewer evaluating leadership and cultural fit. "
            "Ask situational questions like 'Tell me about a time when...' and dig deep into their reasoning. "
            f"{base_rule}"
        )
    elif theme == "Executive":
        voice_id = os.environ.get("VOICE_ID_EXECUTIVE", "56e35e2d-6eb6-4226-ab8b-9776515a7094")
        instructions = (
            "You are a stern, high-level executive conducting a leadership interview. "
            "You expect data-driven answers, challenge the candidate on strategy, and demand business impact. "
            f"{base_rule}"
        )
    elif theme == "Creative":
        voice_id = os.environ.get("VOICE_ID_CREATIVE", "59ba7dee-8f9a-432f-a6c0-ffb33666b654")
        instructions = (
            "You are an enthusiastic and casual creative director for a design agency. "
            "You are energetic, use informal language, and ask imaginative, out-of-the-box questions. "
            f"{base_rule}"
        )
    else: # HR
        voice_id = os.environ.get("VOICE_ID_HR", "59ba7dee-8f9a-432f-a6c0-ffb33666b654")
        instructions = (
            "You are a friendly and welcoming HR recruiter. "
            "You are conducting an initial phone screen with a candidate. "
            "Be enthusiastic, ask about their background, and make them feel comfortable. "
            f"{base_rule}"
        )

    # Use Cartesia TTS with fallback to OpenAI TTS
    try:
        cartesia_key = await get_working_cartesia_key()
        if cartesia_key:
            tts = cartesia.TTS(api_key=cartesia_key, voice=voice_id)
        else:
            tts = openai.TTS()
    except Exception as e:
        logging.warning(f"Cartesia TTS init failed: {e}, falling back to OpenAI TTS")
        tts = openai.TTS()
    fnc_ctx = AssistantFnc(tts=tts, room=ctx.room)

    openai_base_url = os.environ.get("OPENAI_BASE_URL") or os.environ.get("NVIDIA_BASE_URL")
    openai_api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("NVIDIA_API_KEY")
    
    if openai_base_url and "nvidia" in openai_base_url.lower():
        model_name = os.environ.get("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")
    else:
        model_name = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    logging.info(f"Initializing LLM with model: {model_name} (base_url={openai_base_url})")

    llm_instance = openai.LLM(
        model=model_name,
        base_url=openai_base_url,
        api_key=openai_api_key
    )

    agent = VoicePipelineAgent(
        instructions=instructions,
        stt=deepgram.STT(),
        llm=llm_instance,
        tts=tts,
        tools=[fnc_ctx],
    )

    session = AgentSession(vad=vad)
    
    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        if data.topic == "code_submission":
            try:
                raw_text = data.data.decode('utf-8')
                try:
                    payload = json.loads(raw_text)
                    code_text = payload.get("code", "")
                    language = payload.get("language", "unknown")
                except json.JSONDecodeError:
                    # Fallback for old clients sending plain text
                    code_text = raw_text
                    language = "unknown"
                    
                logging.info(f"Received {language} code submission:\n{code_text}")
                msg = llm.ChatMessage(role="user", content=f"I have submitted my {language} code:\n\n```{language}\n{code_text}\n```\nPlease evaluate it.")
                agent.chat_ctx.messages.append(msg)
                asyncio.create_task(session.say("I have received your code submission.", allow_interruptions=True))
            except Exception as e:
                logging.error(f"Error processing code submission: {e}")
                
    await session.start(
        room=ctx.room,
        agent=agent,
    )
    
    await session.say(f"Hello {participant_name}! I am your AI interviewer. Shall we begin?", allow_interruptions=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8081))
    
    # Start HTTP ping server thread for Render keep-alive and external cronjob monitoring
    threading.Thread(target=start_ping_server, args=(port,), daemon=True).start()

    worker_port = port + 1 if os.environ.get("PORT") else port
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        port=worker_port
    ))
