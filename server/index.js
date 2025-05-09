const express = require('express')
const { Server } = require('socket.io')
const http = require('http')
const path = require('path')

const app = express()
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
    cors: {
        origin: "*", // 允许所有来源
        methods: ["GET", "POST"], // 允许的HTTP方法
    }
})
const roomMap = new Map() //房间信息


app.use(express.static(path.join(__dirname, 'static')));

app.get("/", function (req, res) {
    res.sendFile(__dirname + "/index.html");
})

io.on('connection', (socket) => {
    console.log('socket 连接成功')
    socket.peer = null;
    socket.on('join', res => {
        console.log('加入房间', res)

        //拿到要加入房间号ID
        let room = roomMap.get(res.roomId);

        //判断是否房间已经被创建
        if (!room) {
            room = new Set();
            roomMap.set(res.roomId, room);
            room.add(res)
            socket.join(res.roomId)
            socket.peer = res
            socket.emit("new-peer", "createRoom")
        } else if (room.size >= 2) {
            socket.emit("roomFull", "该房间已满人！");
            return;
        } else {
            socket.join(res.roomId)
            room.add(res)
            console.log('---room-----', roomMap)
            socket.to(res.roomId).emit("new-peer", res)
            socket.peer = res
            socket.emit("resp-join", Array.from(room).filter(item => item.uid !== res.uid))
        }
    })

    //服务器接收SDP offer
    socket.on("offer", res => {
        //拿到要发送offer房间号ID
        console.log("服务端接收offer")
        let room = roomMap.get(res.roomId);
        if (room == null) {
            console.error("room is null" + res.roomId)
            return
        }
        socket.broadcast.to(res.roomId).emit("peer-offer", res)
    })

    //服务器接收SDP answer
    socket.on("answer", res => {
        //拿到要发送offer房间号ID
        console.log("服务端接收answer")
        let room = roomMap.get(res.roomId);
        if (room == null) {
            console.error("room is null", res.roomId)
            return
        }
        socket.broadcast.to(res.roomId).emit("peer-answer", res)
    })

    //服务器接收candidate
    socket.on("candidate", res => {
        console.log("服务端接收candidate")
        //拿到要发送offer房间号ID
        let room = roomMap.get(res.roomId);
        if (room == null) {
            console.error("room is null" + res.roomId)
            return
        }

        socket.broadcast.to(res.roomId).emit("peer-candidate", res)
    })

    //有人离开房间
    socket.on("leave", res => {
        //拿到要离开房间号ID
        let room = roomMap.get(res.roomId);

        if (room) {
            const userToRemove = Array.from(room).find(item => item.uid === res.uid);
            if (userToRemove) {
                room.delete(userToRemove);
                console.log(`用户 ${res.uid} 已从房间 ${res.roomId} 中删除`);
                console.log('此时房间还有:', room);
            }
            if (room.size === 0) {
                roomMap.delete(res.roomId);
            } else {
                var jsonMsg = {
                    "cmd": "peer-leave",
                    "remoteUid": res.uid
                }
                socket.to(res.roomId).emit("peer-leave", jsonMsg);
            }
        }
        socket.leave(res.roomId);
    })
})

httpServer.listen(3100, function () {
    console.log('服务器启动成功了:http://localhost:3100')
});