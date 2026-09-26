#!/usr/bin/env python3
"""
Sudoku generator / solver used by plugins/sudoku.js

Usage:
    python3 sudoku.py generate <easy|medium|hard>
    python3 sudoku.py solve <81 digits, 0 = empty>

Always prints a single line of JSON to stdout.
"""

import json
import random
import sys

SIZE = 9
BOX = 3


def find_empty(grid):
    for r in range(SIZE):
        for c in range(SIZE):
            if grid[r][c] == 0:
                return r, c
    return None


def is_valid(grid, row, col, num):
    if num in grid[row]:
        return False
    if num in (grid[r][col] for r in range(SIZE)):
        return False
    br, bc = (row // BOX) * BOX, (col // BOX) * BOX
    for r in range(br, br + BOX):
        for c in range(bc, bc + BOX):
            if grid[r][c] == num:
                return False
    return True


def solve_grid(grid, randomized=False):
    """Fills grid in place with the first solution found. Returns True/False."""
    empty = find_empty(grid)
    if not empty:
        return True
    row, col = empty
    nums = list(range(1, 10))
    if randomized:
        random.shuffle(nums)
    for num in nums:
        if is_valid(grid, row, col, num):
            grid[row][col] = num
            if solve_grid(grid, randomized):
                return True
            grid[row][col] = 0
    return False


def count_solutions(grid, limit=2):
    """Counts solutions up to `limit` (stops early once limit is reached)."""
    empty = find_empty(grid)
    if not empty:
        return 1
    row, col = empty
    total = 0
    for num in range(1, 10):
        if is_valid(grid, row, col, num):
            grid[row][col] = num
            total += count_solutions(grid, limit - total)
            grid[row][col] = 0
            if total >= limit:
                break
    return total


def generate_full_grid():
    grid = [[0] * SIZE for _ in range(SIZE)]
    solve_grid(grid, randomized=True)
    return grid


def clues_for_difficulty(difficulty):
    return {
        "easy": random.randint(38, 45),
        "medium": random.randint(30, 36),
        "hard": random.randint(22, 27),
    }[difficulty]


def generate_puzzle(difficulty):
    solution = generate_full_grid()
    puzzle = [row[:] for row in solution]
    target_clues = clues_for_difficulty(difficulty)

    cells = [(r, c) for r in range(SIZE) for c in range(SIZE)]
    random.shuffle(cells)

    clues_left = SIZE * SIZE
    for (r, c) in cells:
        if clues_left <= target_clues:
            break
        backup = puzzle[r][c]
        puzzle[r][c] = 0

        # Keep the removal only if the puzzle still has a unique solution.
        test_grid = [row[:] for row in puzzle]
        if count_solutions(test_grid, limit=2) != 1:
            puzzle[r][c] = backup
        else:
            clues_left -= 1

    return puzzle, solution, clues_left


def grid_to_string(grid):
    return "".join(str(grid[r][c]) for r in range(SIZE) for c in range(SIZE))


def format_grid(grid):
    lines = []
    for r in range(SIZE):
        if r != 0 and r % BOX == 0:
            lines.append("------+-------+------")
        row_cells = []
        for c in range(SIZE):
            if c != 0 and c % BOX == 0:
                row_cells.append("|")
            val = grid[r][c]
            row_cells.append(str(val) if val != 0 else ".")
        lines.append(" ".join(row_cells))
    return "\n".join(lines)


def string_to_grid(s):
    return [[int(s[r * SIZE + c]) for c in range(SIZE)] for r in range(SIZE)]


def validate_initial_grid(grid):
    """Checks the given clues don't already break Sudoku rules."""
    for r in range(SIZE):
        for c in range(SIZE):
            val = grid[r][c]
            if val == 0:
                continue
            grid[r][c] = 0
            valid = is_valid(grid, r, c, val)
            grid[r][c] = val
            if not valid:
                return False
    return True


def cmd_generate(args):
    difficulty = args[0] if args else "medium"
    if difficulty not in ("easy", "medium", "hard"):
        print(json.dumps({"error": f"Invalid difficulty: {difficulty}"}))
        return

    puzzle, _solution, clues = generate_puzzle(difficulty)
    print(json.dumps({
        "puzzle": grid_to_string(puzzle),
        "formatted_puzzle": format_grid(puzzle),
        "clues": clues,
    }))


def cmd_solve(args):
    if not args or not args[0]:
        print(json.dumps({"error": "No puzzle provided."}))
        return

    raw = args[0].strip()
    if len(raw) != 81 or not raw.isdigit():
        print(json.dumps({"error": f"Puzzle must be exactly 81 digits (0-9). Got {len(raw)} characters."}))
        return

    grid = string_to_grid(raw)

    if not validate_initial_grid(grid):
        print(json.dumps({"error": "This puzzle has conflicting clues and cannot be solved."}))
        return

    original = [row[:] for row in grid]
    filled_cells = sum(1 for r in range(SIZE) for c in range(SIZE) if original[r][c] == 0)

    solved = solve_grid(grid, randomized=False)
    if not solved:
        print(json.dumps({"error": "No solution exists for this puzzle."}))
        return

    print(json.dumps({
        "filled": filled_cells,
        "formatted_puzzle": format_grid(original),
        "formatted_solution": format_grid(grid),
    }))


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No subcommand given. Use 'generate' or 'solve'."}))
        return

    subcmd = sys.argv[1].lower()
    rest = sys.argv[2:]

    if subcmd == "generate":
        cmd_generate(rest)
    elif subcmd == "solve":
        cmd_solve(rest)
    else:
        print(json.dumps({"error": f"Unknown subcommand: {subcmd}"}))


if __name__ == "__main__":
    main()
