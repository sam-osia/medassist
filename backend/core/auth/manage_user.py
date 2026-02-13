import sys
import argparse
from core.dataloaders import user_loader


def list_user(username: str):
    """Display user details."""
    user = user_loader.get_user(username)
    if not user:
        print(f"Error: User '{username}' not found")
        sys.exit(1)

    print(f"Username: {username}")
    print(f"Admin: {user.get('is_admin', False)}")
    print(f"Allowed datasets: {', '.join(user.get('allowed_datasets', [])) or 'None'}")
    print(f"Created: {user.get('created_date', 'Unknown')}")


def grant_dataset(username: str, dataset: str):
    """Grant dataset access to user."""
    success = user_loader.add_dataset_access(username, dataset)
    if success:
        print(f"Granted dataset '{dataset}' access to user '{username}'")
        sys.exit(0)
    else:
        print(f"Failed to grant dataset access (user may not exist)")
        sys.exit(1)


def revoke_dataset(username: str, dataset: str):
    """Revoke dataset access from user."""
    success = user_loader.remove_dataset_access(username, dataset)
    if success:
        print(f"Revoked dataset '{dataset}' access from user '{username}'")
        sys.exit(0)
    else:
        print(f"Failed to revoke dataset access (user may not exist)")
        sys.exit(1)


def set_admin(username: str, is_admin: bool):
    """Set or unset admin status for user."""
    user = user_loader.get_user(username)
    if not user:
        print(f"Error: User '{username}' not found")
        sys.exit(1)

    user['is_admin'] = is_admin
    success = user_loader.save_user(username, user)

    if success:
        status = "admin" if is_admin else "regular user"
        print(f"User '{username}' is now a {status}")
        sys.exit(0)
    else:
        print(f"Failed to update user '{username}'")
        sys.exit(1)


def list_all_users():
    """List all users."""
    users = user_loader.list_users()

    if not users:
        print("No users found")
        return

    print(f"Total users: {len(users)}")
    print()

    for user in users:
        username = user.get('username')
        is_admin = user.get('is_admin', False)
        datasets = user.get('allowed_datasets', [])

        admin_badge = " [ADMIN]" if is_admin else ""
        datasets_info = f", datasets: {', '.join(datasets)}" if datasets else ""

        print(f"- {username}{admin_badge}{datasets_info}")


def delete_user(username: str):
    """Delete a user."""
    user = user_loader.get_user(username)
    if not user:
        print(f"Error: User '{username}' not found")
        sys.exit(1)

    # Confirm deletion
    confirm = input(f"Are you sure you want to delete user '{username}'? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Deletion cancelled")
        sys.exit(0)

    success = user_loader.delete_user(username)
    if success:
        print(f"User '{username}' deleted successfully")
        sys.exit(0)
    else:
        print(f"Failed to delete user '{username}'")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Manage user permissions')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # List user command
    list_parser = subparsers.add_parser('show', help='Show user details')
    list_parser.add_argument('username', type=str, help='Username to show')

    # List all users command
    subparsers.add_parser('list', help='List all users')

    # Grant dataset command
    grant_parser = subparsers.add_parser('grant-dataset', help='Grant dataset access to user')
    grant_parser.add_argument('username', type=str, help='Username')
    grant_parser.add_argument('dataset', type=str, help='Dataset name')

    # Revoke dataset command
    revoke_parser = subparsers.add_parser('revoke-dataset', help='Revoke dataset access from user')
    revoke_parser.add_argument('username', type=str, help='Username')
    revoke_parser.add_argument('dataset', type=str, help='Dataset name')

    # Make admin command
    admin_parser = subparsers.add_parser('make-admin', help='Make user an admin')
    admin_parser.add_argument('username', type=str, help='Username')

    # Remove admin command
    remove_admin_parser = subparsers.add_parser('remove-admin', help='Remove admin privileges from user')
    remove_admin_parser.add_argument('username', type=str, help='Username')

    # Delete user command
    delete_parser = subparsers.add_parser('delete', help='Delete a user')
    delete_parser.add_argument('username', type=str, help='Username to delete')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Execute command
    if args.command == 'show':
        list_user(args.username)
    elif args.command == 'list':
        list_all_users()
    elif args.command == 'grant-dataset':
        grant_dataset(args.username, args.dataset)
    elif args.command == 'revoke-dataset':
        revoke_dataset(args.username, args.dataset)
    elif args.command == 'make-admin':
        set_admin(args.username, True)
    elif args.command == 'remove-admin':
        set_admin(args.username, False)
    elif args.command == 'delete':
        delete_user(args.username)


if __name__ == "__main__":
    main()
