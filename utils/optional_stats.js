var stats = (function(){

    //initialise to dummy object
    var statsobj = {
        begin:()=>{},
        end:()=>{}
    }

    var setup = function(){
        var stats = new Stats();
        stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild( stats.dom );
        statsobj = stats;
    }

    return {
        get: function(){
        return statsobj;
        },
        setup
    }

}());