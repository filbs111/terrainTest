#define CONST_TAU 6.28318

attribute vec3 aVertexPosition;
attribute vec3 aVertexMorph;
attribute vec2 aVertexGradient;
attribute vec2 aVertexGradientMorph;
//attribute vec3 aVertexNormal;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform vec2 uCentrePos;
uniform float uMorphScale;
varying vec2 vPos;
varying vec2 vGrad;
varying vec2 vTexBlend;

varying vec4 vDebugColor;

void main(void) {


    //Chebyshev distance
#ifdef DO_WRAP
    vec2 displacement = aVertexPosition.xy - uCentrePos;
    vec2 moddedDist = vec2(-0.5)+mod( displacement +vec2(0.5) ,1.0);
    vec2 absDist = abs(moddedDist);
#else
    vec2 absDist = abs(aVertexPosition.xy - uCentrePos);
#endif
    float distFromCentre = max(absDist.x, absDist.y);

    //float transitionRange = 128.0*uMorphScale;
    //float transitionRangeB = 96.0*uMorphScale;	//lowest possible, for 
    //float transitionWidth = 32.0*uMorphScale;	//greatest possible transition width

    float transitionRangeB = 112.0*uMorphScale;	//push transition out further
    float transitionWidth = 16.0*uMorphScale;



    float morphContinuous = clamp((distFromCentre - transitionRangeB)/ transitionWidth , 0.0, 1.0);

    vec2 modvec = mod(aVertexPosition.xy - vec2(uMorphScale) , 2.0*uMorphScale) - vec2(uMorphScale);
    modvec/=uMorphScale;	//normalise
    float lensq = dot(modvec, modvec);
    float stepped = step(0.001, lensq);	//number doesn't matter much
    float blendAmount = stepped*morphContinuous;

    vec3 vertexBlended = blendAmount*aVertexMorph + (1.0-blendAmount)*aVertexPosition;
    vec2 gradBlended = blendAmount*aVertexGradientMorph + (1.0-blendAmount)*aVertexGradient;
    
    vec4 transformedCoord = uMVMatrix * vec4(vertexBlended,1.0);	//todo use 4x3 mat?

    gl_Position = uPMatrix * transformedCoord;	
    
    vPos = vertexBlended.xy;
    vGrad = 1024.0*gradBlended;	//should be muiltiplied by grid squares per unit.

    float amountTexB = smoothstep (-0.01, 0.01, vertexBlended.z);
    vTexBlend = vec2(1.0-amountTexB, amountTexB);

    vDebugColor = vec4(vec3(1.0-0.5*blendAmount), 1.0);
}