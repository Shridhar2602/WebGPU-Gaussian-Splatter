
fn depth_palette(X: f32) -> vec3f {
	let x = min(1.0, X);
	return vec3f(sin(x * 6.28/4.0), x*x, mix(sin(x * 6.28), x, 0.6));
}

@fragment fn fs(fsInput: vertexShaderOutput) -> @location(0) vec4f {

	// let d = fsInput.xy - fsInput.pixf;
	// var power = -0.5 * (fsInput.con_o.x * d.x * d.x + fsInput.con_o.z * d.y * d.y) - fsInput.con_o.y * d.x * d.y;

	// if(power > 0.0) {
	// 	discard;
	// }

    // // (Custom) As the covariance matrix is calculated in a one-time operation on CPU in this implementation,
    // // we need to apply the scale modifier differently to still allow for real-time scaling of the splats.
	// let scale_modif = 1.0;
    // power *= scale_modif;

    // // Eq. (2) from 3D Gaussian splatting paper.
    // let alpha = min(0.99, fsInput.con_o.w * exp(power));
    
    // // (Custom) Colorize with depth value instead of color (z-buffer visualization)
    // var color = fsInput.col;
    // // if (show_depth_map) {
    // //     color = depth_palette(depth * .08);
    // // }
	// // color = depth_palette(fsInput.depth * .08);

    // if (alpha < 1.0/255.0) {
    //     discard;
    // }

	/////////////////////////////////////////////
	let d = fsInput.xy;
	let conic = fsInput.con_o.xyz;
	let power = -0.5 * (conic.x * d.x * d.x + conic.z * d.y * d.y) + conic.y * d.x * d.y;
	let opacity = fsInput.con_o.w;

	if(power > 0.0) {
		discard;
	}

	let alpha = min(0.99, opacity * exp(power));

	return vec4f(fsInput.col * alpha, alpha);
}