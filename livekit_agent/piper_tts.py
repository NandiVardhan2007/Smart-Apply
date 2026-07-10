import asyncio
import io
import time
from typing import AsyncIterable, AsyncIterator, List, Optional
import wave

from piper import PiperVoice
from livekit.agents.tts import TTS, SynthesizedAudio, AudioEmitter
from livekit import rtc

# Simple chunking utility to split text into sentences
import re

def chunk_text(text: str) -> List[str]:
    # Very basic sentence splitting
    sentences = re.split(r'(?<=[.!?]) +', text)
    return [s for s in sentences if s.strip()]


class PiperTTSStream:
    def __init__(self, tts, input_text: str):
        self._tts = tts
        self._input_text = input_text
        self._event_ch = asyncio.Queue()
        self._closed = False
        self._task = asyncio.create_task(self._synthesize())
    
    async def _synthesize(self):
        try:
            sentences = chunk_text(self._input_text)
            for sentence in sentences:
                # Piper generate audio returns bytes in raw PCM or WAV format depending on usage
                # We'll use synthesize_stream_raw to get raw 16-bit PCM audio
                audio_stream = self._tts._voice.synthesize_stream_raw(sentence)
                
                # audio_stream yields bytes (PCM 16-bit)
                for audio_bytes in audio_stream:
                    # Convert bytes to rtc.AudioFrame
                    # Piper outputs 16-bit mono PCM at the sample rate defined in its config
                    # Typically 22050 Hz or 16000 Hz or 24000 Hz depending on the model.
                    # We can use the sample rate from the config
                    sample_rate = self._tts._sample_rate
                    
                    # Ensure audio_bytes length is even (16-bit = 2 bytes)
                    if len(audio_bytes) % 2 != 0:
                        audio_bytes = audio_bytes[:-1]
                        
                    num_samples = len(audio_bytes) // 2
                    
                    audio_frame = rtc.AudioFrame(
                        data=audio_bytes,
                        sample_rate=sample_rate,
                        num_channels=1,
                        samples_per_channel=num_samples
                    )
                    
                    await self._event_ch.put(SynthesizedAudio(frame=audio_frame))
                    
        except Exception as e:
            print(f"Error synthesizing speech: {e}")
        finally:
            await self._event_ch.put(None) # EOF marker

    def __aiter__(self):
        return self

    async def __anext__(self) -> SynthesizedAudio:
        if self._closed:
            raise StopAsyncIteration
            
        item = await self._event_ch.get()
        if item is None:
            self._closed = True
            raise StopAsyncIteration
            
        return item
        

from livekit.agents.tts import TTSCapabilities

class PiperTTS(TTS):
    def __init__(self, model_path: str, config_path: str):
        # Load the voice model first to get sample rate
        self._voice = PiperVoice.load(model_path, config_path)
        self._sample_rate = self._voice.config.sample_rate
        
        super().__init__(
            capabilities=TTSCapabilities(streaming=False),
            sample_rate=self._sample_rate,
            num_channels=1
        )

    def synthesize(self, text: str) -> "PiperTTSStream":
        return PiperTTSStream(self, text)
