from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from app.schemas.memory import MemoryCreate, MemoryUpdate, MemoryOut
from app.services.memory_service import memory_service
from app.api.user import get_current_user

router = APIRouter()

@router.post("/", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
async def create_memory(memory_in: MemoryCreate, current_user: dict = Depends(get_current_user)):
    """
    Store a new memory fragment for the authenticated user.
    If a memory with the same category and key already exists, it will be updated.
    """
    try:
        memory = await memory_service.create_memory(current_user["id"], memory_in)
        return memory
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save memory: {str(e)}")

@router.get("/", response_model=List[MemoryOut])
async def list_memories(
    category: Optional[str] = None, 
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all memories for the current user, optionally filtered by category.
    """
    memories = await memory_service.get_memories(current_user["id"], category)
    return memories

@router.get("/search", response_model=List[MemoryOut])
async def search_memories(
    q: str = Query(..., min_length=1), 
    current_user: dict = Depends(get_current_user)
):
    """
    Search memories across category, key, and content.
    """
    memories = await memory_service.search_memories(current_user["id"], q)
    return memories

@router.get("/{memory_id}", response_model=MemoryOut)
async def get_memory(memory_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get a specific memory by its ID.
    """
    memory = await memory_service.get_memory_by_id(current_user["id"], memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory

@router.put("/{memory_id}", response_model=MemoryOut)
async def update_memory(
    memory_id: str, 
    memory_update: MemoryUpdate, 
    current_user: dict = Depends(get_current_user)
):
    """
    Update an existing memory fragment.
    """
    memory = await memory_service.update_memory(current_user["id"], memory_id, memory_update)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found or update failed")
    return memory

@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(memory_id: str, current_user: dict = Depends(get_current_user)):
    """
    Delete a memory fragment.
    """
    deleted = await memory_service.delete_memory(current_user["id"], memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    return None
