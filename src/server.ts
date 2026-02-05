import * as net from "net";
import { Socket } from 'net';

const port: number= 6379;

const server = net.createServer((socket : Socket) =>{
    console.log('Client connected');

    socket.on('data', (data : Buffer) =>{
        console.log('Received data:', data.toString());
    })

    socket.on('end', () =>{
        console.log('Client disconnected');
    }
    )

    socket.on('error', (err : Error) =>{
        console.error('Socket error:', err);
    }

)

})

server.listen(port,() =>{
    console.log(`Server is listening on port ${port}`);
})