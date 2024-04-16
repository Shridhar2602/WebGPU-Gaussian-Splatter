import { vec3, vec4, mat4, quat } from 'https://cdn.skypack.dev/gl-matrix';

export function sortGaussiansByDepth(gaussians, viewMatrix) {
	let t = performance.now() / 1000;

	const calcDepth = (i) => 
		(gaussians.positions[i * 3] * viewMatrix[8] +
		gaussians.positions[i * 3 + 1] * viewMatrix[9] +
		gaussians.positions[i * 3 + 2] * viewMatrix[10] +
		viewMatrix[11]);

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

	function countSort1(){
		let minDepth = Infinity;
		let maxDepth = -Infinity;
		for (let i = 0; i < gaussians.count; i++) {
				const depth = calcDepth(i);
				minDepth = Math.min(minDepth, depth);
				maxDepth = Math.max(maxDepth, depth);
		}

		const count = new Array(gaussians.count).fill(0);
		for (let i = 0; i < gaussians.count; i++) {
				const depth = Math.floor(calcDepth(i) * (gaussians.count - 1));
				count[depth]++;
		}

		for (let i = 1; i < count.length; i++) {
				count[i] += count[i - 1];
		}

		let indices = Array.from({ length: gaussians.count }, (_, i) => i);
		for (let i = gaussians.count - 1; i >= 0; i--) {
				const depth = Math.floor(calcDepth(i) * (gaussians.count - 1));
				const index = count[depth] - 1;
				count[depth]--;
				[indices[i], indices[index]] = [indices[index], indices[i]];
		}

		return indices;
	}

	function defaultSort(){
		let indices = Array.from({ length: gaussians.count }, (_, i) => i);
		indices.sort((a, b) => calcDepth(a) - calcDepth(b));
		return indices;
	}

	function mergeSort(arr, comparator) {
		if (arr.length <= 1) {
			return arr;
		}
	
		const middle = Math.floor(arr.length / 2);
		const left = arr.slice(0, middle);
		const right = arr.slice(middle);
	
		return merge(
			mergeSort(left, comparator),
			mergeSort(right, comparator),
			comparator
		);
	}
	
	function merge(left, right, comparator) {
		let result = [];
		let leftIndex = 0;
		let rightIndex = 0;
	
		while (leftIndex < left.length && rightIndex < right.length) {
			if (comparator(left[leftIndex], right[rightIndex]) <= 0) {
				result.push(left[leftIndex]);
				leftIndex++;
			} else {
				result.push(right[rightIndex]);
				rightIndex++;
			}
		}
	
		return result.concat(left.slice(leftIndex), right.slice(rightIndex));
	}
	
	function mergeSortIndices() {
		let indices = Array.from({ length: gaussians.count }, (_, i) => i);
		return mergeSort(indices, (a, b) => calcDepth(a) - calcDepth(b));
	}
	

	// let indices = Array.from({ length: gaussians.count }, (_, i) => i);
	// const indices = countSort1();
	const indices = defaultSort();
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