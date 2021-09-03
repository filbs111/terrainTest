//quadtree stuff
var scene = (
    function(){
        var viewpointPos = {x:-100, y:0};
        var quadtree;

        document.getElementById("mycanvasoverlay").addEventListener('mousedown', (e) => {
            
			var rect = e.target.getBoundingClientRect();
			viewpointPos.x = e.clientX - rect.left; //x position within the element.
			viewpointPos.y = e.clientY - rect.top;

            quadtree = calculateQuadtree(viewpointPos, {xpos:0, ypos:0, size:terrainSize});
            console.log(quadtree);
        });

        return {
            getPos: function(){
                return viewpointPos;
            },
            getQuadtree: function(){
                return quadtree;
            }
        }
    }
)();

var canvasDrawBlockFunc;

var overlayctx;

var doUponTerrainInitialised = function(terrainHeightData){

	//draw stuff to a canvas. acting on imagedata faster but fillrect quicker to code...
	var mycanvas = document.getElementById("mycanvas");
	mycanvas.width=terrainSize;
	mycanvas.height=terrainSize;

	var ctx = mycanvas.getContext("2d");

	for (var ii=0;ii<terrainSize;ii++){
		for (var jj=0;jj<terrainSize;jj++){
			var colour = Math.floor(Math.min(255,Math.max(0,128+(400*terrainHeightData.getxy(ii,jj)))));
			ctx.fillStyle = "rgba("+colour+",0,"+(255-colour)+",1)";
			ctx.fillRect(ii,jj,1,1);
		}
	}

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
		//console.log(vertex2dData);
		//generate gradient/normal data.
		for (var ii=0;ii<=gridSize;ii++){
			for (var jj=0;jj<=gridSize;jj++){
				grads.push(vertex2dData[(ii+1)&terrainSizeMinusOne][jj] - vertex2dData[(ii-1)&terrainSizeMinusOne][jj]);
				grads.push(vertex2dData[ii][(jj+1)&terrainSizeMinusOne] - vertex2dData[ii][(jj-1)&terrainSizeMinusOne]);
			}
		}
		//console.log(grads);
		
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

		return {vertices, grads, indices};
	})(terrainSize);

	initBuffers(gridData);	
}


//gl terrain rendering. TODO break into files/IIFE
//copied webgl_utils assumes canvas var is canvas. 

var canvas = document.getElementById("myglcanvas");
canvas.width = 800;
canvas.height = 600;

//TODO 
//create buffers, shaders, initialise gl etc etc...

function init(){
	initGL();
	
	//check can clear colour
	gl.clearColor.apply(gl,[1,1,0,1]);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	initShaders();
	// createDiamondSquareTerrain(terrainSize, doUponTerrainInitialised);
	loadHeightmapTerrain(terrainSize, doUponTerrainInitialised);

	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	mat4.perspective(60, gl.viewportWidth/gl.viewportHeight, 0.1,200.0,pMatrix);	//apparently 0.9.5, last param is matrix rather than 1st!! todo use newer???
																	//also old one uses degs!
	
	gl.useProgram(shaderPrograms.simple);

	prepBuffersForDrawing(terrainBuffer, shaderPrograms.simple);
	
    gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);

	stats.setup();
	
	var overlaycanvas = document.getElementById("mycanvasoverlay");
	overlaycanvas.width = terrainSize;
	overlaycanvas.height = terrainSize;
	overlayctx = overlaycanvas.getContext("2d");
	overlayctx.fillStyle = "rgba(255, 255, 255, 0.5)";
	canvasDrawBlockFunc = getCanvasDrawBlockFunc(overlayctx);

	requestAnimationFrame(drawScene);
}

var shaderPrograms={};
function initShaders(){
	shaderPrograms.simple = loadShader( "shader-simple-vs", "shader-simple-fs",{
					attributes:["aVertexPosition", "aVertexGradient"],
					uniforms:["uMVMatrix","uPMatrix"]
					});
}
var terrainBuffer={};
function initBuffers(sourceData){
	var bufferObj = terrainBuffer;
		
	bufferObj.vertexPositionBuffer = gl.createBuffer();
	bufferArrayData(bufferObj.vertexPositionBuffer, sourceData.vertices, 3);
	bufferObj.vertexGradientBuffer = gl.createBuffer();
	bufferArrayData(bufferObj.vertexGradientBuffer, sourceData.grads, 2);
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

	renderQuadtree(scene.getQuadtree(), canvasDrawBlockFunc);

	drawTerrain();
}

function drawTerrain(){
	
	if (!terrainBuffer.isInitialised){return;}

	// drawObjectFromPreppedBuffers(terrainBuffer, shaderPrograms.simple);
	var shaderProg = shaderPrograms.simple;
	var bufferObj = terrainBuffer;

	gl.uniformMatrix4fv(shaderProg.uniforms.uPMatrix, false, pMatrix);
	gl.uniformMatrix4fv(shaderProg.uniforms.uMVMatrix, false, mvMatrix);


	var downsizeAmount = 1 << parseInt(document.getElementById("scaleslider").value);
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


	renderQuadtree(scene.getQuadtree(), glDrawBlock);

	function glDrawBlock(xpos,ypos,size){
		drawBlock(size*32/terrainSize, xpos/size, ypos/size);
	}

	function drawBlock(downsizeAmount, xx, yy){
		var shiftAmount = downsizeAmount*(xx*VERTS_PER_DIVISION + yy*32);
	
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
		gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize , gl.FLOAT, false, 12*downsizeAmount, 12*shiftAmount);
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientBuffer);
		gl.vertexAttribPointer(shaderProg.attributes.aVertexGradient, bufferObj.vertexGradientBuffer.itemSize, gl.FLOAT, false, 8*downsizeAmount, 8*shiftAmount);
		gl.drawElements(gl.TRIANGLE_STRIP, bufferObj.vertexIndexBuffer.numItems/32, gl.UNSIGNED_SHORT, 0);
	}

}






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

init();