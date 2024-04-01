export async function loadPly(path) {

	const start = performance.now()
	const file = await fetch(path);
	const buffer = await file.arrayBuffer(); 
	const content = new TextDecoder().decode(buffer);

	// Read header
	const headerEnd = content.indexOf('end_header') + 'end_header'.length + 1
	const [ header ] = content.split('end_header')

	const regex = /element vertex (\d+)/
	const match = header.match(regex)
	let gaussianCount =  parseInt(match[1])
	let count = gaussianCount

	const positions = []
    const opacities = []
    const rotations = []
    const scales = []
    const harmonics = []
    const colors = []
    const cov3Ds = []

	// Create arrays for gaussian properties
	
    // Scene bouding box
    // sceneMin = new Array(3).fill(Infinity)
    // sceneMax = new Array(3).fill(-Infinity)

    // Helpers
    const sigmoid = (m1) => 1 / (1 + Math.exp(-m1))
    const NUM_PROPS = 62

    // Create a dataview to access the buffer's content on a byte levele
    const view = new DataView(buffer)

    // Get a slice of the dataview relative to a splat index
    const fromDataView = (splatID, start, end) => {
        const startOffset = headerEnd + splatID * NUM_PROPS * 4 + start * 4

        if (end == null) 
            return view.getFloat32(startOffset, true)

        return new Float32Array(end - start).map((_, i) => view.getFloat32(startOffset + i * 4, true))
    }

    // Extract all properties for a gaussian splat using the dataview
    const extractSplatData = (splatID) => {
        const position = fromDataView(splatID, 0, 3)
        // const n = fromDataView(splatID, 3, 6) // Not used
        const harmonic = fromDataView(splatID, 6, 9)
        
        const H_END = 6 + 48 // Offset of the last harmonic coefficient
        const opacity = fromDataView(splatID, H_END)
        const scale = fromDataView(splatID, H_END + 1, H_END + 4)
        const rotation = fromDataView(splatID, H_END + 4, H_END + 8)
    
        return { position, harmonic, opacity, scale, rotation }
    }

    for (let i = 0; i < gaussianCount; i++) {
        // Extract data for current gaussian
        let { position, harmonic, opacity, scale, rotation } = extractSplatData(i)
        
        // Update scene bounding box
        // sceneMin = sceneMin.map((v, j) => Math.min(v, position[j]))
        // sceneMax = sceneMax.map((v, j) => Math.max(v, position[j]))

        // Normalize quaternion
        let length2 = 0

        for (let j = 0; j < 4; j++)
            length2 += rotation[j] * rotation[j]

        const length = Math.sqrt(length2)

        rotation = rotation.map(v => v / length)  

        // Exponentiate scale
        scale = scale.map(v => Math.exp(v))

        // Activate alpha
        opacity = sigmoid(opacity)
        opacities.push(opacity)

        // (Webgl-specific) Equivalent to computeColorFromSH() with degree 0:
        // Use the first spherical harmonic to pre-compute the color.
        // This allow to avoid sending harmonics to the web worker or GPU,
        // but removes view-dependent lighting effects like reflections.
        // If we were to use a degree > 0, we would need to recompute the color 
        // each time the camera moves, and send many more harmonics to the worker:
        // Degree 1: 4 harmonics needed (12 floats) per gaussian
        // Degree 2: 9 harmonics needed (27 floats) per gaussian
        // Degree 3: 16 harmonics needed (48 floats) per gaussian
        const SH_C0 = 0.28209479177387814
        const color = [
            0.5 + SH_C0 * harmonic[0],
            0.5 + SH_C0 * harmonic[1],
            0.5 + SH_C0 * harmonic[2]
        ]
        colors.push(...color)
        // harmonics.push(...harmonic)

        // (Webgl-specific) Pre-compute the 3D covariance matrix from
        // the rotation and scale in order to avoid recomputing it at each frame.
        // This also allow to avoid sending rotations and scales to the web worker or GPU.
        const cov3D = computeCov3D(scale, 1, rotation)
        cov3Ds.push(...cov3D)
        // rotations.push(...rotation)
        // scales.push(...scale)

        positions.push(...position)
    }

    console.log(`Loaded ${gaussianCount} gaussians in ${((performance.now() - start)/1000).toFixed(3)}s`)
    
    return { positions, opacities, colors, cov3Ds, count }

}

import { mat3 } from 'https://cdn.skypack.dev/gl-matrix';
const tmp = mat3.create()
const S = mat3.create()
const R = mat3.create()
const M = mat3.create()
const Sigma = mat3.create()
function computeCov3D(scale, mod, rot) {
    // Create scaling matrix
    mat3.set(S,
        mod * scale[0], 0, 0,
        0, mod * scale[1], 0,
        0, 0, mod * scale[2]
    )

    const r = rot[0]
    const x = rot[1]
    const y = rot[2]
    const z = rot[3]

    // Compute rotation matrix from quaternion
    mat3.set(R,
        1. - 2. * (y * y + z * z), 2. * (x * y - r * z), 2. * (x * z + r * y),
        2. * (x * y + r * z), 1. - 2. * (x * x + z * z), 2. * (y * z - r * x),
        2. * (x * z - r * y), 2. * (y * z + r * x), 1. - 2. * (x * x + y * y)
    )

    mat3.multiply(M, S, R)  // M = S * R

    // Compute 3D world covariance matrix Sigma
    mat3.multiply(Sigma, mat3.transpose(tmp, M), M)  // Sigma = transpose(M) * M

    // Covariance is symmetric, only store upper right
    const cov3D = [
        Sigma[0], Sigma[1], Sigma[2],
        Sigma[4], Sigma[5], Sigma[8]
    ]

    return cov3D
}

function saveAsJson(data) {
	// Convert data to JSON string
	const jsonData = JSON.stringify(data);

	// Create a Blob object with the JSON data
	const blob = new Blob([jsonData], { type: 'application/json' });

	// Create a link element to trigger the download
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = 'exported_data.json'; // Specify the filename

	// Append the link to the document body and trigger the download
	document.body.appendChild(link);
	link.click();
}

export async function loadJson(path) {
	const start = performance.now();
	let file = await fetch(path);
	file = await file.json();
	console.log(`Loaded ${file.count} gaussians in ${((performance.now() - start)/1000).toFixed(3)}s`);
	return file;
}