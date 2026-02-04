"""
Migration script to convert conversations from flat file format to folder structure.

Usage: python -m scripts.migrate_conversations

This script will:
1. Scan all .json files in the conversations/ directory
2. For each {uuid}.json file:
   - Create a folder conversations/{uuid}/
   - Move the file to conversations/{uuid}/conversation.json
3. Skip items that are already folders
4. Report any errors encountered
"""
import json
import os
import shutil
from datetime import datetime

# Get the directory where this script is located, then go up to conversations
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONVERSATIONS_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "conversations")


def migrate_conversation(json_path: str) -> bool:
    """
    Migrate a single conversation file to folder structure.

    Args:
        json_path: Full path to the {uuid}.json file

    Returns:
        True if migration was successful, False otherwise.
    """
    filename = os.path.basename(json_path)
    conversation_id = filename[:-5]  # Remove .json extension
    folder_path = os.path.join(CONVERSATIONS_DIR, conversation_id)
    new_json_path = os.path.join(folder_path, "conversation.json")

    # Check if folder already exists
    if os.path.isdir(folder_path):
        # Check if conversation.json exists inside
        if os.path.exists(new_json_path):
            print(f"  Already migrated, skipping")
            return True
        else:
            print(f"  Folder exists but no conversation.json, moving file")

    # Validate JSON before migrating
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)

        # Basic validation - check for required fields
        if 'conversation_id' not in data or 'messages' not in data:
            print(f"  Invalid format (missing required fields), skipping")
            return False

    except json.JSONDecodeError as e:
        print(f"  Invalid JSON: {e}, skipping")
        return False

    # Create the folder
    os.makedirs(folder_path, exist_ok=True)

    # Move the file
    shutil.move(json_path, new_json_path)

    print(f"  Migrated: {filename} -> {conversation_id}/conversation.json")
    return True


def main():
    """Migrate all conversations to folder structure."""
    print(f"Migration script started at {datetime.now().isoformat()}")
    print(f"Scanning {CONVERSATIONS_DIR}/ directory...\n")

    if not os.path.exists(CONVERSATIONS_DIR):
        print("No conversations directory found, nothing to migrate")
        return

    # Find all .json files (not folders)
    json_files = [
        f for f in os.listdir(CONVERSATIONS_DIR)
        if f.endswith('.json') and os.path.isfile(os.path.join(CONVERSATIONS_DIR, f))
    ]

    # Count existing folders (already migrated)
    existing_folders = [
        f for f in os.listdir(CONVERSATIONS_DIR)
        if os.path.isdir(os.path.join(CONVERSATIONS_DIR, f))
    ]

    print(f"Found {len(json_files)} JSON file(s) to migrate")
    print(f"Found {len(existing_folders)} existing folder(s)\n")

    if not json_files:
        print("No files to migrate")
        return

    migrated = 0
    skipped = 0
    failed = 0

    for filename in sorted(json_files):
        json_path = os.path.join(CONVERSATIONS_DIR, filename)
        print(f"Processing: {filename}")

        try:
            if migrate_conversation(json_path):
                migrated += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  Error: {e}")
            failed += 1

        print()

    print("=" * 50)
    print(f"Migration complete:")
    print(f"  - Migrated: {migrated}")
    print(f"  - Skipped:  {skipped}")
    print(f"  - Failed:   {failed}")
    print(f"\nFinished at {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
