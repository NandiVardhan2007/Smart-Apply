import io
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form
from bson import ObjectId
from datetime import datetime, timezone

from backend.database import get_db, get_gridfs
from backend.auth import get_current_user
from backend.resume_parser import parse_resume

try:
    from pdfminer.high_level import extract_text as pdf_extract_text
    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False

router = APIRouter(prefix="/resume", tags=["resume"])

MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    label: str = Form("Default"),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    gridfs = get_gridfs()

    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(400, detail="Only PDF files are accepted")

    data = await file.read()
    if len(data) > MAX_RESUME_SIZE:
        raise HTTPException(413, detail="File too large. Maximum 5 MB.")

    # Verify PDF magic bytes
    if len(data) < 4 or data[:4] != b'%PDF':
        raise HTTPException(400, detail="File does not appear to be a valid PDF")

    parsed_data = {}
    if PDFMINER_AVAILABLE:
        try:
            text = pdf_extract_text(io.BytesIO(data))
            parsed_data = parse_resume(text)
        except Exception as e:
            parsed_data = {"error": str(e)}
    else:
        parsed_data = {"warning": "pdfminer not installed — parsed fields unavailable"}

    file_id = await gridfs.upload_from_stream(
        file.filename or "resume.pdf",
        io.BytesIO(data),
        metadata={
            "user_id": current_user["user_id"],
            "label": label,
            "content_type": "application/pdf",
        }
    )

    resume_entry = {
        "file_id": str(file_id),
        "filename": file.filename or "resume.pdf",
        "label": label,
        "parsed": parsed_data,
        "uploaded_at": datetime.now(timezone.utc).isoformat() + 'Z',
    }

    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$push": {"resumes": resume_entry}}
    )

    return {"message": "Resume uploaded successfully", "parsed": parsed_data, "file_id": str(file_id)}


@router.get("/list")
async def list_resumes(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(404, detail="User not found")

    resumes = user.get("resumes", [])
    slim = []
    for r in resumes:
        slim.append({
            "file_id": r.get("file_id"),
            "filename": r.get("filename"),
            "label": r.get("label"),
            "uploaded_at": r.get("uploaded_at"),
            "parsed_name": _get_name(r.get("parsed", {})),
        })
    return {"resumes": slim}


@router.get("/parsed/{file_id}")
async def get_parsed(file_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(404, detail="User not found")

    for r in user.get("resumes", []):
        if r.get("file_id") == file_id:
            return {"parsed": r.get("parsed", {})}

    raise HTTPException(404, detail="Resume not found")


@router.delete("/{file_id}")
async def delete_resume(file_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gridfs = get_gridfs()

    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$pull": {"resumes": {"file_id": file_id}}}
    )

    try:
        await gridfs.delete(ObjectId(file_id))
    except Exception:
        pass

    return {"message": "Resume deleted"}


def _get_name(parsed: dict) -> str:
    fn = parsed.get("first_name", "")
    ln = parsed.get("last_name", "")
    return f"{fn} {ln}".strip() or "Unknown"
