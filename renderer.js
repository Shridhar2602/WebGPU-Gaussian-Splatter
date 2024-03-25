import { WebGPU } from "./webgpu-utils.js";
import { sortGaussiansByDepth, sortGaussiansByDepth2 } from './sort.js';

export class Renderer 
{
    constructor()
    {
        this.webGPU = new WebGPU();
    }

    static async create() {
        const renderer = new Renderer();
        await renderer.webGPU.init();
        return renderer;
    }

	async loadShaders(shaderPaths) {
		try {
			const shaderContents = await Promise.all(shaderPaths.map(path => loadTextfile(path)));
			return shaderContents.join('');
		} catch (error) {
			console.error('Error loading shader modules:', error);
			throw error;
		}
	}

	async createShaderModule() {
		const shaderPaths = [
			// './shaders/compute.wgsl',
			'./shaders/fragment.wgsl',
			'./shaders/vertex.wgsl',
		];
	
		const computeShader = await this.loadShaders(shaderPaths);
		const module = this.webGPU.createShaderModule(computeShader);
		return module;
	}

	async initBuffers(data, sortedIndices, camera, WIDTH, HEIGHT) {

		this.data = data;
		const tan_fovy = Math.tan(camera.fov_y * 0.5);
		const tan_fovx = tan_fovy * WIDTH / HEIGHT;
		const focal_y = HEIGHT / (2 * tan_fovy);
		const focal_x = WIDTH / (2 * tan_fovx);

		this.uniforms = {
			screenDims: [WIDTH, HEIGHT, focal_x, focal_y],
			camParams: [tan_fovx, tan_fovy, -1, -1],
			viewMatrix: camera.viewMatrix,
			projMatrix: camera.projMatrix,
		}

		this.bufferArray = [];
		// for(let i = 0; i < data.opacities.length; i++) {
		// 	this.bufferArray.push(
		// 		data.positions[i*3], data.positions[i*3+1], data.positions[i*3+2], data.opacities[i],
		// 		data.colors[i*3], data.colors[i*3+1], data.colors[i*3+2], -1,
		// 		data.cov3Ds[i*6], data.cov3Ds[i*6+1], data.cov3Ds[i*6+2], -1,
		// 		data.cov3Ds[i*6+3], data.cov3Ds[i*6+4], data.cov3Ds[i*6+5], -1
		// 	)
		// }

		let uniformArray = flattenToFloat32Array(this.uniforms);
		this.bufferArray = createBufferFromGaussians(data);
		const vertexData = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);	// screen sized quad

		console.log(uniformArray)

