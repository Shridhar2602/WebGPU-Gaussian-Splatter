
function getDepthFromViewMatrix(x, y, z, viewMatrix) {
    // Convert the point to a glMatrix vec4
    const point = vec4.fromValues(x, y, z, 1);

    // Transform the point by the view matrix
    const cameraSpacePoint = vec4.create();
    mat4.multiply(cameraSpacePoint, viewMatrix, point);

    // The depth is the negative of the z-coordinate in camera space
    const depth = -cameraSpacePoint[2];

    return depth;
}