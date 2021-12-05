import dash
import dash_core_components as dcc
import dash_html_components as html
from dash.dependencies import Input, Output
import plotly.express as px
import plotly.graph_objects as go
import json
import numpy as np
import pandas as pd
from PIL import Image

num_points = 100

with open('derby-data.json', 'r') as f:
    contents = json.load(f)
    hits = contents['hrs']
    pass

xs = []
ys = []
zs = []
color = []

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

    xs.extend(x)
    ys.extend(y)
    zs.extend(z)
    color.extend([i] * num_points)

df = pd.DataFrame(dict(
    X=xs,
    Y=ys,
    Z=zs,
    color=color
))

#fig = go.Figure()
fig = px.line_3d(df, x='X', y='Y', z='Z', color='color')
fig.update_layout(scene_aspectmode='manual', scene_aspectratio=dict(x=5, y=5, z=1 ))
# fig.add_trace(go.Mesh3d(
#         # 8 vertices of a cube
#         x=[0, 0, 100, 100, 0, 0, 100, 100],
#         y=[0, 100, 100, 0, 0, 100, 100, 0],
#         z=[0, 0, 0, 0, 100, 100, 100, 100],
#         colorbar_title='z',
#         colorscale=[[0, 'gold'],
#                     [0.5, 'mediumturquoise'],
#                     [1, 'magenta']],
#         # Intensity of each vertex, which will be interpolated and color-coded
#         intensity = np.linspace(0, 1, 8, endpoint=True),
#         # i, j and k give the vertices of triangles
#         i = [7, 0, 0, 0, 4, 4, 6, 6, 4, 0, 3, 2],
#         j = [3, 4, 1, 2, 5, 6, 5, 2, 0, 1, 6, 3],
#         k = [0, 7, 2, 3, 6, 7, 1, 1, 5, 5, 7, 6],
#         name='y',
#         showscale=True
#     ))
# fig.add_layout_image(
#     dict(
#         source='./base.png',
#         xref='paper', yref='paper',
#         x=1, y=1.05,
#         sizex=500, sizey=500,
#         xanchor='center', yanchor='bottom'
#     )
# )

img = Image.open("base.png")
img = np.array(img, dtype=np.int64)
# img = plt.imread('base.png').T
print(np.min(img), np.max(img))

x = np.arange(500) - 250
y = np.arange(500) - 120

xx, yy = np.meshgrid(x, y)

fig.add_trace(go.Surface(
    z=-4*np.ones((img.shape[0], img.shape[1])),
    x=xx,
    y=yy,
    surfacecolor=np.flipud(img),
    colorscale='greens',
    cmin=0, cmax=255.,
    ))

app = dash.Dash(__name__)
app.layout = html.Div(children=[
    dcc.Graph(
        id='example-graph',
        figure=fig,
        style={
            'width': '99vw',
            'height': '99vh'
        }
    )
])

# @app.callback(
#     Output("scatter-plot", "figure"),
#     [Input("range-slider", "value")])
# def update_bar_chart(slider_range):
#     #low, high = slider_range
#     #mask = (df.petal_width > low) & (df.petal_width < high)

    
#     # fig = px.scatter_3d(df[mask],
#     #     x='sepal_length', y='sepal_width', z='petal_width',
#     #     color="species", hover_data=['petal_width'])
#     # return fig
#     #fig = px.line_3d(x=xs, y=ys, z=zs)
#     #for x, y, z in zip(xs, ys, zs):
#     #    fig = px.line_3d(x=x, y=y, z=z)
#     #return fig
#     #return fig
app.run_server(debug=True)
