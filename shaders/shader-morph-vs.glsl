#define CONST_TAU 6.28318
#define CONST_QPI 0.785398

attribute vec3 aVertexPosition;
attribute vec3 aVertexMorph;
attribute vec2 aVertexGradient;
attribute vec2 aVertexGradientMorph;
//attribute vec3 aVertexNormal;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform vec3 uCentrePos;
uniform float uMorphScale;
varying vec2 vPos;
varying vec2 vGrad;
varying vec2 vTexBlend;

varying vec4 vDebugColor;

void main(void) {


#ifdef IS_4D

//TODO equation using 4D vertex positions directly? might come out neater

    vec3 relativePos = vec3(aVertexPosition.xy,0.0) - uCentrePos;

    //TODO work out where these fudge factors come from (converting from quadtree split func, where these are 1.0)
    relativePos.z*=-1.0;  //??
    float fudgeFixer = 1024.0;
    float fudgeB = 0.8; //??

    float alpha = CONST_QPI + fudgeFixer*relativePos.z/500.0;
    float cosa = cos(alpha);
    float sina = sin(alpha);
    
    float cosu = cos(CONST_TAU * relativePos.x)*fudgeFixer/1024.0;
    float cosv = cos(CONST_TAU * relativePos.y)*fudgeFixer/1024.0;
    
    float sum = cosa*cosu + sina*cosv;

    //note picked 326 ~ 1024/PI out of hat
    //could speed up by square both sides
    float distFromCentre = fudgeB* 220.0 * sqrt(1.0-0.5*sum*sum) / fudgeFixer;
#else
//3d

#ifdef IS_PYTHAGORAS

#ifdef IS_3D
    float distFromCentre = length(vec3(aVertexPosition.xy, 0.0) - uCentrePos);

    float distzoverscale = uCentrePos.z/(uMorphScale*32.0);    //TODO some multiplier to find scale from uMorphScale
    float dsq = distzoverscale*distzoverscale;
    float distFromCentreDivisor = sqrt ( pow(sqrt(25.0 - dsq) - sqrt(2.0), 2.0) + dsq );
        //not efficient to calculate per vertex! could pass in as uniform
    distFromCentre*= 4.0/distFromCentreDivisor;

#else
    float distFromCentre = length(aVertexPosition.xy - uCentrePos.xy);
    distFromCentre*= 4.0/(5.0-sqrt(2.0));
#endif


#else
//2d Chebyshev distance
#ifdef DO_WRAP
    vec2 displacement = aVertexPosition.xy - uCentrePos.xy;
    vec2 moddedDist = vec2(-0.5)+mod( displacement +vec2(0.5) ,1.0);
    vec2 absDist = abs(moddedDist);
#else
    vec2 absDist = abs(aVertexPosition.xy - uCentrePos.xy);
#endif

//compound = length(2d chby dist, z distance)
#ifdef IS_COMPOUND
    float distFromCentre = length(vec2(max(absDist.x, absDist.y), uCentrePos.z));
#else
    float distFromCentre = max(absDist.x, absDist.y);
#endif

#endif


#endif
    

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