var centrePos = [0.5,0.5];

//quadtree stuff
var scene = (
    function(){
        var viewpointPos = {x:-100, y:0, z:0};
        var quadtree;
		var blockStrips;

        document.getElementById("mycanvasoverlay").addEventListener('mousedown', (e) => {
            
			var rect = e.target.getBoundingClientRect();
			viewpointPos.x = e.clientX - rect.left; //x position within the element.
			viewpointPos.y = e.clientY - rect.top;
			viewpointPos.z = Number.parseInt(document.getElementById("height-slider").value);

            setPos(viewpointPos.x, viewpointPos.y, viewpointPos.z);
			console.log(quadtree);
        });

		function setPos(xx,yy,zz){

			//TODO splitpos upon changing function
			var quadtreeoption = document.getElementById("quadtree-splitfunc").value;
			if (quadtreeoption == "effective-a"){
				quadtreeSplitFunc = shouldSplitDuocylinderEffectiveDistance;
			}else if (quadtreeoption == "effective-b"){	
				quadtreeSplitFunc = shouldSplitDuocylinderEffectiveDistanceB;
			}else if (quadtreeoption == "a"){
				quadtreeSplitFunc = shouldSplitDuocylinder4DDistance;
			}else if (quadtreeoption == "b"){
				quadtreeSplitFunc = shouldSplitDuocylinder4DDistanceB;
			}
			

			viewpointPos.x = xx;
			viewpointPos.y = yy;
			viewpointPos.z = zz;
			centrePos = [viewpointPos.x/terrainSize, viewpointPos.y/terrainSize];
            quadtree = calculateQuadtree(viewpointPos, {xpos:0, ypos:0, size:terrainSize});

			//generate list of strips for drawing (combined blocks)
			blocksforscales = {};
			renderQuadtree(quadtree, generateBlockInfo);
			//console.log(blocksforscales);

			blockStrips = blockStripsFromBlockInfo(blocksforscales);
			// console.log(blockStrips);

			return quadtree;
		}

		//generate a list of strips covering consectutive quadtree blocks
		//note this code is inefficient, and is intended to test performance improvement of 
		//rendering consecutive blocks using single draw calls. optimise if works.
		//note that with square morph ranges, easy to calculate strips without use of quadtree data.
		//also, can extend strips up to morph ranges- no need to stick to quadtree...

		var blocksforscales;
		function generateBlockInfo(xpos,ypos,size){
			// console.log("in generateBlockInfo. blocksforscales = " + blockstrips)
			var combocoords = 1024*ypos + xpos;
			if (!blocksforscales[size]){
				blocksforscales[size]=[];
			}
			blocksforscales[size].push(combocoords);
		}
		function blockStripsFromBlockInfo(blocksforscales){
			var scales = Object.keys(blocksforscales);
			var blockStripsForScales={};
			for (var ss of scales){
				ss = Number.parseInt(ss);	//??
				// console.log(ss);
				var blockStripForThisScale=[];

				//show that not in convenient order
				// for (var cc of blocksforscales[ss]){
				// 	var xx = cc & 1023;
				// 	var yy = cc >> 10;
				// 	console.log("xx/ss: " + xx/ss + " , yy/ss: " + yy/ss);
				// }

				var arrayofcombocoords = blocksforscales[ss];
				for (var xx=0;xx<1024;xx+=ss){
					var currentline = false;
					for (var yy=0;yy<1024;yy+=ss){
						var combocoordidx = (yy<<10) + xx;
						if (arrayofcombocoords.indexOf(combocoordidx)!=-1){
							if (currentline){
								currentline.count++;
							}else{
								currentline = {combocoordstart:combocoordidx, count:1};
							}
						}else{
							if (currentline){
								blockStripForThisScale.push(currentline);
							}
							currentline = false;
						}
					}
					if (currentline){
						blockStripForThisScale.push(currentline);
					}
				}

				blockStripsForScales[ss] = blockStripForThisScale;
			}
			return blockStripsForScales;
		}

        return {
            getPos: function(){
                return viewpointPos;
            },
            getQuadtree: function(){
                return quadtree;
            },
			getBlockStrips: function(){
                return blockStrips;
            },
			setPos
        }
    }
)();

var canvasDrawBlockFunc;

var overlayctx;


