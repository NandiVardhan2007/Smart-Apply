import asyncio
import io
import threading
from typing import AsyncIterable
import queue

from livekit.agents import tts
from livekit import rtc
import av
from gtts import gTTS
from livekit.agents.tts.tts import DEFAULT_API_CONNECT_OPTIONS
import logging
import re

logger = logging.getLogger("gtts-plugin")

class GTTSChunkedStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        try:
            # We must use threading because gTTS does blocking network calls
            chunk_queue = queue.Queue()
            
            def generate_audio():
                try:
                    # Detect Telugu characters (Unicode range 0x0C00 - 0x0C7F)
                    is_telugu = bool(re.search(r'[\u0c00-\u0c7f]', self.input_text))
                    lang = 'te' if is_telugu else 'en'
                    
                    # gTTS generates an MP3
                    tts_engine = gTTS(text=self.input_text, lang=lang, slow=False)
                    mp3_fp = io.BytesIO()
                    tts_engine.write_to_fp(mp3_fp)
                    mp3_fp.seek(0)
                    
                    # Decode MP3 to raw PCM chunks using PyAV
                    container = av.open(mp3_fp)
                    audio_stream = container.streams.audio[0]
                    
                    sample_rate = audio_stream.rate
                    num_channels = audio_stream.channels
                    
                    chunk_queue.put({"meta": {"sample_rate": sample_rate, "num_channels": num_channels}})
                    
                    # PyAV resamples to s16 format automatically if configured or we just extract frames
                    # The frames from av are already numpy/bytes usually, but to be safe:
                    resampler = av.AudioResampler(format='s16', layout='mono', rate=24000)
                    
                    for frame in container.decode(audio_stream):
                        resampled_frames = resampler.resample(frame)
                        for res_frame in resampled_frames:
                            chunk_queue.put(bytes(res_frame.planes[0]))
                            
                    chunk_queue.put(None)  # EOF
                except Exception as e:
                    chunk_queue.put(e)

            thread = threading.Thread(target=generate_audio, daemon=True)
            thread.start()
            
            # Wait for metadata (first item)
            first_item = await asyncio.to_thread(chunk_queue.get, timeout=30)
            if isinstance(first_item, Exception):
                raise first_item
                
            sample_rate = 24000
            num_channels = 1
            
            output_emitter.initialize(
                request_id="gtts",
                sample_rate=sample_rate,
                num_channels=num_channels,
                mime_type="audio/pcm"
            )

            while True:
                chunk = await asyncio.to_thread(chunk_queue.get, timeout=30)
                if isinstance(chunk, Exception):
                    raise chunk
                if chunk is None:
                    break
                
                audio_frame = rtc.AudioFrame(
                    data=chunk,
                    sample_rate=sample_rate,
                    num_channels=num_channels,
                    samples_per_channel=len(chunk) // 2,
                )
                output_emitter.push(audio_frame)

            output_emitter.flush()
                
        except Exception as e:
            logger.error(f"gTTS Error: {e}", exc_info=True)
            raise e

class GTTSTextToSpeech(tts.TTS):
    def __init__(self):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        
    @property
    def model(self) -> str:
        return "google-translate-tts"

    @property
    def provider(self) -> str:
        return "google"
        
    def synthesize(self, text: str, *, conn_options = None) -> tts.ChunkedStream:
        if conn_options is None:
            conn_options = DEFAULT_API_CONNECT_OPTIONS
        return GTTSChunkedStream(tts=self, input_text=text, conn_options=conn_options)
