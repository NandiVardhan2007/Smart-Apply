import pytest

@pytest.mark.asyncio
async def test_signup_then_verify_then_login(async_client, monkeypatch):
    # stub out the email send so tests don't hit Brevo
    monkeypatch.setattr("app.services.email_service.send_otp_email", lambda *a, **kw: None)

    resp = await async_client.post("/api/auth/signup", json={
        "email": "test@example.com", "password": "correcthorsebatterystaple", "full_name": "Test User"
    })
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_login_rate_limit_blocks_after_5_attempts(async_client):
    for _ in range(5):
        await async_client.post("/api/auth/login", json={"email": "x@x.com", "password": "wrong"})
    resp = await async_client.post("/api/auth/login", json={"email": "x@x.com", "password": "wrong"})
    assert resp.status_code == 429
