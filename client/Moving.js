/**
 * Created by Jerome on 04-10-17.
 */
var Moving = new Phaser.Class({

    Extends: CustomSprite,

    initialize: function Moving (){
        this.lastSteps = [];
        // Using call(), the called method will be executed while having 'this' pointing to the first argumentof call()
        CustomSprite.call(this, Engine.scene, 0,0);

        this.orientation = 'down';
        this.previousOrientation = this.orientation;
        this.movement = null;

        this.setInteractive();
    },

    // Sets position regardless of previous position; primarily called by children.setUp()
    setPosition: function(x,y){ // x and y are tile coordinates
        Phaser.GameObjects.Components.Transform.setPosition.call(this,x*Engine.tileWidth,y*Engine.tileHeight);
        this.setTilePosition(x,y);
        this.updatePosition(x,y);
    },

    setTilePosition: function(x,y){
        this.tileX = x;
        this.tileY = y;
    },

    // Updates the position; primarily called as the entity moves around and has moved by at least 1 tile
    updatePosition: function(x,y){ // x and y are tile cordinates
        //console.log('[',this.id,'] updating to',x,y);
        this.updatePreviousPosition();
        this.setTilePosition(x,y);
        this.updateDepth();
        this.updateChunk();
        if(!this.rewinding) this.recordPosition();
    },

    recordPosition: function(){
        this.lastSteps.push({
            x: this.tileX,
            y: this.tileY
        });
        if(this.lastSteps.length > 5) this.lastSteps.shift();
        //console.log('[',this.id,']',JSON.stringify(this.lastSteps));

    },

    updatePreviousPosition: function(){
        this.previousPosition = {
            x : this.x,
            y : this.y,
            tx: this.tileX,
            ty: this.tileY
        };
    },

    updateDepth: function(){
        this.setDepth(Engine.playersDepth + this.tileY / 1000);
    },

    updateChunk: function(){
        this.chunk = Utils.tileToAOI({x:this.tileX,y:this.tileY});
        if(this.isHero) {
            if(this.chunk != this.previousChunk) Engine.updateEnvironment();
            this.previousChunk = this.chunk;
        }
    },

    getShortID: function(){
        return this.constructor.name[0]+this.id;
    },

    move: function(path){
        if(path.length <= 1) this.endMovement();
        if(this.isActiveFighter) BattleManager.deactivateCell();

        var tweens = [];
        for(var i = 0; i < path.length-1; i++){
            var sx = path[i][0];
            var sy = path[i][1];
            var ex = path[i+1][0];
            var ey = path[i+1][1];
            var time = PFUtils.getDuration(sx,sy,ex,ey); // in sec
            tweens.push({
                targets: this,
                x: {value: ex*Engine.tileWidth, duration: time*1000},
                y: {value: ey*Engine.tileHeight, duration: time*1000},
                onStartParams: [sx,sy,ex,ey],
                onStart: this.tileByTilePreUpdate.bind(this),
                onComplete: this.tileByTilePostUpdate.bind(this)
            });
        }

        if(this.movement !== null) this.movement.stop();

        this.movement = Engine.scene.tweens.timeline({
            tweens: tweens,
            onSart: this.beginMovement.bind(this),
            onUpdate: this.frameByFrameUpdate.bind(this),
            onComplete: this.endMovement.bind(this)
        });
    },

    beginMovement: function(){
        this.moving = true;
    },

    frameByFrameUpdate: function(){
        if(this.bubble) this.bubble.updatePosition(this.x-this.bubbleOffsetX,this.y-this.bubbleOffsetY);
    },

    computeOrientation: function(fromX,fromY,toX,toY){
        if(fromX > toX){
            this.orientation = 'left';
        }else if(fromX < toX) {
            this.orientation = 'right';
        }else if(fromY > toY) {
            this.orientation = 'up';
        }else if(fromY < toY) {
            this.orientation = 'down';
        }
    },

    faceOrientation: function(){
        this.setFrame(this.restingFrames[this.orientation]);
    },
    
    tileByTilePreUpdate: function(tween,targets,startX,startY,endX,endY){
        if(!this.scene) return; // quick fix before the bug gets fixed in Phaser

        this.computeOrientation(startX,startY,endX,endY);

        if(this.orientation != this.previousOrientation){
            this.previousOrientation = this.orientation;
            this.anims.play(this.walkAnimPrefix+'_move_'+this.orientation);
        }

        if(this.isHero){
            var position = Engine.getMouseCoordinates(Engine.lastPointer);
            Engine.updateMarker(position.tile);
        }
    },

    tileByTilePostUpdate: function(){
        if(!this.scene) return; // quick fix before the bug gets fixed in Phaser

        var tx = Math.floor(this.x/Engine.tileWidth);
        var ty = Math.floor(this.y/Engine.tileHeight);
        this.updatePosition(tx,ty);

        //if(this.constructor.name == 'Player') this.leaveFootprint();
        this.leaveFootprint();

        if(this.flagForStop){
            this.flagForStop = false;
            this.movement.stop(); // TODO: use new phaser argument to call endMovement automatically
            this.endMovement();
            this.rewind();
        }
    },

    teleport: function(x,y){
        this.setPosition(x,y);
    },

    stop: function(x,y){
        console.log('STOPPING',this.constructor.name,this.id,'at',x,y);
        console.log('currently at',this.tileX,this.tileY);
        if(this.tileX == x && this.tileY == y) return;
        this.flagForStop = true;
        if(x === undefined && y === undefined) return;

        var path = [];
        for(var i = this.lastSteps.length - 1; i >= 0; i--){
            var tile = this.lastSteps[i];
            path.push([tile.x,tile.y]);
            if(tile.x == x && tile.y == y) break;
        }
        this.rewindPath = path;
        if(!this.moving){
            this.flagForStop = false;
            this.rewind();
        }
    },

    rewind: function(){
        this.rewinding = true;
        console.log(this.rewindPath);
        this.move(this.rewindPath);
        this.rewindPath = [];
    },

    endMovement: function(){
        if(!this.active) return; // quick fix
        this.moving = false;
        this.rewinding = false;
        this.previousOrientation = null;
        this.anims.stop();
        this.setFrame(this.restingFrames[this.orientation]);
    },

    leaveFootprint: function(){
        var print = Engine.footprintsPool.getNext();
        print.setFrame(this.footprintsFrame);

        // Position
        var sx = this.previousPosition.x + Engine.tileWidth/2;
        var sy = this.previousPosition.y + Engine.tileHeight/2;
        if(this.printsVertOffset) sy += this.printsVertOffset;
        print.setPosition(sx,sy);

        // Angle
        var dx = this.tileX - this.previousPosition.tx;
        var dy = this.tileY - this.previousPosition.ty;

        var angle = 0; // clockwise rotations
        if(dx == 1 && dy == 0){ // went right
            angle = 90;
        }else if(dx == -1 && dy == 0){ // went left
            angle = -90
        }else if(dx == 0 && dy == 1){ // went down
            angle = 180;
        }
        print.angle = angle;

        //Flip
        print.flipX = this.flipPrint;
        this.flipPrint = !this.flipPrint;

        print.alpha = 0.7;
        print.depth = Engine.markerDepth;
        print.setVisible(true);

        Engine.scene.tweens.add({
            targets: print,
            alpha: 0,
            duration: 15000,
            onComplete: function(){
                print.recycle();
            }
        });
    }
});