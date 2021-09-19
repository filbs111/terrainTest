const MIN_SIZE = 32;

// var MULTIPLIER = 1.5; //ensures that neighbouring LOD levels differ by at most 1
const MULTIPLIER = 2.5;

function shouldSplitEucledianDistance(x,y,size){
    return Math.max(Math.abs(x), Math.abs(y)) < MULTIPLIER*size;
}

//TODO when using this, adapt morph shader
function shouldSplitEucledianWrap(x,y,size){
    return Math.max(Math.abs((Math.abs(x)+512)%1024 -512), Math.abs((((Math.abs(y)+512)%1024) - 512) )) < MULTIPLIER*size;
}

//TODO when using this, adjust morph shader and shapes displayed on minimap.
//maybe simplify bounding shape. diamond?
function shouldSplitDuocylinderEffectiveDistance(x,y,size){ //ie distance in flat space where would appear at same size
    var cosu = Math.cos(2*Math.PI * x/1024);
    var cosv = Math.cos(2*Math.PI * y/1024);

    //note picked 326 ~ 1024/PI out of hat
    return 326 * Math.sqrt(1-(Math.pow( (cosu + cosv)/2 ,2))) < MULTIPLIER*size;
}
function calculateQuadtree(viewpointPos, thisPart){
    //TODO put to obj so can extract quadtree for rendering, or provide some render() function

    thisPart.totalLeafs=1;  //if no subdivision

    var halfSize = thisPart.size/2;

    //decide if should split. various options for equation..
    var centrex = thisPart.xpos + halfSize;
    var centrey = thisPart.ypos + halfSize;
    var xdisplacement = viewpointPos.x - centrex;
    var ydisplacement = viewpointPos.y - centrey;

    var shouldSplit = shouldSplitDuocylinderEffectiveDistance(xdisplacement, ydisplacement, thisPart.size);

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