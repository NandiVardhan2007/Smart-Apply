import os
import asyncio
import logging
from dotenv import load_dotenv

from livekit.agents import AutoSubscribe, JobContext, JobProcess, WorkerOptions, cli, llm
from livekit.agents.voice import Agent as VoicePipelineAgent
from livekit.plugins import openai, silero

from piper_tts import PiperTTS

load_dotenv()
logging.basicConfig(level=logging.INFO)

async def entrypoint(ctx: JobContext):
    # Use Silero for Voice Activity Detection
    vad = silero.VAD.load()

    # Use Piper TTS for local, lightweight voice generation
    # Ensure the .onnx and .onnx.json files are in the same directory
    tts = PiperTTS(
        model_path="en_IN-dataset=spicor-english-base=ljspeech-epochs=1089.onnx",
        config_path="en_IN-dataset=spicor-english-base=ljspeech-epochs=1089.onnx.json"
    )

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
        vad=vad,
        stt=openai.STT(), # Using OpenAI Whisper for Speech-to-Text (can be swapped)
        llm=llm_instance,
        tts=tts,
    )

    agent.start(ctx.room)
    await asyncio.sleep(1)
    await agent.say("Hello! I am your AI interviewer. Shall we begin the interview?", allow_interruptions=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8081))
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        port=port
    ))
