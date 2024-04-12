import { vec3, mat4, quat } from 'https://cdn.skypack.dev/gl-matrix';

export class Camera
{
	constructor(canvas, data, worker)
	{
		this.viewMatrix = mat4.create();
		this.gaussians = data;
		this.worker = worker;
		
		this.fov_y = 700;
		this.fov_x = 700;

		this.projMatrix = mat4.perspective(mat4.create(), 0.82, canvas.width / canvas.height, 0.1, 10000.0);

		this.eye = vec3.create();
		this.center = vec3.create();
		this.up = vec3.create();
		this.direction = vec3.create();
		this.rotateAngle = 0;

		this.zoomSpeed = 0.5;
		this.moveSpeed = 0.01;
		this.keypressMoveSpeed = 0.1;

		this.MOVING = 0;
		this.keyPress = 0;

		this.indexBufferNeedsUpdate = true;
		this.isSorting = false;
		this.lastSortedViewMatrix = mat4.copy(mat4.create(), this.viewMatrix);

		this.MoveCamera(canvas, this);
	}

	set_camera(eye=this.eye, center=this.center, up=this.up)
	{
		vec3.set(this.eye, eye[0], eye[1], eye[2])
		vec3.set(this.center, center[0], center[1], center[2])
		vec3.set(this.up, up[0], up[1], up[2])

		// console.log(this.eye, this.center, this.up);

		vec3.subtract(this.direction, this.eye, this.center);
		mat4.lookAt(this.viewMatrix, eye, center, up);
	}

	update_worker() {
		if(this.isSorting == false) {
			this.isSorting = true;
			mat4.copy(this.lastSortedViewMatrix, this.viewMatrix);
			this.worker.postMessage({gaussians: this.gaussians, viewMatrix: this.viewMatrix});
		}
	}

	zoom(delta)
	{
		this.eye[0] += this.direction[0] * this.zoomSpeed * Math.sign(delta);
		this.eye[1] += this.direction[1] * this.zoomSpeed * Math.sign(delta);
		this.eye[2] += this.direction[2] * this.zoomSpeed * Math.sign(delta);
		// this.center[0] += this.direction[0] * this.zoomSpeed * Math.sign(delta);
		// this.center[1] += this.direction[1] * this.zoomSpeed * Math.sign(delta);
		// this.center[2] += this.direction[2] * this.zoomSpeed * Math.sign(delta);

		this.set_camera();
	}

	getProjMatrix() {
		var flippedY = mat4.clone(this.projMatrix);
		mat4.mul(flippedY, flippedY, this.diagonal4x4(1, -1, 1, 1));
        mat4.multiply(flippedY, flippedY, this.viewMatrix);
		return flippedY;
	}

	move(oldCoord, newCoord)
	{
		let dX = (newCoord[0] - oldCoord[0]) * Math.PI / 180 * this.moveSpeed;
		let dY = (newCoord[1] - oldCoord[1]) * Math.PI / 180 * this.moveSpeed;

		this.rotateAngle = dX;

		vec3.rotateY(this.eye, this.eye, this.center, -dX);
		vec3.rotateX(this.eye, this.eye, this.center, -dY);

		// vec3.rotateY(this.up, this.up, vec3.create(), -dX);
		// vec3.rotateX(this.up, this.up, vec3.create(), -dY);

		this.set_camera();
	}

	moveLeft() {
		vec3.set(this.eye, this.eye[0] + this.keypressMoveSpeed, this.eye[1], this.eye[2]);
		vec3.set(this.center, this.center[0] + this.keypressMoveSpeed, this.center[1], this.center[2]);
		this.set_camera();
	}
	moveRight() {
		vec3.set(this.eye, this.eye[0] - this.keypressMoveSpeed, this.eye[1], this.eye[2]);
		vec3.set(this.center, this.center[0] - this.keypressMoveSpeed, this.center[1], this.center[2]);
		this.set_camera();
	}
	moveUp() {
		vec3.set(this.eye, this.eye[0], this.eye[1] - this.keypressMoveSpeed, this.eye[2]);
		vec3.set(this.center, this.center[0], this.center[1] - this.keypressMoveSpeed, this.center[2]);
		this.set_camera();
	}
	moveDown() {
		vec3.set(this.eye, this.eye[0], this.eye[1] + this.keypressMoveSpeed, this.eye[2]);
		vec3.set(this.center, this.center[0], this.center[1] + this.keypressMoveSpeed, this.center[2]);
		this.set_camera();
	}

	MoveCamera(canvas, camera)
	{
		let oldCoord = [];
		let newCoord = [];

		canvas.addEventListener("mousedown", event => {
			if(event.button == 0)
			{
				oldCoord = [event.clientX, event.clientY]
				canvas.addEventListener("mousemove", onMouseMove)
			}
		})

		function onMouseMove(event)
		{
			newCoord = [event.clientX, event.clientY]
			camera.move(oldCoord, newCoord)
			camera.MOVING = 1;
		}

		canvas.addEventListener("mouseup", event => {
			canvas.removeEventListener("mousemove", onMouseMove);
			this.MOVING = 0;
			this.update_worker();
		})

		document.addEventListener("keydown", onKeyDown);
		function onKeyDown(event) {
			switch (event.key) {
				case "ArrowLeft":
					camera.moveLeft();
					camera.keyPress = 1
					camera.update_worker();
					break;
				case "ArrowRight":
					camera.moveRight();
					camera.keyPress = 1
					camera.update_worker();
					break;
				case "ArrowUp":
					// camera.moveUp();
					// camera.keyPress = 1
					// camera.update_worker();
					camera.zoom(-0.3);
					camera.keyPress = 1
					camera.update_worker();
					break;
				case "ArrowDown":
					// camera.moveDown();
					// camera.keyPress = 1
					// camera.update_worker();
					camera.zoom(0.3);
					camera.keyPress = 1
					camera.update_worker();
					break;
			}
		}

		// Add event listener for mouse wheel (zoom)
		canvas.addEventListener("wheel", onWheel);

		function onWheel(event) {
			const delta = event.deltaY || event.detail || event.wheelDelta;
	
			// Call the zoom method of the camera
			camera.zoom(delta);
			camera.keyPress = 1
			camera.update_worker();
		}
	}

	// useful for coordinate flips
	diagonal4x4(x, y, z, w) {
    	const m = mat4.create();
    	m[0] = x;
    	m[5] = y;
    	m[10] = z;
    	m[15] = w;
    	return m;
	}
}