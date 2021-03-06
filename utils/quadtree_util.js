const MIN_SIZE = 32;

// var MULTIPLIER = 1.5; //ensures that neighbouring LOD levels differ by at most 1
const MULTIPLIER = 2.5;

var quadtreeShouldSplitFuncs = {
    "chebyshev": function shouldSplitChebyshevDistance(x,y,z,size){
        // return Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) < MULTIPLIER*size;
        return Math.max(Math.abs(x), Math.abs(y)) < MULTIPLIER*size;
    },
    "chebyshev-wrap": function shouldSplitChebyshevWrap(x,y,z,size){    //TODO when using this, adapt morph shader
        // return Math.max(Math.abs((Math.abs(x)+512)%1024 -512), Math.abs((((Math.abs(y)+512)%1024) - 512) ), Math.abs(z)) < MULTIPLIER*size;
        return Math.max(Math.abs((Math.abs(x)+512)%1024 -512), Math.abs((((Math.abs(y)+512)%1024) - 512) )) < MULTIPLIER*size;
    },
    "effective-a": function shouldSplitDuocylinderEffectiveDistance(x,y,z,size){ //ie distance in flat space where would appear at same size
        //TODO when using this, adjust morph shader and shapes displayed on minimap.
        //maybe simplify bounding shape. diamond? however, for camera position above/below surface, rectangular
        //regions will make sense.
        //also, note that quadtree should be symmetric in (+1/2, +1/2) transformation, so having 2 diamond landscapes instead of 1 square,
        //with same quadtrees, may make sense.

        var alpha = Math.PI/4 + z/500;
        var cosa = Math.cos(alpha);
        var sina = Math.sin(alpha);
    
        var cosu = Math.cos(2*Math.PI * x/1024);
        var cosv = Math.cos(2*Math.PI * y/1024);
    
        //note picked 326 ~ 1024/PI out of hat
        //could speed up by square both sides
        return 220 * Math.sqrt(1-0.5*(Math.pow( cosa*cosu + sina*cosv ,2))) < MULTIPLIER*size;
    },
    "effective-b": function shouldSplitDuocylinderEffectiveDistanceB(x,y,z,size){ //ie distance in flat space where would appear at same size
        //alternative implementation to check other one works.
        //calculate the two points (camera and on surface), take dot product.
        // cos(ang) = dot product
        // sin(alpha) = effective distance
        // => sqrt(1- dot prod squared)
        
        var alpha = Math.PI/4 + z/500;
        var cameraPos = {x:Math.cos(alpha), y:0, z:Math.sin(alpha), w:0};
    
        //other point is height 0, some map coords
        var angleX= 2*Math.PI * x/1024;
        var angleY= 2*Math.PI * y/1024;
    
        var oneOverRoot2 = Math.sqrt(0.5);
        var pointPos = {x:oneOverRoot2*Math.cos(angleX), y:oneOverRoot2*Math.sin(angleX),
            z:oneOverRoot2*Math.cos(angleY), w:oneOverRoot2*Math.sin(angleY)};
    
        var dotProd = pointPos.x*cameraPos.x + pointPos.y*cameraPos.y + pointPos.z*cameraPos.z + pointPos.w*cameraPos.w;
        var effdistsq = 1 - dotProd*dotProd;
    
        //note picked 326 ~ 1024/PI out of hat
        //could speed up by square both sides
        return 220 * Math.sqrt(effdistsq) < MULTIPLIER*size;
    },
    "effective-4corners": function shouldSplitDuocylinderEffectiveDistance4Corners(x,y,z,size){
        var halfSquareShift = size/2;
            //note this is inefficient - each call recalculates some things
            //also possible that some part of square meets the split criteria though no corners do.
            //works as a proof of concept to check vs bounding shape on map
        var shouldSplitFunc = quadtreeShouldSplitFuncs["effective-a"];
        var corner1 = shouldSplitFunc(x-halfSquareShift,y-halfSquareShift,z,size);
        var corner2 = shouldSplitFunc(x+halfSquareShift,y-halfSquareShift,z,size);
        var corner3 = shouldSplitFunc(x-halfSquareShift,y+halfSquareShift,z,size);
        var corner4 = shouldSplitFunc(x+halfSquareShift,y+halfSquareShift,z,size);
        return corner1 || corner2 || corner3 || corner4;
    },
    "effective-area": function shouldSplitDuocylinderEffectiveDistanceArea(x,y,z,size){
        //NOTE this may be inefficient!

        //ensure x, y between -512, 512 ( below code assumes that )
        x-=512;
        y-=512;
        x = x - 1024*(Math.floor(x/1024));
        y = y - 1024*(Math.floor(y/1024));
        x-=512;
        y-=512;

        var alpha = Math.PI/4 + z/500;
        var cosa = Math.cos(alpha);
        var sina = Math.sin(alpha);
    
        var halfSquareShift = size/2;
        var xstart = x-halfSquareShift;
        var xend = x+halfSquareShift;
        var ystart = y-halfSquareShift;
        var yend = y+halfSquareShift;

        xstart = Math.abs(xstart);
        xend = Math.abs(xend);
        ystart = Math.abs(ystart);
        yend = Math.abs(yend);

        var cosumax = Math.cos(2*Math.PI * Math.min(xstart, xend)/1024);
        var cosvmax = Math.cos(2*Math.PI * Math.min(ystart, yend)/1024);

        var cosumin = Math.cos(2*Math.PI * Math.max(xstart, xend)/1024);
        var cosvmin = Math.cos(2*Math.PI * Math.max(ystart, yend)/1024);

        //TODO are these necessary? is similar needed for x,y ~ half grid size? , so cosine = -1?
        if (Math.abs(x)<size/2){
            cosumax=1;
        }
        if (Math.abs(y)<size/2){
            cosvmax=1;
        }

        if (Math.abs(x)> (1024-size)/2){
            cosumin=-1;
        }
        if (Math.abs(y)> (1024-size)/2){
            cosvmin=-1;
        }

        //find which combo produces the largest square?
        var square1 = Math.pow( cosa*cosumax +sina*cosvmax ,2);
        var square2 = Math.pow( cosa*cosumax +sina*cosvmin ,2);
        var square3 = Math.pow( cosa*cosumin +sina*cosvmax ,2);
        var square4 = Math.pow( cosa*cosumin +sina*cosvmin ,2);
        var best = Math.max(square1, square2, square3, square4);

        return 220 * Math.sqrt(1-0.5*best) < MULTIPLIER*size;
    },
    "a": function shouldSplitDuocylinder4DDistance(x,y,z,size){
        //todo include z in calculation (currently behaves as if z=0)
        var cosu = Math.cos(2*Math.PI * x/1024);
        var cosv = Math.cos(2*Math.PI * y/1024);
    
        var alpha = Math.PI/4 + z/500;
        var cosa = Math.cos(alpha);
        var sina = Math.sin(alpha);
    
        var squaredDist = 2 - Math.sqrt(2)*( cosu*cosa + cosv*sina );
        //note 250 pulled out of hat
        //could speed up by square both sides
        return 250 * Math.sqrt(squaredDist) < MULTIPLIER*size;
    },
    "b": function shouldSplitDuocylinder4DDistanceB(x,y,z,size){
        //alternative implementation to check other one works.
        //calculate the two points (camera and on surface), take distance.
    
        //camera point is above surface by z, at 0,0
        //say, on the line y=w=0, x=cos(alpha), z=sin(alpha), where alpha = PI/2 for height =0, alpha=0 for height minimum, alpha=
        //PI for height maximum. input z here is not well defined - could be alpha - PI/4 . doesn't really matter
        var alpha = Math.PI/4 + z/500;
        var cameraPos = {x:Math.cos(alpha), y:0, z:Math.sin(alpha), w:0};
    
        //other point is height 0, some map coords
        var angleX= 2*Math.PI * x/1024;
        var angleY= 2*Math.PI * y/1024;
    
        var oneOverRoot2 = Math.sqrt(0.5);
        var pointPos = {x:oneOverRoot2*Math.cos(angleX), y:oneOverRoot2*Math.sin(angleX),
            z:oneOverRoot2*Math.cos(angleY), w:oneOverRoot2*Math.sin(angleY)};
    
        var difference = {x:pointPos.x-cameraPos.x,y:pointPos.y-cameraPos.y,z:pointPos.z-cameraPos.z,w:pointPos.w-cameraPos.w};
    
        var squaredDist = difference.x*difference.x + difference.y*difference.y + difference.z*difference.z + difference.w*difference.w;
    
        //note 250 pulled out of hat
        //could speed up by square both sides
        return 250 * Math.sqrt(squaredDist) < MULTIPLIER*size;
    },
    "2d-distance": function shouldSplit3dDistance(x,y,z,size){
        return Math.sqrt(x*x + y*y) < MULTIPLIER*size;    //note could square both sides
    },
    "3d-distance": function shouldSplit3dDistance(x,y,z,size){
        return Math.sqrt(x*x + y*y + z*z) < MULTIPLIER*size;    //note could square both sides
    },
    "compound-distance": function shouldCompoundDistance(x,y,z,size){
        var chebyXY = Math.max(Math.abs(x), Math.abs(y));
        return Math.sqrt( chebyXY*chebyXY + z*z) < MULTIPLIER*size;    //note could square both sides
    },
    "compound-wrap": function shouldSplitCompoundWrap(x,y,z,size){
        var chebyXY = Math.max(Math.abs((Math.abs(x)+512)%1024 -512), Math.abs((((Math.abs(y)+512)%1024) - 512)));
        return Math.sqrt( chebyXY*chebyXY + z*z) < MULTIPLIER*size;
    },
}

