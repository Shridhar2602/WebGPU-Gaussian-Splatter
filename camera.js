import { vec3, mat4, quat } from 'https://cdn.skypack.dev/gl-matrix';

export class Camera {
    constructor(canvas, data, worker) {
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

        this.zoomSpeed = 0.1;
        this.moveSpeed = 0.05;
        this.keypressMoveSpeed = 0.1;

        this.MOVING = 0;
        this.keyPress = 0;

        this.indexBufferNeedsUpdate = true;
        this.isSorting = false;
        this.lastSortedViewMatrix = mat4.create();

        this.MoveCamera(canvas, this);
		this.flag = 1;
		// this.scaleObjects(100)
		
    }

	scaleObjects(scale) {
        // Apply scaling transformation to each object
        for (let i = 0; i < this.gaussians.length; i++) {
			this.gaussians.positions[i] = this.gaussians.positions[i]*scale // Example method to scale an object
        }
		console.log(this.gaussians.positions)
    }

    set_camera(eye = this.eye, center = this.center, up = this.up) {
        vec3.set(this.eye, eye[0], eye[1], eye[2]);
        vec3.set(this.center, center[0], center[1], center[2]);
        vec3.set(this.up, up[0], up[1], up[2]);

        vec3.subtract(this.direction, this.eye, this.center);
        mat4.lookAt(this.viewMatrix, eye, center, up);

		var cx = center[0];
		var cy = center[1];
		var cz = center[2];
		// var point1 = vec3.fromValues(-0.9117398262023926, 2.2373459339141846, -2.910170078277588);
		var point1 = vec3.fromValues(-0.7037860751152039, 1.9006421566009521, -1.6949124336242676);
		var point2 = vec3.fromValues(eye[0], eye[1], eye[2]);
		var dirVector1 = vec3.subtract(vec3.create(), point1, vec3.fromValues(cx, cy, cz));
		var dirVector2 = vec3.subtract(vec3.create(), point2, vec3.fromValues(cx, cy, cz));
		dirVector1[0] = 0;
		dirVector2[0] = 0;
		vec3.normalize(dirVector1, dirVector1);
		vec3.normalize(dirVector2, dirVector2);
		var dotProduct = vec3.dot(dirVector1, dirVector2);
		var angleRadians = Math.acos(dotProduct);
		var angleDegrees = angleRadians * (180 / Math.PI);
		// console.log(angleDegrees)
		this.rotated = angleRadians;
    }

    update_worker() {
        if (!this.isSorting) {
            this.isSorting = true;
            mat4.copy(this.lastSortedViewMatrix, this.viewMatrix);
			if(this.flag == 1)
				this.flag = -1
			else
				this.flag = 1
            this.worker.postMessage({ gaussians: this.gaussians, viewMatrix: this.viewMatrix, flag: this.rotated });
        }
    }

    zoom(delta) {
        vec3.scaleAndAdd(this.eye, this.eye, this.direction, this.zoomSpeed * Math.sign(delta));
        this.set_camera();
    }

    getProjMatrix() {
        const flippedY = mat4.clone(this.projMatrix);
        mat4.scale(flippedY, flippedY, [1, -1, 1]); // flip Y
        mat4.multiply(flippedY, flippedY, this.viewMatrix);
        return flippedY;
    }

    // move(oldCoord, newCoord) {
    //     const dX = (newCoord[0] - oldCoord[0]) * this.moveSpeed;
    //     const dY = (newCoord[1] - oldCoord[1]) * this.moveSpeed;

    //     this.rotateAngle = dX;

    //     vec3.rotateY(this.eye, this.eye, this.center, -dX);
    //     vec3.rotateX(this.eye, this.eye, this.center, -dY);

    //     this.set_camera();
    // }

	move(oldCoord, newCoord) {
		const sensitivity = 0.05;
		const deltaY = (newCoord[0] - oldCoord[0]) * this.moveSpeed;
		const deltaX = (newCoord[1] - oldCoord[1]) * this.moveSpeed;

		// console.log(deltaY)
		// Calculate the rotation quaternion based on mouse movement
		const rotationQuaternion = quat.create();
		// Define your custom X and Y axes
		var customXAxis = [0, 0.886994, 0.461779]; // Example: You have a custom X axis
		// Find a vector perpendicular to the custom X axis
		var arbitraryVector = [1, 0, 0]; // An arbitrary vector
		var customYAxis = vec3.create();
		vec3.cross(customYAxis, customXAxis, arbitraryVector);
		vec3.normalize(customYAxis, customYAxis);

		// Calculate rotation quaternion for custom Y axis
		var rotationYQuaternion = quat.create();
		quat.setAxisAngle(rotationYQuaternion, customYAxis, sensitivity * 0);

		// Calculate rotation quaternion for custom X axis
		var rotationXQuaternion = quat.create();
		quat.setAxisAngle(rotationXQuaternion, customXAxis, sensitivity * deltaY);

		// Combine the rotations
		var combinedRotation = quat.create();
		quat.multiply(combinedRotation, rotationYQuaternion, rotationXQuaternion);

		// Apply the combined rotation to your object's quaternion
		quat.multiply(rotationQuaternion, rotationQuaternion, combinedRotation);

		// quat.rotateY(rotationQuaternion, rotationQuaternion, sensitivity * deltaX);
		// quat.rotateX(rotationQuaternion, rotationQuaternion, sensitivity * deltaY);
	
		// Apply the rotation to the camera direction
		const oldDirection = vec3.create();
		vec3.subtract(oldDirection, this.eye, this.center);
		const newDirection = vec3.transformQuat(vec3.create(), oldDirection, combinedRotation);
	
		// Update the camera position
		vec3.add(this.eye, this.center, newDirection);
		this.set_camera()
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
			oldCoord = newCoord
			camera.MOVING = 1;
		}

		canvas.addEventListener("mouseup", event => {
			canvas.removeEventListener("mousemove", onMouseMove);
			this.MOVING = 0;
			// console.log(this.eye)
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