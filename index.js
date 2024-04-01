import { loadPly, loadJson } from './ply_reader.js';
import { Camera } from './camera.js';
import { sortGaussiansByDepth } from './sort.js';
import { Renderer } from './renderer.js';

let worker = null

async function main() {

	const renderer = await Renderer.create();

	const device = renderer.webGPU.device;
	const canvas = document.querySelector('canvas');
  
	const module = await renderer.createShaderModule();

	const WIDTH = canvas.clientWidth;
	const HEIGHT = canvas.clientHeight;

	// let data = await loadPly('./room.ply');
	let data = await loadJson('./exported_data.json');

	worker = new Worker("./sortWorker.js");

	let cam = new Camera(canvas, data, worker);

	worker.onmessage = function(event) {
		cam.isSorting = false;
		renderer.buffers.indexBuffer.data = event.data;
		cam.indexBufferNeedsUpdate = true;
	};	

	// eye, center, up
	// cam.set_camera([-0.428322434425354, 1.2004123210906982, 0.8184626698493958], [4.950796326794864, 1.7307963267948987, 2.5] , [0, 0.886994, 0.461779]);
	cam.set_camera([4.950796326794864, 1.7307963267948987, 2.5], [-0.428322434425354, 1.2004123210906982, 0.8184626698493958] , [0, 0.886994, 0.461779]);
	// cam.set_camera([-0.19953107833862305, -0.003209030954167247, 3.3699135780334473], [-0.19953107833862305, -0.003209030954167247, 3.3699135780334473] , [0, 0.886994, 0.461779]);

	let sorted = sortGaussiansByDepth(data, cam.viewMatrix);
	renderer.createShaderModule();

	await renderer.initBuffers(data, sorted, cam, WIDTH, HEIGHT);
	renderer.createRenderPipeline(module);

	const renderParams = {
		WIDTH: WIDTH,
		HEIGHT: HEIGHT,
		showFPS: true,
		maxFPS: 61,
		logCountOfSamples: false,
		logPerformance: false,
	}

	renderer.setRenderParameters(renderParams, cam, WIDTH, HEIGHT);

	// code to resize canvas (https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html)
	const observer = new ResizeObserver(entries => {
		for (const entry of entries) {
		  const canvas = entry.target;
		  const width = entry.contentBoxSize[0].inlineSize;
		  const height = entry.contentBoxSize[0].blockSize;
		  canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
		  canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
  
		  // re-render
		  renderer.renderAnimation();
		  // renderer.renderSingleFrame();
		}
	  });
  
	observer.observe(canvas);
	
}

main()