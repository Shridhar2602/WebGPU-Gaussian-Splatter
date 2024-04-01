@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> gaussians: array<gaussian>;

struct gaussian {
	mean : vec3f,
	opacity : f32,
	color : vec3f,
	conv3D_A : vec3f,
	conv3D_B : vec3f
}

struct Uniforms {
	width : f32,
	height : f32,
	focal_x : f32,
	focal_y : f32,
	tan_fovx : f32,
	tan_fovy : f32,
	viewMatrix : mat4x4f,
	projMatrix : mat4x4f
}

struct vertexShaderOutput {
	@builtin(position) pos : vec4f,
	@location(0) col : vec3f,
	@location(1) depth : f32,
	@location(2) con_o : vec4f,
	@location(3) xy : vec2f,
	@location(4) pixf : vec2f,
	// @location(3) @interpolate(flat) xy : vec2f,
	// @location(4) @interpolate(flat) pixf : vec2f,
}

fn computeCov2D(mean : vec3f, focal_x : f32, focal_y : f32, tan_fovx : f32, tan_fovy : f32, conv3D_A : vec3f, conv3D_B : vec3f, viewmatrix : mat4x4f) -> vec3f {
	var t = viewmatrix * vec4f(mean, 1.0);

	let limx = 1.3 * tan_fovx;
	let limy = 1.3 * tan_fovy;
	let txtz = t.x / t.z;
    let tytz = t.y / t.z;
    t.x = min(limx, max(-limx, txtz)) * t.z;
    t.y = min(limy, max(-limy, tytz)) * t.z;

	let J = mat3x3f(
		focal_x / t.z, 0, -(focal_x * t.x) / (t.z * t.z),
        0, focal_y / t.z, -(focal_y * t.y) / (t.z * t.z),
        0, 0, 0
	);

	let W = mat3x3f(
		viewmatrix[0][0], viewmatrix[1][0], viewmatrix[2][0],
        viewmatrix[0][1], viewmatrix[1][1], viewmatrix[2][1],
        viewmatrix[0][2], viewmatrix[1][2], viewmatrix[2][2]
	);

	let T = W * J;

	let Vrk = mat3x3f(
		conv3D_A[0], conv3D_A[1], conv3D_A[2],
        conv3D_A[1], conv3D_B[0], conv3D_B[1],
        conv3D_A[2], conv3D_B[1], conv3D_B[2],
	);

	var cov = transpose(T) * transpose(Vrk) * T;

	cov[0][0] += 0.3;
	cov[1][1] += 0.3;
	return vec3f(cov[0][0], cov[0][1], cov[1][1]);
}

fn ndc2Pix(v : f32, S : f32) -> f32 {
	return ((v + 1.0) * S - 1.0) * 0.5;
}

fn sigmoid(x: f32) -> f32 {
    if (x >= 0.) {
        return 1. / (1. + exp(-x));
    } else {
        let z = exp(x);
        return z / (1. + z);
    }
}

const quadVertices = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
);

@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> vertexShaderOutput {
	
	var vsOutput : vertexShaderOutput;
	let pointIdx = vertexIndex / 6u;
	let quadIdx = vertexIndex % 6u;
	let quadOffset = quadVertices[quadIdx];
	let splat = gaussians[pointIdx];

	// let p_hom = uniforms.projMatrix * vec4f(splat.mean, 1);
	// let p_w = 1.0 / (p_hom.w + 1e-7);
	// let p_proj = p_hom.xyz * p_w;

    // Perform near culling, quit if outside.
    // let p_view = uniforms.viewMatrix * vec4f(splat.mean, 1);
    // if (p_view.z <= 0.4) {	// if (p_view.z <= 0.2f)// || ((p_proj.x < -1.3 || p_proj.x > 1.3 || p_proj.y < -1.3 || p_proj.y > 1.3)))
    //     // gl_Position = vec4(0, 0, 0, 1);
	// 	vsOutput.pos = vec4f(0, 0, 0, 1);
	// 	return vsOutput;
    // }

	// Compute 2D screen-space covariance matrix
	let cov = computeCov2D(splat.mean, uniforms.focal_x, uniforms.focal_y, uniforms.tan_fovx, uniforms.tan_fovy, splat.conv3D_A, splat.conv3D_B, uniforms.viewMatrix);

	// Invert covariance (EWA algorithm)
    let det = (cov.x * cov.z - cov.y * cov.y);
    // if (det == 0.0) {
    //     vsOutput.pos = vec4f(0, 0, 0, 1);
	// 	return vsOutput;
    // }
    let det_inv = 1.0 / det;
    let conic = vec3f(cov.z, -cov.y, cov.x) * det_inv;

	// Compute extent in screen space (by finding eigenvalues of
    // 2D covariance matrix). Use extent to compute the bounding
    // rectangle of the splat in screen space.

    let mid = 0.5 * (cov.x + cov.z);
	let lambda1 = mid + sqrt(max(0.1, mid * mid - det));
	let lambda2 = mid - sqrt(max(0.1, mid * mid - det));
	var my_radius = ceil(3.0 * sqrt(max(lambda1, lambda2)));
	let radius_ndc = vec2f(my_radius / uniforms.height, my_radius / uniforms.width);
    // let point_image = vec2f(ndc2Pix(p_proj.x, uniforms.width), ndc2Pix(p_proj.y, uniforms.height));
	
	vsOutput.con_o = vec4f(conic, splat.opacity);

	var projPosition = uniforms.projMatrix * vec4f(splat.mean, 1);
	projPosition = projPosition / projPosition.w;
	vsOutput.pos = vec4f(projPosition.xy + 2 * radius_ndc * quadOffset, projPosition.zw);
	vsOutput.col = splat.color;
	vsOutput.xy =  my_radius * quadOffset;

	// return output;



	// As the covariance matrix is calculated as a one-time operation on CPU in this implementation,
    // we need to apply the scale modifier differently to still allow for real-time scaling of the splats.

	// let scale_modifier = 1.0;
    // my_radius *= .15 + scale_modifier * .85;
    // let scale_modif = 1. / scale_modifier;

	// // Convert VertexID from [0,1,2,3] to [-1,-1],[1,-1],[-1,1],[1,1]
    // let corner = vec2f(f32((vertexIndex << 1) & 2), f32(vertexIndex & 2)) - 1.0;
    // // Vertex position in screen space
    // let screen_pos = point_image + my_radius * corner;

    // // // Store some useful helper data for the fragment stage

	// vsOutput.col = splat.color;
	// vsOutput.depth = p_view.z;
	// vsOutput.con_o = vec4f(conic, splat.opacity);
	// vsOutput.xy = point_image;
	// vsOutput.pixf = screen_pos;

    // // Convert from screen-space to clip-space
    // let clip_pos = screen_pos / vec2f(uniforms.width, uniforms.height) * 2. - 1.;

    // // gl_Position = vec4(clip_pos, 0, 1);

	// vsOutput.pos = vec4f(clip_pos, 0, 1);

	return vsOutput;
}