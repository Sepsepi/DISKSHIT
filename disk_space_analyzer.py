import os
import platform
from typing import Dict, Tuple, List
import sys
import io
# Ensure UTF-8 output for all prints (fixes Unicode errors in Electron/Windows)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import concurrent.futures
from typing import Dict, Tuple
from collections import defaultdict
import threading


def list_available_disks() -> list:
    """Return a list of available disks (drive letters on Windows, mount points on Unix/Mac)."""
    disks = []
    if os.name == 'nt':
        # Windows: check A-Z for valid drives
        import string
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                disks.append(drive)
    else:
        # Unix/Mac: root and /Volumes/*
        disks.append('/')
        volumes = '/Volumes'
        if os.path.exists(volumes):
            for name in os.listdir(volumes):
                path = os.path.join(volumes, name)
                if os.path.ismount(path):
                    disks.append(path)
    return disks

def get_directory_size(path: str, log=False, top_level=False) -> float:
    """Calculate total size of a directory."""
    total = 0
    try:
        if log and top_level:
            print(f"[Scan] Scanning: {path}", flush=True)
        with os.scandir(path) as entries:
            for entry in entries:
                try:
                    if entry.is_file(follow_symlinks=False):
                        total += entry.stat(follow_symlinks=False).st_size
                    elif entry.is_dir(follow_symlinks=False):
                        total += get_directory_size(entry.path, log=log)
                except (OSError, PermissionError) as e:
                    if log and top_level:
                        print(f"[Error] Could not access {entry.path}: {e}", flush=True)
                    continue
    except (OSError, PermissionError) as e:
        if log and top_level:
            print(f"[Error] Could not scan {path}: {e}", flush=True)
        return 0
    return total

def format_size(size_in_bytes: float) -> str:
    """Format size in bytes to human readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_in_bytes < 1024:
            return f"{size_in_bytes:.2f} {unit}"
        size_in_bytes /= 1024
    return f"{size_in_bytes:.2f} PB"

def process_directory(path: str, current_depth: int, max_depth: int, log=False, stats=None) -> Dict[str, Tuple[float, Dict]]:
    """Process a directory and return its size and structure."""
    if stats is None:
        stats = {'scanned': 0, 'skipped': 0, 'included': 0}
    if current_depth > max_depth:
        return {}
    result = {}
    try:
        if log and current_depth == 0:
            print(f"[Scan] Started scan: {path}", flush=True)
        with os.scandir(path) as entries:
            dirs = [entry for entry in entries if entry.is_dir(follow_symlinks=False)]
            for dir_entry in dirs:
                try:
                    dir_path = dir_entry.path
                    stats['scanned'] += 1
                    dir_size = get_directory_size(dir_path, log=False)
                    if dir_size > 100 * 1024 * 1024:
                        subdirs = process_directory(dir_path, current_depth + 1, max_depth, log=log, stats=stats)
                        result[dir_entry.name] = (dir_size, subdirs)
                        stats['included'] += 1
                        if log:
                            print(f"[Result] Included: {dir_path} ({dir_size/1024/1024:.1f} MB)", flush=True)
                except (OSError, PermissionError) as e:
                    stats['skipped'] += 1
                    if log:
                        print(f"[Error] Skipped: {dir_entry.path} ({e})", flush=True)
                    continue
    except (OSError, PermissionError) as e:
        stats['skipped'] += 1
        if log:
            print(f"[Error] Could not access: {path} ({e})", flush=True)
        return {}
    if log and current_depth == 0:
        print(f"[Summary] Directories scanned: {stats['scanned']}, included: {stats['included']}, skipped: {stats['skipped']}", flush=True)
    return dict(sorted(result.items(), key=lambda x: x[1][0], reverse=True))

def print_directory_tree(structure: Dict[str, Tuple[float, Dict]], prefix: str = "", is_last: bool = True):
    """Print the directory structure in a tree-like format."""
    for i, (name, (size, subdirs)) in enumerate(structure.items()):
        is_last_item = i == len(structure) - 1
        current_prefix = prefix + ("└── " if is_last_item else "├── ")
        next_prefix = prefix + ("    " if is_last_item else "│   ")
        
        # Print current directory with size
        print(f"{current_prefix}{name} ({format_size(size)})")
        
        # Recursively print subdirectories
        if subdirs:
            print_directory_tree(subdirs, next_prefix, is_last_item)

def analyze_disk_space(root_path: str, max_depth: int = 3, json_output: bool = False, log: bool = False):
    """Analyze disk space usage and display results, optionally as JSON for integration."""
    import json
    try:
        # Get root directory size
        root_size = get_directory_size(root_path, log=log)
        structure = process_directory(root_path, 0, max_depth, log=log)
        if json_output:
            output = {
                "root": root_path,
                "total_size": root_size,
                "structure": structure
            }
            def convert(obj):
                # Convert tuples to lists for JSON serialization
                if isinstance(obj, dict):
                    return {k: convert(v) for k, v in obj.items()}
                elif isinstance(obj, tuple):
                    return [convert(i) for i in obj]
                else:
                    return obj
            print(json.dumps(convert(output), indent=2))
        else:
            print(f"\nAnalyzing disk space usage in {root_path} (up to {max_depth} levels deep)")
            print("Only showing directories larger than 100MB\n")
            print(f"Total size: {format_size(root_size)}\n")
            if structure:
                print("Directory Structure:")
                print_directory_tree(structure)
            else:
                print("No directories larger than 100MB found.")
    except Exception as e:
        print(f"Error analyzing directory: {e}")

if __name__ == "__main__":
    import argparse
    import json
    parser = argparse.ArgumentParser(description="Disk Space Analyzer")
    parser.add_argument('root', nargs='?', help='Root directory to scan')
    parser.add_argument('--depth', type=int, default=3, help='Max scan depth')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--list-disks', action='store_true', help='List available disks and exit')
    parser.add_argument('--log', action='store_true', help='Enable verbose scan logging for UI')
    args = parser.parse_args()

    if args.list_disks:
        print(json.dumps(list_available_disks()))
        exit(0)

    analyze_disk_space(args.root, args.depth, args.json, log=args.log)
