export function sortGaussiansByDepth(gaussians, viewMatrix) {

	const calcDepth = (i) => gaussians.positions[i*3] * viewMatrix[2] +
                             gaussians.positions[i*3+1] * viewMatrix[6] +
                             gaussians.positions[i*3+2] * viewMatrix[10]

	// gaussians.positions.sort((a, b) => {
	// 	const depthA = calcDepth(gaussians.positions.indexOf(a) / 3);
	// 	const depthB = calcDepth(gaussians.positions.indexOf(b) / 3);
	// 	return depthA - depthB;
	// });

	// return gaussians;

	let t = performance.now() / 1000;

	let indices = new Array(gaussians.count)
            	.fill(0)
            	.map((_, i) => ({
            	    depth: calcDepth(i),
            	    index: i
            	}))
            	.sort((a, b) => a.depth - b.depth)
            	.map(v => v.index)

	let indexBuffer = [];
	for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        for (let j = 0; j < 6; j++) {
            indexBuffer.push(index * 6 + j);
        }
    }

	console.log(performance.now() / 1000 - t);

	return new Uint32Array(indexBuffer);

	// indices = indices.flatMap(num => Array(6).fill(num));
	// return getGaussiansFromSortedIndices(gaussians, indices);
	// return new Uint32Array(indices);
}

export function sortGaussiansByDepth2(gaussians, viewMatrix) {

	const calcDepth = (i) => gaussians.positions[i*3] * viewMatrix[2] +
                             gaussians.positions[i*3+1] * viewMatrix[6] +
                             gaussians.positions[i*3+2] * viewMatrix[10]

	// gaussians.positions.sort((a, b) => {
	// 	const depthA = calcDepth(gaussians.positions.indexOf(a) / 3);
	// 	const depthB = calcDepth(gaussians.positions.indexOf(b) / 3);
	// 	return depthA - depthB;
	// });

	// return gaussians;

	const indices = new Array(gaussians.count)
            	.fill(0)
            	.map((_, i) => ({
            	    depth: calcDepth(i),
            	    index: i
            	}))
            	.sort((a, b) => a.depth - b.depth)
            	.map(v => v.index)

	// return getGaussiansFromSortedIndices(gaussians, indices);
	return new Uint32Array(indices)
}

export function getGaussiansFromSortedIndices(gaussians, indices) {

	let sorted = {
		positions: [],
		opacities: [],
		colors: [],
		cov3Ds: [],
		count: gaussians.count
	};

	for(let i = 0; i < indices.length; i++) {
		sorted.positions.push(
			gaussians.positions[indices[i]*3],
			gaussians.positions[indices[i]*3 + 1],
			gaussians.positions[indices[i]*3 + 2],
		);

		sorted.opacities.push(gaussians.opacities[indices[i]]);

		sorted.colors.push(
			gaussians.colors[indices[i]*3],
			gaussians.colors[indices[i]*3 + 1],
			gaussians.colors[indices[i]*3 + 2],
		);
		
		sorted.cov3Ds.push(
			gaussians.cov3Ds[indices[i]*6],
			gaussians.cov3Ds[indices[i]*6 + 1],
			gaussians.cov3Ds[indices[i]*6 + 2],
			gaussians.cov3Ds[indices[i]*6 + 3],
			gaussians.cov3Ds[indices[i]*6 + 4],
			gaussians.cov3Ds[indices[i]*6 + 5],
		);
	}

	return sorted;
}