var doUponTerrainInitialised = function(terrainHeightData){

	timeLog("terrain initialisation callback");

	//draw stuff to a canvas. acting on imagedata faster but fillrect quicker to code...
	var mycanvas = document.getElementById("mycanvas");
	mycanvas.width=terrainSize;
	mycanvas.height=terrainSize;

	var ctx = mycanvas.getContext("2d");

	const arr = new Uint8ClampedArray(4*terrainSize*terrainSize);

	var idx = 0;
	for (var ii=0;ii<terrainSize;ii++){
		for (var jj=0;jj<terrainSize;jj++,idx+=4){
			var colour = Math.floor(Math.min(255,Math.max(0,128+(400*terrainHeightData.getxy(jj,ii)))));
			arr[idx + 0] = colour;    // R value
			arr[idx + 1] = 0;  // G value
			arr[idx + 2] = 255-colour;    // B value
			arr[idx + 3] = 255;  // A value
		}
	}

	timeLog("generated canvas array");

	// Initialize a new ImageData object
	let imageData = new ImageData(arr, terrainSize);

	// Draw image data to the canvas
	ctx.putImageData(imageData, 0, 0);

	timeLog("put image to canvas");

	//this is a modified copy of data/gridData from 3sphere project

	var gridData=(function generateGridData(gridSize){
		//TODO buffers should be include whether or not they are strip or triangle type. 
		//initially just do triangles. strip more efficient. for large grid, towards 1 vertex per triangle, rather than 3. (though indexed, so cost quite small)

		var vertices = [];
		var grads = [];	//might be able to use 2d gradient instead of 3d normal. perhaps normal quicker to use in shader though.
		var indices = [];
		//create vertices first. for 3-sphere grid, loops, so different (here have vertices on opposite sides (and 4 corners) that share z-position
		var vertex2dData=[];
		var thisLine;
		for (var ii=0;ii<=gridSize;ii++){
			thisLine = [];
			vertex2dData.push(thisLine);
			for (var jj=0;jj<=gridSize;jj++){
				vertices.push(ii/gridSize);			//TODO how to push multiple things onto an array? 
				vertices.push(jj/gridSize);
				//vertices.push(Math.random());	//TODO maybe shouldn't have z. z might be used for other stuff though eg water depth.
				
				var height = terrainHeightData.getxy(ii & terrainSizeMinusOne,jj & terrainSizeMinusOne);
				height = 0.15*Math.max(height,-0.1);	//raise deep parts to "sea" level
				thisLine.push(height);
				
				vertices.push(height);	
				//vertices.push(0.05*Math.sin(ii*0.1)*Math.sin(jj*0.1));
				//vertices.push(0.03*Math.random());
			}
		}

		timeLog("generated grid data part 1");

		//console.log(vertex2dData);
		//generate gradient/normal data.
		for (var ii=0;ii<=gridSize;ii++){
			for (var jj=0;jj<=gridSize;jj++){
				grads.push(vertex2dData[(ii+1)&terrainSizeMinusOne][jj] - vertex2dData[(ii-1)&terrainSizeMinusOne][jj]);
				grads.push(vertex2dData[ii][(jj+1)&terrainSizeMinusOne] - vertex2dData[ii][(jj-1)&terrainSizeMinusOne]);
			}
		}

		timeLog("generated grid data grads");

		//extra positions/grads for morphing LOD transition
		var morphverts=new Array(gridSize*gridSize*3);
		var morphgrads=new Array(gridSize*gridSize*2);
		var gridIdxV=0;
		var gridIdxG=0;

		for (var ii=0;ii<=gridSize;ii++){
			for (var jj=0;jj<=gridSize;jj++){
				var mapped = downsizePair(ii,jj);
				morphverts[gridIdxV++]=vertices[mapped*3];
				morphverts[gridIdxV++]=vertices[mapped*3+1];
				morphverts[gridIdxV++]=vertices[mapped*3+2];
				morphgrads[gridIdxG++]=grads[mapped*2];
				morphgrads[gridIdxG++]=grads[mapped*2+1];
			}
		}
		
		timeLog("generated grid data morph verts");

		//draw a strip of strips (big "strip" stripWidth wide, formed of gridSize* strips of stripWidth length, and width 1 )

		var stripWidth = terrainSize/DIVISIONS;	//strip of strips	
		var bottomOfRowIdx = 0;
		for (var jj=0;jj<gridSize;jj++){
			var idx = bottomOfRowIdx;
			indices.push(idx);	//1st in strip will be repeated
			for (var ii=0;ii<=stripWidth;ii++){
				indices.push(idx++);
				indices.push(idx);
				idx+=gridSize; //gridSize+1 = one row of verts
			}
			indices.push(idx-gridSize);	//repeat last in strip
			bottomOfRowIdx++;
		}

		timeLog("generated grid data strips");


		return {vertices, grads, morphverts, morphgrads, indices};
	})(terrainSize);

	timeLog("generated grid data");

	initBuffers(gridData);
	
	timeLog("initialised buffers");
}


