"""The soft-target table: the 7 shipped arenas against the city maps.

Usage: table.py

Measured after the engine's spawn carve (4 seats), crates counted as
passable. The blob column leaves out water and the on-board landmark (mask
w and m), as the plan's target does.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import metrics  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
SHIPPED = ['hiddenLeaf', 'hiddenSand', 'hiddenMist', 'hiddenCloud', 'hiddenStone', 'akatsukiHideout',
           'greatShinobiWar']
CITY = [('rome', 'public/maps/city/rome'), ('barcelona', 'public/maps/city/barcelona'),
        ('budapest', 'public/maps/city/budapest'), ('budapest fallback', 'tools/city/budapest/fallback'),
        ('romeControl', 'public/maps/city/romeControl')]


def row(name, grid_path, mask_path=None):
    grid = metrics.read_map(grid_path)
    exempt = metrics.exempt_cells(metrics.read_map(mask_path)) if mask_path else frozenset()
    m = metrics.measure(grid, exempt=exempt)
    return (f"| {name} | {m['playable_pct']} | {m['walls_pct']} | {m['crate_share_of_playable_pct']} | "
            f"{m['articulation_points']} ({m['ap_pct_of_playable']}%) | {m['dead_ends']} | "
            f"{m['width_hist_pct']['1']} | {m['wall_shapes']['max_blob_rated']} | "
            f"{m['longest_line_struct']} / {m['longest_line_opening']} | {m['opening_reach'][0]} |")


def main():
    print('| Map | Playable % | Walls % | Crates % of playable | Articulation points | Dead ends | '
          '1-wide % | Largest wall blob | Longest line, no crates / crates | Start network |')
    print('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for name in SHIPPED:
        print(row(name, REPO / 'public' / 'maps' / f'{name}.txt'))
    for name, base in CITY:
        print(row(name, REPO / f'{base}.txt', REPO / f'{base}.mask.txt'))


if __name__ == '__main__':
    main()
