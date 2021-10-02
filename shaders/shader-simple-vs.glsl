attribute vec3 aVertexPosition;
attribute vec2 aVertexGradient;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
varying vec2 vPos;
varying vec2 vGrad;
varying vec2 vTexBlend;

void main(void) {
	vec4 transformedCoord = uMVMatrix * vec4(aVertexPosition,1.0);	//todo use 4x3 mat?
	gl_Position = uPMatrix * transformedCoord;	
	vPos = aVertexPosition.xy;
	vGrad = 1024.0*aVertexGradient;	//should be muiltiplied by grid squares per unit.
	float amountTexB = smoothstep (-0.01, 0.01, aVertexPosition.z);
	vTexBlend = vec2(1.0-amountTexB, amountTexB);
}