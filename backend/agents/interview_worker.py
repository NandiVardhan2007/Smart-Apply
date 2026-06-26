import asyncio
import logging
import os
import urllib.request
from pathlib import Path
from dotenv import load_dotenv

from livekit.agents import JobContext, WorkerOptions, WorkerType, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import openai, silero, groq
import edge_tts_plugin

load_dotenv()

logger = logging.getLogger("interview-agent")

# Pre-load the VAD model globally so it doesn't take 5-10 seconds to load on Render's 0.1 CPU for every new connection
logger.info("Pre-loading VAD plugin...")
_global_vad = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    await ctx.connect()
    participant = await ctx.wait_for_participant()
    logger.info(f"starting interview assistant for participant {participant.identity}")

    nvidia_api_key = os.getenv("NVIDIA_API_KEY")
    nvidia_model = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")

    initial_instructions = (
        "You are a professional technical interviewer for a software engineering role. "
        "Your interface with users will be voice. "
        "You should conduct a friendly but thorough technical interview. "
        "Start by introducing yourself as the AI interviewer and asking the candidate to introduce themselves. "
        "Then proceed with a few technical questions, keeping your responses concise and conversational."
    )

    try:
        logger.info("Initializing LLM plugin...")
        llm_plugin = openai.LLM(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=nvidia_api_key,
            model=nvidia_model
        )
        logger.info("Initializing STT plugin...")
        stt_plugin = groq.STT(model="whisper-large-v3")
        logger.info("Initializing TTS plugin...")
        tts_plugin = edge_tts_plugin.EdgeTTS()
        logger.info("Using pre-loaded VAD plugin...")
        vad_plugin = _global_vad

        logger.info("Creating Agent...")
        agent = Agent(
            instructions=initial_instructions,
            stt=stt_plugin,
            llm=llm_plugin,
            tts=tts_plugin,
            vad=vad_plugin,
        )
        logger.info("Creating AgentSession...")
        session = AgentSession(
            stt=stt_plugin,
            llm=llm_plugin,
            tts=tts_plugin,
            vad=vad_plugin
        )

        telemetry_logs = []

        @ctx.room.on("data_received")
        def on_data_received(data_packet):
            try:
                import json
                payload = json.loads(data_packet.data.decode("utf-8"))
                if payload.get("type") == "telemetry":
                    telemetry_logs.append(payload.get("data"))
            except Exception as e:
                logger.error(f"Failed to parse telemetry: {e}")

        # -------------------------------------------------------------------
        # Shutdown callback: only collects transcript + telemetry and POSTs
        # the RAW data to the backend. The backend does the heavy LLM work
        # asynchronously — so this callback completes in milliseconds and
        # LiveKit never times out the job.
        # -------------------------------------------------------------------
        _analysis_triggered = False

        async def post_raw_data_for_analysis():
            nonlocal _analysis_triggered
            if _analysis_triggered:
                return
            _analysis_triggered = True
            
            logger.info("Interview concluded. Collecting transcript and posting for analysis...")

            avg_confidence = 0.0
            max_blinks = 0
            if telemetry_logs:
                avg_confidence = sum(t.get("confidence", 0) for t in telemetry_logs) / len(telemetry_logs)
                max_blinks = max((t.get("blinkCount", 0) for t in telemetry_logs), default=0)

            transcript_lines = []
            try:
                for msg in session.history.messages():
                    if hasattr(msg, "role") and msg.role in ["user", "assistant"]:
                        content = msg.content
                        if isinstance(content, list):
                            content = " ".join([c.text for c in content if hasattr(c, "text")])
                        transcript_lines.append({"role": msg.role, "content": str(content)})
            except Exception as e:
                logger.warning(f"Could not read session history: {e}")

            logger.info(f"Transcript messages captured: {len(transcript_lines)}")

            room_name = ctx.room.name
            parts = room_name.split("-")
            user_id = parts[1] if len(parts) > 1 else "unknown"

            payload = {
                "user_id": user_id,
                "room_name": room_name,
                "transcript": transcript_lines,
                "telemetry": {
                    "avg_confidence": avg_confidence,
                    "blink_count": max_blinks,
                },
            }

            import httpx
            port = os.getenv("PORT", "8000")
            try:
                async with httpx.AsyncClient() as http_client:
                    resp = await http_client.post(
                        f"http://127.0.0.1:{port}/api/interview/analyze",
                        json=payload,
                        timeout=5.0   # Fast POST — backend does the LLM work
                    )
                    logger.info(f"Raw data posted for analysis: {resp.status_code}")
            except Exception as e:
                logger.error(f"Failed to post raw data: {e}")

        @ctx.room.on("participant_disconnected")
        def on_participant_disconnected(participant):
            logger.info(f"Participant {participant.identity} disconnected. Concluding interview...")
            asyncio.create_task(post_raw_data_for_analysis())

        # Keep the shutdown callback just in case the job is killed server-side
        ctx.add_shutdown_callback(post_raw_data_for_analysis)

        logger.info("Starting AgentSession...")
        await session.start(agent=agent, room=ctx.room)
        logger.info("AgentSession started. Saying welcome message...")
        await session.say(
            "Hello, I am your AI interviewer. To get started, could you please introduce yourself and turn on your camera?",
            allow_interruptions=True
        )
        logger.info("Welcome message queued.")

    except Exception as e:
        logger.error(f"Error in entrypoint: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        worker_type=WorkerType.ROOM,
    ))
