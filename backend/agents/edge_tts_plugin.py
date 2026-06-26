import asyncio
import io
import logging
from typing import Optional

import edge_tts
import av
from livekit import rtc
from livekit.agents import tts
from livekit.agents.tts.tts import DEFAULT_API_CONNECT_OPTIONS

logger = logging.getLogger("edge_tts")

class EdgeChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        try:
            # 1. Download MP3 from Edge TTS
            communicate = edge_tts.Communicate(self.input_text, self._tts.voice)
            audio_bytes = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes.extend(chunk["data"])
            
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
            self._emit_error(e, recoverable=False)
            raise e

class EdgeTTS(tts.TTS):
    def __init__(self, voice: str = "en-US-ChristopherNeural"):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self.voice = voice
        
    @property
    def model(self) -> str:
        return "edge-tts"

    @property
    def provider(self) -> str:
        return "microsoft"
        
    def synthesize(self, text: str, *, conn_options = None) -> tts.ChunkedStream:
        if conn_options is None:
            conn_options = DEFAULT_API_CONNECT_OPTIONS
        return EdgeChunkedStream(tts=self, input_text=text, conn_options=conn_options)
