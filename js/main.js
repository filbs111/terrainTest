//naive/slow implementation of diamond square

var terrainSize=512;	//expect will want something like 128x128. check that something larger faster to validate calculation at runtime. alternatively can load image. if will generate at runtime, want something to do deterministic random numbers (Math.random() is not deterministic!!)
var terrainSizeMinusOne=terrainSize-1;

var DIVISIONS=terrainSize*terrainSize/32768;	
					//256+ (257*257 verts +) do in multiple parts to stay under 2^16 index limit
					//currently, decause divisions must have containt integer number of terrain lines, and 
					// all divisions equal, 
					// terrainSize/ DIVISIONS must be int, so DIVISIONS must be a power of 2, at least
					// ((terrainSize/256)^2 ) *2 . 
					// TODO? switch to integer terrain lines size, allow drawing of remainder division (last division can be smaller)
console.log("terrain divisions: " + DIVISIONS);

var VERTS_PER_DIVISION = (terrainSize+1)*(terrainSize/DIVISIONS);

var terrainHeightData = new Array(terrainSize*terrainSize);

//initialise
terrainHeightData[0] = 0;

var randomScale=1;
var startTime=Date.now();

for (offset = terrainSize;offset>1;offset/=2){
	//diamond step
	var halfOffset = offset/2;
	var count=0;
	for (var ii=halfOffset;ii<terrainSize;ii+=offset){
		for (var jj=halfOffset;jj<terrainSize;jj+=offset){
			setTerrainHeightDataXY(ii,jj, (terrainHeightXY(ii+halfOffset,jj+halfOffset) + terrainHeightXY(ii+halfOffset,jj-halfOffset) + terrainHeightXY(ii-halfOffset,jj+halfOffset) + terrainHeightXY(ii-halfOffset,jj-halfOffset))/4 + randomNumber());
			count++;
		}
	}
	
	console.log(count);
	
	//square step
	for (var ii=halfOffset;ii<terrainSize;ii+=offset){
		for (var jj=0;jj<terrainSize;jj+=offset){
			setTerrainHeightDataXY(ii,jj, (terrainHeightXY(ii+halfOffset,jj) + terrainHeightXY(ii-halfOffset,jj) + terrainHeightXY(ii,jj+halfOffset) + terrainHeightXY(ii,jj-halfOffset))/4 + randomNumber());
			setTerrainHeightDataXY(jj,ii, (terrainHeightXY(jj+halfOffset,ii) + terrainHeightXY(jj-halfOffset,ii) + terrainHeightXY(jj,ii+halfOffset) + terrainHeightXY(jj,ii-halfOffset))/4 + randomNumber());
		}
	}
	
	randomScale/=2.2;	//where should this go?
}

console.log("after computation: " + (Date.now()-startTime));

//draw stuff to a canvas. acting on imagedata faster but fillrect quicker to code...
var mycanvas = document.getElementById("mycanvas");
mycanvas.width=terrainSize;
mycanvas.height=terrainSize;

var ctx = mycanvas.getContext("2d");

for (var ii=0;ii<terrainSize;ii++){
	for (var jj=0;jj<terrainSize;jj++){
		var colour = Math.floor(Math.min(255,Math.max(0,128+(400*terrainHeightXY(ii,jj)))));
		ctx.fillStyle = "rgba("+colour+",0,"+(255-colour)+",1)";
		ctx.fillRect(ii,jj,1,1);
	}
}
console.log("after drawing: " + (Date.now()-startTime));

function randomNumber(){
	return randomScale*(Math.random()-0.5);
}

function setTerrainHeightDataXY(xx,yy,hh){
	terrainHeightData[xyindex(xx,yy)]=hh;
}

function terrainHeightXY(xx,yy){
	return terrainHeightData[xyindex(xx,yy)];
}

function xyindex(xx,yy){
	return (xx & terrainSizeMinusOne) + terrainSize*(yy & terrainSizeMinusOne);
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
			
			var height = terrainHeightXY(ii & terrainSizeMinusOne,jj & terrainSizeMinusOne);
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
	
	//strip data

	var startIdx=0;
	var nextRowStartIdx = gridSize+1;

	for (var ii=0;ii<gridSize/DIVISIONS;ii++){
		indices.push(startIdx);
		for (var jj=0;jj<=gridSize;jj++){
			indices.push(startIdx++);
			indices.push(nextRowStartIdx++);
		}
		indices.push(nextRowStartIdx-1);
	}
	indices.pop();
	indices.shift();

	return {vertices:vertices, grads:grads, indices:indices};
})(terrainSize);


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
	initBuffers();
	
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	mat4.perspective(60, gl.viewportWidth/gl.viewportHeight, 0.1,200.0,pMatrix);	//apparently 0.9.5, last param is matrix rather than 1st!! todo use newer???
																	//also old one uses degs!
	
	gl.useProgram(shaderPrograms.simple);

	prepBuffersForDrawing(terrainBuffer, shaderPrograms.simple);
	
    gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);

	stats.setup();
	
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
function initBuffers(){
	var bufferObj = terrainBuffer;
	var sourceData = gridData;
	
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

	drawTerrain();
}

function drawTerrain(){
	
	// drawObjectFromPreppedBuffers(terrainBuffer, shaderPrograms.simple);
	var shaderProg = shaderPrograms.simple;
	var bufferObj = terrainBuffer;

	gl.uniformMatrix4fv(shaderProg.uniforms.uPMatrix, false, pMatrix);
	gl.uniformMatrix4fv(shaderProg.uniforms.uMVMatrix, false, mvMatrix);

	for (var ii=0;ii<DIVISIONS;ii++){

		//TODO interleaved single buffer to avoid bindbuffer calls?
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
		gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize , gl.FLOAT, false, 0, ii*12*VERTS_PER_DIVISION);
		gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexGradientBuffer);
		gl.vertexAttribPointer(shaderProg.attributes.aVertexGradient, bufferObj.vertexGradientBuffer.itemSize, gl.FLOAT, false, 0, ii*8*VERTS_PER_DIVISION);
	
		gl.drawElements(gl.TRIANGLE_STRIP, bufferObj.vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
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

mvMatrix[14]=-0.2;	//move back to look at thing (is this camera or thing position?)
mvMatrix[13]=-0.1;
mvMatrix[12]=0;

mat4.rotateX(mvMatrix, -1.3);	//rads
mat4.rotateZ(mvMatrix, 0.8);	//rads

init();