"""Per-map crop, transform and hand edits. The hand edits here are the ones
each tools/city/<city>/method.md lists; build.py applies them to the raw
raster before the automatic pass.

Cells are (x, y) board cells, x right and y down, (0, 0) the top-left border
cell. An edit's `cells` is 'x0-x1,y0-y1' (inclusive), several joined by ';'.
"""

# One Overpass query box per city (south, west, north, east): the boards of
# every map built from that city, plus 120 m (see fetch.py).
FETCH_BBOX = {
    'rome': (41.88564, 12.48723, 41.89235, 12.49621),
    'barcelona': (41.40196, 2.16997, 41.41057, 2.18114),
    'budapest': (47.4934, 19.03701, 47.50198, 19.05324),
}

CITIES = {
    'rome': {
        'city': 'rome',
        'title': 'Rome, Colosseum',
        'signature': {'on': 'board', 'what': 'the Colosseum as a ring with four arches', 'cells': 'ring',
                      'skyline': 'the Vittoriano stands about 1 km north-west of the Colosseum, past the '
                                 'far edge and to the left; it is not in this extract'},
        'landmark': ('relation', 1834818),
        'anchor_what': 'Colosseo footprint centroid',
        'cell_m': 14.0,
        'rotation_deg': 0.0,
        'anchor_cell': (21.5, 7.5),
        'landmark_rule': {'size': (13, 11), 'openings': '20-22,2;20-22,12;15,6-8;27,6-8'},
        'edits': [
            {'set': ' ', 'cells': '31-33,15',
             'why': 'reopen the street between the two Celio blocks on the east edge'},
            {'set': ' ', 'cells': '23,31-32', 'why': 'split the 18-cell building complex at the bottom in two'},
        ],
        'outputs': {'grid': 'public/maps/city/rome.txt', 'mask': 'public/maps/city/rome.mask.txt',
                    'raw': 'tools/city/rome/raw.txt', 'overlay': 'tools/city/rome/overlay.png',
                    'overlay_copies': ['docs/images/city-rome-overlay.png'], 'meta_key': None},
    },
    'barcelona': {
        'city': 'barcelona',
        'title': 'Barcelona, Eixample by the Sagrada Familia',
        'signature': {'on': 'skyline', 'what': 'Basilica de la Sagrada Familia, relation 9194723',
                      'from_extract': True},
        'landmark': ('relation', 9194723),
        'anchor_what': 'Basilica de la Sagrada Familia footprint centroid (off the board)',
        'cell_m': 14.0,
        # The 45-degree street alignment plus a quarter turn, so the board covers
        # the Placa de Gaudi side and the basilica stands past the far edge.
        'rotation_deg': 135.0,
        'anchor_cell': (7.0, -3.6),
        # Eixample blocks between the streets (rows 1-2, 10-12, 20-21, 29-30;
        # columns 1-2, 10-11, 20-21, 30-31). Placa de Gaudi (3-9, 3-9) stays a
        # park, and the block Avinguda de Gaudi cuts (12-19, 3-9) is already open.
        'blocks': [
            '22-29,4-10', '32-33,4-10',
            '3-9,12-18', '12-19,13-19', '22-29,13-19', '32-33,13-19',
            '3-9,22-28', '12-19,22-28', '22-29,22-28', '32-33,22-28',
            '3-9,31-33', '12-19,31-33', '22-29,31-33', '32-33,31-33',
        ],
        'edits': [],
        'outputs': {'grid': 'public/maps/city/barcelona.txt', 'mask': 'public/maps/city/barcelona.mask.txt',
                    'raw': 'tools/city/barcelona/raw.txt', 'overlay': 'tools/city/barcelona/overlay.png',
                    'overlay_copies': ['docs/images/city-barcelona-overlay.png'], 'meta_key': None},
    },
    'budapest': {
        'city': 'budapest',
        'title': 'Budapest, Chain Bridge (William Tierney Clark)',
        # The deck (mask d) and, as mask m, its two pylons: the compression
        # dropped the real ones, so they stand at the kept river's edges.
        'signature': {'on': 'board', 'what': 'the Chain Bridge: its deck, 3 cells wide, and two pylons',
                      'cells': '6-11,4-6', 'structure': '7,3;7,7;11,3;11,7',
                      'skyline': 'the Parliament stands about 1.3 km north on the Pest bank, the side '
                                 'east of the river (x 12 and up at the far edge)'},
        'landmark': ('way', 197110386),
        'anchor_what': 'Szechenyi Chain Bridge outline centroid',
        'cell_m': 14.0,
        'rotation_deg': 14.4,
        'anchor_cell': (0.0, 5.5),
        'water': {'keep': 5, 'at': 7},
        # Pest blocks that rasterise into blobs over 15 cells, and the partial
        # blocks on the east edge (they leave a lane along the border).
        'blocks': [{'cells': c, 'gates': 1} for c in (
            '26-29,4-8', '22-28,10-13', '24-28,16-24', '19-23,17-26', '26-30,26-30', '20-25,29-33',
            '32-33,5-8', '31-33,11-14')],
        'solid_corners': True,
        'edits': [
            {'set': ' ', 'cells': '24,5',
             'why': 'open the notch in the block east of the square into a passage'},
            {'set': 'W', 'cells': '33,25', 'why': 'close a one-cell notch on the east edge'},
            {'set': ' ', 'cells': '7-11,14-16',
             'why': 'second crossing (invented): a 3-cell deck from the Buda bank to the Pest street'},
        ],
        'outputs': {'grid': 'public/maps/city/budapest.txt', 'mask': 'public/maps/city/budapest.mask.txt',
                    'raw': 'tools/city/budapest/raw.txt', 'overlay': 'tools/city/budapest/overlay.png',
                    'overlay_copies': ['docs/images/city-budapest-overlay.png'], 'meta_key': None},
    },
    'budapest-fallback': {
        'city': 'budapest',
        'title': 'Budapest, Chain Bridge (fallback: river east of the spawns)',
        'signature': {'on': 'board', 'what': 'the Chain Bridge: its deck, 3 cells wide, and two pylons',
                      'cells': '15-20,4-6', 'structure': '16,3;16,7;20,3;20,7',
                      'skyline': 'the Parliament stands about 1.3 km north on the Pest bank, the side '
                                 'east of the river (x 21 and up at the far edge)'},
        'landmark': ('way', 197110386),
        'anchor_what': 'Szechenyi Chain Bridge outline centroid',
        'cell_m': 14.0,
        'rotation_deg': 14.4,
        'anchor_cell': (0.0, 5.5),
        'water': {'keep': 5, 'at': 16},
        # The Varkert Bazar on the Buda edge and the Pest blocks east of the river.
        'blocks': [{'cells': c, 'gates': 1}
                   for c in ('1-5,20-32', '28-32,17-26', '29-33,29-33', '31-33,3-7')],
        'solid_corners': True,
        'edits': [
            {'set': ' ', 'cells': '16-20,14-16',
             'why': 'second crossing (invented): a 3-cell deck from the Buda bank to the Pest street'},
        ],
        'outputs': {'grid': 'tools/city/budapest/fallback.txt', 'mask': 'tools/city/budapest/fallback.mask.txt',
                    'raw': 'tools/city/budapest/fallback.raw.txt', 'meta_key': 'fallback'},
    },
    'romeControl': {
        # A shipped arena mirrored left to right, shown with Rome's name and look.
        'mirror': 'akatsukiHideout',
        'axis': 'x',
        'outputs': {'grid': 'public/maps/city/romeControl.txt',
                    'mask': 'public/maps/city/romeControl.mask.txt'},
    },
}
