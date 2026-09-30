import firebase_admin
from firebase_admin import credentials
from firebase_admin import auth
from app.config import settings
import logging

logger = logging.getLogger(__name__)

def initialize_firebase():
    """Initializes the Firebase Admin SDK."""
    if not firebase_admin._apps:
        try:
            if not settings.FIREBASE_PROJECT_ID or not settings.FIREBASE_PRIVATE_KEY or not settings.FIREBASE_CLIENT_EMAIL:
                logger.warning("Firebase credentials missing, auth might fail if required.")
                return

            # Replace literal literal \n with actual newline
            private_key = settings.FIREBASE_PRIVATE_KEY.replace('\\n', '\n')

            cred = credentials.Certificate({
                "type": "service_account",
                "project_id": settings.FIREBASE_PROJECT_ID,
                "private_key": private_key,
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{settings.FIREBASE_CLIENT_EMAIL}"
            })
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin: {e}")

# Call it globally so it's initialized on import, or we can export the function.
# The user suggested doing it globally in this file, or calling it in main.
# "Call the initialization in ... startup events if necessary (or just initialize it globally in firebase_service.py)."
initialize_firebase()
