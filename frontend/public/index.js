const loopLength = 1800;
const trailLength = 180;
const animationSpeed = 1
let time = 0;

function create_mesh(mesh_file, color) {
  return new deck.SimpleMeshLayer({
      id: mesh_file,
      coordinateSystem: deck.COORDINATE_SYSTEM.IDENTITY,
      data: [{}],
      mesh: mesh_file,
      loaders: [loaders.OBJLoader],
      getColor: color,
      getOrientation: [0, -90, 0],
      getPosition: [-0.16, 14, 0.],
  })
}

async function ajax_get(path) {
  return new Promise((res, rej) => {
      const req = new XMLHttpRequest();
      req.addEventListener('load', () => res(req.responseText));
      req.addEventListener('error', rej);
      req.addEventListener('abort', rej);
      req.open('GET', path);
      req.send();
  });
}

const deckgl = new deck.DeckGL({
    container: 'container',
    views: [new deck.OrbitView({fov: 75})],
    initialViewState: {target: [0, 0, 0], rotationX: 0, rotationOrbit: 45, zoom: 5},
    controller: true,
    layers: [],
    getTooltip: ({object}) => {
        if (object) {
            return {
                html: `<h3>${hit_data[object.player_id].name}</h3> <p> Exit velocity: ${object.metrics.exitVelocity.value.toFixed(2)} MPH </p> <p> Distance: ${object.metrics.projectedDistance.value.toFixed(2)} FT </p> <p> Launch angle: ${object.metrics.launchAngle.value.toFixed(2)} deg</p>`,
                style: {}
            };
        } else {
            return null;
        }
    },
});

function lerp(a_val, b_val, a_t, b_t, t) {
    if (t > b_t) {
        t = b_t;
    }
    if (t < a_t) {
        t = a_t;
    }
    t = (t - a_t) / (b_t - a_t);
    return a_val * (1-t) + b_val * t;
}

/* home plate 0, -13.831, 0 */
/* 1st base 9.112, -5.0643, 0 */
/* unit distance - 12.644507617538927, real distance 90ft */
const ft_to_unit = (12.644507617538927 / 90.0);

var last_timestamp = 0.0;
var hit_data = null;
var current_data = null;
var exit_velocity_min = 0.0;
var exit_velocity_max = 0.0;
var distance_min = 0.0;
var distance_max = 0.0;
var t_max = 0.0;
var trail_length = 1.0;
var should_animate = true;
var cmap_val = "player";
var player_id_hash = {};
var out_slice = 20.0;
var show_trails = true;
var show_slices = false;

const animation_stagger_mult = 0.05; /* how much the hit animations are delayed. multiplied by the hit index */

function step(timestamp) {
    let delta = (timestamp - last_timestamp) / 1000;
    last_timestamp = timestamp;

    time += delta;
    if (should_animate && time > t_max + trail_length) {
        time = 0.;
    } else if (!should_animate) {
        time = t_max;
    }
    window.requestAnimationFrame(step);
}
window.requestAnimationFrame(step);

function return_color(d, {index}){
    if (cmap_val == 'velocity') {
        const velocity = d.metrics.exitVelocity.value;
        const normalized = (velocity - exit_velocity_min) / (exit_velocity_max - exit_velocity_min);
        return evaluate_cmap(normalized, 'YlOrRd', true);
    } else if (cmap_val == 'distance') {
        const distance = d.metrics.projectedDistance.value;
        const normalized = (distance - distance_min) / (distance_max - distance_min);
        return evaluate_cmap(normalized, 'YlOrRd', false);
    } else if (cmap_val == 'round') {
        return round_colormap[d.round - 1];
    } else if (cmap_val == 'player') {
        return data["tab20"]["colors"][player_id_hash[d.player_id] % data["tab20"]["colors"].length].map(x => x * 255.);
    } else {
        return data["tab20"]["colors"][index % data["tab20"]["colors"].length].map(x => x * 255.);
    }
}

function redraw() {
    trips_layer = new deck.TripsLayer({
        id: 'arcs',
        data: current_data,
        pickable: true,
        capRounded: true,
        getTimestamps: (d, idx) => {
            let path = []
            for (let i = 0; i < d.x.length; i++) {
                path.push(d.t[i] + idx.index * animation_stagger_mult);
            }
            return path;
        },
        getPath: d => {
            let path = []
            for (let i = 0; i < d.x.length; i++) {
                path.push([d.x[i] * ft_to_unit, d.y[i] * ft_to_unit, d.z[i] * ft_to_unit]);
            }
            return path;
        },
        trailLength: trail_length,
        currentTime: time,
        fadeTrail: true,
        getWidth: 0.1,
        widthMaxPixels: 5,
        getColor: return_color,
        updateTriggers: {
            getColor: cmap_val,
        },
        opacity: show_trails ? 1 : 0.01,
        billboard: true,
    });

    var slices = new deck.ScatterplotLayer({
        id: 'heatmap',
        data: current_data,
        getPosition: d => {
            const low = d.slice_low;
            const high = d.slice_high;
            const x = lerp(d.x[low], d.x[high], d.y[low], d.y[high], out_slice);
            const y = lerp(d.y[low], d.y[high], d.y[low], d.y[high], out_slice);
            const z = lerp(d.z[low], d.z[high], d.y[low], d.y[high], out_slice);
            return [x * ft_to_unit, y * ft_to_unit, z * ft_to_unit];
        },
        getRadius: d => {
            const low = d.slice_low;
            const high = d.slice_high;
            return lerp(d.speeds[low], d.speeds[high], d.y[low], d.y[high], out_slice) / 200.0;
        },
        getFillColor: d => {
            const low = d.slice_low;
            const high = d.slice_high;
            const n = lerp(d.speeds[low], d.speeds[high], d.y[low], d.y[high], out_slice) / 200.0;
            return evaluate_cmap(n, 'YlOrRd', false);
        },
        updateTriggers: {
            getFillColor: out_slice,
            getPosition: out_slice,
            getRadius: out_slice,
        },
        billboard: true,
    });

    var layers = [
        create_mesh('/models/bases.obj', [200, 200, 200]),
        create_mesh('/models/mounds.obj', [248, 188, 160]),
        create_mesh('/models/lines.obj', [255, 255, 255]),

        new deck.SimpleMeshLayer({
            id: 'plane',
            coordinateSystem: deck.COORDINATE_SYSTEM.IDENTITY,
            data: [{}],
            mesh: new luma.PlaneGeometry({type: 'x,y', xlen: 100, ylen: 200}),
            getPosition: [-0.16, 88, -0.2],
            getColor: [93, 113, 55],
        }),
        trips_layer,
    ];
    if (show_slices) {
        layers.push(slices);
    }

    deckgl.setProps({layers});
}

