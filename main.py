import json
import numpy as np
import numpy.linalg as la
import pandas as pd
from sanic import Sanic
from sanic.response import json as sanic_json

num_points = 100

with open('assets/derby-data.json', 'r') as f:
    contents = json.load(f)
    hits = contents['hrs']

hit_data = {}

for i, hit in enumerate(hits):
    player_id = hit['playerId']
    trajectoryData = hit['result']['hit']
    round = hit['round']
    polyx, polyy, polyz, interval = trajectoryData.values()
    dx, dy, dz = np.polyder(polyx[::-1]), np.polyder(polyy[::-1]), np.polyder(polyz[::-1])

    roots = np.roots(polyz[::-1])
    real_roots = np.real(roots[np.abs(np.imag(roots)) < 1e-8])
    real_roots = np.sort(real_roots[real_roots >= 1.])

    beta = real_roots[0]
    t = np.linspace(interval[0], beta, num_points)
    x = np.polyval(polyx[::-1], t)
    y = np.polyval(polyy[::-1], t)
    z = np.polyval(polyz[::-1], t)
    speeds = la.norm(np.row_stack((np.polyval(dx, t), np.polyval(dy, t), np.polyval(dz, t))), ord=2, axis=0)

    if not player_id in hit_data:
        hit_data[player_id] = {
            'name': hit['playerName'],
            'num_home_runs': hit['numHomeRuns'],
            'rounds': {}
        }

    if not round in hit_data[player_id]['rounds']:
        hit_data[player_id]['rounds'][round] = []

    hit_data[player_id]['rounds'][round].append({
        'metrics': hit['result']['computedMetrics'],
        'player_id': player_id,
        'round': round,
        't': t.tolist(),
        'x': x.tolist(),
        'y': y.tolist(),
        'z': z.tolist(),
        'speeds': speeds.tolist(),
    })

app = Sanic('Baseball Viz')
app.static('/', 'frontend/public/index.html')
app.static('/', 'frontend/public/')
app.static('/node', 'frontend/node_modules/')

@app.get('/hits')
async def get_hits(request):
    return sanic_json(hit_data)
