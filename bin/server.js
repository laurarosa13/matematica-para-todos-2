var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var local_ip = require('my-local-ip')()
var spawn = require('child_process').spawn;
var jugadores = {};
var resultados = [];
var MAX_JUGADORES = 2;
var FILE_MAZO = '../src/mazo.json';
var Mazo = require(FILE_MAZO);
var FILE_LOGGER = '/tmp/log-servidor.txt';
var MAX_RESPUESTAS_DIFIRENTES = 0;
var PUERTO = 3000;

function conectado(socket) {
    var jugador_ip = socket.handshake.address;
    console.log("Se unio un jugador en " + jugador_ip);
}

function desconectado(socket) {
    var jugador_ip = socket.handshake.address;
    console.log("Se fue un jugador en " + jugador_ip + "\n");
}

function iniciar_servidor(PUERTO) {
//    var respuestas = [];
    var indice = 0;
    var respuestaCorrecta = "";
    var respuestaAuxiliar = {};
    var ultimoGanador = ""; // Guarda este dato para cuando la última jugada es empate.
    
    io.on('connection', function (socket) {
        console.log('connection');
        socket.on('respuesta', function (opcion) {
            respuestaAuxiliar[opcion.nro_jugador] = {respuesta: opcion.respuesta, carta: jugadores[opcion.nro_jugador].mazo[indice] };
            // Tengo ambas respuestas //
            if(respuestaAuxiliar.jugador1 && respuestaAuxiliar.jugador2) {
                console.log("Tengo ambas respuestas");
                respuestaCorrecta = "";
                if (jugadores.jugador1.mazo[indice].lados > jugadores.jugador2.mazo[indice].lados) {
                    respuestaCorrecta = "jugador1";
                } else if (jugadores.jugador1.mazo[indice].lados < jugadores.jugador2.mazo[indice].lados) {
                    respuestaCorrecta = "jugador2";
                } else {
                    respuestaCorrecta = "empate";
                }
                respuestaAuxiliar.respuestaCorrecta = respuestaCorrecta;
//                respuestaAuxiliar.jugador1.mazo = jugadores.jugador1.mazo[indice];
//                respuestaAuxiliar.jugador2.mazo = jugadores.jugador2.mazo[indice];
                resultados[indice] = respuestaAuxiliar;
                
                // Respuestas iguales //
                if(resultados[indice].jugador1.respuesta == resultados[indice].jugador2.respuesta) {
                    console.log('Respuestas iguales.');
                    // Empate = Guerra //
                    if(resultados[indice].jugador1.respuesta == 'empate') {
                        console.log('Empate = Guerra.');
                        add_contador_guerra();
                    } else {
                        console.log('Respuestas iguales. Ganó jugador: ' + resultados[indice].jugador1.respuesta);
                        add_contador_jugador(resultados[indice].jugador1.respuesta); // Envia jugador1 porque es inditinto ya que eligieron la misma respuesta //
                        ultimoGanador = resultados[indice].jugador1.respuesta;
                    }
                    indice++;
                } else {
                    console.log('Las respuestas difieren Repregunto');
//                    indice--; // Decremento para que vuelva a enviar la misma mano al emitir
                }
                respuestaAuxiliar = {};
                console.log('Se juega ahora la mano: ' + indice);
                
                if(indice >= Mazo.mazo.length) {
                    console.log("Mostrar la tabla de resultados.");
                    if(exist_guerra()) {
                        jugadores[ultimoGanador].contador += jugadores.contadorGuerra;
                        jugadores.contadorGuerra = 0;
                    }
                    io.emit('tabla', resultados);
                    return;
                }
                io.emit('mano', get_mano(jugadores, indice));
            }
        });

        if (get_jugadores_count(jugadores) >= MAX_JUGADORES) {
            console.log('Se conecto el maximo de jugadores: ' + jugadores);
            return;
        }
        
        var jugador_ip = socket.handshake.address;
        var jugadorNumero = socket.handshake.query.nro_jugador;
        var nombre_jugador = socket.handshake.query.nombre_jugador;

        jugadores[jugadorNumero] = { nombre: nombre_jugador, ip: jugador_ip, contador: 0, mazo: [] };
        console.log('Hay conectados '+ get_jugadores_count(jugadores) +' jugadores');
        conectado(socket);
        if (get_jugadores_count(jugadores) == MAX_JUGADORES) {
            console.log("Ya tenemos a todos los jugadores");
	    console.log("Matamos publicacon con avahi");
            console.log("Arrancamos el juego");

	    aps.kill();
            jugadores.contadorGuerra = 0;
            repartir_cartas(jugadores);
            
            io.emit('listo', get_jugadores(jugadores));
            console.log('Se juega ahora la mano: ' + indice);
            io.emit('mano', get_mano(jugadores, indice));
        }

        socket.on('disconnect', function () {
	    console.log('El cliente se desconecto');	
	    io.emit('retiro');
	    jugadores = {};
	/*
            var index = jugadores.indexOf(jugador_ip);
            jugadores.splice(index, 1);
            io.emit('retiro', jugador_ip);
            desconectado(socket);
            console.log('Hay conectados ' + get_jugadores_count(jugadores) + ' jugadores');
	*/
        });
    });

    http.listen(PUERTO, function () {
        console.log('Esperando jugadores en ' + PUERTO);
    });
}

