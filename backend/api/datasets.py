from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import logging

from core.dataloaders.datasets_loader import (
    list_datasets,
    get_dataset,
    get_patient_dataset_summary,
    get_patient_details,
    dataset_exists
)
from .dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


@router.get("/")
def list_all_datasets(current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get list of all datasets with summary information."""
    try:
        datasets = list_datasets(current_user)

        return {
            "status": "success",
            "total_datasets": len(datasets),
            "datasets": datasets
        }

    except Exception as e:
        logger.error(f"Error in list_all_datasets: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{dataset_name}")
def get_dataset_metadata(dataset_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get metadata for a specific dataset."""
    try:
        dataset_metadata = get_dataset(dataset_name, current_user)

        if not dataset_metadata:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_name}' not found"
            )

        return {
            "status": "success",
            **dataset_metadata
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_dataset_metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{dataset_name}/patients")
def get_dataset_patient_summary(dataset_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get lightweight patient summary for a specific dataset."""
    try:
        if not dataset_exists(dataset_name):
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_name}' not found"
            )

        summary = get_patient_dataset_summary(dataset_name, current_user)

        if not summary:
            raise HTTPException(
                status_code=404,
                detail=f"No patient data found for dataset '{dataset_name}'"
            )

        return summary

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_dataset_patient_summary: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{dataset_name}/patients/{mrn}")
def get_patient_by_mrn(dataset_name: str, mrn: int, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get full patient details by MRN from specific dataset."""
    try:
        if not dataset_exists(dataset_name):
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_name}' not found"
            )

        patient_details = get_patient_details(str(mrn), dataset_name, current_user)

        if not patient_details:
            raise HTTPException(
                status_code=404,
                detail=f"Patient with MRN {mrn} not found in dataset '{dataset_name}'"
            )

        return patient_details

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_patient_by_mrn: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")