//gl terrain rendering. TODO break into files/IIFE
//copied webgl_utils assumes canvas var is canvas. 

var canvas = document.getElementById("myglcanvas");
canvas.width = 800;
canvas.height = 600;

//TODO 
//create buffers, shaders, initialise gl etc etc...

var switchShader= (function(){
	var currentShader;
	return function(shader){
		if (currentShader==shader){
			return;
		}
		currentShader = shader;
		gl.useProgram(shader);
		prepBuffersForDrawing(terrainBuffer, shader);

		bind2dTextureIfRequired(texture);
		bind2dTextureIfRequired(textureB, gl.TEXTURE1);
		bind2dTextureIfRequired(textureNormals, gl.TEXTURE2);

	}

})();

var texture;
var textureB;
var textureNormals;

function init(){
	initGL();
	
	//check can clear colour
	gl.clearColor.apply(gl,[0,1,0,1]);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	initShaders();
	texture = makeTexture("img/1.png",gl.RGB,gl.UNSIGNED_SHORT_5_6_5);
	textureB = makeTexture("img/3.png",gl.RGB,gl.UNSIGNED_SHORT_5_6_5);
	textureNormals = makeTexture("img/normals1024.png",gl.RGB,gl.UNSIGNED_SHORT_5_6_5);	//TODO format better suited for normal maps
		//TODO auto generate normal map from heightmap data

	// createDiamondSquareTerrain(terrainSize, doUponTerrainInitialised);
	loadHeightmapTerrain(terrainSize, doUponTerrainInitialised);

	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	mat4.perspective(60, gl.viewportWidth/gl.viewportHeight, 0.01,10.0,pMatrix);	//apparently 0.9.5, last param is matrix rather than 1st!! todo use newer???
																	//also old one uses degs!
	
	switchShader(shaderPrograms.simple);
	
    gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);

	stats.setup();
	
	var overlaycanvas = document.getElementById("mycanvasoverlay");
	overlaycanvas.width = terrainSize;
	overlaycanvas.height = terrainSize;
	overlayctx = overlaycanvas.getContext("2d");
	canvasDrawBlockFunc = getCanvasDrawBlockFunc(overlayctx);

	requestAnimationFrame(drawScene);
}

var shaderPrograms={};
function initShaders(){
	shaderPrograms.simple = loadShader( "shader-simple-vs", "shader-textured-fs",{
		attributes:["aVertexPosition", "aVertexGradient"],
		uniforms:["uMVMatrix","uPMatrix","uSampler","uSamplerB","uSamplerNormals"]
		});
	shaderPrograms.morph = loadShader( "shader-morph-vs", "shader-textured-fs",{
		attributes:["aVertexPosition", "aVertexMorph", "aVertexGradient", "aVertexGradientMorph"],
		uniforms:["uMVMatrix","uPMatrix","uSampler","uSamplerB","uSamplerNormals","uCentrePos","uMorphScale"]
		});
}
var terrainBuffer={};
function initBuffers(sourceData){
	var bufferObj = terrainBuffer;
		
	bufferObj.vertexPositionBuffer = gl.createBuffer();
	bufferArrayData(bufferObj.vertexPositionBuffer, sourceData.vertices, 3);
	bufferObj.vertexMorphBuffer = gl.createBuffer();
	bufferArrayData(bufferObj.vertexMorphBuffer, sourceData.morphverts, 3);

	bufferObj.vertexGradientBuffer = gl.createBuffer();
	bufferArrayData(bufferObj.vertexGradientBuffer, sourceData.grads, 2);
	bufferObj.vertexGradientMorphBuffer = gl.createBuffer();
	bufferArrayData(bufferObj.vertexGradientMorphBuffer, sourceData.morphgrads, 2);	

	bufferObj.vertexIndexBuffer = gl.createBuffer();

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferObj.vertexIndexBuffer);
	//sourceData.indices = [].concat.apply([],sourceData.faces);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sourceData.indices), gl.STATIC_DRAW); 	//note uint16 limits to 256*256 verts
	bufferObj.vertexIndexBuffer.itemSize = 3;
	bufferObj.vertexIndexBuffer.numItems = sourceData.indices.length;

	terrainBuffer.isInitialised = true;

	function bufferArrayData(buffer, arr, size){
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
		buffer.itemSize = size;
		buffer.numItems = arr.length / size;
		console.log("buffered. numitems: " + buffer.numItems);
	}

}