(async () => {
    hit_data = JSON.parse(await ajax_get('/hits'));

    var i = 0;
    for (const [id, player] of Object.entries(hit_data)) {
        player_id_hash[id] = i; i+= 1;
        $('#player-dropdown').append(
            $(`<option value="${id}">${player.name}</option>`)
        );
    }

    const data_change = () => {
        const player_value = $('#player-dropdown').val();
        const round_dropdown = $('#round-dropdown').val();

        time = 0;
        if (player_value == 'all') {
            current_data = [];

            Object.values(hit_data).forEach((player) => {
                for (const [round, hits] of Object.entries(player.rounds)) {
                    if (round_dropdown != "all" && round != round_dropdown) {
                        continue;
                    }
                    hits.forEach(hit => current_data.push(hit));
                }
            });
        } else {
            current_data = [];

            for (const [round, hits] of Object.entries(hit_data[player_value].rounds)) {
                if (round_dropdown != "all" && round != round_dropdown) {
                    continue;
                }
                hits.forEach(hit => current_data.push(hit));
            }
        }

        exit_velocity_min = 1000.0;
        exit_velocity_max = 0.0;
        distance_min = 1000.0;
        distance_max = 0.0;
        t_max = 0.0;

        current_data.forEach((hit, i) => {
            const exit_velocity = hit.metrics.exitVelocity.value;
            const distance = hit.metrics.projectedDistance.value;
            const t = hit.t[hit.t.length - 1] + i * animation_stagger_mult;

            /* Update bounds; used for colormaps */
            if (exit_velocity < exit_velocity_min) {
                exit_velocity_min = exit_velocity;
            }
            if (exit_velocity > exit_velocity_max) {
                exit_velocity_max = exit_velocity;
            }
            if (distance < distance_min) {
                distance_min = distance;
            }
            if (distance > distance_max) {
                distance_max = distance;
            }
            if (t_max < t) {
                t_max = t;
            }
        });
    }
    const player_change = () => {
        // Clear round dropdown list
        $('#round-dropdown').empty().append(
            $(`<option value="all">All Hits</option>`)
        );
        const player_value = $('#player-dropdown').val();

        const round_id_to_name = {
            'all': "All",
            1: 'Quarterfinals',
            2: 'Semifinals',
            3: 'Finals',
        };
        if (player_value !== "all") {
            // Append new round ids to dropdown
            Object.keys(hit_data[player_value].rounds).forEach((round_id) =>
            {
                $('#round-dropdown').append(
                    $(`<option value="${round_id}">${round_id_to_name[round_id]}</option>`)
                )
            })
        } else {
            for (let i=1; i <= 3; i++) {
                $('#round-dropdown').append(
                    $(`<option value="${i}">${round_id_to_name[i]}</option>`)
                )
            }
        }
        data_change();
    };

    const reset_click = () => {
        time = 0;
    }

    $('#player-dropdown').change(player_change);
    $('#round-dropdown').change(data_change);
    $('#replay').click(reset_click);
    $('#colormap-dropdown').change(() => {
        cmap_val = $('#colormap-dropdown').val();
    });
    cmap_val = $('#colormap-dropdown').val();
    player_change();

    const animate_checked = () => {
        const checked = $("#animate-select").is(':checked');
        if (checked) {
            should_animate = true;
            time = 0;
            trail_length = 2;
        } else {
            should_animate = false;
            time = t_max;
            trail_length = t_max * 100;
        }
    }
    $('#animate-select').click(animate_checked);
    animate_checked();

    $("#trails-select").click(() => {
        show_trails = $("#trails-select").is(':checked');
    });
    show_trails = $("#trails-select").is(':checked');
    $("#slices-select").click(() => {
        show_slices = $("#slices-select").is(':checked');
    });
    show_slices = $("#slices-select").is(':checked');

    const compute_x_slice = () => {
        out_slice = $("#slice-select").val();

        current_data.forEach((hit, idx) => {
            const n = hit.y.length;
            let low = 0;
            let high = n-1;

            while ((high-low) > 1) {
                const middle = Math.floor((low+high)/2);
                if (hit.y[middle] < out_slice) {
                    low = middle;
                } else if (hit.y[middle] > out_slice) {
                    high = middle;
                }
            }

            hit.slice_low = low;
            hit.slice_high = high;
        });
    };
    compute_x_slice();
    $("#slice-select").on('input change', compute_x_slice);

    redraw();
    setInterval(redraw, 16);
})();
