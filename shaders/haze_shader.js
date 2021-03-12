var HazeShader = {

	uniforms: {
        
        'tDepth': { value: null },

        'tDiffuse': { value: null },

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

        'uniform sampler2D tDiffuse;',

        'varying vec2 vUv;',
        
        'float readDepth( sampler2D depthSampler, vec2 coord ) {',

        '   float cameraFar = 200.0;',

        '   float fragCoordZ = texture2D( depthSampler, coord ).x;',

        '   float viewZ = perspectiveDepthToViewZ( fragCoordZ, 1.0, cameraFar );',

        '   return viewZToOrthographicDepth( viewZ, 1.0, cameraFar );',

        '}',

		'void main() {',

        '   float depth = readDepth( tDepth, vUv );',

        '	vec4 color = texture2D( tDiffuse, vUv );',

        '   vec4 haze = vec4( 0.9, 0.8, 0.8, 1.0);',

        '   float intensity = depth * 0.6;',

        '   gl_FragColor = mix(color, haze, intensity);',

		'}'

	].join( '\n' )

};

export {HazeShader};