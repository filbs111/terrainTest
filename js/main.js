//naive/slow implementation of diamond square

var terrainSize=256;	//expect will want something like 128x128. check that something larger faster to validate calculation at runtime. alternatively can load image. iff will generate at runtime, want something to do deterministic random numbers (Math.random() is not deterministic!!)
var terrainSizeMinusOne=255;

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
	
	randomScale/=2;	//where should this go?
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