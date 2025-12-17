import sys
import argparse
from core.auth import auth_service
from core.dataloders import user_loader


def main():
    parser = argparse.ArgumentParser(description='Create a new user with hashed password')
    parser.add_argument('--username', type=str, required=True, help='Username for the new user')
    parser.add_argument('--password', type=str, required=True, help='Password for the new user')
    parser.add_argument('--admin', action='store_true', help='Create user as admin')
    parser.add_argument('--datasets', type=str, help='Comma-separated list of datasets the user can access')

    args = parser.parse_args()

    # Validate inputs
    if len(args.username) < 3:
        print("Error: Username must be at least 3 characters long")
        sys.exit(1)

    if len(args.password) < 8:
        print("Error: Password must be at least 8 characters long")
        sys.exit(1)

    # Check if user already exists
    existing_user = user_loader.get_user(args.username)
    if existing_user:
        print(f"Error: User '{args.username}' already exists")
        sys.exit(1)

    # Hash password
    salt_bytes = auth_service.generate_salt()
    password_hash = auth_service.hash_pwd(args.password, salt_bytes)

    # Convert salt bytes to hex string for JSON storage
    import binascii
    salt = binascii.hexlify(salt_bytes).decode('ascii')

    # Parse datasets if provided
    allowed_datasets = []
    if args.datasets:
        allowed_datasets = [d.strip() for d in args.datasets.split(',')]

    # Create user data
    user_data = {
        "password_hash": password_hash,
        "salt": salt,
        "is_admin": args.admin,
        "allowed_datasets": allowed_datasets
    }

    # Save user
    success = user_loader.save_user(args.username, user_data)

    if success:
        role = "admin" if args.admin else "regular user"
        datasets_info = f" with access to datasets: {', '.join(allowed_datasets)}" if allowed_datasets else ""
        print(f"User '{args.username}' created successfully as {role}{datasets_info}")
        sys.exit(0)
    else:
        print(f"Failed to create user '{args.username}'")
        sys.exit(1)


if __name__ == "__main__":
    main()