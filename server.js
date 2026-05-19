const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 1e9, 
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log(`[Yeni Cihaz] ID: ${socket.id}`);

    socket.on('create-session', (sessionCode) => {
        socket.join(sessionCode);
        socket.emit('session-created'); 
    });

    socket.on('join-session', (sessionCode) => {
        const session = io.sockets.adapter.rooms.get(sessionCode);
        let numClients = session ? session.size : 0;

        if (numClients === 0) {
            socket.emit('session-error', 'Geçersiz veya süresi dolmuş kod!');
        } else if (numClients === 1) {
            socket.join(sessionCode);
            socket.emit('session-joined'); 
            socket.to(sessionCode).emit('peer-joined'); 
        } else {
            socket.emit('session-error', 'Bu odaya zaten iki cihaz bağlı!');
        }
    });

    // YENİ: Sayfa yenilendiğinde odaya geri sızma komutu
    socket.on('reconnect-session', (sessionCode) => {
        socket.join(sessionCode);
        socket.emit('session-joined'); 
        socket.to(sessionCode).emit('peer-joined'); 
    });

    socket.on('send-message', (data) => {
        socket.to(data.sessionCode).emit('receive-message', data);
    });

    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.to(room).emit('peer-disconnected');
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Ayrıldı] ID: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`easydrop aktif! http://localhost:${PORT} adresinde çalışıyor.`);
});