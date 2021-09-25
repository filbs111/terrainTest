

var tmpCurrentlyBoundTextures = {};	//for inspection. seems that gl.TEXTURE3 needs to be rebound.
// var wipeTex = false;				//perhaps binding doesn't work until texture loaded.

var bind2dTextureIfRequired = (function createBind2dTextureIfRequiredFunction(){
	var currentlyBoundTextures={};

	tmpCurrentlyBoundTextures=currentlyBoundTextures;

	return function(texToBind, texId = gl.TEXTURE0){	//TODO use different texture indices to keep textures loaded?
		//curently just assuming using tex 0, already set as active texture (is set active texture a fast gl call?)
		//note that ids typically high numbers. gl.TEXTURE0 and so on. seem to be consecutive numbers but don't know if guaranteed.

		// if(wipeTex){
		// 	currentlyBoundTextures={};
		// 	//currentlyBoundTextures[wipeTex]=null;
		// 	wipeTex=false;
		// }

		//workaround wierd bug
		if (texId == gl.TEXTURE3){
			currentlyBoundTextures[texId] = null;
		}

		//if (texToBind != currentlyBoundTextures[texId]){
            //^^some bug with this. TODO fix.
        if (true){
			gl.activeTexture(texId);
			gl.bindTexture(gl.TEXTURE_2D, texToBind);
			currentlyBoundTextures[texId] = texToBind;
		}
	}
})();


function makeTexture(src, imgformat=gl.RGBA, imgtype=gl.UNSIGNED_BYTE, yFlip = true) {	//to do OO
	var texture = gl.createTexture();
		
	bind2dTextureIfRequired(texture);
	//dummy 1 pixel image to avoid error logs. https://stackoverflow.com/questions/21954036/dartweb-gl-render-warning-texture-bound-to-texture-unit-0-is-not-renderable
		//(TODO better to wait for load, or use single shared 1pix texture (bind2dTextureIfRequired to check that texture loaded, by flag on texture? if not loaded, bind the shared summy image?
		//TODO progressive detail load?
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([255, 0, 255, 255])); // magenta. should be obvious when tex not loaded.
	
	texture.image = new Image();
	texture.image.onload = function(){

		wipeTex=true;	//hack to ensure textures bound once loaded

		console.log("texture onload. src = " + src);
		bind2dTextureIfRequired(texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, yFlip);

		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	//linear colorspace grad light texture (TODO handle other texture differently?)
		gl.texImage2D(gl.TEXTURE_2D, 0, imgformat, imgformat, imgtype, texture.image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.generateMipmap(gl.TEXTURE_2D);
		bind2dTextureIfRequired(null);	//AFAIK this is just good practice to unwanted side effect bugs
	};	
	texture.image.src = src;
	return texture;
}