		this.buffers = {
			uniforms: this.webGPU.createUniformBuffer('uniformBuffer', uniformArray),
			gaussians: this.webGPU.createStorageBuffer_WriteOnly('gaussian buffer', this.bufferArray),
			indexBuffer: this.webGPU.createIndexBuffer('drawIndexBuffer', sortedIndices),
		};
	}

	// createComputePipeline(module) {
	// 	this.computePipeline = this.webGPU.createComputePipeline(module)

	// 	const buffers = this.buffers;
	// 	this.bindGroupCompute = this.webGPU.device.createBindGroup({
	// 		label: 'bindGroup for work buffer',
	// 		layout: this.computePipeline.getBindGroupLayout(0),
	// 		entries: [
	// 		{ binding: 0, resource: {buffer : buffers.uniforms.buffer}},
	// 		{ binding: 1, resource: {buffer : buffers.positions.buffer}},
	// 		{ binding: 2, resource: {buffer : buffers.opacities.buffer}},
	// 		{ binding: 3, resource: {buffer : buffers.colors.buffer}},
	// 		{ binding: 4, resource: {buffer : buffers.conv3Ds.buffer}},
	// 		{ binding: 5, resource: {buffer : buffers.frameBuffer.buffer}},
	// 		],
	// 	  });
	// }

	createRenderPipeline(module) {
		this.renderPipeline = this.webGPU.createRenderPipeline(module);
		
		const buffers = this.buffers;
		this.bindGroup = this.webGPU.device.createBindGroup({
			layout: this.renderPipeline.getBindGroupLayout(0),
			entries: [
			  { binding: 0, resource: {buffer : buffers.uniforms.buffer}},
			  { binding: 1, resource: {buffer : buffers.gaussians.buffer}},
			],
		});
	
		this.renderPassDescriptor = this.webGPU.createRenderPassDescriptor();
	}

	setRenderParameters(renderParams, camera, WIDTH, HEIGHT) {

		this.renderParams = renderParams;

		if(this.renderParams.showFPS)
		{
			this.stats = new Stats();
			this.stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
			document.body.appendChild( this.stats.dom );
		}

		this.frameNum = 0.0;
		this.avgFrameTime = 0.0;
		this.reqFrameDelay = 1000 / this.renderParams.maxFPS;
		this.lastFrameTime = performance.now();

		this.camera = camera;
		this.WIDTH = WIDTH;
		this.HEIGHT = HEIGHT;
	}

	// renders continuously
	async renderAnimation() {
		this.frameNum += 1.0;
		
		if(this.renderParams.showFPS)
			this.stats.begin();

		if(this.renderParams.logCountOfSamples && this.frameNum % 100 == 0)
			console.log(this.frameNum + " samples rendered");

		// ============================== UPDATE UNIFORMS ================================
		// this.uniforms.frameNum = this.frameNum;
		// this.uniforms.resetBuffer = (this.camera.MOVING || this.camera.keyPress) ? 1 : 0;

		if(this.camera.MOVING || this.camera.keyPress)
		{
			this.frameNum = 1;
			this.camera.keyPress = 0;
		}

		this.uniforms.viewMatrix = this.camera.viewMatrix;
		this.buffers.uniforms.data = flattenToFloat32Array(this.uniforms);
		this.webGPU.device.queue.writeBuffer(this.buffers.uniforms.buffer, 0, this.buffers.uniforms.data);

		// ============================== UPDATE GAUSSIAN BUFFER ================================
		// let gaussians = sortGaussiansByDepth2(this.data, this.camera.viewMatrix);

		// ============================== COMPUTE PASS ================================
		// let workGroupsNeeded = (this.WIDTH * this.HEIGHT) / 64;
		// this.webGPU.computePass(this.computePipeline, this.bindGroupCompute, workGroupsNeeded);

		// ============================== RENDER PASS ================================
	  	this.webGPU.renderPass(this.renderPassDescriptor, this.renderPipeline, this.bindGroup, this.bufferArray.length / 16, this.buffers.indexBuffer);

		// ====================== VSync & Performance Logging ======================
		const currentTime = performance.now();
		const elapsedTime = currentTime - this.lastFrameTime;

		if(this.renderParams.logPerformance) {
			this.avgFrameTime += elapsedTime;
			if(this.frameNum % 100 == 0) {
				console.log("Avg frame time: " + this.avgFrameTime / 100.0 + " ms");
				console.log("FPS (without limiting): " + 1000.0 / (this.avgFrameTime / 100.0));
				this.avgFrameTime = 0.0;
			}
		}
		
		if(elapsedTime < this.reqFrameDelay) {
			await new Promise(resolve => setTimeout(resolve, this.reqFrameDelay - elapsedTime));
		}
		this.lastFrameTime = performance.now();

		if(this.renderParams.showFPS)
			this.stats.end();

		requestAnimationFrame(() => this.renderAnimation());
	}

	renderSingleFrame()	{
		this.uniforms.viewMatrix = this.camera.viewMatrix;
		this.buffers.uniforms.data = flattenToFloat32Array(this.uniforms);

		this.webGPU.device.queue.writeBuffer(this.buffers.uniforms.buffer, 0, this.buffers.uniforms.data);

		// ============================== COMPUTE PASS ================================
		let encoder = this.webGPU.device.createCommandEncoder({label: 'compute encoder'});
		let pass = encoder.beginComputePass({label: 'compute pass'});
		pass.setPipeline(this.computePipeline);
		pass.setBindGroup(0, this.bindGroupCompute);
		let workGroupsNeeded = (this.WIDTH * this.HEIGHT) / 64;
		// pass.dispatchWorkgroups(temp, temp, temp);
		pass.dispatchWorkgroups(workGroupsNeeded + 1, 1, 1);
		pass.end();
	

		// Finish encoding and submit the commands
		let commandBuffer = encoder.finish();
		this.webGPU.device.queue.submit([commandBuffer]);


		// ============================== RENDER PASS ================================
		this.webGPU.setCanvasAsRenderTarget(this.renderPassDescriptor);
		const renderEncoder = this.webGPU.createCommandEncoder('render encoder');
		// call our vertex shader 6 times (2 triangles)
		this.webGPU.makeRenderPass(renderEncoder, this.renderPassDescriptor, this.renderPipeline, this.bindGroup, this.buffers.vertex.buffer, 6);
		this.webGPU.addCommandBufferToQueue(renderEncoder);
	}



}

function flattenToFloat32Array(obj) {
	// Flatten the object into an array
	let array = [];
	for (let key in obj) {
		if (Array.isArray(obj[key]) || obj[key] instanceof Float32Array) {
			array.push(...obj[key]);
		} else {
			array.push(obj[key]);
		}
	}

	// Convert the array to a Float32Array
	return new Float32Array(array);
}
	

async function loadTextfile(path) {
	let response = await fetch(path);
	return response.text();
}

function createBufferFromGaussians(data) {
	let bufferArray = [];
	for(let i = 0; i < data.opacities.length; i++) {
		bufferArray.push(
			data.positions[i*3], data.positions[i*3+1], data.positions[i*3+2], data.opacities[i],
			data.colors[i*3], data.colors[i*3+1], data.colors[i*3+2], -1,
			data.cov3Ds[i*6], data.cov3Ds[i*6+1], data.cov3Ds[i*6+2], -1,
			data.cov3Ds[i*6+3], data.cov3Ds[i*6+4], data.cov3Ds[i*6+5], -1
		)
	}

	console.log(bufferArray)

	return new Float32Array(bufferArray);
}