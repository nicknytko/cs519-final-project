import json
import numpy as np
import pandas as pd
from sanic import Sanic
from sanic.response import json as sanic_json

num_points = 100

with open('assets/derby-data.json', 'r') as f:
    contents = json.load(f)
    hits = contents['hrs']

hit_data = []

for i, hit in enumerate(hits):
    trajectoryData = hit['result']['hit']
    polyx, polyy, polyz, interval = trajectoryData.values()

    roots = np.roots(polyz[::-1])
    real_roots = np.real(roots[np.abs(np.imag(roots)) < 1e-8])
    real_roots = np.sort(real_roots[real_roots >= 1.])

    beta = real_roots[0]
    t = np.linspace(interval[0], beta, num_points)
    x = np.polyval(polyx[::-1], t)
    y = np.polyval(polyy[::-1], t)
    z = np.polyval(polyz[::-1], t)

    hit_data.append({
        't': t.tolist(),
        'x': x.tolist(),
        'y': y.tolist(),
        'z': z.tolist()
    })

app = Sanic('Baseball Viz')
app.static('/', 'frontend/public/index.html')
app.static('/', 'frontend/public/')
app.static('/node', 'frontend/node_modules/')

@app.get('/hits')
async def get_hits(request):
    return sanic_json(hit_data)
