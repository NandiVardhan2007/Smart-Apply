import json
import logging
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from fastapi.responses import RedirectResponse
import google_auth_oauthlib.flow
from bson import ObjectId

from app.db.mongodb import get_database
from app.core.config import settings
from app.core.security import encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter()

def get_google_flow():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Client Credentials not configured in backend.")
        
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "project_id": "smart-apply-agent",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": settings.GOOGLE_CLIENT_SECRET
        }
    }
    
    # Check if we're in dev mode or prod. Let's use production base for redirect
    # but be aware that for local dev this needs to match what is registered in Console.
    # To be flexible, we assume deployment uses RENDER_EXTERNAL_URL.
    redirect_uri = f"{settings.RENDER_EXTERNAL_URL}/api/email-auth/callback"
    
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        client_config,
        scopes=[
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send'
        ],
        redirect_uri=redirect_uri
    )
    return flow

@router.get("/url")
async def get_auth_url(user_id: str = Query(..., description="The ID of the user requesting auth")):
    """
    Generates the Google Sign-in URL. We pass the user_id as the 'state' parameter 
    so we know who to tie the tokens to in the callback.
    """
    try:
        flow = get_google_flow()
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=user_id # Using state to pass the user ID safely
        )
        return {"url": auth_url}
    except Exception as e:
        logger.error(f"[EMAIL AUTH] Failed to generate auth URL: {e}")
        raise HTTPException(status_code=500, detail="Auth setup error.")

@router.get("/callback")
async def auth_callback(request: Request, state: str, code: str):
    """
    Handles the Google OAuth redirect.
    Exchanges the auth code for access/refresh tokens and saves them in the user record.
    """
    user_id = state
    try:
        flow = get_google_flow()
        # Using authorization_response with the full URL is more robust than just code
        flow.fetch_token(authorization_response=str(request.url))
        credentials = flow.credentials
        
        creds_data = {
            'token': encrypt_token(credentials.token),
            'refresh_token': encrypt_token(credentials.refresh_token),
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        
        db = get_database()
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"google_credentials": creds_data}}
        )
        
        logger.info(f"[EMAIL AUTH] Target acquired. Tokens stored for user {user_id}")
        
        # Normally we redirect back to the Flutter web app or a deep link.
        # Since RENDER_EXTERNAL_URL is the backend, redirecting to the root for now 
        # or a success page is best. The frontend can periodically check if auth_success
        return {"status": "success", "message": "Email connected successfully. You can return to the app."}
        
    except Exception as e:
        logger.error(f"[EMAIL AUTH] Callback failed: {e}")
        raise HTTPException(status_code=400, detail="Failed to verify authorization code.")
