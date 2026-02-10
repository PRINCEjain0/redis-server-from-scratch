import * as net from "net";
import { Socket } from 'net';
import {decodeRESP} from './resp/decoder';
const port: number= 6379;

const server = net.createServer((socket : Socket) =>{
    console.log('Client connected');

    let buffer = Buffer.alloc(0);

    socket.on('data', (chunck : Buffer) =>{
        buffer = Buffer.concat([buffer, chunck]);

        while(true){
            const result  = decodeRESP(buffer);
            if (!result) break;

            console.log("Parsed command:", result.value);

            buffer = buffer.slice(result.bytesConsumed);
        }
    })

    socket.on('end', () =>{
        console.log('Client disconnected');
    })

    socket.on('error', (err : Error) =>{
        console.error('Socket error:', err);
    })

socket.write('+OK\r\n');

})

server.listen(port,() =>{
    console.log(`Server is listening on port ${port}`);
})