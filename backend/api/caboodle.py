from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from pydantic import BaseModel
import logging

from core.caboodle.caboodle_service import (
    get_full_dictionary,
    process_llm_query
)
from .dependencies import get_current_user


class LLMQueryRequest(BaseModel):
    query: str

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


@router.get("/tables")
def list_tables(current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get complete Caboodle dictionary with all tables and their data."""
    try:
        dictionary = get_full_dictionary()

        return {
            "status": "success",
            "total_tables": len(dictionary),
            "tables": dictionary
        }

    except Exception as e:
        logger.error(f"Error in list_tables: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/llm_call")
def llm_call(request: LLMQueryRequest, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Process an LLM query about the Caboodle dictionary."""
    try:
        result = process_llm_query(request.query)
        return result

    except Exception as e:
        logger.error(f"Error in llm_call: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
