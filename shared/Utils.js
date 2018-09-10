/**
 * Created by Jerome on 11-08-17.
 */

var onServer = (typeof window === 'undefined');

if(onServer){
    World = require('./World.js').World;
}

var Utils = {
    colors: {},
    strokes: {},
    fonts: {}
};

Utils.colors.white = '#ffffff';
Utils.colors.gold = '#ffd700';
Utils.colors.red = '#ff0000';
Utils.colors.blue = '#558fff';
Utils.strokes.red = '#331111';
Utils.colors.green = '#11ee11';

Utils.fonts.normal = 'arial';
Utils.fonts.fancy = 'belwe';

// ### Coordinates methodes ###

Utils.tileToAOI = function(tile){ // input coords in Tiles
    if(!World.nbChunksHorizontal) throw Error('Chunk data not initialized');
    var top = Math.floor(tile.y/World.chunkHeight);
    var left = Math.floor(tile.x/World.chunkWidth);
    return (top*World.nbChunksHorizontal)+left;
};

Utils.AOItoTile = function(aoi){
    if(!World.nbChunksHorizontal) throw Error('Chunk data not initialized');
    return {
        x : (aoi%World.nbChunksHorizontal)*World.chunkWidth,
        y : Math.floor(aoi/World.nbChunksHorizontal)*World.chunkHeight
    };
};

Utils.gridToLine = function(x,y,w){
    return (y*w)+x;
};

Utils.gridToLineWithOrigin = function(x,y,w){
    var aoi = Utils.tileToAOI({x:x,y:y});
    var origin = Utils.AOItoTile(aoi);
    return Utils.gridToLine(x-origin.x,y-origin.y,w);
};

Utils.lineToGrid = function(i,w){
    return {
        x: i%w,
        y: Math.floor(i/w)
    }
};

Utils.tileToPct = function(x,y){
    return {
        x : x / World.worldWidth,
        y : y / World.worldHeight
    }
};

Utils.pctToTile = function(x,y){
    return {
        x : x * World.worldWidth,
        y : y * World.worldHeight
    }
};

Utils.screenToMap = function(x,y,map){
    var tlx = map.x - map.originX*map.width;
    var tly = map.y - map.originY*map.height;
    var pctx = (x-tlx)/map.width;
    var pcty = (y-tly)/map.height;
    var tile = Utils.pctToTile(pctx,pcty);
    return {
        x: Math.ceil(tile.x),
        y: Math.ceil(tile.y)
    }
};

// ### Quadrant-related methods ###

Utils.AOIcoordinates = function(aoi){
    return {
        x : (aoi%World.nbChunksHorizontal),
        y : Math.floor(aoi/World.nbChunksHorizontal)
    }
};

Utils.distanceBetweenAOIs = function(A,B){
    return Utils.manhattan(Utils.AOIcoordinates(A),Utils.AOIcoordinates(B));
};

Utils.tileToQuadrant = function(x,y,quadW,quadH){
    if(!quadW) quadW = 10;
    if(!quadH) quadH = 10;
    var aoi = Utils.tileToAOI({x:x,y:y});
    return Utils.aoiToQuadrant(aoi,quadW,quadH);
};

Utils.aoiToQuadrant = function(aoi,quadW,quadH){
    var aoiCoords = Utils.lineToGrid(aoi,World.nbChunksHorizontal);
    var nbQuadsHorizontal = Math.ceil(World.nbChunksHorizontal/quadW);
    var top = Math.floor(aoiCoords.y/quadH);
    var left = Math.floor(aoiCoords.x/quadW);
    return (top*nbQuadsHorizontal)+left;
};

Utils.distanceToPoles = function(x,y,poles){
    var aoi = Utils.tileToAOI({x:x,y:y});
    var aoicoord = Utils.lineToGrid(aoi,World.nbChunksHorizontal);
    var dists = []; // distances (in aoi) between tile and each pole
    var sum = 0;
    for(var i = 0; i < poles.length; i++){
        var d = Utils.euclidean(
            aoicoord,
            Utils.lineToGrid(poles[i],World.nbChunksHorizontal)
        );
        if(d == 0) d = 0.1;
        d *= d; // polarizes more
        sum += d;
        dists.push(d);
    }
    //console.log('distances :', dists, 'sum = ',sum);

    // Revert: d' = sum/d
    var sumweights = 0;
    var weights = dists.map(function(d){
        //var w = (d > 0 ? sum/d : 1);
        var w = sum/d;
        sumweights += w;
        return w;
    });
    //console.log('weights :', weights);

    // Normalize: z = d'/sum'
    var normalized = weights.map(function(w){
        var w = Math.round((w/sumweights)*10);
        if(w <= 2) w = 0;
        return w;
    });
    //console.log('normalized :', normalized);
    return normalized;
};


// ### General methods ###

Utils.listAdjacentAOIs = function(current){
    if(!World.nbChunksHorizontal){
        console.log('ERROR : Chunk data not initialized');
        return [];
    }

    var AOIs = [];
    var isAtTop = (current < World.nbChunksHorizontal);
    var isAtBottom = (current > World.lastChunkID - World.nbChunksHorizontal);
    var isAtLeft = (current%World.nbChunksHorizontal == 0);
    var isAtRight = (current%World.nbChunksHorizontal == World.nbChunksHorizontal-1);
    AOIs.push(current);
    if(!isAtTop) AOIs.push(current - World.nbChunksHorizontal);
    if(!isAtBottom) AOIs.push(current + World.nbChunksHorizontal);
    if(!isAtLeft) AOIs.push(current-1);
    if(!isAtRight) AOIs.push(current+1);
    if(!isAtTop && !isAtLeft) AOIs.push(current-1-World.nbChunksHorizontal);
    if(!isAtTop && !isAtRight) AOIs.push(current+1-World.nbChunksHorizontal);
    if(!isAtBottom && !isAtLeft) AOIs.push(current-1+World.nbChunksHorizontal);
    if(!isAtBottom && !isAtRight) AOIs.push(current+1+World.nbChunksHorizontal);
    return AOIs;
};

