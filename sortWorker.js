function sortGaussiansByDepth(gaussians, viewMatrix) {

	const calcDepth = (i) => gaussians.positions[i*3] * viewMatrix[12] +
							 gaussians.positions[i*3+1] * viewMatrix[13] +
							 gaussians.positions[i*3+2] * viewMatrix[14] +
							 1 * viewMatrix[15];

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

self.onmessage = function(event) {
    const data = event.data;
    const sortedData = sortGaussiansByDepth(data.gaussians, data.viewMatrix); // Example sorting logic
    self.postMessage(sortedData); // Send back the sorted data
};