function get_jugadores(jugadores) {
    return {
        jugador1: { nro_jugador: 'jugador1', nombre: jugadores.jugador1.nombre, ip: jugadores.jugador1.ip, contador: jugadores.jugador1.contador },
        jugador2: { nro_jugador: 'jugador2', nombre: jugadores.jugador2.nombre, ip: jugadores.jugador2.ip, contador: jugadores.jugador2.contador },
    };
}

function get_jugadores_count(jugadores) {
    return Object.keys(jugadores).length;
}

function get_mano(jugadores, indice) {
    return {
        jugador1: { nro_jugador: 'jugador1', carta: jugadores.jugador1.mazo[indice], contador: jugadores.jugador1.contador },
        jugador2: { nro_jugador: 'jugador2', carta: jugadores.jugador2.mazo[indice], contador: jugadores.jugador2.contador },
        contadorGuerra: jugadores.contadorGuerra
    }
}

function add_contador_guerra() {
    jugadores.contadorGuerra++;
}

function exist_guerra() {
    return jugadores.contadorGuerra ? true : false;
}

function add_contador_jugador(jugador) {
    if(exist_guerra()) {
        console.log('Habia ' + jugadores.contadorGuerra + ' retenidas por guerra.');
        jugadores[jugador].contador += jugadores.contadorGuerra;
        jugadores.contadorGuerra = 0;
    }
    jugadores[jugador].contador++;
}


function repartir_cartas(jugadores) {
    mazo_completo = Mazo.mazo.concat(Mazo.mazo);
    mazo_jugador1 = [];
    mazo_jugador2 = [];

    for (var k = 0; k < Mazo.mazo.length; k++) {
        var id_carta_jugador1 = Math.floor(Math.random() * mazo_completo.length);
        var carta_jugador1 = mazo_completo[id_carta_jugador1];
        mazo_jugador1.push(carta_jugador1);
        mazo_completo.splice(id_carta_jugador1, 1);

        var id_carta_jugador2 = Math.floor(Math.random() * mazo_completo.length);
        var carta_jugador2 = mazo_completo[id_carta_jugador2];
        mazo_jugador2.push(carta_jugador2);
        mazo_completo.splice(id_carta_jugador2, 1);
    }
    jugadores.jugador1.mazo = mazo_jugador1;
    jugadores.jugador2.mazo = mazo_jugador2;
}

function publicar_servidor()
{
    aps = spawn('avahi-publish-service', [ '-s', 'huayra_mxt-' + local_ip + '-' + usuario, '_http._tcp', PUERTO ]);
    aps.stdout.on('data', function (data) {
        //console.log("stderr", data);
    });

    aps.on('error', function (codigo) {
        console.error("ERROR: no se puede ejecutar avahi-publish-service", codigo);
    });

    aps.on('exit', function (codigo) {
        if (codigo) {
            console.log("Error, el comando retorno: " + codigo);
        } else {
            console.log("ha finalizado el comando avahi-publish-service");
        }
    });

    return aps;
}

var usuario;
process.argv.forEach(function (val, index, array) {
    if (/--usuario=/.test(val)) {
        usuario = val.split('=')[1];
    }
});

process.on('SIGTERM', function() {
	aps.kill();

	process.exit(0);
});


if (!usuario) {
    console.log("ERROR: No se especifico usuario");
    console.log("# node bin/server.js --usuario=Nombre");
    process.exit(-1);
}


iniciar_servidor(PUERTO);
var aps = publicar_servidor();
