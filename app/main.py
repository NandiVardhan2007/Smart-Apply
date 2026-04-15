from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, user
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection

app = FastAPI(title="Smart Apply API", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(user.router, prefix="/api/user", tags=["User"])

@app.get("/")
async def root():
    return {"message": "Smart Apply API is running"}
