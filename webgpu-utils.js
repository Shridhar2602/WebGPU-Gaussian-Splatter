export class WebGPU 
{
	constructor()
	{
		this.device = null;
	}

	createShaderModule(source) {
		const shaderModuleDescriptor = {
			code: source,
		};
		return this.device.createShaderModule(shaderModuleDescriptor);
	}

	createUniformBuffer(label, uniformArray) {
		const uniformBuffer = this.device.createBuffer({
			label: label,
			size: uniformArray.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

		return {
			data: uniformArray,
			buffer: uniformBuffer
		}
	}

	createStorageBuffer_WriteOnly(label, bufferArray) {
		const storageBuffer = this.device.createBuffer({
			label: label,
			size: bufferArray.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(storageBuffer, 0, bufferArray);

		return {
			data: bufferArray,
			buffer: storageBuffer
		}
	}

	createStorageBuffer_ReadWrite(label, bufferArray) {
		const storageBuffer = this.device.createBuffer({
			label: label,
			size: bufferArray.byteLength,
			usage: GPUBufferUsage.STORAGE |  GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(storageBuffer, 0, bufferArray);

		return {
			data: bufferArray,
			buffer: storageBuffer
		}
	}

	createVertexBuffer(label, bufferArray) {
		const vertexBuffer = this.device.createBuffer({
			label: label,
			size: bufferArray.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(vertexBuffer, 0, bufferArray);

		return {
			data: bufferArray,
			buffer: vertexBuffer
		}
	}

	createIndexBuffer(label, bufferArray) {
		const drawIndexBuffer = this.device.createBuffer({
			label: label,
			size: 6 * bufferArray.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: false,
		});

		return {
			data: bufferArray,
			buffer: drawIndexBuffer
		}
	}

	updateIndexBuffer(indexBuffer) {
		this.device.queue.writeBuffer(indexBuffer.buffer, 0, indexBuffer.data);
	}

	createRenderPipeline(module) {
		const renderPipeline = this.device.createRenderPipeline({
			label: 'render pipeline',
			layout: 'auto',
			vertex: {
			  module,
			  entryPoint: 'vs',
			},
			
			fragment: {
			  module,
			  entryPoint: 'fs',
			  targets: [
					{
						format: this.presentationFormat,
						// with one-minus-dst alpha we can set the src to src.alpha * src.color and
						// we get that color_new = src.color * src.alpha + dst.color * (1 - src.alpha)
						// which is the same as the accumulation rule in the paper
						blend: {
							color: {
								srcFactor: "one-minus-dst-alpha",
								dstFactor: "one",
								operation: "add",
							},
							alpha: {
								srcFactor: "one-minus-dst-alpha",
								dstFactor: "one",
								operation: "add",
							},
						}
					},
				],
			},

			primitive: {
                topology: "triangle-list",
                stripIndexFormat: undefined,
                cullMode: undefined,
            },
		});

		return renderPipeline;
	}

	createRenderPassDescriptor() {
		const renderPassDescriptor = {
			label: 'renderPass',
			colorAttachments: [
			  {
				clearValue: [0, 0, 0, 0],
				loadOp: 'clear',
				storeOp: 'store',
			  },
			],
		};

		return renderPassDescriptor;
	}

	createComputePipeline(module) {
		const computePipeline = this.device.createComputePipeline({
			label: 'Compute pipeline',
			layout: 'auto',
			compute: {
			  module,
			  entryPoint: 'computeFrameBuffer',
			},
		});

		return computePipeline;
	}


	computePass(computePipeline, bindGroupCompute, workGroupsNeeded) {
		let encoder = this.device.createCommandEncoder({label: 'compute encoder'});
		let pass = encoder.beginComputePass({label: 'compute pass'});
		pass.setPipeline(computePipeline);
		pass.setBindGroup(0, bindGroupCompute);
		pass.dispatchWorkgroups(workGroupsNeeded + 1, 1, 1);
		pass.end();
		let commandBuffer = encoder.finish();
		this.device.queue.submit([commandBuffer]);
	}


	renderPass(renderPassDescriptor, renderPipeline, bindGroup, count, indexBuffer) {
		renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
	  	const renderEncoder = this.device.createCommandEncoder({label: 'render encoder'});

		// renderEncoder.copyBufferToBuffer(
		// 	indexBuffer.data,
		// 	0,
		// 	indexBuffer.buffer,
		// 	0,
		// 	6 * 4 * indexBuffer.data.length
		// );
		// this.device.queue.writeBuffer(indexBuffer.buffer, 0, indexBuffer.data);

	  	const renderPass = renderEncoder.beginRenderPass(renderPassDescriptor);
	  	renderPass.setPipeline(renderPipeline);
	  	renderPass.setBindGroup(0, bindGroup);
	  	// renderPass.setVertexBuffer(0, vertexBuffer);
		renderPass.setIndexBuffer(indexBuffer.buffer, "uint32");
	  	renderPass.drawIndexed(count * 6, 1, 0, 0, 0); 
	  	renderPass.end();

	  	const renderCommandBuffer = renderEncoder.finish();
	  	this.device.queue.submit([renderCommandBuffer]);
	}

	// Functions for creating Render Passes
	createCommandEncoder(label) {
		return this.device.createCommandEncoder({label: label});
	}

	setCanvasAsRenderTarget(renderPassDescriptor) {
		renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();
	}

	makeRenderPass(renderEncoder, renderPassDescriptor, renderPipeline, bindGroup, vertexBuffer, numDrawCalls) {
		const renderPass = renderEncoder.beginRenderPass(renderPassDescriptor);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, bindGroup);
		renderPass.setVertexBuffer(0, vertexBuffer);
		renderPass.draw(numDrawCalls);
		renderPass.end();
	}

	addCommandBufferToQueue(renderEncoder) {
		this.device.queue.submit([renderEncoder.finish()]);
	}



	// Initializing WebGPU (https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html)
	async init()
	{
		if (!navigator.gpu) {
			fail('this browser does not support WebGPU');
			return;
		}
		
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			fail('this browser supports webgpu but it appears disabled');
			return;
		}
		
		const device = await adapter?.requestDevice();
		device.lost.then((info) => {
			console.error(`WebGPU device was lost: ${info.message}`);
	  
			if (info.reason !== 'destroyed') {
			  start();
			}
		});

		const canvas = document.querySelector('canvas');
		const context = canvas.getContext('webgpu');
		// const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
		const presentationFormat = "rgba16float";
		context.configure({
	  		device,
	  		format: presentationFormat,
		});

		this.device = device;
		this.context = context;
		this.presentationFormat = presentationFormat;
	}
}