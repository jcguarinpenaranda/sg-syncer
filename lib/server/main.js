'use strict';

/* Requerimientos de librerias */
var http = require('http');
var url = require('url');
var fs = require('fs');
var socketio = require('socket.io');
var WebTorrent = require('webtorrent');

/* Instanciando el cliente Webtorrent */
var torrentOpt = {
  //announce: [],              // Torrent trackers to use (added to list in .torrent or magnet uri)
  //getAnnounceOpts: Function, // Custom callback to allow sending extra parameters to the tracker
  maxWebConns: 8,       // Max number of simultaneous connections per web seed [default=4]
  path: '/home/sibaguide/videos/',              // Folder to download files to (default=`/tmp/webtorrent/`)
  //store: Function            // Custom chunk store (must follow [abstract-chunk-store](https://www.npmjs.com/package/abstract-chunk-store) API)
};
var wtClient = new WebTorrent();


/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
/* Iniciando las rutinas del servidor de sockets */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

/* Instancia el servidro http */
var httpServ = http.createServer(function(req,res){

    var path = url.parse(req.url).pathname;
    console.log(req.url);
    console.log(req.method);

    switch(path){

        case '/':

            let localIndexHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <title>SG-Syncer</title>
</head>
<body>
    <h1>SG-Syncer system</h1>
</body>
</html>`;

            res.writeHead(200,{'Content-Type':"text/html"});
            res.write(localIndexHtml);
            res.end();



            break;
        case '/socket.html':

            let pathToHtmlFiles = __dirname + '/../public' +path;
            fs.readFile(pathToHtmlFiles, function(error, data){
                if (error){
                    res.writeHead(404);
                    res.write("opps this doesn't exist - 404");
                    res.end();
                }
                else{
                    res.writeHead(200, {"Content-Type": "text/html"});
                    res.write(data, "utf8");
                    res.end();
                }
            });
            break;

        default:
            res.writeHead(404);
            res.write("opps this doesn't exist - 404");
            res.end();
            break;
    }
    
    //console.log(res);

});
httpServ.listen(9000);
/*
    mensajes a la consola sobre operación
*/
console.log("Servidor escuchando puerto 9000");

/*
---------------------------------------------------
---------------------------------------------------
    Servidor de sockets
---------------------------------------------------
---------------------------------------------------
*/


/* Instancia un servidor de websockets */
var socketServer = new socketio();
/* Vincula el server HTTP al WebSocket Server */
socketServer.listen(httpServ);

/* Emite mensaje para el evento onconnect */
socketServer.sockets.on('connection', function(socket){

    /* Registra el socket */
    socket.emit('message', {'message': 'hello world'});
    //console.log(socketServer.sockets);
    //console.log(socket.client);

    /* -------- */
    socket.on('subscribe', function(data) { 
        console.log('joining room', data.room);
        socket.join(data.room); 
    })

    socket.on('unsubscribe', function(data) {  
        console.log('leaving room', data.room);
        socket.leave(data.room); 
    })

    socket.on('send', function(data) {
        console.log('sending message');
        socket.sockets.in(data.room).emit('message', data);
    });

    socket.on('message', function(data) {
        console.log(data.message);
    });

    socket.on('personalizado',function(data){

        console.log(data);

    })

});



/*
    Empieza a enviar notificaciones basados en tiempo
*/


/*
var handlerevent = setInterval(function(){
    //console.log(socketServer);
    //console.log(Date.now());
    //socket.emit('message', {'message': ''+Date.now()+''});
    //socketServer.sockets.emit('message',{'message':''+Date.now()+''});
    console.log(wtClient.torrents.length);
    
    wtClient.torrents.forEach(function(torrent){

        console.info(torrent.infoHash);

    });
    
    console.log("------------------");
},3000);
*/

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
/* 

    Rutinas de analisis del sistema de archivos buscando nuevos archivos
    para agregarlos a red de torrents.

*/
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */



/*


    Analiza el comportamiento de un directorio buscando cambios en el mismo
    usando la libreria chokidar, ya que el recurso nativo fs de nodejs, presenta
    inconsistencias


*/
/*
var fs = require('fs');
var fsWatcher = fs.watch("/var/www/html/siba_videos/files",function(e,chng){

    console.log(e);
    console.log(chng);

});
*/
//let pathToReadFor = '/var/www/html/siba_videos/files/';
let pathToReadFor = '/home/sibaguide/videos/';
var chokidar = require('chokidar');
var watcher = chokidar.watch(pathToReadFor);
var totalSeeds = 0;
watcher.on('add',function(path){

    let expReg = new RegExp("\\.mov$|\\.mpg$|\\.mpeg$|\\.wmv$");
    if (typeof path == 'string'){

        if (expReg.test(path)){
            /* Genera una semilla del nuevo archivo */
            seedNewTorrent(path);
            totalSeeds++;
            console.log(`Total seeds: ${totalSeeds}`);
            
        }
    }
});



var seedNewTorrent = function (pathToFile){


    var resSeed = wtClient.seed(pathToFile,torrentOpt,function(torrent){

        console.log(torrent.name);
        console.log(torrent.infoHash);
        //console.log(torrent.magnetURI);
        /* Notifica a los clientes que hay nuevos archivos */
        socketServer.sockets.emit('new torrent',{'magnetURI': `${torrent.magnetURI}`});


    });

}