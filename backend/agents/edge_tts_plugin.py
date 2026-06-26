import asyncio
import io
import logging
from typing import Optional


import av
from livekit import rtc
from livekit.agents import tts
from livekit.agents.tts.tts import DEFAULT_API_CONNECT_OPTIONS

logger = logging.getLogger("edge_tts")

class EdgeChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        try:
            import httpx
            import urllib.parse

            # Use Google Translate TTS (free, no auth, tw-ob client)
            # Break text into chunks if it's too long, but for interviews short sentences are fine
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q={urllib.parse.quote(self.input_text)}"
            
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                resp.raise_for_status()
                audio_bytes = resp.content

            if not audio_bytes:
                return

            # 2. Decode MP3 to PCM using PyAV
            container = av.open(io.BytesIO(audio_bytes))
            audio_stream = container.streams.audio[0]
            
            sample_rate = audio_stream.sample_rate
            channels = audio_stream.channels

            output_emitter.initialize(
                request_id="edge_tts",
                sample_rate=sample_rate,
                num_channels=channels,
                mime_type="audio/pcm"
            )

            # Ensure we output interleaved 16-bit PCM for LiveKit
            resampler = av.AudioResampler(
                format="s16",
                layout="mono" if channels == 1 else "stereo",
                rate=sample_rate,
            )

            for frame in container.decode(audio_stream):
                resampled_frames = resampler.resample(frame)
                for r_frame in resampled_frames:
                    pcm_data = bytes(r_frame.planes[0])
                    audio_frame = rtc.AudioFrame(
                        data=pcm_data,
                        sample_rate=sample_rate,
                        num_channels=channels,
                        samples_per_channel=r_frame.samples,
                    )
                    output_emitter.push(audio_frame)

            # Flush the resampler
            for r_frame in resampler.resample(None):
                pcm_data = bytes(r_frame.planes[0])
                audio_frame = rtc.AudioFrame(
                    data=pcm_data,
                    sample_rate=sample_rate,
                    num_channels=channels,
                    samples_per_channel=r_frame.samples,
                )
                output_emitter.push(audio_frame)

            output_emitter.flush()

        except Exception as e:
            logger.error(f"TTS Synthesis Error: {e}", exc_info=True)
            raise e

class EdgeTTS(tts.TTS):
    def __init__(self, voice: str = "en-US"):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self.voice = voice
        
    @property
    def model(self) -> str:
        return "google-tts"

    @property
    def provider(self) -> str:
        return "google"
        
    def synthesize(self, text: str, *, conn_options = None) -> tts.ChunkedStream:
        if conn_options is None:
            conn_options = DEFAULT_API_CONNECT_OPTIONS
        return EdgeChunkedStream(tts=self, input_text=text, conn_options=conn_options)
