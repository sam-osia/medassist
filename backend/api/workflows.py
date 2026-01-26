from fastapi import APIRouter, HTTPException, Body, Depends, BackgroundTasks
from fastapi.responses import JSONResponse, Response
from typing import Dict, Any, Optional
import logging
import os
import json
import datetime
import shutil

from core.dataloders.projects_loader import get_project, project_exists
from core.dataloders.datasets_loader import get_patient_dataset_summary, get_patient_details
from core.dataloders.plan_loader import get_plan
from core.dataloders.experiment_loader import (
    get_all_experiments,
    get_experiment_details,
    get_experiments_for_project,
    get_patient_experiments_for_project,
    invalidate_experiment_cache
)
from core.workflow_service.run_workflow_delirium import run_workflow as run_workflow_delirium
from core.workflow_service.run_workflow_sdoh import run_workflow as run_workflow_sdoh
from core.workflow.schemas.tool_inputs import PromptInput
from .dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)

EXPERIMENTS_DIR = "experiments"


def create_experiment_folder(experiment_name: str, project_name: str, workflow_name: str, dataset_name: str):
    """Create experiment directory structure with metadata."""
    experiment_dir = os.path.join(EXPERIMENTS_DIR, experiment_name)
    os.makedirs(experiment_dir, exist_ok=True)

    current_time = datetime.datetime.now().isoformat()

    metadata = {
        "name": experiment_name,
        "project_name": project_name,
        "workflow_name": workflow_name,
        "dataset_name": dataset_name,
        "created_date": current_time,
        "last_modified_date": current_time,
        "total_patients": 0,
        "total_encounters": 0
    }

    metadata_path = os.path.join(experiment_dir, "metadata.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    # Initialize empty results file with new structure
    results_path = os.path.join(experiment_dir, "results.json")
    with open(results_path, 'w') as f:
        json.dump({"output_definitions": [], "output_values": []}, f, indent=2)

    logger.info(f"Created experiment folder: {experiment_name}")
    return experiment_dir


def append_patient_result(experiment_name: str, patient_result: Dict[str, Any]):
    """
    Append a patient's results to the experiment and update metadata.

    Args:
        experiment_name: Name of the experiment
        patient_result: Dict containing {mrn, csn, output_definitions, output_values}
    """
    experiment_dir = os.path.join(EXPERIMENTS_DIR, experiment_name)
    results_path = os.path.join(experiment_dir, "results.json")
    metadata_path = os.path.join(experiment_dir, "metadata.json")

    # Read current results
    with open(results_path, 'r') as f:
        data = json.load(f)

    # Merge definitions (dedupe by id)
    new_definitions = patient_result.get("output_definitions", [])
    existing_def_ids = {d["id"] for d in data.get("output_definitions", [])}
    for new_def in new_definitions:
        if new_def["id"] not in existing_def_ids:
            data.setdefault("output_definitions", []).append(new_def)
            existing_def_ids.add(new_def["id"])

    # Append output values
    new_values = patient_result.get("output_values", [])
    data.setdefault("output_values", []).extend(new_values)

    # Write updated results
    with open(results_path, 'w') as f:
        json.dump(data, f, indent=2)

    # Update metadata counts
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)

    # Count unique patients and encounters from output values metadata
    patients_seen = set()
    encounters_seen = set()
    for v in data.get("output_values", []):
        patient_id = v.get("metadata", {}).get("patient_id", "")
        encounter_id = v.get("metadata", {}).get("encounter_id", "")
        if patient_id:
            patients_seen.add(str(patient_id))
        if patient_id and encounter_id:
            encounters_seen.add((str(patient_id), str(encounter_id)))

    metadata["total_patients"] = len(patients_seen)
    metadata["total_encounters"] = len(encounters_seen)
    metadata["last_modified_date"] = datetime.datetime.now().isoformat()

    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Appended {len(new_values)} values for patient {patient_result.get('mrn')} to experiment {experiment_name}")


def create_status_file(experiment_name: str, total_patients: int):
    """Create status.json file for tracking experiment progress."""
    experiment_dir = os.path.join(EXPERIMENTS_DIR, experiment_name)
    status_path = os.path.join(experiment_dir, "status.json")

    status = {
        "status": "pending",
        "progress": {
            "total_patients": total_patients,
            "processed_count": 0,
            "failed_count": 0,
            "current_patient_mrn": None
        },
        "started_at": None,
        "completed_at": None,
        "total_flags_detected": 0,
        "errors": []
    }

    with open(status_path, 'w') as f:
        json.dump(status, f, indent=2)

    logger.info(f"Created status file for experiment: {experiment_name}")