var quadtreeSplitFunc = quadtreeShouldSplitFuncs.a;   //default. will switch when from UI element before each draw call.

function calculateQuadtree(viewpointPos, thisPart){
    //TODO put to obj so can extract quadtree for rendering, or provide some render() function

    thisPart.totalLeafs=1;  //if no subdivision

    var halfSize = thisPart.size/2;

    //decide if should split. various options for equation..
    var centrex = thisPart.xpos + halfSize;
    var centrey = thisPart.ypos + halfSize;
    var xdisplacement = viewpointPos.x - centrex;
    var ydisplacement = viewpointPos.y - centrey;

    var shouldSplit = quadtreeSplitFunc(xdisplacement, ydisplacement, viewpointPos.z, thisPart.size);

    // shouldSplit = true;  //4096 nodes as expect ( (2048/32)^2 )

    shouldSplit = shouldSplit && (thisPart.size>MIN_SIZE);

    if (shouldSplit){
        var children = [];
        
        children.push(calculateQuadtree(viewpointPos, {xpos:thisPart.xpos, ypos:thisPart.ypos, size:halfSize}));
        children.push(calculateQuadtree(viewpointPos, {xpos:thisPart.xpos+halfSize, ypos:thisPart.ypos, size:halfSize}));
        children.push(calculateQuadtree(viewpointPos, {xpos:thisPart.xpos, ypos:thisPart.ypos+halfSize, size:halfSize}));
        children.push(calculateQuadtree(viewpointPos, {xpos:thisPart.xpos+halfSize, ypos:thisPart.ypos+halfSize, size:halfSize}));
        thisPart.children = children;
        thisPart.totalLeafs = children.reduce(function(result, item){return result + item.totalLeafs},0);
    }

    return thisPart;
}

function renderQuadtree(quadTree, drawBlock){
    if (!quadTree){
        return; //inefficient. TODO ensure always defined
    }

    if (quadTree.totalLeafs == 1){
        drawBlock(quadTree.xpos, quadTree.ypos, quadTree.size);
    }else{
        quadTree.children.forEach(function(item){renderQuadtree(item, drawBlock);});
    }

}

function getCanvasDrawBlockFunc(ctx){
    return function(xpos,ypos,size){
        ctx.fillRect(xpos, ypos, size, size);
        ctx.strokeRect(xpos, ypos, size, size);
    }
};