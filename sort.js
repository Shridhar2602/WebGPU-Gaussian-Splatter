import { vec3, vec4, mat4, quat } from 'https://cdn.skypack.dev/gl-matrix';

export function sortGaussiansByDepth(gaussians, viewMatrix) {
	let t = performance.now() / 1000;
	var theta = -Math.PI;
	var rotationMatrix = mat4.create();
	mat4.rotateX(rotationMatrix, rotationMatrix, theta);
	var rotatedViewMatrix = mat4.create();
	mat4.multiply(rotatedViewMatrix, rotationMatrix, viewMatrix);

	const calcDepth = (i) => {
		
		return (gaussians.positions[i * 3] * rotatedViewMatrix[8] +
		gaussians.positions[i * 3 + 1] * rotatedViewMatrix[9] +
		gaussians.positions[i * 3 + 2] * rotatedViewMatrix[10] +
		rotatedViewMatrix[11]);
	}

	function getDepthFromViewMatrix(i) {
		// Convert the point to a glMatrix vec4
		const x = gaussians.positions[i * 3]
		const y = gaussians.positions[i * 3] + 1
		const z = gaussians.positions[i * 3] + 2
		const point = vec4.fromValues(x, y, z, 1);
	
		// Transform the point by the view matrix
		const cameraSpacePoint = vec4.create();
		mat4.multiply(cameraSpacePoint, viewMatrix, point);
	
		// The depth is the negative of the z-coordinate in camera space
		const depth = -cameraSpacePoint[2];
	
		return depth;
	}

	function quicksort(A, B, lo, hi) {
		if (lo < hi) {
			const p = partition(A, B, lo, hi) 
			quicksort(A, B, lo, p)
			quicksort(A, B, p + 1, hi) 
		}
	}
	function partition(A, B, lo, hi) {
		const pivot = A[Math.floor((hi - lo)/2) + lo]
		let i = lo - 1 
		let j = hi + 1
	  
		while (true) {
			do { i++ } while (A[i] < pivot)
			do { j-- } while (A[j] > pivot)
		
			if (i >= j) return j
			
			let tmp = A[i]; A[i] = A[j]; A[j] = tmp // Swap A
				tmp = B[i]; B[i] = B[j]; B[j] = tmp // Swap B
		}    
	}
	function quicksortgaussian(){
		const depths = new Float32Array(gaussians.count)
		let indices = Array.from({ length: gaussians.count }, (_, i) => i);

        for (let i = 0; i < gaussians.count; i++) {
            indices[i] = i
            depths[i] = calcDepth(i)
        }

        quicksort(depths, indices, 0, gaussians.count - 1)
		return indices;
	}

	function countingSort(){
		let maxDepth = -Infinity;
		let minDepth = Infinity;
		let sizeList = new Int32Array(gaussians.count);
		let indices = Array.from({ length: gaussians.count }, (_, i) => i);

		for (let i = 0; i < gaussians.count; i++) {
			const depth = (calcDepth(i) * 4096) | 0

			sizeList[i] = depth
			maxDepth = Math.max(maxDepth, depth)
			minDepth = Math.min(minDepth, depth)
		}
		
		let depthInv = (256 * 256) / (maxDepth - minDepth);
		let counts0 = new Uint32Array(256*256);
		for (let i = 0; i < gaussians.count; i++) {
			sizeList[i] = ((sizeList[i] - minDepth) * depthInv) | 0;
			counts0[sizeList[i]]++;
		}
		let starts0 = new Uint32Array(256*256);
		for (let i = 1; i < 256*256; i++) starts0[i] = starts0[i - 1] + counts0[i - 1];
		for (let i = 0; i < gaussians.count; i++) indices[starts0[sizeList[i]]++] = i;

		return indices;
	}

	function defaultSort(){
		let indices = Array.from({ length: gaussians.count }, (_, i) => i);
		indices.sort((a, b) => calcDepth(a) - calcDepth(b));
		return indices;
	}



	// let indices = Array.from({ length: gaussians.count }, (_, i) => i);
	const indices = countingSort();
	// const indices = quicksortgaussian();
	// const indices = defaultSort();
	// const indices = mergeSortIndices();

	let indexBuffer = [];
	for (const element of indices) {
        const index = element;
        for (let j = 0; j < 6; j++) {
            indexBuffer.push(index * 6 + j);
        }
    }

	console.log(performance.now() / 1000 - t);

	return new Uint32Array(indexBuffer);
}