precision mediump float;
varying vec2 vPos;
varying vec2 vGrad;

varying vec4 vDebugColor;

void main(void){
    //gl_FragColor=vec4(vec3(10.0*vColor.z + 0.1),1.0);

    vec3 norm = normalize(vec3(vGrad, 1.0));
    vec3 color= 0.5*(vec3(1.0) + norm);

    gl_FragColor=vDebugColor * vec4(color, 1.0);
}