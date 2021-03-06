#define TEX_DOWNSCALE 4.0

precision mediump float;

uniform sampler2D uSampler;
uniform sampler2D uSamplerB;
uniform sampler2D uSamplerNormals;
varying vec2 vPos;
varying vec2 vGrad;
varying vec2 vTexBlend;

varying vec4 vDebugColor;

void main(void){
    //gl_FragColor=vec4(vec3(10.0*vColor.z + 0.1),1.0);

    vec2 samplePos = vec2(vPos.x, 1.0-vPos.y);
        //note only using 1.0-... so consistent with uGrad vertex shader gradient. TODO simplify

    vec4 normalMapSample = texture2D(uSamplerNormals, samplePos);	

    vec2 texCoord = vPos * vec2(TEX_DOWNSCALE);
    vec4 texColor = texture2D(uSampler, texCoord);
    vec4 texColorB = texture2D(uSamplerB, texCoord);
    vec4 texColorBlend = vTexBlend.x * texColor + vTexBlend.y * texColorB;

    vec3 norm = normalize( normalMapSample.yxz - vec3(0.5));
    norm.y= -norm.y;
        //note only using so consistent with uGrad vertex shader gradient. TODO simplify

    //float lighting = dot(norm, vec3(0.0,0.0,1.0));
    vec3 directionToSun = vec3(0.0,0.7,0.7);

    float lighting = max( dot(norm, directionToSun), 0.0 );

    float postGammaLighting = pow(lighting, 0.455);

    gl_FragColor= texColorBlend * vDebugColor * vec4(vec3(postGammaLighting), 1.0);
}