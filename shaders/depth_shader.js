var DepthShader = {

	uniforms: {
        
        'tDepth': { value: null }

	},

	vertexShader: [

		'varying vec2 vUv;',

		'void main() {',

		'	vUv = uv;',

		'	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

		'}'

	].join( '\n' ),

	fragmentShader: [

        '#include <common>',
        
        '#include <packing>',
        
        'uniform sampler2D tDepth;',

        'varying vec2 vUv;',
        
        'float readDepth( sampler2D depthSampler, vec2 coord ) {',

        '   float cameraFar = 100.0;',

        '   float fragCoordZ = texture2D( depthSampler, coord ).x;',

        '   float viewZ = perspectiveDepthToViewZ( fragCoordZ, 1.0, cameraFar );',

        '   return viewZToOrthographicDepth( viewZ, 1.0, cameraFar );',

        '}',

		'void main() {',

        '   float depth = readDepth( tDepth, vUv );',

        '   gl_FragColor.rgb = 1.0 - vec3( depth );',
        
        '	gl_FragColor.a = 1.0;',

		'}'

	].join( '\n' )

};

export {DepthShader};