function drawScene(frameTime){
	requestAnimationFrame(drawScene);

	stats.get().end();
	stats.get().begin();


	overlayctx.clearRect(0, 0, terrainSize, terrainSize);
	overlayctx.fillStyle = "rgba(255, 255, 255, 0.5)";
	overlayctx.strokeStyle = "#FFF";
	renderQuadtree(scene.getQuadtree(), canvasDrawBlockFunc);

	//draw point, ranges
	overlayctx.fillStyle = "#F00";
    overlayctx.strokeStyle = "#F00";
    var dotHalfSize = 5;
	var viewpointPos = scene.getPos();
    overlayctx.fillRect(viewpointPos.x - dotHalfSize, viewpointPos.y - dotHalfSize, 2*dotHalfSize, 2*dotHalfSize);
    drawCentredSquare(viewpointPos.x, viewpointPos.y, MIN_SIZE*(MULTIPLIER*2-1));
        //covers 2 quadtree levels. more detailed level must be morphed to less detailed
    drawCentredSquare(viewpointPos.x, viewpointPos.y, MIN_SIZE*(MULTIPLIER*2+1));
        //guaranteed to be some quadtree level. within this range, should transfer gradually to less detailed level
    drawCentredSquare(viewpointPos.x, viewpointPos.y, 2*MIN_SIZE*(MULTIPLIER*2-1));
        //...
    drawCentredSquare(viewpointPos.x, viewpointPos.y, 2*MIN_SIZE*(MULTIPLIER*2+1));
    drawCentredSquare(viewpointPos.x, viewpointPos.y, 4*MIN_SIZE*(MULTIPLIER*2-1));

	function drawCentredSquare(x,y,size){
		overlayctx.strokeRect(x - size, y - size, 2*size, 2*size);
	}

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	var movementSpeed = 0.001;
	//simple controls. TODO framerate dependent
	var turnInput=-0.005*(keyThing.keystate(39)-keyThing.keystate(37)); //turn
	var pitchInput=-0.005*(keyThing.keystate(40)-keyThing.keystate(38)); //pitch
	var rollInput=-0.01*(keyThing.keystate(69)-keyThing.keystate(81));
	var sideMove=-movementSpeed*(keyThing.keystate(65)-keyThing.keystate(68));	//lateral
	var forwardMove=-movementSpeed*(keyThing.keystate(87)-keyThing.keystate(83));	//fwd/back
	var unrotatedMoveVector = [sideMove,0,forwardMove];
	
	mat4.rotateY(camMatrix,turnInput);
	mat4.rotateX(camMatrix,pitchInput);
	mat4.rotateZ(camMatrix,rollInput);
	mat4.translate(camMatrix, unrotatedMoveVector);

	mat4.set(camMatrix,mvMatrix);
	mat4.inverse(mvMatrix);


	//draw grid of terrains. defaults to 1. larger currently ject for performance test. quadtree
	//is reused so beyond 1st terrain, point of interest is not camera position. 
	//will use this to check for seams when wrapping. current quadtree/ detail ranges will result in seams
	//the below amounts to simply one drawTerrain(); call, if repeat-tiles is 1

	var repeatTiles = document.getElementById("repeat-tiles").value;
	var repeatTilesSeparation = document.getElementById("repeat-tiles-separation").value;

	for (var aa=0;aa<repeatTiles;aa++){
		for (var bb=0;bb<repeatTiles;bb++){
			drawTerrain();
			mat4.translate(mvMatrix,[repeatTilesSeparation,0,0]);
		}
		mat4.translate(mvMatrix,[-repeatTiles*repeatTilesSeparation,repeatTilesSeparation,0]);
	}
}

var moveVel={x:1,y:1};

