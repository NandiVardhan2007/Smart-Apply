class ChunkedStream(ABC):
    """Used by the non-streamed synthesize API, some providers support chunked http responses"""

    _tts_request_span_name: ClassVar[str] = "tts_request"

    def __init__(
        self,
        *,
        tts: TTS,
        input_text: str,
        conn_options: APIConnectOptions,
    ) -> None:
        self._input_text = input_text
        self._tts = tts
        self._conn_options = conn_options
        self._event_ch = aio.Chan[SynthesizedAudio]()
        self._input_tokens = 0
        self._output_tokens = 0
        self._acquire_time: float = 0.0
        self._connection_reused: bool = False

        self._tee = aio.itertools.tee(self._event_ch, 2)
        self._event_aiter, monitor_aiter = self._tee
        self._current_attempt_has_error = False
        self._metrics_task = asyncio.create_task(
            self._metrics_monitor_task(monitor_aiter), name="TTS._metrics_task"
        )

        async def _traceable_main_task() -> None:
            with tracer.start_as_current_span(self._tts_request_span_name, end_on_exit=False):
                await self._main_task()

        self._synthesize_task = asyncio.create_task(
            _traceable_main_task(), name="TTS._synthesize_task"
        )
        self._synthesize_task.add_done_callback(lambda _: self._event_ch.close())

        self._tts_request_span: trace.Span | None = None

    @property
    def input_text(self) -> str:
        return self._input_text

    @property
    def done(self) -> bool:
        return self._synthesize_task.done()

    @property
    def exception(self) -> BaseException | None:
        return self._synthesize_task.exception()

    def _set_token_usage(self, *, input_tokens: int = 0, output_tokens: int = 0) -> None:
        self._input_tokens = input_tokens
        self._output_tokens = output_tokens

    async def _metrics_monitor_task(self, event_aiter: AsyncIterable[SynthesizedAudio]) -> None:
        """Task used to collect metrics"""

        start_time = time.perf_counter()
        audio_duration = 0.0
        ttfb = -1.0
        request_id = ""

        async for ev in event_aiter:
            request_id = ev.request_id
            if ttfb == -1.0:
                ttfb = time.perf_counter() - start_time

            audio_duration += ev.frame.duration

        duration = time.perf_counter() - start_time

        if self._current_attempt_has_error:
            return

        metrics = TTSMetrics(
            timestamp=time.time(),
            request_id=request_id,
            ttfb=ttfb,
            duration=duration,
            characters_count=len(self._input_text),
            input_tokens=self._input_tokens,
            output_tokens=self._output_tokens,
            audio_duration=audio_duration,
            cancelled=self._synthesize_task.cancelled(),
            label=self._tts._label,
            streamed=False,
            acquire_time=self._acquire_time,
            connection_reused=self._connection_reused,
            metadata=Metadata(model_name=self._tts.model, model_provider=self._tts.provider),
        )
        if self._tts_request_span:
            self._tts_request_span.set_attribute(
                trace_types.ATTR_TTS_METRICS, metrics.model_dump_json()
            )
        self._tts.emit("metrics_collected", metrics)

    async def collect(self) -> rtc.AudioFrame:
        """Utility method to collect every frame in a single call"""
        frames = []
        async for ev in self:
            frames.append(ev.frame)

        return rtc.combine_audio_frames(frames)

    @abstractmethod
    async def _run(self, output_emitter: AudioEmitter) -> None: ...

    async def _main_task(self) -> None:
        self._tts_request_span = current_span = trace.get_current_span()
        current_span.set_attributes(
            {
                trace_types.ATTR_TTS_STREAMING: False,
                trace_types.ATTR_TTS_LABEL: self._tts.label,
            }
        )

        for i in range(self._conn_options.max_retry + 1):
            output_emitter = AudioEmitter(label=self._tts.label, dst_ch=self._event_ch)
            try:
                with tracer.start_as_current_span("tts_request_run") as attempt_span:
                    attempt_span.set_attribute(trace_types.ATTR_RETRY_COUNT, i)
                    try:
                        await self._run(output_emitter)
                    except Exception as e:
                        telemetry_utils.record_exception(attempt_span, e)
                        raise

                output_emitter.end_input()
                # wait for all audio frames to be pushed & propagate errors
                await output_emitter.join()

                if self._input_text.strip() and output_emitter.pushed_duration() <= 0.0:
                    raise APIError(f"no audio frames were pushed for text: {self._input_text}")

                current_span.set_attribute(trace_types.ATTR_TTS_INPUT_TEXT, self._input_text)
                return
            except APIError as e:
                # 499 (Client Closed Request) - close gracefully without raising
                if isinstance(e, APIStatusError) and e.status_code == 499:
                    return

                retry_interval = self._conn_options._interval_for_retry(i)
                if self._conn_options.max_retry == 0 or self._conn_options.max_retry == i:
                    self._emit_error(e, recoverable=False)
                    raise
                else:
                    self._emit_error(e, recoverable=True)
                    logger.warning(
                        f"failed to synthesize speech: {e}, retrying in {retry_interval}s",
                        extra={"tts": self._tts._label, "attempt": i + 1, "streamed": False},
                    )

                await asyncio.sleep(retry_interval)
                # Reset the flag when retrying
                self._current_attempt_has_error = False
            finally:
                await output_emitter.aclose()

    def _emit_error(self, api_error: Exception, recoverable: bool) -> None:
        self._current_attempt_has_error = True
        self._tts.emit(
            "error",
            TTSError(
                timestamp=time.time(),
                label=self._tts._label,
                error=api_error,
                recoverable=recoverable,
            ),
        )

    async def aclose(self) -> None:
        """Close is automatically called if the stream is completely collected"""
        await aio.cancel_and_wait(self._synthesize_task)
        self._event_ch.close()
        await self._metrics_task
        await self._tee.aclose()
        if self._tts_request_span:
            self._tts_request_span.end()
            self._tts_request_span = None

    async def __anext__(self) -> SynthesizedAudio:
        try:
            val = await self._event_aiter.__anext__()
        except StopAsyncIteration:
            if not self._synthesize_task.cancelled() and (exc := self._synthesize_task.exception()):
                raise exc  # noqa: B904

            raise StopAsyncIteration from None

        return val

    def __aiter__(self) -> AsyncIterator[SynthesizedAudio]:
        return self

    async def __aenter__(self) -> ChunkedStream:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        await self.aclose()

