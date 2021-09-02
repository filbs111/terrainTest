//naive/slow implementation of diamond square

var terrainSize=1024;	//expect will want something like 128x128. check that something larger faster to validate calculation at runtime. alternatively can load image. if will generate at runtime, want something to do deterministic random numbers (Math.random() is not deterministic!!)
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



var createDiamondSquareTerrain = function(terrainSize, cb){

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
        
        randomScale/=2.6;	//where should this go?
    }

    console.log("after computation: " + (Date.now()-startTime));

    //add a method onto array object. TODO terrain "class"?
    terrainHeightData.getxy = terrainHeightXY;

    cb(terrainHeightData);

  
    function randomNumber(){
        return randomScale*(Math.random()-0.5);
    }

    function setTerrainHeightDataXY(xx,yy,hh){
        terrainHeightData[xyindex(xx,yy)]=hh;
    }

    function xyindex(xx,yy){
        return (xx & terrainSizeMinusOne) + terrainSize*(yy & terrainSizeMinusOne);
    }

    function terrainHeightXY(xx,yy){
        return terrainHeightData[xyindex(xx,yy)];
    }
}

var loadHeightmapTerrain = function(terrainSize, cb){

    var terrainHeightData = new Array(terrainSize*terrainSize);

    //add a method onto array object. TODO terrain "class"?
    terrainHeightData.getxy = terrainHeightXY;

    var oReq = new XMLHttpRequest();
    oReq.open("GET", './heightmaps/try1024.r16', true); //16 bit heightmap.
    oReq.responseType = "arraybuffer";


    oReq.onload = function (oEvent) {
        var arrayBuffer = oReq.response; // Note: not oReq.responseText
        if (arrayBuffer) {
            var sixteenBitArray = new Uint16Array(arrayBuffer);
            for (var ii = 0; ii < sixteenBitArray.byteLength; ii++) {
                terrainHeightData[ii] = 0.00001*sixteenBitArray[ii] - 0.3;
            }

            cb(terrainHeightData);
        }
    };
    oReq.send(null);

    function terrainHeightXY(xx,yy){
        return terrainHeightData[xyindex(xx,yy)];
    }

    function xyindex(xx,yy){
        return (xx & terrainSizeMinusOne) + terrainSize*(yy & terrainSizeMinusOne);
    }
}