function drawTerrain(){
	
	if (!terrainBuffer.isInitialised){return;}

	if (document.getElementById("automove").checked){
		scene.setPos(camMatrix[12]*terrainSize, camMatrix[13]*terrainSize, camMatrix[14]*terrainSize);
	}

	var rendertype = document.getElementById("rendertype").value;

	// drawObjectFromPreppedBuffers(terrainBuffer, shaderPrograms.simple);

	
	var shaderProg = (rendertype=="bruteforcenomorph") ? shaderPrograms.simple: shaderPrograms.morph;
	switchShader(shaderProg);

	if (shaderProg.uniforms.uCentrePos){
		gl.uniform2fv(shaderProg.uniforms.uCentrePos, centrePos);
	}
	gl.uniformMatrix4fv(shaderProg.uniforms.uPMatrix, false, pMatrix);
	gl.uniformMatrix4fv(shaderProg.uniforms.uMVMatrix, false, mvMatrix);
	
	gl.uniform1i(shaderProg.uniforms.uSampler, 0);
	gl.uniform1i(shaderProg.uniforms.uSamplerB, 1);
	gl.uniform1i(shaderProg.uniforms.uSamplerNormals, 2);

	var bufferObj = terrainBuffer;

	//var downsizeAmount = 1 << parseInt(document.getElementById("scaleslider").value);
	//note things don't work right for downsize = 32 (expect to draw 1 32x32 tile). suspect because
	// stride exceeds 256. if so, may want separate sets of vertices. also high stride might 
	//make rendering slower...

	// if (!document.getElementById("downscale").checked){
	// 	for (var ii=0;ii<DIVISIONS;ii++){
	// 		//TODO interleaved single buffer to avoid bindbuffer calls?
	// 		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
	// 		gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize , gl.FLOAT, false, 0, ii*12*VERTS_PER_DIVISION);
	// 		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientBuffer);
	// 		gl.vertexAttribPointer(shaderProg.attributes.aVertexGradient, bufferObj.vertexGradientBuffer.itemSize, gl.FLOAT, false, 0, ii*8*VERTS_PER_DIVISION);
		
	// 		gl.drawElements(gl.TRIANGLE_STRIP, bufferObj.vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
	// 	}
	// }else{
	// 	for (var ii=0;ii<DIVISIONS/downsizeAmount;ii++){
	// 		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
	// 		gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize , gl.FLOAT, false, 12*downsizeAmount, ii*12*downsizeAmount*VERTS_PER_DIVISION);
	// 		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientBuffer);
	// 		gl.vertexAttribPointer(shaderProg.attributes.aVertexGradient, bufferObj.vertexGradientBuffer.itemSize, gl.FLOAT, false, 8*downsizeAmount, ii*8*downsizeAmount*VERTS_PER_DIVISION);
	// 		gl.drawElements(gl.TRIANGLE_STRIP, bufferObj.vertexIndexBuffer.numItems/downsizeAmount, gl.UNSIGNED_SHORT, 0);
	// 	}
	// }

	
	if (rendertype == 'bruteforce'){
		for (var ii=0;ii<DIVISIONS;ii++){
			//TODO interleaved single buffer to avoid bindbuffer calls?
			gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
			gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize , gl.FLOAT, false, 0, ii*12*VERTS_PER_DIVISION);
			gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexMorphBuffer);
			gl.vertexAttribPointer(shaderProg.attributes.aVertexMorph, bufferObj.vertexMorphBuffer.itemSize , gl.FLOAT, false, 0, ii*12*VERTS_PER_DIVISION);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientBuffer);
			gl.vertexAttribPointer(shaderProg.attributes.aVertexGradient, bufferObj.vertexGradientBuffer.itemSize, gl.FLOAT, false, 0, ii*8*VERTS_PER_DIVISION);
			gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientMorphBuffer);
			gl.vertexAttribPointer(shaderProg.attributes.aVertexGradientMorph, bufferObj.vertexGradientMorphBuffer.itemSize, gl.FLOAT, false, 0, ii*8*VERTS_PER_DIVISION);

			gl.drawElements(gl.TRIANGLE_STRIP, bufferObj.vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
		}
	}else if(rendertype == 'bruteforcenomorph'){
		for (var ii=0;ii<DIVISIONS;ii++){
			//TODO interleaved single buffer to avoid bindbuffer calls?
			gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
			gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize , gl.FLOAT, false, 0, ii*12*VERTS_PER_DIVISION);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientBuffer);
			gl.vertexAttribPointer(shaderProg.attributes.aVertexGradient, bufferObj.vertexGradientBuffer.itemSize, gl.FLOAT, false, 0, ii*8*VERTS_PER_DIVISION);
			
			gl.drawElements(gl.TRIANGLE_STRIP, bufferObj.vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
		}
	}else if(rendertype == 'morphing'){
		renderQuadtree(scene.getQuadtree(), glDrawBlock);
	}else if(rendertype == 'morphing-blockstrips'){
		//block strips
		drawDebugResults = [];

		var blockStrips = scene.getBlockStrips();
		var scales = Object.keys(blockStrips);
		for (var ss of scales){
			// if (ss!=32){continue;}
			var blocksForThisScale = blockStrips[ss];
			for (var strip of blocksForThisScale){
				var combocoordidx = strip.combocoordstart;
				var xx = combocoordidx & 1023;
				var yy = combocoordidx >> 10;
				glDrawBlock(xx, yy, Number.parseInt(ss), strip.count);

				drawDebugResults.push({xx,yy,ss:Number.parseInt(ss),count:strip.count});
			}
		}
		//try drawing something predictable
		// for (var yy=0;yy<1024;yy+=32){
		// 	glDrawBlock(yy, 0, 32, 32);
		// }
	}else if(rendertype == 'lowres'){
		//draw small number of polygons. useful for checking baseline GPU usage, eg due to pix shader.
		for (var yy=0;yy<1024;yy+=256){
			glDrawBlock(yy, 0, 256, 4);
		}
	}


	function glDrawBlock(xpos,ypos,size, numblocks){
		drawBlock(size*32/terrainSize, xpos/size, ypos/size, numblocks);
	}

	function drawBlock(downsizeAmount, xx, yy, numblocks){
		if (!numblocks){numblocks=1;}

		gl.uniform1f(shaderProg.uniforms.uMorphScale, downsizeAmount/1024 );	//TODO draw blocks at each scale consecutively, so don't call this every block
	
		var shiftAmount = downsizeAmount*(xx*VERTS_PER_DIVISION + yy*32);
	
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
		gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize , gl.FLOAT, false, 12*downsizeAmount, 12*shiftAmount);
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexMorphBuffer);
		gl.vertexAttribPointer(shaderProg.attributes.aVertexMorph, bufferObj.vertexMorphBuffer.itemSize , gl.FLOAT, false, 12*downsizeAmount, 12*shiftAmount);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientBuffer);
		gl.vertexAttribPointer(shaderProg.attributes.aVertexGradient, bufferObj.vertexGradientBuffer.itemSize, gl.FLOAT, false, 8*downsizeAmount, 8*shiftAmount);
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientMorphBuffer);
		gl.vertexAttribPointer(shaderProg.attributes.aVertexGradientMorph, bufferObj.vertexGradientMorphBuffer.itemSize, gl.FLOAT, false, 8*downsizeAmount, 8*shiftAmount);

		gl.drawElements(gl.TRIANGLE_STRIP, numblocks*bufferObj.vertexIndexBuffer.numItems/32, gl.UNSIGNED_SHORT, 0);
	}

}


var drawDebugResults;




function prepBuffersForDrawing(bufferObj, shaderProg){
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferObj.vertexIndexBuffer);
}


var mvMatrix = mat4.create();
mat4.identity(mvMatrix);
var pMatrix = mat4.create();
mat4.identity(pMatrix);
//mat4.translate(mvMatrix,vec3.fromArray([0,0,-10])); //glmatix expects own vector type

mvMatrix[14]=-0.7;	//move back to look at thing (is this camera or thing position?)
mvMatrix[13]=-0.4;
mvMatrix[12]=-0.5;

mat4.rotateX(mvMatrix, -0.5);	//rads

var camMatrix = mat4.create(mvMatrix);	//just setting mvMatrix to this, so could get away with 
				//later may wish to alter mvMatrix (to position things in world)
mat4.inverse(camMatrix);

var timeLog = (function(){

	var time = Date.now();

	return function(description){
		var timeNow = Date.now();
		console.log("time log for: " + description + " t=" + timeNow + " (+ " + (timeNow - time));
		time = timeNow;
	}
})();

init();