Utils.formatMoney = function(nb){
    return 'coin'+(nb > 1 ? 's' : '');
};

Utils.euclidean = function(a,b){
    //console.log('dist between',a,b);
    return Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y- b.y,2));
};

Utils.chebyshev = function(A,B){
    return Math.max(Math.abs(A.x-B.x),Math.abs(A.y-B.y));
};

Utils.nextTo = function(a,b){
    a = a.getRect();
    b = b.getRect();
    return Utils.overlap(a,b,true);
};

Utils.overlap = function(a,b,touch){
    if(touch){ // touching counts as overlapping
        if(a.x > b.x + b.w || b.x > a.x + a.w) return false;
        if(a.y > b.y + b.h || b.y > a.y + a.h) return false;
    }else{
        if(a.x >= b.x + b.w || b.x >= a.x + a.w) return false;
        if(a.y >= b.y + b.h || b.y >= a.y + a.h) return false;
    }
    //if(a.x > b.x + b.w || b.x > a.x + a.w) return false;
    //if(a.y > b.y + b.h || b.y > a.y + a.h) return false;
    return true;
};

Utils.multiChebcomponent = function(A,B,coord,length){
    return Math.min(
        Math.abs(A[coord]-B[coord]),
        Math.abs(A[coord]+A[length]-B[coord]),
        Math.abs(A[coord]-(B[coord]+B[length])),
        Math.abs(A[coord]+A[length]-(B[coord]+B[length]))
    );
};

// a & b should be rectangles, i.e. expose x, y, w and h
Utils.multiTileChebyshev = function(A,B){
    /*var dx = Math.min(
        Math.abs(A.x-B.x),
        Math.abs(A.x+A.w-B.x),
        Math.abs(A.x-(B.x+B.w)),
        Math.abs(A.x+A.w-(B.x+B.w))
    );
    var dy = Math.min(
        Math.abs(A.y-B.y),
        Math.abs(A.y+A.h-B.y),
        Math.abs(A.y-(B.y+B.h)),
        Math.abs(A.y+A.h-(B.y+B.h))
    );*/
    //console.warn(dx,dy);
    //return Math.max(dx,dy);
    return Math.max(Utils.multiChebcomponent(A,B,'x','w'),Utils.multiChebcomponent(A,B,'y','h'));
};

// With respect to B
Utils.relativePosition = function(A,B){
    return {
        x: Math.sign(B.x-A.x),
        y: Math.sign(B.y-A.y)
    }
};

Utils.manhattan = function(a,b){
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

Utils.multiTileManhattan = function(A,B){
    var dx = Math.min(
        Math.abs(A.x-B.x),
        Math.abs(A.x+A.w-B.x),
        Math.abs(A.x-(B.x+B.w)),
        Math.abs(A.x+A.w-(B.x+B.w))
    );
    var dy = Math.min(
        Math.abs(A.y-B.y),
        Math.abs(A.y+A.h-B.y),
        Math.abs(A.y-(B.y+B.h)),
        Math.abs(A.y+A.h-(B.y+B.h))
    );
    return Math.abs(dx)+Math.abs(dy);
};

Utils.clamp = function(x,min,max){ // restricts a value to a given interval (return the value unchanged if within the interval
    return Math.max(min, Math.min(x, max));
};

Utils.randomInt = function(low, high) { // [low, high]
    high++;
    return Math.floor(Math.random() * (high - low) + low);
};

Utils.randomElement = function(arr){
    return arr[Math.floor(Math.random()*arr.length)];
};

Utils.randomElementRemoved = function(arr){
    return arr.splice(Math.floor(Math.random()*arr.length),1)[0];
};

Utils.randomNorm = function(mean,std){ // Returns a value from a normal distribution
    return randomZ()*std+mean;
};

function randomZ() { // Box-Muller transform to return a random value from a reduced normal
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

Utils.swapElements = function(arr,b,c){
    var tmp = arr[b];
    arr[b] = arr[c];
    arr[c] = tmp;
};

Utils.removeElement = function(v,arr){
    var idx = arr.indexOf(v);
    if(idx > -1) arr.splice(idx,1);
};

Utils.insert = function(a1,a2,pos){ // insert array a1 at position pos in array a2
    a1.splice.apply(a1, [pos, 0].concat(a2));
};

Utils.shuffle = function(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
};

Utils.printArray = function(arr){
    console.log(JSON.stringify(arr));
};

Utils.capitalizeFirstLetter = function(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

function coordinatesPairToTile(coords){
    return {
        x: Math.floor(coords.x/World.tileWidth),
        y: Math.floor(coords.y/World.tileHeight)
    }
}

function coordinatesToCell(v,grid){
    return Math.floor(v/grid);
}

Array.prototype.diff = function(a) { // returns the elements in the array that are not in array a
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};

Array.prototype.last = function(){
    return this[this.length-1];
};

if (onServer) module.exports.Utils = Utils;