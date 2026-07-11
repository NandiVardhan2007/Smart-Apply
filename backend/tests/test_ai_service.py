import pytest
from app.services import ai_service

def test_parse_llm_json_strips_markdown_fences():
    raw = '```json\n{"score": 80}\n```'
    assert ai_service._parse_llm_json(raw, fallback={}) == {"score": 80}

def test_parse_llm_json_falls_back_on_garbage():
    assert ai_service._parse_llm_json("not json at all", fallback={"score": 0}) == {"score": 0}
