import * as net from "net";
import { Socket } from 'net';
import {decodeRESP} from './resp/decoder';
import { encodeRESP } from "./resp/encoder";

const port: number= 6379;

const server = net.createServer((socket : Socket) =>{
    console.log('Client connected');

    let buffer = Buffer.alloc(0);

    socket.on('data', (chunck : Buffer) =>{
        buffer = Buffer.concat([buffer, chunck]);

        while(true){
            const result  = decodeRESP(buffer);
            if (!result) break;

            const command = result.value[0];

            console.log("Parsed command:", command);

            if(command === "PING"){
                const response = encodeRESP("PONG");
                socket.write(response);
            }

            buffer = buffer.slice(result.bytesConsumed);
        }
    })

    socket.on('end', () =>{
        console.log('Client disconnected');
    })

    socket.on('error', (err : Error) =>{
        console.error('Socket error:', err);
    })

})

server.listen(port,() =>{
    console.log(`Server is listening on port ${port}`);
})