def update_status_file(experiment_name: str, updates: Dict[str, Any]):
    """Update status.json file with new data."""
    experiment_dir = os.path.join(EXPERIMENTS_DIR, experiment_name)
    status_path = os.path.join(experiment_dir, "status.json")

    try:
        # Read current status
        with open(status_path, 'r') as f:
            status = json.load(f)

        # Apply updates
        for key, value in updates.items():
            # Support nested updates like "progress.processed_count"
            if '.' in key:
                parts = key.split('.')
                current = status
                for part in parts[:-1]:
                    current = current[part]
                current[parts[-1]] = value
            else:
                status[key] = value

        # Write updated status
        with open(status_path, 'w') as f:
            json.dump(status, f, indent=2)

    except Exception as e:
        logger.error(f"Error updating status file for {experiment_name}: {e}")


def read_status_file(experiment_name: str) -> Optional[Dict[str, Any]]:
    """Read status.json file and return status data."""
    experiment_dir = os.path.join(EXPERIMENTS_DIR, experiment_name)
    status_path = os.path.join(experiment_dir, "status.json")

    if not os.path.exists(status_path):
        # Legacy experiment without status file
        return None

    try:
        with open(status_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading status file for {experiment_name}: {e}")
        return None


@router.get("/experiments")
def list_all_experiments(current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get list of all experiments with summary information."""
    try:
        experiments = get_all_experiments(current_user)

        return {
            "status": "success",
            "total_experiments": len(experiments),
            "experiments": experiments
        }

    except Exception as e:
        logger.error(f"Error in list_all_experiments: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/experiments/{experiment_name}")
def get_experiment(experiment_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get full details for a specific experiment."""
    try:
        experiment_details = get_experiment_details(experiment_name, current_user)

        if not experiment_details:
            raise HTTPException(
                status_code=404,
                detail=f"Experiment '{experiment_name}' not found"
            )

        return {
            "status": "success",
            **experiment_details
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_experiment: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/experiments/{experiment_name}/status")
def get_experiment_status(experiment_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get execution status and progress of an experiment."""
    try:
        experiment_dir = os.path.join(EXPERIMENTS_DIR, experiment_name)

        if not os.path.exists(experiment_dir):
            raise HTTPException(
                status_code=404,
                detail=f"Experiment '{experiment_name}' not found"
            )

        metadata_path = os.path.join(experiment_dir, "metadata.json")
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        # Check permissions: must be able to access the experiment's project
        project_name = metadata.get("project_name")
        if project_name:
            project = get_project(project_name, current_user)
            if not project:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied to this experiment's project"
                )

        # Read status file for real-time progress tracking
        status_data = read_status_file(experiment_name)

        if status_data:
            # Return full status information
            return {
                "experiment_name": experiment_name,
                "project_name": metadata.get("project_name"),
                "workflow_name": metadata.get("workflow_name"),
                "dataset_name": metadata.get("dataset_name"),
                **status_data
            }
        else:
            # Legacy experiment without status file - assume completed
            return {
                "status": "completed",
                "experiment_name": experiment_name,
                "project_name": metadata.get("project_name"),
                "workflow_name": metadata.get("workflow_name"),
                "dataset_name": metadata.get("dataset_name"),
                "progress": {
                    "total_patients": metadata.get("total_patients", 0),
                    "processed_count": metadata.get("total_patients", 0),
                    "failed_count": 0,
                    "current_patient_mrn": None
                },
                "started_at": metadata.get("created_date"),
                "completed_at": metadata.get("last_modified_date"),
                "total_flags_detected": 0,
                "errors": []
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting experiment status: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/experiments/{experiment_name}")
def delete_experiment(experiment_name: str, current_user: str = Depends(get_current_user)) -> Response:
    """Delete an experiment and all its data."""
    try:
        experiment_dir = os.path.join(EXPERIMENTS_DIR, experiment_name)

        if not os.path.exists(experiment_dir):
            raise HTTPException(
                status_code=404,
                detail=f"Experiment '{experiment_name}' not found"
            )

        # Check permissions: must be able to access the experiment's project
        metadata_path = os.path.join(experiment_dir, "metadata.json")
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        project_name = metadata.get("project_name")
        if project_name:
            project = get_project(project_name, current_user)
            if not project:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied to this experiment's project"
                )

        # Delete experiment directory
        shutil.rmtree(experiment_dir)

        # Invalidate cache
        invalidate_experiment_cache()

        logger.info(f"Deleted experiment: {experiment_name}")

        return Response(status_code=204)  # No Content

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting experiment: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/projects/{project_name}/experiments")
def get_project_experiments(project_name: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get all workflow runs (experiments) for a specific project."""
    try:
        experiments = get_experiments_for_project(project_name, current_user)

        return {
            "status": "success",
            "project_name": project_name,
            "total_runs": len(experiments),
            "workflow_runs": experiments
        }

    except Exception as e:
        logger.error(f"Error in get_project_experiments: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/projects/{project_name}/patients/{mrn}/experiments")
def get_patient_project_experiments(project_name: str, mrn: str, current_user: str = Depends(get_current_user)) -> Dict[str, Any]:
    """Get all experiments for a specific patient within a specific project."""
    try:
        experiments = get_patient_experiments_for_project(mrn, project_name, current_user)

        return {
            "status": "success",
            "project_name": project_name,
            "mrn": mrn,
            "total_experiments": len(experiments),
            "experiments": experiments
        }

    except Exception as e:
        logger.error(f"Error in get_patient_project_experiments: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


def _extract_analyze_steps(steps):
    """
    Recursively extract all analyze_note_with_span_and_reason steps from a plan.
    Searches through nested structures like loop bodies and if/then branches.
    """
    analyze_steps = []

    for step in steps:
        # Check if this step is an analyze_note_with_span_and_reason tool
        if step.get("tool") == "analyze_note_with_span_and_reason":
            analyze_steps.append(step)

        # Recursively search in loop bodies
        if step.get("type") == "loop" and "body" in step:
            analyze_steps.extend(_extract_analyze_steps(step["body"]))

        # Recursively search in if/then branches
        if step.get("type") == "if" and "then" in step:
            then_step = step["then"]
            # then might be a single step or a list
            if isinstance(then_step, list):
                analyze_steps.extend(_extract_analyze_steps(then_step))
            else:
                analyze_steps.extend(_extract_analyze_steps([then_step]))

    return analyze_steps


def _process_experiment_in_background(
    experiment_name: str,
    patients: list,
    prompts: list,
    dataset_name: str,
    current_user: str
):
    """
    Background task to process experiment patients.
    Updates status file after each patient and handles errors.
    """
    try:
        # Mark as running
        update_status_file(experiment_name, {
            "status": "running",
            "started_at": datetime.datetime.now().isoformat()
        })

        processed_count = 0
        error_count = 0
        total_flags = 0

        for patient_summary in patients:
            mrn = patient_summary.get("mrn")

            try:
                # Get full patient details to access encounters
                patient_details = get_patient_details(str(mrn), dataset_name, current_user)

                if not patient_details or not patient_details.get("encounters"):
                    logger.warning(f"Patient {mrn} has no encounters, skipping")
                    error_count += 1

                    # Record error in status
                    update_status_file(experiment_name, {
                        "progress.failed_count": error_count,
                        "errors": read_status_file(experiment_name).get("errors", []) + [{
                            "mrn": str(mrn),
                            "error": "No encounters found"
                        }]
                    })
                    continue

                # Get first encounter
                first_encounter = patient_details["encounters"][0]
                csn = first_encounter.get("csn")

                # Run workflow on this patient's first encounter
                result = run_workflow_sdoh(mrn, csn, prompts)

                # Result now contains: {mrn, csn, output_definitions, output_values}
                patient_result = result

                # Count detected flags from output values
                output_values = result.get("output_values", [])
                flags_detected = sum(
                    1 for v in output_values
                    if v.get("values", {}).get("detected") is True
                )
                total_flags += flags_detected

                # Save incrementally
                append_patient_result(experiment_name, patient_result)
                processed_count += 1

                # Update progress
                update_status_file(experiment_name, {
                    "progress.processed_count": processed_count,
                    "progress.current_patient_mrn": str(mrn),
                    "total_flags_detected": total_flags
                })

                logger.info(f"Processed patient {mrn}, encounter {csn} - {flags_detected} flags detected")

            except Exception as e:
                logger.error(f"Error processing patient {mrn}: {e}")
                error_count += 1

                # Record error in status
                current_status = read_status_file(experiment_name)
                if current_status:
                    errors = current_status.get("errors", [])
                    errors.append({
                        "mrn": str(mrn),
                        "error": str(e)
                    })
                    update_status_file(experiment_name, {
                        "progress.failed_count": error_count,
                        "errors": errors
                    })
                continue

        # Determine final status
        if error_count > 0 and processed_count == 0:
            final_status = "failed"
        elif error_count > 0:
            final_status = "partial_complete"
        else:
            final_status = "completed"

        # Update final status
        update_status_file(experiment_name, {
            "status": final_status,
            "completed_at": datetime.datetime.now().isoformat()
        })

        logger.info(f"Experiment {experiment_name} completed: {processed_count} processed, {error_count} failed")

    except Exception as e:
        logger.error(f"Critical error in experiment {experiment_name}: {e}")
        update_status_file(experiment_name, {
            "status": "failed",
            "completed_at": datetime.datetime.now().isoformat(),
            "errors": [{
                "error": f"Critical error: {str(e)}"
            }]
        })

    finally:
        # Invalidate cache so new results are picked up
        invalidate_experiment_cache()


@router.post("/experiments")
def create_experiment(
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Create and execute a new experiment asynchronously.
    Queues a background task to run a workflow on a project's dataset.
    """
    try:
        project_name = data.get("project_name")
        experiment_name = data.get("experiment_name")
        workflow_name = data.get("workflow_name", "Delirium_v1")

        if not all([project_name, experiment_name]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: project_name, experiment_name"
            )

        # Validate project exists
        if not project_exists(project_name):
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_name}' not found"
            )

        # Get project details (with permission check)
        project = get_project(project_name, current_user)
        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_name}' not found"
            )

        dataset_name = project.get("dataset")

        if not dataset_name:
            raise HTTPException(
                status_code=400,
                detail=f"Project '{project_name}' has no dataset assigned"
            )

        # Check if experiment name already exists
        experiment_dir = os.path.join(EXPERIMENTS_DIR, experiment_name)
        if os.path.exists(experiment_dir):
            raise HTTPException(
                status_code=409,
                detail=f"Experiment '{experiment_name}' already exists"
            )

        # Load dataset (with permission check)
        dataset_summary = get_patient_dataset_summary(dataset_name, current_user)
        if not dataset_summary:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_name}' not found or access denied"
            )

        patients = dataset_summary.get("patients", [])
        if not patients:
            raise HTTPException(
                status_code=400,
                detail=f"Dataset '{dataset_name}' has no patients"
            )

        # Filter patients if specific MRNs provided
        mrns = data.get("mrns")
        if mrns:
            original_count = len(patients)
            # Convert MRNs to strings for comparison
            mrn_set = set(str(mrn) for mrn in mrns)
            patients = [p for p in patients if str(p.get("mrn")) in mrn_set]

            if not patients:
                raise HTTPException(
                    status_code=400,
                    detail="None of the provided MRNs found in dataset"
                )

            logger.info(f"Filtered to {len(patients)} of {original_count} patients based on provided MRNs")

        # Create experiment folder
        create_experiment_folder(experiment_name, project_name, workflow_name, dataset_name)

        # Load workflow plan and extract prompts (with permission check)
        plan_data = get_plan(workflow_name, current_user)
        if not plan_data:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow '{workflow_name}' not found or access denied"
            )

        raw_plan = plan_data.get("raw_plan", {})
        steps = raw_plan.get("steps", [])

        # Extract all analyze_note_with_span_and_reason steps (recursively searches nested structures)
        analyze_steps = _extract_analyze_steps(steps)

        # Validate exactly 9 analyze steps
        if len(analyze_steps) != 9:
            raise HTTPException(
                status_code=400,
                detail=f"Workflow must contain exactly 9 'analyze_note_with_span_and_reason' steps, found {len(analyze_steps)}"
            )

        # Convert prompt dicts to PromptInput objects
        prompts = [
            PromptInput(**step["inputs"]["prompt"])
            for step in analyze_steps
        ]

        # Create status file for progress tracking
        create_status_file(experiment_name, len(patients))

        # Invalidate cache so new experiment appears immediately in queries
        invalidate_experiment_cache()

        # Queue background task to process patients
        background_tasks.add_task(
            _process_experiment_in_background,
            experiment_name=experiment_name,
            patients=patients,
            prompts=prompts,
            dataset_name=dataset_name,
            current_user=current_user
        )

        logger.info(f"Queued experiment {experiment_name} for processing with {len(patients)} patients")

        return JSONResponse(
            status_code=202,
            content={
                "status": "accepted",
                "message": "Experiment started and is processing in the background",
                "experiment_name": experiment_name,
                "project_name": project_name,
                "total_patients": len(patients)
            },
            headers={"Location": f"/api/workflow/experiments/{experiment_name}/status"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_experiment: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
