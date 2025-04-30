# Disk Space Analyzer

A fast and efficient command-line tool to analyze and visualize disk space usage in a directory tree format.

## Features

- 🚀 Fast directory scanning with efficient algorithms
- 📊 Hierarchical tree visualization of directory sizes
- 📏 Human-readable size formats (B, KB, MB, GB, TB)
- 🔍 Focus on significant space usage (>100MB directories)
- 📂 Configurable scan depth
- ↕️ Directories sorted by size (largest first)

## Requirements

- Python 3.6 or higher

## Installation

1. Clone or download this repository
2. No additional dependencies required - uses only Python standard library

## Usage

```bash
python disk_space_analyzer.py <directory_path> [--depth <depth>]
```

### Arguments

- `directory_path`: The root directory to analyze (required)
- `--depth`: Maximum depth of directory scanning (default: 3)

### Examples

1. Analyze C: drive with default depth (3):
```bash
python disk_space_analyzer.py "C:/"
```

2. Analyze Downloads folder with depth 5:
```bash
python disk_space_analyzer.py "C:/Users/YourUser/Downloads" --depth 5
```

## Output Example

```
Analyzing disk space usage in C:/ (up to 3 levels deep)
Only showing directories larger than 100MB

Total size: 256.45 GB

Directory Structure:
├── Program Files (85.32 GB)
│   ├── Games (45.21 GB)
│   └── Applications (30.11 GB)
└── Users (120.45 GB)
    ├── Downloads (50.33 GB)
    └── Documents (35.67 GB)
```

## Features Explained

1. **Size Threshold**: Only directories larger than 100MB are shown to focus on significant space usage

2. **Tree Visualization**:
   - `├──` indicates a non-last item in a directory
   - `└──` indicates the last item in a directory
   - `│` shows the continuation of a branch

3. **Size Formatting**:
   - Automatically converts bytes to the most appropriate unit
   - Rounds to 2 decimal places for readability

4. **Performance**:
   - Efficient directory scanning
   - Skips inaccessible directories
   - Handles permission errors gracefully

## Notes

- The script requires appropriate permissions to read directory contents
- Some directories may be inaccessible due to system restrictions
- Size calculations include all nested files and subdirectories
- Running the analysis on large directories may take some time

## Error Handling

The script handles various error conditions:
- Permission denied errors
- Non-existent directories
- Inaccessible files/folders
- Invalid paths

## Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
